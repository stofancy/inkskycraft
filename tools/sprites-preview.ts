// 精灵预览。参数：filter=id 前缀或逗号分隔的多个前缀  scale=放大倍数(默认2)
//   bg=paper|dark|sky  anchors=1 显示挂点   glow=0 关闭发光合成
import { ALL_SPRITES } from '../src/art/index';
import { drawSprite, loadSpriteImages, spriteFrames } from '../src/art/images';

const q = new URLSearchParams(location.search);
const filters = (q.get('filter') ?? '').split(',').filter(Boolean);
const scale = parseFloat(q.get('scale') ?? '2');
const bgMode = q.get('bg') ?? 'sky';
const BG: Record<string, string> = { paper: '#e9dfc8', dark: '#0e0c0a', sky: 'linear' };
const grid = document.getElementById('grid')!;
const images = await loadSpriteImages(ALL_SPRITES);

function render(def: (typeof ALL_SPRITES)[number], frame: number): HTMLCanvasElement {
  const W = Math.ceil(def.w * scale), H = Math.ceil(def.h * scale);
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const albedo = mk(), glow = mk(), out = mk();
  for (const [c, fn] of [[albedo, def.draw], [glow, def.glow]] as const) {
    if (c === glow && !fn) continue;
    const ctx = c.getContext('2d')!;
    if (c === glow) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    ctx.setTransform(scale, 0, 0, scale, W / 2, H / 2);
    ctx.beginPath(); ctx.rect(-def.w / 2, -def.h / 2, def.w, def.h); ctx.clip();
    if (c === albedo) drawSprite(ctx, def, frame, images);
    else fn!.call(def, ctx, frame);
  }
  const o = out.getContext('2d')!;
  if (bgMode === 'sky') {
    const g = o.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#e9dfc8'); g.addColorStop(0.5, '#8a8272'); g.addColorStop(1, '#1b1814');
    o.fillStyle = g;
  } else o.fillStyle = BG[bgMode] ?? '#333';
  o.fillRect(0, 0, W, H);
  o.drawImage(albedo, 0, 0);
  if (def.glow && q.get('glow') !== '0') {
    o.globalCompositeOperation = 'lighter';
    o.filter = `blur(${4 * scale}px)`; o.drawImage(glow, 0, 0); o.drawImage(glow, 0, 0);
    o.filter = 'none'; o.drawImage(glow, 0, 0);
    o.globalCompositeOperation = 'source-over';
  }
  if (q.get('anchors') === '1' && def.anchors) {
    o.fillStyle = '#0f0'; o.font = '10px monospace';
    for (const [name, [x, y]] of Object.entries(def.anchors)) {
      const px = W / 2 + x * scale, py = H / 2 + y * scale;
      o.fillRect(px - 3, py, 7, 1); o.fillRect(px, py - 3, 1, 7); o.fillText(name, px + 4, py - 4);
    }
  }
  return out;
}

for (const def of ALL_SPRITES) {
  if (filters.length && !filters.some((f) => def.id.startsWith(f))) continue;
  const cell = document.createElement('div');
  cell.className = 'cell';
  const frames = spriteFrames(def);
  for (let f = 0; f < frames; f++) {
    try { cell.appendChild(render(def, f)); } catch (e) { console.error(def.id, e); }
  }
  const label = document.createElement('div');
  label.textContent = `${def.id} ${def.w}x${def.h}${frames > 1 ? ' f' + frames : ''}`;
  cell.appendChild(label);
  grid.appendChild(cell);
}
