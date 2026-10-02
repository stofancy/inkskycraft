// 敌人实体：移动、朝向、部件挂接、受伤、死亡掉落。行为由 EnemyDef.ai 协程驱动。
import { Ease, type EaseName, angleTo, lerp } from '../core/math';
import { Clock, Scope, type Co } from '../core/tasks';
import type { SpriteInfo } from '../gl/atlas';
import type { MusicId, DamageSource } from '../types';
import type { G } from './api';
import { oscillate, type BoneAnimation } from '../core/animation';
import type { SpriteDeform } from '../gl/sprites';

export type ItemKind = 'p' | 'weapon' | 'bomb' | 'missile' | 'medal' | 'ink' | '1up';
export type ExplosionSize = 's' | 'm' | 'l' | 'xl';

export interface EnemyDef {
  /** 名字（Boss 血条显示用）。 */
  name?: string;
  /** 精灵 id（见 DESIGN.md 4.B）。 */
  sprite: string;
  hp: number;
  /** 击破得分，默认 hp × 10。 */
  score?: number;
  /** 碰撞半径，默认取精灵建议半径。 */
  radius?: number;
  /** 额外碰撞圆 [dx, dy, r]（精灵本地坐标，随旋转/镜像变换）。 */
  hits?: [number, number, number][];
  /** 地面单位：随地面滚动、画在空中单位之下、无投影、不与玩家机体碰撞。 */
  ground?: boolean;
  /** 伤害倍率（<1 为装甲，命中音效变为金属声），默认 1。 */
  armor?: number;
  /** 死亡爆炸规模，默认按 hp 推算。 */
  explosion?: ExplosionSize;
  /** 死亡掉落。 */
  drops?: ItemKind | ItemKind[];
  /** 动画帧率（帧/秒），精灵有多帧时循环播放。 */
  anim?: number;
  /** attach 部件周期骨骼动画，叠加在 offX/offY/offRot 上。 */
  bone?: BoneAnimation;
  /** 仅改变视觉；碰撞沿用静态 alpha 遮罩。 */
  deform?: SpriteDeform;
  /** 自动朝向：'move' 朝移动方向，'player' 朝玩家。默认不自动旋转。 */
  face?: 'move' | 'player';
  /** 不可被伤害。 */
  invulnerable?: boolean;
  /** 不与玩家机体碰撞。 */
  noCollide?: boolean;
  /** Boss 信息：有此项时由 g.boss() 管理阶段血条。 */
  boss?: { name: string; phases: number; music?: MusicId };
  /** 渲染层（默认 ground → 'ground'，其余 'air'）。 */
  layer?: 'ground' | 'air';
  /** 行为协程。 */
  ai?: (e: Enemy, g: G) => Co;
  /** 死亡回调（被击破时，不含 silent 移除）。 */
  onDeath?: (e: Enemy, g: G) => void;
}

let nextId = 1;

export class Enemy {
  readonly id = nextId++;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** 渲染旋转（弧度，顺时针）。0 = 精灵原始朝向。 */
  angle = 0;
  scaleX = 1;
  scaleY = 1;
  alpha = 1;
  /** 本体颜色倍率（如残骸压暗）。 */
  tint: [number, number, number] = [1, 1, 1];
  /** 发光倍率。 */
  glow = 1;
  /** 动画帧（anim 为 0 时可手动设置）。 */
  frame = 0;
  hp: number;
  maxHp: number;
  age = 0;
  dead = false;
  /** 动态无敌（如护盾阶段）。 */
  invulnerable: boolean;
  /** 被封印剩余秒数（定身、变红）。 */
  sealed = 0;
  /** 墨鸢减速倍率，到期由伙伴系统恢复。 */
  companionSpeed = 1;
  flash = 0;
  radius: number;
  readonly info: SpriteInfo;
  readonly scope: Scope;
  /** 脚本用的临时数据。 */
  data: Record<string, any> = {};
  children: Enemy[] = [];
  parent: Enemy | null = null;
  /** 作为部件时相对父体的本地偏移（父体精灵坐标）。 */
  offX = 0;
  offY = 0;
  /** 作为部件时的附加旋转。 */
  offRot = 0;
  /** 作为部件时是否镜像。 */
  mirror = false;
  /** 是否随父体一起旋转。 */
  followRot = true;
  /** 命名挂接时需要对齐的部件根，坐标相对精灵原点。 */
  jointRoot: [number, number] = [0, 0];
  /** Boss：阶段中血量降到 0 不会死亡，由阶段逻辑处理。 */
  phaseLock = false;
  /** 最近一次受伤的累计量（用于 UI/特效节流）。 */
  hitAccum = 0;
  lastDamageSource: DamageSource = 'neutral';

  constructor(readonly def: EnemyDef, info: SpriteInfo, parentScope: Scope) {
    this.info = info;
    this.hp = this.maxHp = def.hp;
    this.radius = def.radius ?? info.radius;
    this.invulnerable = !!def.invulnerable;
    this.scope = new Scope(parentScope);
  }

  get alive(): boolean {
    return !this.dead;
  }
  get ground(): boolean {
    return !!this.def.ground;
  }
  get hpFrac(): number {
    return this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
  }

  /** 在本敌人的作用域内启动协程（敌人死亡时自动取消）。 */
  run(co: Co): Co {
    return this.scope.run(co);
  }

  /** 设置速度（方向角 + 速率）。 */
  vel(angle: number, speed: number): this {
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    return this;
  }

  stop(): this {
    this.vx = this.vy = 0;
    return this;
  }

  /** 平滑移动到 (x,y)，耗时 sec 秒。移动期间忽略速度。 */
  *moveTo(x: number, y: number, sec: number, ease: EaseName = 'outCubic'): Co {
    const sx = this.x, sy = this.y, f = Ease[ease];
    this.vx = this.vy = 0;
    let t = 0;
    while (t < sec && !this.dead) {
      yield;
      t += Clock.dt * this.companionSpeed;
      const k = f(Math.min(1, t / sec));
      this.x = lerp(sx, x, k);
      this.y = lerp(sy, y, k);
    }
  }

  *moveBy(dx: number, dy: number, sec: number, ease: EaseName = 'inOutQuad'): Co {
    yield* this.moveTo(this.x + dx, this.y + dy, sec, ease);
  }

  /** 平滑旋转到 angle（弧度）。 */
  *rotateTo(angle: number, sec: number, ease: EaseName = 'inOutQuad'): Co {
    const s = this.angle, f = Ease[ease];
    let t = 0;
    while (t < sec && !this.dead) {
      yield;
      t += Clock.dt;
      this.angle = lerp(s, angle, f(Math.min(1, t / sec)));
    }
  }

  /** 精灵本地坐标 (lx, ly) → 世界坐标（考虑旋转、缩放、镜像）。 */
  local(lx: number, ly: number): { x: number; y: number } {
    const sx = this.scaleX * (this.mirror ? -1 : 1);
    const px = lx * sx, py = ly * this.scaleY;
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return { x: this.x + px * c - py * s, y: this.y + px * s + py * c };
  }

  /** 挂点世界坐标。挂点不存在时返回中心并在控制台警告一次。 */
  anchor(name: string): { x: number; y: number } {
    const a = this.info.anchors[name];
    if (!a) {
      if (!this.data['__warn_' + name]) {
        this.data['__warn_' + name] = 1;
        console.warn(`精灵 ${this.info.id} 缺少挂点 ${name}`);
      }
      return { x: this.x, y: this.y };
    }
    return this.local(a[0], a[1]);
  }

  /** 从中心指向玩家的角度（需由世界注入玩家位置）。 */
  aim(): number {
    return angleTo(this.x, this.y, Enemy.px, Enemy.py);
  }

  /** 由世界每帧更新的玩家位置。 */
  static px = 450;
  static py = 1000;

  /** 部件相对父体的挂接位置更新。 */
  syncToParent(): void {
    const p = this.parent;
    if (!p) return;
    const bone = this.def.bone;
    const w = p.local(this.offX + oscillate(bone?.x, this.age), this.offY + oscillate(bone?.y, this.age));
    const rot = this.offRot + oscillate(bone?.rot, this.age);
    if (this.followRot) this.angle = p.angle + rot * (p.mirror ? -1 : 1);
    this.x = w.x;
    this.y = w.y;
    // 先旋转部件，再把变换后的 root 移回关节。翼根在扇动与缩放时保持贴合。
    const root = this.local(...this.jointRoot);
    this.x += w.x - root.x;
    this.y += w.y - root.y;
  }
}
