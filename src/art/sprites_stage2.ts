import type { SpriteDef } from './types';
import {
  PAL, TONE, poly, sym, ell, rrect, ngon, cog, body, bevel, scales, hatch, rivetLine, rivetRing, seamLine, seamPath,
  neon, neonPath, orb, stroke, barrel, inkOutline, dryBrush, rng,
} from './b2_helpers';
import type { Ctx, Pt, Shape } from './b2_helpers';

const TAU = Math.PI * 2;
const RED_PAPER = { hi: '#e0705a', base: '#98303a', lo: '#3a0f1c' };

/* ------------------------------------------------------------ e_lantern */
function drawLantern(ctx: Ctx): void {
  // 流苏
  for (let i = -2; i <= 2; i++) {
    stroke(ctx, [[i * 2.4, 22], [i * 3.2, 26], [i * 4.4, 30]], 1.6, 0.6, i % 2 ? PAL.cinnabar : PAL.cinnabar2, 20 + i);
  }
  ctx.fillStyle = PAL.gold2; ctx.beginPath(); ctx.arc(0, 23, 2.2, 0, TAU); ctx.fill();
  // 四枚铜刺（浮雷）
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 + 0.52, cx = Math.cos(a) * 17, cy = -1 + Math.sin(a) * 19;
    const s = poly([[cx + Math.cos(a) * 6, cy + Math.sin(a) * 6], [cx - Math.sin(a) * 3, cy + Math.cos(a) * 3], [cx + Math.sin(a) * 3, cy - Math.cos(a) * 3]]);
    body(ctx, s, TONE.bronze, { line: 1.4, bev: 0.8, blots: 0, wear: 0 });
  }
  // 提环
  const ring = new Path2D(); ring.arc(0, -27, 3.4, 0, TAU);
  ctx.strokeStyle = PAL.bronze2; ctx.lineWidth = 1.6; ctx.stroke(ring);
  // 灯身
  const b = ell(0, -1, 16.5, 19);
  body(ctx, b, RED_PAPER, { line: 2.2, blots: 6, seed: 4, bev: 2.2, wear: 0.3 });
  // 竹骨
  ctx.save(); ctx.clip(b.path);
  for (let k = -3; k <= 3; k++) {
    const p = new Path2D(); p.moveTo(k * 3.2, -19); p.quadraticCurveTo(k * 8.2, -1, k * 3.2, 19);
    seamPath(ctx, p, 1.1, 'rgba(50,20,10,0.75)', 'rgba(255,200,160,0.3)');
  }
  for (const y of [-10, 8]) {
    const p = new Path2D(); p.ellipse(0, y, 17, 3.2, 0, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = 'rgba(40,15,10,0.6)'; ctx.lineWidth = 0.9; ctx.stroke(p);
  }
  ctx.restore();
  // 铜盖
  const cap1 = rrect(-9.5, -25, 19, 7, 2.5), cap2 = rrect(-8.5, 16, 17, 6.5, 2.5);
  body(ctx, cap1, TONE.bronze, { line: 1.8, bev: 1, blots: 1 });
  body(ctx, cap2, TONE.bronze, { line: 1.8, bev: 1, blots: 1 });
  rivetLine(ctx, [-6, -21.5], [6, -21.5], 3, 0.9);
  rivetLine(ctx, [-5, 19.5], [5, 19.5], 3, 0.9);
}
function glowLantern(ctx: Ctx): void {
  const b = ell(0, -1, 16, 18.5);
  ctx.save(); ctx.clip(b.path);
  const g = ctx.createRadialGradient(-2, -3, 0, 0, -1, 20);
  g.addColorStop(0, PAL.glowWhite); g.addColorStop(0.18, PAL.neonMagenta); g.addColorStop(1, 'rgba(90,5,70,0.55)');
  ctx.globalAlpha = 0.85; ctx.fillStyle = g; ctx.fillRect(-20, -22, 40, 44);
  ctx.globalAlpha = 1; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.9;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath(); ctx.moveTo(k * 3.2, -19); ctx.quadraticCurveTo(k * 8.2, -1, k * 3.2, 19); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#000'; ctx.fillRect(-10, -26, 20, 8); ctx.fillRect(-9, 16, 18, 7);
}

/* -------------------------------------------------------------- e_junk_gun */
function drawJunkGun(ctx: Ctx): void {
  const base = ell(0, 0, 15);
  body(ctx, base, TONE.bronze, { line: 2, blots: 5, seed: 8 });
  rivetRing(ctx, 0, 0, 12.5, 10, 0.9);
  barrel(ctx, 0, 6, 17.5, 6.5, TONE.iron);
  ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(0, 17, 2.4, 0, TAU); ctx.fill();
  const dome = ell(-0.5, -0.5, 9);
  body(ctx, dome, TONE.verd, { line: 1.8, bev: 2, blots: 3, seed: 9 });
  seamLine(ctx, [[-6, 1], [0, -2], [6, 1]], 0.8);
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -0.5, 3.6, 0, TAU); ctx.stroke();
}
function glowJunkGun(ctx: Ctx): void {
  orb(ctx, 0, 0, 5, PAL.neonCyan, 0.4);
  orb(ctx, 0, 16.5, 4, PAL.neonMagenta, 0.4);
}

/* ---------------------------------------------------------------- e_junk */
const JUNK_HULL: Pt[] = [[0, -82], [22, -81], [33, -68], [38, -40], [38, -6], [34, 30], [24, 60], [10, 80], [0, 86]];
function junkHull(): Shape { return sym(JUNK_HULL, true); }
function drawJunk(ctx: Ctx): void {
  const hull = junkHull();
  // 船帆（先画，露在舷外）
  const sails: { pts: Pt[]; y: number }[] = [];
  const sail = (cx: number, cy: number, w: number, h: number, sk: number, side: number, seed: number) => {
    // 俯视：帆是斜张出舷外的长条，竹条横撑
    const s = poly([[cx, cy - h / 2], [cx + side * w, cy - h / 2 + sk], [cx + side * w * 0.95, cy + h / 2 + sk], [cx, cy + h / 2]], false);
    body(ctx, s, { hi: '#d9b877', base: '#a37f48', lo: '#4d381c' }, { line: 1.8, blots: 6, seed, bev: 1.2, wear: 0.8 });
    ctx.save(); ctx.clip(s.path);
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n, y0 = cy - h / 2 + t * h;
      seamLine(ctx, [[cx, y0], [cx + side * w, y0 + sk * (0.98)]], 1.3, 'rgba(50,30,10,0.85)', 'rgba(255,230,170,0.35)');
    }
    // 补丁 + 裂口
    const r = rng(seed);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(70,30,20,0.35)'; const px = cx + side * w * (0.3 + r() * 0.5), py = cy - h / 2 + h * r();
      ctx.fillRect(px - 3, py - 3, 8, 6);
    }
    ctx.restore();
    sails.push({ pts: [[cx, cy], [cx + side * w, cy + sk]], y: cy });
  };
  sail(-14, -40, 32, 46, 12, -1, 31);
  sail(14, 8, 34, 46, 10, 1, 32);
  sail(-10, 50, 26, 26, 8, -1, 33);
  // 船身
  body(ctx, hull, { hi: '#8c6a3f', base: '#5a4029', lo: '#241a10' }, { line: 2.6, blots: 12, seed: 6, bev: 3 });
  // 甲板板缝
  ctx.save(); ctx.clip(hull.path);
  for (let x = -30; x <= 30; x += 6.5) seamLine(ctx, [[x, -84], [x * 1.0, 86]], 0.8, 'rgba(0,0,0,0.5)', 'rgba(255,220,160,0.14)');
  ctx.restore();
  // 内甲板（深色凹槽）
  const deck = sym([[0, -70], [16, -68], [24, -40], [24, -6], [20, 28], [10, 66], [0, 72]], true);
  ctx.save(); ctx.clip(deck.path);
  ctx.fillStyle = 'rgba(15,8,4,0.55)'; ctx.fill(deck.path);
  for (let y = -70; y < 72; y += 5) seamLine(ctx, [[-30, y], [30, y]], 0.7, 'rgba(0,0,0,0.5)', 'rgba(255,220,160,0.1)');
  ctx.restore();
  inkOutline(ctx, deck.path, 1.4, PAL.ink, 4);
  // 舷侧铜甲片
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const y = -66 + i * 21, w = i < 5 ? 8 : 6 - (i - 5) * 1.5;
      const xe = sgn * (i === 0 ? 24 : Math.min(38, 25 + i * 3 - (i > 4 ? (i - 4) * 5 : 0)) - 4);
      const plate = rrect(Math.min(xe, xe + sgn * w), y, w, 17, 2);
      body(ctx, plate, TONE.bronze, { line: 1.5, bev: 1.1, blots: 1, seed: i + (sgn > 0 ? 40 : 50), wear: 0.5 });
      rivetLine(ctx, [xe + sgn * w * 0.5, y + 4], [xe + sgn * w * 0.5, y + 13], 2, 0.8);
    }
  }
  // 艉楼（屋顶瓦）
  const castle = rrect(-24, -76, 48, 30, 5);
  body(ctx, castle, TONE.lacquer, { line: 2.2, bev: 2 });
  const roof = poly([[-28, -68], [0, -80], [28, -68], [24, -50], [0, -44], [-24, -50]], true);
  body(ctx, roof, TONE.verd, { line: 2, bev: 2, blots: 6, seed: 12 });
  hatch(ctx, roof, Math.PI / 2, 4, 'rgba(0,20,15,0.55)', 0.9, 0.7, 4);
  seamLine(ctx, [[0, -79], [0, -46]], 1.6);
  for (const x of [-27, 27]) stroke(ctx, [[x, -68], [x * 1.12, -58], [x * 1.05, -52]], 2.6, 1, PAL.bronze2, 41);
  // 桅杆顶座
  for (const [x, y] of [[-14, -40], [14, 8], [-10, 52]] as Pt[]) {
    const m = ell(x, y, 4.5); body(ctx, m, TONE.bronze, { line: 1.6, bev: 1, blots: 0 }); rivetLine(ctx, [x, y], [x, y], 1, 1.1, PAL.gold);
  }
  // 炮座
  for (const [x, y] of [[0, 52], [0, -50]] as Pt[]) {
    const r = ell(x, y, 19);
    body(ctx, r, TONE.iron, { line: 2, bev: 1.6, blots: 3, seed: 17 });
    rivetRing(ctx, x, y, 16, 12, 0.9, PAL.bronze);
  }
  // 船首龙首
  const bow = poly([[-9, 78], [0, 92], [9, 78], [4, 72], [-4, 72]], true);
  body(ctx, bow, TONE.bronze, { line: 1.8, bev: 1.2 });
  seamLine(ctx, [[0, 74], [0, 86]], 1);
  // 水线锈迹
  dryBrush(ctx, hull.path, hull.bb, 'rgba(60,140,120,0.7)', { count: 40, angle: Math.PI / 2, len: 14, width: 1.2, alpha: 0.35, seed: 61 });
}
function glowJunk(ctx: Ctx): void {
  const hull = junkHull();
  // 舷缘霓虹裂缝
  neon(ctx, [[-33, -50], [-36, -28], [-35, -6], [-30, 20]], PAL.neonMagenta, 1.2);
  neon(ctx, [[33, -46], [36, -24], [35, 4], [30, 26]], PAL.neonMagenta, 1.2);
  neon(ctx, [[-9, 76], [0, 88], [9, 76]], PAL.neonCyan, 1.6);
  // 炮座光环
  for (const y of [52, -50]) {
    const p = new Path2D(); p.arc(0, y, 18, 0, TAU); ctx.globalAlpha = 0.7; neonPath(ctx, p, PAL.neonCyan, 1.0, false); ctx.globalAlpha = 1;
  }
  // 艉楼窗
  for (const x of [-12, 0, 12]) orb(ctx, x, -60, 4, PAL.neonMagenta, 0.5);
  // 帆上裂缝
  neon(ctx, [[-28, -42], [-34, -36], [-42, -38]], PAL.neonMagenta, 0.9);
  neon(ctx, [[28, 6], [34, 12], [44, 12]], PAL.neonCyan, 0.9);
  void hull;
}

/* --------------------------------------------------------------- e_rotor */
const ROTOR_FRAMES = 4;
function drawRotor(ctx: Ctx, f: number): void {
  const ang = (f / ROTOR_FRAMES) * (TAU / 3);
  // 支臂
  const arms: Pt[] = [[-18, -18], [18, -18], [-18, 18], [18, 18]];
  for (const [x, y] of arms) {
    stroke(ctx, [[0, 0], [x * 0.5, y * 0.5], [x, y]], 7, 5, PAL.ink, 3);
    stroke(ctx, [[-0.5, -0.5], [x * 0.5 - 0.5, y * 0.5 - 0.5], [x - 0.5, y - 0.5]], 4.2, 3, PAL.iron, 4, { jitter: 0.05 });
  }
  arms.forEach(([x, y], i) => {
    // 旋翼台
    body(ctx, ell(x, y, 5.5), TONE.bronze, { line: 1.5, bev: 1, blots: 1 });
    // 模糊圆盘
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(200,190,170,0.13)'; ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,220,200,0.22)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 11.2, 0, TAU); ctx.stroke();
    ctx.rotate(ang * (i % 2 ? -1 : 1) + i);
    for (let k = 0; k < 3; k++) {
      ctx.rotate(TAU / 3);
      stroke(ctx, [[1, 0], [6, -0.6], [11.5, 0.4]], 3.2, 1.6, PAL.ink2, 10 + k, { jitter: 0.05, belly: 0.1 });
      stroke(ctx, [[1.5, -0.8], [6, -1.2], [10.5, -0.3]], 1.1, 0.6, 'rgba(200,190,170,0.6)', 20 + k, { jitter: 0.03 });
    }
    ctx.restore();
    ctx.fillStyle = PAL.gold2; ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
  });
  // 中央机壳（八角，铜+铜绿）
  const core = ngon(0, 0, 13.5, 8, Math.PI / 8);
  body(ctx, core, TONE.bronze, { line: 2.2, bev: 2, blots: 6, seed: 22 });
  const top = ngon(-0.5, -0.5, 8.6, 8, Math.PI / 8);
  body(ctx, top, TONE.verd, { line: 1.5, bev: 1.4, blots: 3, seed: 23 });
  rivetRing(ctx, 0, 0, 11.3, 8, 0.8, PAL.gold2, Math.PI / 8);
  ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(0, 2, 4.4, 0, TAU); ctx.fill();
}
function glowRotor(ctx: Ctx, f: number): void {
  orb(ctx, 0, 2, 6.5, PAL.neonCyan, 0.4);
  const ang = (f / ROTOR_FRAMES) * (TAU / 3);
  for (const [x, y] of [[-18, -18], [18, -18], [-18, 18], [18, 18]] as Pt[]) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.5;
    ctx.strokeStyle = PAL.neonMagenta; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 11.2, ang, ang + 1.6); ctx.stroke();
    ctx.restore();
  }
}

/* ---------------------------------------------------------------- e_moth */
function mothWing(ctx: Ctx, f: number): void {
  // 左半，翅展 f0 全开 / f1 收拢
  const k = f === 0 ? 1 : 0.72, up = f === 0 ? 0 : 6;
  const fore = poly([[-4, -6], [-14 * k, -22 + up], [-32 * k, -24 + up], [-34 * k, -10 + up * 0.5], [-30 * k, 10], [-12, 8]], true);
  const hind = poly([[-4, 2], [-14 * k, 6], [-28 * k, 16 + up * 0.5], [-22 * k, 27], [-8, 18]], true);
  body(ctx, hind, TONE.plum, { line: 2, bev: 1.8, blots: 6, seed: 33 });
  body(ctx, fore, TONE.night, { line: 2.2, bev: 2, blots: 8, seed: 34 });
  // 翅脉
  ctx.save(); ctx.clip(fore.path);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    stroke(ctx, [[-5, -3], [-16 * k, -16 + up + t * 22], [-33 * k, -22 + up + t * 32]], 1.6, 0.6, PAL.bronze, 40 + i, { jitter: 0.05 });
  }
  ctx.restore();
  dryBrush(ctx, fore.path, fore.bb, 'rgba(160,110,255,0.6)', { count: 40, angle: Math.PI, len: 8, width: 1, alpha: 0.35, seed: 35 });
  ctx.save(); ctx.clip(hind.path);
  for (let i = 0; i < 4; i++) stroke(ctx, [[-5, 4], [-14 * k, 8 + i * 4], [-26 * k, 14 + i * 4]], 1.4, 0.5, PAL.bronze, 50 + i, { jitter: 0.05 });
  ctx.restore();
  // 翅缘铜镶边
  ctx.save(); ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1.3; ctx.stroke(fore.path); ctx.restore();
}
function drawMoth(ctx: Ctx, f: number): void {
  // 触角（朝下）
  for (const s of [-1, 1]) stroke(ctx, [[s * 3, 16], [s * 7, 24], [s * 11, 27]], 2, 0.6, PAL.ink, 60);
  ctx.save(); mothWing(ctx, f); ctx.scale(-1, 1); mothWing(ctx, f); ctx.restore();
  // 腹部（朝上）
  const abd = ell(0, -14, 5, 12);
  body(ctx, abd, TONE.bronze, { line: 1.8, bev: 1.5, blots: 3, seed: 36 });
  for (let y = -22; y < -4; y += 3.6) seamLine(ctx, [[-4.5, y], [4.5, y]], 0.8);
  // 胸（毛茸）
  const th = ell(0, 2, 7, 8);
  body(ctx, th, TONE.iron, { line: 2, bev: 1.6, blots: 4, seed: 37 });
  dryBrush(ctx, th.path, th.bb, PAL.paper3, { count: 20, angle: Math.PI / 2, len: 5, width: 0.9, alpha: 0.4, seed: 38 });
  // 头 + 复眼
  const head = ell(0, 13, 5.2, 4.6);
  body(ctx, head, TONE.bronze, { line: 1.6, bev: 1.2, blots: 1 });
}
function glowMoth(ctx: Ctx, f: number): void {
  const k = f === 0 ? 1 : 0.72, up = f === 0 ? 0 : 6;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.scale(s, 1);
    // 前翅眼斑
    const ex = -22 * k, ey = -8 + up * 0.5;
    orb(ctx, ex, ey, 8, PAL.neonMagenta, 0.15);
    ctx.strokeStyle = PAL.neonCyan; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(ex, ey, 4.8 * k + 0.6, 0, TAU); ctx.stroke();
    ctx.fillStyle = PAL.glowWhite; ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, TAU); ctx.fill();
    // 后翅眼斑
    orb(ctx, -16 * k, 17, 5, PAL.neonViolet, 0.25);
    // 翅缘霓虹
    neon(ctx, [[-14 * k, -22 + up], [-32 * k, -24 + up], [-34 * k, -10 + up * 0.5]], PAL.neonViolet, 0.8);
    ctx.restore();
  }
  orb(ctx, -2.2, 13, 2.6, PAL.neonCyan, 0.5); orb(ctx, 2.2, 13, 2.6, PAL.neonCyan, 0.5);
  neon(ctx, [[0, -24], [0, -6]], PAL.neonMagenta, 1);
}


/* ---------------------------------------------------------- m_pagoda 280x320 */
function roofPath(h: number, cx = 0, cy = 0, tip = 0.1, sag = 0.045): Path2D {
  const p = new Path2D(), e = h * tip, m = h * sag;
  const T = (sx: number, sy: number): Pt => [cx + sx * (h + e), cy + sy * (h + e)];
  p.moveTo(...T(-1, -1));
  p.quadraticCurveTo(cx, cy - h + m, ...T(1, -1));
  p.quadraticCurveTo(cx + h - m, cy, ...T(1, 1));
  p.quadraticCurveTo(cx, cy + h - m, ...T(-1, 1));
  p.quadraticCurveTo(cx - h + m, cy, ...T(-1, -1));
  p.closePath();
  return p;
}
function drawRoofTier(ctx: Ctx, h: number, cy: number, seed: number, tone: { hi: string; base: string; lo: string } = TONE.verd, gold = true): void {
  const path = roofPath(h, 0, cy);
  const bb: [number, number, number, number] = [-h * 1.15, cy - h * 1.15, h * 2.3, h * 2.3];
  const sh: Shape = { path, bb };
  // 投影
  ctx.save(); ctx.translate(6, 9); ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fill(path); ctx.translate(-3, -4); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(path); ctx.restore();
  body(ctx, sh, tone, { line: 2.4, blots: 10, seed, bev: 2.5, wear: 0.3 });
  // 四面坡：不同明暗
  const faces: { pts: Pt[]; c: string; ang: number }[] = [
    { pts: [[-1, -1], [1, -1], [0, 0]], c: 'rgba(200,255,235,0.16)', ang: Math.PI / 2 },
    { pts: [[-1, -1], [-1, 1], [0, 0]], c: 'rgba(200,255,235,0.08)', ang: 0 },
    { pts: [[-1, 1], [1, 1], [0, 0]], c: 'rgba(0,0,0,0.26)', ang: Math.PI / 2 },
    { pts: [[1, -1], [1, 1], [0, 0]], c: 'rgba(0,0,0,0.38)', ang: 0 },
  ];
  for (const f of faces) {
    const face = poly(f.pts.map(([x, y]) => [x * (h + 4), cy + y * (h + 4)] as Pt));
    ctx.save(); ctx.clip(path); ctx.fillStyle = f.c; ctx.fill(face.path); ctx.restore();
    // 瓦垄（沿坡向）+ 瓦当短弧
    const clipShape: Shape = { path: (() => { const q = new Path2D(); q.addPath(face.path); return q; })(), bb: face.bb };
    ctx.save(); ctx.clip(path);
    hatch(ctx, clipShape, f.ang, 3.4, 'rgba(0,10,10,0.6)', 0.8, 0.5, 4.2);
    ctx.restore();
  }
  // 垂脊（对角线）
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]) {
    stroke(ctx, [[0, cy], [sx * h * 0.55, cy + sy * h * 0.55], [sx * (h + h * 0.12), cy + sy * (h + h * 0.12)]], 4.2, 2.4, PAL.bronze2, seed + 3, { jitter: 0.05 });
    stroke(ctx, [[-0.6, cy - 0.6], [sx * h * 0.55 - 0.6, cy + sy * h * 0.55 - 0.6], [sx * (h + h * 0.12) - 0.6, cy + sy * (h + h * 0.12) - 0.6]], 1.6, 1, '#b08a54', seed + 4, { jitter: 0.03 });
  }
  // 檐口金边 + 翘角铃
  if (gold) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = PAL.gold3; ctx.lineWidth = 3; ctx.stroke(path);
    ctx.strokeStyle = PAL.gold2; ctx.lineWidth = 1.5; ctx.stroke(path); ctx.restore();
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]) {
    const x = sx * (h * 1.1), y = cy + sy * (h * 1.1);
    body(ctx, ell(x, y, h * 0.06 + 1.5), TONE.goldm, { line: 1.2, bev: 0.8, blots: 0, wear: 0 });
  }
}
function drawPagodaGun(ctx: Ctx, x: number, y: number, r = 11): void {
  body(ctx, ell(x, y, r), TONE.bronze, { line: 2, bev: 1.6, blots: 3, seed: 71 });
  rivetRing(ctx, x, y, r - 2.6, 8, 0.8);
  ctx.save(); ctx.translate(x, y);
  barrel(ctx, 0, 3, r + 8, 6.5, TONE.iron);
  body(ctx, ell(-0.4, -0.4, r * 0.5), TONE.verd, { line: 1.6, bev: 1.2, blots: 1 });
  ctx.restore();
}
const PAGODA_GUNS: Pt[] = [[-46, 130], [46, 130], [-118, 44], [118, 44], [-118, -76], [118, -76]];
function drawPagoda(ctx: Ctx): void {
  // 侧舱（先画，在船体之后被压住）
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.scale(sgn, 1);
    // 连接撑杆
    for (const y of [-80, 30]) {
      const st = rrect(60, y - 7, 62, 14, 3);
      body(ctx, st, TONE.iron, { line: 2, bev: 1.5, blots: 2, seed: 80 + y });
      rivetLine(ctx, [72, y], [112, y], 4, 0.9);
    }
    const pod = poly([[96, -112], [118, -122], [140, -108], [142, 60], [130, 96], [112, 106], [98, 92]], true);
    body(ctx, pod, TONE.bronze, { line: 2.6, blots: 8, seed: 82, bev: 3 });
    const cover = poly([[104, -96], [132, -96], [134, 52], [124, 84], [108, 84], [104, 40]], true);
    body(ctx, cover, TONE.verd, { line: 1.8, bev: 2, blots: 5, seed: 83 });
    for (let y = -90; y < 70; y += 9) seamLine(ctx, [[105, y], [133, y]], 0.9);
    // 尾喷口
    const noz = rrect(106, -128, 24, 14, 4);
    body(ctx, noz, TONE.iron, { line: 2, bev: 1.3, blots: 1 });
    ctx.restore();
  }
  // 船体
  const hull = sym([[0, -152], [40, -150], [70, -128], [82, -90], [92, -30], [96, 50], [84, 100], [56, 132], [24, 150], [0, 158]], true);
  body(ctx, hull, TONE.lacquer, { line: 3, blots: 10, seed: 84, bev: 3.5 });
  // 甲板栏杆纹
  hatch(ctx, hull, Math.PI / 2, 6, 'rgba(0,0,0,0.35)', 0.8, 0.6);
  // 船首镶铜 + 龙首
  const prow = sym([[0, 158], [14, 146], [30, 122], [16, 118], [0, 132]], false);
  body(ctx, prow, TONE.bronze, { line: 2, bev: 1.4, blots: 2 });
  // 艉部尾舱铜环
  const tail = sym([[0, -152], [30, -150], [46, -132], [0, -118]]);
  body(ctx, tail, TONE.bronze, { line: 2, bev: 1.4, blots: 3, seed: 85 });
  body(ctx, rrect(-16, -156, 32, 14, 4), TONE.iron, { line: 2, bev: 1.3, blots: 1 });
  // 五层宝塔屋顶
  drawRoofTier(ctx, 98, 8, 90, TONE.verd);
  drawRoofTier(ctx, 74, 8, 91, { hi: '#a8503f', base: '#6a2226', lo: '#240c10' });
  drawRoofTier(ctx, 52, 8, 92, TONE.verd);
  drawRoofTier(ctx, 34, 8, 93, TONE.bronze);
  // 塔顶：金莲座 + 宝珠
  const lotus = ngon(0, 8, 14, 8, Math.PI / 8, 9.5);
  body(ctx, lotus, TONE.goldm, { line: 1.8, bev: 1.5, blots: 2, seed: 94 });
  body(ctx, ell(-0.5, 7.5, 6.2), { hi: '#5a3a5f', base: '#26142c', lo: '#0c0610' }, { line: 1.6, bev: 1.5, blots: 0, wear: 0 });
  // 炮座
  for (const [x, y] of PAGODA_GUNS) drawPagodaGun(ctx, x, y, x === 0 ? 11 : 12);
}
function glowPagoda(ctx: Ctx): void {
  orb(ctx, 0, 8, 22, PAL.neonMagenta, 0.3);
  ctx.fillStyle = PAL.neonMagenta; ctx.beginPath(); ctx.arc(0, 8, 4.5, 0, TAU); ctx.fill();
  // 檐角风铃灯
  for (const h of [98, 74, 52]) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]) orb(ctx, sx * h * 1.1, 8 + sy * h * 1.1, 4.5, PAL.neonAmber, 0.35);
  }
  // 屋檐霓虹缝
  for (const h of [98, 52]) {
    ctx.save(); ctx.globalAlpha = 0.5; neonPath(ctx, roofPath(h * 0.94, 0, 8), PAL.neonMagenta, 0.8, false); ctx.restore();
  }
  // 侧舱喷口 + 主喷口
  for (const x of [-118, 118]) { orb(ctx, x, -120, 12, PAL.neonCyan, 0.4); }
  orb(ctx, 0, -152, 12, PAL.neonCyan, 0.4);
  // 炮座
  for (const [x, y] of PAGODA_GUNS) {
    const p = new Path2D(); p.arc(x, y, 8, 0, TAU); ctx.save(); ctx.globalAlpha = 0.85; neonPath(ctx, p, PAL.neonCyan, 1, false); ctx.restore();
    orb(ctx, x, y + 19, 3.5, PAL.neonMagenta, 0.5);
  }
  // 船体缝
  neon(ctx, [[-60, -138], [-76, -112]], PAL.neonViolet, 1.1); neon(ctx, [[60, -138], [76, -112]], PAL.neonViolet, 1.1);
  neon(ctx, [[0, 146], [14, 132], [30, 122]], PAL.neonCyan, 1.1); neon(ctx, [[0, 146], [-14, 132], [-30, 122]], PAL.neonCyan, 1.1);
}

/* ============================================================== 蜃 */
const NACRE: { hi: string; base: string; lo: string } = { hi: '#e2d4f4', base: '#8462b8', lo: '#2b1a4e' };
const SHELL_PIVOT: Pt = [115, 0];
const SHELL_RX = 212, SHELL_RY = 152, SHELL_LOBES = 9;
const SHELL_SPAN = 80 * Math.PI / 180;
function shellPt(phi: number, k: number, scallop = true): Pt {
  const lobe = (phi + SHELL_SPAN) / (2 * SHELL_SPAN) * SHELL_LOBES;
  const sc = scallop ? 1 + 0.05 * (Math.abs(Math.sin(Math.PI * lobe)) - 0.5) : 1;
  return [SHELL_PIVOT[0] - SHELL_RX * Math.cos(phi) * k * sc, SHELL_RY * Math.sin(phi) * k * sc];
}
function shellFan(k: number, scallop = true): Shape {
  const pts: Pt[] = [[116, -13]];
  const n = 72;
  for (let i = 0; i <= n; i++) pts.push(shellPt(-SHELL_SPAN + (i / n) * 2 * SHELL_SPAN, k, scallop));
  pts.push([116, 13]);
  return poly(pts, false);
}
const SHELL_GUNS: Pt[] = [shellPt(-0.86, 0.66, false), shellPt(0.86, 0.66, false)];
function drawShell(ctx: Ctx): void {
  const outer = shellFan(1);
  ctx.save(); ctx.translate(3, 4); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(outer.path); ctx.restore();
  body(ctx, outer, TONE.bronze, { line: 3, blots: 12, seed: 100, bev: 3 });
  // 内衬珍珠母
  const inner = shellFan(0.83);
  body(ctx, inner, NACRE, { line: 2.2, blots: 10, seed: 101, bev: 3, wear: 0.2, angle: Math.PI / 6 });
  // 珍珠母虹彩条纹
  ctx.save(); ctx.clip(inner.path);
  for (let i = 0; i < 26; i++) {
    const phi = -SHELL_SPAN + (i + 0.5) / 26 * 2 * SHELL_SPAN;
    const a = shellPt(phi, 0.12, false), b = shellPt(phi + 0.03, 0.82, false);
    stroke(ctx, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], 1.6, 3.6, i % 3 === 0 ? 'rgba(90,240,255,0.3)' : i % 3 === 1 ? 'rgba(255,90,210,0.22)' : 'rgba(255,255,255,0.22)', 110 + i, { jitter: 0.2, dry: 0.6 });
  }
  // 生长纹
  for (const k of [0.32, 0.5, 0.67]) {
    const f = shellFan(k, false);
    ctx.save(); ctx.translate(0, 0); seamPath(ctx, f.path, 1.1, 'rgba(30,10,60,0.55)', 'rgba(255,255,255,0.3)'); ctx.restore();
  }
  ctx.restore();
  // 放射肋
  for (let i = 0; i <= SHELL_LOBES; i++) {
    const phi = -SHELL_SPAN + (i / SHELL_LOBES) * 2 * SHELL_SPAN;
    const a = shellPt(phi, 0.1, false), b = shellPt(phi, 1.0);
    seamLine(ctx, [a, shellPt(phi, 0.83, false)], 1.2, 'rgba(30,10,60,0.6)', 'rgba(255,255,255,0.25)');
    stroke(ctx, [shellPt(phi, 0.83, false), [(shellPt(phi, 0.83, false)[0] + b[0]) / 2, (shellPt(phi, 0.83, false)[1] + b[1]) / 2], b], 3.4, 2.2, PAL.bronze2, 120 + i, { jitter: 0.08 });
  }
  // 边缘铜甲片（每瓣一片）
  for (let i = 0; i < SHELL_LOBES; i++) {
    const p0 = -SHELL_SPAN + (i / SHELL_LOBES) * 2 * SHELL_SPAN, p1 = -SHELL_SPAN + ((i + 1) / SHELL_LOBES) * 2 * SHELL_SPAN;
    const pts: Pt[] = [];
    for (let j = 0; j <= 6; j++) pts.push(shellPt(p0 + (p1 - p0) * j / 6 + 0.01, 0.865, false));
    for (let j = 6; j >= 0; j--) pts.push(shellPt(p0 + (p1 - p0) * j / 6 + 0.01, 0.985, true));
    const plate = poly(pts);
    body(ctx, plate, i % 2 ? TONE.bronze : TONE.verd, { line: 1.7, blots: 2, seed: 130 + i, bev: 1.6, wear: 0.6 });
    const mid = shellPt((p0 + p1) / 2, 0.925, false);
    rivetLine(ctx, mid, mid, 1, 1.4, PAL.gold);
  }
  // 铰链
  const hinge = rrect(94, -42, 26, 84, 8);
  body(ctx, hinge, TONE.bronze, { line: 2.6, bev: 2.6, blots: 4, seed: 140, angle: 0 });
  for (let y = -34; y <= 34; y += 17) seamLine(ctx, [[95, y], [119, y]], 1.3);
  rivetLine(ctx, [107, -34], [107, 34], 5, 1.6, PAL.gold);
  for (const sg of [-1, 1]) body(ctx, ell(107, sg * 50, 9), TONE.verd, { line: 2, bev: 1.6, blots: 2 });
  // 炮座
  for (const [x, y] of SHELL_GUNS) {
    body(ctx, ell(x, y, 14), TONE.bronze, { line: 2.4, bev: 1.8, blots: 3, seed: 150 });
    rivetRing(ctx, x, y, 11, 8, 0.9);
    barrel(ctx, x, y + 3, y + 22, 7.5, TONE.iron);
    body(ctx, ell(x - 0.4, y - 0.4, 7), TONE.iron, { line: 1.6, bev: 1.4, blots: 1 });
  }
}
function glowShell(ctx: Ctx): void {
  // 内衬边缘霓虹
  const inner = shellFan(0.83);
  ctx.save(); ctx.globalAlpha = 0.65;
  const g = ctx.createLinearGradient(-100, -100, 100, 100);
  g.addColorStop(0, PAL.neonCyan); g.addColorStop(0.5, PAL.neonMagenta); g.addColorStop(1, PAL.neonViolet);
  ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'; ctx.stroke(inner.path); ctx.restore();
  ctx.save(); ctx.clip(inner.path);
  for (let i = 0; i < SHELL_LOBES; i++) {
    const phi = -SHELL_SPAN + ((i + 0.5) / SHELL_LOBES) * 2 * SHELL_SPAN;
    ctx.globalAlpha = 0.22;
    neon(ctx, [shellPt(phi, 0.2, false), shellPt(phi + 0.01, 0.5, false), shellPt(phi, 0.8, false)], i % 2 ? PAL.neonViolet : PAL.neonCyan, 1.1, false);
  }
  const rg = ctx.createRadialGradient(SHELL_PIVOT[0] - 40, 0, 0, SHELL_PIVOT[0] - 40, 0, 150);
  rg.addColorStop(0, 'rgba(160,96,255,0.16)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 1; ctx.fillStyle = rg; ctx.fillRect(-140, -170, 280, 340);
  ctx.restore();
  for (const [x, y] of SHELL_GUNS) {
    const p = new Path2D(); p.arc(x, y, 10.5, 0, TAU); ctx.save(); ctx.globalAlpha = 0.85; neonPath(ctx, p, PAL.neonCyan, 1.1, false); ctx.restore();
    orb(ctx, x, y + 22, 4, PAL.neonMagenta, 0.5);
  }
  orb(ctx, 107, 0, 6, PAL.neonCyan, 0.4);
}

// 蜃 · 躯体 360x300
const MIRAGE_PEARL: Pt = [0, -15], MIRAGE_HEAD: Pt = [0, 122], MIRAGE_SHELL_L: Pt = [-140, -20];
function mantleEdge(side: number): Pt[] {
  // 波浪褶边，从上到下
  const pts: Pt[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = -Math.PI * 0.62 + t * Math.PI * 1.1;
    const R = 1 + 0.045 * Math.sin(t * Math.PI * 14);
    pts.push([side * Math.cos(a) * 172 * R, -6 + Math.sin(a) * 138 * R]);
  }
  return pts;
}
function drawMirageBody(ctx: Ctx): void {
  // 外套膜（两侧褶边）
  for (const sg of [-1, 1]) {
    const edge = mantleEdge(sg);
    const m = poly([[sg * 60, -132], ...edge, [sg * 60, 128]], false);
    ctx.save(); ctx.translate(3, 5); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(m.path); ctx.restore();
    body(ctx, m, TONE.plum, { line: 2.8, blots: 12, seed: 160 + sg, bev: 3, angle: sg > 0 ? Math.PI / 3 : Math.PI / 6 });
    ctx.save(); ctx.clip(m.path);
    for (let i = 0; i < 16; i++) {
      const t = i / 15, a = -Math.PI * 0.6 + t * Math.PI * 1.06;
      stroke(ctx, [[sg * 90, -6 + Math.sin(a) * 40], [sg * (120 + Math.cos(a) * 20), -6 + Math.sin(a) * 90], [sg * Math.cos(a) * 168, -6 + Math.sin(a) * 134]], 2.8, 1.2, 'rgba(255,190,230,0.3)', 170 + i, { jitter: 0.15, dry: 0.4 });
      stroke(ctx, [[sg * 90, -4 + Math.sin(a) * 40 + 1.5], [sg * (120 + Math.cos(a) * 20), -4 + Math.sin(a) * 90], [sg * Math.cos(a) * 168, -4 + Math.sin(a) * 134]], 1.6, 0.6, 'rgba(0,0,0,0.5)', 190 + i, { jitter: 0.1 });
    }
    ctx.restore();
    // 铰接座
    const hx = -MIRAGE_SHELL_L[0] * sg, hy = MIRAGE_SHELL_L[1];
    body(ctx, ell(sg * -MIRAGE_SHELL_L[0] * 1, hy, 26), TONE.bronze, { line: 2.4, bev: 2.4, blots: 4, seed: 200 });
    rivetRing(ctx, hx, hy, 20, 10, 1.2, PAL.gold);
    void hx;
  }
  // 躯干
  const torso = sym([[0, -146], [46, -142], [84, -120], [108, -80], [116, -30], [112, 30], [100, 84], [78, 118], [50, 140], [0, 148]], true);
  ctx.save(); ctx.translate(2, 5); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(torso.path); ctx.restore();
  body(ctx, torso, TONE.lacquer, { line: 3.2, blots: 14, seed: 210, bev: 4 });
  scales(ctx, torso, 11, 'rgba(0,0,0,0.38)', 'rgba(255,190,200,0.14)', 1);
  // 铰合板（顶部）：铜板 + 齿
  const hingePlate = sym([[0, -146], [46, -142], [84, -120], [92, -96], [50, -84], [0, -80]], false);
  body(ctx, hingePlate, TONE.bronze, { line: 2.6, bev: 2.4, blots: 5, seed: 211 });
  for (let i = -4; i <= 4; i++) {
    const x = i * 17;
    const tooth = poly([[x - 6, -84 + Math.abs(i) * 1.5], [x, -70 + Math.abs(i) * 2.2], [x + 6, -84 + Math.abs(i) * 1.5]]);
    body(ctx, tooth, TONE.iron, { line: 1.5, bev: 1, blots: 0, wear: 0 });
  }
  // 顶部散热孔
  for (const x of [-42, 0, 42]) {
    body(ctx, rrect(x - 11, -128, 22, 18, 5), TONE.iron, { line: 1.8, bev: 1.4, blots: 0, wear: 0 });
    for (let k = 0; k < 3; k++) seamLine(ctx, [[x - 8, -123 + k * 5], [x + 8, -123 + k * 5]], 1);
  }
  // 珍珠座
  const [px, py] = MIRAGE_PEARL;
  body(ctx, ell(px, py, 62), TONE.bronze, { line: 3, bev: 3, blots: 5, seed: 212 });
  rivetRing(ctx, px, py, 56, 20, 1.3, PAL.gold, 0.1);
  const cup = ell(px, py, 50);
  body(ctx, cup, { hi: '#2a1832', base: '#120a1a', lo: '#05030a' }, { line: 2.4, bev: 4, blots: 3, seed: 213, wear: 0 });
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + 0.2;
    const claw = poly([[px + Math.cos(a - 0.14) * 66, py + Math.sin(a - 0.14) * 66], [px + Math.cos(a) * 36, py + Math.sin(a) * 36], [px + Math.cos(a + 0.14) * 66, py + Math.sin(a + 0.14) * 66]], true);
    body(ctx, claw, i % 2 ? TONE.goldm : TONE.bronze, { line: 1.6, bev: 1.2, blots: 0, wear: 0.2 });
  }
  // 颈环（龙首接口）
  const [hx, hy] = MIRAGE_HEAD;
  const collar = poly([[-58, hy - 62], [58, hy - 62], [70, hy - 36], [-70, hy - 36]], true);
  void collar;
  const neck = sym([[0, hy - 78], [44, hy - 78], [58, hy - 58], [64, hy - 40]], true);
  body(ctx, neck, TONE.bronze, { line: 2.4, bev: 2, blots: 3, seed: 214 });
  for (let i = 0; i < 6; i++) seamLine(ctx, [[-52 + i * 21, hy - 76], [-58 + i * 23, hy - 42]], 1.1);
  void hx;
  // 躯干缝合线
  seamLine(ctx, [[-96, -60], [-104, 0], [-92, 60]], 1.4);
  seamLine(ctx, [[96, -60], [104, 0], [92, 60]], 1.4);
  rivetLine(ctx, [-108, -50], [-100, 50], 6, 1.4, PAL.gold2);
  rivetLine(ctx, [108, -50], [100, 50], 6, 1.4, PAL.gold2);
}
function glowMirageBody(ctx: Ctx): void {
  // 外套膜发光脉络
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.globalAlpha = 0.26;
    for (let i = 0; i < 16; i++) {
      const t = i / 15, a = -Math.PI * 0.6 + t * Math.PI * 1.06;
      neon(ctx, [[sg * 118, -6 + Math.sin(a) * 60], [sg * 145, -6 + Math.sin(a) * 96], [sg * Math.cos(a) * 168, -6 + Math.sin(a) * 132]], i % 2 ? PAL.neonMagenta : PAL.neonViolet, 0.8, false);
    }
    ctx.restore();
    // 边缘
    ctx.save(); ctx.globalAlpha = 0.4;
    const e = mantleEdge(sg); const p = new Path2D(); e.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    neonPath(ctx, p, PAL.neonCyan, 0.9, false); ctx.restore();
    orb(ctx, sg * -MIRAGE_SHELL_L[0], MIRAGE_SHELL_L[1], 9, PAL.neonCyan, 0.3);
  }
  // 散热孔
  for (const x of [-42, 0, 42]) { ctx.fillStyle = 'rgba(0,0,0,0)'; orb(ctx, x, -118, 10, PAL.neonCyan, 0.4); }
  // 珍珠座内环
  const [px, py] = MIRAGE_PEARL;
  const ring = new Path2D(); ring.arc(px, py, 50, 0, TAU);
  ctx.save(); ctx.globalAlpha = 0.8; neonPath(ctx, ring, PAL.neonMagenta, 1.6, false); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.35; orb(ctx, px, py, 58, PAL.neonViolet, 0.1); ctx.restore();
  // 躯干接缝
  neon(ctx, [[-80, -100], [-100, -60], [-96, 0]], PAL.neonViolet, 1.1);
  neon(ctx, [[80, -100], [100, -60], [96, 0]], PAL.neonViolet, 1.1);
  const [, hy] = MIRAGE_HEAD;
  neon(ctx, [[-50, hy - 74], [0, hy - 82], [50, hy - 74]], PAL.neonMagenta, 1.1);
}

// 蜃 · 珍珠 100x100
function drawPearl(ctx: Ctx): void {
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 + 0.3;
    const claw = poly([[Math.cos(a - 0.2) * 49, Math.sin(a - 0.2) * 49], [Math.cos(a) * 28, Math.sin(a) * 28], [Math.cos(a + 0.2) * 49, Math.sin(a + 0.2) * 49]], true);
    body(ctx, claw, TONE.goldm, { line: 1.8, bev: 1.2, blots: 0, wear: 0.2 });
  }
  const R = 39;
  ctx.save(); ctx.translate(2, 3); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.restore();
  const g = ctx.createRadialGradient(-12, -14, 2, 0, 0, R);
  g.addColorStop(0, '#fff8ff'); g.addColorStop(0.3, '#e9c8f2'); g.addColorStop(0.62, '#9a72d0'); g.addColorStop(0.85, '#4a3a92'); g.addColorStop(1, '#1d1848');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  const c = new Path2D(); c.arc(0, 0, R, 0, TAU);
  ctx.save(); ctx.clip(c);
  const cols = ['rgba(90,255,255,0.35)', 'rgba(255,80,210,0.32)', 'rgba(255,230,120,0.25)'];
  for (let i = 0; i < 9; i++) {
    stroke(ctx, [[-36, -14 + i * 7], [0, -4 + i * 6 + Math.sin(i) * 4], [36, -18 + i * 7]], 4, 2, cols[i % 3], 230 + i, { jitter: 0.2, dry: 0.5 });
  }
  ctx.restore();
  inkOutline(ctx, c, 2.2, PAL.ink, 231);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-14, -16, 8, 5, -0.7, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(10, 18, 3, 0, TAU); ctx.fill();
}
function glowPearl(ctx: Ctx): void {
  ctx.save(); ctx.globalAlpha = 0.32; orb(ctx, 0, 0, 50, PAL.neonMagenta, 0.05); orb(ctx, -4, -4, 30, PAL.neonCyan, 0.08); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.7; orb(ctx, -12, -14, 6, PAL.glowWhite, 0.8); ctx.restore();
}

// 蜃 · 龙首 180x160（朝下，嘴在下方）
function drawMirageHead(ctx: Ctx): void {
  const half = (fn: () => void) => { fn(); ctx.save(); ctx.scale(-1, 1); fn(); ctx.restore(); };
  // 龙须
  half(() => {
    stroke(ctx, [[-30, 46], [-58, 60], [-78, 44], [-86, 20]], 4, 1, PAL.gold2, 300, { jitter: 0.1 });
    stroke(ctx, [[-31, 44], [-58, 57], [-78, 42], [-85, 20]], 1.6, 0.6, PAL.gold, 301, { jitter: 0.05 });
    stroke(ctx, [[-28, 52], [-50, 74], [-70, 76]], 3, 0.8, PAL.gold2, 302, { jitter: 0.1 });
    // 犄角
    stroke(ctx, [[-22, -50], [-40, -66], [-66, -70], [-84, -56]], 9, 3, PAL.bronze2, 303, { jitter: 0.08 });
    stroke(ctx, [[-23, -52], [-40, -68], [-65, -72], [-83, -58]], 3.2, 1.2, '#b08a54', 304, { jitter: 0.06 });
    stroke(ctx, [[-52, -68], [-56, -52], [-66, -42]], 5, 1.4, PAL.bronze2, 305);
    // 鬃毛
    for (let i = 0; i < 4; i++) stroke(ctx, [[-42 - i * 3, -30 + i * 10], [-62 - i * 4, -24 + i * 12], [-80 - i * 2, -8 + i * 14]], 6, 1.5, i % 2 ? '#4a2350' : PAL.verdigris2, 310 + i, { jitter: 0.12 });
  });
  // 头骨
  const skull = sym([[0, -74], [26, -70], [46, -48], [56, -14], [56, 16], [50, 40], [36, 54], [24, 66], [0, 78]], true);
  ctx.save(); ctx.translate(2, 4); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(skull.path); ctx.restore();
  body(ctx, skull, { hi: '#6aa593', base: '#345f54', lo: '#12241f' }, { line: 3, blots: 8, seed: 320, bev: 3.5 });
  scales(ctx, skull, 8, 'rgba(0,25,20,0.5)', 'rgba(200,255,235,0.2)', 0.9);
  // 额脊
  for (let i = 0; i < 7; i++) {
    const y = -66 + i * 12, w = 7 - i * 0.4;
    const f = poly([[0, y], [w, y + 7], [0, y + 12], [-w, y + 7]]);
    body(ctx, f, TONE.goldm, { line: 1.4, bev: 0.9, blots: 0, wear: 0 });
  }
  // 眉骨 + 眼眶
  half(() => {
    const brow = poly([[-14, -20], [-30, -26], [-52, -16], [-46, -8], [-24, -12]], true);
    body(ctx, brow, TONE.bronze, { line: 2, bev: 1.4, blots: 1, seed: 321 });
    body(ctx, ell(-34, -4, 8.5, 6, 0.3), { hi: '#20101c', base: '#0f060e', lo: '#05020a' }, { line: 1.8, bev: 1.5, blots: 0, wear: 0 });
    // 鼻孔与鼻隆
    body(ctx, ell(-13, 50, 8, 6.5), TONE.verd, { line: 2, bev: 1.4, blots: 1 });
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.ellipse(-13, 51, 3.2, 2.2, 0.3, 0, TAU); ctx.fill();
    // 面颊铜片
    const cheek = poly([[-44, 8], [-56, 14], [-52, 36], [-38, 34]], true);
    body(ctx, cheek, TONE.bronze, { line: 1.6, bev: 1.2, blots: 1, seed: 322 });
    rivetLine(ctx, [-48, 16], [-46, 30], 2, 1, PAL.gold);
  });
  // 口腔（朝下张开）
  const mouth = sym([[0, 62], [22, 62], [30, 74], [14, 80], [0, 78]], true);
  body(ctx, mouth, { hi: '#3a0f28', base: '#1a0512', lo: '#0a0208' }, { line: 2, bev: 1.2, blots: 0, wear: 0 });
  // 獠牙
  half(() => {
    for (const [x, len] of [[-24, 13], [-15, 9]] as Pt[]) {
      const t = poly([[x - 4, 64], [x + 4, 64], [x + 1, 64 + len]]);
      body(ctx, t, TONE.paper, { line: 1.3, bev: 0.7, blots: 0, wear: 0 });
    }
  });
  const tongue = poly([[-6, 64], [6, 64], [0, 74]]);
  body(ctx, tongue, TONE.plum, { line: 1, bev: 0.5, blots: 0, wear: 0 });
}
function glowMirageHead(ctx: Ctx): void {
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.scale(sg, 1);
    // 眼
    orb(ctx, -34, -4, 13, PAL.neonMagenta, 0.3);
    ctx.fillStyle = PAL.glowWhite; ctx.beginPath(); ctx.ellipse(-34, -4, 5.5, 2.2, 0.3, 0, TAU); ctx.fill();
    // 须尖
    orb(ctx, -85, 20, 7, PAL.neonCyan, 0.4); orb(ctx, -70, 76, 6, PAL.neonCyan, 0.4);
    // 犄角尖
    orb(ctx, -83, -57, 6, PAL.neonViolet, 0.4);
    // 鬃毛
    neon(ctx, [[-44, -30], [-64, -24], [-80, -8]], PAL.neonViolet, 0.8, false);
    ctx.restore();
  }
  // 口腔
  orb(ctx, 0, 70, 16, PAL.neonCyan, 0.35);
  orb(ctx, 0, 72, 9, PAL.neonMagenta, 0.5);
  // 额脊
  neon(ctx, [[0, -66], [0, 12]], PAL.neonCyan, 0.9);
}

/* ---------- 预览：蜃 / 宝塔拼装（游戏不使用） */
function previewMirage(ctx: Ctx, glow: boolean): void {
  const g = glow ? 1 : 0;
  const B = g ? glowMirageBody : drawMirageBody, S = g ? glowShell : drawShell;
  const P = g ? glowPearl : drawPearl, H = g ? glowMirageHead : drawMirageHead;
  ctx.save(); ctx.translate(0, -40);
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.scale(sg, 1); ctx.translate(MIRAGE_SHELL_L[0] - 118, MIRAGE_SHELL_L[1]); S(ctx); ctx.restore();
  }
  B(ctx);
  ctx.save(); ctx.translate(MIRAGE_PEARL[0], MIRAGE_PEARL[1]); P(ctx); ctx.restore();
  ctx.save(); ctx.translate(MIRAGE_HEAD[0], MIRAGE_HEAD[1]); H(ctx); ctx.restore();
  ctx.restore();
}

export const STAGE2_SPRITES: SpriteDef[] = [
  { id: 'e_lantern', w: 44, h: 56, radius: 15, draw: drawLantern, glow: glowLantern },
  { id: 'e_junk', w: 100, h: 170, radius: 34, draw: drawJunk, glow: glowJunk, anchors: { gunF: [0, 52], gunR: [0, -50] } },
  { id: 'e_junk_gun', w: 36, h: 36, radius: 12, draw: drawJunkGun, glow: glowJunkGun, anchors: { muzzle: [0, 17] } },
  { id: 'e_rotor', w: 60, h: 60, frames: ROTOR_FRAMES, radius: 20, draw: drawRotor, glow: glowRotor },
  { id: 'e_moth', w: 70, h: 56, frames: 2, radius: 20, draw: drawMoth, glow: glowMoth },
  {
    id: 'm_pagoda', w: 280, h: 320, radius: 90, draw: drawPagoda, glow: glowPagoda,
    anchors: { gun1: PAGODA_GUNS[0], gun2: PAGODA_GUNS[1], gun3: PAGODA_GUNS[2], gun4: PAGODA_GUNS[3], gun5: PAGODA_GUNS[4], gun6: PAGODA_GUNS[5], core: [0, 8] },
  },
  {
    id: 'b_mirage_body', w: 360, h: 300, radius: 110, draw: drawMirageBody, glow: glowMirageBody,
    anchors: { shellL: MIRAGE_SHELL_L, pearl: MIRAGE_PEARL, head: MIRAGE_HEAD },
  },
  {
    id: 'b_mirage_shell', w: 240, h: 320, radius: 100, draw: drawShell, glow: glowShell,
    anchors: { root: [118, 0], gun1: SHELL_GUNS[0], gun2: SHELL_GUNS[1] },
  },
  { id: 'b_mirage_pearl', w: 100, h: 100, radius: 40, draw: drawPearl, glow: glowPearl },
  { id: 'b_mirage_head', w: 180, h: 160, radius: 60, draw: drawMirageHead, glow: glowMirageHead, anchors: { mouth: [0, 68], neck: [0, -72] } },
  { id: 'preview_mirage', w: 760, h: 440, draw: (c) => previewMirage(c, false), glow: (c) => previewMirage(c, true) },
];
