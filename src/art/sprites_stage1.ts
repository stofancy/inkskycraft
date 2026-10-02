import type { SpriteDef } from './types';
import { PAL, brushStroke, inkOutline, glowDot, symmetric, pathFrom, rng, goldTrim } from './style';
import type { Pt } from './style';
import {
  plate, line, groove, dots, ellipsePath, neonLine, neonSeamDraw, bevel, litFill, bboxOf, orb, rectPath, feather, softShadow, rotated,
} from './b1_helpers';

const NEON = PAL.neonCyan;
const M = PAL.neonMagenta;

/** 纸面折面：三色明暗 + 纤维 + 墨边。 */
function facet(ctx: CanvasRenderingContext2D, pts: Pt[], light: string, base: string, dark: string, seed: number, ew = 0.85): Path2D {
  const p = pathFrom(pts, true, false);
  litFill(ctx, p, bboxOf(pts), light, base, dark, { seed, blots: 2, blotColor: 'rgba(90,70,40,0.14)', wear: 'rgba(120,100,70,0.55)', wearN: 8 });
  inkOutline(ctx, p, ew, PAL.ink, seed + 5);
  return p;
}
const PL = '#fbf3df', PB = PAL.paper, PD = PAL.paper2, PDD = PAL.paper3;

// ================= 纸鹤 52x48 =================
function craneDraw(ctx: CanvasRenderingContext2D, f: number): void {
  const up = f === 1;
  const r0: Pt = [-3, -8], r1: Pt = [-3, 4];
  const front: Pt = up ? [-11, -13] : [-13, -14];
  const tip: Pt = up ? [-20, -16] : [-25, -2];
  const back: Pt = up ? [-10, 4] : [-12, 10];
  const wing = (sg: number, lit: boolean) => {
    ctx.save(); ctx.scale(sg, 1);
    const m = (p: Pt): Pt => [p[0], p[1]];
    softShadow(ctx, pathFrom([m(r0), m(front), m(tip), m(back), m(r1)]), -sg * 1.2, 2, 0.25);
    facet(ctx, [m(r0), m(front), m(tip)], lit ? PL : PB, lit ? PB : PD, lit ? PD : PDD, 11 + f);
    facet(ctx, [m(r0), m(tip), m(back), m(r1)], lit ? PB : PD, lit ? PD : PDD, lit ? PDD : '#9a8b6c', 14 + f);
    // 折痕
    line(ctx, [m(r1), [(tip[0] + r1[0]) / 2 - 1, (tip[1] + r1[1]) / 2 + 1]], 'rgba(60,44,28,0.55)', 0.7);
    line(ctx, [[r0[0] - 3, r0[1] + 1], [front[0] * 0.75, front[1] * 0.4 + 3]], 'rgba(60,44,28,0.4)', 0.6);
    // 翼尖墨染
    brushStroke(ctx, [[tip[0] * 0.8 + 1, tip[1] * 0.8 - 1], tip], 2.4, 0.5, PAL.ink, { seed: 4 + f, jitter: 0.15, dry: 0.2 });
    brushStroke(ctx, [[tip[0] * 0.66, tip[1] * 0.66 + 2.5], [tip[0] * 0.92, tip[1] * 0.92 + 2]], 2.4, 0.5, PAL.ink3, { seed: 8 + f, jitter: 0.2 });
    // 蚀纹：霓虹裂
    neonSeamDraw(ctx, [[tip[0] * 0.5, tip[1] * 0.5 + 1], [tip[0] * 0.62 + 1, tip[1] * 0.62 + 3.6], [tip[0] * 0.7, tip[1] * 0.7 + 3]], NEON, 0.5);
    ctx.restore();
  };
  wing(-1, false);
  wing(1, true);
  // 尾
  facet(ctx, [[-2.8, -10], [0, -23], [0, -10]], PB, PD, PDD, 21);
  facet(ctx, [[2.8, -10], [0, -23], [0, -10]], PD, PDD, '#9a8b6c', 22);
  // 颈
  facet(ctx, [[-2.4, 6], [0, 6], [0, 19], [-1.1, 19]], PB, PD, PDD, 23);
  facet(ctx, [[2.4, 6], [0, 6], [0, 19], [1.1, 19]], PD, PDD, '#9a8b6c', 24);
  // 身体
  facet(ctx, [[0, -14], [-7, -3], [0, 12]], PL, PB, PD, 25);
  facet(ctx, [[0, -14], [7, -3], [0, 12]], PD, PDD, '#9a8b6c', 26);
  line(ctx, [[-7, -3], [0, 3], [7, -3]], 'rgba(60,44,28,0.55)', 0.7);
  line(ctx, [[-3.6, -8], [-3.6, 2]], 'rgba(255,255,255,0.4)', 0.6);
  // 头与喙
  facet(ctx, [[-3.2, 16], [3.2, 16], [0, 22.4]], PB, PD, PDD, 27, 1.1);
  const beak = pathFrom([[-1, 19.5], [1, 19.5], [0, 23.6]]);
  ctx.fillStyle = PAL.ink; ctx.fill(beak);
  // 眼
  for (const sg of [-1, 1]) { ctx.fillStyle = '#062a30'; ctx.beginPath(); ctx.arc(sg * 1.7, 17.4, 1.1, 0, 7); ctx.fill(); ctx.fillStyle = NEON; ctx.beginPath(); ctx.arc(sg * 1.7, 17.3, 0.7, 0, 7); ctx.fill(); }
  // 朱印小点：额头
  ctx.fillStyle = PAL.cinnabar2; ctx.beginPath(); ctx.arc(0, -2, 1.1, 0, 7); ctx.fill();
}
function craneGlow(ctx: CanvasRenderingContext2D, f: number): void {
  const up = f === 1;
  const tip: Pt = up ? [-20, -16] : [-25, -2];
  for (const sg of [-1, 1]) {
    glowDot(ctx, sg * 1.7, 17.4, 2.2, NEON, 0.35);
    neonLine(ctx, [[sg * tip[0] * 0.5, tip[1] * 0.5 + 1], [sg * (tip[0] * 0.62 + 1), tip[1] * 0.62 + 3.6], [sg * tip[0] * 0.7, tip[1] * 0.7 + 3]], NEON, 0.6);
  }
}
const crane: SpriteDef = { id: 'e_crane', w: 52, h: 48, frames: 2, radius: 10, draw: craneDraw, glow: craneGlow, anchors: { muzzle: [0, 20] } };

// ================= 风筝 68x64 =================
const KITE_TOP: Pt = [0, -28], KITE_L: Pt = [-31, -5], KITE_R: Pt = [31, -5], KITE_B: Pt = [0, 29];
const kite: SpriteDef = {
  id: 'e_kite', w: 68, h: 64, radius: 14, anchors: { muzzle: [0, 28], gunL: [-24, -4], gunR: [24, -4], core: [0, -5] },
  draw(ctx) {
    const c: Pt = [0, -5];
    const quad = (a: Pt, b: Pt, light: string, base: string, dark: string, seed: number) => {
      // 略内凹的蒙纸面
      const mid1: Pt = [(a[0] + b[0]) / 2 * 0.94 + c[0] * 0.06, (a[1] + b[1]) / 2 * 0.94 + c[1] * 0.06];
      const p = pathFrom([c, a, mid1, b], true, false);
      litFill(ctx, p, bboxOf([c, a, b]), light, base, dark, { seed, blots: 3, blotColor: 'rgba(90,70,40,0.15)', wear: 'rgba(120,100,70,0.6)', wearN: 14 });
      return p;
    };
    // 纸面四象限
    softShadow(ctx, pathFrom([KITE_TOP, KITE_L, KITE_B, KITE_R]), 1.5, 2.4, 0.3);
    const q1 = quad(KITE_TOP, KITE_L, PL, PB, PD, 41);
    const q2 = quad(KITE_TOP, KITE_R, PB, PD, PDD, 42);
    const q3 = quad(KITE_B, KITE_L, PB, PD, PDD, 43);
    const q4 = quad(KITE_B, KITE_R, PD, PDD, '#8a7b5c', 44);
    // 水墨山水/云纹（每面一个）
    const inkPatch = (p: Path2D, fn: () => void) => { ctx.save(); ctx.clip(p); fn(); ctx.restore(); };
    inkPatch(q1, () => { brushStroke(ctx, [[-26, -4], [-20, -14], [-13, -6], [-7, -18]], 5, 1, 'rgba(42,36,31,0.55)', { seed: 3, dry: 0.5 }); brushStroke(ctx, [[-24, -10], [-15, -12]], 2, 1, PAL.ink3, { seed: 4 }); });
    inkPatch(q2, () => { brushStroke(ctx, [[8, -22], [16, -12], [24, -16], [28, -6]], 4.5, 1, 'rgba(42,36,31,0.5)', { seed: 5, dry: 0.5 }); });
    inkPatch(q3, () => { brushStroke(ctx, [[-24, 4], [-14, 10], [-10, 18], [-3, 24]], 5, 1, 'rgba(42,36,31,0.6)', { seed: 6, dry: 0.4 }); });
    inkPatch(q4, () => { brushStroke(ctx, [[22, 6], [14, 12], [8, 20]], 5, 1, 'rgba(42,36,31,0.55)', { seed: 7, dry: 0.5 }); ctx.fillStyle = PAL.cinnabar2; ctx.beginPath(); ctx.arc(14, 5, 2, 0, 7); ctx.fill(); });
    // 蚀：破损（缺口 + 霓虹缝）
    // 骨架：外框（铜）
    const frame = pathFrom([KITE_TOP, KITE_L, KITE_B, KITE_R], true, false);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 4.4; ctx.stroke(frame);
    ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 2.8; ctx.stroke(frame);
    ctx.translate(-0.5, -0.5); ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = 0.9; ctx.stroke(frame); ctx.restore();
    // 十字骨
    for (const [a, b] of [[KITE_TOP, KITE_B], [KITE_L, KITE_R]] as [Pt, Pt][]) {
      line(ctx, [a, b], PAL.ink, 3.6);
      line(ctx, [a, b], '#8a6a44', 2.2);
      line(ctx, [[a[0] - 0.4, a[1] - 0.4], [b[0] - 0.4, b[1] - 0.4]], 'rgba(255,225,170,0.55)', 0.7);
    }
    // 骨架接缝铆钉 + 霓虹缝（沿内侧）
    for (const [a, b] of [[KITE_TOP, KITE_L], [KITE_TOP, KITE_R], [KITE_B, KITE_L], [KITE_B, KITE_R]] as [Pt, Pt][]) {
      const m0: Pt = [a[0] + (b[0] - a[0]) * 0.28, a[1] + (b[1] - a[1]) * 0.28], m1: Pt = [a[0] + (b[0] - a[0]) * 0.62, a[1] + (b[1] - a[1]) * 0.62];
      const off = (p: Pt): Pt => [p[0] + (c[0] - p[0]) * 0.13, p[1] + (c[1] - p[1]) * 0.13];
      neonSeamDraw(ctx, [off(m0), off(m1)], M, 0.7);
    }
    dots(ctx, [[0, -20], [0, 12], [-22, -5], [22, -5], [0, 22], [0, -26]], 1, '#a07a48');
    // 端部灯座（四角铜帽）
    for (const p of [KITE_TOP, KITE_L, KITE_R, KITE_B]) { orb(ctx, p[0] * 0.97, p[1] * 0.97, 2.6, '#c9a26a', PAL.bronze2, PAL.ink); }
    // 中心毂：铜盘 + 铜绿环 + 霓虹核
    const hub = ellipsePath(0, -5, 8.6, 8.6);
    litFill(ctx, hub, [-9, -14, 18, 18], '#c9a26a', PAL.bronze, PAL.bronze2, { seed: 2, blots: 0 });
    bevel(ctx, hub, 'rgba(255,240,205,0.6)', 'rgba(0,0,0,0.5)', 0.9, 1.4);
    inkOutline(ctx, hub, 1.8, PAL.ink, 47);
    const ring = ellipsePath(0, -5, 5.6, 5.6);
    ctx.save(); ctx.strokeStyle = PAL.verdigris2; ctx.lineWidth = 1.4; ctx.stroke(ring); ctx.restore();
    orb(ctx, 0, -5, 3.4, '#b6fbff', '#0d7f8c', '#031a1e');
    // 后端尾飘带（两条小缀）
    brushStroke(ctx, [[-2, -27], [-5, -30], [-3, -32]], 2.6, 0.8, PAL.cinnabar2, { seed: 9 });
    brushStroke(ctx, [[2, -27], [5, -30.5], [3, -32]], 2.6, 0.8, PAL.cinnabar2, { seed: 10 });
    // 机头炮口（下端）
    plate(ctx, [[-2.6, 24], [2.6, 24], [2.2, 30.4], [-2.2, 30.4]], { light: '#7a7f88', base: PAL.iron, dark: PAL.iron2, edgeW: 1.2, seed: 50 });
  },
  glow(ctx) {
    const c: Pt = [0, -5];
    for (const [a, b] of [[KITE_TOP, KITE_L], [KITE_TOP, KITE_R], [KITE_B, KITE_L], [KITE_B, KITE_R]] as [Pt, Pt][]) {
      const m0: Pt = [a[0] + (b[0] - a[0]) * 0.28, a[1] + (b[1] - a[1]) * 0.28], m1: Pt = [a[0] + (b[0] - a[0]) * 0.62, a[1] + (b[1] - a[1]) * 0.62];
      const off = (p: Pt): Pt => [p[0] + (c[0] - p[0]) * 0.13, p[1] + (c[1] - p[1]) * 0.13];
      neonLine(ctx, [off(m0), off(m1)], M, 0.9);
    }
    glowDot(ctx, 0, -5, 6, NEON, 0.12);
    for (const p of [KITE_L, KITE_R]) glowDot(ctx, p[0] * 0.97, p[1] * 0.97, 3.4, M, 0.3);
    glowDot(ctx, 0, 29.4, 3.4, M, 0.3);
  },
};

void 0; void rng; void goldTrim; void groove; void rectPath; void feather; void rotated; void plate;

// ================= 铜龟 84x84 =================
function hexPts(cx: number, cy: number, r: number, rot = Math.PI / 6): Pt[] {
  return Array.from({ length: 6 }, (_, i) => { const a = rot + i * Math.PI / 3; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.94] as Pt; });
}
const TURTLE_C: Pt = [0, -5];
const turtle: SpriteDef = {
  id: 'e_turtle', w: 84, h: 84, radius: 30, anchors: { turret: [0, -5], head: [0, 33] },
  draw(ctx) {
    const cx = TURTLE_C[0], cy = TURTLE_C[1];
    // 尾
    plate(ctx, [[-3, -30], [3, -30], [1.6, -40], [-1.6, -40]], { light: '#a08258', base: PAL.bronze, dark: PAL.bronze2, edgeW: 1.4, seed: 60 });
    // 四足履带舱
    for (const [sx, y] of [[-1, -20], [1, -20], [-1, 10], [1, 10]] as [number, number][]) {
      ctx.save(); ctx.scale(sx, 1);
      const pod = plate(ctx, [[22, y - 9], [34, y - 9], [36, y + 10], [21, y + 10]], { light: '#6a6e76', base: PAL.iron, dark: PAL.iron2, edgeW: 1.8, seed: 61 + y, wear: 'rgba(200,190,170,0.4)', wearN: 8, smooth: false });
      void pod;
      // 履带节
      for (let k = -7; k <= 8; k += 3) line(ctx, [[23.4, y + k], [34.6, y + k]], 'rgba(0,0,0,0.6)', 0.9);
      for (let k = -7; k <= 8; k += 3) line(ctx, [[23.4, y + k + 0.8], [34.6, y + k + 0.8]], 'rgba(220,210,190,0.18)', 0.5);
      // 连杆
      plate(ctx, [[15, y - 3], [23, y - 3], [23, y + 3], [15, y + 3]], { light: '#a08258', base: PAL.bronze2, dark: PAL.ink2, edgeW: 1.2, seed: 65 });
      ctx.restore();
    }
    // 头（朝下）
    plate(ctx, [[-4, 22], [4, 22], [7.4, 30], [5, 38], [0, 40], [-5, 38], [-7.4, 30]], { light: '#b39264', base: '#86694a', dark: PAL.bronze2, smooth: true, edgeW: 1.9, seed: 70, wear: 'rgba(240,210,160,0.5)', wearN: 8 });
    groove(ctx, [[-5, 29], [0, 31], [5, 29]], 0.8);
    for (const sg of [-1, 1]) {
      const eye = ellipsePath(sg * 3.6, 32.4, 1.7, 1.2, sg * 0.5);
      ctx.fillStyle = '#062a30'; ctx.fill(eye);
      ctx.fillStyle = NEON; ctx.beginPath(); ctx.ellipse(sg * 3.6, 32.4, 1, 0.7, sg * 0.5, 0, 7); ctx.fill();
    }
    // 龟甲：椭圆外壳
    const shell = ellipsePath(cx, cy, 27, 31);
    ctx.save(); ctx.translate(1.6, 2.4); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.fill(shell); ctx.restore();
    litFill(ctx, shell, [cx - 27, cy - 31, 54, 62], '#a5875a', PAL.bronze, PAL.bronze2, { seed: 71, blots: 5, wear: 'rgba(240,215,170,0.45)', wearN: 30 });
    bevel(ctx, shell, 'rgba(255,240,205,0.5)', 'rgba(0,0,0,0.5)', 1.4, 2.4);
    inkOutline(ctx, shell, 2.6, PAL.ink, 72);
    // 缘甲一圈（小片）
    ctx.save(); ctx.clip(shell);
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const x = cx + Math.cos(a) * 24.4, y = cy + Math.sin(a) * 28.4;
      const ang = a;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      const sp = pathFrom([[-4, -3.4], [3.6, -3.4], [3.6, 3.4], [-4, 3.4]], true, false);
      const lightSide = Math.cos(a - Math.PI * 1.25) > 0;
      ctx.fillStyle = lightSide ? '#8a6c46' : PAL.bronze2; ctx.fill(sp);
      ctx.strokeStyle = 'rgba(10,6,4,0.75)'; ctx.lineWidth = 0.9; ctx.stroke(sp);
      ctx.restore();
    }
    ctx.restore();
    // 中央大六边形 + 一圈六边形（龟甲纹）
    const cells: { c: Pt; r: number; tone: number }[] = [{ c: [cx, cy], r: 10.4, tone: 0 }];
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; cells.push({ c: [cx + Math.cos(a) * 17.8, cy + Math.sin(a) * 19.4], r: 8.2, tone: 1 + (i % 2) }); }
    for (const { c, r, tone } of cells) {
      const pts = hexPts(c[0], c[1], r);
      const [l, b, d] = tone === 0 ? ['#7fb3a3', PAL.verdigris, PAL.verdigris2] : tone === 1 ? ['#c4a274', '#8c6c48', PAL.bronze2] : ['#9a7d54', PAL.bronze, '#3a2c1c'];
      plate(ctx, pts, { light: l, base: b, dark: d, edgeW: 1.5, seed: 80 + Math.round(c[0] + c[1]), wear: 'rgba(240,225,190,0.5)', wearN: 8, edge: PAL.ink });
      // 六边形内圈纹
      const inner = pathFrom(hexPts(c[0], c[1], r * 0.58), true);
      ctx.save(); ctx.strokeStyle = 'rgba(10,6,4,0.45)'; ctx.lineWidth = 0.8; ctx.stroke(inner); ctx.restore();
    }
    // 中央炮塔座圈
    const ring = ellipsePath(cx, cy, 6.6, 6.6);
    ctx.save(); ctx.fillStyle = PAL.iron2; ctx.fill(ring); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.4; ctx.stroke(ring); ctx.restore();
    // 铆钉
    dots(ctx, [[cx - 21, cy - 10], [cx + 21, cy - 10], [cx - 21, cy + 12], [cx + 21, cy + 12], [cx, cy - 27], [cx, cy + 27]], 1, '#c9a26a');
    // 龟甲接缝霓虹
    neonSeamDraw(ctx, [[cx - 9.4, cy + 22], [cx - 3, cy + 26.4]], M, 0.7);
    neonSeamDraw(ctx, [[cx + 9.4, cy + 22], [cx + 3, cy + 26.4]], M, 0.7);
  },
  glow(ctx) {
    const cx = TURTLE_C[0], cy = TURTLE_C[1];
    for (const sg of [-1, 1]) {
      glowDot(ctx, sg * 3.6, 32.4, 2.6, NEON, 0.4);
      neonLine(ctx, [[cx + sg * 9.4, cy + 22], [cx + sg * 3, cy + 26.4]], M, 0.8);
    }
    // 座圈霓虹环
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(63,244,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 6.6, 0, 7); ctx.stroke(); ctx.restore();
  },
};

// ================= 龟背炮塔 40x48（绕中心旋转，炮管朝下） =================
const turtleGun: SpriteDef = {
  id: 'e_turtle_gun', w: 40, h: 48, radius: 12, anchors: { muzzle: [0, 23] },
  draw(ctx) {
    // 后座配重
    plate(ctx, [[-8, -19], [8, -19], [10, -11], [-10, -11]], { light: '#6a6e76', base: PAL.iron, dark: PAL.iron2, edgeW: 1.6, seed: 90, wear: 'rgba(200,190,170,0.4)', wearN: 8 });
    dots(ctx, [[-5.4, -16], [5.4, -16]], 0.9, '#a07a48');
    // 炮管
    plate(ctx, [[-4, 2], [4, 2], [4.4, 17], [-4.4, 17]], { light: '#a5875a', base: PAL.bronze, dark: PAL.bronze2, edgeW: 1.7, seed: 91, wear: 'rgba(240,215,170,0.5)', wearN: 10 });
    line(ctx, [[-2.2, 4], [-2.2, 16]], 'rgba(255,235,190,0.45)', 0.9);
    // 炮口箍与制退器
    plate(ctx, [[-6.4, 15.6], [6.4, 15.6], [7, 21], [-7, 21]], { light: '#7fb3a3', base: PAL.verdigris2, dark: '#1b3a33', edgeW: 1.6, seed: 92 });
    line(ctx, [[-6, 18.2], [6, 18.2]], 'rgba(0,0,0,0.6)', 0.8);
    plate(ctx, [[-4.8, 20.8], [4.8, 20.8], [3.4, 24], [-3.4, 24]], { light: '#59595f', base: PAL.iron2, dark: PAL.ink, edgeW: 1.3, seed: 93 });
    // 圆顶
    const dome = ellipsePath(0, -3, 14.4, 13.4);
    ctx.save(); ctx.translate(1, 1.6); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.fill(dome); ctx.restore();
    const g = ctx.createRadialGradient(-5, -9, 1, 0, -3, 17);
    g.addColorStop(0, '#d0ae7c'); g.addColorStop(0.45, PAL.bronze); g.addColorStop(1, PAL.bronze2);
    ctx.fillStyle = g; ctx.fill(dome);
    inkOutline(ctx, dome, 2.2, PAL.ink, 94);
    // 龟纹面板
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6;
      line(ctx, [[Math.cos(a) * 5, -3 + Math.sin(a) * 5], [Math.cos(a) * 13, -3 + Math.sin(a) * 12.4]], 'rgba(10,6,4,0.6)', 0.9);
    }
    const hx = plate(ctx, hexPts(0, -3, 6.2), { light: '#7fb3a3', base: PAL.verdigris, dark: PAL.verdigris2, edgeW: 1.4, seed: 95, edge: PAL.ink });
    void hx;
    orb(ctx, 0, -3, 2.3, '#ffd0ef', '#a01a78', '#2a0620');
    dots(ctx, [[-10, -3], [10, -3], [0, -12], [0, 6.4]], 0.9, '#c9a26a');
    // 侧霓虹缝
    neonSeamDraw(ctx, [[-10.6, 2.4], [-7.4, 5.6]], M, 0.7);
    neonSeamDraw(ctx, [[10.6, 2.4], [7.4, 5.6]], M, 0.7);
  },
  glow(ctx) {
    glowDot(ctx, 0, -3, 5, M, 0.25);
    for (const sg of [-1, 1]) neonLine(ctx, [[sg * 10.6, 2.4], [sg * 7.4, 5.6]], M, 0.8);
    glowDot(ctx, 0, 23.4, 3.6, M, 0.3);
  },
};

// ================= 飞行战车 130x120 =================
function rotor(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number): void {
  // 动态模糊盘
  const disc = ellipsePath(cx, cy, R, R);
  ctx.save(); ctx.translate(1, 1.6); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ctx.fill(disc); ctx.restore();
  const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R);
  g.addColorStop(0, 'rgba(160,130,90,0.55)'); g.addColorStop(1, 'rgba(60,44,28,0.62)');
  ctx.fillStyle = g; ctx.fill(disc);
  // 车轮辐条（铜）
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5 + seed;
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.28, cy + Math.sin(a) * R * 0.28); ctx.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); ctx.stroke();
    ctx.strokeStyle = i % 2 ? '#8c6c48' : '#c4a274'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.28, cy + Math.sin(a) * R * 0.28); ctx.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); ctx.stroke();
  }
  ctx.restore();
  // 轮辋
  ctx.save();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 5.6; ctx.stroke(disc);
  ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 3.6; ctx.stroke(disc);
  ctx.strokeStyle = '#c4a274'; ctx.lineWidth = 1; ctx.translate(-0.6, -0.6); ctx.stroke(disc);
  ctx.restore();
  // 旋转虚影（半透明扇面刀片）
  ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(230,215,180,0.5)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.7, 0.3, 1.8); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 3.4, 4.9); ctx.stroke();
  ctx.restore();
  // 轮毂
  const hub = ellipsePath(cx, cy, R * 0.3, R * 0.3);
  litFill(ctx, hub, [cx - R * 0.3, cy - R * 0.3, R * 0.6, R * 0.6], '#7fb3a3', PAL.verdigris, PAL.verdigris2, { seed: 5, blots: 0 });
  bevel(ctx, hub, 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.5)', 0.8, 1.2);
  inkOutline(ctx, hub, 1.6, PAL.ink, 4);
  orb(ctx, cx, cy, R * 0.14, '#ffd0ef', '#a01a78', '#2a0620');
}
const CH_WX = 40, CH_WY = -6, CH_R = 21;
const chariot: SpriteDef = {
  id: 'e_chariot', w: 130, h: 120, radius: 34, anchors: { gunL: [-22, 40], gunR: [22, 40], bay: [0, 22], wheelL: [-CH_WX, CH_WY], wheelR: [CH_WX, CH_WY] },
  draw(ctx) {
    // 尾部平衡翼
    plate(ctx, [[-30, -48], [-12, -44], [-12, -36], [-34, -38]], { light: '#a5875a', base: PAL.bronze, dark: PAL.bronze2, edgeW: 1.6, seed: 100, wear: 'rgba(240,215,170,0.4)', wearN: 8 });
    plate(ctx, [[30, -48], [12, -44], [12, -36], [34, -38]], { light: '#a5875a', base: PAL.bronze, dark: PAL.bronze2, edgeW: 1.6, seed: 101 });
    // 车轴
    plate(ctx, [[-CH_WX, CH_WY - 3.2], [CH_WX, CH_WY - 3.2], [CH_WX, CH_WY + 3.2], [-CH_WX, CH_WY + 3.2]], { light: '#6a6e76', base: PAL.iron, dark: PAL.iron2, edgeW: 1.6, seed: 102 });
    // 车轮（旋翼）
    rotor(ctx, -CH_WX, CH_WY, CH_R, 0.2);
    rotor(ctx, CH_WX, CH_WY, CH_R, 0.5);
    // 车厢主体（俯视：船形）
    const hull: Pt[] = symmetric([[-6, -52], [-16, -46], [-21, -30], [-23, -6], [-22, 18], [-18, 36], [-11, 48], [-4, 54]]);
    const hp = plate(ctx, hull, { light: '#c4a274', base: '#86694a', dark: PAL.bronze2, smooth: true, edgeW: 2.4, seed: 103, wear: 'rgba(240,215,170,0.5)', wearN: 28, blots: 6 });
    void hp;
    // 车顶：漆黑竹席 + 铜绿瓦
    const roof: Pt[] = symmetric([[-4, -40], [-12, -34], [-14, -12], [-13, 8], [-8, 16], [-3, 18]]);
    const rp = plate(ctx, roof, { light: '#7a3a44', base: PAL.lacquer, dark: '#1c0a10', smooth: true, edgeW: 1.8, seed: 104, wear: 'rgba(255,190,170,0.3)', wearN: 14 });
    // 瓦垄
    ctx.save(); ctx.clip(rp);
    for (let y = -38; y < 18; y += 5.4) {
      const g = ctx.createLinearGradient(0, y, 0, y + 5.4);
      g.addColorStop(0, 'rgba(120,170,155,0.9)'); g.addColorStop(1, 'rgba(47,90,80,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-16, y + 5); ctx.quadraticCurveTo(0, y - 1.4, 16, y + 5); ctx.lineTo(16, y + 2.4); ctx.quadraticCurveTo(0, y - 4, -16, y + 2.4); ctx.closePath(); ctx.fill();
      line(ctx, [[-16, y + 5], [0, y + 3.6], [16, y + 5]], 'rgba(0,0,0,0.55)', 0.8);
    }
    ctx.restore();
    line(ctx, [[0, -38], [0, 18]], 'rgba(10,6,4,0.7)', 1);
    inkOutline(ctx, rp, 1.6, PAL.ink, 105);
    // 车厢面板线与铆钉
    groove(ctx, [[-19, 24], [-8, 30], [8, 30], [19, 24]], 0.9);
    groove(ctx, [[-20, -24], [-14, -24]], 0.8);
    groove(ctx, [[20, -24], [14, -24]], 0.8);
    dots(ctx, [[-19, -14], [19, -14], [-19, 4], [19, 4], [-15, 38], [15, 38], [-19, -32], [19, -32]], 1, '#c9a26a');
    // 腹舱口（炸弹舱，铁栅）
    plate(ctx, [[-8, 20], [8, 20], [7, 33], [-7, 33]], { light: '#6a6e76', base: PAL.iron, dark: PAL.iron2, edgeW: 1.6, seed: 106 });
    for (let x = -5; x <= 5; x += 2.5) line(ctx, [[x, 22], [x, 31.6]], 'rgba(0,0,0,0.7)', 0.8);
    neonSeamDraw(ctx, [[-6, 32.6], [6, 32.6]], M, 0.7);
    // 前端龙首撞角（朝下）
    plate(ctx, [[-6, 48], [6, 48], [4, 58], [0, 61], [-4, 58]], { light: '#c4a274', base: PAL.bronze, dark: PAL.bronze2, smooth: true, edgeW: 1.9, seed: 107 });
    for (const sg of [-1, 1]) {
      // 机炮
      plate(ctx, [[sg * 18 - 3.6, 26], [sg * 18 + 3.6, 26], [sg * 18 + 3.6, 44], [sg * 18 - 3.6, 44]], { light: '#7a7f88', base: PAL.iron, dark: PAL.iron2, edgeW: 1.6, seed: 108 + sg, wear: 'rgba(210,200,180,0.4)', wearN: 6 });
      plate(ctx, [[sg * 18 - 4.6, 41], [sg * 18 + 4.6, 41], [sg * 18 + 3.6, 46.4], [sg * 18 - 3.6, 46.4]], { light: '#7fb3a3', base: PAL.verdigris2, dark: '#1b3a33', edgeW: 1.4, seed: 110 + sg });
      // 舷侧霓虹条
      neonSeamDraw(ctx, [[sg * 21.6, -22], [sg * 22, -10]], NEON, 0.8);
    }
    // 座舱窗（车前）
    const win = pathFrom([[-6, 8], [6, 8], [4.6, 16], [-4.6, 16]], true, true);
    ctx.fillStyle = '#062a30'; ctx.fill(win);
    inkOutline(ctx, win, 1.2, PAL.ink, 112);
    neonSeamDraw(ctx, [[-3.6, 12], [3.6, 12]], NEON, 1);
    // 尾灯座
    orb(ctx, 0, -46, 3.2, '#ffd0ef', '#a01a78', '#2a0620');
  },
  glow(ctx) {
    for (const sg of [-1, 1]) {
      glowDot(ctx, sg * CH_WX, CH_WY, 5, M, 0.3);
      neonLine(ctx, [[sg * 21.6, -22], [sg * 22, -10]], NEON, 1);
      glowDot(ctx, sg * 18, 46.4, 3.6, M, 0.3);
    }
    neonLine(ctx, [[-6, 32.6], [6, 32.6]], M, 0.9);
    neonLine(ctx, [[-3.6, 12], [3.6, 12]], NEON, 1.1);
    glowDot(ctx, 0, -46, 4.5, M, 0.3);
  },
};


// ================= 纸龙 =================
const BAMBOO_L = '#e0c48a', BAMBOO = '#b8965c', BAMBOO_D = '#6b5230';
const AMBER = PAL.neonAmber;

function bambooStroke(ctx: CanvasRenderingContext2D, pts: Pt[], w0: number, w1: number, seed: number): void {
  brushStroke(ctx, pts, w0 + 1.6, w1 + 1, PAL.ink, { seed, jitter: 0.06, belly: 0.1 });
  brushStroke(ctx, pts, w0, w1, BAMBOO, { seed: seed + 1, jitter: 0.04, belly: 0.1 });
  brushStroke(ctx, pts.map(([x, y]) => [x - 0.5, y - 0.5] as Pt), w0 * 0.3, w1 * 0.3, BAMBOO_L, { seed: seed + 2, jitter: 0.05, belly: 0.1 });
}

const serpentHead: SpriteDef = {
  id: 'm_serpent_head', w: 120, h: 120, radius: 30, anchors: { mouth: [0, 50], neck: [0, -50], eyeL: [-14, 5], eyeR: [14, 5] },
  draw(ctx) {
    // 龙角（竹骨）
    for (const sg of [-1, 1]) {
      ctx.save(); ctx.scale(sg, 1);
      bambooStroke(ctx, [[-14, -10], [-24, -26], [-36, -38], [-50, -50]], 7, 2.4, 3);
      bambooStroke(ctx, [[-30, -32], [-42, -30], [-54, -34]], 4, 1.6, 6);
      bambooStroke(ctx, [[-22, -22], [-30, -12], [-40, -6]], 3.4, 1.4, 9);
      // 竹节
      for (const [x, y] of [[-22, -24], [-32, -35], [-42, -43]] as Pt[]) line(ctx, [[x - 2.4, y + 2], [x + 2.2, y - 2.2]], PAL.ink, 1);
      ctx.restore();
    }
    // 鬃毛（纸火焰）
    for (const sg of [-1, 1]) {
      ctx.save(); ctx.scale(sg, 1);
      const tufts: [Pt, Pt, Pt][] = [
        [[-22, -34], [-38, -24], [-50, -16]], [[-28, -22], [-42, -8], [-56, 0]], [[-30, -8], [-44, 8], [-55, 20]], [[-28, 8], [-40, 22], [-48, 34]],
      ];
      tufts.forEach(([a, b, c], i) => {
        const tp = pathFrom([a, [b[0] - 2, b[1] - 8], c, [b[0] + 4, b[1] + 6], [a[0] + 4, a[1] + 8]], true, true);
        litFill(ctx, tp, bboxOf([a, b, c]), '#fbf3df', PAL.paper2, PAL.paper3, { seed: 20 + i, blots: 1, blotColor: 'rgba(90,70,40,0.15)' });
        inkOutline(ctx, tp, 1.1, PAL.ink, 30 + i);
        brushStroke(ctx, [a, b, c], 1.6, 0.4, PAL.cinnabar2, { seed: 40 + i, jitter: 0.1 });
      });
      ctx.restore();
    }
    // 长须
    for (const sg of [-1, 1]) {
      brushStroke(ctx, [[sg * 10, 34], [sg * 26, 44], [sg * 44, 42], [sg * 56, 54]], 4, 0.8, PAL.ink, { seed: 50, dry: 0.4, jitter: 0.1 });
      brushStroke(ctx, [[sg * 9, 30], [sg * 22, 30], [sg * 36, 22], [sg * 52, 26]], 3, 0.6, PAL.ink2, { seed: 51, dry: 0.4, jitter: 0.1 });
    }
    // 下颚
    const jaw: Pt[] = [[-13, 36], [-15, 46], [-10, 56], [-4, 59], [4, 59], [10, 56], [15, 46], [13, 36]];
    plate(ctx, jaw, { light: '#b39264', base: '#86694a', dark: PAL.bronze2, smooth: true, edgeW: 1.9, seed: 60 });
    // 口腔
    const mouth = pathFrom([[-10, 38], [10, 38], [8, 50], [0, 54], [-8, 50]], true, true);
    const mg = ctx.createRadialGradient(0, 44, 1, 0, 46, 12);
    mg.addColorStop(0, '#7a2ac0'); mg.addColorStop(1, '#180828');
    ctx.fillStyle = mg; ctx.fill(mouth);
    inkOutline(ctx, mouth, 1.2, PAL.ink, 61);
    // 下牙
    for (const sg of [-1, 1]) for (let i = 0; i < 2; i++) {
      const y = 44 + i * 5; ctx.fillStyle = PAL.paper; ctx.beginPath(); ctx.moveTo(sg * (9.4 - i * 1.4), y); ctx.lineTo(sg * (6.4 - i * 1.2), y - 2); ctx.lineTo(sg * (7.8 - i * 1.2), y + 3.4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.6; ctx.stroke();
    }
    // 颅：纸面主体
    const skull: Pt[] = symmetric([[-6, -48], [-16, -46], [-27, -36], [-32, -20], [-33, -2], [-29, 14], [-22, 28], [-14, 38], [-8, 42]]);
    const sp = pathFrom(skull, true, true);
    ctx.save(); ctx.translate(1.4, 2.2); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fill(sp); ctx.restore();
    litFill(ctx, sp, bboxOf(skull), '#fffaf0', PAL.paper, PAL.paper3, { seed: 62, blots: 4, blotColor: 'rgba(90,70,40,0.16)', wear: 'rgba(120,100,70,0.55)', wearN: 26 });
    ctx.save(); ctx.clip(sp);
    // 折面：额顶两侧暗面
    ctx.fillStyle = 'rgba(70,50,30,0.16)';
    ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(33, -2); ctx.lineTo(29, 14); ctx.lineTo(0, 30); ctx.closePath(); ctx.fill();
    // 竹骨脊线
    for (const [a, b, c] of [[[0, -48], [0, -20], [0, 8]], [[-12, -40], [-18, -14], [-14, 14]], [[12, -40], [18, -14], [14, 14]]] as [Pt, Pt, Pt][]) {
      brushStroke(ctx, [a, b, c], 3.4, 1.6, BAMBOO_D, { seed: 70, jitter: 0.06 });
      brushStroke(ctx, [[a[0] - 0.5, a[1]], [b[0] - 0.5, b[1]], [c[0] - 0.5, c[1]]], 1.2, 0.6, BAMBOO_L, { seed: 71, jitter: 0.05 });
    }
    // 水墨斑
    brushStroke(ctx, [[-26, -10], [-20, 2], [-24, 14]], 3, 1, 'rgba(42,36,31,0.6)', { seed: 72, dry: 0.5 });
    brushStroke(ctx, [[26, -18], [22, -6], [26, 6]], 3, 1, 'rgba(42,36,31,0.6)', { seed: 73, dry: 0.5 });
    ctx.restore();
    bevel(ctx, sp, 'rgba(255,255,255,0.7)', 'rgba(60,40,20,0.35)', 1.2, 2);
    inkOutline(ctx, sp, 2.2, PAL.ink, 63);
    // 额上朱印
    const dia = pathFrom([[0, -32], [4, -26], [0, -20], [-4, -26]], true);
    ctx.fillStyle = PAL.cinnabar; ctx.fill(dia); inkOutline(ctx, dia, 0.9, PAL.ink, 64);
    // 眉板（铜）与眼
    for (const sg of [-1, 1]) {
      ctx.save(); ctx.scale(sg, 1);
      plate(ctx, [[-22, -2], [-6, -6], [-4, 0], [-9, 5], [-22, 4]], { light: '#c4a274', base: '#86694a', dark: PAL.bronze2, edgeW: 1.6, seed: 65, wear: 'rgba(240,215,170,0.5)', wearN: 8 });
      const eye = pathFrom([[-19, 3.4], [-10, -1.2], [-6.4, 2.4], [-14, 6.2]], true, true);
      ctx.fillStyle = '#301604'; ctx.fill(eye);
      ctx.fillStyle = AMBER; ctx.beginPath(); ctx.moveTo(-16.6, 3.4); ctx.lineTo(-10.6, 0.4); ctx.lineTo(-8.6, 2.6); ctx.lineTo(-13.6, 4.8); ctx.closePath(); ctx.fill();
      inkOutline(ctx, eye, 1.1, PAL.ink, 66);
      dots(ctx, [[-19, -1.2], [-12, -4.2]], 0.8, '#d9b078');
      // 颊甲
      plate(ctx, [[-30, 14], [-19, 12], [-15, 24], [-24, 30]], { light: '#7fb3a3', base: PAL.verdigris, dark: PAL.verdigris2, edgeW: 1.5, seed: 67, wear: 'rgba(230,240,220,0.4)', wearN: 8 });
      groove(ctx, [[-27, 16], [-20, 22]], 0.7);
      ctx.restore();
    }
    // 吻部：铜鼻与上颚
    plate(ctx, [[-9, 24], [9, 24], [11, 34], [8, 42], [-8, 42], [-11, 34]], { light: '#c4a274', base: '#86694a', dark: PAL.bronze2, smooth: true, edgeW: 1.8, seed: 68, wear: 'rgba(240,215,170,0.5)', wearN: 8 });
    for (const sg of [-1, 1]) {
      ctx.fillStyle = '#062a30'; ctx.beginPath(); ctx.ellipse(sg * 4.4, 32, 1.5, 2.2, sg * 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = M; ctx.beginPath(); ctx.ellipse(sg * 4.4, 32.4, 0.8, 1.4, sg * 0.3, 0, 7); ctx.fill();
      // 上牙（獠牙）
      ctx.fillStyle = PAL.paper; ctx.beginPath(); ctx.moveTo(sg * 9, 40); ctx.lineTo(sg * 4, 41); ctx.lineTo(sg * 6.6, 50); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.8; ctx.stroke();
      line(ctx, [[sg * 7.4, 41.6], [sg * 6.6, 47]], 'rgba(150,130,100,0.7)', 0.6);
    }
    groove(ctx, [[-8, 36], [0, 39], [8, 36]], 0.8);
    // 脊灯（额顶到鼻梁）
    neonSeamDraw(ctx, [[0, -44], [0, -36]], M, 0.9);
    neonSeamDraw(ctx, [[0, -16], [0, 6]], M, 0.9);
    dots(ctx, [[-1.6, 12], [1.6, 12]], 0.7, '#d9b078');
  },
  glow(ctx) {
    for (const sg of [-1, 1]) {
      ctx.save(); ctx.scale(sg, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = AMBER; ctx.beginPath(); ctx.moveTo(-16.6, 3.4); ctx.lineTo(-10.6, 0.4); ctx.lineTo(-8.6, 2.6); ctx.lineTo(-13.6, 4.8); ctx.closePath(); ctx.fill();
      ctx.restore();
      glowDot(ctx, sg * 12.6, 3, 5, AMBER, 0.25);
      glowDot(ctx, sg * 4.4, 32.4, 2.6, M, 0.35);
    }
    neonLine(ctx, [[0, -44], [0, -36]], M, 1);
    neonLine(ctx, [[0, -16], [0, 6]], M, 1);
    glowDot(ctx, 0, 46, 10, PAL.neonViolet, 0.2);
  },
};

const serpentSeg: SpriteDef = {
  id: 'm_serpent_seg', w: 76, h: 76, radius: 26, anchors: { front: [0, 30], back: [0, -30] },
  draw(ctx) {
    // 侧鳍（纸羽）
    for (const sg of [-1, 1]) {
      ctx.save(); ctx.scale(sg, 1);
      const fin = pathFrom([[-22, -8], [-34, -14], [-37, -4], [-33, 6], [-36, 14], [-22, 12]], true, true);
      litFill(ctx, fin, [-37, -14, 15, 28], '#fffaf0', PAL.paper2, PAL.paper3, { seed: 80, blots: 1 });
      inkOutline(ctx, fin, 1.4, PAL.ink, 81);
      line(ctx, [[-24, 0], [-35, -6]], 'rgba(60,44,28,0.6)', 0.7); line(ctx, [[-24, 3], [-34, 6]], 'rgba(60,44,28,0.6)', 0.7);
      brushStroke(ctx, [[-30, -12], [-35, -4], [-31, 6]], 2.4, 0.8, PAL.cinnabar2, { seed: 82, jitter: 0.1 });
      ctx.restore();
    }
    // 身节：纸灯笼般的鼓形
    const body = ellipsePath(0, 0, 26, 30);
    ctx.save(); ctx.translate(1.6, 2.6); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fill(body); ctx.restore();
    litFill(ctx, body, [-26, -30, 52, 60], '#fffaf0', PAL.paper, PAL.paper3, { seed: 83, blots: 4, blotColor: 'rgba(90,70,40,0.16)', wear: 'rgba(120,100,70,0.55)', wearN: 24 });
    ctx.save(); ctx.clip(body);
    // 纵向纸褶
    for (let i = -4; i <= 4; i++) {
      const x = i * 5.6;
      line(ctx, [[x, -30], [x * 1.08, 0], [x, 30]], 'rgba(70,50,30,0.32)', 0.8);
      line(ctx, [[x + 0.9, -30], [x * 1.08 + 0.9, 0], [x + 0.9, 30]], 'rgba(255,255,255,0.35)', 0.6);
    }
    ctx.fillStyle = 'rgba(60,40,20,0.16)'; ctx.beginPath(); ctx.moveTo(4, -32); ctx.lineTo(30, -30); ctx.lineTo(30, 32); ctx.lineTo(-6, 32); ctx.closePath(); ctx.fill();
    // 水墨鳞点
    brushStroke(ctx, [[-20, -16], [-14, -8], [-18, 2]], 3.2, 1, 'rgba(42,36,31,0.55)', { seed: 84, dry: 0.5 });
    brushStroke(ctx, [[18, 10], [14, 18], [20, 24]], 3.2, 1, 'rgba(42,36,31,0.55)', { seed: 85, dry: 0.5 });
    ctx.restore();
    bevel(ctx, body, 'rgba(255,255,255,0.7)', 'rgba(60,40,20,0.35)', 1.2, 2);
    inkOutline(ctx, body, 2, PAL.ink, 86);
    // 前后铜环
    for (const y of [-25, 25]) {
      const ring = pathFrom([[-19, y - 3.4], [19, y - 3.4], [20, y + 3.4], [-20, y + 3.4]], true, false);
      litFill(ctx, ring, [-20, y - 3.4, 40, 7], '#c4a274', '#86694a', PAL.bronze2, { seed: 87, blots: 0 });
      inkOutline(ctx, ring, 1.4, PAL.ink, 88);
      dots(ctx, [[-13, y], [0, y], [13, y]], 0.8, '#e0c48a');
    }
    // 背甲：铜六边 + 脊灯
    plate(ctx, hexPts(0, 0, 10), { light: '#c4a274', base: '#86694a', dark: PAL.bronze2, edgeW: 1.7, seed: 89, wear: 'rgba(240,215,170,0.5)', wearN: 8 });
    const lamp = ellipsePath(0, 0, 4.6, 5.4);
    ctx.fillStyle = '#2a0620'; ctx.fill(lamp);
    orb(ctx, 0, 0, 3.4, '#ffd0ef', '#a01a78', '#2a0620');
    neonSeamDraw(ctx, [[0, -17], [0, -12]], M, 0.8);
    neonSeamDraw(ctx, [[0, 12], [0, 17]], M, 0.8);
  },
  glow(ctx) {
    glowDot(ctx, 0, 0, 8, M, 0.22);
    neonLine(ctx, [[0, -17], [0, -12]], M, 0.9);
    neonLine(ctx, [[0, 12], [0, 17]], M, 0.9);
  },
};

const serpentTail: SpriteDef = {
  id: 'm_serpent_tail', w: 70, h: 90, radius: 20, anchors: { front: [0, 40], tip: [0, -42] },
  draw(ctx) {
    // 尾鳍（纸火焰羽，顶端）
    for (const [sg, ang] of [[-1, 0], [1, 0]] as [number, number][]) {
      void ang;
      ctx.save(); ctx.scale(sg, 1);
      const f = pathFrom([[-1, -14], [-10, -26], [-22, -36], [-30, -44], [-18, -40], [-6, -44], [-1, -34]], true, true);
      litFill(ctx, f, [-30, -44, 30, 30], '#fffaf0', PAL.paper2, PAL.paper3, { seed: 90, blots: 1 });
      inkOutline(ctx, f, 1.6, PAL.ink, 91);
      line(ctx, [[-2, -18], [-20, -38]], 'rgba(60,44,28,0.6)', 0.7);
      line(ctx, [[-2, -22], [-10, -40]], 'rgba(60,44,28,0.5)', 0.6);
      brushStroke(ctx, [[-8, -24], [-20, -36], [-28, -43]], 3, 0.6, PAL.cinnabar2, { seed: 92, jitter: 0.1 });
      ctx.restore();
    }
    // 中央尖羽
    const tip = pathFrom([[-4, -18], [0, -44], [4, -18]], true, true);
    litFill(ctx, tip, [-4, -44, 8, 26], PAL.paper, PAL.paper2, PAL.paper3, { seed: 93, blots: 0 });
    inkOutline(ctx, tip, 1.4, PAL.ink, 94);
    // 尾身：向上渐细
    const pts: Pt[] = symmetric([[-5, -20], [-9, -8], [-14, 6], [-20, 22], [-24, 34], [-22, 42]]);
    const bp = pathFrom(pts, true, true);
    ctx.save(); ctx.translate(1.4, 2.2); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fill(bp); ctx.restore();
    litFill(ctx, bp, bboxOf(pts), '#fffaf0', PAL.paper, PAL.paper3, { seed: 95, blots: 3, blotColor: 'rgba(90,70,40,0.16)', wear: 'rgba(120,100,70,0.55)', wearN: 18 });
    ctx.save(); ctx.clip(bp);
    for (let i = -3; i <= 3; i++) line(ctx, [[i * 1.6, -20], [i * 4.6, 6], [i * 6, 42]], 'rgba(70,50,30,0.3)', 0.8);
    ctx.fillStyle = 'rgba(60,40,20,0.16)'; ctx.beginPath(); ctx.moveTo(2, -22); ctx.lineTo(26, 40); ctx.lineTo(0, 44); ctx.closePath(); ctx.fill();
    ctx.restore();
    bevel(ctx, bp, 'rgba(255,255,255,0.7)', 'rgba(60,40,20,0.35)', 1.1, 1.8);
    inkOutline(ctx, bp, 2, PAL.ink, 96);
    // 铜环节
    for (const [y, hw] of [[34, 22], [16, 17], [0, 12.6], [-14, 8]] as [number, number][]) {
      const ring = pathFrom([[-hw, y - 2.4], [hw, y - 2.4], [hw + 0.6, y + 2.4], [-hw - 0.6, y + 2.4]], true, false);
      litFill(ctx, ring, [-hw, y - 2.4, hw * 2, 5], '#c4a274', '#86694a', PAL.bronze2, { seed: 97, blots: 0 });
      inkOutline(ctx, ring, 1.2, PAL.ink, 98);
    }
    // 脊灯
    orb(ctx, 0, 24, 3, '#ffd0ef', '#a01a78', '#2a0620');
    neonSeamDraw(ctx, [[0, 6], [0, 10]], M, 0.8);
    neonSeamDraw(ctx, [[0, -12], [0, -7]], M, 0.8);
  },
  glow(ctx) {
    glowDot(ctx, 0, 24, 6, M, 0.25);
    neonLine(ctx, [[0, 6], [0, 10]], M, 0.9);
    neonLine(ctx, [[0, -12], [0, -7]], M, 0.9);
  },
};

// 仅预览：纸龙整体拼装
const serpentPreview: SpriteDef = {
  id: 'preview_serpent_chain', w: 130, h: 360,
  draw(ctx, f) {
    ctx.save(); ctx.translate(0, 27);
    for (const [d, x, y] of [[serpentTail, 0, 100], [serpentSeg, 0, 46], [serpentSeg, 0, -2], [serpentSeg, 0, -50], [serpentHead, 0, -140]] as [SpriteDef, number, number][]) {
      ctx.save(); ctx.translate(x, y); d.draw?.(ctx, f); ctx.restore();
    }
    ctx.restore();
  },
  glow(ctx, f) {
    ctx.save(); ctx.translate(0, 27);
    for (const [d, x, y] of [[serpentTail, 0, 100], [serpentSeg, 0, 46], [serpentSeg, 0, -2], [serpentSeg, 0, -50], [serpentHead, 0, -140]] as [SpriteDef, number, number][]) {
      ctx.save(); ctx.translate(x, y); d.glow!(ctx, f); ctx.restore();
    }
    ctx.restore();
  },
};


// ================= Boss 铜雀 =================
const CU_L = '#c99f68', CU = '#8c6a44', CU_D = PAL.bronze2;
const VD_L = '#86c0ae';

interface FeatherGeom { pts: Pt[]; a: Pt; b: Pt }
function featherGeom(x0: number, y0: number, x1: number, y1: number, w: number): FeatherGeom {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const P = (a: number, b: number): Pt => [x0 + ux * L * a + nx * w * b, y0 + uy * L * a + ny * w * b];
  const pts = [P(0, -0.3), P(0.3, -0.46), P(0.62, -0.5), P(0.86, -0.36), P(1, 0), P(0.86, 0.36), P(0.62, 0.5), P(0.3, 0.46), P(0, 0.3)];
  return { pts, a: [x0, y0], b: [x1, y1] };
}
function cFeather(
  ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, seed: number,
  o: { neon?: string; tint?: string; light?: string; base?: string; dark?: string; eye?: boolean } = {},
): void {
  const g = featherGeom(x0, y0, x1, y1, w);
  const p = plate(ctx, g.pts, { light: o.light ?? CU_L, base: o.base ?? CU, dark: o.dark ?? CU_D, smooth: true, edgeW: 1.8, seed, wear: 'rgba(245,220,170,0.5)', wearN: 8, blots: 1 });
  const dx = x1 - x0, dy = y1 - y0;
  // 尖端铜绿
  ctx.save(); ctx.clip(p);
  const tg = ctx.createLinearGradient(x0 + dx * 0.5, y0 + dy * 0.5, x1, y1);
  tg.addColorStop(0, 'rgba(79,133,119,0)'); tg.addColorStop(1, o.tint ?? 'rgba(79,133,119,0.85)');
  ctx.fillStyle = tg; ctx.fillRect(Math.min(x0, x1) - w, Math.min(y0, y1) - w, Math.abs(dx) + w * 2, Math.abs(dy) + w * 2);
  ctx.restore();
  // 羽轴与羽枝
  line(ctx, [[x0 + dx * 0.05, y0 + dy * 0.05], [x0 + dx * 0.95, y0 + dy * 0.95]], 'rgba(20,12,6,0.65)', 1.2);
  line(ctx, [[x0 + dx * 0.05 - 0.6, y0 + dy * 0.05 - 0.6], [x0 + dx * 0.95 - 0.6, y0 + dy * 0.95 - 0.6]], 'rgba(255,235,190,0.55)', 0.6);
  const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  ctx.save(); ctx.clip(p);
  for (let k = 1; k < 9; k++) {
    const t = 0.1 + k * 0.1, bx = x0 + dx * t, by = y0 + dy * t;
    for (const sg of [-1, 1]) line(ctx, [[bx, by], [bx + (ux * 0.7 + nx * sg) * w * 0.45, by + (uy * 0.7 + ny * sg) * w * 0.45]], 'rgba(20,12,6,0.28)', 0.6);
  }
  ctx.restore();
  if (o.neon) neonSeamDraw(ctx, [[x0 + dx * 0.4, y0 + dy * 0.4], [x0 + dx * 0.82, y0 + dy * 0.82]], o.neon, 0.9);
  if (o.eye) {
    const ex = x0 + dx * 0.8, ey = y0 + dy * 0.8, r = w * 0.3;
    ctx.fillStyle = '#0d0618'; ctx.beginPath(); ctx.arc(ex, ey, r + 1.2, 0, 7); ctx.fill();
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ex, ey, r + 0.6, 0, 7); ctx.stroke();
    orb(ctx, ex, ey, r * 0.6, '#d8b0ff', '#5a1aa8', '#0d0618');
  }
}

// ---- 机身 220x300 ----
const BODY_SH: Pt = [-54, -30];
const CORE_P: Pt = [0, 48];
const TAIL_P: Pt = [0, -112];
const HEAD_C = 120;

function sparrowBodyDraw(ctx: CanvasRenderingContext2D): void {
  // 头冠羽（躲在躯干后）
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.scale(sg, 1);
    cFeather(ctx, -14, 100, -50, 84, 14, 210, { tint: 'rgba(79,133,119,0.6)' });
    cFeather(ctx, -14, 106, -56, 100, 13, 211, { tint: 'rgba(79,133,119,0.6)' });
    ctx.restore();
  }
  // 头
  const headL: Pt[] = [[-8, 88], [-26, 92], [-38, 106], [-40, 122], [-33, 136], [-17, 145], [-6, 148]];
  const hp = plate(ctx, symmetric(headL), { light: CU_L, base: CU, dark: CU_D, smooth: true, edgeW: 2.4, seed: 220, wear: 'rgba(245,220,170,0.5)', wearN: 24, blots: 6, mid: 0.45 });
  ctx.save(); ctx.clip(hp);
  // 面部铜绿覆板
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.scale(sg, 1);
    const cheek = pathFrom([[-30, 104], [-16, 100], [-10, 118], [-16, 132], [-28, 128]], true, true);
    litFill(ctx, cheek, [-30, 100, 20, 32], VD_L, PAL.verdigris, PAL.verdigris2, { seed: 221, blots: 2, wear: 'rgba(220,240,220,0.4)', wearN: 8 });
    inkOutline(ctx, cheek, 1.6, PAL.ink, 222);
    dots(ctx, [[-25, 108], [-16, 110], [-19, 126]], 0.9, '#d9b078');
    ctx.restore();
  }
  ctx.restore();
  bevel(ctx, hp, 'rgba(255,240,205,0.5)', 'rgba(0,0,0,0.5)', 1.3, 2.2);
  // 额线与鼻梁装甲
  groove(ctx, [[-20, 98], [-6, 106], [6, 106], [20, 98]], 1);
  plate(ctx, [[-5, 96], [5, 96], [4, 114], [0, 118], [-4, 114]], { light: '#7a7f88', base: PAL.iron, dark: PAL.iron2, smooth: false, edgeW: 1.5, seed: 223 });
  // 眼
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.scale(sg, 1);
    const socket = pathFrom([[-25, 108], [-11, 105], [-8, 114], [-17, 120], [-25, 117]], true, true);
    ctx.fillStyle = '#1a0512'; ctx.fill(socket);
    inkOutline(ctx, socket, 1.8, PAL.ink, 224);
    const eye = pathFrom([[-22, 113], [-11, 108.6], [-9.4, 112.6], [-18, 117]], true, true);
    const eg = ctx.createLinearGradient(-22, 108, -9, 117);
    eg.addColorStop(0, '#ffd0ef'); eg.addColorStop(1, '#c0187e');
    ctx.fillStyle = eg; ctx.fill(eye);
    // 眉甲
    plate(ctx, [[-27, 103], [-9, 99], [-7, 104], [-24, 108]], { light: '#c99f68', base: CU, dark: CU_D, edgeW: 1.4, seed: 225 });
    ctx.restore();
  }
  // 喙（朝下）
  const beak = pathFrom([[-13, 124], [13, 124], [10, 137], [4, 146], [0, 150], [-4, 146], [-10, 137]], true, true);
  ctx.save(); ctx.translate(1.2, 2); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fill(beak); ctx.restore();
  litFill(ctx, beak, [-13, 124, 26, 26], '#f2d493', PAL.gold, PAL.gold3, { seed: 226, blots: 2, wear: 'rgba(255,245,210,0.6)', wearN: 8 });
  bevel(ctx, beak, 'rgba(255,250,225,0.7)', 'rgba(60,30,4,0.6)', 1, 1.6);
  inkOutline(ctx, beak, 2, PAL.ink, 227);
  line(ctx, [[0, 126], [0, 146]], 'rgba(60,30,4,0.7)', 1);
  for (const sg of [-1, 1]) { ctx.fillStyle = '#1a0512'; ctx.beginPath(); ctx.ellipse(sg * 3.6, 130, 1.1, 1.8, sg * 0.2, 0, 7); ctx.fill(); }
  dots(ctx, [[-8, 130], [8, 130]], 0.8, '#7a5418');

  // 颈环
  for (const [y, hw, h] of [[90, 30, 7], [82, 34, 6]] as [number, number, number][]) {
    plate(ctx, [[-hw, y - h / 2], [hw, y - h / 2], [hw + 2, y + h / 2], [-hw - 2, y + h / 2]], { light: VD_L, base: PAL.verdigris, dark: PAL.verdigris2, edgeW: 1.7, seed: 230 + y, wear: 'rgba(230,245,225,0.4)', wearN: 10 });
    dots(ctx, [[-hw + 5, y], [0, y], [hw - 5, y]], 0.9, '#d9b078');
  }

  // 躯干
  const torsoL: Pt[] = [[-10, -118], [-30, -113], [-50, -98], [-64, -74], [-72, -42], [-73, -8], [-67, 26], [-57, 54], [-46, 76], [-32, 88], [-14, 93]];
  const tp = pathFrom(symmetric(torsoL), true, true);
  ctx.save(); ctx.translate(2.4, 3.6); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fill(tp); ctx.restore();
  const tb = bboxOf(symmetric(torsoL));
  litFill(ctx, tp, tb, '#d3a870', '#8c6a44', '#3a2a1a', { seed: 240, blots: 10, blotColor: 'rgba(79,133,119,0.22)', mid: 0.42 });
  ctx.save(); ctx.clip(tp);
  // 羽鳞
  for (let row = 0; row < 15; row++) {
    const y = -108 + row * 13.4;
    for (let x = -80 + (row % 2) * 8; x < 84; x += 16) {
      const lightness = 1 - Math.min(1, Math.max(0, ((x + 80) / 160 + (y + 110) / 210) / 2));
      const c0 = lightness > 0.6 ? '#c99f68' : lightness > 0.35 ? '#9a7550' : '#5f4630';
      const c1 = lightness > 0.6 ? '#8c6a44' : lightness > 0.35 ? '#6b5236' : '#3a2a1a';
      const sc = pathFrom([[x - 8, y - 3], [x + 8, y - 3], [x + 7.4, y + 6], [x, y + 11.6], [x - 7.4, y + 6]], true, true);
      const gg = ctx.createLinearGradient(x - 8, y - 3, x + 6, y + 11);
      gg.addColorStop(0, c0); gg.addColorStop(1, c1);
      ctx.fillStyle = gg; ctx.fill(sc);
      ctx.strokeStyle = 'rgba(14,8,4,0.8)'; ctx.lineWidth = 1; ctx.stroke(sc);
      ctx.strokeStyle = 'rgba(255,235,190,0.28)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x - 6.6, y - 1.2); ctx.quadraticCurveTo(x - 6.4, y + 5, x - 0.6, y + 9.4); ctx.stroke();
      if ((row * 3 + Math.round(x / 16)) % 7 === 0) { ctx.fillStyle = 'rgba(79,133,119,0.5)'; ctx.fill(sc); }
    }
  }
  // 整体右下暗部
  const sh = ctx.createLinearGradient(-60, -100, 70, 80);
  sh.addColorStop(0, 'rgba(255,240,200,0.12)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = sh; ctx.fillRect(-80, -120, 160, 220);
  ctx.restore();
  bevel(ctx, tp, 'rgba(255,240,205,0.45)', 'rgba(0,0,0,0.55)', 1.6, 2.8);
  inkOutline(ctx, tp, 3, PAL.ink, 241);

  // 脊甲：叠片铁脊
  for (let i = 0; i < 9; i++) {
    const y = -112 + i * 13.4, hw = 9.4 - Math.abs(i - 4) * 0.3 + (i > 5 ? -1 : 0);
    plate(ctx, [[-hw, y], [hw, y], [hw + 1, y + 12], [0, y + 15.4], [-hw - 1, y + 12]], { light: '#8a8f96', base: PAL.iron, dark: PAL.iron2, edgeW: 1.5, seed: 250 + i, wear: 'rgba(210,200,180,0.4)', wearN: 6 });
    line(ctx, [[-hw * 0.6, y + 3], [hw * 0.6, y + 3]], 'rgba(255,255,255,0.18)', 0.7);
  }
  neonSeamDraw(ctx, [[0, -108], [0, -98]], PAL.neonMagenta, 0.9);
  neonSeamDraw(ctx, [[0, -80], [0, -70]], PAL.neonMagenta, 0.9);
  neonSeamDraw(ctx, [[0, -52], [0, -42]], PAL.neonMagenta, 0.9);

  // 肩窝（翼根挂点）
  for (const sg of [-1, 1]) {
    const sx = sg * 54, sy = -30;
    const ring = ellipsePath(sx, sy, 22, 22);
    ctx.save(); ctx.translate(1.4, 2.2); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.fill(ring); ctx.restore();
    litFill(ctx, ring, [sx - 22, sy - 22, 44, 44], '#c99f68', CU, CU_D, { seed: 260, blots: 2, wear: 'rgba(245,220,170,0.5)', wearN: 8 });
    bevel(ctx, ring, 'rgba(255,240,205,0.6)', 'rgba(0,0,0,0.5)', 1, 2);
    inkOutline(ctx, ring, 2.2, PAL.ink, 261);
    const inner = ellipsePath(sx, sy, 10, 10);
    litFill(ctx, inner, [sx - 10, sy - 10, 20, 20], VD_L, PAL.verdigris, PAL.verdigris2, { seed: 442, blots: 0 });
    inkOutline(ctx, inner, 1.6, PAL.ink, 262);
    dots(ctx, [[sx, sy]], 3.2, '#d9b078');
    dots(ctx, Array.from({ length: 8 }, (_, i) => [sx + Math.cos(i * Math.PI / 4 + 0.3) * 18.4, sy + Math.sin(i * Math.PI / 4 + 0.3) * 18.4] as Pt), 1.1, '#d9b078');
  }
  // 尾座（尾羽挂点）
  const tail = plate(ctx, [[-24, -122], [24, -122], [20, -102], [0, -96], [-20, -102]], { light: '#7a7f88', base: PAL.iron, dark: PAL.iron2, smooth: false, edgeW: 2, seed: 270, wear: 'rgba(210,200,180,0.4)', wearN: 12 });
  void tail;
  dots(ctx, [[-16, -113], [16, -113], [0, -108]], 1.2, '#d9b078');
  groove(ctx, [[-18, -104], [0, -99], [18, -104]], 0.9);

  // 胸口核心座：铜绿八角凹槽
  const rc = Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return [CORE_P[0] + Math.cos(a) * 44, CORE_P[1] + Math.sin(a) * 44] as Pt; });
  plate(ctx, rc, { light: '#86c0ae', base: PAL.verdigris2, dark: '#14261f', edgeW: 2.6, seed: 280, wear: 'rgba(210,240,225,0.4)', wearN: 20 });
  const bowl = ellipsePath(CORE_P[0], CORE_P[1], 37, 37);
  const bg = ctx.createRadialGradient(CORE_P[0] - 8, CORE_P[1] - 8, 4, CORE_P[0], CORE_P[1], 38);
  bg.addColorStop(0, '#2a1f30'); bg.addColorStop(1, '#0a0510');
  ctx.fillStyle = bg; ctx.fill(bowl);
  inkOutline(ctx, bowl, 2.4, PAL.ink, 281);
  dots(ctx, rc.map(([x, y]) => [CORE_P[0] + (x - CORE_P[0]) * 0.92, CORE_P[1] + (y - CORE_P[1]) * 0.92] as Pt), 1.5, '#d9b078');
}

function sparrowBodyGlow(ctx: CanvasRenderingContext2D): void {
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.scale(sg, 1);
    ctx.globalCompositeOperation = 'lighter';
    const eye = pathFrom([[-22, 113], [-11, 108.6], [-9.4, 112.6], [-18, 117]], true, true);
    ctx.fillStyle = PAL.neonMagenta; ctx.fill(eye);
    ctx.restore();
    glowDot(ctx, sg * 15, 112.6, 8, PAL.neonMagenta, 0.2);
  }
  for (const y of [[-108, -98], [-80, -70], [-52, -42]]) neonLine(ctx, [[0, y[0]], [0, y[1]]], PAL.neonMagenta, 1.1);
}

const sparrowBody: SpriteDef = {
  id: 'b_sparrow_body', w: 220, h: 300, radius: 46,
  anchors: { wingL: BODY_SH, tail: TAIL_P, core: CORE_P, beak: [0, 148], eyeL: [-16, 112], eyeR: [16, 112] },
  draw: sparrowBodyDraw, glow: sparrowBodyGlow,
};

// ---- 左翼 240x200（翼根在右缘） ----
const WING_ROOT: Pt = [100, 32];
const armAt = (t: number): Pt => [100 - 200 * t, 32 - 92 * t + 20 * Math.sin(Math.PI * t)];
const PODS = [0.3, 0.55, 0.8];
const POD_MUZ: Pt[] = PODS.map((t) => { const a = armAt(t); return [a[0], a[1] + 36] as Pt; });
interface WF { b: Pt; t: Pt; w: number }
const WING_F: WF[] = Array.from({ length: 12 }, (_, i) => {
  const u = i / 11;
  const a = armAt(0.04 + u * 0.92);
  const b: Pt = [a[0] + 2, a[1] - 6];
  const t: Pt = [b[0] - 3 - 6 * u - 10 * Math.max(0, u - 0.55), -88 - 3 * u];
  return { b, t, w: 32 - u * 7 };
});

function wingDraw(ctx: CanvasRenderingContext2D): void {
  // 飞羽：外侧（翼尖）先画，内侧压在上面
  for (let i = WING_F.length - 1; i >= 0; i--) {
    const f = WING_F[i];
    cFeather(ctx, f.b[0], f.b[1], f.t[0], f.t[1], f.w, 300 + i, { neon: i % 2 === 0 ? PAL.neonMagenta : undefined, tint: i % 3 === 0 ? 'rgba(160,96,255,0.4)' : undefined });
  }
  // 次级覆羽（两排铜鳞）
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 13; i++) {
      const t = 0.04 + i * 0.072 + row * 0.03;
      const a = armAt(t), off = 10 + row * 12;
      const x0 = a[0], y0 = a[1] - off * 0.6, x1 = a[0] - 6 - t * 8, y1 = a[1] - off - 26 - row * 6 + t * 10;
      cFeather(ctx, x0, y0, x1, y1, 22 - t * 6, 340 + row * 20 + i, { light: row ? '#b08a58' : CU_L, tint: 'rgba(79,133,119,0.5)' });
    }
  }
  // 臂骨
  const arm: Pt[] = Array.from({ length: 16 }, (_, i) => armAt(i / 15));
  brushStroke(ctx, arm, 24, 9, PAL.ink, { seed: 400, jitter: 0.04, belly: 0.1 });
  brushStroke(ctx, arm, 19.6, 6.4, '#86694a', { seed: 401, jitter: 0.03, belly: 0.1 });
  brushStroke(ctx, arm.map(([x, y]) => [x - 1, y - 3] as Pt), 6, 2, '#e0c48a', { seed: 402, jitter: 0.04, belly: 0.1 });
  for (let i = 1; i < 15; i += 2) { const a = arm[i]; dots(ctx, [[a[0], a[1] + 1]], 0.9, '#d9b078'); }
  // 炮舱
  PODS.forEach((t, i) => {
    const a = armAt(t);
    plate(ctx, [[a[0] - 8, a[1] + 2], [a[0] + 8, a[1] + 2], [a[0] + 7, a[1] + 18], [a[0] - 7, a[1] + 18]], { light: '#7a7f88', base: PAL.iron, dark: PAL.iron2, edgeW: 1.8, seed: 410 + i, wear: 'rgba(210,200,180,0.4)', wearN: 8 });
    plate(ctx, [[a[0] - 4, a[1] + 16], [a[0] + 4, a[1] + 16], [a[0] + 4.4, a[1] + 34], [a[0] - 4.4, a[1] + 34]], { light: '#c99f68', base: CU, dark: CU_D, edgeW: 1.6, seed: 420 + i });
    plate(ctx, [[a[0] - 6.4, a[1] + 31], [a[0] + 6.4, a[1] + 31], [a[0] + 5.4, a[1] + 38], [a[0] - 5.4, a[1] + 38]], { light: VD_L, base: PAL.verdigris2, dark: '#14261f', edgeW: 1.5, seed: 430 + i });
    neonSeamDraw(ctx, [[a[0] - 4.4, a[1] + 8], [a[0] + 4.4, a[1] + 8]], PAL.neonMagenta, 0.9);
    dots(ctx, [[a[0] - 5, a[1] + 5], [a[0] + 5, a[1] + 5]], 0.9, '#d9b078');
  });
  // 翼根肩帽（对准机身肩窝）
  const [rx, ry] = WING_ROOT;
  const cap = ellipsePath(rx, ry, 18, 18);
  ctx.save(); ctx.translate(1.4, 2.2); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.fill(cap); ctx.restore();
  litFill(ctx, cap, [rx - 19, ry - 19, 38, 38], '#dbb47c', CU, CU_D, { seed: 440, blots: 1, wear: 'rgba(245,220,170,0.5)', wearN: 8 });
  bevel(ctx, cap, 'rgba(255,240,205,0.6)', 'rgba(0,0,0,0.5)', 1, 2);
  inkOutline(ctx, cap, 2.2, PAL.ink, 441);
  const hub = ellipsePath(rx, ry, 10, 10);
  litFill(ctx, hub, [rx - 10, ry - 10, 20, 20], VD_L, PAL.verdigris, PAL.verdigris2, { seed: 442, blots: 0 });
  inkOutline(ctx, hub, 1.6, PAL.ink, 443);
  dots(ctx, [[rx, ry]], 3.2, '#d9b078');
}
function wingGlow(ctx: CanvasRenderingContext2D): void {
  WING_F.forEach((f, i) => {
    if (i % 2) return;
    const dx = f.t[0] - f.b[0], dy = f.t[1] - f.b[1];
    neonLine(ctx, [[f.b[0] + dx * 0.4, f.b[1] + dy * 0.4], [f.b[0] + dx * 0.82, f.b[1] + dy * 0.82]], PAL.neonMagenta, 1.1);
  });
  PODS.forEach((t) => {
    const a = armAt(t);
    neonLine(ctx, [[a[0] - 4.4, a[1] + 8], [a[0] + 4.4, a[1] + 8]], PAL.neonMagenta, 1);
    glowDot(ctx, a[0], a[1] + 37, 5, PAL.neonMagenta, 0.3);
  });
}
const sparrowWing: SpriteDef = {
  id: 'b_sparrow_wing', w: 240, h: 200, radius: 40,
  anchors: { root: WING_ROOT, gun1: POD_MUZ[0], gun2: POD_MUZ[1], gun3: POD_MUZ[2] },
  draw: wingDraw, glow: wingGlow,
};

// ---- 尾羽扇 180x130 ----
const TAIL_ROOT: Pt = [0, 52];
const TAIL_F = Array.from({ length: 9 }, (_, i) => {
  const a = (-64 + i * 16) * Math.PI / 180;
  const len = 112 - Math.abs(i - 4) * 5.5;
  return { a, len, x1: Math.sin(a) * len, y1: TAIL_ROOT[1] - Math.cos(a) * len, eye: i >= 2 && i <= 6 };
});
const sparrowTail: SpriteDef = {
  id: 'b_sparrow_tail', w: 180, h: 130, radius: 30, anchors: { root: TAIL_ROOT },
  draw(ctx) {
    // 两侧先画，中央后画（压在最上）
    const order = [0, 8, 1, 7, 2, 6, 3, 5, 4];
    for (const i of order) {
      const f = TAIL_F[i];
      cFeather(ctx, Math.sin(f.a) * 12, TAIL_ROOT[1] - Math.cos(f.a) * 6, f.x1, f.y1, 27, 500 + i, { eye: f.eye, tint: 'rgba(79,133,119,0.8)', neon: i % 2 ? PAL.neonCyan : undefined });
    }
    // 尾根铜箍
    plate(ctx, [[-22, 46], [22, 46], [26, 56], [-26, 56]], { light: '#c99f68', base: CU, dark: CU_D, edgeW: 2, seed: 520, wear: 'rgba(245,220,170,0.5)', wearN: 8 });
    dots(ctx, [[-16, 51], [0, 51], [16, 51]], 1.1, '#d9b078');
    plate(ctx, [[-14, 56], [14, 56], [10, 64], [-10, 64]], { light: '#7a7f88', base: PAL.iron, dark: PAL.iron2, edgeW: 1.8, seed: 521 });
  },
  glow(ctx) {
    for (const f of TAIL_F) {
      if (f.eye) {
        const ex = Math.sin(f.a) * 12 + (f.x1 - Math.sin(f.a) * 12) * 0.8, ey = TAIL_ROOT[1] - Math.cos(f.a) * 6 + (f.y1 - (TAIL_ROOT[1] - Math.cos(f.a) * 6)) * 0.8;
        glowDot(ctx, ex, ey, 8, PAL.neonViolet, 0.3);
      }
    }
    TAIL_F.forEach((f, i) => {
      if (!(i % 2)) return;
      const x0 = Math.sin(f.a) * 12, y0 = TAIL_ROOT[1] - Math.cos(f.a) * 6;
      neonLine(ctx, [[x0 + (f.x1 - x0) * 0.4, y0 + (f.y1 - y0) * 0.4], [x0 + (f.x1 - x0) * 0.82, y0 + (f.y1 - y0) * 0.82]], PAL.neonCyan, 1);
    });
  },
};

// ---- 核心 80x80 ----
const sparrowCore: SpriteDef = {
  id: 'b_sparrow_core', w: 80, h: 80, radius: 30, anchors: { center: [0, 0] },
  draw(ctx) {
    // 齿轮外环
    const teeth: Pt[] = [];
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 37 : 39.4; teeth.push([Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a + 0.09) * r, Math.sin(a + 0.09) * r]); }
    plate(ctx, teeth, { light: '#c99f68', base: CU, dark: CU_D, edgeW: 1.6, seed: 600, wear: 'rgba(245,220,170,0.5)', wearN: 14 });
    const ring2 = ellipsePath(0, 0, 32, 32);
    litFill(ctx, ring2, [-32, -32, 64, 64], '#7a7f88', PAL.iron, PAL.iron2, { seed: 601, blots: 2, wear: 'rgba(210,200,180,0.4)', wearN: 14 });
    bevel(ctx, ring2, 'rgba(255,255,255,0.4)', 'rgba(0,0,0,0.6)', 1, 2);
    inkOutline(ctx, ring2, 2, PAL.ink, 602);
    dots(ctx, Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * 28, Math.sin(i * Math.PI / 4) * 28] as Pt), 1.4, '#d9b078');
    // 内槽
    const well = ellipsePath(0, 0, 23, 23);
    ctx.fillStyle = '#0a0510'; ctx.fill(well);
    ctx.strokeStyle = PAL.verdigris2; ctx.lineWidth = 2; ctx.stroke(well);
    // 晶体：六边形棱柱
    const hex = Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [Math.cos(a) * 17, Math.sin(a) * 17] as Pt; });
    const hp = pathFrom(hex, true, false);
    const cg = ctx.createRadialGradient(-5, -6, 1, 0, 0, 19);
    cg.addColorStop(0, '#e8ffff'); cg.addColorStop(0.4, '#3ff4ff'); cg.addColorStop(1, '#0a5c78');
    ctx.fillStyle = cg; ctx.fill(hp);
    // 切面
    ctx.save(); ctx.clip(hp);
    for (let i = 0; i < 6; i++) {
      const a = hex[i], b = hex[(i + 1) % 6];
      const facing = -((a[0] + b[0]) + (a[1] + b[1])) / 34;
      ctx.fillStyle = facing > 0 ? `rgba(255,255,255,${0.2 * facing})` : `rgba(0,20,40,${-0.4 * facing})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
      line(ctx, [[0, 0], a], 'rgba(255,255,255,0.35)', 0.7);
    }
    ctx.restore();
    inkOutline(ctx, hp, 1.4, '#031a1e', 603);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-5, -7, 2.6, 1.4, -0.7, 0, 7); ctx.fill();
  },
  glow(ctx) {
    glowDot(ctx, 0, 0, 24, PAL.neonCyan, 0.12);
    const hex = Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [Math.cos(a) * 17, Math.sin(a) * 17] as Pt; });
    neonLine(ctx, [...hex, hex[0]], PAL.neonCyan, 1.4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(160,96,255,0.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 23, 0, 7); ctx.stroke(); ctx.restore();
  },
};

// 仅预览：整只铜雀拼装（600x400）
function sparrowAssemble(ctx: CanvasRenderingContext2D, f: number, glow: boolean): void {
  const call = (d: SpriteDef) => (glow ? d.glow?.(ctx, f) : d.draw?.(ctx, f));
  ctx.save(); ctx.translate(0, 41);
  ctx.save(); ctx.translate(TAIL_P[0] - TAIL_ROOT[0], TAIL_P[1] - TAIL_ROOT[1]); call(sparrowTail); ctx.restore();
  ctx.save(); ctx.translate(BODY_SH[0] - WING_ROOT[0], BODY_SH[1] - WING_ROOT[1]); call(sparrowWing); ctx.restore();
  ctx.save(); ctx.scale(-1, 1); ctx.translate(BODY_SH[0] - WING_ROOT[0], BODY_SH[1] - WING_ROOT[1]); call(sparrowWing); ctx.restore();
  call(sparrowBody);
  ctx.save(); ctx.translate(CORE_P[0], CORE_P[1]); call(sparrowCore); ctx.restore();
  ctx.restore();
}
const sparrowPreview: SpriteDef = {
  id: 'preview_sparrow_full', w: 600, h: 400,
  draw: (ctx, f) => sparrowAssemble(ctx, f, false),
  glow: (ctx, f) => sparrowAssemble(ctx, f, true),
};

export const STAGE1_SPRITES: SpriteDef[] = [
  crane, kite, turtle, turtleGun, chariot, serpentHead, serpentSeg, serpentTail, serpentPreview,
  sparrowBody, sparrowWing, sparrowTail, sparrowCore, sparrowPreview,
];
