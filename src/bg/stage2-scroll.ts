import type { Renderer } from '../gl/renderer';
import { drawFalls } from './sky-scene';
import falls from '../../public/art/sky/ch2/waterfalls.json';

const mod = (n: number, m: number): number => (n % m + m) % m;
const WATERMILL = { dim: [260, 390, 1024, 1536], falls: [
  { top: [594, 547], bottom: [597, 1324], width: 65 },
  { top: [449, 330], bottom: [470, 403], width: 25 },
] };
const ROCK_FALLS = {
  'rock-large-pine': { dim: [200, 300, 1024, 1536], falls: falls['rock-large-pine'] },
  'rock-large-root': { dim: [180, 270, 1024, 1536], falls: falls['rock-large-root'] },
};

// 灯杆随浮石轻摆；五盏暖光与原图灯笼位置一起旋转，光晕用已有水雾精灵。
function lanterns(r: Renderer, x: number, y: number, scale: number, alpha: number, time: number, seed: number): void {
  const rot = Math.sin(time * .72 + seed) * .018;
  r.ground.add('c2_town-lantern-rock', { x, y, sx: scale, sy: scale, rot, alpha });
  for (let i = 0; i < 5; i++) {
    const lx = (-16.5 + i * 5.3) * scale, ly = (-92 + i * 1.9) * scale;
    r.ground.add('sky_fall-mist', { x: x + lx * Math.cos(rot) - ly * Math.sin(rot), y: y + lx * Math.sin(rot) + ly * Math.cos(rot),
      sx: .17 * scale, sy: .23 * scale, r: 1.3, g: .85, b: .35, alpha: alpha * (.38 + .035 * Math.sin(time * 1.1 + seed)) });
  }
}

// 900×1200 内约八个远景、五组中景、两组近景；世界卷轴决定位置，时间只控制微动。
export function drawCloudTown(r: Renderer, scroll: number, time: number, reveal: number, mirage: number): void {
  const camera = r.bgParams[3][0];
  const far = scroll * .10;
  for (let row = Math.floor((far - 1320) / 300); row <= Math.ceil((far + 120) / 300); row++) {
    for (let side = 0; side < 2; side++) {
      const seed = row * 3 + side, scale = .70 + .20 * Math.sin(seed * 4.7);
      const x = (side ? 726 : 175) + Math.sin(seed * 3.9) * 60 - camera * .10;
      const y = far - row * 300 + side * 115 + Math.sin(time * .10 + seed) * 4;
      const name = mod(seed, 3) === 0 ? 'c2_town-island-tower' : `c2_rock-rock-small-${mod(seed, 2) ? 'root' : 'shard'}`;
      r.ground.add(name, { x, y, sx: name.includes('tower') ? .43 : scale, sy: name.includes('tower') ? .43 : scale, alpha: .22 });
    }
  }

  const middle = scroll * .24;
  for (let row = Math.floor((middle - 1450) / 480); row <= Math.ceil((middle + 250) / 480); row++) {
    for (let side = 0; side < 2; side++) {
      const seed = row * 2 + side, kind = mod(seed, 4);
      const x = (side ? 747 : 153) + Math.sin(seed * 5.1) * 22 - camera * .24;
      const y = middle - row * 480 + side * 215 + Math.sin(time * .13 + seed) * 5;
      const name = ['island-houses', 'bridge', 'island-tower', 'island-falls'][kind];
      const alpha = .52, scale = .72;
      r.ground.add(`c2_town-${name}`, { x, y, sx: scale, sy: scale, alpha });
      if (kind === 3) drawFalls(r, '', x, y, scale, scale, alpha, time, seed, WATERMILL);
      if (kind === 0 || kind === 2) lanterns(r, x + (side ? 50 : -50), y + 95, .46, .54 * (1 - reveal * .65), time, seed);
      if (mirage > .001 && kind < 2) {
        r.ground.add('c2_town-mirage-town', { x: x + Math.sin(time * .11 + seed) * 13, y: y - 125 + Math.cos(time * .14 + seed) * 12,
          sx: .92, sy: .92, alpha: mirage * (.36 + .025 * Math.sin(time * .3 + seed)), edgeFade: .10 });
      }
    }
  }

  const near = scroll * .46;
  for (let row = Math.floor((near - 1530) / 600); row <= Math.ceil((near + 330) / 600); row++) {
    const side = mod(row, 2), seed = mod(row, 6);
    const x = (side ? 804 : 96) + Math.sin(row * 2.7) * 18 - camera * .46;
    const y = near - row * 600 + Math.sin(time * .16 + row) * 7;
    const name = side ? 'island-falls' : seed === 0 ? 'island-tower' : 'island-houses';
    const scale = side ? 1.06 : 1.13;
    r.ground.add(`c2_town-${name}`, { x: x - 18, y: y + 26, sx: scale * 1.03, sy: scale,
      r: .57, g: .67, b: .76, alpha: .09 });
    r.ground.add(`c2_town-${name}`, { x, y, sx: scale, sy: scale, alpha: .91 });
    if (side) drawFalls(r, '', x, y, scale, scale, .94, time, row, WATERMILL);
    // 同簇小浮石延长轮廓；流水使用第二章原图的实际水道坐标。
    const rock = side ? 'rock-large-root' : 'rock-large-pine';
    const rx = x + (side ? -88 : 86), ry = y + 153;
    r.ground.add(`c2_rock-${rock}`, { x: rx, y: ry, sx: .49, sy: .49, alpha: .68 });
    drawFalls(r, rock, rx, ry, .49, .49, .68, time, row + 1, ROCK_FALLS[rock]);
    lanterns(r, x + (side ? -32 : 38), y - 195, .76, .84 * (1 - reveal * .65), time, row);
  }
}
