// 朱色燃烧：纯粒子。火苗（白黄芯 → 橙 → 红，边升边缩小变淡，左右卷动）从敌机轮廓上的随机点冒出，
// 黑烟升得比火苗慢、在上方，火星零星迸出；被烧的敌机叠一层跳动的暖色光。烧得越久火越旺。
import { PK } from '../gl/particles';
import { RS, type RibbonBatch } from '../gl/ribbons';
import type { Enemy } from './enemy';
import type { World } from './world';

/** 火势 0.3..1，按已燃烧秒数增长。 */
export const burnStrength = (age: number): number => Math.min(1, 0.3 + age / 2.5);

/** 绘制：敌机身上一层跳动的暖色光（每帧在 ribbonMid 上重建，无贴图）。 */
export function burnDraw(b: RibbonBatch, e: Enemy, age: number, time: number): void {
  const s = burnStrength(age), r = e.radius;
  const pulse = 0.6 + 0.4 * Math.sin(time * 17 + e.x * 0.05) * Math.sin(time * 9.3 + 1.7);
  b.line(e.x - r * 0.9, e.y, e.x + r * 0.9, e.y, r * (1.5 + 0.4 * s), RS.Glow, 2.2, 0.55, 0.08, (0.16 + 0.2 * s) * pulse);
}

/** 同一帧内所有着火敌机的粒子总数上限，防止同屏过量。 */
const FRAME_CAP = 36;
let frameFirst: Enemy | null = null, frameCount = 0;

/** 发射：火苗、黑烟、火星。粒子数按敌机大小算，总量有上限。 */
export function burnEmit(w: { fx: World['fx'] }, e: Enemy, age: number, dt: number): void {
  // 同一敌机再次出现即进入下一帧
  if (frameFirst === null || frameFirst === e || frameFirst.dead) { frameFirst = e; frameCount = 0; }
  const s = burnStrength(age), fx = w.fx, rng = Math.random, r = e.radius, k = Math.max(0.7, Math.min(2, r / 28));
  const n = (rate: number) => {
    const v = rate * k * dt;
    let c = Math.floor(v) + (rng() < v % 1 ? 1 : 0);
    c = Math.min(c, FRAME_CAP - frameCount);
    frameCount += c;
    return Math.max(0, c);
  };
  // 轮廓上的随机点
  const edge = (): [number, number] => { const a = rng() * Math.PI * 2, d = r * (0.55 + 0.45 * rng()); return [e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.85]; };
  // 火舌：从图集随机挑格，往上窜、左右卷，边升边缩小变淡
  for (let i = n(26 + 34 * s); i > 0; i--) {
    const [x, y] = edge(), side = (rng() - 0.5) * 90;
    fx.emit({ x, y: y - 6 * k, vx: side, vy: -(80 + 110 * s * rng()), drag: 0.8, life: 0.45 + 0.4 * rng(), size: (17 + 11 * s) * k * (0.75 + 0.5 * rng()), sizeEnd: 7 * k, r: 1.6, g: 1.5, b: 1.4, r1: 1.0, g1: 0.55, b1: 0.4, a: 0.95, kind: PK.FlameTex });
  }
  // 烟：图集第 4 行，缓慢上升
  for (let i = n(7 + 9 * s); i > 0; i--) {
    const [x, y] = edge();
    fx.emit({ x, y: y - r * 0.6, vx: (rng() - 0.5) * 24, vy: -(24 + 22 * rng()), drag: 0.4, life: 1.1 + 0.6 * rng(), size: (13 + 6 * rng()) * k, sizeEnd: (30 + 14 * s) * k, r: 0.9, g: 0.85, b: 0.85, a: 0.7, kind: PK.SmokeTex });
  }
  // 火星：零星往外迸
  for (let i = n(9 + 14 * s); i > 0; i--) {
    const [x, y] = edge(), a = rng() * Math.PI * 2, sp = 90 + 140 * rng();
    fx.emit({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70, drag: 1.4, life: 0.4 + 0.4 * rng(), size: 5 + 3 * rng(), sizeEnd: 2, r: 2.2, g: 1.9, b: 1.6, r1: 1.4, g1: 0.5, b1: 0.3, kind: PK.EmberTex });
  }
}
