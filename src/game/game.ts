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
import { MAX_BOMBS } from './items';
import { TEST_CHECKPOINTS } from '../stages/checkpoints';
import { FINAL_TEST_STAGE } from '../stages/stage3';
import { INK_COLORS } from './ink-score';
import { TALENTS } from './progression';
import { filterSkills } from './skills';
import { filterBrushForms } from './brush-shape';
import type { TestRunOptions } from './test-options';

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
  private stageRequest = 0;
  private continueT = 0;
  private titleT = 0;
  private pendingResult: StageResult | null = null;
  private restMode: 'talent' | 'inkScore' = 'talent';
  private cheatDeadline=0;
  private cheatBuffer='';
  private acceptCheat(code:string):void {
    if(this.state!=='playing'||performance.now()>this.cheatDeadline)return;
    const token:Record<string,string>={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',KeyB:'B',KeyA:'A'};
    if(!token[code]){this.cheatBuffer='';return;}
    this.cheatBuffer=(this.cheatBuffer+token[code]).slice(-12);
    const w=this.world;let name='';
    if(this.cheatBuffer.endsWith('UUDDLRLRBABA')&&!w.allSkills){w.enableAllSkills();name='全技能';}
    if(this.cheatBuffer.endsWith('UDLRABAB')&&!w.cheatGod){w.cheatGod=true;name='无敌';}
    if(name){this.audio.sfx('skill_unlock');this.ui.popup(w.player.x,w.player.y-100,'秘技 · '+name,'info');}
  }
  fps = 60;
  testRun: TestRunOptions | null = null;

  constructor(
    readonly r: Renderer, readonly audio: GameAudio, readonly ui: GameUI, readonly input: Input,
    public settings: Settings, hiScore: number, readonly debug: DebugOpts = {},
  ) {
    this.world = new World(r, audio, ui, input);
    input.onKey=code=>this.acceptCheat(code);
    this.world.hiScore = hiScore;
    this.world.setDifficulty(loadDifficulty(debug.diff));
    this.world.onGameOver = () => this.toContinue();
    this.world.debugAuto = !!debug.bot;
    this.world.onMilestone = label => this.openMilestone(label);
    this.world.onInkScore = name => this.openInkScore(name);
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
    selected.brushMethods=filterBrushForms(selected.brushMethods);
    selected.skills=filterSkills(selected.skills);
    selected.bossPhase=Math.max(1,Math.min(entry.phases??1,Math.trunc(selected.bossPhase)||1));
    selected.companions=[...new Set(selected.companions)].filter(k=>['chiyan','laodun','moyuan','suanpan'].includes(k)).slice(0,2);
    selected.passives=[...new Set(selected.passives)].filter(id=>TALENTS.some(t=>t.id===id));
    selected.bombColor=INK_COLORS.includes(selected.bombColor)?selected.bombColor:'red';selected.inkScore=Object.fromEntries(INK_COLORS.map(c=>[c,Math.max(0,Math.min(3,Math.trunc(selected.inkScore?.[c]??0)))])) as TestRunOptions['inkScore'];
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
      this.audio.music(w.combatMusic, .6);
      this.audio.sfx('menu_ok');
    } else {
      this.toGameOver();
    }
  }

  onResultsDone(): void {
    if (this.state !== 'results') return;
    if(this.testRun){this.toTitle();return;}
    if (this.stageIdx + 1 < this.stages.length) {
      this.world.brushPower = Math.min(3, this.world.brushPower + 1);
      void this.startStage(this.stageIdx + 1, undefined, true);
    }
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

  onDialogueSound(): void {
    this.audio.sfx('menu_move', { vol: .22, pitch: .85 });
  }

  onMenuSound(kind: 'move' | 'ok' | 'back'): void {
    this.audio.sfx(kind === 'move' ? 'menu_move' : kind === 'ok' ? 'menu_ok' : 'menu_back');
  }

  private openMilestone(label: string): void {
    const w = this.world;
    if (!label.startsWith('成长 ')) { w.restLabel = ''; return; }
    const talents = w.progression.offerTalents();
    // 天赋已学全（测试模式默认全开）时不弹空窗口，飘字提示后直接继续。
    if (!talents.length) { w.progression.pendingChoices = Math.max(0, w.progression.pendingChoices - 1); w.restLabel = ''; w.ui.popup(w.player.x, w.player.y - 70, '天赋已学全', 'info'); return; }
    if (this.debug.bot) {if(talents[0])w.progression.choose(talents[0].id);w.restLabel='';return;}
    this.restMode='talent';this.state='growth';
    if(w.progression.talents.size===0)w.say('算盘','平静','三项挑一项，照着示意行动就会生效。',3);
    this.ui.screen('growth', {choiceTitle:`天赋 · ${label}`,choiceHint:'看图标和说明，选一项；之后按条件自动生效',choices:talents.map(t=>({id:t.id,name:t.name,description:t.description,detail:t.route,preview:t.preview,icon:t.icon}))});
  }

  private openInkScore(name:string):void{const w=this.world;if(w.allSkills){w.inkScore.pending=false;return;}if(this.debug.bot){w.inkScore.choose(INK_COLORS.filter(c=>w.inkScore.levels[c]<3).sort((a,b)=>w.inkScore.levels[a]-w.inkScore.levels[b])[0]);return;}const cards=w.inkScore.cards().filter(c=>w.inkScore.levels[c.id as keyof typeof w.inkScore.levels]<3);if(!cards.length){w.inkScore.pending=false;return;}this.restMode='inkScore';this.state='growth';this.ui.screen('growth',{choiceTitle:'墨谱',choiceHint:`${name}的驱动符补全山门笔法，选一色升一级`,choices:cards});}

  onChoice(id: string): void {
    if (this.state !== 'growth') return;
    const w = this.world;
    if(this.restMode==='inkScore'){if(!w.inkScore.choose(id))return;this.state='playing';this.ui.screen('none');w.audio.sfx('seal');return;}
    if (!w.progression.choose(id)) return;
    w.restLabel = ''; this.state = 'playing'; this.ui.screen('none');
  }

  // ------------------------------------------------------------ 流程

  toTitle(): void {
    this.stageRequest++;
    this.testRun=null;
    this.state = 'title';
    this.world.resetStage();
    this.r.setBackground('title');
    this.audio.music('title', 1.5);
    this.ui.screen('title', { settings: this.settings, hiScore: this.world.hiScore, difficulty: this.world.diffId });
  }

  async startStage(i: number, test?: TestRunOptions, interlude = false): Promise<void> {
    const w = this.world;
    const def = test?.chapter===4 ? FINAL_TEST_STAGE : this.debug.stage === 0 && !test ? TEST_STAGE : this.stages[i];
    const request = ++this.stageRequest;
    this.state = 'loading';
    if (interlude) this.audio.music('interlude', .5);
    this.ui.screen('loading', { progress: 0 });
    await this.audio.init();
    if (request !== this.stageRequest) return;
    await this.audio.prepareMusic(def.index, !!test && !!TEST_CHECKPOINTS[test.chapter].find(p => p.id === test.checkpoint)?.phases);
    if (request !== this.stageRequest) return;
    this.stageIdx = i;
    w.resetStage();
    w.stageIndex = def.index;
    w.stageName = def.name;
    w.player.reset(false);
    w.companions.setRoster(def.index===1?[]:def.index===2?['chiyan','laodun']:['laodun','moyuan']);
    if(test){
      w.testOptions={...test,brushMethods:filterBrushForms(test.brushMethods)};
      w.checkpointTarget=test.checkpoint==='start'?null:test.checkpoint;
      w.scroll=TEST_CHECKPOINTS[test.chapter].find(p=>p.id===test.checkpoint)!.scroll;
      w.companions.setRoster(test.companions);
      for(const id of test.passives)w.progression.talents.set(id,1);
      w.inkScore.levels={...test.inkScore};w.player.weapon=test.bombColor;
      w.brushPower=test.brushPower;
      w.brushForms=new Set(filterBrushForms(test.brushMethods));
      w.skills.setUnlocked(test.skills);
      w.roll.reset();
      this.applyDebug();
    }
    w.progression.beginChapter();
    this.r.setBackground(def.bg);
    w.music(def.music, 1);
    if(test?.allSkills||w.allSkills)w.enableAllSkills();
    this.cheatDeadline=performance.now()+10000;this.cheatBuffer='';this.input.blockBrushUntilRelease();
    this.state = 'playing';
    this.ui.screen('none');
    const game = this;
    if (interlude) {
      this.audio.music('interlude', .5);
      const interludeEnd = w.real + 17.5;
      w.root.run((function* () {
        while (w.real < interludeEnd) yield;
        game.audio.music(w.ambientMusic, .8);
      })());
    }
    w.root.run((function* () {
      game.ui.controlsHint('左键射击　右键 / 左右键 / 空格执笔　中键换色　Shift 翻滚　F 泼墨', 5);
      yield* def.script(w);
      yield* wait(2);
      game.toResults(def);
    })());
  }

  private toResults(def: StageDef): void {
    const w = this.world;
    const shipBonus=w.escort?Math.round(w.escort.durability)*100:0;
    const bonus = shipBonus + (w.noMiss ? 200000 : 0) + w.player.bombs * 20000 + w.maxChain * 500 + w.brush.sealed * 100;
    const res: StageResult = {
      stage: def.index, stageName: def.name, score: w.score, kills: w.kills, graze: w.graze,
      sealed: w.brush.sealed, maxChain: w.maxChain, noMiss: w.noMiss, bonus, shipBonus,
    };
    w.addScore(bonus);
    saveHiScore(w.hiScore);
    this.pendingResult = res;
    this.state = 'results';
    this.audio.music('clear', 0.5);
    this.audio.sfx('stage_clear');
    this.ui.screen('results', { results: res });
    w.chapter2?.results();
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
    if(this.state==='playing'&&w.brush.active&&inp.down('brush')&&!w.dialoguePaused&&!w.bossCombat.inputLocked) this.audio.sfx('brush_loop',{vol:.5});
    else this.audio.stopSfx?.('brush_loop');
    switch (this.state) {
      case 'playing':
        if (inp.pressed('pause')&&!w.dialoguePaused) {
          this.state = 'paused';this.audio.stopSfx?.('brush_loop');

          this.ui.screen('pause', { settings: this.settings,inkScore:{...this.world.inkScore.levels} });
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

    w.real += dt;w.presentationTime+=dt;
    w.time += dt * (this.state === 'paused' || this.state === 'growth' ? 0 : 1);
    w.scroll += scroll * dt;
    Clock.dt = 0;
    w.fx.update(0, dt, w.real);
    w.timeScale = 1;
    this.r.post.inkMode = 0;this.r.post.brushShade=0;
    this.audio.setSlowmo(0);
  }

  private applyDebug(): void {
    const d = this.debug, p = this.world.player;
    if(this.world.allSkills){p.ink=1;p.bombs=this.world.progression.bombMax;this.world.inkScore.levels={red:3,blue:3,purple:3};this.world.companions.charge=100;}
    if (this.world.cheatGod || this.testRun?.god || (!this.testRun && d.god)) p.invuln = Math.max(p.invuln, 1);
    if(this.testRun?.fullInk)p.ink=1;
    if(this.testRun?.fullBombs)p.bombs=this.world.progression.bombMax;
    if (d.power) { p.power = d.power; d.power = 0; }
    if (d.weapon) { p.weapon = d.weapon; d.weapon = undefined; }
  }

  render(): void {
    this.input.setCursorColor({red:'#ff6941',blue:'#66f2da',purple:'#d09bff'}[this.world.player.weapon]);
    this.input.refreshPointer();
    const w = this.world;
    const playing = this.state === 'playing' || this.state === 'paused' || this.state === 'continue' || this.state === 'results' || this.state === 'growth';
    if (playing) w.draw();
    const beat = this.audio.beat();
    this.r.render(w.time, w.real, w.scroll, beat.phase, w.bgFlashValue, this.state === 'playing' ? w.dt : this.state === 'paused' || this.state === 'growth' ? 0 : 1 / 60,w.visualTime);
    this.ui.hud(w.hud(this.fps), this.state === 'playing' || this.state === 'continue');
  }
}
