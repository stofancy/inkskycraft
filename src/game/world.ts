import { drawCh1Attack,chainHit,chainExtent,shieldBlocks } from '../stages/stage1_attacks';
import type { FodderChapter } from '../stages/fodder1';
import { drawSkyStones, drawFalls } from '../bg/sky-scene';
import { drawLowPass } from '../stages/stage1_low';
import { BossCombat } from './boss-combat';
import { EscortShip } from './escort';
import type { Chapter2 } from '../stages/stage2_air';
import type { ChapterDialogue } from '../stages/dialogue1';
import { Density, MINIMUM_FIRE, DENSITY_LIMITS, type AttackContext } from './density';
import { Aura } from './aura';
import { MANTRA_KEYS } from '../gl/mantra-glyphs';
import { InkScore } from './ink-score';
import { Mantra } from './mantra';
import type { Scenery } from './scenery';
// 游戏世界：实现关卡接口 G，负责实体更新、碰撞、计分、Boss 阶段、绘制调度。
import { DIFFS, type DiffCfg, type Difficulty } from '../core/difficulty';
import type { Input } from '../core/input';
import { Rng, angleTo, approach, clamp, segDist2 } from '../core/math';
import { Clock, Scope, all, fork, frames, until, wait, type Co } from '../core/tasks';
import { PK } from '../gl/particles';
import { RS } from '../gl/ribbons';
import type { Renderer } from '../gl/renderer';
import { CH2_SHEETED,ch2Frame } from '../art/sprites_ch2_art';
import { SHEETED } from '../art/sprites_ch1_art';
import { BossCaps } from './boss-caps';
import { ENEMY_SCALE } from './enemy-scale';
import { PLAY_H, PLAY_W, type DamageSource, type DialogueActor, type GameAudio, type GameUI, type HudState, type MusicId, type Sfx, type WeaponColor } from '../types';
import type { BossOpts, ChallengeOpts, ExplosionPalette, ForceOpts, G, Laser, LaserOpts, PhaseOpts } from './api';
import { Brush, type BrushForm } from './brush';
import type { CompanionKind } from './companion';
import { Bullet, BulletPool, type BulletStyle } from './bullets';
import { MASK_CELL } from '../gl/atlas';
import { Enemy, type EnemyDef, type ItemKind } from './enemy';
import { FxSystem } from './fx';
import { Item, Items, MAX_POWER, MAX_BOMBS, EXTEND_SCORES, medalScore } from './items';
import { Player } from './player';
import { Progression } from './progression';
import { CompanionSystem } from './companion';
import { ComboSystem } from './combos';
import { bossMusicAtPhase } from '../audio/music-cues';
import { Roll } from './roll';
import { Skills, type SkillId } from './skills';

const LASER_COL: Record<NonNullable<LaserOpts['color']>, [number, number, number]> = {
  cyan: [0.3, 1.4, 1.8], magenta: [1.8, 0.3, 1.3], violet: [1.0, 0.45, 2.0], amber: [2.0, 0.9, 0.2], red: [2.0, 0.25, 0.15], gold: [2.0, 1.4, 0.45],
};

class EnemyLaser implements Laser {
  t = 0;
  startedReal = 0;
  dead = false;
  firedSfx = false;
  constructor(public x: number, public y: number, public angle: number, readonly o: Required<Omit<LaserOpts, 'follow' | 'anchor'>> & LaserOpts) {}
  kill(): void {
    this.dead = true;
  }
}

interface Tween { get: () => number; set: (v: number) => void; from: number; to: number; t: number; dur: number; presentation?:boolean }
export interface InkDamageOptions { armor?:'half'|'ignore'; ignoreSeal?:boolean; ignoreLoosen?:boolean; unmodified?:boolean; inkColor?:WeaponColor; tag?:'burn'; castKey?:object }

export class World implements G {
  testOptions: import('./test-options').TestRunOptions | null = null;
  checkpointTarget: string | null = null;
  currentCheckpoint = '';
  checkpoint(id: string): boolean {
    if (this.checkpointTarget && this.checkpointTarget !== id) return false;
    this.checkpointTarget = null;
    this.currentCheckpoint = id;
    return true;
  }
  testBossPhase(id: string): number | undefined {
    return this.testOptions?.checkpoint === id ? this.testOptions.bossPhase : undefined;
  }
  get seekingCheckpoint(): boolean { return this.checkpointTarget !== null; }
  readonly bossCaps = new BossCaps(this);
  readonly rng = new Rng(20260930);
  readonly fx: FxSystem;
  readonly bullets = new BulletPool();
  readonly items = new Items();
  readonly player: Player;
  readonly aura:Aura;
  readonly mantra:Mantra;
  readonly inkScore=new InkScore();
  onInkScore:(bossName:string)=>void=()=>{};
  readonly brush: Brush;
  /** 测试菜单与剧情公开开关；笔力使用真实秒，重开整局恢复初值。 */
  brushPower = 1;
  brushForms = new Set<BrushForm>();
  readonly progression: Progression;
  readonly companions: CompanionSystem;
  readonly combos: ComboSystem;
  readonly roll: Roll;
  readonly skills: Skills;
  private inkPageFlight:{x:number;y:number;rot:number}|null=null;
  readonly bossCombat:BossCombat;
  private stopLeft=0;
  private hitSoundAt=0;
  private deathBursts:{e:Enemy;at:number;kill?:boolean}[]=[];
  hitstop(seconds:number):void {if(Number.isFinite(seconds)&&seconds>0)this.stopLeft=Math.max(this.stopLeft,seconds);}
  get hitstopRemaining(){return this.stopLeft;}
  challengeState: (ChallengeOpts & { remaining: number; result: boolean | null; elapsed: number }) | null = null;
  restLabel = '';
  onMilestone: (label: string) => void = () => { this.restLabel = ''; };
  debugAuto = false;
  readonly contentStats = { bodies: 0, types: new Set<string>(), challenges: 0, successes: 0, failures: 0, milestones: 0 };
  enemies: Enemy[] = [];
  private lasers: EnemyLaser[] = [];
  private forces: (ForceOpts & { left: number })[] = [];
  scenery: Scenery[] = [];
  readonly density=new Density();
  sceneState: unknown = null;
  escort:EscortShip|null=null;
  chapter2:Chapter2|null=null;
  chapterDialogue:ChapterDialogue|null=null;
  fodder:FodderChapter|null=null;
  root = new Scope();
  presentation = new Scope();
  presentationTime=0;
  dialoguePauseSeconds=0;
  get dialoguePaused(){return !!this.chapterDialogue?.paused||this.ui.dialogueState().active;}
  get visualTime(){return this.time+this.dialoguePauseSeconds;}
  *present(co:Co):Co {const scope=Scope.current!;const was=scope.presentation;scope.presentation=true;try{yield* co;}finally{scope.presentation=was;}while(this.dialoguePaused)yield;}

  // 时间
  t = 0;
  dt = 1 / 60;
  time = 0;
  real = 0;
  timeScale = 1;
  lastRealDt=1/60;
  frameNo = 0;
  scroll = 0;
  private scrollV = 60;
  private tweens: Tween[] = [];
  private bgFlashAmt = 0;

  // 计分
  score = 0;
  hiScore = 0;
  chain = 0;
  private chainT = 0;
  maxChain = 0;
  graze = 0;
  kills = 0;
  noMiss = true;
  bombsUsed = 0;
  private extendIdx = 0;
  private grazeSfxT = 0;
  rank = 0;
  diff: DiffCfg = DIFFS.normal;
  diffId: Difficulty = 'normal';

  // Boss 显示
  private bossE: Enemy | null = null;
  private bossPhases = 0;
  private bossPhaseT = 0;
  private bossPhaseLimit = 0;
  private bossPhaseReal = false;
  private bossPhaseStartedReal = 0;

  /** 由 Game 设置。 */
  onGameOver: () => void = () => {};
  stageIndex = 1;
  stageName = '';

  constructor(readonly r: Renderer, readonly audio: GameAudio, readonly ui: GameUI, readonly input: Input) {
    this.fx = new FxSystem(r, audio, this.rng);
    this.player = new Player(this);
    this.aura=new Aura(this);this.mantra=new Mantra(this);
    this.brush = new Brush(this);
    this.progression = new Progression(this);
    this.companions = new CompanionSystem(this, this.progression);
    this.combos = new ComboSystem(this, this.progression, this.companions);
    this.roll = new Roll(this);this.bossCombat=new BossCombat(this);
    this.skills = new Skills(this);
    this.bullets.aimTarget=(x,y)=>this.aimTarget(x,y,true);
  }

  // ================================================================ 生命周期

  /** 新关卡开始前重置场景（保留玩家状态与分数）。 */
  resetStage(): void {
    this.inkPageFlight=null;
    this.mantra.setBombBlocked(false);
    this.testOptions = null;
    this.checkpointTarget = null;
    this.currentCheckpoint = '';
    this.root.cancel();this.presentation.cancel();this.presentation=new Scope();this.presentation.presentation=true;this.dialoguePauseSeconds=0;
    this.root = new Scope();
    this.enemies = [];
    this.scenery = [];
    this.density.reset();
    this.fodder?.dispose();this.fodder=null;
    this.chapter2?.dispose();this.chapter2=null;this.sceneState=null;this.escort=null;this.chapterDialogue=null;this.ui.resetCommunications();
    this.lastWeaponTarget=null;
    this.lasers = [];
    this.forces = [];
    this.bullets.clear();this.letteringQuietUntil=0;this.bullets.suppress=false;
    this.items.clear();
    this.brush.clear();
    this.player.bombT=0;this.stopLeft=0;this.deathBursts=[];this.hitSoundAt=0;this.aura.clear();this.mantra.clear();
    this.skills.clearEffects();
    this.fx.clear();
    this.tweens = [];
    this.t = 0;
    this.scroll = 0;
    this.scrollV = 60;
    this.bossE = null;this.bossCombat.reset();
    this.maxChain = 0;
    this.kills = 0;
    this.graze = 0;
    this.noMiss = true;
    this.bombsUsed = 0;
    this.brush.sealed = 0;
    this.challengeState = null;
    this.restLabel = '';
    this.progression.resetStage();
    this.companions.resetStage();
    this.combos.resetStage();
    this.roll.reset();
    this.contentStats.bodies = this.contentStats.challenges = this.contentStats.successes = this.contentStats.failures = this.contentStats.milestones = 0;
    this.contentStats.types.clear();
    this.r.fluid.clear();
    this.r.partLow.reset();
    this.r.partHigh.reset();
  }

  setDifficulty(d: Difficulty): void {
    this.diffId = d;
    this.diff = DIFFS[d];
    this.density.scale = this.diff.enemyCount;this.density.bulletLimit = this.diff.bulletCap;
  }
  get difficulty(): DiffCfg { return this.diff; }
  get lastPierce() {return {serial:this.brush.paths.verticalSerial,hitEnemyIds:[...this.brush.paths.verticalHits]};}

  allSkills=false;
  cheatGod=false;
  get skillCooldownScale(){return this.allSkills ? .25 : 1;}
  enableAllSkills():void {if(!this.allSkills){for(const id of Object.keys(this.skills.cooldowns) as (keyof typeof this.skills.cooldowns)[])if(id!=='zhongpao')this.skills.cooldowns[id]*=.25;for(const s of this.companions.team)s.cooldown*=.25;}this.allSkills=true;this.player.missile=4;this.player.ink=1;this.player.bombs=this.progression.bombMax;this.inkScore.levels={red:3,blue:3,purple:3};this.skills.setUnlocked(['chaifa','tishen','zhongpao','shenying','bilei']);this.brushPower=3;this.brushForms=new Set(['横','竖']);}
  newGame(): void {
    this.allSkills=this.cheatGod=false;
    this.inkScore.resetRun();this.mantra.resetRun();
    this.bossCombat.newGame();
    this.score = 0;
    this.chain = 0;
    this.extendIdx = 0;
    this.player.startLives = this.diff.lives;
    this.player.startBombs = this.diff.bombs;
    this.player.reset(true);
    this.brushPower=1;this.brushForms.clear();
    this.progression.resetRun();
    this.companions.resetRun();
    this.combos.resetRun();
    this.roll.reset();
    this.skills.resetRun();
  }

  // ================================================================ 每帧

  tick(realDt: number): void {
    this.lastRealDt=realDt;
    this.presentationTime+=realDt;
    const wasPaused=this.dialoguePaused;
    if(!this.bossCombat.freeze)this.skills.updateUnlocks(realDt);
    this.ui.dialogueTick(realDt,this.input);
    this.chapterDialogue?.tick(realDt);
    if(wasPaused||this.dialoguePaused){
      this.input.blockBrushUntilRelease();this.brush.cancel();
      this.dialoguePauseSeconds+=realDt;this.dt=0;Clock.dt=realDt;Clock.realDt=realDt;
      this.r.partLow.time=this.r.partHigh.time=this.visualTime;
      for(const tw of this.tweens)if(tw.presentation){tw.t+=realDt;const k=Math.min(1,tw.t/tw.dur);tw.set(tw.from+(tw.to-tw.from)*(k*k*(3-2*k)));}
      this.tweens=this.tweens.filter(tw=>tw.t<tw.dur);
      this.root.tick(true);this.presentation.tick();
      for(const e of this.enemies)if(e.parent)e.syncToParent();
      this.companions.updatePresentation(realDt);this.escort?.updatePresentation(realDt);
      this.fx.update(realDt,realDt,this.presentationTime);Clock.dt=0;
      return;
    }
    this.r.partLow.time=this.r.partHigh.time=this.visualTime;
    this.bossCombat.update(realDt);if(this.bossCombat.freeze)this.skills.freezeTime(realDt);this.mantra.observeFrameTime(realDt*1000);
    const p = this.player;
    const stopped=this.stopLeft>0;this.stopLeft=this.stopLeft<=realDt+1e-9?0:this.stopLeft-realDt;
    const bursts=this.deathBursts.filter(b=>this.real+realDt>=b.at);
    this.deathBursts=this.deathBursts.filter(b=>this.real+realDt<b.at);
    for(const burst of bursts){if(burst.kill){if(!burst.e.dead)this.kill(burst.e);}else this.fx.explosion(burst.e.x,burst.e.y,burst.e.def.explosion??(burst.e.maxHp>=400?'l':burst.e.maxHp>=60?'m':'s'),this.damagePalette(burst.e.lastDamageSource),this.r.bgId==='stage1');}
    if(stopped){
      for(const e of this.enemies)e.tickControl(realDt);
      this.real+=realDt;this.dt=0;Clock.dt=0;Clock.realDt=realDt;
      this.timeScale=1;
      // 停顿仍读取射击、换色和运笔输入；保护与真言按真实时间推进。
      if(!this.bossCombat.freeze){this.skills.beginFrame(realDt);this.skills.update(realDt,0);}
      const oldWeapon=p.weapon;p.update(0,0);p.invuln=Math.max(0,p.invuln-realDt);if(!this.bossCombat.freeze){this.aura.update(realDt);this.mantra.update(realDt);}
      if(p.weapon!==oldWeapon){this.progression.recordAction({kind:'weaponChange',source:p.weapon});this.combos.record('weaponChange',p.weapon);}
      this.brush.beginFrame(realDt);this.brush.update(realDt);
      this.fx.update(0,realDt,this.real);
      return;
    }
    this.frameNo++;
    this.brush.beginFrame(realDt);
    // 子弹时间与运笔速度分别使用世界时钟、真实时钟。
    const target = this.bossCombat.qte ? this.bossCombat.scale : Math.min(this.escort?.rescuing ? .4 : this.brush.active ? this.brush.power.slow : 1,this.brush.colors.slow,this.mantra.timeScale);
    this.timeScale = target;
    const slow = (1 - this.timeScale) / 0.75;
    this.audio.setSlowmo(slow);
    this.r.post.inkMode = 0;
    this.r.post.brushShade=this.brush.active?.15:0;
    const dt = realDt * this.timeScale;
    this.dt = dt;
    Clock.dt = dt;
    Clock.realDt = realDt;
    Clock.t += dt;
    Clock.frame++;
    this.t += dt;
    this.time += dt;
    this.real += realDt;
    this.bullets.suppress=this.real<this.letteringQuietUntil;

    // 补间（背景参数、滚动速度）
    for (const tw of this.tweens) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.set(tw.from + (tw.to - tw.from) * (k * k * (3 - 2 * k)));
    }
    this.tweens = this.tweens.filter((tw) => tw.t < tw.dur);
    this.scroll += this.scrollV * dt;
    this.r.fluid.drift = this.scrollV * 0.9;
    this.bgFlashAmt = Math.max(0, this.bgFlashAmt - realDt * 2.5);

    this.updateChallenge(realDt);
    this.progression.update(dt);
    if (this.input.pressed('focus') && !this.challengeState) {
      this.progression.recordAction({ kind: 'focus' });
      this.combos.record('focus');
    }
    if(!this.bossCombat.freeze)this.skills.beginFrame(realDt);
    const oldWeapon = p.weapon;
    p.update(realDt, dt);this.bossCombat.afterPlayer();
    for (const f of this.forces) {
      f.left -= dt;
      const dx = f.x - p.x, dy = f.y - p.y, distance = Math.hypot(dx, dy);
      if (p.alive && distance < f.radius && !this.challengeState) {
        const k = Math.max(0, Math.min(1, f.left * 4)) * Math.min(1, (f.radius - distance) / (f.radius * 0.25));
        const sign = f.mode === 'repel' ? -1 : 1;
        const vx = f.mode === 'wind' ? f.vx ?? 1 : dx / Math.max(1, distance) * sign;
        const vy = f.mode === 'wind' ? f.vy ?? 0 : dy / Math.max(1, distance) * sign;
        p.x = clamp(p.x + vx * f.strength * k * dt, 26, PLAY_W - 26);
        p.y = clamp(p.y + vy * f.strength * k * dt, 50, PLAY_H - 36);
      }
    }
    this.forces = this.forces.filter(f => f.left > 0);
    if (p.weapon !== oldWeapon) { this.progression.recordAction({ kind: 'weaponChange', source: p.weapon }); this.combos.record('weaponChange', p.weapon); }
    this.brush.update(realDt);

    if(!this.bossCombat.freeze)this.skills.update(realDt,dt);
    this.companions.update(dt);
    this.combos.update(dt);
    Enemy.aimTarget=(x,y)=>this.aimTarget(x,y);
    Enemy.px = p.x;
    Enemy.py = p.y;
    this.rank = clamp((this.stageIndex - 1) * 0.3, 0, 1) * this.diff.rank;

    if(!this.chapterDialogue?.spawnPaused)this.density.release(this.stageIndex,this.enemies);
    // 敌人硬直和封印先设置暂停，避免本帧继续蓄力攻击。
    for(const e of this.enemies){e.tickControl(realDt);e.scope.paused=!!e.data.dying||!!e.data.densityQueued||(e.stunned>0&&!e.def.boss&&!e.phaseLock)||e.sealed>0;}
    // 协程（关卡脚本 + 敌人 AI）
    this.density.beginBossBatch();
    this.root.tick();this.presentation.tick();
    this.density.finishBossBatch(this.stageIndex,this.bullets.list);
    this.supplementOrdinaryFire();

    // 敌人
    for (const e of this.enemies) {
      if (e.dead||e.data.densityQueued) continue;
      e.age += dt;
      e.flash = e.data.hitFlashUntil===undefined?Math.max(0,e.flash-realDt*8):this.real<e.data.hitFlashUntil?1:0;
      if (e.sealed > 0) {
        // BrushColors 已按真实时间推进新封；保留其他来源的封计时。
        if(!this.brush.colors.marks.has(e))e.sealed = Math.max(0, e.sealed - realDt);
        e.scope.paused = e.sealed > 0 || (e.stunned > 0&&!e.def.boss&&!e.phaseLock);
      }
      if (e.parent) e.syncToParent();
      else if (e.sealed <= 0 && e.stunned <= 0) {
        e.x += e.vx * dt * e.companionSpeed;
        e.y += e.vy * dt * e.companionSpeed;
      }
      if (e.def.ground && !e.parent && e.stunned <= 0) e.y += this.scrollV * dt;
      if (e.def.face === 'move' && (e.vx || e.vy) && !e.parent) e.angle = Math.atan2(e.vy, e.vx) - Math.PI / 2 + (e.def.faceUp ? Math.PI : 0);
      else if (e.def.face === 'player') e.angle = angleTo(e.x, e.y, p.x, p.y) - Math.PI / 2 + (e.def.faceUp ? Math.PI : 0);
      this.companions.applyJointPosition(e);
      const animFps = e.def.anim || (SHEETED.has(e.info.id) ? 10 : 0);
      if(CH2_SHEETED.has(e.info.id))e.frame=ch2Frame(e);
      else if (!e.data.manualFrame && animFps && e.info.frames.length > 1) e.frame = Math.floor(e.age * animFps) % e.info.frames.length;
      // 离场回收
      if (!e.parent && !e.def.boss && e.age > 1.5) {
        const m = 60 + e.radius;
        if (e.y > PLAY_H + m || e.y < -m - 400 || e.x < -m - 200 || e.x > PLAY_W + m + 200) this.remove(e);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.bullets.tick(dt, b => this.companions.bulletSpeedScale(b));
    this.skills.intercept();
    this.updateLasers(dt);
    this.roll.collect();
    this.escort?.update(realDt);
    this.collide();
    this.fodder?.update();
    this.chapter2?.update();

    this.items.tick(dt, p.x, p.y, p.alive, p.alive && p.y < 330, (it) => this.pickup(it), realDt);

    if (this.chainT > 0) {
      this.chainT -= dt;
      if (this.chainT <= 0) this.chain = 0;
    }
    this.grazeSfxT -= realDt;
    if (this.bossE) this.bossPhaseT += this.bossPhaseReal ? (this.bossCombat.qte?0:realDt) : dt;

    this.fx.update(dt, realDt, this.real);
  }

  // ================================================================ 碰撞

  /** 最近一次 shotHit 命中的位置。 */
  hitX = 0;
  hitY = 0;

  /** 敌机外廓半径：遮罩实心格最远距离 × 缩放；无遮罩时退回 e.radius。 */
  private extent(e: Enemy): number {
    const mr = e.info.maskR;
    return Math.max(mr,e.radius) * Math.max(Math.abs(e.scaleX), Math.abs(e.scaleY));
  }

  targetable(e: Enemy, includeShield = false): boolean {
    if (e.dead || e.data.dying || e.data.densityQueued || e.alpha<=.01 || e.def.decorative || e.data.targetDisabled || (e.invulnerable && !includeShield)) return false;
    const ext = this.extent(e);
    return e.y > -ext && e.y < PLAY_H + ext && e.x > -ext && e.x < PLAY_W + ext;
  }

  private hitCircles(e: Enemy, fn: (x: number, y: number, r: number) => boolean): boolean {
    if (fn(e.x, e.y, e.radius * Math.max(Math.abs(e.scaleX), Math.abs(e.scaleY)))) return true;
    if (e.def.hits) {
      for (const [hx, hy, hr] of e.def.hits) {
        const p = e.local(hx, hy);
        if (fn(p.x, p.y, hr * Math.abs(e.scaleX))) return true;
      }
    }
    return false;
  }

  /** 世界圆 (x,y,r) 是否碰到敌机精灵的实心格（遮罩，含缩放、旋转、镜像）。 */
  hitMask(e: Enemy, x: number, y: number, r: number): boolean {
    const info = e.info;
    if (info.maskR <= 0) return false;
    const sx = e.scaleX * (e.mirror ? -1 : 1), sy = e.scaleY;
    const asx = Math.abs(sx), asy = Math.abs(sy);
    if (asx < 1e-3 || asy < 1e-3) return false;
    const dx = x - e.x, dy = y - e.y;
    const R = info.maskR * Math.max(asx, asy) + r;
    if (dx * dx + dy * dy > R * R) return false;
    const c = Math.cos(e.angle), s = Math.sin(e.angle);
    const pivot=info.maskPivot??info.pivot,[width,height]=info.maskSize??[info.w,info.h];
    const lx = (dx * c + dy * s) / sx + pivot[0], ly = (-dx * s + dy * c) / sy + pivot[1];
    const rx = r / asx, ry = r / asy;
    const C = MASK_CELL, mw = info.maskW, mh = info.maskH;
    const i0 = Math.max(0, Math.floor((lx - rx + width / 2) / C)), i1 = Math.min(mw - 1, Math.floor((lx + rx + width / 2) / C));
    const j0 = Math.max(0, Math.floor((ly - ry + height / 2) / C)), j1 = Math.min(mh - 1, Math.floor((ly + ry + height / 2) / C));
    const m = info.mask;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (m[j * mw + i]) return true;
    return false;
  }

  /** 命中判定 = 碰撞圆 或 精灵遮罩。 */
  hitShape(e: Enemy, x: number, y: number, r: number): boolean {
    return chainHit(e,x,y,r) || this.hitCircles(e, (cx, cy, cr) => (cx - x) ** 2 + (cy - y) ** 2 < (cr + r) ** 2) || this.hitMask(e, x, y, r);
  }

  /** 线段 a→b 加宽 r 是否碰到敌机（遮罩/圆），命中点（离 a 最近）写入 hitX/hitY。仅在粗筛圆内按 ≤4 步长采样。 */
  private rawHitSegment(e: Enemy, ax: number, ay: number, bx: number, by: number, r: number): boolean {
    const ext = Math.max(this.extent(e),chainExtent(e)), R = ext + r;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    if (L2 <= 0) return this.hitShape(e, ax, ay, r);
    const L = Math.sqrt(L2);
    const tc = ((e.x - ax) * dx + (e.y - ay) * dy) / L2;
    const cx = ax + dx * tc, cy = ay + dy * tc;
    const d2 = (e.x - cx) ** 2 + (e.y - cy) ** 2;
    if (d2 > R * R) return false;
    const hc = Math.sqrt(R * R - d2) / L;
    const t0 = Math.max(0, tc - hc), t1 = Math.min(1, tc + hc);
    if (t0 > t1) return false;
    const n = Math.max(1, Math.ceil((t1 - t0) * L / 4));
    for (let k = 0; k <= n; k++) {
      const t = t0 + (t1 - t0) * k / n;
      const x = ax + dx * t, y = ay + dy * t;
      if (this.hitShape(e, x, y, r)) { this.hitX = x; this.hitY = y; return true; }
    }
    return false;
  }

  private copperRay:{frame:number;key:string;target:Enemy|null;x:number;y:number}|null=null;
  hitSegment(e:Enemy,ax:number,ay:number,bx:number,by:number,r:number):boolean {
    if(!e.data.copperPart){
      if(!this.rawHitSegment(e,ax,ay,bx,by,r))return false;
      return !this.enemies.some(s=>s!==e&&shieldBlocks(s,ax,ay,this.hitX,this.hitY,r));
    }
    const key=[ax,ay,bx,by,r].join(':');let ray=this.copperRay;
    if(!ray||ray.frame!==this.frameNo||ray.key!==key){
      let target:Enemy|null=null,x=0,y=0,distance=Infinity;
      for(const p of this.enemies)if(p.data.copperPart&&this.targetable(p,true)&&this.rawHitSegment(p,ax,ay,bx,by,r)){
        const d=Math.hypot(this.hitX-ax,this.hitY-ay);
        if(d<distance-8||Math.abs(d-distance)<=8&&(p.def.hitPriority??0)>(target?.def.hitPriority??0)){target=p;distance=d;x=this.hitX;y=this.hitY;}
      }
      ray=this.copperRay={frame:this.frameNo,key,target,x,y};
    }
    if(ray.target!==e)return false;this.hitX=ray.x;this.hitY=ray.y;return true;
  }

  /** 玩家子弹命中检测（点或线段扫掠 x0,y0→x1,y1，步长 ≤4），返回命中的敌人，命中点写入 hitX/hitY（地面单位优先级最低）。 */
  shotHit(x: number, y: number, r: number, px = x, py = y, exclude?:ReadonlySet<number>): Enemy | null {
    const dist = Math.hypot(x - px, y - py);
    const n = Math.max(1, Math.ceil(dist / 4));
    let best: Enemy | null = null;let bestDistance=Infinity;
    for (const e of this.enemies) {
      if (!this.targetable(e, true)||exclude?.has(e.id)) continue;
      let hx = 0, hy = 0, hit = false;
      // 沿线段从旧点到新点采样
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        hx = px + (x - px) * t; hy = py + (y - py) * t;
        if (this.hitShape(e, hx, hy, r)) { hit = true; break; }
      }
      if (hit) {
        const distance=Math.hypot(hx-px,hy-py);
        if(e.data.copperPart&&best?.data.copperPart&&distance>bestDistance+8)continue;
        if (!best || (e.data.copperPart&&best.data.copperPart&&distance<bestDistance-8) || (best.def.ground && !e.def.ground) || (!e.def.ground && (e.def.hitPriority ?? 0) > (best.def.hitPriority ?? 0))) { best = e;bestDistance=distance; this.hitX = hx; this.hitY = hy; }
      }
    }
    if(best){const shield=this.enemies.find(s=>s!==best&&shieldBlocks(s,px,py,this.hitX,this.hitY,r));if(shield){this.hitX=shield.x;this.hitY=shield.y;best=shield;}}
    // 铜雀部件与铜盾消耗强化朱弹的贯穿次数。
    if((best?.data.copperPart||best?.data.ch1Shield)&&exclude){const shots=Reflect.get(this.player,'shots') as {hits?:ReadonlySet<number>;pierce?:number}[];const shot=shots.find(s=>s.hits===exclude);if(shot)shot.pierce=0;}
    return best;
  }

  nearestEnemy(x: number, y: number, maxY: number): Enemy | null {
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.enemies) {
      if (!this.targetable(e) || e.y > maxY) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private collide(): void {
    const p = this.player;
    if (!p.alive || p.entering > 0) return;
    const hr = p.hitR, gr = p.grazeR;
    for (const b of this.bullets.list) {
      if (b.dead) continue;
      const d2 = (b.x - p.x) ** 2 + (b.y - p.y) ** 2;
      if (d2 < (b.radius + hr) ** 2) {
        if (p.invuln <= 0 && !this.brush.protected) {
          if(!b.hard&&this.progression.blockBullet()){b.dead=true;continue;}
          b.dead = true;
          p.hit();
          return;
        }
      } else if (!this.roll.frameActive && !b.grazed && d2 < (b.radius + gr) ** 2) {
        b.grazed = true;
        this.graze++;
        this.progression.recordAction({ kind: 'graze' });
        p.ink = Math.min(1, p.ink + 0.014);
        this.addScore(20 * this.multiplier);
        this.fx.emitHigh({ x: (b.x + p.x) / 2, y: (b.y + p.y) / 2, vx: (b.x - p.x) * 4, vy: (b.y - p.y) * 4, life: 0.25, size: 2, r: 2, g: 2, b: 1.6, kind: PK.Spark });
        if (this.grazeSfxT <= 0) { this.audio.sfx('graze', { vol: 0.4 }); this.grazeSfxT = 0.06; }
      }
    }
    // 机体碰撞
    for (const e of this.enemies) {
      // Boss 本体按接触规则处理，护甲无敌和旧 noCollide 标记不关闭撞机。
      if (e.dead || e.def.ground || (!e.def.boss && (e.def.noCollide || e.sealed > 0)) || !this.targetable(e, true)) continue;
      if (this.hitCircles(e, (cx, cy, cr) => (cx - p.x) ** 2 + (cy - p.y) ** 2 < (cr * 0.55 + hr) ** 2)) {
        p.collideWith(e);
        return;
      }
    }
    // 激光
    for (const l of this.lasers) {
      if (l.dead || l.t < l.o.warn || l.t > l.o.warn + l.o.duration) continue;
      const ex = l.x + Math.cos(l.angle) * l.o.length, ey = l.y + Math.sin(l.angle) * l.o.length;
      const ramp = Math.min(1, (l.t - l.o.warn) / 0.12);
      if (segDist2(p.x, p.y, l.x, l.y, ex, ey) < (l.o.width * 0.6 * ramp + hr) ** 2) {
        p.hit();
        return;
      }
    }
  }

  // ================================================================ 伤害与击破

  lastWeaponTarget: Enemy | null = null;
  damage(e: Enemy, amount: number, x = e.x, y = e.y, quiet = false, source: DamageSource = 'neutral', ink:InkDamageOptions={}): number {
    if (e.dead || e.data.dying || e.data.targetDisabled || e.data.densityQueued || e.def.decorative || amount <= 0) return 0;
    const target:Enemy=e.data.damageTarget??e;
    // 血量打空后的控制器仍挡住青光，封圈窗口中也保留实体终点。
    if(source==='blue'&&(e.data.copperPart||e.data.ch1Shield))Reflect.set(this.player,'beamEndY',y);
    if(target.invulnerable||target.hp<=0)return 0;
    if (e.invulnerable || this.fodder?.canDamage(e,source)===false || this.chapter2?.damageAllowed(e,source)===false) { this.fx.onDamage(e, source, x, y, 0, true,ink.inkColor); return 0; }
    const joint=this.companions.isJointCast(ink.castKey);
    if(!(joint&&ink.unmodified))amount*=this.chapter2?.damageScale(e,source,amount)??1;
    const armor = e.def.armor ?? 1;
    const primary = source === 'red' || source === 'blue' || source === 'purple';
    const armorFactor=ink.armor==='ignore'?1:ink.armor==='half'?(1+armor)/2:armor;
    let actual = ink.unmodified||source==='qte'?amount:amount * armorFactor * (!ink.ignoreLoosen&&e.armorLoose>0?3:1) * (e.data.paperKnot&&source==='red'?2:e.data.weakWeapon === source ? 1.35 : 1) * (e.data.damageBonus??1) * this.companions.weaknessBonus(e) * (ink.ignoreSeal?1:this.brush.colors.vulnerability(e));
    const cannon=this.bossCaps.isCannon(ink.castKey),capBoss=this.bossCaps.bossOf(e);
    if(joint)actual=this.companions.jointLimit(e,actual,ink.castKey);
    if(capBoss){if(!cannon&&!joint)actual=this.bossCaps.apply(capBoss,source,actual,ink);}else if(ink.tag==='burn')actual*=.5;
    if(actual<=0)return 0;
    const owner=this.bossCombat.owner(e);
    if(owner?.data.copperSimple&&owner.invulnerable)return 0;
    actual=Math.min(actual,Math.max(0,target.hp));actual=this.bossCombat.allow(e,actual,source);if(actual<=0)return 0;
    if(cannon&&capBoss){actual=this.bossCaps.apply(capBoss,source,actual,ink);if(actual<=0){this.fx.onDamage(e,source,x,y,0,false);return 0;}}
    if(joint)this.companions.jointSettled(e,actual,ink.castKey);
    if(owner&&owner!==target)owner.hp=Math.max(0,owner.hp-actual);
    this.bossCombat.record(e,actual,source);
    const wasAlive = target.hp > 0;
    e.def.onHit?.(e,this,x,y,source);
    target.hp -= actual;
    if (wasAlive && target.hp <= 0) this.companions.onEnemyHpDepleted(target);
    if(primary)this.lastWeaponTarget=e;
    e.lastDamageSource = source;
    this.fx.onDamage(e, source, x, y, actual,false,ink.inkColor);
    this.progression.recordAction({ kind: 'hit', source, amount: actual, enemy: e });
    if (primary && !quiet) this.combos.record('shoot', source);
    if(this.real>=(e.data.nextHitFlashAt??0)){e.data.hitFlashUntil=this.real+.06;e.data.nextHitFlashAt=this.real+.1;e.flash=1;}
    e.hitAccum += amount;
    if(this.real>=this.hitSoundAt){this.hitSoundAt=this.real+.075;this.audio.sfx(e.data.hitArmor||armor<1?'hit_armor':e.data.copperPart?'hit':primary?`hit_${source as 'red'|'blue'|'purple'}`:'hit',{vol:.22,pitch:e.data.copperPart&&!e.data.hitArmor?.7:1,pan:(x/PLAY_W)*2-1});}
    if (target.hp <= 0) {
      if (target.phaseLock) target.hp = 0;
      else {target.data.dying=true;target.data.targetDisabled=true;target.scope.paused=true;target.stop();this.hitstop(.03);this.deathBursts.push({e:target,at:this.real+.03,kill:true});}
    }
    return actual;
  }

  loosenArmor(e: Enemy, seconds: number): void {
    if (e.dead || !Number.isFinite(seconds) || seconds <= 0) return;
    let owner = e;
    while (owner.parent) owner = owner.parent;
    owner = owner.data.bossOwner ?? owner;
    e.armorLoose=Math.max(e.armorLoose,seconds);owner.armorLoose=Math.max(owner.armorLoose,seconds);
    e.onArmorLoosened?.(seconds);
    owner.def.onLoosenArmor?.(owner, this, seconds);

    this.ui.popup(e.x,e.y-45,'外甲松动','chain',`armor:${e.id}`);
  }

  /** 击破（有分数、爆炸、掉落）。 */
  kill(e: Enemy, cascade = false): void {
    if (e.dead) return;
    e.dead = true;
    this.brush.colors.killed(e);
    e.scope.cancel();
    if (!cascade) this.companions.onEnemyKilled(e);
    for (const c of e.children) if (!c.dead) { c.lastDamageSource = e.lastDamageSource; this.kill(c, true); }
    const size = e.def.explosion ?? (e.def.hp >= 400 ? 'l' : e.def.hp >= 60 ? 'm' : 's');
    if(!e.data.dying&&!cascade&&!e.def.boss&&!e.parent&&!e.def.decorative){this.hitstop(.03);this.deathBursts.push({e,at:this.real+.03});}
    else if(!e.def.decorative)this.fx.explosion(e.x,e.y,size,this.damagePalette(e.lastDamageSource),this.r.bgId==='stage1');
    // 未设 score 时按血量估算并封顶，避免用超大血量做伤害转发的部件被连带击毁时爆分
    const pts = Math.floor((e.def.score ?? Math.min(e.def.hp * 10, 20000)) * this.multiplier);
    this.addScore(pts);
    if (pts >= 3000) this.ui.popup(e.x, e.y - 20, pts.toLocaleString(), 'score');
    this.kills++;
    this.progression.recordAction({ kind: 'kill', source: e.lastDamageSource, enemy: e });
    if (!e.parent && !e.def.boss && this.player.missile < 4 && this.kills % 35 === 0) this.drop('missile', e.x, e.y);
    this.addChain(1);
    const p = this.player;
    const close = Math.hypot(e.x - p.x, e.y - p.y) < 200;
    p.ink = Math.min(1, p.ink + (close ? 0.03 : 0.012));
    const drops = e.def.drops ? (Array.isArray(e.def.drops) ? e.def.drops : [e.def.drops]) : [];
    for (const d of drops) this.drop(d, e.x + this.rng.range(-20, 20), e.y + this.rng.range(-20, 20));
    try { e.def.onDeath?.(e, this); } catch (err) { console.error(err); }
  }

  /** 静默移除（离场或父体消失）。 */
  remove(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    e.scope.cancel();
    for (const c of e.children) this.remove(c);
  }
  private damagePalette(source: DamageSource): ExplosionPalette {
    return source === 'red' ? 'fire' : source === 'blue' ? 'cyan' : source === 'purple' ? 'violet' : source === 'ink' ? 'ink' : 'neon';
  }

  get multiplier(): number {
    return 1 + Math.min(this.chain, 400) * 0.01;
  }

  addChain(n: number): void {
    if (n <= 0) return;
    this.chain += n;
    this.chainT = 2.6;
    this.maxChain = Math.max(this.maxChain, this.chain);
  }

  addScore(n: number): void {
    this.score += Math.floor(n);
    if (this.score > this.hiScore) this.hiScore = this.score;
    while (this.extendIdx < EXTEND_SCORES.length && this.score >= EXTEND_SCORES[this.extendIdx]) {
      this.extendIdx++;
      this.player.lives++;
      this.audio.sfx('extend');
      this.ui.popup(this.player.x, this.player.y - 60, '命 +1', 'extend');
    }
  }

  bulletToGold(b: Bullet): void {
    if (b.dead) return;
    b.dead = true;
    this.fx.gold(b.x, b.y);
    if (this.items.list.length < 600) this.items.spawn('gold', b.x, b.y);
    else this.addScore(100 * this.multiplier);
  }

  private pickup(it: Item): void {
    const p = this.player;
    const a = this.audio;
    switch (it.kind) {
      case 'gold': this.addScore(100 * this.multiplier); if (this.frameNo % 3 === 0) a.sfx('item_medal', { vol: 0.25, pitch: 1.5 }); return;
      case 'p':
        if (p.power < MAX_POWER) { p.power++; a.sfx('item_power'); this.ui.popup(it.x, it.y, p.power === MAX_POWER ? '火力 · 满' : '火力 +1', 'info'); }
        else { this.addScore(5000); this.ui.popup(it.x, it.y, '5,000', 'score'); a.sfx('item_power'); }
        break;
      case 'bomb':
        if (p.bombs < this.progression.bombMax) { p.bombs++; this.ui.popup(it.x, it.y, '泼墨 +1', 'info'); }
        else { this.addScore(10000); this.ui.popup(it.x, it.y, '10,000', 'score'); }
        a.sfx('item_bomb'); break;
      case 'missile':
        if (p.missile < 4) p.missile++;
        else this.addScore(10000);
        a.sfx('powerup'); this.ui.popup(it.x, it.y, '矢', 'info'); break;
      case 'medal': {
        const v = it.scoreValue ?? medalScore(it.elapsed);
        this.addScore(v);
        a.sfx('item_medal');
        this.ui.popup(it.x, it.y, v.toLocaleString(), 'score');
        break;
      }
      case 'ink': p.ink = Math.min(1, p.ink + 0.25); a.sfx('item_ink'); break;
    }
    this.fx.burst(it.x, it.y, 10, 260, [2.0, 1.5, 0.5], 0.4);
  }

  // ================================================================ 激光

  private updateLasers(dt: number): void {
    for (const l of this.lasers) {
      if (l.dead) continue;
      const f = l.o.follow;
      if (f) {
        if (f.dead || f.stunned>0) { l.dead = true; continue; }
        const p = l.o.anchor ? f.anchor(l.o.anchor) : f;
        l.x = p.x; l.y = p.y;
      }
      const elapsed = l.o.clock === 'real' ? this.real - l.startedReal : l.t + dt;
      l.angle += (l.o.sweep ?? 0) * Math.max(0, elapsed - l.t);
      l.t = elapsed;
      this.chapter2?.laserHit(l);
      if (!l.firedSfx && l.t >= l.o.warn) { l.firedSfx = true; this.audio.sfx('laser_fire', { vol: 0.7 }); this.fx.shake(0.12); }
      if (l.t > l.o.warn + l.o.duration + 0.25) l.dead = true;
    }
    this.lasers = this.lasers.filter((l) => !l.dead);
  }

  // ================================================================ 绘制

  draw(): void {
    const r = this.r;
    this.chapter2?.drawBackground();
    r.moveTitles.player=[this.player.x,this.player.y];
    this.scenery = this.scenery.filter(s => !s.dead && !s.owner?.dead);
    if(this.stageIndex===1){
      if(!drawLowPass(this))drawSkyStones(r, this.scroll, this.real);
      // 炮台架在独立浮石上，随原敌机位置移动。
      for(const e of this.enemies)if(!e.dead&&!e.data.densityQueued&&e.alpha>0&&!e.data.lowGround&&(e.def.ground||e.def.sprite==='e_turret'||e.def.sprite==='e_turtle'||e.def.sprite==='e_mountainape'||e.def.sprite==='air_net-post'))r.ground.add('sky_rock',{x:e.x,y:e.y+30,sx:Math.max(.45,e.radius/90),sy:.45,alpha:e.alpha});
    }
    for (const e of [...this.enemies].sort((a,b) => (a.def.drawOrder ?? 0) - (b.def.drawOrder ?? 0))) {
      if (e.dead||e.data.densityQueued) continue;
      const qteScale=this.bossCombat.freeze&&this.bossCombat.owner(e)?1.05:1;const sx = (e.def.sprite==='e_umbrellaguest'?1:e.scaleX) * (e.mirror ? -1 : 1)*qteScale;
      const sealed = e.sealed > 0;
      const d = {
        x: e.x, y: e.y, rot: e.angle, sx, sy: e.scaleY*qteScale, frame: e.frame, flash: e.data.hitFlashUntil===undefined?e.flash:this.real<e.data.hitFlashUntil?1:0, glow: e.glow * (sealed ? 0.3 : 1), alpha: e.alpha,
        r: e.tint[0] * (sealed ? 1.3 : 1), g: e.tint[1] * (sealed ? 0.35 : 1), b: e.tint[2] * (sealed ? 0.3 : 1),
        deform: e.def.deform,
      };
      if (e.def.ground) r.ground.add(e.info, d);
      else {
        r.shadows.add(e.info, d);
        r.air.add(e.info, d);
      }
      this.fx.drawDamage(e, this.real);
      drawCh1Attack(e,r,this.t);
      // 阶段脚本提供操作位置与控制线状态，沿用已有ribbon管线。
      const guides: { x: number; y: number }[] = e.data.guides ?? (e.data.guide ? [e.data.guide] : []);
      for (const { x, y } of guides) {
        r.ribbonTop.line(x - 22, y, x + 22, y, 2, RS.Warn, .2, 1.2, 1.3, .7);
        r.ribbonTop.line(x, y - 16, x, y + 16, 2, RS.Warn, .2, 1.2, 1.3, .7);
      }
      if (e.data.controlLines && e.alpha > 0 && e.parent) {
        for (let j = 0; j < 3; j++) if (this.real - (e.data.controlsOffAt ?? Infinity) < j * .15) {
          r.ribbonMid.line(e.parent.x + (j - 1) * 16, e.parent.y + 72, e.x + (j - 1) * 12, e.y - 20, 1.5, RS.Warn, 1.2, .35, 1.4, .55);
        }
      }
      if (e.charging) {
        const rr = e.radius + 16, a = this.real * 4;
        for (let j = 0; j < 6; j++) { const q = a + j * Math.PI / 3; r.ribbonTop.line(e.x + Math.cos(q) * rr, e.y + Math.sin(q) * rr, e.x + Math.cos(q + .45) * rr, e.y + Math.sin(q + .45) * rr, 3, RS.Warn, 1.8, .65, .1, .9); }
      }

      if (!e.data.targetDisabled && !e.def.decorative && (e.data.weakWeapon || e.data.weakLabel)) {
        const c: [number, number, number] = e.data.weakWeapon === 'red' ? [2.3, 0.4, 0.12] : e.data.weakWeapon === 'blue' ? [0.18, 1.7, 2] : [1.4, 0.5, 2];
        const rr = Math.min(80, e.radius + 12), a = this.real * 1.1;
        for (let j = 0; j < 4; j++) {
          const q = a + j * Math.PI / 2;
          r.ribbonTop.line(e.x + Math.cos(q) * rr, e.y + Math.sin(q) * rr, e.x + Math.cos(q + 0.35) * rr, e.y + Math.sin(q + 0.35) * rr, 2.4, RS.Warn, ...c, 0.85);
        }
        const link = typeof e.data.linkTo === 'number' ? this.enemies.find(n => n.id === e.data.linkTo) : e.data.linkTo as Enemy | undefined;
        if (link && !link.dead) r.ribbonMid.line(e.x, e.y, link.x, link.y, 2, RS.Warn, ...c, 0.6);
      }
      if (sealed && this.frameNo % 3 === 0) {
        this.fx.emitHigh({ x: e.x + this.rng.range(-e.radius, e.radius), y: e.y + this.rng.range(-e.radius, e.radius), vy: -40, life: 0.6, size: 2.5, r: 2.2, g: 0.3, b: 0.1, kind: PK.Ember });
      }
    }
    const gateScenery = (this.sceneState as { bridge?: Scenery[] } | null)?.bridge ?? [];
    const gateVisible = this.stageIndex===1 && gateScenery.some(p=>p.sprite==='sky_chain-gate' && !p.dead);
    for (const s of this.scenery) {
      const draw = {x:s.x,y:s.y,rot:s.rot,sx:s.sx,sy:s.sy,alpha:s.alpha,frame:s.fps ? Math.floor(this.t*s.fps) : s.frame,glow:s.glow};
      // 铜雀关两侧由独立崖图呈现，继续沿用关卡原来的位置、缩放与链闸。
      const gateRock = gateVisible && s.sprite==='sky_rock' && gateScenery.includes(s);
      const sprite = gateRock ? (s.x<450?'sky_cliff-left':'sky_cliff-right') : s.sprite;
      (s.layer==='ground'?r.ground:s.layer==='front'?r.items:r.air).add(sprite,draw);
      if(gateRock)drawFalls(r,sprite.slice(4),s.x,s.y,s.sx??1,s.sy??1,s.alpha??1,this.real,s.x<450?0:1);
      if(s.stroke){
        const n=Math.max(2,Math.ceil(s.stroke.pts.length/2*s.stroke.reveal));
        const pts=s.stroke.pts.slice(0,n*2),width=new Float32Array(pts.length/2);
        for(let i=0;i<width.length;i++)width[i]=22*(.3+.7*Math.min(1,i/4,(width.length-1-i)/4));
        r.ribbonMid.strip(pts,width,RS.Brush,.09,.075,.055,1);
      }
    }
    for (const it of this.items.list) {
      const gold = it.kind === 'gold';
      const s = gold ? 0.42 : 1;
      r.items.add(Items.sprite(it), { x: it.x, y: it.y, sx: s, sy: s, rot: gold ? it.age * 6 : 0, glow: 1.2 + 0.4 * Math.sin(it.age * 10) });
    }
    r.shotLight = this.player.weapon === 'blue' ? [0.3, 0.6, 1.0] : this.player.weapon === 'purple' ? [0.7, 0.35, 1.0] : [1.0, 0.42, 0.28];
    if(this.inkPageFlight){const {x,y,rot}=this.inkPageFlight;const dx=Math.cos(rot)*18,dy=Math.sin(rot)*18;r.ribbonMid.line(x-dx,y-dy,x+dx,y+dy,24,RS.Brush,.8,.65,.4,.9);r.mantraGlyphs.add({key:MANTRA_KEYS.red[0],x,y,size:36,rot,color:'red',alpha:1,ghost:true});}
    this.aura.draw();this.mantra.draw();
    this.escort?.draw();
    this.bossCaps.draw();
    this.fodder?.draw();
    this.chapter2?.draw();
    this.player.draw(r, this.real);
    this.companions.draw(r, this.real);this.bossCombat.draw();
    this.progression.draw(r);
    this.roll.draw();
    this.skills.draw();
    const B = r.bullets;
    for (const b of this.bullets.list) {
      const ang = b.shape === 6 ? b.seed * 6.28 : b.angle;
      // 敌弹彩芯：偏蓝紫为紫芯，偏黄绿白为金芯，其余红芯
      const purple = b.b > b.r, gold = !purple && b.g > b.r * 0.38;
      B.add(b.x, b.y, ang, b.size, b.shape + 16, purple ? 1.05 : gold ? 1.9 : 1.9, purple ? 0.25 : gold ? 1.25 : 0.1, purple ? 2.0 : gold ? 0.2 : 0.06, b.age, 1, b.seed, b.speed);
    }
    for (const l of this.lasers) {
      const c = LASER_COL[l.o.color ?? 'magenta'];
      const ex = l.x + Math.cos(l.angle) * l.o.length, ey = l.y + Math.sin(l.angle) * l.o.length;
      if (l.t < l.o.warn) {
        const k = l.t / l.o.warn;
        r.ribbonTop.line(l.x, l.y, ex, ey, 2 + 3 * k, RS.Warn, c[0], c[1], c[2], 0.5 + 0.5 * k);
      } else {
        const ft = l.t - l.o.warn;
        const ramp = Math.min(1, ft / 0.12) * Math.max(0, Math.min(1, (l.o.duration + 0.25 - ft) / 0.25));
        const wdt = l.o.width * ramp;
        r.ribbonTop.line(l.x, l.y, ex, ey, wdt * 2.2, RS.Beam, c[0], c[1], c[2], 0.9);
        r.ribbonTop.line(l.x, l.y, ex, ey, wdt * 0.8, RS.Beam, 1.5, 1.5, 1.5, 1);
        if (this.frameNo % 2 === 0) this.fx.emitHigh({ x: l.x, y: l.y, life: 0.1, size: wdt * 3, sizeEnd: wdt, r: c[0], g: c[1], b: c[2], a: 0.8, kind: PK.Dot });
      }
    }
    this.brush.draw(r, this.real);
    for (const f of this.forces) {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, radius = 45 + ((this.time * 90 + i * 25) % 140);
        const x = f.x + Math.cos(a) * radius, y = f.y + Math.sin(a) * radius;
        const sign = f.mode === 'repel' ? -1 : 1;
        const dx = f.mode === 'wind' ? f.vx ?? 1 : -Math.cos(a) * sign;
        const dy = f.mode === 'wind' ? f.vy ?? 0 : -Math.sin(a) * sign;
        r.ribbonMid.line(x, y, x + dx * 22, y + dy * 22, 2, RS.Glow, 0.12, 0.7, 0.65, 0.45);
      }
    }
  }

  hud(fps: number): HudState {
    const p = this.player;
    const b = this.bossE;
    const hp=b?b.data.copperSimple?(3-(b.data.phaseIndex??1)+b.hpFrac)/3:b.hpFrac:0;
    let trail=hp;
    if(b){const v=b.data.healthTrail??={last:hp,value:hp,queue:[] as {at:number;hp:number}[]};
      if(hp>v.last){v.value=hp;v.queue=[];}else if(hp<v.last)v.queue.push({at:this.real+.5,hp});
      v.last=hp;while(v.queue.length&&v.queue[0].at<=this.real)v.value=v.queue.shift().hp;trail=Math.max(hp,v.value);
    }
    return {
      ship:this.escort?{durability:this.escort.durability,x:this.escort.scene.x,y:this.escort.scene.y,label:this.real-this.escort.born<5,state:this.escort.state}:undefined,
      score: this.score, hiScore: this.hiScore, lives: Math.max(0, p.lives), lifeMax: Math.max(p.startLives, p.lives), armor: Math.max(0, p.armor), hurtSeq: p.hurtSeq, bombs: p.bombs,
      ink: p.ink, inkReady: p.ink >= this.progression.brushMods.minInk, power: p.power, weapon: p.weapon, missile: p.missile,
      multiplier: this.multiplier, graze: this.graze, medalValue: Math.max(200, ...this.items.list.filter(it => it.kind === 'medal' && !it.dead).map(it => medalScore(it.elapsed))),
      stage: this.stageIndex, stageName: this.stageName,
      inkScore:{...this.inkScore.levels},
      boss: b && !b.dead ? { bombLimited:this.mantra.budget.state(b)?.limited||this.mantra.budget.state(b)?.handsOn, name: b.def.boss?.name ?? b.def.name ?? '', hp, trail, phasesLeft: this.bossPhases, timer: b.data.copperSimple?undefined:Math.max(0, this.bossPhaseLimit - (this.bossPhaseReal ? this.real - this.bossPhaseStartedReal : this.bossPhaseT)), hint: b.data.copperSimple?'':b.data.action ?? b.data.weakLabel ?? b.data.bodyPhase } : null,
      overclock:this.skills.boostLeft>0?{x:p.x,y:p.y-p.sprite.h*.55,left:this.skills.boostLeft}:undefined,
      brushActive: this.brush.active, brushProtection:this.brush.protectionRemaining, brushForm:this.brush.lastForm, brushMethods:[...this.brushForms], fps, difficulty: this.diff.name,
      challenge: this.challengeState,
      companions: this.companions.team.map(s => ({ name: s.name, kind:s.kind, role:s.role, active:s.active, count:s.count, level: 1, xp: 0 })),
      passives: this.progression.passiveHud(),
      growth: { brush: this.brush.power.level, bomb: this.progression.bombLevel, talents: this.progression.talents.size },
      rollCharges: this.roll.charges,rollRecharge:this.roll.recharge,
      skillSlots:[
        {id:'roll',key:'Shift',name:'翻滚',icon:'/art/icons/skills/roll.png',cooldown:this.roll.charges<this.roll.maxCharges?this.roll.recharge:0,cooldownMax:1.5,ready:this.roll.charges>0,visible:true,value:String(this.roll.charges)},
        ...this.skills.slots(),
        ...(['Q','E','R'] as const).map(key=>{const slot=this.companions.slot(key);return {...slot,key,...(key==='R'?{fill:this.companions.charge/this.companions.chargeMax,value:`${Math.round(this.companions.charge)}%`}:{})};}),
        {id:'bomb',key:'F',name:'泼墨',icon:'/art/icons/skills/ink-bomb.png',cooldown:p.bombT,cooldownMax:2.6,ready:p.bombs>0&&p.bombT===0,visible:true,value:this.allSkills?'无限':String(p.bombs)},
        {id:'brush',key:'右键/空格',name:'执笔',icon:'/art/icons/skills/ink-meter.png',cooldown:0,cooldownMax:0,ready:p.ink>0,visible:true,value:this.allSkills?'无限':`${Math.round(p.ink*100)}%`,fill:p.ink},
      ],
      combo: this.combos.lastTimer > 0 ? this.combos.lastName : '',
    };
  }

  get bgFlashValue(): number {
    return this.bgFlashAmt;
  }

  // ================================================================ G 接口

  createEscort():EscortShip {return this.escort=new EscortShip(this);}
  scene(sprite:string,x:number,y:number):Scenery {const s:Scenery={sprite,x,y,rot:0,sx:1,sy:1,alpha:1,frame:0,fps:0,glow:0,layer:'ground',dead:false};this.scenery.push(s);return s;}
  joinCompanion(id:CompanionKind):boolean{return this.testOptions?false:this.companions.join(id);}
  leaveCompanion(id:CompanionKind):boolean{return this.testOptions?false:this.companions.leave(id);}
  unlockBrush(form:BrushForm):void{if(this.brushForms.has(form))return;this.brushForms.add(form);this.audio.sfx('skill_unlock');this.ui.popup(this.player.x,this.player.y-65,`学会${form}`,'seal');}
  wait(sec: number): Co { return wait(sec); }
  frames(n: number): Co { return frames(n); }
  until(cond: () => boolean, timeout?: number): Co { return until(cond, timeout); }
  fork(co: Co): Co { return fork(co); }
  all(...cos: Co[]): Co { return all(...cos); }

  spawn(def: EnemyDef, x: number, y: number, init?: (e: Enemy) => void): Enemy {
    const e = new Enemy(def, this.r.atlas.get(def.sprite), this.root);
    e.x = x;
    e.y = y;
    this.enemies.push(e);
    init?.(e);
    {const k=def.boss?1:ENEMY_SCALE[def.sprite]??1;if(k!==1){e.scaleX*=k;e.scaleY*=k;}}
    if (!def.boss && e.data.contentRole === 'normal') { this.contentStats.bodies++; this.contentStats.types.add(def.name ?? def.sprite); }
    this.scaleHp(e);
    if(e.data.contentRole==='normal'&&!def.boss&&this.chapterDialogue?.spawnPaused){e.data.densityQueued=true;e.data.densityAlpha=e.alpha;e.alpha=0;e.scope.paused=true;}else this.density.queue(e,this.stageIndex,this.enemies);
    if (def.ai) e.run(def.ai(e, this));
    return e;
  }

  private scaleHp(e: Enemy): void {
    if (e.maxHp <= 0 || this.diff.hp === 1) return;
    e.maxHp = Math.max(1, Math.round(e.maxHp * this.diff.hp));
    e.hp = Math.max(1, Math.round(e.hp * this.diff.hp));
  }

  attach(parent: Enemy, def: EnemyDef, at: string | [number, number], opts: { mirror?: boolean; rot?: number; followRot?: boolean } = {}): Enemy {
    const e = new Enemy(def, this.r.atlas.get(def.sprite), parent.scope);
    const m = !!opts.mirror;
    let ax: number, ay: number;
    if (typeof at === 'string') {
      const a = parent.info.anchors[at];
      if (!a) console.warn(`精灵 ${parent.info.id} 缺少挂点 ${at}`);
      [ax, ay] = a ?? [0, 0];
      // 部件自身的 root 挂点与父体挂点对齐
      e.jointRoot = e.info.anchors.root ?? [0, 0];
    } else [ax, ay] = at;
    e.offX = m ? -ax : ax;
    e.offY = ay;
    e.mirror = m;
    e.offRot = opts.rot ?? 0;
    e.followRot = opts.followRot ?? true;
    e.parent = parent;
    parent.children.push(e);
    this.scaleHp(e);
    e.syncToParent();
    this.enemies.push(e);
    if (def.ai) e.run(def.ai(e, this));
    return e;
  }

  liveEnemies(): readonly Enemy[] {
    return this.enemies.filter((e) => !e.dead);
  }

  *waitClear(timeout = 30): Co {
    yield* until(() => !this.enemies.some((e) => !e.dead && !e.def.ground), timeout);
  }

  /** 火力每升一级，新发射敌弹速度增加 5%。 */
  get enemyBulletSpeed(): number { return this.diff.speed * (1 + (this.player.power - 1) * 0.05); }

  shoot(x: number, y: number, angle: number, speed: number, style?: BulletStyle): Bullet {
    if(!this.allowOrdinaryFire(1)){const b=new Bullet();b.dead=true;return b;}
    const bullet=this.bullets.spawn(x,y,angle,speed*this.enemyBulletSpeed,style);
    this.density.trackBossShots([bullet],this.attackContext(style?.attack??'shoot'));this.density.recordFire(this.enemies,this.t);return bullet;
  }

  /** 普通敌单次发射量倍率；Boss 与小头目不缩。 */
  private fireScale():number{const em=this.density.emitter(this.enemies);return em&&em.data.contentRole==='normal'&&!em.def.boss?this.diff.fire:1;}

  fan(x: number, y: number, angle: number, count: number, spread: number, speed: number, style?: BulletStyle): Bullet[] {
    const out: Bullet[] = [];
    count = Math.max(1, Math.round(count * this.diff.count * this.fireScale()));
    speed *= this.enemyBulletSpeed;
    if(!this.allowOrdinaryFire(count))return out;
    for (let i = 0; i < count; i++) {
      const a = count === 1 ? angle : angle - spread / 2 + (spread * i) / (count - 1);
      out.push(this.bullets.spawn(x, y, a, speed, style));
    }
    this.density.trackBossShots(out,this.attackContext(style?.attack??'fan'));this.density.recordFire(this.enemies,this.t);
    return out;
  }

  ring(x: number, y: number, count: number, speed: number, style?: BulletStyle, offset = 0): Bullet[] {
    const out: Bullet[] = [];
    count = Math.max(1, Math.round(count * this.diff.count * this.fireScale()));
    speed *= this.enemyBulletSpeed;
    if(!this.allowOrdinaryFire(count))return out;
    for (let i = 0; i < count; i++) out.push(this.bullets.spawn(x, y, offset + (i / count) * Math.PI * 2, speed, style));
    this.density.trackBossShots(out,this.attackContext(style?.attack??'ring'));this.density.recordFire(this.enemies,this.t);
    return out;
  }

  private attackContext(attack:string):AttackContext|null{
    const e=this.bossE;if(!e)return null;
    return {stage:this.stageIndex,boss:e.def.boss!.name,phase:e.data.phaseIndex??e.data.phase??0,phaseName:e.data.densityPhaseName??'',attack,time:this.t};
  }
  recordAttackRejection(attack:string,size:number,existing:number,cap:number):void{
    const context=this.attackContext(attack);if(context){this.density.recordAttack(context,size,this.bullets.list.filter(b=>!b.dead).length,cap,true,size,'local');this.density.attackLog.at(-1)!.guardExisting=existing;}
  }
  private supplementOrdinaryFire():void{
    const cfg=MINIMUM_FIRE[this.stageIndex];if(!cfg)return;
    for(const e of this.enemies){
      if(e.data.noSupplementFire||e.data.contentRole!=='normal'||e.def.boss||!this.density.visible(e))continue;
      e.data.densityLastFire??=this.t;
      if(e.scope.paused||this.t-e.data.densityLastFire<cfg.interval)continue;
      e.data.densityLastFire=this.t;
      const cap=this.bossE?DENSITY_LIMITS[this.stageIndex].bossBullets:this.density.bulletCap(this.stageIndex);
      if(this.bullets.list.filter(b=>!b.dead).length>=cap){this.density.skippedShots++;continue;}
      this.bullets.spawn(e.x,e.y,this.aim(e.x,e.y),cfg.speed*this.enemyBulletSpeed,{shape:'rice',color:'cyan'});
    }
  }

  private allowOrdinaryFire(count:number):boolean{return this.density.allowFire(this.stageIndex,this.enemies,this.bullets.list.filter(b=>!b.dead).length,count,!!this.bossE);}

  aimTarget(x:number,y:number,tracking=false):{x:number;y:number}{return this.skills.aimTarget(x,y,tracking);}
  unlockSkill(id:SkillId):void{const source=this.bossE;this.skills.unlock(id,source?.x,source?.y);}
  aim(x: number, y: number): number {
    const target=this.aimTarget(x,y);return angleTo(x,y,target.x,target.y);
  }

  laser(x: number, y: number, angle: number, opts: LaserOpts = {}): Laser {
    const l = new EnemyLaser(x, y, angle, {
      length: 1600, width: 14, warn: 0.8, duration: 1.2, color: 'magenta', sweep: 0, followAngle: false, clock: 'game', ...opts,
    });
    l.startedReal = this.real;
    l.o.warn *= this.diff.warn;
    if(this.real<this.letteringQuietUntil){l.kill();return l;}
    this.lasers.push(l);
    const context=this.attackContext('laser');if(context)this.density.recordAttack(context,0,this.bullets.list.filter(b=>!b.dead).length,DENSITY_LIMITS[this.stageIndex]?.bossBullets??Infinity,false,0,'laser');
    this.audio.sfx('laser_charge', { vol: 0.6 });
    return l;
  }

  clearBullets(toGold = true, near?: { x: number; y: number; r: number }): void {
    for (const b of this.bullets.list) {
      if (b.dead) continue;
      if (near && Math.hypot(b.x - near.x, b.y - near.y) > near.r) continue;
      if (toGold) this.bulletToGold(b);
      else {
        b.dead = true;
        this.fx.emitHigh({ x: b.x, y: b.y, life: 0.25, size: b.size, sizeEnd: b.size * 2.5, r: b.r, g: b.g, b: b.b, a: 0.7, kind: PK.Ring });
      }
    }
  }

  bulletCount(): number {
    return this.bullets.list.length;
  }

  drop(kind: ItemKind, x: number, y: number): void {
    this.items.spawn(kind, clamp(x, 30, PLAY_W - 30), y);
  }

  scrollSpeed(v: number, sec = 0): void {
    if (sec <= 0) { this.scrollV = v; return; }
    this.tweens.push({ get: () => this.scrollV, set: (x) => (this.scrollV = x), from: this.scrollV, to: v, t: 0, dur: sec });
  }

  bg(index: number, value: number, sec = 0): void {
    const P = this.r.bgParams[index >> 2];
    const c = index & 3;
    if (sec <= 0) { P[c] = value; return; }
    this.tweens.push({ get: () => P[c], set: (x) => (P[c] = x), from: P[c], to: value, t: 0, dur: sec,presentation:true });
  }

  bgFlash(amount: number): void {
    this.bgFlashAmt = Math.max(this.bgFlashAmt, amount);
  }

  ambientMusic: MusicId = 'stage1';
  get combatMusic(): MusicId {
    const cue = this.bossE?.def.boss?.music, phase = this.bossE?.data.phase ?? 1;
    return cue ? bossMusicAtPhase(cue, phase) : this.ambientMusic;
  }
  music(id: MusicId | null, fade?: number): void {
    if (id) this.ambientMusic = id;
    this.audio.music(id, fade);
  }

  sfx(id: Sfx, opts?: { pan?: number; vol?: number; pitch?: number }): void {
    this.audio.sfx(id, opts);
  }

  letteringQuietUntil=0;
  get cardActive(){return this.ui.stageCardActive();}
  card(title: string, subtitle: string): void {
    this.letteringQuietUntil=this.real+2.9;this.bullets.suppress=true;
    this.ui.stageCard(this.stageIndex, title, subtitle);
  }

  caption(speaker: string, text: string, duration = 3.5, pause=false): void {
    if(!text.trim())return;
    if(pause&&speaker){const name=speaker==='朱雀'?'小满':speaker;const ids:Record<string,string>={小满:'xiaoman',老盾:'laodun',衡天:'zhangmen'};this.ui.chapterSay({name,portrait:ids[name]?`/art/portraits/${ids[name]}/calm.png`:undefined},'平静',text,'',false,{pause:true,onDone:()=>{},onSkip:()=>{}});return;}
    this.ui.caption(speaker, text, duration);
  }

  say(actor: string | DialogueActor, expression: string, text: string, duration = 4): void {
    if(!this.chapterDialogue)this.ui.say(actor, expression, text, duration);
  }

  *growthChoice(slot:number): Co {
    if(!this.progression.claimChoice(this.stageIndex,slot))return;
    this.clearBullets(true);for(const l of this.lasers)l.kill();this.forces=[];
    this.audio.music('rest', .8);
    this.restLabel=`成长 ${slot}/3`;this.onMilestone(this.restLabel);
    yield* until(()=>!this.restLabel);
    this.audio.music(this.ambientMusic, .8);
  }

  *milestone(label: string): Co {
    this.clearBullets(true);
    this.forces = [];
    for (const l of this.lasers) l.kill();
    this.player.ink = Math.min(1, this.player.ink + 0.25);
    this.player.invuln = Math.max(this.player.invuln, 2);
    this.contentStats.milestones++;
    this.audio.music('rest', .8);
    this.restLabel = label;
    this.onMilestone(label);
    yield* until(() => !this.restLabel);
    this.audio.music(this.ambientMusic, .8);
  }

  *challenge(opts: ChallengeOpts): Generator<unknown, boolean, unknown> {
    if (this.challengeState) return false;
    this.clearBullets(false);
    this.forces = [];
    for (const l of this.lasers) l.kill();
    if (opts.action === 'brush') this.player.ink = Math.max(this.player.ink, 0.6);
    const state = { ...opts, remaining: opts.duration, result: null as boolean | null, elapsed: 0 };
    this.challengeState = state;
    this.contentStats.challenges++;
    while (state.result === null) yield;
    const ok = state.result;this.audio.sfx(ok?'counter_success':'counter_fail');
    this.challengeState = null;
    if (ok) { this.contentStats.successes++; this.fx.burst(this.player.x, this.player.y, 24, 240, [1.5, 1.2, 0.4]); this.ui.popup(this.player.x, this.player.y - 55, '反制 · 成', 'seal'); }
    else { this.contentStats.failures++; this.player.ink = Math.max(0.5, this.player.ink); this.ui.popup(this.player.x, this.player.y - 55, '退一步 · 寻隙', 'info'); }
    return ok;
  }

  private updateChallenge(realDt: number): void {
    const s = this.challengeState;
    if (!s || s.result !== null) return;
    s.elapsed += realDt;
    s.remaining = Math.max(0, s.duration - s.elapsed);
    if (this.input.pressed(s.action) || (this.debugAuto && s.elapsed > 0.6)) {
      // 落笔反制沿用同次按住作画；其闭环由关卡检验。爆发反制不扣常规库存。
      if (s.action !== 'brush') this.input.consume(s.action);
      s.result = true;
    } else if (s.remaining <= 0) s.result = false;
  }
  force(opts: ForceOpts): void {
    this.forces.push({ ...opts, left: opts.duration });
    this.fx.push(opts.x, opts.y, (opts.vx ?? 0) * opts.strength * 2, (opts.vy ?? 0) * opts.strength * 2, Math.min(150, opts.radius));
  }

  *boss(def: EnemyDef, x: number, y: number, opts: BossOpts = {}): Co {
    const info = def.boss ?? { name: def.name ?? '???', phases: 1 };
    let musicReady = opts.music === false;
    if (!musicReady) void this.audio.prepareMusic(this.ambientMusic === 'stage4' ? 4 : this.stageIndex, true).then(() => { musicReady = true; });
    yield* until(() => musicReady);
    if (opts.warning !== false) {
      if (opts.music !== false) this.audio.music('warning', 0);
      this.letteringQuietUntil=this.real+3;this.bullets.suppress=true;
      this.ui.warning(info.name, opts.subtitle ?? '');
      this.audio.sfx('warning');
      if (info.name.startsWith('铜雀')) this.audio.sfx('boss:tongque');
      const warningEnd = this.real + 3;
      yield* until(() => this.real+1e-8 >= warningEnd);this.ui.warningEnd?.();
    }
    if (opts.music !== false) this.audio.music(bossMusicAtPhase(info.music ?? 'boss', opts.startPhase ?? 1), 0);
    const e = this.spawn({ ...def, ai: undefined }, x, y);
    e.data.startPhase = Math.max(1, Math.min(info.phases, Math.trunc(opts.startPhase ?? 1)));
    e.data.phase = e.data.startPhase;
    e.data.musicEnabled = opts.music !== false;
    e.data.phaseCursor = e.data.startPhase - 1;
    e.phaseLock = true;
    this.bossE = e;
    this.bossPhases = info.phases - e.data.startPhase + 1;
    this.bossPhaseT = 0;
    this.bossPhaseLimit = 0;
    // 等 ai 结束（全部阶段完成）；部件炮塔的协程不计入
    let done = !def.ai;
    if (def.ai) {
      const ai = def.ai(e, this);
      e.run((function* () { yield* ai; done = true; })());
    }
    yield* until(() => e.dead || done || !!e.data.battleHardDeadline && this.real >= e.data.battleHardDeadline);
    if (!done && !e.dead && e.data.bossCombat) {
      e.data.assisted=true;e.data.globalTimeout=true;e.data.bossResult='timeout';
      (e.data.events??=[]).push({id:'seal-timeout',real:this.real});
      this.bossCombat.endPhase(e,false);
    }
    if (!e.dead) {
      if (opts.transition) { this.remove(e); this.forces = []; for (const l of this.lasers) l.kill(); }
      else yield* this.bossDefeat(e);
    }
    if(!opts.transition&&e.data.bossResult!=='timeout'){
      const name=info.name,id:SkillId|null=name.startsWith('纸龙')?'tishen':name.startsWith('铜雀')?'zhongpao':name.startsWith('蜃')?'shenying':name.startsWith('雷公')?'bilei':null;
      if(id&&!(this.chapterDialogue&&(id==='tishen'||id==='zhongpao'||id==='shenying'&&this.chapter2)))this.unlockSkill(id);
    }
    this.bossE = null;
    if (!opts.transition && opts.music !== false) {this.audio.music('boss-clear',.3);const clearEnd=this.real+5.5;yield* until(()=>this.real>=clearEnd);this.music(opts.resumeMusic??this.ambientMusic,.6);}
    if(!opts.transition&&this.inkScore.award(info.name)){
      // 符纸与现有部件解锁演出衔接，不创建世界掉落物。
      const start=[e.x,e.y];for(let frame=0;frame<36;frame++){const u=frame/35,x=start[0]+(this.player.x-start[0])*u,y=start[1]+(this.player.y-start[1])*u;this.inkPageFlight={x,y,rot:u*2};this.fx.emitHigh({x,y,vx:0,vy:-20,life:.3,size:4,r:1.5,g:.8,b:.2,kind:PK.Leaf});yield;}
      this.inkPageFlight=null;this.onInkScore(info.name);yield* until(()=>!this.inkScore.pending);
    }
  }

  private *bossDefeat(e: Enemy): Co {
    const disable = e.def.boss?.defeat === 'disable';
    const big = !!this.bossE && (e.maxHp >= 1500 || this.bossPhases > 1);
    e.phaseLock = false;
    e.invulnerable = true;
    this.clearBullets(true);
    for (const l of this.lasers) l.kill();
    // 击破演出期间延续 Boss 曲；退场后由 boss() 接短乐段。
    e.scope.cancel();
    for (const c of e.children) if (!c.dead) { if (disable) this.remove(c); else this.kill(c, true); }
    if (!disable) {
      // 连环爆炸
      const n = big ? 14 : 6;
      for (let i = 0; i < n; i++) {
        const r = e.radius * 1.1;
        this.fx.explosion(e.x + this.rng.range(-r, r), e.y + this.rng.range(-r, r), i % 3 === 0 ? 'l' : 'm', this.damagePalette(e.lastDamageSource), this.r.bgId === 'stage1');
        e.flash = 1;delete e.data.hitFlashUntil;
        e.x += this.rng.range(-3, 3);
        yield* wait(big ? 0.14 : 0.1);
      }
      this.fx.explosion(e.x, e.y, 'xl', this.damagePalette(e.lastDamageSource), this.r.bgId === 'stage1');
      this.fx.flash(big ? 0.9 : 0.4);
      this.fx.shockwave(e.x, e.y, 700, 30, 1.2);
      // 泼墨式爆发：中心墨团冲开，外圈 12 股火光与墨沿放射方向甩出（避免一整块均匀光盘）
      this.r.fluid.splat({ x: e.x, y: e.y, r: 70, radial: true, vx: 1400, ink: [0.015, 0.012, 0.012, 0.9], glow: [1.6, 0.6, 0.2] });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.283 + this.rng.range(-0.2, 0.2), d = this.rng.range(20, 90), sp = this.rng.range(500, 1100), warm = this.rng.next();
        this.r.fluid.splat({
          x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, r: this.rng.range(16, 32), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          ink: i % 2 ? [0.015, 0.012, 0.012, 0.8] : undefined, glow: [2.6, 1.0 + warm * 0.8, 0.3 + warm * 0.3],
        });
      }
      for (let i = 0; i < 200 * this.fx.density; i++) {
        const a = this.rng.next() * 6.28, sp = this.rng.range(100, 900);
        this.fx.emitHigh({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 1.5, grav: 60, life: this.rng.range(1, 2.5), size: 3.5, spin: 10, r: 2.2, g: 1.5, b: 0.4, kind: PK.Leaf });
      }
    }
    const pts = Math.floor((e.def.score ?? 100000) * this.multiplier);
    this.addScore(pts);
    this.ui.popup(e.x, e.y, pts.toLocaleString(), 'score');
    this.kills++;
    e.dead = true;
    try { e.def.onDeath?.(e, this); } catch (err) { console.error(err); }
    const drops = e.def.drops ? (Array.isArray(e.def.drops) ? e.def.drops : [e.def.drops]) : [];
    for (const d of drops) this.drop(d, e.x + this.rng.range(-40, 40), e.y);
    if (!disable) yield* wait(1.5);
  }

  *phase(e: Enemy, opts: PhaseOpts, body: () => Co): Generator<unknown, boolean, unknown> {
    if (e.dead) return false;
    e.data.phaseCursor = (e.data.phaseCursor ?? 0) + 1;
    e.data.phase = e.data.phaseCursor;
    const cue = e.def.boss?.music;
    if (cue && e.data.musicEnabled) this.audio.music(bossMusicAtPhase(cue, e.data.phase), 1.2);
    e.maxHp = e.hp = Math.max(1, Math.round(opts.hp * this.diff.hp));
    e.phaseLock = true;
    if(e.data.copperSimple)e.data.phaseTitleUntil=this.real+1.2;
    this.mantra.beginBossPhase(e,e.data.phase,e.maxHp);
    this.bossPhaseT = 0;
    this.bossPhaseReal = opts.clock === 'real'||opts.clock === 'boss';
    this.bossPhaseStartedReal = this.real;
    this.bossPhaseLimit = opts.time ?? 60;
    e.data.densityPhaseName=opts.name??'';
    if (opts.name&&!e.data.copperSimple) this.ui.caption('', opts.name, 2.5);
    this.bossCombat.beginPhase(e);
    const scope = new Scope(e.scope);
    scope.run(body());
    let t = 0;
    const started = opts.clock==='boss'?this.bossCombat.clock:this.real;
    const limit = opts.time ?? 60;
    const completed = () => opts.complete ? opts.complete() : e.hp <= 0;
    while (!e.dead && !completed() && t + 1e-8 < limit) {
      yield;
      t = opts.clock==='boss'?this.bossCombat.clock-started:opts.clock === 'real' ? this.real - started : t + Clock.dt;
      if(e.data.bossCombat&&this.bossCombat.phase)this.bossCombat.phase.elapsed=t;
    }
    scope.cancel();
    this.forces = [];
    const broken = completed();if(e.data.bossCombat)this.bossCombat.mode('本段定格与清弹','对白演出');this.bossCombat.endPhase(e,broken);
    if (broken && !e.dead) this.companions.onBossPhaseCompleted();
    this.bossPhases = Math.max(0, this.bossPhases - 1);
    for (const l of this.lasers) if (l.o.follow === e || l.o.follow?.parent === e) l.kill();
    this.clearBullets(true);
    if(e.data.bossCombat&&!e.data.copperSimple&&this.bossPhases===0){e.invulnerable=true;let hold=0;while(hold<1.2&&!e.dead){yield;hold+=Clock.realDt;}e.invulnerable=false;}
    if (this.bossPhases > 0) {
      this.audio.sfx('boss_phase');
      if (e.def.boss?.defeat !== 'disable') { this.fx.explosion(e.x, e.y, 'l'); this.fx.flash(0.3); }
      e.invulnerable = true;
      const seconds = opts.transitionTime ?? 1.2;
      let transition = 0;
      const transitionStarted = this.presentationTime;
      e.scope.presentation=true;
      while (transition + 1e-8 < seconds && !e.dead) { yield; transition = opts.clock === 'real' ? this.presentationTime - transitionStarted : transition + Clock.dt; }
      e.scope.presentation=false;while(this.dialoguePaused)yield;
      e.invulnerable = false;
    }
    return broken;
  }
}
