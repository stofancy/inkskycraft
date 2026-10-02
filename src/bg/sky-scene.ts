import type { Renderer } from '../gl/renderer';
import type { SpriteInfo } from '../gl/atlas';
import falls from '../../public/art/sky/ch1/waterfalls.json';
import { SpriteLayer, type SpriteDraw } from '../gl/sprites';

// 瀑布坐标为贴图像素；显示尺寸与贴图尺寸对应关系见 art/sprites_sky.ts。
const FALL_DIMS: Record<string, [number, number, number, number]> = {
  'rock-large-pine': [200, 300, 1024, 1536], 'rock-large-root': [180, 270, 1024, 1536],
  'cliff-left': [280, 210, 1448, 1086], 'cliff-right': [280, 210, 1448, 1086],
};
const FALLS = falls as Record<string, { top: number[]; bottom: number[]; width: number }[]>;
const fract = (v: number): number => v - Math.floor(v);

// 在石头上画瀑布流水：亮纹沿水道下滑，底端三团水雾膨胀淡出。只改精灵绘制参数，无新建资源。
export function drawFalls(r: Renderer, name: string, x: number, y: number, sx: number, sy: number, alpha: number, time: number, seed: number, profile?: { dim: number[]; falls: { top: number[]; bottom: number[]; width: number }[] }): void {
  const list = profile?.falls ?? FALLS[name], dim = profile?.dim ?? FALL_DIMS[name];
  if (!list || !dim) return;
  const kx = dim[0] / dim[2] * sx, ky = dim[1] / dim[3] * sy;
  list.forEach((f, n) => {
    const tx = x + (f.top[0] - dim[2] / 2) * kx, ty = y + (f.top[1] - dim[3] / 2) * ky;
    const bx = x + (f.bottom[0] - dim[2] / 2) * kx, by = y + (f.bottom[1] - dim[3] / 2) * ky;
    const w = f.width * kx, len = by - ty;
    for (let i = 0; i < 6; i++) {
      const ph = fract(time * .32 + i / 6 + seed * .37 + n * .21);
      const j = Math.sin((i + n * 3 + seed) * 12.9) * .3;
      r.ground.add('sky_fall-streak', { x: tx + (bx - tx) * ph + j * w, y: ty + len * ph,
        sx: Math.max(.3, w / 24), sy: len * .2 / 96, alpha: alpha * Math.sin(ph * Math.PI) * .6, r: .85, g: .94, b: 1 });
    }
    for (let i = 0; i < 3; i++) {
      const ph = fract(time * .22 + i / 3 + seed * .53 + n * .31);
      r.ground.add('sky_fall-mist', { x: bx + (i - 1) * w * .6 + Math.sin(time * .5 + i) * w * .3, y: by - 8 + ph * -14,
        sx: (w * 2.2 + ph * w * 2.5) / 128, sy: (w * 1.4 + ph * w * 1.4) / 128, alpha: alpha * .5 * (1 - ph) });
    }
  });
}

// 纯景物，无碰撞。远石更小、更淡、更慢；同组两块之间保留垂下的墨线铁链。
export function drawSkyStones(r: Renderer, scroll: number, time: number): void {
  const layers = [
    { ids: ['sky_rock-small-shard', 'sky_rock-small-root'], speed: .10, alpha: .24, scale: .85, period: 440 },
    { ids: ['sky_rock-medium-pine', 'sky_rock-medium-vine'], speed: .24, alpha: .48, scale: .90, period: 630 },
    { ids: ['sky_rock-large-pine', 'sky_rock-large-root'], speed: .46, alpha: .90, scale: 1.10, period: 880 },
  ];
  // 先画全部投在云海上的淡影（光自右上来，影落左下），再画石，避免大石的影盖住远石。
  for (const shadowPass of [true, false]) layers.forEach((l, depth) => {
    if (shadowPass && depth === 0) return;
    const drift = scroll * l.speed;
    const first = Math.floor((drift + depth * 130 - 1500) / l.period);
    const last = Math.ceil((drift + depth * 130 + 380) / l.period);
    for (let row = first; row <= last; row++) {
      const side = ((row % 2) + 2) % 2;
      const x = side ? 680 : 120;
      const y = drift - row * l.period + depth * 130;
      const bob = Math.sin(time * (.055 + depth * .025) + row * 2.7) * (4 + depth * 3);
      const a = { x: x + Math.sin(row * 7.3) * 34, y: y + bob };
      const b = { x: x + (side ? -145 : 165), y: y + 95 + bob };
      if (shadowPass) {
        for (const [i, p] of [a, b].entries()) r.ground.add(l.ids[i], {
          x: p.x - 38 * l.scale, y: p.y + 46 * l.scale, sx: l.scale * 1.06, sy: l.scale * 1.06,
          r: .35, g: .45, b: .65, alpha: l.alpha * .32,
        });
        continue;
      }
      r.ground.add('sky_chain-gate', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 22 * l.scale,
        sx: (b.x - a.x) / 620, sy: .42 * l.scale, rot: Math.atan((b.y - a.y) / (b.x - a.x)), alpha: l.alpha * .7 });
      for (const [i, p] of [a, b].entries()) {
        r.ground.add(l.ids[i], { ...p, sx: l.scale, sy: l.scale, alpha: l.alpha });
        if (depth === 2) drawFalls(r, l.ids[i].slice(4), p.x, p.y, l.scale, l.scale, l.alpha, time, row * 2 + i);
      }
    }
  });
}

// 背景资产有独立命名空间；浮石和蜃海景物先画，架在石上的炮台仍走战斗层。
// 原 ground 接口保留，关卡与敌人代码无需改变。
export class SkyGroundLayer extends SpriteLayer {
  readonly scenery = new SpriteLayer(this.atlas);

  override add(id: string | SpriteInfo, draw: SpriteDraw): void {
    const name = typeof id === 'string' ? id : id.id;
    if (name.startsWith('sky_') || name.startsWith('c2_')) this.scenery.add(id, draw);
    else super.add(id, draw);
  }

  override clear(): void {
    super.clear();
    this.scenery.clear();
  }
}
