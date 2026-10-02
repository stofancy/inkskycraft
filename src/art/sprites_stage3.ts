import type { SpriteDef } from './types';
import {
  PAL, TONE, poly, sym, ell, rrect, ngon, cog, body, bevel, scales, hatch, rivetLine, rivetRing, seamLine, seamPath,
  neon, neonPath, orb, stroke, barrel, inkOutline, dryBrush, rng,
} from './b2_helpers';
import type { Ctx, Pt, Shape, Tone } from './b2_helpers';

const TAU = Math.PI * 2;
const DRUM_RIM: Tone = { hi: '#8a4a86', base: '#4a2350', lo: '#1a0b20' };
const GOLD_FACE: Tone = { hi: '#f2cf82', base: '#b98a3a', lo: '#5e3f14' };

/** 折线闪电（glow 用）。 */
function bolt(a: Pt, b: Pt, seed: number, seg = 5, amp = 3): Pt[] {
  const r = rng(seed), pts: Pt[] = [a];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 1; i < seg; i++) {
    const t = i / seg, o = (r() - 0.5) * 2 * amp;
    pts.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
  }
  pts.push(b);
  return pts;
}
/** 圆鼓：漆缘 + 鎏金鼓面 + 鼓钉。 */
function drum(ctx: Ctx, cx: number, cy: number, r: number, seed: number, tacks = 8): void {
  ctx.save(); ctx.translate(1.5, 2.2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.restore();
  body(ctx, ell(cx, cy, r), DRUM_RIM, { line: Math.max(1.3, r * 0.14), bev: r * 0.14, blots: 3, seed, wear: 0.3 });
  body(ctx, ell(cx - r * 0.02, cy - r * 0.02, r * 0.76), GOLD_FACE, { line: Math.max(1, r * 0.09), bev: r * 0.1, blots: 3, seed: seed + 1, wear: 0.5 });
  ctx.save(); ctx.strokeStyle = 'rgba(70,40,10,0.7)'; ctx.lineWidth = Math.max(0.6, r * 0.05);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.stroke(); ctx.restore();
  rivetRing(ctx, cx, cy, r * 0.88, tacks, Math.max(0.7, r * 0.07), PAL.gold, seed);
  // 三巴雷纹
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3 + seed;
    stroke(ctx, [[cx + Math.cos(a) * r * 0.1, cy + Math.sin(a) * r * 0.1], [cx + Math.cos(a + 0.9) * r * 0.32, cy + Math.sin(a + 0.9) * r * 0.32], [cx + Math.cos(a + 1.9) * r * 0.16, cy + Math.sin(a + 1.9) * r * 0.16]], r * 0.2, r * 0.03, 'rgba(60,20,50,0.85)', seed + k, { jitter: 0.05, belly: 0.1 });
  }
}
/** 两点间的圆角杆件。 */
function limb(ctx: Ctx, a: Pt, b: Pt, w: number, t: Tone, seed: number): void {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  ctx.save(); ctx.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
  ctx.save(); ctx.translate(2, 3); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(-L / 2, -w / 2, L, w, w * 0.3); ctx.fill(); ctx.restore();
  body(ctx, rrect(-L / 2, -w / 2, L, w, w * 0.3), t, { line: 2, bev: Math.min(2.5, w * 0.16), blots: 3, seed, angle: Math.PI / 2 });
  ctx.restore();
}
/** 锥形叶片（羽/刃）：从 a 到 b，宽度 w0→w1（中段 mid 处最宽）。 */
function bladePts(a: Pt, b: Pt, w0: number, wm: number, w1: number, curve = 0): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const N = 8, left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const w = (t < 0.45 ? w0 + (wm - w0) * (t / 0.45) : wm + (w1 - wm) * ((t - 0.45) / 0.55) ** 1.4) / 2;
    const c = Math.sin(t * Math.PI) * curve;
    const x = a[0] + dx * t + nx * c, y = a[1] + dy * t + ny * c;
    left.push([x + nx * w, y + ny * w]); right.push([x - nx * w, y - ny * w]);
  }
  return [...left, ...right.reverse()];
}
const blade = (a: Pt, b: Pt, w0: number, wm: number, w1: number, curve = 0): Shape => poly(bladePts(a, b, w0, wm, w1, curve), false);

/* --------------------------------------------------------------- e_drum */
function drawDrumDrone(ctx: Ctx): void {
  const R = 20;
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 - Math.PI / 2;
    stroke(ctx, [[0, 0], [Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5], [Math.cos(a) * R, Math.sin(a) * R]], 5, 4, PAL.ink, 5 + i, { jitter: 0.05 });
    stroke(ctx, [[-0.4, -0.4], [Math.cos(a) * R * 0.5 - 0.4, Math.sin(a) * R * 0.5 - 0.4], [Math.cos(a) * R - 0.4, Math.sin(a) * R - 0.4]], 2.4, 2, PAL.bronze, 15 + i, { jitter: 0.03 });
  }
  const ring = ell(0, 0, 21, 21);
  ctx.save(); ctx.lineWidth = 1.6; ctx.strokeStyle = PAL.gold3; ctx.stroke(ring.path); ctx.restore();
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 - Math.PI / 2;
    drum(ctx, Math.cos(a) * R, Math.sin(a) * R, 9, 30 + i, 6);
  }
  const core = ngon(0, 0, 12.5, 6, Math.PI / 6);
  body(ctx, core, TONE.iron, { line: 2, bev: 1.8, blots: 3, seed: 40 });
  body(ctx, ngon(-0.3, -0.3, 8, 6, Math.PI / 6), TONE.goldm, { line: 1.5, bev: 1.2, blots: 1, seed: 41 });
  ctx.fillStyle = '#14071c'; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, TAU); ctx.fill();
}
function glowDrumDrone(ctx: Ctx): void {
  orb(ctx, 0, 0, 12, PAL.neonViolet, 0.35);
  ctx.fillStyle = PAL.glowWhite; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 - Math.PI / 2, a2 = a + TAU / 6;
    orb(ctx, Math.cos(a) * 20, Math.sin(a) * 20, 4, PAL.neonViolet, 0.4);
    neon(ctx, bolt([Math.cos(a) * 20, Math.sin(a) * 20], [Math.cos(a2) * 20, Math.sin(a2) * 20], 60 + i, 4, 2), PAL.neonAmber, 0.8, false);
  }
}

/* -------------------------------------------------------------- e_lancer */
function lancerHalf(ctx: Ctx): void {
  // 后掠翼刃
  const w1 = poly([[5, -6], [14, -14], [23, -30], [24, -38], [12, -32], [5, -24]], false);
  body(ctx, w1, TONE.plum, { line: 1.8, bev: 1.4, blots: 3, seed: 70 });
  // 前置小翼
  const w2 = poly([[5, 6], [13, 13], [14, 19], [5, 17]], false);
  body(ctx, w2, TONE.iron, { line: 1.5, bev: 1, blots: 0, wear: 0.2, seed: 71 });
  seamLine(ctx, [[8, -12], [18, -28]], 0.9);
  rivetLine(ctx, [8, -8], [17, -26], 3, 0.8, PAL.gold);
}
function drawLancer(ctx: Ctx): void {
  ctx.save(); lancerHalf(ctx); ctx.scale(-1, 1); lancerHalf(ctx); ctx.restore();
  const shaft = sym([[0, 24], [5, 14], [8, 0], [9, -18], [7, -32], [0, -36]], false);
  body(ctx, shaft, TONE.iron, { line: 2.2, bev: 2, blots: 5, seed: 72, angle: 0 });
  // 金环节
  for (const y of [-26, -14, -2, 10]) {
    const w = 8.5 - Math.max(0, y - 4) * 0.28;
    body(ctx, rrect(-w, y, w * 2, 3.6, 1.4), TONE.goldm, { line: 1.2, bev: 0.7, blots: 0, wear: 0 });
  }
  // 矛头
  const tip = sym([[0, 39], [4.5, 26], [6, 17], [0, 12]], false);
  body(ctx, tip, TONE.goldm, { line: 1.8, bev: 1.3, blots: 1, seed: 73, angle: 0 });
  seamLine(ctx, [[0, 14], [0, 37]], 0.9, 'rgba(70,40,10,0.7)', 'rgba(255,240,200,0.5)');
  // 尾喷座
  body(ctx, rrect(-5, -38, 10, 6, 2), TONE.bronze, { line: 1.5, bev: 1, blots: 0, wear: 0 });
  ctx.fillStyle = '#14071c'; ctx.fillRect(-2.6, -37, 5.2, 3);
}
function glowLancer(ctx: Ctx): void {
  orb(ctx, 0, -37, 8, PAL.neonViolet, 0.35);
  stroke(ctx, [[0, -37], [0, -41], [0, -46]], 4, 0.5, PAL.neonViolet, 9);
  orb(ctx, 0, 37, 4, PAL.neonAmber, 0.4);
  for (const s of [-1, 1]) {
    neon(ctx, [[s * 12, -32], [s * 23, -38]], PAL.neonViolet, 1, false);
    neon(ctx, [[s * 8, -12], [s * 18, -28]], PAL.neonAmber, 0.7, false);
    orb(ctx, s * 24, -37, 3.5, PAL.neonViolet, 0.4);
  }
}

/* ------------------------------------------------------------- e_wingfort */
const WF_GUNS: Pt[] = [[-22, 44], [22, 44], [-60, 20], [60, 20]];
const WF_ENG: Pt[] = [[-20, -52], [20, -52], [-58, -46], [58, -46]];
function drawWingfort(ctx: Ctx): void {
  const wing = sym([[0, -50], [40, -56], [84, -46], [90, -32], [86, -12], [68, 12], [44, 34], [20, 50], [0, 58]], false);
  ctx.save(); ctx.translate(3, 5); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fill(wing.path); ctx.restore();
  body(ctx, wing, { hi: '#8a95a4', base: '#454c58', lo: '#181b22' }, { line: 3, blots: 10, seed: 80, bev: 3 });
  // 前缘铜甲片
  for (const s of [-1, 1]) {
    ctx.save(); ctx.scale(s, 1);
    const lead = poly([[86, -12], [90, -32], [96, -30], [92, -8], [72, 16], [48, 38], [22, 55], [0, 62], [0, 56], [20, 50], [44, 34], [68, 12]], false);
    void lead;
    const plates: Pt[][] = [
      [[88, -14], [70, 12], [58, 6], [76, -20]],
      [[70, 12], [46, 34], [36, 26], [58, 6]],
      [[46, 34], [22, 50], [14, 40], [36, 26]],
      [[22, 50], [0, 58], [0, 46], [14, 40]],
    ];
    plates.forEach((pl, i) => {
      const pp = poly(pl, false);
      body(ctx, pp, i % 2 ? TONE.bronze : TONE.plum, { line: 1.8, bev: 1.5, blots: 3, seed: 81 + i });
      const mid: Pt = [(pl[0][0] + pl[2][0]) / 2, (pl[0][1] + pl[2][1]) / 2];
      rivetLine(ctx, mid, mid, 1, 1.3, PAL.gold);
    });
    // 翼面装甲板缝
    seamLine(ctx, [[10, -46], [22, 4], [44, 30]], 1.1);
    seamLine(ctx, [[46, -52], [52, -6], [66, 12]], 1.1);
    seamLine(ctx, [[74, -46], [78, -20]], 1.1);
    rivetLine(ctx, [14, -30], [16, -4], 3, 1, PAL.gold2);
    rivetLine(ctx, [50, -34], [54, -12], 3, 1, PAL.gold2);
    // 尾喷筒
    ctx.restore();
  }
  for (const [x, y] of WF_ENG) {
    body(ctx, rrect(x - 8, y - 6, 16, 14, 3), TONE.bronze, { line: 2, bev: 1.4, blots: 1, seed: 90 });
    ctx.fillStyle = '#14071c'; ctx.fillRect(x - 5, y - 4, 10, 5);
  }
  // 雷纹回字带
  for (const s of [-1, 1]) {
    const p = new Path2D();
    const x0 = 30 * s;
    p.moveTo(x0, -36); p.lineTo(x0 + 8 * s, -36); p.lineTo(x0 + 8 * s, -30); p.lineTo(x0 + 2 * s, -30); p.lineTo(x0 + 2 * s, -33);
    ctx.save(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1.1; ctx.stroke(p); ctx.restore();
  }
  // 中央舰桥（金紫）
  const hull = ell(0, -8, 22, 34);
  body(ctx, hull, TONE.plum, { line: 2.8, bev: 3, blots: 6, seed: 92, angle: Math.PI / 3 });
  scales(ctx, hull, 8, 'rgba(0,0,0,0.4)', 'rgba(255,220,150,0.2)', 0.8);
  const brg = ell(-0.5, -12, 14, 18);
  body(ctx, brg, TONE.goldm, { line: 2, bev: 2, blots: 3, seed: 93 });
  const roof = poly([[-16, -8], [0, -30], [16, -8], [0, 4]], true);
  body(ctx, roof, TONE.bronze, { line: 1.8, bev: 1.6, blots: 3, seed: 94 });
  seamLine(ctx, [[0, -28], [0, 3]], 1.2); seamLine(ctx, [[-14, -8], [14, -8]], 1.2);
  // 炮座
  for (const [x, y] of WF_GUNS) {
    body(ctx, ell(x, y, 9), TONE.bronze, { line: 2, bev: 1.4, blots: 2, seed: 95 });
    barrel(ctx, x, y + 2, y + 17, 5.5, TONE.iron);
    body(ctx, ell(x - 0.3, y - 0.3, 4.6), TONE.goldm, { line: 1.3, bev: 1, blots: 0 });
  }
}
function glowWingfort(ctx: Ctx): void {
  for (const [x, y] of WF_ENG) { orb(ctx, x, y + 6, 8, PAL.neonViolet, 0.35); }
  for (const s of [-1, 1]) {
    neon(ctx, [[s * 10, -46], [s * 22, 4], [s * 44, 30]], PAL.neonViolet, 0.9);
    neon(ctx, [[s * 46, -50], [s * 52, -6], [s * 66, 12]], PAL.neonViolet, 0.8, false);
  }
  orb(ctx, 0, -12, 12, PAL.neonAmber, 0.3);
  neon(ctx, [[-16, -8], [0, -30], [16, -8], [0, 4], [-16, -8]], PAL.neonAmber, 0.8, false);
  for (const [x, y] of WF_GUNS) {
    const p = new Path2D(); p.arc(x, y, 7, 0, TAU); ctx.save(); ctx.globalAlpha = 0.8; neonPath(ctx, p, PAL.neonAmber, 0.9, false); ctx.restore();
    orb(ctx, x, y + 18, 3.5, PAL.neonViolet, 0.5);
  }
}

/* ------------------------------------------------------------- m_leigong */
const LG_C: Pt = [0, -10];
const LG_HAMMER: Pt = [128, 98];
function drawLeigong(ctx: Ctx): void {
  // 背后云翼（层叠羽刃）与喷口
  for (const s of [-1, 1]) {
    ctx.save(); ctx.scale(s, 1);
    const tips: Pt[] = [[150, -104], [136, -128], [112, -142], [84, -146]];
    tips.forEach((t, i) => {
      const f = blade([46 + i * 6, -56 - i * 6], t, 26, 32, 6, -6);
      body(ctx, f, i % 2 ? TONE.plum : { hi: '#7a5aa8', base: '#3a2660', lo: '#140c28' }, { line: 2.2, bev: 2, blots: 3, seed: 5 + i, wear: 0.6 });
      stroke(ctx, [[46 + i * 6, -56 - i * 6], [(46 + i * 6 + t[0]) / 2, (-56 - i * 6 + t[1]) / 2], t], 2, 0.8, PAL.gold, 15 + i, { jitter: 0.03, belly: 0 });
    });
    body(ctx, rrect(28, -132, 26, 32, 6), TONE.bronze, { line: 2.4, bev: 2, blots: 3, seed: 20 });
    body(ctx, rrect(31, -138, 20, 12, 4), TONE.iron, { line: 2, bev: 1.4, blots: 0, wear: 0 });
    ctx.restore();
  }
  // 手臂
  for (const s of [-1, 1]) {
    const sh: Pt = [s * 78, -8], el: Pt = [s * 122, 24], wr: Pt = [s * 127, 64];
    limb(ctx, sh, el, 28, TONE.plum, 30 + s);
    limb(ctx, el, wr, 24, TONE.bronze, 33 + s);
    rivetLine(ctx, [sh[0] + s * 8, sh[1] + 6], [el[0] - s * 6, el[1] - 4], 4, 1.2, PAL.gold);
    body(ctx, ell(el[0], el[1], 15), TONE.goldm, { line: 2.2, bev: 2, blots: 3, seed: 36 });
    rivetRing(ctx, el[0], el[1], 10, 6, 1, PAL.gold3);
    // 雷锤：锤头（俯视为粗圆筒）
    const hx = s * LG_HAMMER[0], hy = LG_HAMMER[1];
    ctx.save(); ctx.translate(3, 4); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.roundRect(hx - 24, hy - 32, 48, 64, 10); ctx.fill(); ctx.restore();
    body(ctx, rrect(hx - 24, hy - 32, 48, 64, 10), TONE.iron, { line: 2.8, bev: 3, blots: 5, seed: 38, angle: 0 });
    for (const dy of [-32, 24]) {
      body(ctx, rrect(hx - 25, hy + dy, 50, 8, 3), TONE.goldm, { line: 1.6, bev: 1.2, blots: 0, wear: 0 });
    }
    for (let k = 0; k < 4; k++) rivetLine(ctx, [hx - 16, hy - 20 + k * 14], [hx + 16, hy - 20 + k * 14], 3, 1.4, PAL.gold);
    body(ctx, ell(hx, hy - 34, 8), TONE.bronze, { line: 1.8, bev: 1.2, blots: 0, wear: 0 });
    // 锤面雷纹
    stroke(ctx, [[hx - 10, hy + 4], [hx - 2, hy - 8], [hx + 2, hy + 2], [hx + 10, hy - 12]], 3.4, 1.4, 'rgba(255,220,130,0.85)', 44 + s, { jitter: 0.05, belly: 0.05 });
  }
  // 鼓环底盘
  const base = ell(LG_C[0], LG_C[1], 92);
  ctx.save(); ctx.translate(4, 6); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(base.path); ctx.restore();
  body(ctx, base, TONE.iron, { line: 3, bev: 4, blots: 8, seed: 50 });
  rivetRing(ctx, LG_C[0], LG_C[1], 88, 24, 1.3, PAL.bronze);
  // 12 面鼓
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12 + TAU / 24;
    drum(ctx, LG_C[0] + Math.cos(a) * 68, LG_C[1] + Math.sin(a) * 68, 15.5, 60 + i, 8);
  }
  // 中盘
  const disc = ell(LG_C[0], LG_C[1], 46);
  body(ctx, disc, TONE.plum, { line: 3, bev: 3.5, blots: 6, seed: 51 });
  body(ctx, ngon(LG_C[0], LG_C[1], 38, 8, Math.PI / 8), TONE.goldm, { line: 2.2, bev: 2.6, blots: 4, seed: 52 });
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + Math.PI / 8;
    seamLine(ctx, [[LG_C[0] + Math.cos(a) * 16, LG_C[1] + Math.sin(a) * 16], [LG_C[0] + Math.cos(a) * 37, LG_C[1] + Math.sin(a) * 37]], 1.2, 'rgba(70,40,10,0.7)', 'rgba(255,240,200,0.4)');
  }
  body(ctx, ell(LG_C[0], LG_C[1], 17), { hi: '#44245c', base: '#1c0c2a', lo: '#08030e' }, { line: 2.4, bev: 2.4, blots: 0, wear: 0 });
  // 头部：雷公鸟喙面具（朝下）
  const hd: Pt = [0, 96];
  const helm = sym([[0, hd[1] - 22], [20, hd[1] - 20], [32, hd[1] - 4], [26, hd[1] + 14], [10, hd[1] + 22], [0, hd[1] + 24]], true);
  ctx.save(); ctx.translate(3, 4); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(helm.path); ctx.restore();
  body(ctx, helm, TONE.bronze, { line: 2.8, bev: 2.6, blots: 5, seed: 54 });
  for (const s of [-1, 1]) {
    stroke(ctx, [[s * 24, hd[1] - 12], [s * 44, hd[1] - 22], [s * 58, hd[1] - 12]], 8, 2, TONE.goldm.base, 55 + s, { jitter: 0.1 });
    body(ctx, ell(s * 13, hd[1] - 2, 5.5, 3.6, s * 0.4), { hi: '#24122e', base: '#0c0410', lo: '#000' }, { line: 1.4, bev: 1, blots: 0, wear: 0 });
  }
  const beak = sym([[0, hd[1] + 6], [8, hd[1] + 10], [7, hd[1] + 24], [0, hd[1] + 34]], false);
  body(ctx, beak, TONE.goldm, { line: 2, bev: 1.6, blots: 1, seed: 56, angle: 0 });
  seamLine(ctx, [[0, hd[1] + 8], [0, hd[1] + 30]], 1);
}
function glowLeigong(ctx: Ctx): void {
  // 主核
  ctx.save(); ctx.globalAlpha = 0.55; orb(ctx, LG_C[0], LG_C[1], 40, PAL.neonViolet, 0.2); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.7; orb(ctx, LG_C[0], LG_C[1], 16, PAL.neonAmber, 0.2); ctx.restore();
  const rg = new Path2D(); rg.arc(LG_C[0], LG_C[1], 39, 0, TAU);
  ctx.save(); ctx.globalAlpha = 0.6; neonPath(ctx, rg, PAL.neonAmber, 1, false); ctx.restore();
  // 鼓间闪电
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12 + TAU / 24, a2 = a + TAU / 12;
    orb(ctx, LG_C[0] + Math.cos(a) * 68, LG_C[1] + Math.sin(a) * 68, 6, PAL.neonViolet, 0.4);
    neon(ctx, bolt([LG_C[0] + Math.cos(a) * 68, LG_C[1] + Math.sin(a) * 68], [LG_C[0] + Math.cos(a2) * 68, LG_C[1] + Math.sin(a2) * 68], 200 + i, 4, 3.5), PAL.neonAmber, 0.8, false);
  }
  // 火焰喷口
  for (const s of [-1, 1]) { orb(ctx, s * 41, -136, 12, PAL.neonViolet, 0.4); orb(ctx, s * 41, -128, 7, PAL.neonAmber, 0.5); }
  // 锤
  for (const s of [-1, 1]) {
    const hx = s * LG_HAMMER[0], hy = LG_HAMMER[1];
    neon(ctx, [[hx - 10, hy + 4], [hx - 2, hy - 8], [hx + 2, hy + 2], [hx + 10, hy - 12]], PAL.neonAmber, 1.2);
    orb(ctx, hx, hy + 30, 9, PAL.neonViolet, 0.3);
    orb(ctx, s * 122, 24, 6, PAL.neonViolet, 0.4);
    orb(ctx, s * 13, 94, 5, PAL.neonAmber, 0.5);
  }
}

/* ============================================================ 蚀鲲 */
const KUN_PROFILE: Pt[] = [[-300, 16], [-250, 26], [-190, 46], [-130, 84], [-60, 138], [20, 188], [100, 226], [170, 244], [230, 246], [280, 232], [320, 200], [346, 150], [358, 80], [360, 0]];
function kunHW(y: number): number {
  const P = KUN_PROFILE;
  if (y <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (y <= P[i][0]) { const t = (y - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t; }
  return 0;
}
const KUN_GUNS: Pt[] = [[-72, -150], [72, -150], [-112, 10], [112, 10], [-96, 200], [96, 200]];
const KUN_FIN_L: Pt = [-190, 90], KUN_EYE_L: Pt = [-165, 258], KUN_MOUTH: Pt = [0, 336], KUN_BLOW: Pt = [0, 150];
const KUN_FIN_ROOT: Pt = [96, 24];
function kunBodyShape(): Shape {
  const right: Pt[] = [[0, -312], ...KUN_PROFILE.map(([y, w]) => [w, y] as Pt)];
  return sym(right, true);
}
function drawKunBody(ctx: Ctx): void {
  // 尾鳍（横向鲸尾）
  for (const s of [-1, 1]) {
    ctx.save(); ctx.scale(s, 1);
    const fl = poly([[8, -282], [70, -286], [130, -304], [190, -334], [214, -358], [172, -360], [122, -348], [72, -340], [30, -336], [8, -348]], true);
    ctx.save(); ctx.translate(3, 5); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(fl.path); ctx.restore();
    body(ctx, fl, TONE.plum, { line: 3, bev: 3, blots: 8, seed: 300 });
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      stroke(ctx, [[16 + t * 20, -292 - t * 40], [76 + t * 50, -306 - t * 40], [120 + t * 74, -328 - t * 26]], 3.4, 1, PAL.bronze, 310 + i, { jitter: 0.1 });
    }
    // 铜甲缘
    const edge = poly([[120, -306], [190, -334], [214, -358], [196, -332], [136, -300]], false);
    body(ctx, edge, TONE.bronze, { line: 1.8, bev: 1.4, blots: 1, seed: 301 });
    rivetLine(ctx, [138, -314], [194, -338], 5, 1.2, PAL.gold);
    ctx.restore();
  }
  // 舷侧铜刺（先画，露在轮廓外）
  for (const s of [-1, 1]) {
    for (let y = -170; y <= 150; y += 32) {
      const w = kunHW(y);
      const sp = blade([s * (w - 10), y + 6], [s * (w + 24), y - 30], 17, 14, 1.5, s * 4);
      body(ctx, sp, TONE.bronze, { line: 2.2, bev: 1.6, blots: 2, seed: 305 + y, wear: 0.6 });
    }
  }
  // 躯体
  const shape = kunBodyShape();
  ctx.save(); ctx.translate(5, 8); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fill(shape.path); ctx.restore();
  body(ctx, shape, { hi: '#5a4a80', base: '#282038', lo: '#0c0812' }, { line: 4, blots: 20, seed: 320, bev: 6, wear: 0.4 });
  // 波浪鳞纹（青海波）
  ctx.save(); ctx.clip(shape.path);
  scales(ctx, shape, 26, 'rgba(0,0,0,0.42)', 'rgba(190,170,255,0.16)', 1.4);
  ctx.restore();
  // 装甲肋（横向弧形板）
  const bands: [number, number][] = [];
  for (let y = -262; y < 100; y += 31) bands.push([y, y + 26]);
  bands.forEach(([y0, y1], i) => {
    const pts: Pt[] = [];
    const bow = 12;
    const hw0 = kunHW(y0) - 6, hw1 = kunHW(y1) - 6;
    for (let k = 0; k <= 10; k++) { const x = -hw0 + (2 * hw0 * k) / 10; pts.push([x, y0 + bow * (1 - (x / hw0) ** 2)]); }
    for (let k = 10; k >= 0; k--) { const x = -hw1 + (2 * hw1 * k) / 10; pts.push([x, y1 + bow * (1 - (x / hw1) ** 2)]); }
    const band = poly(pts, false);
    const tone = i % 3 === 1 ? TONE.bronze : TONE.iron;
    ctx.save(); ctx.translate(0, 3); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(band.path); ctx.restore();
    body(ctx, band, tone, { line: 2, bev: 2.2, blots: 5, seed: 330 + i, wear: 0.6, angle: Math.PI / 3 });
    // 铆钉沿板缘
    for (let k = 1; k < 9; k++) {
      const x = -hw0 + (2 * hw0 * k) / 9;
      if (Math.abs(x) < 14) continue;
      rivetLine(ctx, [x, y0 + 5 + bow * (1 - (x / hw0) ** 2)], [x, y0 + 5 + bow * (1 - (x / hw0) ** 2)], 1, 1.3, i % 3 === 1 ? PAL.gold : PAL.bronze);
    }
  });
  // 头部大鳞与额甲
  const fore = sym([[0, 118], [50, 128], [90, 170], [96, 226], [64, 262], [0, 274]], true);
  ctx.save(); ctx.translate(0, 4); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(fore.path); ctx.restore();
  body(ctx, fore, TONE.bronze, { line: 3, bev: 3.4, blots: 6, seed: 341 });
  scales(ctx, fore, 15, 'rgba(0,0,0,0.42)', 'rgba(255,225,150,0.25)', 1);
  for (let k = 0; k < 5; k++) seamLine(ctx, [[-84 + k * 10, 150 + k * 20], [-56 + k * 8, 160 + k * 22]], 1);
  for (const sg of [-1, 1]) {
    const cheek = poly([[sg * 110, 150], [sg * 176, 172], [sg * 214, 232], [sg * 150, 240], [sg * 110, 210]], true);
    body(ctx, cheek, TONE.iron, { line: 2.6, bev: 2.6, blots: 5, seed: 342 + sg });
    scales(ctx, cheek, 14, 'rgba(0,0,0,0.5)', 'rgba(190,170,255,0.2)', 1);
    rivetLine(ctx, [sg * 120, 158], [sg * 200, 226], 6, 1.4, PAL.gold2);
  }
  // 脊线灯带座
  const spine = rrect(-11, -290, 22, 560, 10);
  body(ctx, spine, TONE.iron, { line: 2.4, bev: 2.2, blots: 3, seed: 340, angle: 0 });
  for (let y = -278; y < 262; y += 24) body(ctx, rrect(-7, y, 14, 9, 3), { hi: '#160a24', base: '#0a0412', lo: '#000' }, { line: 1.2, bev: 1, blots: 0, wear: 0 });
  // 舰桥（八角攒尖）
  body(ctx, ngon(0, -66, 40, 8, Math.PI / 8), TONE.bronze, { line: 3, bev: 3, blots: 5, seed: 343 });
  rivetRing(ctx, 0, -66, 35, 16, 1.3, PAL.gold, 0.1);
  body(ctx, ngon(-0.6, -66.6, 29, 8, Math.PI / 8), TONE.plum, { line: 2.4, bev: 2.6, blots: 4, seed: 344 });
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + Math.PI / 8; seamLine(ctx, [[Math.cos(a) * 6, -66 + Math.sin(a) * 6], [Math.cos(a) * 28, -66 + Math.sin(a) * 28]], 1.3); }
  body(ctx, ell(0, -66, 9), TONE.goldm, { line: 2, bev: 1.6, blots: 1 });
  // 额头装甲（头部）
  const brow = sym([[0, 226], [70, 224], [150, 230], [186, 250], [150, 262], [70, 258], [0, 262]], true);
  void brow;
  // 眼眶装甲板（左右）
  for (const s of [-1, 1]) {
    const ex = s * -KUN_EYE_L[0], ey = KUN_EYE_L[1];
    const orbit = ell(ex, ey, 44, 40);
    body(ctx, orbit, TONE.bronze, { line: 3, bev: 3.5, blots: 5, seed: 350 + s });
    rivetRing(ctx, ex, ey, 39, 14, 1.4, PAL.gold, 0.2);
    const brow2 = poly([[ex - 44, ey - 36], [ex + 4, ey - 56], [ex + 46, ey - 34], [ex + 10, ey - 38]], false);
    body(ctx, brow2, TONE.goldm, { line: 2, bev: 1.6, blots: 2, seed: 352 + s });
  }
  // 炮塔
  for (const [x, y] of KUN_GUNS) {
    body(ctx, ell(x, y, 25), TONE.bronze, { line: 3, bev: 2.4, blots: 4, seed: 360 + x });
    rivetRing(ctx, x, y, 20, 12, 1.2, PAL.gold, 0.3);
    barrel(ctx, x, y + 4, y + 36, 11, TONE.iron);
    body(ctx, ell(x - 0.6, y - 0.6, 13), TONE.iron, { line: 2, bev: 2, blots: 2, seed: 361 });
    body(ctx, ell(x - 0.6, y - 0.6, 6.5), TONE.goldm, { line: 1.4, bev: 1, blots: 0 });
  }
  // 喷气孔烟囱
  const [bx, by] = KUN_BLOW;
  body(ctx, ell(bx, by, 32, 24), TONE.bronze, { line: 3, bev: 3, blots: 4, seed: 370 });
  rivetRing(ctx, bx, by, 27, 14, 1.3, PAL.gold, 0.1);
  body(ctx, ell(bx, by, 20, 14), { hi: '#20122e', base: '#0c0614', lo: '#000' }, { line: 2.4, bev: 3, blots: 0, wear: 0 });
  for (let k = -2; k <= 2; k++) seamLine(ctx, [[bx + k * 6, by - 11], [bx + k * 6, by + 11]], 1.2);
  // 口
  const [mx, my] = KUN_MOUTH;
  const maw = sym([[0, 312], [52, 310], [100, 300], [128, 290], [112, 320], [70, 344], [0, 356]], true);
  body(ctx, maw, { hi: '#3a1030', base: '#1a0616', lo: '#080208' }, { line: 3, bev: 3, blots: 0, wear: 0 });
  ctx.save(); ctx.clip(maw.path);
  for (let i = -8; i <= 8; i++) {
    const x = i * 13.5, y0 = 298 + Math.abs(i) * 0.9 + (1 - Math.abs(i) / 9) * 14;
    const tl = 14 + ((i * 7 + 20) % 5) * 4 - Math.abs(i) * 0.8; const tooth = poly([[x - 6, y0], [x + 6, y0], [x + 1, y0 + tl]], false);
    body(ctx, tooth, TONE.paper, { line: 1.4, bev: 1, blots: 0, wear: 0 });
  }
  ctx.restore();
  // 獠牙与唇甲
  for (const sg of [-1, 1]) {
    const tusk = blade([sg * 104, 296], [sg * 136, 354], 18, 14, 1.5, sg * 6);
    body(ctx, tusk, TONE.goldm, { line: 2.2, bev: 1.6, blots: 2, seed: 390 + sg });
  }
  const lip = poly([[-122, 292], [-70, 306], [0, 312], [70, 306], [122, 292], [126, 302], [70, 318], [0, 324], [-70, 318], [-126, 302]], true);
  body(ctx, lip, TONE.bronze, { line: 2.2, bev: 1.8, blots: 3, seed: 392 });
  rivetLine(ctx, [-100, 302], [100, 302], 9, 1.2, PAL.gold);
  // 下颌板
  const jaw = poly([[-116, 322], [-70, 342], [0, 354], [70, 342], [116, 322], [100, 352], [60, 364], [0, 368], [-60, 364], [-100, 352]], true);
  void jaw; void mx; void my;
  // 尾部喷口
  for (const s of [-1, 1]) {
    body(ctx, rrect(s * 16 - 9, -312, 18, 22, 5), TONE.bronze, { line: 2.4, bev: 1.6, blots: 2, seed: 380 + s });
    ctx.fillStyle = '#14071c'; ctx.fillRect(s * 16 - 5, -314, 10, 6);
  }
}
function glowKunBody(ctx: Ctx): void {
  // 脊线灯带
  for (let y = -278; y < 262; y += 24) { ctx.fillStyle = PAL.neonCyan; ctx.globalAlpha = 0.85; ctx.fillRect(-4, y + 2, 8, 5); ctx.globalAlpha = 1; }
  neon(ctx, [[0, -290], [0, 270]], PAL.neonCyan, 1.2, false);
  // 肋间霓虹缝
  for (let y = -262; y < 100; y += 31) {
    const y0 = y + 27;
    for (const s of [-1, 1]) {
      const pts: Pt[] = [];
      const hw = kunHW(y0) - 10;
      for (let k = 2; k <= 9; k++) { const x = s * (18 + ((hw - 18) * (k - 2)) / 7); pts.push([x, y0 + 12 * (1 - (x / hw) ** 2) + 2]); }
      ctx.save(); ctx.globalAlpha = 0.55; neon(ctx, pts, PAL.neonViolet, 0.9, false); ctx.restore();
    }
  }
  // 炮口
  for (const [x, y] of KUN_GUNS) {
    const p = new Path2D(); p.arc(x, y, 17, 0, TAU); ctx.save(); ctx.globalAlpha = 0.85; neonPath(ctx, p, PAL.neonMagenta, 1.5, false); ctx.restore();
    orb(ctx, x, y + 38, 6, PAL.neonMagenta, 0.5);
  }
  // 眼眶光环
  for (const s of [-1, 1]) {
    const p = new Path2D(); p.arc(s * -KUN_EYE_L[0], KUN_EYE_L[1], 36, 0, TAU); ctx.save(); ctx.globalAlpha = 0.5; neonPath(ctx, p, PAL.neonMagenta, 1.2, false); ctx.restore();
  }
  // 喷气孔
  orb(ctx, 0, -66, 12, PAL.neonAmber, 0.4);
  orb(ctx, KUN_BLOW[0], KUN_BLOW[1], 28, PAL.neonCyan, 0.3);
  orb(ctx, KUN_BLOW[0], KUN_BLOW[1], 12, PAL.glowWhite, 0.5);
  // 口内
  const mg = ctx.createRadialGradient(0, 335, 0, 0, 335, 100);
  mg.addColorStop(0, 'rgba(255,63,191,0.85)'); mg.addColorStop(1, 'rgba(120,10,90,0.2)');
  ctx.save(); ctx.fillStyle = mg;
  const maw = sym([[0, 316], [50, 314], [96, 304], [118, 296], [104, 318], [66, 338], [0, 348]], true);
  ctx.clip(maw.path); ctx.fillRect(-140, 290, 280, 70);
  // 牙的暗影（在 glow 里画黑）
  ctx.fillStyle = '#000';
  for (let i = -8; i <= 8; i++) {
    const x = i * 13.5, y0 = 298 + Math.abs(i) * 0.9 + (1 - Math.abs(i) / 9) * 14;
    const tl = 14 + ((i * 7 + 20) % 5) * 4 - Math.abs(i) * 0.8; ctx.beginPath(); ctx.moveTo(x - 6, y0); ctx.lineTo(x + 6, y0); ctx.lineTo(x + 1, y0 + tl); ctx.fill();
  }
  ctx.restore();
  // 尾喷口 + 尾鳍前缘
  for (const s of [-1, 1]) {
    orb(ctx, s * 16, -318, 12, PAL.neonViolet, 0.4);
    neon(ctx, [[s * 132, -308], [s * 190, -336], [s * 212, -357]], PAL.neonCyan, 1.2);
  }
  // 头部侧缝
  neon(ctx, [[-130, 120], [-190, 190], [-150, 300]], PAL.neonViolet, 1.1);
  neon(ctx, [[130, 120], [190, 190], [150, 300]], PAL.neonViolet, 1.1);
}

// 鳍 200x260（左鳍，翼根在右缘）
function drawKunFin(ctx: Ctx): void {
  const fin = poly([[100, 90], [50, 96], [-20, 70], [-74, 4], [-98, -104], [-66, -94], [-10, -56], [52, -38], [100, -40]], true);
  ctx.save(); ctx.translate(4, 6); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(fin.path); ctx.restore();
  body(ctx, fin, TONE.plum, { line: 3.2, bev: 3.4, blots: 10, seed: 400 });
  // 羽片（骨板扇）
  const base: Pt = [86, 28];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const tip: Pt = [-88 + (1 - t) * 20 + t * 130 * 0.0 - t * 0 + (t * 150) * 0.0, -100 + t * 130];
    const to: Pt = [-92 + t * 96, -104 + t * 140];
    const bd = blade([base[0] - t * 30, base[1] - 30 + t * 50], to, 18, 22, 6, (t - 0.5) * 10);
    void tip;
    body(ctx, bd, i % 2 ? TONE.bronze : TONE.iron, { line: 2, bev: 1.6, blots: 3, seed: 410 + i, wear: 0.7 });
    stroke(ctx, [[base[0] - t * 30 - 6, base[1] - 30 + t * 50], [(base[0] + to[0]) / 2, (base[1] + to[1]) / 2 - 10], [to[0] + 4, to[1] + 6]], 1.4, 0.6, 'rgba(255,230,170,0.5)', 420 + i, { jitter: 0.05 });
  }
  // 前缘金甲
  const lead = poly([[100, 90], [50, 96], [-20, 70], [-74, 4], [-98, -104], [-90, -104], [-66, 0], [-16, 62], [50, 84], [100, 78]], false);
  body(ctx, lead, TONE.goldm, { line: 2.4, bev: 2, blots: 3, seed: 430 });
  rivetLine(ctx, [60, 88], [-60, 0], 8, 1.4, PAL.gold3);
  // 肩关节
  body(ctx, ell(88, 26, 28), TONE.bronze, { line: 3, bev: 3, blots: 4, seed: 431 });
  rivetRing(ctx, 88, 26, 22, 10, 1.3, PAL.gold);
  body(ctx, ell(88, 26, 11), TONE.iron, { line: 2, bev: 1.6, blots: 1 });
}
function glowKunFin(ctx: Ctx): void {
  neon(ctx, [[-96, -100], [-72, -10], [-20, 60], [50, 88]], PAL.neonMagenta, 1.2);
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    ctx.save(); ctx.globalAlpha = 0.6;
    neon(ctx, [[72 - t * 30, 10 - 20 + t * 40], [10 - t * 40, -30 + t * 30 - 20 * (1 - t)], [-84 + t * 90, -92 + t * 120]], PAL.neonViolet, 0.8, false);
    ctx.restore();
  }
  orb(ctx, -96, -102, 8, PAL.neonCyan, 0.5);
  orb(ctx, 88, 26, 9, PAL.neonMagenta, 0.4);
}

// 眼 70x70
function drawKunEye(ctx: Ctx): void {
  body(ctx, ell(0, 0, 33), { hi: '#4a3a5a', base: '#1e1428', lo: '#08040e' }, { line: 3, bev: 3, blots: 3, seed: 450 });
  const ball = ell(0, 0, 27);
  body(ctx, ball, { hi: '#fff2ce', base: '#e0a848', lo: '#6a3a14' }, { line: 2.4, bev: 3.5, blots: 4, seed: 451, wear: 0 });
  // 虹膜
  const g = ctx.createRadialGradient(-2, -2, 2, 0, 0, 20);
  g.addColorStop(0, '#ff9ad8'); g.addColorStop(0.55, '#c2208a'); g.addColorStop(1, '#420a3a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const a = i * TAU / 16; stroke(ctx, [[Math.cos(a) * 8, Math.sin(a) * 8], [Math.cos(a) * 20, Math.sin(a) * 20]], 1.4, 0.8, 'rgba(60,0,40,0.6)', 460 + i, { jitter: 0.1, belly: 0 });
  }
  // 竖瞳
  ctx.fillStyle = '#080008'; ctx.beginPath(); ctx.ellipse(0, 0, 4.4, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(-7, -8, 4, 2.6, -0.6, 0, TAU); ctx.fill();
  // 上眼睑（铜甲）
  const lid = poly([[-32, -6], [-26, -22], [0, -32], [26, -22], [32, -6], [18, -18], [0, -22], [-18, -18]], true);
  body(ctx, lid, TONE.bronze, { line: 2.4, bev: 1.8, blots: 2, seed: 452 });
  rivetLine(ctx, [-18, -24], [18, -24], 4, 1, PAL.gold);
}
function glowKunEye(ctx: Ctx): void {
  ctx.save(); ctx.globalAlpha = 0.5; orb(ctx, 0, 0, 34, PAL.neonMagenta, 0.2); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.clip();
  ctx.globalAlpha = 0.75; orb(ctx, 0, 0, 22, PAL.neonMagenta, 0.12);
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 0, 4.4, 14, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = PAL.glowWhite; ctx.beginPath(); ctx.ellipse(0, 0, 1.2, 9, 0, 0, TAU); ctx.fill();
  const p = new Path2D(); p.arc(0, 0, 21, 0, TAU); neonPath(ctx, p, PAL.neonCyan, 1.1, false);
}

/* ============================================================ 鹏 */
const PENG_WING_L: Pt = [-88, -20], PENG_WING_ROOT: Pt = [182, 70];
const PW_N = 12;
function pwArm(u: number): Pt { return [184 - 320 * u, 70 - 90 * u ** 1.6]; }
function pwTip(u: number): Pt {
  const [x, y] = pwArm(u), th = (6 + 20 * u) * Math.PI / 180, L = 150 - 40 * u;
  return [x - Math.sin(th) * L, y - 6 - Math.cos(th) * L];
}
const PW_GUNS: Pt[] = [0.2, 0.55, 0.88].map((u) => { const [x, y] = pwArm(u); return [x, y + 18] as Pt; });
function drawPengWing(ctx: Ctx): void {
  const N = PW_N;
  // 飞羽（后层）
  for (let i = N - 1; i >= 0; i--) {
    const u = i / (N - 1), a = pwArm(u), b = pwTip(u);
    const sh = blade([a[0] + 3, a[1] + 4], [b[0] + 3, b[1] + 4], 32, 38, 6, 8);
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(sh.path); ctx.restore();
    const f = blade(a, b, 32, 38, 6, 8 * (1 - u * 0.6));
    body(ctx, f, i % 2 ? TONE.plum : { hi: '#7a5aa8', base: '#3a2660', lo: '#140c28' }, { line: 2.2, bev: 2, blots: 3, seed: 500 + i, wear: 0.6, angle: Math.PI / 3 });
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2];
    stroke(ctx, [a, mid, b], 2.2, 0.8, PAL.gold, 520 + i, { jitter: 0.03, belly: 0 });
    stroke(ctx, [[a[0] + 7, a[1] - 8], [mid[0] + 8, mid[1] - 6], [b[0] + 2, b[1] + 8]], 1.6, 0.4, 'rgba(255,225,150,0.55)', 530 + i, { jitter: 0.05, belly: 0 });
  }
  // 次级覆羽（短，金铜）
  for (let i = N - 1; i >= 0; i--) {
    const u = i / (N - 1), a = pwArm(u), b = pwTip(u);
    const m: Pt = [a[0] + (b[0] - a[0]) * 0.52, a[1] + (b[1] - a[1]) * 0.52];
    const f = blade([a[0], a[1] - 2], m, 30, 34, 8, 4);
    body(ctx, f, i % 2 ? TONE.goldm : TONE.bronze, { line: 1.8, bev: 1.6, blots: 2, seed: 540 + i, wear: 0.5 });
  }
  // 前缘臂骨与鳞甲
  const top: Pt[] = [], bot: Pt[] = [];
  for (let k = 0; k <= 12; k++) { const u = k / 12, [x, y] = pwArm(u); top.push([x, y - 4]); bot.push([x, y + 34 - 14 * u]); }
  const arm = poly([...top, ...bot.reverse()], true);
  ctx.save(); ctx.translate(2, 5); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(arm.path); ctx.restore();
  body(ctx, arm, TONE.bronze, { line: 3, bev: 3, blots: 8, seed: 550, angle: Math.PI / 2 });
  scales(ctx, arm, 14, 'rgba(0,0,0,0.4)', 'rgba(255,225,150,0.22)', 1);
  const trim = new Path2D();
  for (let k = 0; k <= 12; k++) { const u = k / 12, [x, y] = pwArm(u); if (k) trim.lineTo(x, y + 34 - 14 * u); else trim.moveTo(x, y + 34); }
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = PAL.gold3; ctx.lineWidth = 3.6; ctx.stroke(trim); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1.8; ctx.stroke(trim); ctx.restore();
  // 关节
  for (const u of [0.33, 0.7]) {
    const [x, y] = pwArm(u);
    body(ctx, ell(x, y + 14, 15), TONE.goldm, { line: 2.4, bev: 2, blots: 3, seed: 560 + u * 10 });
    rivetRing(ctx, x, y + 14, 10.5, 6, 1, PAL.gold3);
  }
  // 翼根盘
  const rr: Pt = [PENG_WING_ROOT[0] - 8, 76];
  body(ctx, ell(rr[0], rr[1], 34, 32), TONE.plum, { line: 3, bev: 3, blots: 4, seed: 570 });
  body(ctx, ell(rr[0], rr[1], 24), TONE.goldm, { line: 2, bev: 2, blots: 3, seed: 571 });
  rivetRing(ctx, rr[0], rr[1], 28, 10, 1.3, PAL.gold3);
  // 炮座
  for (const [x, y] of PW_GUNS) {
    body(ctx, ell(x, y, 17), TONE.iron, { line: 2.6, bev: 2, blots: 3, seed: 580 + x });
    rivetRing(ctx, x, y, 13.5, 10, 1, PAL.gold);
    barrel(ctx, x, y + 4, y + 26, 8, TONE.bronze);
    body(ctx, ell(x - 0.4, y - 0.4, 8), TONE.goldm, { line: 1.6, bev: 1.2, blots: 0 });
  }
}
function glowPengWing(ctx: Ctx): void {
  for (let i = 0; i < PW_N; i++) {
    const u = i / (PW_N - 1), a = pwArm(u), b = pwTip(u);
    ctx.save(); ctx.globalAlpha = 0.5;
    neon(ctx, bolt([a[0] - 6, a[1] - 12], [b[0] + 4, b[1] + 8], 600 + i, 6, 3), i % 2 ? PAL.neonViolet : PAL.neonAmber, 0.9, false);
    ctx.restore();
    orb(ctx, b[0], b[1], 7, i % 3 === 0 ? PAL.neonAmber : PAL.neonViolet, 0.4);
  }
  for (const [x, y] of PW_GUNS) {
    const p = new Path2D(); p.arc(x, y, 11, 0, TAU); ctx.save(); ctx.globalAlpha = 0.85; neonPath(ctx, p, PAL.neonAmber, 1.2, false); ctx.restore();
    orb(ctx, x, y + 27, 5, PAL.neonViolet, 0.5);
  }
  orb(ctx, PENG_WING_ROOT[0] - 8, 76, 16, PAL.neonAmber, 0.4);
  for (const u of [0.33, 0.7]) { const [x, y] = pwArm(u); orb(ctx, x, y + 14, 6, PAL.neonViolet, 0.4); }
}

// 鹏 · 躯体 300x380（头朝下）
function drawPengBody(ctx: Ctx): void {
  // 尾羽扇
  for (let i = 0; i < 9; i++) {
    const t = (i - 4) / 4;
    const a: Pt = [t * 14, -116], b: Pt = [t * 120, -186 + Math.abs(t) * 34];
    const f = blade(a, b, 26, 30, 6, -t * 6);
    body(ctx, f, i % 2 ? TONE.plum : { hi: '#8a6ab8', base: '#42286c', lo: '#160c2a' }, { line: 2.2, bev: 2, blots: 3, seed: 700 + i, wear: 0.6 });
    stroke(ctx, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], 2, 0.8, PAL.gold, 710 + i, { jitter: 0.03, belly: 0 });
    const ex = a[0] + (b[0] - a[0]) * 0.72, ey = a[1] + (b[1] - a[1]) * 0.72;
    body(ctx, ell(ex, ey, 7, 9, Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2), TONE.goldm, { line: 1.4, bev: 1, blots: 0, wear: 0 });
    ctx.fillStyle = '#26124a'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, TAU); ctx.fill();
  }
  // 躯干
  const torso = sym([[0, -132], [44, -122], [76, -80], [94, -20], [92, 40], [76, 92], [46, 128], [0, 142]], true);
  ctx.save(); ctx.translate(4, 7); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(torso.path); ctx.restore();
  body(ctx, torso, TONE.plum, { line: 3.4, blots: 12, seed: 720, bev: 4.5 });
  // 羽鳞（金）
  ctx.save(); ctx.clip(torso.path);
  scales(ctx, torso, 17, 'rgba(0,0,0,0.5)', 'rgba(255,225,150,0.35)', 1.2);
  ctx.restore();
  // 胸甲金板
  const chest = sym([[0, -70], [40, -54], [66, -10], [64, 50], [44, 100], [0, 118]], true);
  body(ctx, chest, TONE.goldm, { line: 2.8, bev: 3.5, blots: 6, seed: 721 });
  scales(ctx, chest, 14, 'rgba(70,40,10,0.5)', 'rgba(255,245,210,0.35)', 1);
  // 肩甲盘（翼根）
  for (const s of [-1, 1]) {
    const x = s * -PENG_WING_L[0], y = PENG_WING_L[1];
    body(ctx, ell(x, y, 30), TONE.bronze, { line: 3, bev: 3, blots: 4, seed: 730 + s });
    rivetRing(ctx, x, y, 24, 12, 1.4, PAL.gold, 0.2);
    body(ctx, ell(x, y, 15), TONE.plum, { line: 2.2, bev: 2, blots: 2, seed: 732 + s });
  }
  // 核心座
  body(ctx, ell(0, 20, 62), TONE.bronze, { line: 3.4, bev: 3.4, blots: 5, seed: 740 });
  rivetRing(ctx, 0, 20, 56, 18, 1.4, PAL.gold, 0.1);
  body(ctx, ell(0, 20, 52), { hi: '#26122e', base: '#0e0616', lo: '#020104' }, { line: 2.4, bev: 4, blots: 2, wear: 0, seed: 741 });
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + 0.4;
    const claw = poly([[Math.cos(a - 0.13) * 64, 20 + Math.sin(a - 0.13) * 64], [Math.cos(a) * 44, 20 + Math.sin(a) * 44], [Math.cos(a + 0.13) * 64, 20 + Math.sin(a + 0.13) * 64]], true);
    body(ctx, claw, TONE.goldm, { line: 1.6, bev: 1.2, blots: 0, wear: 0 });
  }
  // 颈羽领（层叠）
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 7; i++) {
      const t = (i - 3) / 3, y0 = 98 + r * 10;
      const f = blade([t * 26, y0], [t * (52 - r * 8), y0 + 30 - Math.abs(t) * 10], 22, 24, 5, 0);
      body(ctx, f, r ? TONE.goldm : TONE.plum, { line: 1.8, bev: 1.3, blots: 1, seed: 750 + i + r * 8, wear: 0.4 });
    }
  }
  // 头
  const hy = 0;
  ctx.save(); ctx.translate(0, 122); ctx.scale(1.25, 1.25);
  for (const s of [-1, 1]) {
    // 冠羽
    for (let i = 0; i < 3; i++) stroke(ctx, [[s * (8 + i * 5), hy - 22], [s * (24 + i * 10), hy - 40 - i * 4], [s * (34 + i * 12), hy - 44 - i * 10]], 9 - i * 2, 1.5, i % 2 ? PAL.gold2 : PAL.cinnabar2, 760 + i + s * 5, { jitter: 0.1 });
  }
  const head = sym([[0, hy - 30], [22, hy - 26], [32, hy - 6], [26, hy + 14], [12, hy + 22], [0, hy + 24]], true);
  ctx.save(); ctx.translate(3, 4); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(head.path); ctx.restore();
  body(ctx, head, TONE.plum, { line: 3, bev: 3, blots: 5, seed: 770 });
  scales(ctx, head, 9, 'rgba(0,0,0,0.5)', 'rgba(255,225,150,0.3)', 0.9);
  for (const s of [-1, 1]) {
    const brow = poly([[s * 6, hy - 6], [s * 20, hy - 14], [s * 34, hy - 4], [s * 22, hy - 2], [s * 8, hy + 2]], true);
    body(ctx, brow, TONE.goldm, { line: 1.8, bev: 1.2, blots: 0, wear: 0 });
    body(ctx, ell(s * 17, hy + 2, 4.6, 3.2, s * -0.35), { hi: '#000', base: '#000', lo: '#000' }, { line: 1, bev: 0, blots: 0, wear: 0 });
  }
  // 钩喙（朝下）
  const beak = sym([[0, hy + 10], [13, hy + 16], [14, hy + 30], [7, hy + 44], [0, hy + 52]], false);
  ctx.save(); ctx.translate(2, 3); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(beak.path); ctx.restore();
  body(ctx, beak, TONE.goldm, { line: 2.6, bev: 2, blots: 2, seed: 780, angle: 0 });
  seamLine(ctx, [[0, hy + 14], [0, hy + 48]], 1.2, 'rgba(70,40,10,0.7)', 'rgba(255,240,200,0.5)');
  for (const s of [-1, 1]) body(ctx, ell(s * 4, hy + 20, 1.6), { hi: '#000', base: '#000', lo: '#000' }, { line: 0.5, bev: 0, blots: 0, wear: 0 });
  ctx.restore();
}
function glowPengBody(ctx: Ctx): void {
  for (let i = 0; i < 9; i++) {
    const t = (i - 4) / 4;
    const a: Pt = [t * 14, -116], b: Pt = [t * 120, -186 + Math.abs(t) * 34];
    const ex = a[0] + (b[0] - a[0]) * 0.72, ey = a[1] + (b[1] - a[1]) * 0.72;
    orb(ctx, ex, ey, 6, i % 2 ? PAL.neonAmber : PAL.neonViolet, 0.5);
    ctx.save(); ctx.globalAlpha = 0.5;
    neon(ctx, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], PAL.neonViolet, 0.8, false);
    ctx.restore();
  }
  const ring = new Path2D(); ring.arc(0, 20, 52, 0, TAU);
  ctx.save(); ctx.globalAlpha = 0.7; neonPath(ctx, ring, PAL.neonAmber, 1.6, false); ctx.restore();
  orb(ctx, 0, 20, 62, PAL.neonViolet, 0.1);
  for (const s of [-1, 1]) {
    orb(ctx, s * -PENG_WING_L[0], PENG_WING_L[1], 12, PAL.neonViolet, 0.4);
    orb(ctx, s * 21, 124.5, 9, PAL.neonAmber, 0.3);
    ctx.fillStyle = PAL.glowWhite; ctx.beginPath(); ctx.ellipse(s * 21, 124.5, 3.6, 2, s * -0.35, 0, TAU); ctx.fill();
  }
  neon(ctx, [[-30, -80], [-52, -10], [-44, 60], [-26, 96]], PAL.neonAmber, 0.9, false);
  neon(ctx, [[30, -80], [52, -10], [44, 60], [26, 96]], PAL.neonAmber, 0.9, false);
  orb(ctx, 0, 186, 5, PAL.neonAmber, 0.5);
}

// 鹏 · 核心 110x110
function drawPengCore(ctx: Ctx): void {
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + Math.PI / 8;
    const sp = poly([[Math.cos(a - 0.2) * 44, Math.sin(a - 0.2) * 44], [Math.cos(a) * 55, Math.sin(a) * 55], [Math.cos(a + 0.2) * 44, Math.sin(a + 0.2) * 44]], false);
    body(ctx, sp, TONE.goldm, { line: 1.8, bev: 1, blots: 0, wear: 0 });
  }
  body(ctx, ell(0, 0, 46), TONE.bronze, { line: 3, bev: 3, blots: 4, seed: 800 });
  rivetRing(ctx, 0, 0, 42, 16, 1.3, PAL.gold, 0.2);
  const g = ctx.createRadialGradient(-9, -10, 2, 0, 0, 36);
  g.addColorStop(0, '#fff8d8'); g.addColorStop(0.35, '#f2c25a'); g.addColorStop(0.75, '#8a4ac8'); g.addColorStop(1, '#2a1250');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 36, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, 36, 0, TAU); ctx.stroke();
  // 内部闪电纹
  stroke(ctx, [[-22, -14], [-6, -4], [-12, 6], [6, 12], [0, 24]], 4, 1.4, 'rgba(60,20,90,0.8)', 810, { jitter: 0.05, belly: 0 });
  stroke(ctx, [[22, -16], [8, -6], [14, 4], [0, 8]], 3.4, 1.2, 'rgba(60,20,90,0.7)', 811, { jitter: 0.05, belly: 0 });
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-14, -16, 8, 4.5, -0.7, 0, TAU); ctx.fill();
  // 上环
  ctx.save(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 30, 0.4, 2.2); ctx.stroke(); ctx.restore();
}
function glowPengCore(ctx: Ctx): void {
  ctx.save(); ctx.globalAlpha = 0.4; orb(ctx, 0, 0, 55, PAL.neonViolet, 0.15); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.35; orb(ctx, 0, 0, 34, PAL.neonAmber, 0.15); ctx.restore();
  neon(ctx, [[-22, -14], [-6, -4], [-12, 6], [6, 12], [0, 24]], PAL.neonAmber, 1.6);
  neon(ctx, [[22, -16], [8, -6], [14, 4], [0, 8]], PAL.neonViolet, 1.4);
}

/* ---------- 预览拼装（游戏不使用） */
function previewKun(ctx: Ctx, glow: boolean): void {
  const B = glow ? glowKunBody : drawKunBody, F = glow ? glowKunFin : drawKunFin, E = glow ? glowKunEye : drawKunEye;
  ctx.save(); ctx.translate(0, 0);
  B(ctx);
  for (const s of [-1, 1]) {
    ctx.save(); ctx.scale(s, 1); ctx.translate(KUN_FIN_L[0] - KUN_FIN_ROOT[0], KUN_FIN_L[1] - KUN_FIN_ROOT[1]); F(ctx); ctx.restore();
    ctx.save(); ctx.translate(s * -KUN_EYE_L[0], KUN_EYE_L[1]); E(ctx); ctx.restore();
  }
  ctx.restore();
}
function previewPeng(ctx: Ctx, glow: boolean): void {
  const B = glow ? glowPengBody : drawPengBody, W = glow ? glowPengWing : drawPengWing, C = glow ? glowPengCore : drawPengCore;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.scale(s, 1); ctx.translate(PENG_WING_L[0] - PENG_WING_ROOT[0], PENG_WING_L[1] - PENG_WING_ROOT[1]); W(ctx); ctx.restore();
  }
  B(ctx);
  ctx.save(); ctx.translate(0, 20); C(ctx); ctx.restore();
}

export const STAGE3_SPRITES: SpriteDef[] = [
  { id: 'e_drum', w: 64, h: 64, radius: 22, draw: drawDrumDrone, glow: glowDrumDrone },
  { id: 'e_lancer', w: 46, h: 76, radius: 14, draw: drawLancer, glow: glowLancer },
  { id: 'e_wingfort', w: 180, h: 130, radius: 55, draw: drawWingfort, glow: glowWingfort, anchors: { gun1: WF_GUNS[0], gun2: WF_GUNS[1], gun3: WF_GUNS[2], gun4: WF_GUNS[3] } },
  { id: 'm_leigong', w: 320, h: 280, radius: 90, draw: drawLeigong, glow: glowLeigong, anchors: { hammerL: [-LG_HAMMER[0], LG_HAMMER[1]], hammerR: [LG_HAMMER[0], LG_HAMMER[1]], core: LG_C } },
  {
    id: 'b_kun_body', w: 520, h: 720, radius: 180, draw: drawKunBody, glow: glowKunBody,
    anchors: {
      finL: KUN_FIN_L, eyeL: KUN_EYE_L, mouth: KUN_MOUTH, blow: KUN_BLOW,
      gun1: KUN_GUNS[0], gun2: KUN_GUNS[1], gun3: KUN_GUNS[2], gun4: KUN_GUNS[3], gun5: KUN_GUNS[4], gun6: KUN_GUNS[5],
    },
  },
  { id: 'b_kun_fin', w: 200, h: 260, radius: 70, draw: drawKunFin, glow: glowKunFin, anchors: { root: KUN_FIN_ROOT } },
  { id: 'b_kun_eye', w: 70, h: 70, radius: 30, draw: drawKunEye, glow: glowKunEye },
  { id: 'b_peng_body', w: 300, h: 380, radius: 90, draw: drawPengBody, glow: glowPengBody, anchors: { wingL: PENG_WING_L, core: [0, 20], beak: [0, 187] } },
  {
    id: 'b_peng_wing', w: 380, h: 300, radius: 110, draw: drawPengWing, glow: glowPengWing,
    anchors: { root: PENG_WING_ROOT, gun1: PW_GUNS[0], gun2: PW_GUNS[1], gun3: PW_GUNS[2] },
  },
  { id: 'b_peng_core', w: 110, h: 110, radius: 46, draw: drawPengCore, glow: glowPengCore },
  { id: 'preview_kun', w: 800, h: 740, draw: (c) => previewKun(c, false), glow: (c) => previewKun(c, true) },
  { id: 'preview_peng', w: 960, h: 480, draw: (c) => previewPeng(c, false), glow: (c) => previewPeng(c, true) },
];
