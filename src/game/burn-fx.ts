// 朱色燃烧：纯粒子。火苗（白黄芯 → 橙 → 红，边升边缩小变淡，左右卷动）从敌机轮廓上的随机点冒出，
// 黑烟升得比火苗慢、在上方，火星零星迸出；被烧的敌机叠一层跳动的暖色光。烧得越久火越旺。
import { PK } from '../gl/particles';
import { Clock } from '../core/tasks';
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
let burnFrame = -1, frameCount = 0;

/** 发射：火苗、黑烟、火星。粒子数按敌机大小算，总量有上限。 */
export function burnEmit(w: { fx: World['fx'] }, e: Enemy, age: number, dt: number, spot?: { x:number; y:number }): void {
  // 同一纸龙部件可有多个烧点，按世界帧号共用预算。
  if (burnFrame !== Clock.frame) { burnFrame = Clock.frame; frameCount = 0; }
  const s = burnStrength(age), fx = w.fx, rng = Math.random, r = e.radius, k = Math.max(0.7, Math.min(2, r / 28));
  // 纸龙特殊处理：火焰缩小到 0.4 倍，朱红暗金色，粒子减半
  const isPaper = e.def.sprite.startsWith('pd-');
  const sizeScale = isPaper ? 0.4 : 0.5; // 纸龙 0.4 倍，其他 0.5 倍
  const rMul = isPaper ? 1.4 : 1.6, gMul = isPaper ? 0.35 : 1.5, bMul = isPaper ? 0.12 : 1.4;
  const r1Mul = isPaper ? 0.65 : 1.0, g1Mul = isPaper ? 0.38 : 0.55, b1Mul = isPaper ? 0.08 : 0.4;
  const rate = isPaper ? 0.5 : 0.6; // 纸龙减半，其他 0.6 倍
  const n = (baseRate: number) => {
    const v = baseRate * rate * k * dt;
    let c = Math.floor(v) + (rng() < v % 1 ? 1 : 0);
    c = Math.min(c, FRAME_CAP - frameCount);
    frameCount += c;
    return Math.max(0, c);
  };
  // 轮廓上的随机点
  const edge = (): [number, number] => { const a = rng() * Math.PI * 2, d = spot ? 7 * rng() : r * (0.55 + 0.45 * rng()); return [(spot?.x ?? e.x) + Math.cos(a) * d, (spot?.y ?? e.y) + Math.sin(a) * d * 0.85]; };
  // 火舌：从图集随机挑格，往上窜、左右卷，边升边缩小变淡
  for (let i = n(26 + 34 * s); i > 0; i--) {
    const [x, y] = edge(), side = (rng() - 0.5) * 90;
    fx.emit({ x, y: y - 6 * k * sizeScale, vx: side, vy: -(80 + 110 * s * rng()), drag: 0.8, life: 0.45 + 0.4 * rng(), size: (17 + 11 * s) * k * sizeScale * (0.75 + 0.5 * rng()), sizeEnd: 7 * k * sizeScale, r: rMul, g: gMul, b: bMul, r1: r1Mul, g1: g1Mul, b1: b1Mul, a: 0.95, kind: PK.FlameTex });
  }
  // 烟：图集第 4 行，缓慢上升
  for (let i = n(7 + 9 * s); i > 0; i--) {
    const [x, y] = edge();
    fx.emit({ x, y: y - (spot ? 6 : r * 0.6), vx: (rng() - 0.5) * 24, vy: -(24 + 22 * rng()), drag: 0.4, life: 1.1 + 0.6 * rng(), size: (13 + 6 * rng()) * k * sizeScale, sizeEnd: (30 + 14 * s) * k * sizeScale, r: 0.9, g: 0.85, b: 0.85, a: 0.7, kind: PK.SmokeTex });
  }
  // 火星：零星往外迸
  for (let i = n(9 + 14 * s); i > 0; i--) {
    const [x, y] = edge(), a = rng() * Math.PI * 2, sp = 90 + 140 * rng();
    fx.emit({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70, drag: 1.4, life: 0.4 + 0.4 * rng(), size: (5 + 3 * rng()) * (isPaper ? sizeScale : 1), sizeEnd: isPaper ? 2 * sizeScale : 2, r: isPaper ? 1.2 : 2.2, g: isPaper ? .6 : 1.9, b: isPaper ? .15 : 1.6, r1: isPaper ? .65 : 1.4, g1: isPaper ? .28 : .5, b1: isPaper ? .05 : .3, kind: PK.EmberTex });
  }
}
