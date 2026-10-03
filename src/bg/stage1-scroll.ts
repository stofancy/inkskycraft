import type { Renderer } from '../gl/renderer';
import type { SpriteDef } from '../art/types';
import { drawFalls, drawSkyStones } from './sky-scene';

// 与第三章共用初始化图集；逐帧只提交位置、颜色与透明度。
export const STAGE1_SCENERY: SpriteDef[] = Object.entries({
  'dock-crane': [220, 330], 'lamp-row': [200, 300], waterwheel: [220, 330],
  'gate-stairs': [220, 330], quarry: [230, 345], 'rope-bridge': [240, 160],
}).map(([name, [w, h]]) => ({
  id: `sky_ch1-${name}`, w, h, image: `art/sky/ch1-props/${name}.png`,
  imageFilter: 'saturate(.72) contrast(.86) brightness(1.06)',
}));
const mod = (n: number, m: number): number => (n % m + m) % m;
const WATERFALL = { dim: [220, 330, 1024, 1536], falls: [
  { top: [710, 660], bottom: [690, 1350], width: 90 },
] };
const LAMPS = [[270, 98], [446, 240], [606, 352], [808, 482]];

// 段落沿用关卡参数：.1 出港、.2 浮石林、.3 劫机、.5 堡垒；俯冲后进入石阶航路。
// 每屏约两组近景；包括副岛、水雾在内的轮廓收在 x<270 / x>630，无碰撞。
export function drawHarborIslands(r: Renderer, scroll: number, time: number): void {
  const route = r.bgParams[0][0], dive = r.bgParams[2][0];
  if (dive > 0) drawSkyStones(r, scroll, time);
  const blend = (a: number, b: number): number => {
    const t = Math.max(0, Math.min(1, (route - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const forest = blend(.12, .19), cargo = blend(.22, .29), quarry = blend(.34, .48);
  const weights = [(1 - forest) * (1 - dive), forest * (1 - cargo) * (1 - dive),
    cargo * (1 - quarry) * (1 - dive), quarry * (1 - dive), dive];
  const sets = [['dock-crane', 'lamp-row'], ['waterwheel', 'rope-bridge'],
    ['dock-crane', 'rope-bridge'], ['quarry', 'quarry'], ['gate-stairs', 'gate-stairs']];
  const near = scroll * .46;
  for (let row = Math.floor((near - 1450) / 600); row <= Math.ceil((near + 300) / 600); row++) {
    const side = mod(row, 2), x = side ? 778 : 122;
    const y = near - row * 600 + Math.sin(time * .35 + row * 2.7) * 5;
    const index = side;
    // 云根流水岛把独立地标连成航路；最高轮廓约 245，中央四成留白。
    const rx = x + (side ? -58 : 58), ry = y + 230;
    r.ground.scenery.add('sky_rock-large-root', { x: rx, y: ry, sx: .62, sy: .62, alpha: .58 });
    drawFalls(r, 'rock-large-root', rx, ry, .62, .62, .58, time, row);
    sets.forEach((pair, i) => {
      const alpha = weights[i] * .88;
      if (alpha < .005) return;
      const name = pair[index];
      r.ground.scenery.add(`sky_ch1-${name}`, { x, y, alpha });
      if (name === 'waterwheel') drawFalls(r, '', x, y, 1, 1, alpha, time, row, WATERFALL);
      if (name === 'lamp-row') for (const [j, lamp] of LAMPS.entries()) {
        const breath = .11 + .035 * Math.sin(time * 1.15 + j * .45);
        r.ground.scenery.add('sky_fall-mist', {
          x: x + (lamp[0] - 512) * 200 / 1024, y: y + (lamp[1] - 768) * 300 / 1536,
          sx: .20, sy: .25, r: 1, g: .77, b: .42, alpha: alpha * breath,
        });
      }
    });
  }
}
