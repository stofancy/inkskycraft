import type { SpriteDef } from './types';
const rock = (name: string, w: number, h: number): SpriteDef => ({
 id: `sky_${name}`, w, h, image: `art/sky/ch1/${name}.png`,
});
export const SKY_SPRITES: SpriteDef[] = [
 ...Object.entries({
   'terrace-left':[255,1020], 'terrace-right':[255,1020], bridge:[900,300],
   'roof-a':[168,123], 'roof-b':[132,132],
 }).map(([name,[w,h]])=>({id:`sky_low-${name}`,w,h,image:`art/sky/ch1-low/${name}.png`,imageFilter:'saturate(.55) contrast(.8) brightness(1.1)'})),
 ...Object.entries({
   'cannon-base':[104,104], 'cannon-barrel':[36,72], wreck:[100,82],
 }).map(([name,[w,h]])=>({id:`low_${name}`,w,h,radius:30,image:`art/enemies/ch1/ground/${name}.png`,imageFilter:'saturate(.6) contrast(.85) brightness(1.12)',textureScale:2,
   ...(name==='cannon-barrel'?{pivot:[0,21.75] as [number,number]}:{})})),
 ...['ballista','eave-gunner'].map(name=>({id:`low_${name}`,w:104,h:104,radius:32,frames:2,textureScale:2,imageFilter:'saturate(.6) contrast(.85) brightness(1.12)',sheet:{image:`art/enemies/ch1/ground/${name}.png`,columns:2,rows:1,count:2,fps:1,mode:'once' as const}})),
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
 // 瀑布流水：细长亮纹沿瀑布下滑，底端水雾团；见 bg/sky-scene.ts 的 drawFalls。
 { id: 'sky_fall-streak', w: 12, h: 96, draw(c) {
   const g = c.createLinearGradient(0, -48, 0, 48);
   g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
   c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 5, 48, 0, 0, Math.PI * 2); c.fill();
 } },
 { id: 'sky_fall-mist', w: 128, h: 128, draw(c) {
   const g = c.createRadialGradient(0, 0, 0, 0, 0, 64);
   g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(.5, 'rgba(240,247,255,.4)'); g.addColorStop(1, 'rgba(240,247,255,0)');
   c.fillStyle = g; c.fillRect(-64, -64, 128, 128);
 } },
 { id: 'sky_migration-ship', w: 360, h: 306, image: 'art/enemies/ch1/migration-ship.png' },
];
