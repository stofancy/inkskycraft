import type { SpriteDef } from './types';
import { PAL, glyph, inkOutline, glowDot, symmetric, pathFrom, rng } from './style';
import type { Pt } from './style';
import {
  plate, line, groove, dots, ellipsePath, neonLine, neonSeamDraw, bevel, litFill, rectPath,
} from './b1_helpers';

// V2 八角牌「矢」，由图集初始化时绘制一次。
function missileItemPoints(r: number): Pt[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + i * Math.PI / 4;
    return [Math.cos(a) * r * 1.03, Math.sin(a) * r * 1.03];
  });
}
function missileItemPath(r: number): Path2D {
  return pathFrom(missileItemPoints(r), true, true);
}
function drawMissileItem(ctx: CanvasRenderingContext2D): void {
  const s = { l: '#e9e0cc', b: '#8f8570', d: '#3d362b', glow: '#ffe8c0', gcol: PAL.ink, ch: '矢' };
  const R = 18.4;
  const fr = ['#fbe6a8', PAL.gold, PAL.gold3];
  // 外框（金）
  const outer = missileItemPath(R);
  ctx.save(); ctx.translate(1, 1.6); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.fill(outer); ctx.restore();
  litFill(ctx, outer, [-R, -R, R * 2, R * 2], fr[0], fr[1], fr[2], { seed: 4, blots: 2, wear: 'rgba(255,240,200,0.5)', wearN: 8 });
  bevel(ctx, outer, 'rgba(255,250,225,0.8)', 'rgba(60,30,4,0.6)', 1, 1.8);
  inkOutline(ctx, outer, 1.6, PAL.ink, 9);
  // 内晶
  const ri = R * 0.76;
  const inner = missileItemPath(ri);
  litFill(ctx, inner, [-ri, -ri, ri * 2, ri * 2], s.l, s.b, s.d, { seed: 6, blots: 3, blotColor: 'rgba(255,255,255,0.10)' });
  // 切面
  ctx.save();
  ctx.clip(inner);
  const vs = missileItemPoints(ri);
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i], b = vs[(i + 1) % vs.length];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const facing = -(mx + my) / (Math.hypot(mx, my) * 1.414 || 1); // 朝左上为正
    ctx.fillStyle = facing > 0 ? `rgba(255,255,255,${0.16 * facing})` : `rgba(0,0,0,${-0.28 * facing})`;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
    line(ctx, [[a[0] * 0.5, a[1] * 0.5], a], 'rgba(255,255,255,0.22)', 0.6);
  }
  // 内环
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.8;
  ctx.stroke(missileItemPath(ri * 0.62));
  // 左上高光弧
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, ri * 0.86, Math.PI * 1.02, Math.PI * 1.42); ctx.stroke();
  ctx.restore();
  inkOutline(ctx, inner, 1.1, PAL.ink, 12);
  // 字
  const col = s.gcol;
  const ol = 'rgba(255,245,215,0.55)';
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1.4]]) glyph(ctx, s.ch, ox * 0.9, oy * 0.9, 17, ol);
  glyph(ctx, s.ch, 0, 0, 17, col);
}

function glowMissileItem(ctx: CanvasRenderingContext2D): void {
  const R = 18.4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(0.9, '#ffe8c0'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.5; ctx.fillStyle = g; ctx.fillRect(-20, -20, 40, 40);
  ctx.globalAlpha = 0.05; ctx.fillStyle = '#ffe8c0'; ctx.fill(missileItemPath(R * 0.68));
  ctx.restore();
}

// ============ 道具 ============
// 场内墨锭沿用图集初始化烘焙；HUD 图标的黑底和方框留在界面里。
function drawInkItem(ctx: CanvasRenderingContext2D): void {
  ctx.save();ctx.rotate(Math.PI / 6);
  const body = rectPath(-9, -15, 18, 30, 2);
  litFill(ctx, body, [-9, -15, 18, 30], '#746650', '#302d2a', '#15110e', {seed:6,blots:2});
  bevel(ctx, body, '#e0be78', '#302016', 1, 2);
  inkOutline(ctx, body, 1.4, PAL.ink, 9);
  ctx.strokeStyle='#b99a5d';ctx.lineWidth=1;ctx.stroke(rectPath(-6,-12,12,24,1));
  glyph(ctx, '墨', 0, 0, 12, '#e9d6a6');
  ctx.restore();
}
const ITEMS: SpriteDef[] = [
  { id: 'item_missile', w: 40, h: 40, radius: 16, draw: drawMissileItem, glow: glowMissileItem },
  { id: 'item_p', w: 36, h: 36, radius: 16, image: '/art/icons/items/power.png' },
  { id: 'item_bomb', w: 36, h: 36, radius: 16, image: '/art/icons/items/bomb.png' },
  { id: 'item_ink', w: 36, h: 36, radius: 16, draw: drawInkItem },
  { id: 'item_medal', w: 36, h: 36, radius: 16, image: '/art/icons/items/gold-seal.png' },
];

// ---- 奖牌 32x32：方孔钱 ----
const medal: SpriteDef = {
  id: 'item_gold', w: 32, h: 32, radius: 12,
  draw(ctx) {
    const disc = ellipsePath(0, 0, 15, 15);
    ctx.save(); ctx.translate(0.8, 1.4); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.fill(disc); ctx.restore();
    litFill(ctx, disc, [-15, -15, 30, 30], '#ffeaa8', PAL.gold, PAL.gold3, { seed: 3, blots: 4, wear: 'rgba(255,245,210,0.6)', wearN: 14 });
    bevel(ctx, disc, 'rgba(255,252,230,0.85)', 'rgba(60,30,4,0.6)', 1, 1.8);
    inkOutline(ctx, disc, 1.4, PAL.ink, 5);
    // 内缘环
    const ring = ellipsePath(0, 0, 12, 12);
    ctx.save(); ctx.strokeStyle = PAL.gold3; ctx.lineWidth = 1.2; ctx.stroke(ring);
    ctx.translate(-0.5, -0.5); ctx.strokeStyle = 'rgba(255,245,210,0.8)'; ctx.lineWidth = 0.7; ctx.stroke(ring); ctx.restore();
    // 放射刻痕
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + 0.26;
      line(ctx, [[Math.cos(a) * 8.6, Math.sin(a) * 8.6], [Math.cos(a) * 11.2, Math.sin(a) * 11.2]], 'rgba(122,84,24,0.7)', 0.8);
    }
    // 方孔
    const hole = rectPath(-4.6, -4.6, 9.2, 9.2, 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out'; ctx.fill(hole);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2; ctx.stroke(hole);
    ctx.strokeStyle = PAL.gold3; ctx.lineWidth = 0.9; ctx.stroke(hole);
    ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(4.9, 4.9); ctx.lineTo(-4.9, 4.9); ctx.lineTo(-4.9, -4.9); ctx.stroke();
    ctx.restore();
    // 四个"印"点
    dots(ctx, [[0, -9.4], [0, 9.4], [-9.4, 0], [9.4, 0]], 1, PAL.gold3, 'rgba(255,240,200,0.7)');
    // 高光弧
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 13.4, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  },
  glow(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 9, 0, 0, 16);
    g.addColorStop(0, 'rgba(255,200,90,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-16, -16, 32, 32);
    ctx.restore();
    glowDot(ctx, -6, -6, 7, '#ffd070', 0.2);
  },
};

// ---- 封印 256x256 ----
const seal: SpriteDef = {
  id: 'fx_seal', w: 256, h: 256,
  draw(ctx) {
    const r = rng(77);
    // 略不规则的方印，右上角有缺角
    const S = 112;
    const corner = (x: number, y: number): Pt => [x + (r() - 0.5) * 3, y + (r() - 0.5) * 3];
    const pts: Pt[] = [];
    const edge = (a: Pt, b: Pt, n: number) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push(corner(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); } };
    edge([-S, -S], [S - 44, -S], 10);
    pts.push([S - 44, -S + 2], [S - 30, -S + 12], [S - 18, -S + 18], [S - 8, -S + 30], [S, -S + 44]); // 缺角
    edge([S, -S + 44], [S, S], 10);
    edge([S, S], [-S, S], 12);
    edge([-S, S], [-S, -S], 12);
    const body = pathFrom(pts, true, false);
    // 红底
    const g = ctx.createLinearGradient(-S, -S, S, S);
    g.addColorStop(0, '#e2482a'); g.addColorStop(0.5, PAL.cinnabar); g.addColorStop(1, PAL.cinnabar2);
    ctx.fillStyle = g; ctx.fill(body);
    ctx.save(); ctx.clip(body);
    // 朱泥晕斑
    for (let i = 0; i < 26; i++) {
      const x = (r() - 0.5) * 2 * S, y = (r() - 0.5) * 2 * S, rad = 14 + r() * 40;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() < 0.5;
      rg.addColorStop(0, dark ? 'rgba(90,10,4,0.2)' : 'rgba(255,150,110,0.15)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // 边框：粗红框 + 内细白线（白文印面：边框内留白线）
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = PAL.paper; ctx.lineWidth = 4.5; ctx.globalAlpha = 0.94;
    ctx.beginPath(); ctx.rect(-S + 15, -S + 15, (S - 15) * 2, (S - 15) * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    // 「封」字：白文，篆意（笔画均匀、圆转、加粗）
    ctx.save();
    ctx.font = `900 150px "Noto Serif CJK SC", "Noto Serif CJK TC", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 5;
    ctx.strokeStyle = PAL.paper; ctx.fillStyle = PAL.paper;
    ctx.strokeText('封', 0, 8); ctx.fillText('封', 0, 8);
    ctx.restore();
    // 石刻斑驳：用 destination-out 剥掉红面与白字的碎点、边缘蚀痕
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 380; i++) {
      const x = (r() - 0.5) * 2 * S, y = (r() - 0.5) * 2 * S, rad = 0.6 + r() * r() * 3.6;
      ctx.globalAlpha = 0.5 + r() * 0.5;
      ctx.beginPath(); ctx.ellipse(x, y, rad, rad * (0.5 + r() * 0.8), r() * 3, 0, 7); ctx.fill();
    }
    // 边缘剥蚀
    for (let i = 0; i < 160; i++) {
      const side = Math.floor(r() * 4), t = (r() - 0.5) * 2 * S, d = S - r() * r() * 9;
      const x = side < 2 ? (side === 0 ? -d : d) : t, y = side < 2 ? t : (side === 2 ? -d : d);
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(x, y, 0.8 + r() * 2.6, 0, 7); ctx.fill();
    }
    // 几道细裂纹
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.9;
    for (let k = 0; k < 4; k++) {
      let x = (r() - 0.5) * 2 * S, y = (r() - 0.5) * 2 * S;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 7; j++) { x += (r() - 0.5) * 22; y += (r() - 0.3) * 20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
  },
  glow(ctx) {
    // 微弱的朱砂余晖，只描印面边缘
    ctx.save(); ctx.globalCompositeOperation = 'lighter';  ctx.restore();
  },
};

// ============ 炮台 40x40 ============
const TURRET_ARCS: Pt[][] = [[0.75, 0.95, 1.15], [-0.15, 0.05, 0.25]].map((r) => r.map((k) => { const a = Math.PI * k; return [Math.cos(a) * 7, -0.5 + Math.sin(a) * 7] as Pt; }));
const turret: SpriteDef = {
  id: 'e_turret', w: 40, h: 40, radius: 14,
  anchors: { muzzle: [0, 19] },
  draw(ctx) {
    // 底座：八角铁板
    const oct: Pt[] = Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return [Math.cos(a) * 18.2, Math.sin(a) * 18.2] as Pt; });
    const base = plate(ctx, oct, { light: '#5b5f66', base: PAL.iron, dark: PAL.iron2, edgeW: 2.2, seed: 21, wear: 'rgba(200,190,170,0.5)', wearN: 24 });
    void base;
    dots(ctx, oct.map(([x, y]) => [x * 0.86, y * 0.86] as Pt), 1, '#8b7048');
    // 内环槽
    const ring = ellipsePath(0, 0, 12.6, 12.6);
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.6; ctx.stroke(ring);
    ctx.translate(0.7, 0.7); ctx.strokeStyle = 'rgba(255,235,200,0.25)'; ctx.lineWidth = 0.8; ctx.stroke(ring); ctx.restore();
    // 炮管（朝下）
    const barrel = plate(ctx, [[-2.9, 2], [2.9, 2], [3.1, 17.5], [-3.1, 17.5]], { light: '#7a6244', base: PAL.bronze, dark: PAL.bronze2, edgeW: 1.5, seed: 24, wear: 'rgba(230,200,150,0.5)', wearN: 8 });
    void barrel;
    plate(ctx, [[-4.2, 15], [4.2, 15], [4.6, 19.2], [-4.6, 19.2]], { light: '#59866f', base: PAL.verdigris2, dark: PAL.ink2, edgeW: 1.4, seed: 25 });
    line(ctx, [[-1.1, 3], [-1.1, 14]], 'rgba(255,235,190,0.4)', 0.8);
    // 炮塔圆盖
    const dome = ellipsePath(0, -0.5, 9.4, 9.4);
    ctx.save(); ctx.translate(0.8, 1.2); ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.fill(dome); ctx.restore();
    const g = ctx.createRadialGradient(-3.5, -4.5, 1, 0, 0, 11);
    g.addColorStop(0, '#a98a5c'); g.addColorStop(0.45, PAL.bronze); g.addColorStop(1, PAL.bronze2);
    ctx.fillStyle = g; ctx.fill(dome);
    inkOutline(ctx, dome, 1.8, PAL.ink, 27);
    // 铜绿斑
    ctx.save(); ctx.clip(dome);
    const r = rng(9);
    for (let i = 0; i < 6; i++) {
      const x = (r() - 0.3) * 12, y = (r() - 0.1) * 12, rad = 2 + r() * 3;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, 'rgba(79,133,119,0.6)'); rg.addColorStop(1, 'rgba(79,133,119,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
    // 盖顶十字缝 + 铆钉
    groove(ctx, [[-5.5, -3.5], [-1, -6.5], [4, -6]], 0.8);
    groove(ctx, [[-6.8, 1.5], [-3, 0.5]], 0.8);
    // 炮口环（霓虹弧）
    for (const A of TURRET_ARCS) neonSeamDraw(ctx, A, PAL.neonMagenta, 0.9);
  },
  glow(ctx) {
    for (const A of TURRET_ARCS) neonLine(ctx, A, PAL.neonMagenta, 1);
    glowDot(ctx, 0, 18.6, 4, PAL.neonMagenta, 0.3);
  },
};

// ============ 黄蜂 44x48 ============
// 蜂机灯光：柔和暖色，不用霓虹品红和青。
const WARM_GLOW = "#f0a850", WARM_EYE = "#ffd98a";
const hornet: SpriteDef = {
  id: 'e_hornet', w: 44, h: 48, radius: 10,
  anchors: { muzzle: [0, 22], engine: [0, -23] },
  draw(ctx) {
    // 后掠翼（机头朝下，翼尖在上方）
    const wingL: Pt[] = [[-3.5, 3], [-11, -6], [-18, -15], [-21.5, -22.5], [-14.5, -19], [-7, -14], [-4, -12]];
    for (const sg of [-1, 1]) {
      ctx.save(); ctx.scale(sg, 1);
      plate(ctx, wingL, { light: '#b39264', base: '#86694a', dark: PAL.bronze2, edgeW: 1.7, seed: 31, wear: 'rgba(230,200,150,0.55)', wearN: 14 });
      // 翼面：铜绿蒙皮 + 面板线
      plate(ctx, [[-6, -2], [-11, -8], [-16, -16], [-9.5, -14], [-6, -9]], { light: '#6ba594', base: PAL.verdigris, dark: PAL.verdigris2, edgeW: 1, seed: 33 });
      groove(ctx, [[-4.5, -1], [-14, -10]], 0.7);
      dots(ctx, [[-8, -5], [-12.5, -12], [-17, -18]], 0.7, PAL.gold2);
      neonSeamDraw(ctx, [[-20.4, -21.4], [-15.5, -18.8]], WARM_GLOW, 0.6);
      // 前小翼（钳）
      plate(ctx, [[-3.5, 9], [-10, 13.5], [-11.5, 11], [-4, 4.5]], { light: '#6a6e76', base: PAL.iron, dark: PAL.iron2, edgeW: 1.5, seed: 35 });
      ctx.restore();
    }
    // 机身（头朝下）
    const left: Pt[] = [[-2.6, -24], [-4.4, -18], [-4.8, -8], [-4.2, 2], [-4.8, 9], [-4.4, 14], [-2.4, 21], [-0.8, 24]];
    const body = plate(ctx, symmetric(left), { light: '#c8a674', base: '#8c6c48', dark: PAL.bronze2, smooth: true, edgeW: 1.8, seed: 30, wear: 'rgba(240,210,160,0.55)', wearN: 16 });
    void body;
    // 腹节缝
    groove(ctx, [[-4, -14], [0, -12], [4, -14]], 0.9);
    groove(ctx, [[-4.4, -6], [0, -4], [4.4, -6]], 0.9);
    groove(ctx, [[-4.4, 1], [0, 3], [4.4, 1]], 0.9);
    // 背部铁脊
    plate(ctx, [[-1.1, -21], [1.1, -21], [1.3, 6], [-1.3, 6]], { light: '#9aa0a8', base: '#5c6169', dark: PAL.iron, edgeW: 0.9, seed: 36 });
    // 头部
    const head = ellipsePath(0, 15.4, 4.9, 5);
    litFill(ctx, head, [-5, 10, 10, 10], '#8a8f96', PAL.iron, PAL.iron2, { seed: 8, blots: 0 });
    bevel(ctx, head, 'rgba(255,255,255,0.35)', 'rgba(0,0,0,0.4)', 0.8, 1.2);
    inkOutline(ctx, head, 1.5, PAL.ink, 38);
    // 复眼
    for (const sg of [-1, 1]) {
      const eye = ellipsePath(sg * 2.7, 16, 1.6, 2.1, sg * 0.4);
      ctx.fillStyle = '#6a3a14'; ctx.fill(eye);
      ctx.fillStyle = WARM_EYE; ctx.beginPath(); ctx.ellipse(sg * 2.7 - 0.2, 16, 0.9, 1.3, 0, 0, 7); ctx.fill();
    }
    // 尖刺
    plate(ctx, [[-1.2, 19.5], [1.2, 19.5], [0, 24]], { light: '#a08a60', base: PAL.bronze2, dark: PAL.ink2, edgeW: 1.2, seed: 39 });
    // 尾喷口
    plate(ctx, [[-2.7, -24], [2.7, -24], [3.1, -20.4], [-3.1, -20.4]], { light: '#5b5f66', base: PAL.iron2, dark: PAL.ink, edgeW: 1.3, seed: 40 });
    // 背侧霓虹缝
    neonSeamDraw(ctx, [[-3.2, -10], [-3.4, -3]], WARM_GLOW, 0.55);
    neonSeamDraw(ctx, [[3.2, -10], [3.4, -3]], WARM_GLOW, 0.55);
  },
  glow(ctx) {
    for (const sg of [-1, 1]) {
      glowDot(ctx, sg * 2.7, 16, 4, WARM_EYE, 0.35);
      neonLine(ctx, [[sg * 20.4, -21.4], [sg * 15.5, -18.8]], WARM_GLOW, 0.8);
      neonLine(ctx, [[sg * 3.2, -10], [sg * 3.4, -3]], WARM_GLOW, 0.6);
    }
    // 尾喷
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, -24, 0, -18);
    g.addColorStop(0, 'rgba(255,170,80,0)'); g.addColorStop(1, '#ffd9a0');
    ctx.fillStyle = g; ctx.fillRect(-2.2, -24, 4.4, 4);
    ctx.restore();
    glowDot(ctx, 0, -22.4, 4.5, WARM_GLOW, 0.3);
  },
};

export const COMMON_SPRITES: SpriteDef[] = [...ITEMS, medal, seal, turret, hornet];
