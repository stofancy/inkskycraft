// 共享美术工具箱：调色板 + 笔触/墨洗/金线等 Canvas2D 辅助函数。
// 所有精灵文件都应从这里取色和取笔触，保证整体风格统一。

export const PAL = {
  // 墨与纸
  ink: '#15110e',
  ink2: '#2a241f',
  ink3: '#4a4038',
  paper: '#f1e8d4',
  paper2: '#dccfb2',
  paper3: '#b9a987',
  // 玩家阵营：朱砂与金箔
  cinnabar: '#d8391f',
  cinnabar2: '#a3230f',
  cinnabar3: '#6e1409',
  gold: '#e8b85a',
  gold2: '#b8862f',
  gold3: '#7a5418',
  jade: '#4f9c82',
  jade2: '#2d6451',
  // 「蚀」阵营：旧铜、铁、铜绿 + 霓虹
  bronze: '#6b5236',
  bronze2: '#4a3824',
  verdigris: '#4f8577',
  verdigris2: '#2f5a50',
  iron: '#33373d',
  iron2: '#23262b',
  lacquer: '#3a1d24',
  neonCyan: '#3ff4ff',
  neonMagenta: '#ff3fbf',
  neonViolet: '#a060ff',
  neonAmber: '#ffb040',
  neonLime: '#b6ff4a',
  // 发光色（glow 层用，偏亮）
  glowFire: '#ffb35a',
  glowWhite: '#fff6e0',
} as const;

export type Pt = [number, number];

/** 确定性随机数（mulberry32）。同一 seed 每次绘制结果一致。 */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由点列生成 Path2D。smooth=true 时用中点二次曲线得到圆润的有机轮廓。 */
export function pathFrom(pts: Pt[], close = true, smooth = false): Path2D {
  const p = new Path2D();
  if (pts.length === 0) return p;
  if (!smooth || pts.length < 3) {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    if (close) p.closePath();
    return p;
  }
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (close) {
    const m0 = mid(pts[n - 1], pts[0]);
    p.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const c = pts[i];
      const m = mid(c, pts[(i + 1) % n]);
      p.quadraticCurveTo(c[0], c[1], m[0], m[1]);
    }
    p.closePath();
  } else {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const m = mid(pts[i], pts[i + 1]);
      p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    p.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
  return p;
}

/** 把左半边点列（x<=0）镜像拼成完整对称轮廓：左侧从上到下，右侧从下到上。 */
export function symmetric(leftTopToBottom: Pt[]): Pt[] {
  const right = leftTopToBottom.slice().reverse().map(([x, y]) => [-x, y] as Pt);
  return [...leftTopToBottom, ...right];
}

/** 先画 fn，再以 x=0 为轴镜像再画一次。 */
export function mirrorX(ctx: CanvasRenderingContext2D, fn: () => void): void {
  fn();
  ctx.save();
  ctx.scale(-1, 1);
  fn();
  ctx.restore();
}

function catmull(pts: Pt[], step: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const out: Pt[] = [];
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const seg = Math.max(1, Math.ceil(len / step));
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export interface BrushOpts {
  /** 边缘抖动幅度（相对宽度），默认 0.12。 */
  jitter?: number;
  seed?: number;
  /** 中段加粗系数，默认 0.3（笔肚）。 */
  belly?: number;
  /** 飞白：沿笔画方向的断续透明条纹强度 0..1，默认 0。 */
  dry?: number;
}

/**
 * 毛笔笔触：沿折线（自动平滑）画一条起笔 w0、收笔 w1 的变宽笔画，边缘带随机起伏。
 * 适合画描边、羽毛、纹饰、墨线。
 */
export function brushStroke(
  ctx: CanvasRenderingContext2D, pts: Pt[], w0: number, w1: number, color: string, opts: BrushOpts = {},
): void {
  const { jitter = 0.12, seed = 7, belly = 0.3, dry = 0 } = opts;
  const r = rng(seed);
  const s = catmull(pts, 1.5);
  if (s.length < 2) return;
  const n = s.length;
  const L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const t = i / (n - 1);
    const w = (w0 + (w1 - w0) * t) * (1 + belly * Math.sin(Math.PI * t)) * 0.5;
    const jl = 1 + (r() - 0.5) * 2 * jitter, jr = 1 + (r() - 0.5) * 2 * jitter;
    L.push([s[i][0] - dy * w * jl, s[i][1] + dx * w * jl]);
    R.push([s[i][0] + dy * w * jr, s[i][1] - dx * w * jr]);
  }
  ctx.save();
  ctx.fillStyle = color;
  const p = new Path2D();
  p.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) p.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
  p.closePath();
  ctx.fill(p);
  if (dry > 0) {
    // 飞白：在笔画内部用 destination-out 擦出细长的断续空隙
    ctx.clip(p);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    const lanes = 5 + Math.floor(dry * 6);
    for (let k = 0; k < lanes; k++) {
      const off = (r() - 0.5) * 0.9;
      ctx.lineWidth = Math.max(0.3, Math.max(w0, w1) * 0.06 * (0.5 + r()));
      ctx.globalAlpha = dry * (0.4 + r() * 0.6);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        if (t < 0.25 + r() * 0.2) continue;
        const x = L[i][0] + (R[i][0] - L[i][0]) * (0.5 + off);
        const y = L[i][1] + (R[i][1] - L[i][1]) * (0.5 + off);
        if (!started || r() < 0.08) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * 墨线描边：一条主线 + 两条轻微错位的淡线，模拟毛笔勾勒的粗细不匀。
 */
export function inkOutline(
  ctx: CanvasRenderingContext2D, path: Path2D, width = 2.4, color: string = PAL.ink, seed = 3,
): void {
  const r = rng(seed);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(path);
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.translate((r() - 0.5) * width * 0.7, (r() - 0.5) * width * 0.7);
    ctx.lineWidth = width * (0.45 + r() * 0.5);
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * 墨洗填充：竖向渐变 + 随机淡色晕斑，得到水墨渲染的不均匀质感。
 * bbox 为 [x, y, w, h]。
 */
export function washFill(
  ctx: CanvasRenderingContext2D, path: Path2D, top: string, bottom: string,
  bbox: [number, number, number, number], opts: { blots?: number; blotColor?: string; seed?: number; alpha?: number } = {},
): void {
  const [x, y, w, h] = bbox;
  const { blots = 10, blotColor = 'rgba(0,0,0,0.10)', seed = 11, alpha = 1 } = opts;
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.clip(path);
  for (let i = 0; i < blots; i++) {
    const cx = x + r() * w, cy = y + r() * h, rad = (0.1 + r() * 0.35) * Math.min(w, h);
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, blotColor);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}

/**
 * 枯笔擦痕：在 clip 区域内画许多同向短笔触，做金属磨损、纸张纤维、羽毛纹理。
 */
export function dryBrush(
  ctx: CanvasRenderingContext2D, clip: Path2D, bbox: [number, number, number, number], color: string,
  opts: { count?: number; angle?: number; len?: number; width?: number; alpha?: number; seed?: number } = {},
): void {
  const [x, y, w, h] = bbox;
  const { count = 40, angle = Math.PI / 2, len = 14, width = 1.2, alpha = 0.35, seed = 5 } = opts;
  const r = rng(seed);
  ctx.save();
  ctx.clip(clip);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const cx = x + r() * w, cy = y + r() * h;
    const a = angle + (r() - 0.5) * 0.3;
    const l = len * (0.4 + r() * 0.8);
    ctx.globalAlpha = alpha * (0.3 + r() * 0.7);
    ctx.lineWidth = width * (0.4 + r() * 0.9);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * l / 2, cy - Math.sin(a) * l / 2);
    ctx.lineTo(cx + Math.cos(a) * l / 2, cy + Math.sin(a) * l / 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** 金线：暗金底线 + 亮金高光线，用于镶边、纹饰。 */
export function goldTrim(ctx: CanvasRenderingContext2D, path: Path2D, width = 1.6): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = PAL.gold3;
  ctx.lineWidth = width * 1.6;
  ctx.stroke(path);
  ctx.strokeStyle = PAL.gold;
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.translate(-width * 0.25, -width * 0.25);
  ctx.strokeStyle = 'rgba(255,240,200,0.55)';
  ctx.lineWidth = width * 0.4;
  ctx.stroke(path);
  ctx.restore();
}

/** 径向发光点（glow 层用）。 */
export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, core = 0.35): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, PAL.glowWhite);
  g.addColorStop(core, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** 在 (x, y) 居中写一个汉字（思源宋体粗体），用于道具、印章、纹饰。 */
export function glyph(
  ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number, color: string, weight = 900,
): void {
  ctx.save();
  ctx.font = `${weight} ${size}px "Noto Serif CJK SC", "Noto Serif CJK TC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(ch, x, y + size * 0.04);
  ctx.restore();
}

/** 细线组（铆接缝、面板线）。 */
export function panelLines(ctx: CanvasRenderingContext2D, lines: Pt[][], color: string, width = 0.8): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (const l of lines) {
    ctx.beginPath();
    ctx.moveTo(l[0][0], l[0][1]);
    for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]);
    ctx.stroke();
  }
  ctx.restore();
}

/** 铆钉/圆点列。 */
export function rivets(ctx: CanvasRenderingContext2D, pts: Pt[], r = 1.2, color: string = PAL.gold2): void {
  ctx.save();
  ctx.fillStyle = color;
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
