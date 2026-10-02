import type { SpriteDef } from './types';
const rock = (name: string, w: number, h: number): SpriteDef => ({
 id: `sky_${name}`, w, h, image: `art/sky/ch1/${name}.png`,
});
export const SKY_SPRITES: SpriteDef[] = [
 // 旧关卡挂点与炮台沿用这个 id，替换美术时保持原来的尺寸与位置。
 { id: 'sky_rock', w: 280, h: 240, image: 'art/sky/ch1/rock-medium-vine.png' },
 rock('rock-large-pine', 200, 300), rock('rock-large-root', 180, 270),
 rock('rock-medium-pine', 180, 187), rock('rock-medium-vine', 126, 189),
 rock('rock-small-shard', 64, 96), rock('rock-small-root', 58, 87),
 rock('cliff-left', 280, 210), rock('cliff-right', 280, 210),
 { id: 'sky_chain-gate', w: 620, h: 70, draw(c) {
   for (let i = 0; i < 27; i++) {
     c.save(); c.translate(-300 + i * 23, Math.sin(i / 26 * Math.PI) * 18 - 10); c.rotate(i % 2 ? .5 : -.3);
     c.strokeStyle = '#293238'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 17, 8, 0, 0, Math.PI * 2); c.stroke();
     c.strokeStyle = '#59605a88'; c.lineWidth = 1.5; c.stroke(); c.restore();
   }
 } },
 { id: 'sky_migration-ship', w: 360, h: 306, image: 'art/enemies/ch1/migration-ship.png' },
];
