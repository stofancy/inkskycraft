// B1 私有辅助：明暗一体的面板填充、斜角高光、羽毛、铆钉、发光线等。
import { PAL, pathFrom, brushStroke, inkOutline, rng, dryBrush } from './style';
import type { Pt } from './style';

export type BBox = [number, number, number, number];
export type Ctx = CanvasRenderingContext2D;

export function bboxOf(pts: Pt[]): BBox {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1 - x0, y1 - y0];
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  return p;
}

export function rectPath(x: number, y: number, w: number, h: number, r = 0): Path2D {
  const p = new Path2D();
  if (r > 0) p.roundRect(x, y, w, h, r); else p.rect(x, y, w, h);
  return p;
}

/** 左上来光的明暗填充：亮 → 中 → 暗（沿左上到右下对角），带晕斑与枯笔磨损。 */
export function litFill(
  ctx: Ctx, path: Path2D, bb: BBox, light: string, base: string, dark: string,
  o: { seed?: number; wear?: string; wearN?: number; blots?: number; blotColor?: string; mid?: number } = {},
): void {
  const [x, y, w, h] = bb;
  const { seed = 3, wear, wearN = 26, blots = 4, blotColor = 'rgba(0,0,0,0.13)', mid = 0.5 } = o;
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, light);
  g.addColorStop(mid, base);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.clip(path);
  const r = rng(seed * 31 + 7);
  for (let i = 0; i < blots; i++) {
    const cx = x + r() * w, cy = y + r() * h, rad = (0.15 + r() * 0.3) * Math.max(4, Math.min(w, h));
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, blotColor);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  ctx.restore();
  if (wear) dryBrush(ctx, path, bb, wear, { count: wearN, len: Math.max(5, Math.min(w, h) * 0.35), width: 0.9, alpha: 0.4, seed: seed + 9, angle: Math.PI * 0.35 });
}

/** 斜角：左上内缘亮线、右下内缘暗线（通过偏移描边 + clip 实现）。 */
export function bevel(ctx: Ctx, path: Path2D, hi: string, lo: string, d = 1.3, wd = 1.6): void {
  ctx.save();
  ctx.clip(path);
  ctx.lineJoin = 'round';
  ctx.lineWidth = wd;
  ctx.save(); ctx.translate(d, d); ctx.strokeStyle = hi; ctx.stroke(path); ctx.restore();
  ctx.save(); ctx.translate(-d, -d); ctx.strokeStyle = lo; ctx.stroke(path); ctx.restore();
  ctx.restore();
}

export interface PlateOpts {
  light?: string; base?: string; dark?: string;
  hi?: string; lo?: string; edge?: string; edgeW?: number;
  smooth?: boolean; seed?: number; wear?: string; wearN?: number; bevelD?: number; blots?: number; mid?: number;
}

/** 一体化面板：填充 + 斜角 + 墨线描边。返回路径供后续 clip。 */
export function plate(ctx: Ctx, pts: Pt[], o: PlateOpts = {}): Path2D {
  const p = pathFrom(pts, true, !!o.smooth);
  const bb = bboxOf(pts);
  const base = o.base ?? PAL.bronze;
  litFill(ctx, p, bb, o.light ?? base, base, o.dark ?? PAL.ink2, { seed: o.seed, wear: o.wear, wearN: o.wearN, blots: o.blots, mid: o.mid });
  bevel(ctx, p, o.hi ?? 'rgba(255,240,205,0.35)', o.lo ?? 'rgba(0,0,0,0.38)', o.bevelD ?? 1.1, (o.edgeW ?? 2) * 0.8);
  if (o.edge !== 'none') inkOutline(ctx, p, o.edgeW ?? 1.8, o.edge ?? PAL.ink, (o.seed ?? 3) + 1);
  return p;
}

export function plateP(ctx: Ctx, p: Path2D, bb: BBox, o: PlateOpts = {}): Path2D {
  const base = o.base ?? PAL.bronze;
  litFill(ctx, p, bb, o.light ?? base, base, o.dark ?? PAL.ink2, { seed: o.seed, wear: o.wear, wearN: o.wearN, blots: o.blots, mid: o.mid });
  bevel(ctx, p, o.hi ?? 'rgba(255,240,205,0.35)', o.lo ?? 'rgba(0,0,0,0.38)', o.bevelD ?? 1.1, (o.edgeW ?? 2) * 0.8);
  if (o.edge !== 'none') inkOutline(ctx, p, o.edgeW ?? 1.8, o.edge ?? PAL.ink, (o.seed ?? 3) + 1);
  return p;
}

export function line(ctx: Ctx, pts: Pt[], color: string, w = 1, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

/** 凹槽缝：暗线 + 右下偏移亮线，模拟压出来的面板缝。 */
export function groove(ctx: Ctx, pts: Pt[], w = 0.9): void {
  line(ctx, pts, 'rgba(10,6,4,0.75)', w);
  ctx.save(); ctx.translate(0.7, 0.7);
  line(ctx, pts, 'rgba(255,235,200,0.18)', w * 0.7);
  ctx.restore();
}

export function dots(ctx: Ctx, pts: Pt[], r: number, color: string, hiColor = 'rgba(255,240,210,0.6)'): void {
  ctx.save();
  for (const [x, y] of pts) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.3, r, 0, 7); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = hiColor;
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, 7); ctx.fill();
  }
  ctx.restore();
}

export function dotsAlong(a: Pt, b: Pt, n: number): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  return o;
}

/** 羽毛：从 (x0,y0) 到 (x1,y1)，宽 w，底色 + 边缘 + 中轴线。 */
export function feather(
  ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, base: string, edge: string, vein: string | null, seed = 1, bow = 0,
): void {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const pts: Pt[] = [[x0, y0], [mx + nx * bow, my + ny * bow], [x1, y1]];
  brushStroke(ctx, pts, w * 1.35, 0.6, edge, { jitter: 0.08, seed, belly: 0.35 });
  brushStroke(ctx, pts, w, 0.4, base, { jitter: 0.05, seed: seed + 1, belly: 0.35 });
  if (vein) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    line(ctx, [[x0 + dx * 0.08, y0 + dy * 0.08], [mx + nx * bow, my + ny * bow], [x0 + dx * 0.92, y0 + dy * 0.92]], vein, Math.max(0.5, w * 0.12));
    ctx.restore();
  }
}

/** 发光折线（glow 层）：宽淡外晕 + 亮芯。 */
export function neonLine(ctx: Ctx, pts: Pt[], color: string, w = 1.6): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  line(ctx, pts, color, w * 2.6, 0.28);
  line(ctx, pts, color, w, 0.95);
  line(ctx, pts, PAL.glowWhite, w * 0.35, 0.8);
  ctx.restore();
}

/** 深处的霓虹缝（draw 层）：暗色凹槽内有一条彩线，让 draw 层也带出颜色。 */
export function neonSeamDraw(ctx: Ctx, pts: Pt[], color: string, w = 1.2): void {
  line(ctx, pts, 'rgba(0,0,0,0.7)', w * 2.2);
  line(ctx, pts, color, w, 0.85);
}

export function neonPath(ctx: Ctx, p: Path2D, color: string, w = 1.6): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color; ctx.globalAlpha = 0.3; ctx.lineWidth = w * 2.6; ctx.stroke(p);
  ctx.globalAlpha = 0.95; ctx.lineWidth = w; ctx.stroke(p);
  ctx.strokeStyle = PAL.glowWhite; ctx.globalAlpha = 0.7; ctx.lineWidth = w * 0.35; ctx.stroke(p);
  ctx.restore();
}

export function glowFill(ctx: Ctx, p: Path2D, color: string, alpha = 1): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill(p);
  ctx.restore();
}

/** 圆形宝石/核心（draw 层）：暗边框 + 径向渐变 + 高光点。 */
export function orb(ctx: Ctx, x: number, y: number, r: number, c0: string, c1: string, rim: string = PAL.ink): void {
  ctx.save();
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(x, y, r + 1.2, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.18, -0.6, 0, 7); ctx.fill();
  ctx.restore();
}

/** 柔和投影（用于部件叠压处）。 */
export function softShadow(ctx: Ctx, p: Path2D, dx = 1.5, dy = 2, alpha = 0.35): void {
  ctx.save();
  ctx.translate(dx, dy);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.fill(p);
  ctx.restore();
}

export function mirrorPts(pts: Pt[]): Pt[] { return pts.map(([x, y]) => [-x, y] as Pt); }

/** 绕 (cx,cy) 旋转绘制。 */
export function rotated(ctx: Ctx, cx: number, cy: number, ang: number, fn: () => void): void {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.translate(-cx, -cy); fn(); ctx.restore();
}

export { PAL, pathFrom, brushStroke, inkOutline, rng, dryBrush };
export type { Pt };
