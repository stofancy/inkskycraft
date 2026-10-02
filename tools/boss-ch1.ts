// P3-04独立试战入口，复用真实Game/World；?boss=copper|paper&phase=1&diff=normal。
// ?manual=1 仅供60Hz验收驱动暂停自动update，不替换判定、计时或渲染。
import type { Game } from '../src/game/game';
import type { Enemy } from '../src/game/enemy';
import { Sparrow, Serpent } from '../src/stages/stage1_boss';
const frame = document.querySelector<HTMLIFrameElement>('#scene')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const boss = document.querySelector<HTMLSelectElement>('#boss')!;
const phase = document.querySelector<HTMLSelectElement>('#phase')!;
const diff = document.querySelector<HTMLSelectElement>('#diff')!;
const params = new URLSearchParams(location.search);
boss.value = params.get('boss') === 'paper' ? 'paper' : 'copper';
diff.value = params.get('diff') ?? 'normal';
function options() { phase.innerHTML = Array.from({ length: 3 }, (_, i) => `<option value="${i + 1}">第${i + 1}段</option>`).join(''); }
options(); phase.value = params.get('phase') ?? '1'; boss.addEventListener('change', options);
let game: Game | undefined, current: Enemy | undefined;
let pollInput: (() => void) | undefined;
function start(kind = boss.value, index = Number(phase.value)) {
  if (!game) return;
  boss.value = kind; options(); phase.value = String(index);
  const doc = frame.contentDocument;
  doc?.querySelectorAll('.communication,.card,.warn,.battle-notice').forEach(e => e.remove());
  doc?.querySelectorAll<HTMLElement>('.pop').forEach(e => e.style.display = 'none');
  const w = game.world; w.resetStage(); w.score = 0; w.timeScale = 1; w.player.reset(false); w.player.entering = 0; w.player.invuln = 1;
  w.player.x = 450; w.player.y = 1050; w.player.power = 4; w.player.ink = 1;
  game.debug.god = document.querySelector<HTMLInputElement>('#god')!.checked;
  game.state = 'playing'; game.ui.screen('none');
  // 独立Boss验收排除伙伴清弹/增伤；正式章节的队伍由P3-02/P3-05管理。
  w.companions.update = () => {}; w.companions.draw = () => {};
  w.progression.resetRun();
  const def = kind === 'paper' ? Serpent : Sparrow;
  w.root.run(w.boss({ ...def, onDeath(e) { current = e; } }, 450, -220, { warning: false, music: false, startPhase: index }));
  w.root.tick(); current = w.liveEnemies().find(e => !!e.def.boss);
}
const controls = { start, pollInput: () => pollInput?.(), get game() { return game; }, get boss() { return current; } };
(window as unknown as { __bossScene: typeof controls }).__bossScene = controls;
frame.src = `../index.html?stage=1&god=1&power=4&diff=${diff.value}`;
const beginning = performance.now();
function poll() {
  const win = frame.contentWindow as (Window & { __game?: Game }) | null;
  if (!win?.__game) { if (performance.now() - beginning > 60000) loading.textContent = '加载超时，请重新打开试战。'; else requestAnimationFrame(poll); return; }
  game = win.__game;
  pollInput = game.input.poll.bind(game.input);
  if (params.has('manual')) { game.update = () => {}; game.input.poll = () => {}; }
  start(); loading.hidden = true;
  function status() {
    const e = current;
    document.querySelector('#status')!.textContent = e ? `${e.def.name} · 第${e.data.phaseIndex ?? '入场'}段 · ${e.data.action ?? '横翼登场'}${e.charging ? ' · 蓄力中' : ''}${e.data.armorLoose ? ' · 外甲松动 ×3' : ''}${e.stunned > 0 ? ' · 打断硬直' : ''}` : '等待首领';
    requestAnimationFrame(status);
  }
  status();
}
poll();
document.querySelector('#reset')!.addEventListener('click', () => { params.set('boss', boss.value); params.set('phase', phase.value); params.set('diff', diff.value); location.search = params.toString(); });
document.querySelector('#loosen')!.addEventListener('click', () => { if (game && current) game.world.loosenArmor(current, 4); });
document.querySelector('#interrupt')!.addEventListener('click', () => { if (current?.charging) current.interrupt(1.5); });
document.querySelector('#god')!.addEventListener('change', () => { if (game) game.debug.god = document.querySelector<HTMLInputElement>('#god')!.checked; });
document.querySelector('#pause')!.addEventListener('click', () => { if (game) game.state = game.state === 'paused' ? 'playing' : 'paused'; });
