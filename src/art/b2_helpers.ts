// B2 私有辅助：形状(路径+包围盒)、带明暗层次的部件着色、鳞片/瓦片/铆钉/霓虹线。
import { PAL, Pt, pathFrom, inkOutline, dryBrush, brushStroke, rng, glowDot } from './style';

export type Ctx = CanvasRenderingContext2D;
export interface Shape { path: Path2D; bb: [number, number, number, number] }
export interface Tone { hi: string; base: string; lo: string }

export const TONE = {
  bronze: { hi: '#b08a54', base: PAL.bronze, lo: '#2f2216' },
  iron: { hi: '#66707c', base: PAL.iron, lo: '#15171b' },
  verd: { hi: '#86c2ae', base: PAL.verdigris, lo: '#1d3a33' },
  lacquer: { hi: '#79394b', base: PAL.lacquer, lo: '#170a0e' },
  night: { hi: '#5d4b86', base: '#2b2040', lo: '#0f0a1a' },
  paper: { hi: '#fff6dc', base: '#d8c9a4', lo: '#8f7f5c' },
  goldm: { hi: '#f6d58a', base: '#b8862f', lo: '#5a3d10' },
  plum: { hi: '#8a4a86', base: '#4a2350', lo: '#1c0d22' },
} satisfies Record<string, Tone>;

function bboxOf(pts: Pt[]): [number, number, number, number] {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1 - x0, y1 - y0];
}
export const poly = (pts: Pt[], smooth = false): Shape => ({ path: pathFrom(pts, true, smooth), bb: bboxOf(pts) });
export function ell(cx: number, cy: number, rx: number, ry = rx, rot = 0): Shape {
  const p = new Path2D(); p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  const r = Math.max(rx, ry);
  return { path: p, bb: [cx - r, cy - r, r * 2, r * 2] };
}
export function rrect(x: number, y: number, w: number, h: number, r: number): Shape {
  const p = new Path2D(); p.roundRect(x, y, w, h, r);
  return { path: p, bb: [x, y, w, h] };
}
/** 以 x=0 为轴对称的多边形：给出右半边（从上到下）。 */
export function sym(rightTopToBottom: Pt[], smooth = false): Shape {
  const left = rightTopToBottom.slice().reverse().map(([x, y]) => [-x, y] as Pt);
  return poly([...rightTopToBottom, ...left], smooth);
}
/** 正多边形/星形（r2 给出则交替半径）。 */
export function ngon(cx: number, cy: number, r: number, n: number, rot = 0, r2?: number): Shape {
  const pts: Pt[] = [];
  const m = r2 ? n * 2 : n;
  for (let i = 0; i < m; i++) {
    const a = rot + (i / m) * Math.PI * 2;
    const rr = r2 && i % 2 ? r2 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return poly(pts);
}

const BIG = 4000;
/** 内斜面：右下暗缘 + 左上亮缘（左上来光）。 */
export function bevel(ctx: Ctx, s: Shape, d: number, hi = 'rgba(255,240,205,0.5)', lo = 'rgba(0,0,0,0.5)'): void {
  ctx.save();
  ctx.clip(s.path);
  const a = new Path2D(); a.rect(-BIG, -BIG, BIG * 2, BIG * 2);
  a.addPath(s.path, new DOMMatrix().translate(-d, -d));
  ctx.fillStyle = lo; ctx.fill(a, 'evenodd');
  const b = new Path2D(); b.rect(-BIG, -BIG, BIG * 2, BIG * 2);
  b.addPath(s.path, new DOMMatrix().translate(d * 0.8, d * 0.8));
  ctx.fillStyle = hi; ctx.fill(b, 'evenodd');
  ctx.restore();
}

export interface BodyOpts {
  line?: number; lineColor?: string; blots?: number; seed?: number; bev?: number; wear?: number;
  angle?: number; /** 渐变方向（弧度，默认 45°：左上亮→右下暗） */
  noLine?: boolean;
}
/** 主体着色：斜向明暗渐变 + 墨洗晕斑 + 斜面 + 磨损 + 墨线描边。 */
export function body(ctx: Ctx, s: Shape, t: Tone, o: BodyOpts = {}): void {
  const [x, y, w, h] = s.bb;
  const { line = 2, lineColor = PAL.ink, blots = 8, seed = 3, bev = Math.max(1.2, Math.min(w, h) * 0.05), wear = 0.5, angle = Math.PI / 4 } = o;
  const cx = x + w / 2, cy = y + h / 2, L = (Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h) / 2;
  const dx = Math.cos(angle) * L, dy = Math.sin(angle) * L;
  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  g.addColorStop(0, t.hi); g.addColorStop(0.42, t.base); g.addColorStop(1, t.lo);
  ctx.save();
  ctx.fillStyle = g; ctx.fill(s.path);
  ctx.clip(s.path);
  const r = rng(seed * 131 + 7);
  for (let i = 0; i < blots; i++) {
    const bx = x + r() * w, by = y + r() * h, rad = (0.12 + r() * 0.3) * Math.min(w, h) + 3;
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
    rg.addColorStop(0, r() < 0.6 ? 'rgba(0,0,0,0.16)' : 'rgba(255,235,200,0.09)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(bx - rad, by - rad, rad * 2, rad * 2);
  }
  ctx.restore();
  if (wear > 0) {
    dryBrush(ctx, s.path, s.bb, 'rgba(255,240,210,0.5)', { count: Math.round(w * h / 260 * wear) + 4, angle: 0.6, len: 9, width: 0.8, alpha: 0.28, seed: seed + 9 });
    dryBrush(ctx, s.path, s.bb, 'rgba(0,0,0,0.6)', { count: Math.round(w * h / 380 * wear) + 3, angle: 0.5, len: 11, width: 1, alpha: 0.25, seed: seed + 21 });
  }
  if (bev > 0) bevel(ctx, s, bev);
  if (!o.noLine && line > 0) inkOutline(ctx, s.path, line, lineColor, seed);
}

/** 鱼鳞纹（半圆弧叠瓦）。 */
export function scales(ctx: Ctx, s: Shape, size: number, color = 'rgba(0,0,0,0.5)', hi = 'rgba(255,240,200,0.28)', lw = 0.9): void {
  const [x, y, w, h] = s.bb;
  ctx.save(); ctx.clip(s.path); ctx.lineCap = 'round';
  let row = 0;
  for (let yy = y - size; yy < y + h + size; yy += size * 0.5, row++) {
    for (let xx = x - size + (row % 2 ? size / 2 : 0); xx < x + w + size; xx += size) {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(xx, yy, size / 2, 0.15, Math.PI - 0.15); ctx.stroke();
      ctx.strokeStyle = hi; ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.arc(xx - 0.6, yy - 0.7, size / 2 - 0.4, Math.PI * 0.75, Math.PI * 1.1); ctx.stroke();
    }
  }
  ctx.restore();
}

/** 平行线阴影/瓦垄。 */
export function hatch(ctx: Ctx, s: Shape, angle: number, gap: number, color: string, lw = 0.8, alpha = 0.5, tick = 0): void {
  const [x, y, w, h] = s.bb;
  const cx = x + w / 2, cy = y + h / 2, R = Math.hypot(w, h) / 2 + 2;
  ctx.save(); ctx.clip(s.path);
  ctx.translate(cx, cy); ctx.rotate(angle);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  for (let u = -R; u <= R; u += gap) {
    ctx.beginPath(); ctx.moveTo(u, -R); ctx.lineTo(u, R); ctx.stroke();
    if (tick) for (let v = -R + (Math.round(u / gap) % 2) * tick / 2; v < R; v += tick) {
      ctx.beginPath(); ctx.moveTo(u, v); ctx.lineTo(u + gap * 0.55, v + 0.001); ctx.stroke();
    }
  }
  ctx.restore();
}

/** 沿线段等距铆钉（带高光点）。 */
export function rivetLine(ctx: Ctx, a: Pt, b: Pt, n: number, r = 1.3, color: string = PAL.gold2): void {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.6, r, 0, 7); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,245,215,0.75)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, 7); ctx.fill();
  }
  ctx.restore();
}
export function rivetRing(ctx: Ctx, cx: number, cy: number, R: number, n: number, r = 1.3, color: string = PAL.gold2, rot = 0): void {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    rivetLine(ctx, [x, y], [x, y], 1, r, color);
  }
}

/** 面板缝：暗线 + 亮边（浮雕）。 */
export function seamLine(ctx: Ctx, pts: Pt[], w = 1, dark = 'rgba(0,0,0,0.6)', light = 'rgba(255,240,205,0.22)'): void {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const tr = (ox: number, oy: number, c: string, lw: number) => {
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + ox, y + oy) : ctx.moveTo(x + ox, y + oy))); ctx.stroke();
  };
  tr(0.6, 0.7, light, w); tr(0, 0, dark, w);
  ctx.restore();
}
export function seamPath(ctx: Ctx, p: Path2D, w = 1, dark = 'rgba(0,0,0,0.6)', light = 'rgba(255,240,205,0.22)'): void {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.translate(0.6, 0.7); ctx.strokeStyle = light; ctx.lineWidth = w; ctx.stroke(p);
  ctx.translate(-0.6, -0.7); ctx.strokeStyle = dark; ctx.stroke(p);
  ctx.restore();
}

/** glow 层：霓虹线（外晕 + 亮芯）。 */
export function neon(ctx: Ctx, pts: Pt[], color: string, w = 2, core = true): void {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (lw: number, c: string, a: number) => {
    ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  };
  line(w * 2.2, color, 0.35); line(w, color, 1); if (core) line(w * 0.35, PAL.glowWhite, 0.85);
  ctx.restore();
}
export function neonPath(ctx: Ctx, p: Path2D, color: string, w = 2, core = true): void {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.35; ctx.strokeStyle = color; ctx.lineWidth = w * 2.2; ctx.stroke(p);
  ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.stroke(p);
  if (core) { ctx.globalAlpha = 0.85; ctx.strokeStyle = PAL.glowWhite; ctx.lineWidth = w * 0.35; ctx.stroke(p); }
  ctx.restore();
}
export const orb = (ctx: Ctx, x: number, y: number, r: number, c: string, core = 0.35) => glowDot(ctx, x, y, r, c, core);

/** 画一段笔触并保持与 style 的一致签名。 */
export function stroke(ctx: Ctx, pts: Pt[], w0: number, w1: number, color: string, seed = 1, o: { dry?: number; jitter?: number; belly?: number } = {}): void {
  brushStroke(ctx, pts, w0, w1, color, { seed, ...o });
}

/** 齿轮/锯齿圆。 */
export function cog(cx: number, cy: number, r: number, teeth: number, depth: number, rot = 0): Shape {
  const pts: Pt[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = rot + (i / teeth) * Math.PI * 2, da = (Math.PI * 2) / teeth;
    for (const [f, rr] of [[0.05, r - depth], [0.2, r], [0.55, r], [0.7, r - depth]] as const) {
      const a = a0 + da * f; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  }
  return poly(pts);
}

/** 炮管（朝 +y）：带高光的圆柱。 */
export function barrel(ctx: Ctx, x: number, y0: number, y1: number, w: number, t: Tone = TONE.iron): void {
  const s = rrect(x - w / 2, y0, w, y1 - y0, w * 0.3);
  body(ctx, s, t, { line: 1.4, angle: 0, blots: 2, wear: 0.2, bev: w * 0.18 });
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w * 0.42, y1 - 1.6, w * 0.84, 1.6);
}
export { PAL, rng, inkOutline, dryBrush, brushStroke, glowDot, pathFrom };
export type { Pt };
