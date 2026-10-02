// 朱雀火焰丝带：两翼各 12 片火羽、头与冠、三条长火尾。全部由 RS.Fire 光带按解析曲线生成。
import { RS, type RibbonBatch } from '../gl/ribbons';
import { smoothstep } from '../core/math';

export interface BirdPose {
  /** 心口位置与横纵缩放（翼展 630 单位时 sx=sy=1）。 */
  cx: number; cy: number; sx: number; sy: number;
  /** 成形进度 0..1。 */
  build: number;
  /** 振翅角（弧度，正为向下）。 */
  flap: number;
  time: number;
  alpha: number;
  /** 火尾长度倍率（释放冲出时拉长）。 */
  tail?: number;
}
export const WING_SPAN = 630;
const FEATHERS = 12;
const N = 14;

/** 局部坐标（心口为原点，y 向下）换算成屏幕坐标。 */
export function birdPoint(p: BirdPose, lx: number, ly: number): [number, number] {
  return [p.cx + lx * p.sx, p.cy + ly * p.sy];
}

/** 结印时五个字落点：朱 雀 离 火 敕（局部坐标）。 */
export const BIRD_TARGETS: [number, number][] = [[-170, -95], [0, -128], [170, -95], [0, 175], [0, 0]];

function featherLocal(k: number, i: number, s: number, flap: number, time: number): [number, number] {
  const t = i / (FEATHERS - 1);
  const a = (-30 + 105 * Math.pow(t, 0.9)) * Math.PI / 180 + flap * (1 - 0.45 * t);
  const L = 140 + 200 * Math.pow(1 - t, 0.8);
  let x = k * 36 + k * Math.cos(a) * L * s;
  let y = -28 + Math.sin(a) * L * s;
  y += 60 * s * s * (0.4 + 0.6 * (1 - t));
  const c = smoothstep(0.72, 1, s);
  x -= k * 26 * c * c; y += 46 * c * c;
  y += Math.sin(s * 6 + time * 10 + i * 0.9) * 6 * s;
  return [x, y];
}

/** 翼尖局部坐标，供火星发射使用。 */
export function wingTip(k: number, flap: number, time: number): [number, number] {
  return featherLocal(k, 0, 1, flap, time);
}

/** 先垫一层暗红墨烟（正常混合压暗背景），再叠三层火焰（暗红边、橙、白黄芯）。 */
function ribbon(b: RibbonBatch, p: BirdPose, local: number[], widths: number[], a: number, under = true): void {
  const pts: number[] = [];
  for (let j = 0; j < local.length; j += 2) { const [x, y] = birdPoint(p, local[j], local[j + 1]); pts.push(x, y); }
  const ws = widths.map(w => w * (p.sx + p.sy) * 0.5);
  if (under) b.strip(pts, ws.map(w => w * 1.45), RS.InkArrow, 0.07, 0.01, 0.006, a * 0.7);
  b.strip(pts, ws, RS.AuraFire, 1, 1, 1, a);
}

/** 第 t 条尾（0..2）上 s（0..1）处的屏幕坐标，off 为丝股偏移。 */
export function tailPoint(p: BirdPose, t: number, s: number, off = 0): [number, number] {
  const deg = [-15, 0, 15][t], len = [280, 350, 280][t] * (p.tail ?? 1), ph = [0, 1.7, 3.1][t];
  const r = deg * Math.PI / 180;
  const sway = Math.sin(s * 7 * Math.sqrt(p.tail ?? 1) - p.time * 8 + ph) * 22 * s + Math.sin(s * 19 - p.time * 14 + off * 2.1 + ph) * 6 * s;
  const spread = off * 12 * s;
  return birdPoint(p, 40 * Math.sin(r) + Math.sin(r) * len * s + sway + spread, 40 + Math.cos(r) * len * s);
}

export function drawBird(b: RibbonBatch, p: BirdPose): void {
  if (p.build <= 0 || p.alpha <= 0.01) return;
  const a = p.alpha;
  // 羽
  for (const k of [-1, 1]) {
    for (let i = 0; i < FEATHERS; i++) {
      const t = i / (FEATHERS - 1);
      const smax = Math.max(0, Math.min(1, p.build * 1.6 - t * 0.5));
      if (smax < 0.05) continue;
      const local: number[] = [], widths: number[] = [];
      const wmax = 17 + 9 * (1 - t);
      for (let j = 0; j <= N; j++) {
        const s = j / N * smax;
        const [x, y] = featherLocal(k, i, s, p.flap, p.time);
        local.push(x, y);
        widths.push(wmax * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.65)), 0.9) * Math.min(1, (smax - s) * 8 + (j === N ? 0 : 0.02)));
      }
      widths[N] = 0;
      ribbon(b, p, local, widths, a);
    }
  }
  const grow = Math.min(1, p.build * 1.4);
  // 身
  ribbon(b, p, [0, 70, 0, 10, 0, -50, 0, -100], [8, 28, 26, 14], a * grow);
  // 头与喙
  ribbon(b, p, [0, -95, 0, -130, 0, -158], [10, 30, 14], a * grow);
  ribbon(b, p, [0, -150, 0, -175, 0, -205], [11, 8, 0], a * grow, false);
  // 冠
  for (const [ang, len] of [[-38, 105], [0, 125], [38, 105]] as const) {
    const r = ang * Math.PI / 180, local: number[] = [], widths: number[] = [];
    for (let j = 0; j <= 8; j++) {
      const s = j / 8;
      local.push(Math.sin(r) * len * s + Math.sin(r) * 18 * s * s, -140 - Math.cos(r) * len * s * 0.9 - 14 * Math.sin(s * 5 + p.time * 9));
      widths.push(j === 8 ? 0 : 13 * Math.sin(Math.PI * Math.pow(s, 0.7)) + 1);
    }
    ribbon(b, p, local, widths, a * grow);
  }
  // 三条长火尾：每条由三股火焰丝拧成，边缘破碎，末段转暗成烟（释放时拖长）
  const tk = p.tail ?? 1;
  for (let t = 0; t < 3; t++) {
    for (const off of [-1, 0, 1]) {
      const flame: number[] = [], smoke: number[] = [], wf: number[] = [], ws: number[] = [];
      for (let j = 0; j <= 18; j++) {
        const s = j / 18 * grow;
        const [x, y] = tailPoint(p, t, s, off);
        const w = (off === 0 ? 15 : 9) * Math.pow(Math.sin(Math.PI * Math.pow(j / 18, 0.6)), 0.9) * (j === 18 ? 0 : 1);
        if (j <= 13) { flame.push(x, y); wf.push(w); }
        if (j >= 12) { smoke.push(x, y); ws.push(w * 1.4); }
      }
      const toLocal = (arr: number[]) => arr;
      b.strip(toLocal(smoke), ws, RS.InkArrow, 0.05, 0.03, 0.03, 0.4 * a);
      b.strip(toLocal(flame), wf.map(w => w * 1.4), RS.InkArrow, 0.07, 0.01, 0.006, 0.55 * a);
      b.strip(toLocal(flame), wf, RS.AuraFire, 1, 1, 1, a);
    }
  }
  // 翅根与心口最亮：加色白黄芯压在火焰上
  for (const k of [-1, 1]) {
    const lo = [k * 30, -30, k * 80, -20, k * 135, -2];
    const pts: number[] = [];
    for (let j = 0; j < lo.length; j += 2) { const [x, y] = birdPoint(p, lo[j], lo[j + 1]); pts.push(x, y); }
    b.strip(pts, [28 * p.sx, 22 * p.sx, 0], RS.Fire, 2.2, 1.1, 0.2, 0.75 * a * grow);
  }
  { const pts: number[] = []; for (const [x, y] of [[0, -35], [0, 10], [0, 55]]) { const [X, Y] = birdPoint(p, x, y); pts.push(X, Y); }
    b.strip(pts, [26 * p.sx, 38 * p.sx, 0], RS.Fire, 2.8, 1.8, 0.5, 0.9 * a * grow); }
}
