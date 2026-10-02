import type { Renderer } from '../gl/renderer';
import type { SpriteInfo } from '../gl/atlas';
import { SpriteLayer, type SpriteDraw } from '../gl/sprites';

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
      for (const [i, p] of [a, b].entries()) r.ground.add(l.ids[i], {
        ...p, sx: l.scale, sy: l.scale, alpha: l.alpha,
      });
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
