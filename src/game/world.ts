// 游戏世界：实现关卡接口 G，负责实体更新、碰撞、计分、Boss 阶段、绘制调度。
import { DIFFS, type DiffCfg, type Difficulty } from '../core/difficulty';
import type { Input } from '../core/input';
import { Rng, angleTo, approach, clamp, segDist2 } from '../core/math';
import { Clock, Scope, all, fork, frames, until, wait, type Co } from '../core/tasks';
import { PK } from '../gl/particles';
import { RS } from '../gl/ribbons';
import type { Renderer } from '../gl/renderer';
import { SHEETED } from '../art/sprites_ch1_art';
import { PLAY_H, PLAY_W, type DamageSource, type DialogueActor, type GameAudio, type GameUI, type HudState, type MusicId, type Sfx } from '../types';
import type { BossOpts, ChallengeOpts, ExplosionPalette, ForceOpts, G, Laser, LaserOpts, PhaseOpts } from './api';
import { Brush } from './brush';
import { Bullet, BulletPool, type BulletStyle } from './bullets';
import { MASK_CELL } from '../gl/atlas';
import { Enemy, type EnemyDef, type ItemKind } from './enemy';
import { FxSystem } from './fx';
import { Item, Items } from './items';
import { Player } from './player';
import { Progression } from './progression';
import { CompanionSystem } from './companion';
import { ComboSystem } from './combos';
import { ShopSystem } from './shop';
import { MoveSystem } from './moves';

const MEDALS = [100, 200, 500, 1000, 2000, 3000, 5000, 8000, 10000];
const EXTENDS = [1_000_000, 3_000_000, 6_000_000];
const LASER_COL: Record<NonNullable<LaserOpts['color']>, [number, number, number]> = {
  cyan: [0.3, 1.4, 1.8], magenta: [1.8, 0.3, 1.3], violet: [1.0, 0.45, 2.0], amber: [2.0, 0.9, 0.2], red: [2.0, 0.25, 0.15], gold: [2.0, 1.4, 0.45],
};

class EnemyLaser implements Laser {
  t = 0;
  dead = false;
  firedSfx = false;
  constructor(public x: number, public y: number, public angle: number, readonly o: Required<Omit<LaserOpts, 'follow' | 'anchor'>> & LaserOpts) {}
  kill(): void {
    this.dead = true;
  }
}

interface Tween { get: () => number; set: (v: number) => void; from: number; to: number; t: number; dur: number }

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
  readonly rng = new Rng(20260930);
  readonly fx: FxSystem;
  readonly bullets = new BulletPool();
  readonly items = new Items();
  readonly player: Player;
  readonly brush: Brush;
  readonly progression: Progression;
  readonly companions: CompanionSystem;
  readonly combos: ComboSystem;
  readonly moves: MoveSystem;
  readonly shop: ShopSystem;
  challengeState: (ChallengeOpts & { remaining: number; result: boolean | null; elapsed: number }) | null = null;
  restLabel = '';
  onMilestone: (label: string) => void = () => { this.restLabel = ''; };
  debugAuto = false;
  readonly contentStats = { bodies: 0, types: new Set<string>(), challenges: 0, successes: 0, failures: 0, milestones: 0 };
  enemies: Enemy[] = [];
  private lasers: EnemyLaser[] = [];
  private forces: (ForceOpts & { left: number })[] = [];
  root = new Scope();

  // 时间
  t = 0;
  dt = 1 / 60;
  time = 0;
  real = 0;
  timeScale = 1;
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
  private medalIdx = 0;
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

  /** 由 Game 设置。 */
  onGameOver: () => void = () => {};
  stageIndex = 1;
  stageName = '';

  constructor(readonly r: Renderer, readonly audio: GameAudio, readonly ui: GameUI, readonly input: Input) {
    this.fx = new FxSystem(r, audio, this.rng);
    this.player = new Player(this);
    this.brush = new Brush(this);
    this.progression = new Progression(this);
    this.companions = new CompanionSystem(this, this.progression);
    this.combos = new ComboSystem(this, this.progression, this.companions);
    this.moves = new MoveSystem(this);
    this.shop = new ShopSystem(this, this.progression, this.companions);
    this.items.onMedalMissed = () => { this.medalIdx = 0; };
  }

  // ================================================================ 生命周期

  /** 新关卡开始前重置场景（保留玩家状态与分数）。 */
  resetStage(): void {
    this.testOptions = null;
    this.checkpointTarget = null;
    this.currentCheckpoint = '';
    this.root.cancel();
    this.root = new Scope();
    this.enemies = [];
    this.lastWeaponTarget=null;
    this.lasers = [];
    this.forces = [];
    this.bullets.clear();
    this.items.clear();
    this.brush.clear();
    this.fx.clear();
    this.tweens = [];
    this.t = 0;
    this.scroll = 0;
    this.scrollV = 60;
    this.bossE = null;
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
    this.moves.resetStage();
    this.shop.resetStage();
    this.contentStats.bodies = this.contentStats.challenges = this.contentStats.successes = this.contentStats.failures = this.contentStats.milestones = 0;
    this.contentStats.types.clear();
    this.r.fluid.clear();
    this.r.partLow.reset();
    this.r.partHigh.reset();
  }

  setDifficulty(d: Difficulty): void {
    this.diffId = d;
    this.diff = DIFFS[d];
  }
  get difficulty(): DiffCfg { return this.diff; }

  newGame(): void {
    this.score = 0;
    this.chain = 0;
    this.medalIdx = 0;
    this.extendIdx = 0;
    this.player.startLives = this.diff.lives;
    this.player.startBombs = this.diff.bombs;
    this.player.reset(true);
    this.progression.resetRun();
    this.companions.resetRun();
    this.combos.resetRun();
    this.moves.resetRun();
    this.shop.resetRun();
  }

  // ================================================================ 每帧

  tick(realDt: number): void {
    const p = this.player;
    if(this.moves.consumeHitstop(realDt)){
      this.real+=realDt;this.dt=0;Clock.dt=0;Clock.realDt=realDt;
      // 停顿仍读取射击、换色和下一条指令，位置与战斗时钟保持。
      const oldWeapon=p.weapon;p.update(0,0);
      if(p.weapon!==oldWeapon){this.progression.recordAction({kind:'weaponChange',source:p.weapon});this.combos.record('weaponChange',p.weapon);}
      this.moves.update(realDt,0);this.fx.update(0,realDt,this.real);
      return;
    }
    this.frameNo++;
    // 子弹时间
    const target = this.brush.active ? 0.25 : 1;
    this.timeScale = approach(this.timeScale, target, this.brush.active ? 14 : 6, realDt);
    const slow = (1 - this.timeScale) / 0.75;
    this.audio.setSlowmo(slow);
    this.r.post.inkMode = slow;
    const dt = realDt * this.timeScale;
    this.dt = dt;
    Clock.dt = dt;
    Clock.realDt = realDt;
    Clock.t += dt;
    Clock.frame++;
    this.t += dt;
    this.time += dt;
    this.real += realDt;

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
    this.shop.update(realDt);
    if (this.input.pressed('focus') && !this.challengeState) {
      this.progression.recordAction({ kind: 'focus' });
      this.combos.record('focus');
    }
    const oldWeapon = p.weapon;
    p.update(realDt, dt);
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
    this.moves.update(realDt,dt);
    this.moves.interceptCounter();
    this.companions.update(dt);
    this.combos.update(dt);
    Enemy.px = p.x;
    Enemy.py = p.y;
    this.rank = clamp((this.stageIndex - 1) * 0.3 + (p.power - 1) / 7 * 0.25, 0, 1) * this.diff.rank;

    // 协程（关卡脚本 + 敌人 AI）
    this.root.tick();

    // 敌人
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - realDt * 8);
      if (e.sealed > 0) {
        e.sealed = Math.max(0, e.sealed - dt);
        e.scope.paused = e.sealed > 0;
      }
      if (e.parent) e.syncToParent();
      else if (e.sealed <= 0) {
        e.x += e.vx * dt * e.companionSpeed;
        e.y += e.vy * dt * e.companionSpeed;
      }
      if (e.def.ground && !e.parent) e.y += this.scrollV * dt;
      if (e.def.face === 'move' && (e.vx || e.vy) && !e.parent) e.angle = Math.atan2(e.vy, e.vx) - Math.PI / 2;
      else if (e.def.face === 'player') e.angle = angleTo(e.x, e.y, p.x, p.y) - Math.PI / 2;
      const animFps = e.def.anim || (SHEETED.has(e.info.id) ? 10 : 0);
      if (animFps && e.info.frames.length > 1) e.frame = Math.floor(e.age * animFps) % e.info.frames.length;
      // 离场回收
      if (!e.parent && !e.def.boss && e.age > 1.5) {
        const m = 60 + e.radius;
        if (e.y > PLAY_H + m || e.y < -m - 400 || e.x < -m - 200 || e.x > PLAY_W + m + 200) this.remove(e);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.bullets.tick(dt);
    this.updateLasers(dt);
    this.moves.interceptCounter();
    this.collide();

    this.items.tick(dt, p.x, p.y, p.alive, p.alive && p.y < 330, (it) => this.pickup(it));

    if (this.chainT > 0) {
      this.chainT -= dt;
      if (this.chainT <= 0) this.chain = 0;
    }
    this.grazeSfxT -= realDt;
    if (this.bossE) this.bossPhaseT += dt;

    this.fx.update(dt, realDt, this.real);
  }

  // ================================================================ 碰撞

  /** 最近一次 shotHit 命中的位置。 */
  hitX = 0;
  hitY = 0;

  /** 敌机外廓半径：遮罩实心格最远距离 × 缩放；无遮罩时退回 e.radius。 */
  private extent(e: Enemy): number {
    const mr = e.info.maskR;
    return mr > 0 ? mr * Math.max(Math.abs(e.scaleX), Math.abs(e.scaleY)) : e.radius;
  }

  targetable(e: Enemy, includeShield = false): boolean {
    if (e.dead || (e.invulnerable && !includeShield)) return false;
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
    const lx = (dx * c + dy * s) / sx + info.pivot[0], ly = (-dx * s + dy * c) / sy + info.pivot[1];
    const rx = r / asx, ry = r / asy;
    const C = MASK_CELL, mw = info.maskW, mh = info.maskH;
    const i0 = Math.max(0, Math.floor((lx - rx + info.w / 2) / C)), i1 = Math.min(mw - 1, Math.floor((lx + rx + info.w / 2) / C));
    const j0 = Math.max(0, Math.floor((ly - ry + info.h / 2) / C)), j1 = Math.min(mh - 1, Math.floor((ly + ry + info.h / 2) / C));
    const m = info.mask;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (m[j * mw + i]) return true;
    return false;
  }

  /** 命中判定 = 碰撞圆 或 精灵遮罩。 */
  hitShape(e: Enemy, x: number, y: number, r: number): boolean {
    return this.hitCircles(e, (cx, cy, cr) => (cx - x) ** 2 + (cy - y) ** 2 < (cr + r) ** 2) || this.hitMask(e, x, y, r);
  }

  /** 线段 a→b 加宽 r 是否碰到敌机（遮罩/圆），命中点（离 a 最近）写入 hitX/hitY。仅在粗筛圆内按 ≤4 步长采样。 */
  hitSegment(e: Enemy, ax: number, ay: number, bx: number, by: number, r: number): boolean {
    const ext = this.extent(e), R = ext + r;
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

  /** 玩家子弹命中检测（点或线段扫掠 x0,y0→x1,y1，步长 ≤4），返回命中的敌人，命中点写入 hitX/hitY（地面单位优先级最低）。 */
  shotHit(x: number, y: number, r: number, px = x, py = y): Enemy | null {
    const dist = Math.hypot(x - px, y - py);
    const n = Math.max(1, Math.ceil(dist / 4));
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (!this.targetable(e, true)) continue;
      let hx = 0, hy = 0, hit = false;
      // 沿线段从旧点到新点采样
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        hx = px + (x - px) * t; hy = py + (y - py) * t;
        if (this.hitShape(e, hx, hy, r)) { hit = true; break; }
      }
      if (hit) {
        if (!best || (best.def.ground && !e.def.ground)) { best = e; this.hitX = hx; this.hitY = hy; }
        if (!e.def.ground) break;
      }
    }
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
        if (p.invuln <= 0 && p.bombT <= 0) {
          b.dead = true;
          p.die();
          return;
        }
      } else if (!b.grazed && d2 < (b.radius + gr) ** 2) {
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
      if (e.dead || e.def.ground || e.def.noCollide || e.sealed > 0 || !this.targetable(e)) continue;
      if (this.hitCircles(e, (cx, cy, cr) => (cx - p.x) ** 2 + (cy - p.y) ** 2 < (cr * 0.55 + hr) ** 2)) {
        p.die();
        return;
      }
    }
    // 激光
    for (const l of this.lasers) {
      if (l.dead || l.t < l.o.warn || l.t > l.o.warn + l.o.duration) continue;
      const ex = l.x + Math.cos(l.angle) * l.o.length, ey = l.y + Math.sin(l.angle) * l.o.length;
      const ramp = Math.min(1, (l.t - l.o.warn) / 0.12);
      if (segDist2(p.x, p.y, l.x, l.y, ex, ey) < (l.o.width * 0.6 * ramp + hr) ** 2) {
        p.die();
        return;
      }
    }
  }

  // ================================================================ 伤害与击破

  lastWeaponTarget: Enemy | null = null;
  damage(e: Enemy, amount: number, x = e.x, y = e.y, quiet = false, source: DamageSource = 'neutral'): void {
    if (e.dead || amount <= 0) return;
    if (e.invulnerable) { this.fx.onDamage(e, source, x, y, 0, true); return; }
    const armor = e.def.armor ?? 1;
    const primary = source === 'red' || source === 'blue' || source === 'purple';
    const actual = amount * this.progression.primaryScale(source) * armor * (e.data.weakWeapon === source ? 1.35 : 1) * (primary ? this.companions.weaknessBonus(e) : 1);
    e.hp -= actual;
    if(primary)this.lastWeaponTarget=e;
    e.lastDamageSource = source;
    this.fx.onDamage(e, source, x, y, actual);
    this.progression.recordAction({ kind: 'hit', source, amount: actual, enemy: e });
    if (primary && !quiet) this.combos.record('shoot', source);
    // 受击闪白不累加：大体型（Boss、部件）上限低，连射时呈闪烁而不是整片泛白
    e.flash = Math.max(e.flash, e.def.boss || e.parent || e.radius > 60 ? 0.28 : armor < 1 ? 0.4 : 0.6);
    e.hitAccum += amount;
    if (!quiet && this.frameNo % 4 === 0) this.audio.sfx(armor < 1 ? 'hit_armor' : primary ? `hit_${source as 'red' | 'blue' | 'purple'}` : 'hit', { vol: 0.25, pan: (x / PLAY_W) * 2 - 1 });
    if (e.hp <= 0) {
      if (e.phaseLock) e.hp = 0;
      else this.kill(e);
    }
  }

  /** 击破（有分数、爆炸、掉落）。 */
  kill(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    e.scope.cancel();
    for (const c of e.children) if (!c.dead) { c.lastDamageSource = e.lastDamageSource; this.kill(c); }
    const size = e.def.explosion ?? (e.def.hp >= 400 ? 'l' : e.def.hp >= 60 ? 'm' : 's');
    this.fx.explosion(e.x, e.y, size, this.damagePalette(e.lastDamageSource), this.r.bgId === 'stage1');
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
    while (this.extendIdx < EXTENDS.length && this.score >= EXTENDS[this.extendIdx]) {
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
      case 'gold': this.addScore(100 * this.multiplier); if (this.frameNo % 3 === 0) a.sfx('medal', { vol: 0.25, pitch: 1.5 }); return;
      case 'p':
        if (p.power < 8) { p.power++; a.sfx('powerup'); this.ui.popup(it.x, it.y, p.power === 8 ? '力 · 满' : '力 +1', 'info'); }
        else { this.addScore(10000); this.ui.popup(it.x, it.y, '10,000', 'score'); a.sfx('item'); }
        break;
      case 'weapon': {
        const c = Items.weaponColor(it);
        if (c !== p.weapon) a.sfx('weapon_change');
        else a.sfx('powerup');
        p.weapon = c;
        if (p.power < 8) p.power++;
        this.ui.popup(it.x, it.y, { red: '朱', blue: '青', purple: '雷' }[c], 'info');
        break;
      }
      case 'bomb': p.bombs = Math.min(7, p.bombs + 1); a.sfx('item'); this.ui.popup(it.x, it.y, '墨 +1', 'info'); break;
      case 'missile':
        if (p.missile < 4) p.missile++;
        else this.addScore(10000);
        a.sfx('powerup'); this.ui.popup(it.x, it.y, '矢', 'info'); break;
      case 'medal': {
        const v = MEDALS[this.medalIdx];
        this.medalIdx = Math.min(MEDALS.length - 1, this.medalIdx + 1);
        this.addScore(v);
        a.sfx('medal');
        this.ui.popup(it.x, it.y, v.toLocaleString(), 'score');
        break;
      }
      case 'ink': p.ink = Math.min(1, p.ink + 0.25); a.sfx('item'); break;
      case '1up': p.lives++; a.sfx('extend'); this.ui.popup(it.x, it.y, '命 +1', 'extend'); break;
    }
    this.fx.burst(it.x, it.y, 10, 260, [2.0, 1.5, 0.5], 0.4);
  }

  // ================================================================ 激光

  private updateLasers(dt: number): void {
    for (const l of this.lasers) {
      if (l.dead) continue;
      const f = l.o.follow;
      if (f) {
        if (f.dead) { l.dead = true; continue; }
        const p = l.o.anchor ? f.anchor(l.o.anchor) : f;
        l.x = p.x; l.y = p.y;
      }
      l.angle += (l.o.sweep ?? 0) * dt;
      l.t += dt;
      if (!l.firedSfx && l.t >= l.o.warn) { l.firedSfx = true; this.audio.sfx('laser_fire', { vol: 0.7 }); this.fx.shake(0.12); }
      if (l.t > l.o.warn + l.o.duration + 0.25) l.dead = true;
    }
    this.lasers = this.lasers.filter((l) => !l.dead);
  }

  // ================================================================ 绘制

  draw(): void {
    const r = this.r;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const sx = e.scaleX * (e.mirror ? -1 : 1);
      const sealed = e.sealed > 0;
      const d = {
        x: e.x, y: e.y, rot: e.angle, sx, sy: e.scaleY, frame: e.frame, flash: e.flash, glow: e.glow * (sealed ? 0.3 : 1), alpha: e.alpha,
        r: e.tint[0] * (sealed ? 1.3 : 1), g: e.tint[1] * (sealed ? 0.35 : 1), b: e.tint[2] * (sealed ? 0.3 : 1),
        deform: e.def.deform,
      };
      if (e.def.ground) r.ground.add(e.info, d);
      else {
        r.shadows.add(e.info, d);
        r.air.add(e.info, d);
      }
      this.fx.drawDamage(e, this.real);
      if (e.data.weakWeapon || e.data.weakLabel) {
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
    for (const it of this.items.list) {
      const gold = it.kind === 'gold';
      const s = gold ? 0.42 : 1 + 0.06 * Math.sin(it.age * 8);
      r.items.add(Items.sprite(it), { x: it.x, y: it.y, sx: s, sy: s, rot: gold ? it.age * 6 : 0, glow: 1.2 + 0.4 * Math.sin(it.age * 10) });
    }
    r.shotLight = this.player.weapon === 'blue' ? [0.3, 0.6, 1.0] : this.player.weapon === 'purple' ? [0.7, 0.35, 1.0] : [1.0, 0.42, 0.28];
    this.player.draw(r, this.real);
    this.companions.draw(r, this.real);
    this.progression.draw(r);
    this.moves.draw();
    const B = r.bullets;
    for (const b of this.bullets.list) {
      const ang = b.shape === 6 ? b.seed * 6.28 : b.angle;
      B.add(b.x, b.y, ang, b.size, b.shape, b.r, b.g, b.b, b.age, 1, b.seed, b.speed);
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
    return {
      score: this.score, hiScore: this.hiScore, lives: Math.max(0, p.lives), bombs: p.bombs,
      ink: p.ink, inkReady: p.ink >= this.progression.brushMods.minInk, power: p.power, weapon: p.weapon, missile: p.missile,
      multiplier: this.multiplier, graze: this.graze, medalValue: MEDALS[this.medalIdx],
      stage: this.stageIndex, stageName: this.stageName,
      boss: b && !b.dead ? { name: b.def.boss?.name ?? b.def.name ?? '', hp: b.hpFrac, phasesLeft: this.bossPhases, timer: Math.max(0, this.bossPhaseLimit - this.bossPhaseT), hint: b.data.weakLabel ?? b.data.bodyPhase } : null,
      brushActive: this.brush.active, fps, difficulty: this.diff.name,
      challenge: this.challengeState,
      companions: this.companions.team.filter(s => this.companions.testSelection === null || this.companions.testSelection.has(s.kind)).map(s => ({ name: s.name, kind:s.kind, role:s.role, active:s.active, count:s.count, level: 1, xp: 0 })),
      passives: this.progression.passiveHud(),
      growth: { brush: this.progression.brushLevel, bomb: this.progression.bombLevel, talents: this.progression.talents.size },
      activeMoves: this.moves.hud,
      combo: this.combos.lastTimer > 0 ? this.combos.lastName : '',
    };
  }

  get bgFlashValue(): number {
    return this.bgFlashAmt;
  }

  // ================================================================ G 接口

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
    if (!def.boss && e.data.contentRole === 'normal') { this.contentStats.bodies++; this.contentStats.types.add(def.name ?? def.sprite); }
    this.scaleHp(e);
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

  shoot(x: number, y: number, angle: number, speed: number, style?: BulletStyle): Bullet {
    return this.bullets.spawn(x, y, angle, speed * this.diff.speed, style);
  }

  fan(x: number, y: number, angle: number, count: number, spread: number, speed: number, style?: BulletStyle): Bullet[] {
    const out: Bullet[] = [];
    count = Math.max(1, Math.round(count * this.diff.count));
    speed *= this.diff.speed;
    for (let i = 0; i < count; i++) {
      const a = count === 1 ? angle : angle - spread / 2 + (spread * i) / (count - 1);
      out.push(this.bullets.spawn(x, y, a, speed, style));
    }
    return out;
  }

  ring(x: number, y: number, count: number, speed: number, style?: BulletStyle, offset = 0): Bullet[] {
    const out: Bullet[] = [];
    count = Math.max(1, Math.round(count * this.diff.count));
    speed *= this.diff.speed;
    for (let i = 0; i < count; i++) out.push(this.bullets.spawn(x, y, offset + (i / count) * Math.PI * 2, speed, style));
    return out;
  }

  aim(x: number, y: number): number {
    return angleTo(x, y, this.player.x, this.player.y);
  }

  laser(x: number, y: number, angle: number, opts: LaserOpts = {}): Laser {
    const l = new EnemyLaser(x, y, angle, {
      length: 1600, width: 14, warn: 0.8, duration: 1.2, color: 'magenta', sweep: 0, followAngle: false, ...opts,
    });
    l.o.warn *= this.diff.warn;
    this.lasers.push(l);
    this.audio.sfx('laser_charge', { vol: 0.6 });
    return l;
  }

  clearBullets(toGold = true): void {
    for (const b of this.bullets.list) {
      if (b.dead) continue;
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
    this.tweens.push({ get: () => P[c], set: (x) => (P[c] = x), from: P[c], to: value, t: 0, dur: sec });
  }

  bgFlash(amount: number): void {
    this.bgFlashAmt = Math.max(this.bgFlashAmt, amount);
  }

  music(id: MusicId | null, fade?: number): void {
    this.audio.music(id, fade);
  }

  sfx(id: Sfx, opts?: { pan?: number; vol?: number; pitch?: number }): void {
    this.audio.sfx(id, opts);
  }

  card(title: string, subtitle: string): void {
    this.ui.stageCard(this.stageIndex, title, subtitle);
  }

  caption(speaker: string, text: string, duration = 3.5): void {
    this.ui.caption(speaker, text, duration);
  }

  say(actor: string | DialogueActor, expression: string, text: string, duration = 4): void {
    this.ui.say(actor, expression, text, duration);
  }

  *growthChoice(slot:number): Co {
    if(!this.progression.claimChoice(this.stageIndex,slot))return;
    this.clearBullets(true);for(const l of this.lasers)l.kill();this.forces=[];
    this.restLabel=`成长 ${slot}/3`;this.onMilestone(this.restLabel);
    yield* until(()=>!this.restLabel);
  }

  *milestone(label: string): Co {
    this.clearBullets(true);
    this.forces = [];
    for (const l of this.lasers) l.kill();
    this.player.ink = Math.min(1, this.player.ink + 0.25);
    this.player.invuln = Math.max(this.player.invuln, 2);
    this.contentStats.milestones++;
    this.restLabel = label;
    this.onMilestone(label);
    yield* until(() => !this.restLabel);
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
    const ok = state.result;
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
    if (opts.warning !== false) {
      if (opts.music !== false) this.audio.music(null, 1.5);
      this.ui.warning(info.name, opts.subtitle ?? '');
      this.audio.sfx('warning');
      if (info.name.startsWith('铜雀')) this.audio.sfx('boss:tongque');
      yield* wait(3.2);
    }
    if (opts.music !== false) this.audio.music(info.music ?? 'boss', 0.5);
    const e = this.spawn({ ...def, ai: undefined }, x, y);
    e.data.startPhase = Math.max(1, Math.min(info.phases, Math.trunc(opts.startPhase ?? 1)));
    e.data.phase = e.data.startPhase;
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
    yield* until(() => e.dead || done);
    if (!e.dead) {
      if (opts.transition) { this.remove(e); this.forces = []; for (const l of this.lasers) l.kill(); }
      else yield* this.bossDefeat(e);
    }
    this.bossE = null;
  }

  private *bossDefeat(e: Enemy): Co {
    const big = !!this.bossE && (e.maxHp >= 1500 || this.bossPhases > 1);
    e.phaseLock = false;
    e.invulnerable = true;
    this.clearBullets(true);
    for (const l of this.lasers) l.kill();
    this.audio.music(null, 1);
    e.scope.cancel();
    for (const c of e.children) if (!c.dead) this.kill(c);
    // 连环爆炸
    const n = big ? 14 : 6;
    for (let i = 0; i < n; i++) {
      const r = e.radius * 1.1;
      this.fx.explosion(e.x + this.rng.range(-r, r), e.y + this.rng.range(-r, r), i % 3 === 0 ? 'l' : 'm', this.damagePalette(e.lastDamageSource), this.r.bgId === 'stage1');
      e.flash = 1;
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
    const pts = Math.floor((e.def.score ?? 100000) * this.multiplier);
    this.addScore(pts);
    this.ui.popup(e.x, e.y, pts.toLocaleString(), 'score');
    this.kills++;
    e.dead = true;
    try { e.def.onDeath?.(e, this); } catch (err) { console.error(err); }
    const drops = e.def.drops ? (Array.isArray(e.def.drops) ? e.def.drops : [e.def.drops]) : [];
    for (const d of drops) this.drop(d, e.x + this.rng.range(-40, 40), e.y);
    yield* wait(1.5);
  }

  *phase(e: Enemy, opts: PhaseOpts, body: () => Co): Generator<unknown, boolean, unknown> {
    if (e.dead) return false;
    e.data.phaseCursor = (e.data.phaseCursor ?? 0) + 1;
    e.data.phase = e.data.phaseCursor;
    e.maxHp = e.hp = Math.max(1, Math.round(opts.hp * this.diff.hp));
    e.phaseLock = true;
    this.bossPhaseT = 0;
    this.bossPhaseLimit = opts.time ?? 60;
    if (opts.name) this.ui.caption('', opts.name, 2.5);
    const scope = new Scope(e.scope);
    scope.run(body());
    let t = 0;
    const limit = opts.time ?? 60;
    while (!e.dead && e.hp > 0 && t < limit) {
      yield;
      t += Clock.dt;
    }
    scope.cancel();
    this.forces = [];
    const broken = e.hp <= 0;
    this.bossPhases = Math.max(0, this.bossPhases - 1);
    for (const l of this.lasers) if (l.o.follow === e || l.o.follow?.parent === e) l.kill();
    this.clearBullets(true);
    if (this.bossPhases > 0) {
      this.audio.sfx('boss_phase');
      this.fx.explosion(e.x, e.y, 'l');
      this.fx.flash(0.3);
      e.invulnerable = true;
      yield* wait(1.2);
      e.invulnerable = false;
    }
    return broken;
  }
}
