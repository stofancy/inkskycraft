// 顶层状态机：标题 → 关卡 → 结算 → 下一关 / 续关 / 结局。
import type { Input } from '../core/input';
import { DIFF_ORDER, loadDifficulty, saveDifficulty, type Difficulty } from '../core/difficulty';
import { saveHiScore, saveSettings } from '../core/settings';
import { Clock, wait } from '../core/tasks';
import type { Renderer } from '../gl/renderer';
import { STAGES, TEST_STAGE } from '../stages/index';
import type { StageDef } from '../stages/types';
import type { GameAudio, GameUI, Settings, StageResult, UIEvents } from '../types';
import { World } from './world';
import { TEST_CHECKPOINTS } from '../stages/checkpoints';
import { FINAL_TEST_STAGE } from '../stages/stage3';
import { TALENTS } from './progression';
import type { TestRunOptions } from './test-options';
import { ACTIVE_MOVES } from './moves';

type State = 'loading' | 'title' | 'playing' | 'paused' | 'continue' | 'results' | 'gameover' | 'ending' | 'growth';

export interface DebugOpts {
  stage?: number;
  god?: boolean;
  power?: number;
  weapon?: 'red' | 'blue' | 'purple';
  autofire?: boolean;
  bot?: boolean;
  skip?: number;
  /** easy | normal | hard，覆盖已保存的难度。 */
  diff?: string;
}

export class Game implements UIEvents {
  state: State = 'loading';
  readonly world: World;
  private stages: StageDef[];
  private stageIdx = 0;
  private continueT = 0;
  private titleT = 0;
  private pendingResult: StageResult | null = null;
  private restMode: 'talent' | 'shop' = 'talent';
  fps = 60;
  testRun: TestRunOptions | null = null;

  constructor(
    readonly r: Renderer, readonly audio: GameAudio, readonly ui: GameUI, readonly input: Input,
    public settings: Settings, hiScore: number, readonly debug: DebugOpts = {},
  ) {
    this.world = new World(r, audio, ui, input);
    this.world.hiScore = hiScore;
    this.world.setDifficulty(loadDifficulty(debug.diff));
    this.world.onGameOver = () => this.toContinue();
    this.world.debugAuto = !!debug.bot;
    this.world.onMilestone = label => this.openMilestone(label);
    this.stages = STAGES.length ? STAGES : [TEST_STAGE];
    this.applySettings(settings);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    this.audio.setVolumes(s.masterVol, s.musicVol, s.sfxVol);
    this.world.fx.shakeEnabled = s.screenShake;
    this.world.fx.density = s.quality === 'ultra' ? 2 : 1;
    this.r.setQuality(s.quality);
    if (Math.abs(this.r.renderScale - s.renderScale) > 1e-3) this.r.setRenderScale(s.renderScale);
  }

  // ------------------------------------------------------------ UIEvents

  onStart(): void {
    if (this.state !== 'title') return;
    this.world.newGame();
    this.startStage(0);
  }

  onTestStart(options: TestRunOptions): void {
    if(this.state !== 'title')return;
    const entry=TEST_CHECKPOINTS[options.chapter]?.find(p=>p.id===options.checkpoint);
    if(!entry)return;
    const selected=structuredClone(options);
    selected.bossPhase=Math.max(1,Math.min(entry.phases??1,Math.trunc(selected.bossPhase)||1));
    selected.companions=[...new Set(selected.companions)].filter(k=>['chiyan','laodun','moyuan','suanpan'].includes(k)).slice(0,2);
    selected.passives=[...new Set(selected.passives)].filter(id=>TALENTS.some(t=>t.id===id));
    this.world.newGame();
    this.testRun=selected;
    this.startStage(selected.chapter-1,selected);
  }

  onResume(): void {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.ui.screen('none');
    }
  }

  onQuitToTitle(): void {
    saveHiScore(this.world.hiScore);
    this.toTitle();
  }

  onContinue(yes: boolean): void {
    if (this.state !== 'continue') return;
    if (yes) {
      const w = this.world;
      w.score = 0;
      w.player.lives = 2;
      w.player.respawn();
      this.state = 'playing';
      this.ui.screen('none');
      this.audio.sfx('menu_ok');
    } else {
      this.toGameOver();
    }
  }

  onResultsDone(): void {
    if (this.state !== 'results') return;
    if(this.testRun){this.toTitle();return;}
    if (this.stageIdx + 1 < this.stages.length) this.startStage(this.stageIdx + 1);
    else this.toEnding();
  }

  onSettingsChange(s: Settings): void {
    saveSettings(s);
    this.applySettings(s);
  }

  onDifficultyChange(d: Difficulty): void {
    if (!DIFF_ORDER.includes(d)) return;
    this.world.setDifficulty(d);
    saveDifficulty(d);
  }

  onMenuSound(kind: 'move' | 'ok' | 'back'): void {
    this.audio.sfx(kind === 'move' ? 'menu_move' : kind === 'ok' ? 'menu_ok' : 'menu_back');
  }

  private openMilestone(label: string): void {
    const w = this.world;
    if (!label.startsWith('成长 ')) {
      const goods=w.shop.offerChapter(Math.min(4,w.contentStats.milestones));
      if(this.debug.bot){const affordable=goods.find(g=>g.cost<=w.shop.credits);if(affordable)w.shop.purchase(affordable.id);else w.shop.skip();w.restLabel='';return;}
      this.restMode='shop';this.state='growth';
      this.ui.screen('growth',{choiceTitle:'行囊补给',choiceHint:`补给 ${w.shop.credits} · 采购一项或保留`,choices:[...goods.map(g=>({id:g.id,name:g.name,description:g.description,cost:g.cost,disabled:g.cost>w.shop.credits})),{id:'skip',name:'继续前行',description:'保留补给额度'}],moves:this.moveCards()});return;
    }
    const talents = w.progression.offerTalents();
    if (this.debug.bot) {if(talents[0])w.progression.choose(talents[0].id);w.restLabel='';return;}
    this.restMode='talent';this.state='growth';
    if(w.progression.talents.size===0)w.say('算盘','平静','三项挑一项，照着示意行动就会生效。',3);
    this.ui.screen('growth', {choiceTitle:label,choiceHint:'先看效果示意，选一项；之后按条件自动生效',choices:talents.map(t=>({id:t.id,name:t.name,description:t.description,detail:t.route,preview:t.preview,icon:t.icon})),moves:this.moveCards()});
  }

  onChoice(id: string): void {
    if (this.state !== 'growth') return;
    const w = this.world;
    if (this.restMode === 'talent') {
      if (!w.progression.choose(id)) return;
      w.restLabel='';this.state='playing';this.ui.screen('none');
    } else {
      if (id === 'skip') w.shop.skip(); else if (!w.shop.purchase(id)) return;
      w.restLabel = '';
      this.state = 'playing';
      this.ui.screen('none');
    }
  }

  private moveCards() {
    return [...ACTIVE_MOVES.map(m=>({name:`主动 · ${m.name}`,input:`${m.input} + F / U（手柄 R3）`,effect:`${m.effect} · 冷却 ${m.cooldown} 秒`,window:m.window,cost:m.cost})), ...this.world.combos.moves.map(m => ({ name: `被动 · ${m.name}` + (m.talent && !this.world.progression.has(m.talent) ? ' · 天赋' : ''), input: m.description.split('：')[0], effect: m.description.split('：')[1] ?? m.description, window: m.window, cost: m.cost }))];
  }

  // ------------------------------------------------------------ 流程

  toTitle(): void {
    this.testRun=null;
    this.state = 'title';
    this.world.resetStage();
    this.r.setBackground('title');
    this.audio.music('title', 1.5);
    this.ui.screen('title', { settings: this.settings, hiScore: this.world.hiScore, difficulty: this.world.diffId });
  }

  startStage(i: number, test?: TestRunOptions): void {
    const w = this.world;
    const def = test?.chapter===4 ? FINAL_TEST_STAGE : this.debug.stage === 0 && !test ? TEST_STAGE : this.stages[i];
    this.stageIdx = i;
    w.resetStage();
    w.stageIndex = def.index;
    w.stageName = def.name;
    w.player.reset(false);
    if(test){
      w.testOptions=test;
      w.checkpointTarget=test.checkpoint==='start'?null:test.checkpoint;
      w.scroll=TEST_CHECKPOINTS[test.chapter].find(p=>p.id===test.checkpoint)!.scroll;
      w.companions.setTestSelection(test.companions);
      for(const id of test.passives)w.progression.talents.set(id,1);
      this.applyDebug();
    }
    this.r.setBackground(def.bg);
    this.audio.music(def.music, 1);
    this.state = 'playing';
    this.ui.screen('none');
    const game = this;
    w.root.run((function* () {
      yield* def.script(w);
      yield* wait(2);
      game.toResults(def);
    })());
  }

  private toResults(def: StageDef): void {
    const w = this.world;
    const bonus = (w.noMiss ? 200000 : 0) + w.player.bombs * 20000 + w.maxChain * 500 + w.brush.sealed * 100;
    const res: StageResult = {
      stage: def.index, stageName: def.name, score: w.score, kills: w.kills, graze: w.graze,
      sealed: w.brush.sealed, maxChain: w.maxChain, noMiss: w.noMiss, bonus,
    };
    w.addScore(bonus);
    saveHiScore(w.hiScore);
    this.pendingResult = res;
    this.state = 'results';
    this.audio.music('clear', 0.5);
    this.audio.sfx('stage_clear');
    this.ui.screen('results', { results: res });
  }

  private toContinue(): void {
    this.state = 'continue';
    this.continueT = 10;
    this.audio.music('gameover', 1);
    this.ui.screen('continue', { countdown: 10 });
  }

  private toGameOver(): void {
    const w = this.world;
    saveHiScore(w.hiScore);
    this.state = 'gameover';
    this.ui.screen('gameover', { finalScore: w.score, hiScore: w.hiScore });
  }

  private toEnding(): void {
    const w = this.world;
    saveHiScore(w.hiScore);
    this.state = 'ending';
    this.r.setBackground('title');
    this.audio.music('ending', 2);
    this.ui.screen('ending', { finalScore: w.score, hiScore: w.hiScore });
  }

  // ------------------------------------------------------------ 帧

  update(dt: number): void {
    const inp = this.input, w = this.world;
    switch (this.state) {
      case 'playing':
        if (inp.pressed('pause')) {
          this.state = 'paused';
          w.moves.resetInput();
          this.ui.screen('pause', { settings: this.settings, moves: this.moveCards() });
          this.audio.sfx('menu_ok');
          break;
        }
        this.applyDebug();
        w.tick(dt);
        break;
      case 'continue':
        this.continueT -= dt;
        this.ui.screen('continue', { countdown: Math.max(0, Math.ceil(this.continueT)) });
        if (this.continueT <= 0) this.toGameOver();
        this.idle(dt);
        break;
      case 'title':
      case 'ending':
        this.titleT += dt;
        this.idle(dt, 18);
        break;
      default:
        this.idle(dt);
    }
    this.ui.menuInput(inp); // 游戏中 UI 无菜单，只同步最近使用的设备
  }

  /** 非游戏状态：只推进时间让背景和特效继续动。 */
  private idle(dt: number, scroll = 0): void {
    const w = this.world;
    w.moves.resetInput();
    w.real += dt;
    w.time += dt * (this.state === 'paused' || this.state === 'growth' ? 0 : 1);
    w.scroll += scroll * dt;
    Clock.dt = 0;
    w.fx.update(0, dt, w.real);
    w.timeScale = 1;
    this.r.post.inkMode = 0;
    this.audio.setSlowmo(0);
  }

  private applyDebug(): void {
    const d = this.debug, p = this.world.player;
    if (this.testRun?.god || (!this.testRun && d.god)) p.invuln = Math.max(p.invuln, 1);
    if(this.testRun?.fullInk)p.ink=1;
    if(this.testRun?.fullBombs)p.bombs=7; // 与道具/商店的库存上限一致。
    if (d.power) { p.power = d.power; d.power = 0; }
    if (d.weapon) { p.weapon = d.weapon; d.weapon = undefined; }
  }

  render(): void {
    const w = this.world;
    const playing = this.state === 'playing' || this.state === 'paused' || this.state === 'continue' || this.state === 'results' || this.state === 'growth';
    if (playing) w.draw();
    const beat = this.audio.beat();
    this.r.render(w.time, w.real, w.scroll, beat.phase, w.bgFlashValue, this.state === 'playing' ? w.dt : this.state === 'paused' || this.state === 'growth' ? 0 : 1 / 60);
    this.ui.hud(w.hud(this.fps), this.state === 'playing' || this.state === 'continue');
  }
}
