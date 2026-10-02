// 雷武器的分叉闪电：中点位移生成主干 + 细分支，逐点半宽沿路径渐细。
export interface BoltPath { pts: number[]; w: number[] }
export interface Bolt { trunk: BoltPath; branches: BoltPath[] }

function displace(x0: number, y0: number, x1: number, y1: number, depth: number, rough: number): number[] {
  let pts: number[] = [x0, y0, x1, y1];
  let amp = Math.hypot(x1 - x0, y1 - y0) * rough;
  for (let d = 0; d < depth; d++) {
    const next: number[] = [];
    for (let i = 0; i < pts.length - 2; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3];
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
      const o = (Math.random() - 0.5) * amp;
      next.push(ax, ay, (ax + bx) / 2 - (dy / l) * o, (ay + by) / 2 + (dx / l) * o);
    }
    next.push(pts[pts.length - 2], pts[pts.length - 1]);
    pts = next;
    amp *= 0.55;
  }
  return pts;
}

function taper(pts: number[], w0: number, w1: number): number[] {
  const n = pts.length / 2, w: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    w.push((w0 + (w1 - w0) * t) * (0.58 + 0.65 * Math.sin(Math.PI * t)) * (0.86 + Math.random() * 0.28));
  }
  return w;
}

/** hw：主干起点半宽；branches：分支数量。 */
export function makeBolt(x0: number, y0: number, x1: number, y1: number, hw: number, branches: number): Bolt {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const pts = displace(x0, y0, x1, y1, len > 220 ? 4 : 3, 0.24);
  const trunk = { pts, w: taper(pts, hw, hw * 0.065) };
  const out: BoltPath[] = [];
  const n = pts.length / 2;
  for (let k = 0; k < branches && n > 6; k++) {
    const i = 2 + Math.floor(Math.random() * (n - 5));
    const px = pts[i * 2], py = pts[i * 2 + 1];
    const dx = pts[i * 2 + 2] - pts[i * 2 - 2], dy = pts[i * 2 + 3] - pts[i * 2 - 1];
    const a = Math.atan2(dy, dx) + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.55);
    const bl = len * (0.08 + Math.random() * 0.16);
    const bp = displace(px, py, px + Math.cos(a) * bl, py + Math.sin(a) * bl, 3, 0.3);
    out.push({ pts: bp, w: taper(bp, hw * 0.24, hw * 0.015) });
  }
  return { trunk, branches: out };
}
