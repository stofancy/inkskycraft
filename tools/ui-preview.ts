// UI 预览。参数：screen=title|hud|pause|settings|results|continue|gameover|ending|loading|none
//   demo=stagecard|warning|popups|caption|notice   boss=1 显示 Boss 血条   t=continue 倒计时/loading 进度
// 调用方时序：screen('title'|'loading'|'ending'|...) 时游戏应调用 hud(state,false)；游戏中每帧 hud(state,true)；
// pause/results/continue 期间可继续 hud(state,true) 显示数值。同名 screen 重复调用只更新数据（countdown/progress）。
import { createUI } from '../src/ui/index';
import { DEFAULT_SETTINGS, type Action, type HudState, type InputState, type ScreenName } from '../src/types';

const q = new URLSearchParams(location.search);
const screen = (q.get('screen') ?? 'hud') as ScreenName | 'hud';
const demo = q.get('demo');
const root = document.getElementById('ui')!;
const bgEl = document.createElement('div');
bgEl.style.cssText = 'position:fixed;inset:0;background:radial-gradient(ellipse at 50% 40%,#231a16,#0a0706 70%)';
const playEl = document.createElement('div');
document.body.insertBefore(bgEl, root);
document.body.insertBefore(playEl, root);

const ui = createUI();
const log: string[] = [];
ui.mount(root, {
  onStart: () => log.push('start'), onResume: () => log.push('resume'), onQuitToTitle: () => log.push('quit'),
  onContinue: (y) => log.push('continue ' + y), onResultsDone: () => log.push('resultsDone'),
  onSettingsChange: (s) => { log.push('settings'); (window as any).__settings = s; }, onMenuSound: () => {}, onDifficultyChange: () => {},
});
(window as any).__log = log;

function doLayout() {
  const vw = innerWidth, vh = innerHeight;
  let w = vh * 0.75, hh = vh;
  if (w > vw) { w = vw; hh = vw / 0.75; }
  const r = { x: Math.round((vw - w) / 2), y: Math.round((vh - hh) / 2), w: Math.round(w), h: Math.round(hh) };
  playEl.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;background:linear-gradient(#d8cfba,#8c8a7c 60%,#5a5a52);opacity:.9;box-shadow:0 0 0 2px #dcb75e80`;
  ui.layout(r, { w: vw, h: vh });
}
addEventListener('resize', doLayout);
doLayout();

const hs: HudState = {
  score: 0, hiScore: 1234567, lives: 3, bombs: 2, ink: 0.4, inkReady: false, power: 5, weapon: 'red', missile: 2,
  multiplier: 1.0, graze: 0, medalValue: 3000, stage: 1, stageName: '墨山晓', boss: null, brushActive: false, fps: 144, difficulty: '普通',
};
const bossOn = q.get('boss') === '1';
const t0 = performance.now();
const keys = new Set<string>();
const edge = new Set<Action>();
const map: Record<string, Action> = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', z: 'confirm', Enter: 'confirm', x: 'back', Escape: 'back' };
addEventListener('keydown', (e) => { const a = map[e.key]; if (a && !keys.has(e.key)) { keys.add(e.key); edge.add(a); } });
addEventListener('keyup', (e) => keys.delete(e.key));
const input: InputState = {
  down: (a) => [...keys].some((k) => map[k] === a), pressed: (a) => edge.has(a), axisX: 0, axisY: 0, device: 'keyboard',
};

if (screen !== 'hud') ui.screen(screen, {
  settings: { ...DEFAULT_SETTINGS }, countdown: parseFloat(q.get('t') ?? '7.4'), progress: parseFloat(q.get('t') ?? '0.62'),
  finalScore: 8123400, hiScore: 8000000,
  results: { stage: 1, stageName: '墨山晓', score: 2345600, kills: 187, graze: 1432, sealed: 96, maxChain: 41, noMiss: true, bonus: 500000 },
});
if (demo === 'stagecard') ui.stageCard(1, '墨山晓', '黎明');
if (demo === 'warning') ui.warning('铜雀', '蚀化的青铜神鸟');
if (demo === 'caption') ui.say('曜雀', '坚定', '跟紧我，前面有伏兵。', 30);
if (demo === 'notice') ui.notice('弱点暴露 · 攻击核心', 30);
(window as any).__ui = ui;
const kinds = ['score', 'seal', 'extend', 'graze', 'info', 'chain'] as const;
let pk = 0;
if (demo === 'popups') {
  setInterval(() => { const k = kinds[pk++ % 6]; ui.popup(150 + Math.random() * 600, 300 + Math.random() * 600, k === 'seal' ? '封' : k === 'extend' ? 'EXTEND' : k === 'chain' ? '12 CHAIN' : k === 'info' ? '武器切换' : k === 'graze' ? '+10' : '+12,000', k); }, 250);
  for (let i = 0; i < 6; i++) ui.popup(200 + i * 100, 600, ['+3,000', '封', 'EXTEND', '+10', '武器切换', '12 CHAIN'][i], kinds[i]);
}

function frame() {
  const t = (performance.now() - t0) / 1000;
  hs.score = Math.floor(t * 4321) + 1200000;
  hs.ink = (Math.sin(t * 0.5) * 0.5 + 0.5);
  if (q.get('ink')) hs.ink = parseFloat(q.get('ink')!);
  hs.inkReady = hs.ink > 0.6;
  hs.brushActive = q.get('brush') === '1';
  hs.graze = Math.floor(t * 23);
  hs.multiplier = 1 + Math.floor(t) % 6 * 0.75;
  hs.weapon = (['red', 'blue', 'purple'] as const)[Math.floor(t / 4) % 3];
  hs.power = 1 + Math.floor(t / 1.5) % 8;
  hs.boss = bossOn ? { name: '铜雀', hp: 0.75 - (t * 0.05) % 0.7, phasesLeft: 3, timer: 42 - t % 40 } : null;
  ui.hud(hs, screen !== 'title' && screen !== 'loading' && screen !== 'ending');
  ui.menuInput(input);
  edge.clear();
  requestAnimationFrame(frame);
}
frame();
