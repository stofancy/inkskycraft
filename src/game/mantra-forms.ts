// 青「坎水·青龙」的水龙与紫「震雷·紫微」的八卦圈、天雷。全部由光带按解析曲线生成。
import { RS, type RibbonBatch } from '../gl/ribbons';
import { mantraBolt } from '../gl/mantra-volumes';
import { smoothstep } from '../core/math';

export interface FormPose {
  cx: number; cy: number; R: number;
  /** 施法真实秒、释放进度 0..1、整体透明。 */
  T: number; tau: number; alpha: number;
  /** 八卦圈旋转角。 */
  rot?: number;
}

const BODY_N = 34;
/** 水龙身体第 s（0 头..1 尾）处的位置：绕飞机盘一圈，释放时头先拉起、身体依次放开，冲上屏幕。 */
export function dragonPoint(p: FormPose, s0: number): [number, number] {
  const { T, tau } = p;
  const grow = smoothstep(0.95, 1.28, T);
  const s = s0 * grow;
  const phi = -2.2 + 11 * (T - 0.95) - s * 7.2;
  const rr = p.R * (1 + 0.09 * Math.sin(s * 12 - T * 9));
  const cx = p.cx + Math.cos(phi) * rr, cy = p.cy + Math.sin(phi) * rr * 0.92;
  if (tau <= 0) return [cx, cy];
  const hx = p.cx + Math.sin(T * 9) * 30 * tau, hy = p.cy - (p.cy + 560) * tau * tau;
  const rx = hx + Math.sin(s0 * 9 - T * 13) * 55 * Math.min(1, s0 * 3) * (0.6 + tau), ry = hy + s0 * 820 * Math.max(0.3, grow);
  const w = Math.max(0, Math.min(1, tau * 2.4 - s0 * 0.9));
  const e = w * w * (3 - 2 * w);
  return [cx + (rx - cx) * e, cy + (ry - cy) * e];
}

export function drawDragon(b: RibbonBatch, p: FormPose): void {
  if (p.T < 0.95 || p.alpha <= 0.01) return;
  const pts: number[] = [], ws: number[] = [];
  const grow = smoothstep(0.95, 1.28, p.T);
  for (let i = 0; i <= BODY_N; i++) {
    const s = i / BODY_N, [x, y] = dragonPoint(p, s);
    pts.push(x, y);
    ws.push(i === BODY_N ? 0 : (6 + 20 * smoothstep(0, 0.08, s)) * (1 - 0.82 * Math.pow(s, 1.4)) * (0.35 + 0.65 * grow) * (i <= 1 ? 1.1 : 1));
  }
  b.strip(pts, ws.map(w => w * 1.38), RS.InkArrow, 0.004, 0.03, 0.045, 0.65 * p.alpha);
  b.strip(pts, ws, RS.WaterBody, 1, 1, 1, 0.97 * p.alpha);
  // 头：吻、角、须、眼
  const hx = pts[0], hy = pts[1];
  let dx = hx - pts[2], dy = hy - pts[3];
  const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
  const nx = -dy, ny = dx, k = 0.35 + 0.65 * grow;
  const P = (a: number, c: number): [number, number] => [hx + dx * a * k + nx * c * k, hy + dy * a * k + ny * c * k];
  const line = (arr: [number, number][], w: number[], style: RS, r: number, g: number, bl: number, a: number) => {
    const f: number[] = []; arr.forEach(([x, y]) => f.push(x, y)); b.strip(f, w.map(v => v * k), style, r, g, bl, a * p.alpha);
  };
  line([P(0, 0), P(24, 0), P(46, 0)], [24, 17, 0], RS.WaterBody, 1, 1, 1, 0.97);
  for (const sd of [-1, 1]) {
    line([P(6, 12 * sd), P(-14, 30 * sd), P(-42, 40 * sd)], [5, 4, 0], RS.WaterBody, 1, 1, 1, 0.95);
    line([P(30, 8 * sd), P(12, 44 * sd), P(-26, 66 * sd)], [2.5, 2, 0], RS.WaterBody, 1, 1, 1, 0.8);
    line([P(14, 11 * sd), P(20, 11 * sd)], [5, 5], RS.Glow, 2.2, 3, 3.2, 1);
  }
}

// ---- 八卦
/** 先天八卦：乾兑离震巽坎艮坤，三爻自内向外，1 阳（连）0 阴（断）。 */
const GUA: number[][] = [[1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1], [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0]];

/** 第 k 个卦位的圆心位置（可附加径向偏移）。 */
export function guaPos(p: FormPose, k: number, extra = 0): [number, number] {
  const a = (p.rot ?? 0) + k * Math.PI / 4 - Math.PI / 2, r = p.R + extra;
  return [p.cx + Math.cos(a) * r, p.cy + Math.sin(a) * r];
}

export function drawBagua(b: RibbonBatch, p: FormPose): void {
  if (p.T < 0.95 || p.alpha <= 0.01) return;
  const sc = Math.sqrt(p.R / 185);
  for (let k = 0; k < 8; k++) {
    const a = p.alpha * smoothstep(0.95 + 0.035 * k, 1.15 + 0.035 * k, p.T);
    if (a <= 0.01) continue;
    const th = (p.rot ?? 0) + k * Math.PI / 4 - Math.PI / 2;
    for (let j = 0; j < 3; j++) {
      const rr = p.R * (1 + (j - 1) * 0.17), hw = 0.3 * 185 / rr * 1.0;
      const arcs: [number, number][] = GUA[k][j] ? [[-hw, hw]] : [[-hw, -0.07], [0.07, hw]];
      for (const [a0, a1] of arcs) {
        const pts: number[] = [];
        for (let i = 0; i <= 6; i++) { const t = th + a0 + (a1 - a0) * i / 6; pts.push(p.cx + Math.cos(t) * rr, p.cy + Math.sin(t) * rr); }
        b.strip(pts, 13 * sc, RS.InkArrow, 0.03, 0.008, 0.06, 0.6 * a);
        b.strip(pts, 8 * sc, RS.SparkBolt, 1, 1, 1, a);
      }
    }
  }
}

const hash = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** 一道天雷：自屏顶劈到 (tx,ty)，折线按 30 帧/秒重新抖动。 */
export function drawThunder(b: RibbonBatch, tx: number, ty: number, seed: number, T: number, alpha: number): void {
  if (alpha <= 0.01) return;
  const frame = Math.floor(T * 30), n = 14, pts: number[] = [];
  const x0 = tx + (hash(seed * 7.3) - 0.5) * 80;
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = (hash(seed * 31 + i * 5.7 + frame * 13.1) - 0.5) * 2;
    const amp = 46 * Math.sin(Math.PI * Math.min(1, t * 1.05));
    pts.push(x0 + (tx - x0) * t + j * amp, -40 + (ty + 40) * t);
  }
  mantraBolt(b, pts, 30, alpha);
  b.strip(pts, pts.length / 2 > 0 ? 7 : 0, RS.Lightning, 1, 1, 1, alpha);
  // 一条分叉
  const bi = 5 + Math.floor(hash(seed + frame) * 5), sd = hash(seed * 3 + frame) < 0.5 ? -1 : 1;
  const br: number[] = [pts[bi * 2], pts[bi * 2 + 1]];
  for (let i = 1; i <= 5; i++) br.push(br[0] + sd * i * 28 + (hash(seed + i + frame * 3) - 0.5) * 24, br[1] + i * 40);
  mantraBolt(b, br, 12, alpha * 0.8);
}
