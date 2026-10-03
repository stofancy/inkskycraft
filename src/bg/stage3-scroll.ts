import type { Renderer } from '../gl/renderer';
import type { SpriteDef } from '../art/types';
import { drawFalls } from './sky-scene';
import falls from '../../public/art/sky/ch3/waterfalls.json';

// 接入点：Renderer.init 将 STAGE3_SCENERY 合入图集；render 在 scenery 绘制前调用 drawThunderIslands。
// 并入主图集的一次性初始化；运行时只提交精灵位置和透明度。
export const STAGE3_SCENERY: SpriteDef[] = Object.entries({
  'rock-large-pine': [200, 300], 'rock-large-root': [180, 270],
  'rock-medium-pine': [180, 187], 'rock-medium-vine': [126, 189],
  'rock-small-shard': [64, 96], 'rock-small-root': [58, 87],
  'rock-thunderstone': [220, 330],
}).map(([name, [w, h]]) => ({
  id: `sky_ch3-${name}`, w, h, image: `art/sky/ch3/${name}.png`,
  imageFilter: 'saturate(.75) contrast(.85) brightness(1.2)',
}));
const mod = (n: number, m: number): number => (n % m + m) % m;
const THUNDER_FALLS = { dim: [220, 330, 1024, 1536], falls: [
  { top: [636, 475], bottom: [603, 1330], width: 82 },
] };
const FALLS = {
  'rock-large-pine': { dim: [200, 300, 1024, 1536], falls: falls['rock-large-pine'] },
  'rock-large-root': { dim: [180, 270, 1024, 1536], falls: falls['rock-large-root'] },
};

// 两侧每屏八个远石、五组中景、两组近景；中央 x=270..630 留给淡云。
export function drawThunderIslands(r: Renderer, scroll: number, time: number): void {
  const progress = Math.max(0, Math.min(1, r.bgParams[0][2]));
  const summit = Math.max(0, (progress - .66) / .34);
  const far = scroll * .10;
  for (let row = Math.floor((far - 1350) / 300); row <= Math.ceil((far + 150) / 300); row++) {
    for (let side = 0; side < 2; side++) {
      const seed = row * 2 + side;
      const x = (side ? 715 : 185) + Math.sin(seed * 4.1) * 50;
      const y = far - row * 300 + side * 135;
      const scale = .65 + .18 * Math.sin(seed * 2.9);
      r.ground.scenery.add(`sky_ch3-rock-small-${mod(seed, 2) ? 'root' : 'shard'}`, {
        x, y, sx: scale, sy: scale, alpha: .22 - summit * .06,
      });
    }
  }
  const middle = scroll * .24;
  for (let row = Math.floor((middle - 1450) / 480); row <= Math.ceil((middle + 250) / 480); row++) {
    for (let side = 0; side < 2; side++) {
      const seed = row * 2 + side, crystal = mod(seed, 3) === 0;
      const x = (side ? 757 : 143) + Math.sin(seed * 5.1) * 22;
      const y = middle - row * 480 + side * 225 + Math.sin(time * .13 + seed) * 5;
      const scale = crystal ? .70 : .82;
      const name = crystal ? 'rock-thunderstone' : `rock-medium-${mod(seed, 2) ? 'vine' : 'pine'}`;
      r.ground.scenery.add(`sky_ch3-${name}`, { x, y, sx: scale, sy: scale, alpha: .52 - summit * .1 });
      if (crystal) drawFalls(r, '', x, y, scale, scale, .45, time, seed, THUNDER_FALLS);
      r.ground.scenery.add('sky_ch3-rock-small-shard', {
        x: x + (side ? -65 : 65), y: y + 85, sx: .7, sy: .7, alpha: .35,
      });
    }
  }
  const near = scroll * .46;
  for (let row = Math.floor((near - 1580) / 600); row <= Math.ceil((near + 380) / 600); row++) {
    const side = mod(row, 2), crystal = mod(row, 3) !== 1;
    const x = (side ? 805 : 95) + Math.sin(row * 2.7) * 15;
    const y = near - row * 600 + Math.sin(time * .16 + row) * 6;
    const name = crystal ? 'rock-thunderstone' : 'rock-large-pine';
    const scale = 1.20, alpha = .9 - summit * .10;
    r.ground.scenery.add(`sky_ch3-${name}`, {
      x: x - 22, y: y + 28, sx: scale * 1.04, sy: scale,
      r: .55, g: .60, b: .78, alpha: .08,
    });
    r.ground.scenery.add(`sky_ch3-${name}`, { x, y, sx: scale, sy: scale, alpha });
    drawFalls(r, '', x, y, scale, scale, alpha, time, row, crystal ? THUNDER_FALLS : FALLS['rock-large-pine']);
    // 每簇一块流水副岛，让上下游水纹与悬岩轮廓相接。
    const rx = x + (side ? -102 : 102), ry = y + 165;
    r.ground.scenery.add('sky_ch3-rock-large-root', { x: rx, y: ry, sx: .58, sy: .58, alpha: .64 });
    drawFalls(r, '', rx, ry, .58, .58, .64, time, row + 1, FALLS['rock-large-root']);
  }
}
