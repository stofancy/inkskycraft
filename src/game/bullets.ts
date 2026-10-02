// 敌弹池。形状/颜色/加速度/角速度/悬停/自定义更新。
import { BULLET_SHAPES, type BulletShape } from '../gl/bullets';
import { PLAY_H, PLAY_W } from '../types';

export type { BulletShape };

/** 敌弹颜色（线性 HDR）。 */
export const BULLET_COLORS = {
  cyan: [0.2, 1.0, 1.25],
  magenta: [1.35, 0.18, 0.95],
  violet: [0.75, 0.32, 1.5],
  amber: [1.45, 0.62, 0.1],
  lime: [0.55, 1.3, 0.15],
  red: [1.6, 0.15, 0.1],
  blue: [0.25, 0.45, 1.7],
  white: [1.2, 1.15, 1.1],
  gold: [1.45, 1.0, 0.3],
} as const satisfies Record<string, readonly [number, number, number]>;
export type BulletColor = keyof typeof BULLET_COLORS;

const DEFAULT_SIZE: Record<BulletShape, number> = {
  orb: 7, rice: 7, needle: 8, star: 8, ring: 8, petal: 7, big: 16, crystal: 8, flame: 9,
};
/** 判定半径 / 视觉尺寸。 */
const HIT_FACTOR: Record<BulletShape, number> = {
  orb: 0.75, rice: 0.6, needle: 0.4, star: 0.7, ring: 0.75, petal: 0.6, big: 0.8, crystal: 0.6, flame: 0.6,
};

export interface BulletStyle {
  /** 显式标记追踪弹；算盘干扰只移除追踪回调。 */
  homing?: boolean;
  /** 诊断用发射函数名，不改变弹体外观与运动。 */
  attack?: string;
  tracking?:boolean;
  shape?: BulletShape;
  color?: BulletColor | readonly [number, number, number];
  /** 视觉尺寸（半径，单位），默认按形状。 */
  size?: number;
  /** 切向加速度（单位/秒²），可负。 */
  accel?: number;
  /** 速度下限 / 上限。 */
  minSpeed?: number;
  maxSpeed?: number;
  /** 角速度（弧度/秒），弯曲弹道。 */
  angVel?: number;
  /** 发射前悬停秒数（悬停时仍显示，不移动）。 */
  delay?: number;
  /** 寿命（秒），到时消失。默认无限；设了 angVel 时默认 14。 */
  life?: number;
  /** 自定义每帧更新；返回 false 则销毁。dt 已含时间缩放。 */
  update?: (b: Bullet, dt: number) => boolean | void;
  /** 不能被擦弹 / 抹除（极少用）。 */
  hard?: boolean;
}

export class Bullet {
  x = 0; y = 0;
  prevX=0;prevY=0;
  speed = 0;
  angle = 0;
  accel = 0;
  minSpeed = 0;
  maxSpeed = 1e9;
  angVel = 0;
  delay = 0;
  life = Infinity;
  age = 0;
  size = 7;
  radius = 5;
  shape = 0;
  r = 1; g = 1; b = 1;
  grazed = false;
  dead = false;
  hard = false;
  tracking=false;
  homing = false;
  seed = 0;
  update: BulletStyle['update'] = undefined;
  /** 脚本可用的临时数据。 */
  data: Record<string, number> = {};

  get vx(): number { return Math.cos(this.angle) * this.speed; }
  get vy(): number { return Math.sin(this.angle) * this.speed; }
}

export class BulletPool {
  list: Bullet[] = [];
  suppress=false;
  aimTarget:((x:number,y:number)=>{x:number;y:number})|null=null;
  private free: Bullet[] = [];

  spawn(x: number, y: number, angle: number, speed: number, st: BulletStyle = {}): Bullet {
    const b = this.free.pop() ?? new Bullet();
    const shape = st.shape ?? 'orb';
    b.x = b.prevX = x; b.y = b.prevY = y; b.angle = angle; b.speed = speed;
    b.accel = st.accel ?? 0; b.minSpeed = st.minSpeed ?? 0; b.maxSpeed = st.maxSpeed ?? 1e9;
    b.angVel = st.angVel ?? 0; b.delay = st.delay ?? 0; b.life = st.life ?? (st.angVel ? 14 : Infinity); // 旋转弹可能永远绕圈不出界，默认 14 秒寿命
    b.age = 0; b.size = st.size ?? DEFAULT_SIZE[shape]; b.radius = b.size * HIT_FACTOR[shape];
    b.shape = BULLET_SHAPES.indexOf(shape);
    const c = typeof st.color === 'string' ? BULLET_COLORS[st.color] : st.color ?? BULLET_COLORS.magenta;
    b.r = c[0]; b.g = c[1]; b.b = c[2];
    b.grazed = false; b.dead = false; b.hard = !!st.hard;
    b.seed = Math.random();
    b.update = st.update;b.tracking=!!st.tracking;
    b.homing = !!st.homing;
    b.data = {};
    if(this.suppress)b.dead=true;else this.list.push(b);
    return b;
  }

  tick(dt: number, speedScale: (b:Bullet)=>number = ()=>1): void {
    const L = this.list;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const b = L[i];
      if (!b.dead) {
        b.prevX=b.x;b.prevY=b.y;
        b.age += dt;
        if (b.age > b.delay) {
          if(b.tracking&&this.aimTarget){const target=this.aimTarget(b.x,b.y);b.angle=Math.atan2(target.y-b.y,target.x-b.x);}
          if (b.accel) b.speed = Math.min(b.maxSpeed, Math.max(b.minSpeed, b.speed + b.accel * dt));
          if (b.angVel) b.angle += b.angVel * dt;
          const scale=speedScale(b);
          b.x += Math.cos(b.angle) * b.speed * dt * scale;
          b.y += Math.sin(b.angle) * b.speed * dt * scale;
        }
        if (b.update && b.update(b, dt) === false) b.dead = true;
        if (b.age > b.life) b.dead = true;
        const m = 60 + b.size;
        if (b.x < -m || b.x > PLAY_W + m || b.y < -m - 200 || b.y > PLAY_H + m) {
          if (b.age > b.delay + 0.5) b.dead = true;
        }
      }
      if (b.dead) this.free.push(b);
      else L[w++] = b;
    }
    L.length = w;
  }

  clear(): void {
    for (const b of this.list) this.free.push(b);
    this.list.length = 0;
  }
}
