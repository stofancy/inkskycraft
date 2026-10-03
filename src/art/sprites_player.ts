import type { SpriteDef } from './types';
import { PAL, brushStroke, inkOutline, goldTrim, glowDot, symmetric, pathFrom } from './style';
import type { Pt } from './style';
import { plate, line, groove, dots, feather, ellipsePath, neonLine, bevel, litFill, bboxOf, softShadow } from './b1_helpers';

// 翼根（未倾斜时相对机身中心）与羽毛几何（左翼局部坐标，翼根为原点）
const ROOT: Pt = [-4.5, -3];
const MEMB: Pt[] = [[0, -10], [-7, -9.5], [-15, -3], [-22, 8], [-29, 22], [-22, 19], [-14, 17], [-7, 17], [0, 15]];
const F_BASE: Pt[] = [[-20, 10], [-16, 10], [-12, 11], [-9, 12], [-6, 13], [-3, 14]];
const F_TIP: Pt[] = [[-33, 29], [-29, 31], [-25, 32], [-20, 33], [-14, 34], [-8, 34]];

function wingScale(side: number, t: number): number { return 1 + side * -0.17 * t * -1 * -1 * (side < 0 ? 1 : 1); }

function sideScale(side: -1 | 1, t: number): number {
  // t<0 左倾：左翼压低（缩短），右翼抬起（拉长）
  return side < 0 ? 1 + 0.22 * t : 1 - 0.22 * t;
}
void wingScale;

function drawWing(ctx: CanvasRenderingContext2D, side: -1 | 1, t: number, bx: number): void {
  const s = sideScale(side, t);
  const lit = side < 0; // 左侧受光
  ctx.save();
  ctx.translate(bx + side * -ROOT[0], ROOT[1]);
  ctx.scale(-side * s * 0.9, 1);
  // 飞羽（后画的压在前面：从外到内）
  for (let i = 0; i < F_BASE.length; i++) {
    const [x0, y0] = F_BASE[i], [x1, y1] = F_TIP[i];
    const w = 6.4 - i * 0.2;
    feather(ctx, x0, y0, x1, y1, w, lit ? PAL.ink2 : '#1b1613', lit ? '#0c0908' : '#0c0908', null, 20 + i, 1.2);
    // 朱砂羽尖（外 45%）
    const dx = x1 - x0, dy = y1 - y0;
    brushStroke(ctx, [[x0 + dx * 0.5, y0 + dy * 0.5], [x0 + dx * 0.75, y0 + dy * 0.75], [x1, y1]], w * 0.72, 0.5, lit ? PAL.cinnabar : PAL.cinnabar2, { seed: 40 + i, jitter: 0.1 });
    line(ctx, [[x0 + dx * 0.18, y0 + dy * 0.18], [x0 + dx * 0.9, y0 + dy * 0.9]], lit ? 'rgba(241,232,212,0.55)' : 'rgba(241,232,212,0.25)', 0.6);
  }
  // 翼膜/覆羽
  const mp = plate(ctx, MEMB, {
    light: lit ? '#4a4038' : '#33302b', base: lit ? PAL.ink2 : '#1f1a16', dark: PAL.ink, edge: PAL.ink, edgeW: 1.5, seed: 6, wear: 'rgba(241,232,212,0.5)', wearN: 14,
  });
  // 覆羽鳞片（朱砂）
  for (let i = 0; i < 3; i++) {
    const y = 0 + i * 4.4;
    brushStroke(ctx, [[-3, y - 3], [-11 - i * 1.5, y - 1], [-19 + i * 2, y + 6 - i * 0.5]], 4.2 - i * 0.4, 1.2, lit ? PAL.cinnabar : PAL.cinnabar2, { seed: 60 + i, jitter: 0.1 });
    brushStroke(ctx, [[-4, y - 3.7], [-11 - i * 1.5, y - 1.7], [-19 + i * 2, y + 5.2 - i * 0.5]], 0.9, 0.3, 'rgba(255,226,190,0.55)', { seed: 70 + i });
  }
  void mp;
  // 前缘金边
  const lead = pathFrom([[0, -10], [-7, -9.5], [-15, -3], [-22, 8], [-30, 24]], false, true);
  goldTrim(ctx, lead, 1.3);
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, t: number, bx: number): void {
  ctx.save();
  const k = 1 - 0.07 * Math.abs(t);
  ctx.translate(bx, 0);
  ctx.scale(k, 1);
  // 尾羽（机身后）
  for (const sg of [-1, 1]) {
    feather(ctx, sg * 2.5, 26, sg * 9, 39, 5, PAL.ink2, PAL.ink, null, 90 + sg, sg * 0.8);
    feather(ctx, sg * 1.5, 27, sg * 4.5, 40, 4.2, PAL.cinnabar2, PAL.ink, PAL.gold, 95 + sg, sg * 0.5);
  }
  // 引擎舱
  for (const sg of [-1, 1]) {
    const e = plate(ctx, [[sg * 3.2, 20], [sg * 6.8, 20], [sg * 7.2, 31], [sg * 2.8, 31]].map(([x, y]) => [x, y] as Pt), {
      light: PAL.ink3, base: PAL.ink2, dark: PAL.ink, edgeW: 1.3, seed: 12 + sg,
    });
    void e;
    line(ctx, [[sg * 3, 31.3], [sg * 7.2, 31.3]], PAL.gold, 1.6);
  }
  // 机身
  const left: Pt[] = [[-1.2, -38.6], [-3.2, -32], [-5.6, -22], [-6.6, -8], [-6.4, 6], [-5.2, 20], [-3.6, 30]];
  const pts = symmetric(left);
  const body = plate(ctx, pts, {
    light: '#5b4f44', base: PAL.ink2, dark: PAL.ink, smooth: true, edgeW: 2, seed: 4, wear: 'rgba(241,232,212,0.55)', wearN: 18, blots: 3,
  });
  // 朱砂前甲
  const front: Pt[] = [[-3.2, -30], [0, -36], [3.2, -30], [4.6, -20], [4.2, -5], [0, -1], [-4.2, -5], [-4.6, -20]];
  const fp = pathFrom(front, true, true);
  litFill(ctx, fp, bboxOf(front), '#f07a4c', PAL.cinnabar, PAL.cinnabar3, { seed: 8, blots: 3 });
  bevel(ctx, fp, 'rgba(255,220,180,0.55)', 'rgba(60,8,2,0.55)', 0.9, 1.3);
  inkOutline(ctx, fp, 1.1, PAL.ink, 21);
  // 座舱
  const cp = ellipsePath(0, -15, 3.3, 6.6);
  ctx.save();
  const g = ctx.createLinearGradient(-3, -21, 3, -9);
  g.addColorStop(0, '#f4d9a0'); g.addColorStop(0.45, '#7b5a34'); g.addColorStop(1, '#1a120c');
  ctx.fillStyle = g; ctx.fill(cp);
  ctx.restore();
  inkOutline(ctx, cp, 1.3, PAL.ink, 33);
  goldTrim(ctx, cp, 0.8);
  ctx.fillStyle = 'rgba(255,250,235,0.85)';
  ctx.beginPath(); ctx.ellipse(-1.2, -18, 0.9, 2.4, 0.15, 0, 7); ctx.fill();
  // 后段：漆黑背脊 + 金色纹
  groove(ctx, [[-4.6, 4], [0, 8], [4.6, 4]], 0.8);
  groove(ctx, [[-4.8, 11], [0, 15], [4.8, 11]], 0.8);
  line(ctx, [[0, -1], [0, 26]], 'rgba(232,184,90,0.7)', 0.8);
  dots(ctx, [[-3, 19], [3, 19], [-3.4, 24], [3.4, 24]], 0.7, PAL.gold);
  // 金色喙饰
  const beak = pathFrom([[-2.4, -30], [0, -38.4], [2.4, -30], [0, -27.4]], true);
  litFill(ctx, beak, [-2.4, -39.6, 4.8, 12], '#ffe6a0', PAL.gold, PAL.gold3, { seed: 2, blots: 0 });
  inkOutline(ctx, beak, 0.9, PAL.ink, 44);
  // 机身金边
  goldTrim(ctx, pathFrom([[-4.8, -18], [-5.8, -6], [-5.6, 6]], false, true), 0.9);
  goldTrim(ctx, pathFrom([[4.8, -18], [5.8, -6], [5.6, 6]], false, true), 0.9);
  void body;
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, frame: number): void {
  const t = (frame - 2) / 2;
  const bx = t * 2.2;
  // 投影式暗边让机体从背景中跳出来
  drawWing(ctx, t <= 0 ? 1 : -1, t, bx); // 先画抬起（较远/较大）的一侧
  drawWing(ctx, t <= 0 ? -1 : 1, t, bx);
  drawBody(ctx, t, bx);
}

function glowPlayer(ctx: CanvasRenderingContext2D, frame: number): void {
  const t = (frame - 2) / 2;
  const bx = t * 2.2;
  const k = 1 - 0.07 * Math.abs(t);
  // 双尾焰
  for (const sg of [-1, 1]) {
    const x = bx + sg * 5 * k;
    const g = ctx.createLinearGradient(0, 30, 0, 40);
    g.addColorStop(0, '#fff6e0'); g.addColorStop(0.35, '#ffb35a'); g.addColorStop(1, 'rgba(216,57,31,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 2.2, 31); ctx.quadraticCurveTo(x - 2.4, 36, x, 40); ctx.quadraticCurveTo(x + 2.4, 36, x + 2.2, 31); ctx.closePath(); ctx.fill();
    ctx.restore();
    glowDot(ctx, x, 31.5, 4.5, PAL.glowFire, 0.3);
  }
  // 翼尖灯
  for (const sg of [-1, 1] as const) {
    const s = sideScale(sg, t);
    const x = bx + sg * -ROOT[0] + sg * s * -30 * -1 * -1;
    void x;
    const tx = bx + sg * (-ROOT[0] + s * 0.9 * 31);
    glowDot(ctx, tx, ROOT[1] + 26, 4.2, PAL.cinnabar, 0.3);
  }
  // 座舱
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(bx - 0.6, -17, 0.3, bx, -15, 6);
  cg.addColorStop(0, 'rgba(255,236,200,0.55)'); cg.addColorStop(0.5, 'rgba(255,160,70,0.3)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(bx, -15, 4, 7.5, 0, 0, 7); ctx.fill();
  ctx.restore();
  void neonLine; void softShadow; void inkOutline; void brushStroke; void groove; void dots; void feather;
}

const player: SpriteDef = {
  id: 'player', w: 72, h: 80, frames: 5, radius: 3,
  draw: drawPlayer, glow: glowPlayer,
  anchors: {
    gun: [0, -38], gunL: [-7, -26], gunR: [7, -26], missileL: [-19, 6], missileR: [19, 6], engineL: [-5, 32], engineR: [5, 32],
  },
};

// 制作人原画：前三格为朝上的紫、青、朱弹，后六格为各色两帧命中。
// 同一 WebP 只在 Atlas.build 初始化时加载、烘焙一次；原画带透明，走普通混合层 shotArt。
export const PRIMARY_SHOT_FRAME = { purple: 0, blue: 1, red: 2 };
export const PRIMARY_HIT_FRAME = { purple: 3, blue: 5, red: 7 };
const primaryArt: SpriteDef = {
  id: 'player_primary_art', w: 72, h: 72, textureScale: 192 / 72,
  sheet: { image: 'art/player/shots/primary-atlas.webp', columns: 3, rows: 3, count: 9, fps: 10, mode: 'once' },
};

// ---- 墨矢 12x36（朝上） ----
const missile: SpriteDef = {
  id: 'player_missile', w: 12, h: 36, radius: 3,
  draw(ctx) {
    // 尾羽
    for (const sg of [-1, 1]) {
      const fp = pathFrom([[0, 4], [sg * 5.2, 9], [sg * 4.6, 15], [0, 12]], true, false);
      litFill(ctx, fp, [-5, 4, 10, 11], sg < 0 ? '#f0603a' : PAL.cinnabar, PAL.cinnabar, PAL.cinnabar3, { seed: 3 + sg, blots: 0 });
      inkOutline(ctx, fp, 0.9, PAL.ink, 5 + sg);
      line(ctx, [[sg * 0.5, 6], [sg * 4.2, 13]], 'rgba(255,220,180,0.6)', 0.5);
    }
    // 箭杆
    const shaft = pathFrom([[-1.6, -8], [1.6, -8], [1.9, 14], [-1.9, 14]], true);
    litFill(ctx, shaft, [-2, -8, 4, 22], '#4a4038', PAL.ink2, PAL.ink, { seed: 5, blots: 0 });
    inkOutline(ctx, shaft, 1, PAL.ink, 9);
    line(ctx, [[-0.6, -6], [-0.6, 12]], 'rgba(241,232,212,0.45)', 0.5);
    // 金环
    line(ctx, [[-1.9, 1], [1.9, 1]], PAL.gold, 1);
    // 笔锋形箭头
    const head = pathFrom([[0, -18], [3.6, -9], [1.8, -6.5], [-1.8, -6.5], [-3.6, -9]], true, false);
    litFill(ctx, head, [-3.6, -18, 7.2, 12], '#e9e2d0', '#8d867a', '#3a352f', { seed: 6, blots: 0 });
    bevel(ctx, head, 'rgba(255,255,255,0.6)', 'rgba(0,0,0,0.4)', 0.7, 1);
    inkOutline(ctx, head, 1.1, PAL.ink, 11);
    line(ctx, [[0, -16], [0, -7]], 'rgba(20,16,12,0.5)', 0.5);
  },
  glow(ctx) {
    glowDot(ctx, 0, 16, 6, PAL.glowFire, 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 13, 0, 18);
    g.addColorStop(0, '#fff6e0'); g.addColorStop(0.5, '#ffb35a'); g.addColorStop(1, 'rgba(216,57,31,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-1.6, 13); ctx.quadraticCurveTo(0, 20, 1.6, 13); ctx.fill();
    ctx.restore();
  },
};

// ---- 朱砂火羽弹 16x40（朝上），沿用 V1（tag v1）原图 ----
const shotRed: SpriteDef = {
  id: 'player_shot_red', w: 16, h: 40, radius: 4,
  draw(ctx) {
    const p = pathFrom([[0, -19], [3.2, -8], [4, 6], [1.6, 17], [0, 19], [-1.6, 17], [-4, 6], [-3.2, -8]], true, true);
    ctx.fillStyle = PAL.cinnabar; ctx.fill(p);
    ctx.save(); ctx.clip(p);
    ctx.fillStyle = PAL.cinnabar3; ctx.fillRect(0, -20, 6, 40);
    ctx.restore();
    line(ctx, [[0, -17], [0, 17]], '#ffcf8a', 0.8);
  },
  glow(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, -19, 0, 19);
    g.addColorStop(0, '#ffe2b0'); g.addColorStop(0.3, '#ff9a4a'); g.addColorStop(0.7, '#d8391f'); g.addColorStop(1, 'rgba(110,20,9,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, -19); ctx.quadraticCurveTo(5.6, -6, 3.6, 8); ctx.quadraticCurveTo(2.4, 15, 0, 19); ctx.quadraticCurveTo(-2.4, 15, -3.6, 8); ctx.quadraticCurveTo(-5.6, -6, 0, -19); ctx.fill();
    // 羽枝
    ctx.strokeStyle = 'rgba(255,225,170,0.6)'; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const y = -10 + i * 5.5, w = 3.6 - Math.abs(i - 1.5) * 0.35;
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-w, y + 4); ctx.moveTo(0, y); ctx.lineTo(w, y + 4); ctx.stroke();
    }
    ctx.lineWidth = 1; ctx.strokeStyle = '#ffe9c0';
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 12); ctx.stroke();
    ctx.restore();
  },
};

export const PLAYER_SPRITES: SpriteDef[] = [player, primaryArt, missile, shotRed];
