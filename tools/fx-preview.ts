import type { Game } from '../src/game/game';

type SceneWindow = Window & { __game?: Game };
type Palette = 'fire' | 'ink' | 'cyan' | 'violet';
let weapon: 'red'|'blue'|'purple' = 'purple';
let power = 8;
const frame = document.querySelector<HTMLIFrameElement>('#scene')!;
const status = document.querySelector<HTMLDivElement>('#status')!;
const caption = document.querySelector<HTMLSpanElement>('#caption')!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')];
const stageButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-stage]')];
const names = ['晓山返笔', '灯河还名', '云垣断律'];
let stage = 1, slow = false, palette: Palette = 'fire';
let game: Game | undefined;
let restore: (() => void) | undefined;
let generation = 0;
let loading = false;
let previewStarted = 0;

function refresh(): void {
  stageButtons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === stage)));
  document.querySelector('#slow')!.setAttribute('aria-pressed', String(slow));
  const label = mode === 'thunder' ? `${{red:'朱羽刃',blue:'青玉束',purple:'紫金雷刃'}[weapon]} · 力${power}` : mode==='commands'?'一笔破阵 · 回墨护身':mode==='hits'?'青裂片 · 朱笔芒 · 紫折雷 · 灰金拒伤':mode==='chapterInk'?'第一章 · 小中大朱墨爆散':{fire:'火焰爆裂',ink:'墨焰绽放',cyan:'碎玉冷爆',violet:'雷蚀裂解'}[palette];
  caption.textContent = `${names[stage - 1]} · ${label}${slow ? ' · 慢放' : ''}`;
}
let mode: 'explosion' | 'thunder' | 'commands' | 'hits' | 'chapterInk' = 'explosion';

function replay(): void {
  if (!game || loading) return;
  const w = game.world;
  w.fx.clear();
  game.r.partLow.reset();
  game.r.partHigh.reset();
  game.r.fluid.clear();
  previewStarted=w.time;
  if(mode==='chapterInk')for(const [i,size]of (['s','m','l'] as const).entries()){
    const e=w.spawn({sprite:'e_hornet',hp:1,score:0,explosion:size},170+i*280,540);e.lastDamageSource='red';w.kill(e);
  }
  else if(mode==='explosion')w.fx.explosion(450, 520, 'xl', palette);
  refresh();
}

async function load(nextMode: typeof mode): Promise<void> {
  const token = ++generation;
  restore?.(); restore = undefined; game = undefined;
  mode = nextMode; loading = true;
  if (mode === 'thunder') slow = true;
  buttons.forEach(b => b.disabled = true);
  status.hidden = false;
  status.textContent = '正在展开画卷…';
  refresh();
  let actualError = '';
  const query = mode === 'thunder'
    ? `stage=${stage}&god=1&autofire=1&weapon=${weapon}&power=${power}`
    : `stage=${stage}&god=1`;
  // 相同章节 URL 的模式切换也会导航；等待新文档 load，避免修改即将卸载的旧世界。
  const navigation = new Promise<void>(resolve => frame.addEventListener('load',()=>resolve(),{once:true}));
  frame.src = `../index.html?${query}`;
  await navigation;
  if(token!==generation)return;
  const started = performance.now();
  let observed: Window | null = null;
  try {
    while (token === generation) {
      const win = frame.contentWindow as SceneWindow | null;
      if (win && win !== observed) {
        observed = win;
        win.addEventListener('error', event => { actualError = event.message; });
        win.addEventListener('unhandledrejection', event => { actualError = String(event.reason?.message ?? event.reason); });
      }
      const bootError = win?.document.querySelector('body > pre')?.textContent?.trim();
      if (bootError?.startsWith('启动失败：')) throw new Error(bootError);
      // 同源导航期间旧文档可能仍存在；只接受目标 URL 的已启动游戏。
      if (win?.location.search === `?${query}` && win.__game?.state === 'playing') {
        game = win.__game;
        const originalUpdate = game.update;
        game.update = function(dt: number): void { originalUpdate.call(this, dt * (slow ? 0.4 : 1)); };
        let originalPlayerUpdate: Game['world']['player']['update'] | undefined;
        let originalWorldDraw: Game['world']['draw'] | undefined;
        if (mode === 'explosion' || mode==='chapterInk' || mode==='commands' || mode==='hits') {
          const w = game.world;
          w.resetStage();
          w.root.cancel();
          w.player.reset(false);
          w.player.alive = false;
          originalPlayerUpdate = w.player.update;
          w.player.update = () => {};
          // 试映保留原背景与渲染管线，移除游戏 HUD。
          const ui = win.document.querySelector<HTMLElement>('#ui');
          if (ui) ui.style.display = 'none';
          w.fx.shakeEnabled=false;
          if(mode==='commands'){
            originalWorldDraw=w.draw;
            const draw=originalWorldDraw;
            w.draw=function():void{
              draw.call(this);
              const age=this.time-previewStarted;
              if(age<.65){game!.r.ribbonMid.move('cut',240,950,age);game!.r.ribbonMid.move('guard',660,950,age);}
            };
          }
          if(mode==='hits'){
            const target=w.spawn({sprite:'b_sparrow_body',hp:1e8,noCollide:true},450,330);
            target.scaleX=2.7;target.scaleY=1.4;
            const small=[220,450,680].map(x=>w.spawn({sprite:'e_hornet',hp:1e8,noCollide:true},x,670));
            for(let i=0;i<3;i++){w.shoot(340+i*140,300,0,0,{color:'magenta'});w.shoot(250+i*230,690,0,0,{color:'magenta'});}
            const update=game.update;let sample=-1;
            game.update=function(dt:number):void{
              update.call(this,dt);
              const now=Math.floor(w.time*8);if(sample===now)return;sample=now;
              for(const [i,source]of (['blue','red','purple'] as const).entries()){
                w.damage(target,.1,310+i*140,300,true,source);w.damage(small[i],.1,small[i].x,690,true,source);
              }
              target.invulnerable=true;w.damage(target,1,450,235,true,'neutral');target.invulnerable=false;
            };
          }
        } else {
          const w = game.world;
          w.resetStage(); w.root.cancel();
          w.player.reset(false); w.player.entering = 0;
          w.player.x = 450; w.player.y = 830;
          w.player.weapon = weapon; w.player.power = power;
          game.debug.god = false; w.player.invuln = 0;
          const target = w.spawn({sprite:['b_sparrow_body','b_mirage_body','b_peng_body'][stage-1],hp:50000,noCollide:true,radius:95,explosion:'xl'},450,350);
          if (stage === 1 || stage === 3) {
            const wing = { sprite: stage === 1 ? 'b_sparrow_wing' : 'b_peng_wing', hp: 50000, noCollide: true };
            w.attach(target, wing, 'wingL');
            w.attach(target, wing, 'wingL', { mirror: true });
          }
          target.data.weakWeapon = weapon; target.data.weakLabel = '演出靶机';
          const ui = win.document.querySelector<HTMLElement>('#ui');
          if (ui) ui.style.display = 'none';
        }
        const current = game;
        restore = () => {
          current.update = originalUpdate;
          if (originalPlayerUpdate) current.world.player.update = originalPlayerUpdate;
          if (originalWorldDraw) current.world.draw=originalWorldDraw;
        };
        loading = false;
        buttons.forEach(b => b.disabled = false);
        status.hidden = true;
        if (mode === 'explosion' || mode==='chapterInk' || mode==='commands') replay();
        return;
      }
      if (performance.now() - started > 45000) {
        const uiError = win?.document.querySelector('#ui')?.textContent?.trim();
        throw new Error(actualError || uiError || '画卷加载超时，游戏未进入可播放状态。');
      }
      if (actualError) throw new Error(actualError);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    if (token !== generation) return;
    loading = false;
    status.textContent = `画卷未能展开\n${error instanceof Error ? error.message : String(error)}\n点击场景按钮可重试。`;
    buttons.forEach(b => b.disabled = false);
  }
}

stageButtons.forEach(b => b.addEventListener('click', () => {
  stage = Number(b.dataset.stage); void load('explosion');
}));
for (const p of ['fire', 'ink', 'cyan', 'violet'] as const) document.querySelector(`#${p}`)!.addEventListener('click', () => {
  palette = p;
  if (mode !== 'explosion' || !game) void load('explosion'); else replay();
});
document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(b => b.addEventListener('click', () => { weapon = b.dataset.weapon as typeof weapon; void load('thunder'); }));
document.querySelector<HTMLInputElement>('#power')!.addEventListener('input', event => { power = Number((event.target as HTMLInputElement).value); if (game) game.world.player.power = power; refresh(); });
document.querySelector('#slow')!.addEventListener('click', () => { slow = !slow; refresh(); });
document.querySelector('#commands')!.addEventListener('click',()=>{if(mode==='commands'&&game)replay();else void load('commands');});
document.querySelector('#hits')!.addEventListener('click',()=>void load('hits'));
document.querySelector('#chapterInk')!.addEventListener('click',()=>{stage=1;if(mode==='chapterInk'&&game)replay();else void load('chapterInk');});
window.addEventListener('pagehide', () => restore?.());
void load('explosion');
