// 演示页控制真实游戏 iframe；截图参数 ?time=秒 可停在指定动画帧。
import type { Game } from '../src/game/game';
import type { installAnimationScene } from './anim-scene';
import { installSheetScene } from './sheets-scene';
type SceneWindow = Window & { __game?: Game; __anim?: ReturnType<typeof installAnimationScene> };
const frame = document.querySelector<HTMLIFrameElement>('#scene')!;
const status = document.querySelector<HTMLElement>('#status')!;
let game: Game | undefined, controls: SceneWindow['__anim'];
let paused = false, deform = true;
const params = new URLSearchParams(location.search);
const fixedTime = params.get('time');
const gallery = params.has('gallery');
let sheetControls: Awaited<ReturnType<typeof installSheetScene>> | undefined;
let installing = false;
if (gallery) {
  document.querySelector('#description')!.textContent = '八类分镜在实际关卡背景播放，右下伙伴使用独立相位。';
  document.querySelector('#caption')!.textContent = '循环 / 往返 / 单次 · 爆炸每 2.5 秒重播 · 伙伴叠加轻微形变';
  document.querySelector('#gallery')!.textContent = '分件试映';
  ['turn', 'break'].forEach(id => document.querySelector<HTMLButtonElement>(`#${id}`)!.hidden = true);
  ['replay', 'background'].forEach(id => document.querySelector<HTMLButtonElement>(`#${id}`)!.hidden = false);
}
frame.src = '../index.html?stage=1&pipeline=1';
const started = performance.now();
async function poll() {
  const win = frame.contentWindow as SceneWindow | null;
  const error = win?.document.querySelector('body > pre')?.textContent;
  if (error || performance.now() - started > 60000) { status.textContent = error ?? '加载超时，请重新展开'; return; }
  if (!win?.__anim || !win.__game) { requestAnimationFrame(poll); return; }
  game = win.__game; controls = win.__anim;
  if (gallery && !sheetControls) {
    if (installing) return;
    installing = true;
    try { sheetControls = await installSheetScene(game, params.get('version') === '1' ? 1 : 2); }
    catch (error) { status.textContent = `分镜展开失败：${String(error)}`; return; }
  }
  if (fixedTime !== null) {
    const time = Number(fixedTime);
    game.state = 'paused';
    if (sheetControls) sheetControls.seek(time);
    else {
      game.world.time = game.world.real = time;
      controls.body.age = controls.left.age = controls.right.age = controls.tail.age = time;
      for (const e of controls.body.children) e.syncToParent();
    }
    paused = true;
  }
  status.hidden = true;
  document.querySelector('#pause')!.textContent = paused ? '继续动画' : '暂停动画';
  function clock() {
    document.querySelector('#clock')!.textContent = `${game!.world.time.toFixed(2)} 秒${sheetControls ? ` · 命中帧回调 ${sheetControls.events.length} 次` : ''}`;
    requestAnimationFrame(clock);
  }
  clock();
}
poll();
document.querySelector('#pause')!.addEventListener('click', () => {
  if (!game) return;
  paused = !paused; game.state = paused ? 'paused' : 'playing';
  document.querySelector('#pause')!.textContent = paused ? '继续动画' : '暂停动画';
});
document.querySelector('#deform')!.addEventListener('click', () => {
  deform = !deform; (sheetControls ?? controls)?.setDeform(deform);
  document.querySelector('#deform')!.textContent = deform ? '关闭形变' : '开启形变';
});
document.querySelector('#turn')!.addEventListener('click', () => controls?.turn());
document.querySelector('#break')!.addEventListener('click', () => controls?.breakWing());
document.querySelector('#reset')!.addEventListener('click', () => location.reload());
document.querySelector('#gallery')!.addEventListener('click', () => location.href = gallery ? 'anim.html' : 'anim.html?gallery=1');
document.querySelector('#replay')!.addEventListener('click', () => sheetControls?.replay());
let background = 1;
document.querySelector('#background')!.addEventListener('click', () => {
  if (game) game.r.setBackground(`stage${background = background % 3 + 1}`);
});
