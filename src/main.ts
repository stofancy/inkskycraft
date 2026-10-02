// 入口：创建渲染器、音频、UI、输入，烘焙精灵后进入主循环。
// 调试参数：?stage=0|1|2|3 直接开始某关（0 为引擎测试关）  god=1 无敌  power=1..8
//   weapon=red|blue|purple  autofire=1 自动射击  bot=1 自动移动  skip=秒 快进关卡脚本
//   diff=easy|normal|hard 覆盖难度（默认读 localStorage，缺省为普通）
import { createAudio } from './audio/index';
import { Input } from './core/input';
import { loadHiScore, loadSettings } from './core/settings';
import { Game, type DebugOpts } from './game/game';
import { Renderer } from './gl/renderer';
import { createUI } from './ui/index';

const q = new URLSearchParams(location.search);
const debug: DebugOpts = {
  stage: q.has('stage') ? Number(q.get('stage')) : undefined,
  god: q.get('god') === '1',
  power: q.has('power') ? Number(q.get('power')) : undefined,
  weapon: (q.get('weapon') as DebugOpts['weapon']) ?? undefined,
  autofire: q.get('autofire') === '1',
  bot: q.get('bot') === '1',
  skip: q.has('skip') ? Number(q.get('skip')) : undefined,
  diff: q.get('diff') ?? undefined,
};

async function boot(): Promise<void> {
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui') as HTMLElement;
  const settings = loadSettings();
  const input = new Input();
  const audio = createAudio();
  const ui = createUI();
  // 上下文丢失（驱动重置、浏览器冷启动时 GPU 通道重建）后整页重载；5 秒内不重复，避免循环
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('WebGL 上下文丢失'); });
  canvas.addEventListener('webglcontextrestored', () => {
    const last = Number(sessionStorage.getItem('inksky.reload') ?? 0);
    if (Date.now() - last > 5000) { sessionStorage.setItem('inksky.reload', String(Date.now())); location.reload(); }
  });
  const r = new Renderer(canvas);

  let game: Game | null = null;
  const events = {
    onStart: () => game?.onStart(),
    onTestStart: (options: import('./game/test-options').TestRunOptions) => game?.onTestStart(options),
    onResume: () => game?.onResume(),
    onQuitToTitle: () => game?.onQuitToTitle(),
    onContinue: (y: boolean) => game?.onContinue(y),
    onResultsDone: () => game?.onResultsDone(),
    onChoice: (id: string) => game?.onChoice(id),
    onDifficultyChange: (d: 'easy' | 'normal' | 'hard') => game?.onDifficultyChange(d),
    onSettingsChange: (s: typeof settings) => game?.onSettingsChange(s),
    onMenuSound: (k: 'move' | 'ok' | 'back') => game?.onMenuSound(k),
  };
  ui.mount(uiRoot, events);
  ui.screen('loading', { progress: 0 });
  const layout = () => ui.layout(r.playCss, { w: window.innerWidth, h: window.innerHeight });
  r.onResize = layout;

  const unlock = () => { audio.init().catch((e) => console.warn('音频初始化失败', e)); };
  input.onFirstGesture = unlock;
  if (q.has('stage')) unlock();

  await r.init(settings, (p) => ui.screen('loading', { progress: p }));
  layout();
  console.info('GPU:', r.gpuName());

  game = new Game(r, audio, ui, input, settings, loadHiScore(), debug);
  (window as unknown as { __game: Game }).__game = game;

  if (debug.stage !== undefined) {
    game.world.newGame();
    game.startStage(Math.max(0, debug.stage - 1));
    if (debug.skip) {
      const w = game.world;
      w.player.invuln = debug.skip + 3;
      for (let i = 0; i < debug.skip * 60; i++) w.tick(1 / 60);
    }
  } else {
    game.toTitle();
  }
  if (q.get('pipeline') === '1') {
    const { installAnimationScene } = await import('../tools/anim-scene');
    installAnimationScene(game);
  }

  // 自动操作（截图/测试用）
  if (debug.autofire || debug.bot) {
    const fake = input as unknown as { down: (a: string) => boolean; axisX: number; axisY: number };
    const orig = input.down.bind(input);
    fake.down = (a) => (a === 'shoot' && debug.autofire) || orig(a as never);
    if (debug.bot) {
      let t = 0;
      const origPoll = input.poll.bind(input);
      input.poll = () => {
        origPoll();
        t += 1 / 60;
        fake.axisX = Math.sin(t * 0.9) * 0.8;
        fake.axisY = Math.sin(t * 0.5) * 0.35;
      };
    }
  }

  const STEP = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let fpsAcc = 0, fpsN = 0;
  const frame = (now: number) => {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) { game!.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    if (Math.abs(dt - STEP) < 0.0015) dt = STEP; // 60Hz 显示器上锁步，避免抖动
    acc += dt;
    let n = 0;
    while (acc >= STEP - 1e-6 && n < 4) {
      input.poll();
      game!.update(STEP);
      acc -= STEP;
      n++;
    }
    if (n === 4) acc = 0;
    game!.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;left:20px;top:20px;color:#f66;font:14px monospace;white-space:pre-wrap;z-index:99">启动失败：${String(e?.message ?? e)}</pre>`);
});
