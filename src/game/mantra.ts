// 泼墨演出（朱色「离火·朱雀」）。按真实时间推进：
//   0–0.15 起手  0.05–0.9 立绘笔触  0.15–0.95 逐字念咒  0.95–1.35 结印成朱雀
//   1.35–1.45 蓄力  1.45–2.0 释放  1.45–3.0 全屏墨浪（V1/V2 原样移植）。
// 触发、无敌、清弹、伤害与次数仍由 player.bomb() 和本类的 wave() 负责，这里只管演出与时间节奏。
import { MantraBudget } from './mantra-budget';
import { drawBagua, drawDragon, drawThunder, guaPos, type FormPose } from './mantra-forms';
import { BIRD_TARGETS, WING_SPAN, birdPoint, drawBird, tailPoint, wingTip, type BirdPose } from './mantra-bird';
import { Ease, clamp, deg, smoothstep } from '../core/math';
import { PK, type ParticleSpec } from '../gl/particles';
import { RS } from '../gl/ribbons';
import { STROKE, type SpellLayer } from '../gl/spell';
import { PLAY_H, PLAY_W, type WeaponColor } from '../types';
import type { World } from './world';
import type { Enemy } from './enemy';

const LAND = [0.26, 0.44, 0.60, 0.74, 0.95]; // 字落定时刻
const DROP = 0.11;                            // 字砸下用时
const SHAKE = [3, 4, 5, 6, 12];               // 落定震屏（像素）
const FLY0 = [0.95, 0.97, 0.99, 1.01, 1.0];  // 结印起飞
const FLY = [0.34, 0.34, 0.34, 0.34, 0.35];
const CHARGE = 1.35, RELEASE = 1.45, RELEASE_DUR = 0.35, WAVE0 = 1.45, TOTAL = 3.0;
const DRAGON_PATH: [number, number][] = [[.12, .62], [.22, .8], [.45, .84], [.72, .78], [.83, .62], [.6, .5], [.38, .42], [.3, .3], [.4, .18], [.62, .2], [.79, .24]];
const DRAGON_R = 260, DRAGON_LEN = 1700;      // 青龙盘绕半径与身长
const BURST = 1.28;                           // 红、青：神兽从字里炸出的时刻
const STRIKE = 1.75;                          // 紫：天雷劈落
const V1_DUR = 2.6;                           // V1 墨浪的时间基准（秒）
const SPIRAL_RATE = [120, 200, 300, 420, 560, 760]; // 每秒螺旋粒子数，随落字升档
const AURA = [50, 70, 90, 110, 130, 170];
const GLYPH = 150, GLYPH_LAST = 230;
const SWEEP = 0.3;                            // 墨浪扫满全屏用时
type Col3 = [number, number, number];
interface Theme {
  ring: Col3; aura: Col3; auraS: Col3; flash: Col3; flashW: Col3; flashAmt: number; waveInk: [number, number, number, number];
  sp: ParticleColors; spW: ParticleColors; fl: ParticleColors; ink: (a: number) => [number, number, number, number];
}
type ParticleColors = { r: number; g: number; b: number; r1: number; g1: number; b1: number };
const THEMES: Record<WeaponColor, Theme> = {
  red: { ring: [2.4, 0.5, 0.08], aura: [1.08, 0.18, 0.02], auraS: [0.2, 0.02, 0.01], flash: [1, 0.93, 0.78], flashW: [0.9, 0.3, 0.15], flashAmt: 1.1, waveInk: [0.012, 0.01, 0.01, 0.6],
    sp: { r: 2.6, g: 1.25, b: 0.25, r1: 1.2, g1: 0.1, b1: 0.02 }, spW: { r: 3, g: 2.2, b: 1.2, r1: 1.2, g1: 0.12, b1: 0.02 }, fl: { r: 2.2, g: 0.6, b: 0.08, r1: 0.8, g1: 0.05, b1: 0.01 }, ink: a => [0.03, 0.006, 0.004, a] },
  blue: { ring: [0.2, 1.3, 1.8], aura: [0.1, 0.55, 0.8], auraS: [0.01, 0.06, 0.09], flash: [0.8, 0.95, 1], flashW: [0.15, 0.55, 0.8], flashAmt: 0.9, waveInk: [0.004, 0.011, 0.014, 0.6],
    sp: { r: 0.6, g: 2.0, b: 2.6, r1: 0.1, g1: 0.5, b1: 0.9 }, spW: { r: 2.2, g: 3, b: 3.2, r1: 0.2, g1: 0.7, b1: 1.1 }, fl: { r: 0.3, g: 1.5, b: 2.1, r1: 0.05, g1: 0.4, b1: 0.8 }, ink: a => [0.004, 0.014, 0.02, a] },
  purple: { ring: [1.5, 0.5, 2.8], aura: [0.7, 0.2, 1.3], auraS: [0.05, 0.015, 0.1], flash: [0.9, 0.82, 1], flashW: [0.5, 0.2, 0.8], flashAmt: 0.5, waveInk: [0.011, 0.006, 0.016, 0.6],
    sp: { r: 2.4, g: 1.6, b: 3, r1: 0.9, g1: 0.2, b1: 1.8 }, spW: { r: 3.2, g: 2.8, b: 3.4, r1: 1.2, g1: 0.5, b1: 2 }, fl: { r: 1.6, g: 0.5, b: 2.8, r1: 0.5, g1: 0.1, b1: 1.2 }, ink: a => [0.012, 0.005, 0.02, a] },
};

const outQuart = (t: number) => 1 - (1 - t) ** 4;
const inBack = (t: number) => 2.70158 * t * t * t - 1.70158 * t * t;
const backOut = (t: number, c = 2.6) => 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
const rr = (a: number, b: number) => a + (b - a) * Math.random();

export interface Cast {
  color: WeaponColor; age: number; grade: number;
  budget: Map<object, number>; damage: number; armorSound: number;
  landed: boolean[]; level: number;
  shakeAmp: number; shakeAt: number;
  trail: number[][][];
  carry: { spiral: number; spark: number; flame: number; wv: number; tail: number };
  burning: Map<Enemy, number>; smashed: Set<Enemy>; burst: boolean;
  struck: boolean; strikePts: [number, number][];
  inkDrops: boolean; released: boolean; releasedAt: number; waveStarted: boolean; charged: boolean;
}

export class Mantra {
  cast: Cast | null = null;
  readonly budget: MantraBudget;
  bombBlocked = false;
  degraded = false;
  private slowFrames = 0;
  constructor(readonly w: World) { this.budget = new MantraBudget(w); }

  observeFrameTime(ms: number): void { if (ms > 24) this.slowFrames++; else this.slowFrames = 0; if (this.slowFrames >= 10) this.degraded = true; }
  beginBossPhase(owner: Enemy, id: unknown, maxHp: number): void { this.budget.beginPhase(owner, id, maxHp); }
  bossBudgetState(owner: Enemy) { return this.budget.state(owner); }
  isHandsOn(owner: Enemy): boolean { const phase = this.budget.phase(owner); phase.handsOn = owner.hp <= phase.maxHp * 0.15 + 1e-6; return phase.handsOn; }
  setBombBlocked(blocked: boolean): void { this.bombBlocked = blocked; }
  resetRun(): void { this.clear(); this.budget.resetRun(); this.bombBlocked = false; }

  damage(e: Enemy, amount: number): number { return this.budget.damage(this.cast, e, amount); }

  private get th(): Theme { return THEMES[this.cast?.color ?? 'red']; }

  /** 本色的叶、花瓣（朱）、水珠与青色碎光（青）、电火花与紫色碎光（紫）。 */
  private waveFx(x: number, y: number): void {
    const col = this.cast!.color, R = Math.random;
    if (col === 'red') {
      if (R() < 0.02) {
        this.em({ x, y, vx: (R() - 0.5) * 300, vy: -700 - R() * 500, drag: 1.6, life: 1.4, size: 20, spin: 3, rot: R() * 6, r: 1.5, g: 0.95, b: 0.2, a: 1, kind: PK.Blade });
        this.em({ x, y, vx: (R() - 0.5) * 200, vy: -300 - R() * 400, drag: 1.2, grav: 60, life: 1.8, size: 24, spin: 3, rot: R() * 6, r: 0.8, g: 0.06, b: 0.04, a: 1, kind: PK.PetalFlip });
      }
    } else if (col === 'blue') {
      if (R() < 0.05) this.em({ x, y, vx: (R() - 0.5) * 260, vy: -500 - R() * 500, drag: 1.4, grav: 200, life: 1.3, size: 10, sizeEnd: 16, r: 0.5, g: 1.6, b: 2.2, a: 0.9, kind: PK.Ring });
      if (R() < 0.03) this.em({ x, y, vx: (R() - 0.5) * 300, vy: -650 - R() * 450, drag: 1.5, life: 1.4, size: 18, spin: 3, rot: R() * 6, r: 0.25, g: 1.1, b: 1.5, a: 1, kind: PK.Blade });
    } else {
      if (R() < 0.12) this.em({ x, y, vx: (R() - 0.5) * 500, vy: -500 - R() * 600, drag: 2, life: 0.5, size: 4, r: 2.6, g: 1.6, b: 3.2, r1: 0.9, g1: 0.2, b1: 1.8, kind: PK.Spark });
      if (R() < 0.03) this.em({ x, y, vx: (R() - 0.5) * 300, vy: -650 - R() * 450, drag: 1.5, life: 1.4, size: 18, spin: 3, rot: R() * 6, r: 1.1, g: 0.35, b: 1.9, a: 1, kind: PK.Blade });
    }
  }

  /** 演出对世界时间的倍率：起手 0.15 秒缓到 30%，1.6–2.0 秒恢复。 */
  get timeScale(): number {
    const c = this.cast;
    if (!c) return 1;
    const T = c.age;
    if (T < 0.15) return 1 - 0.7 * Ease.outCubic(T / 0.15);
    if (T < 1.6) return 0.3;
    if (T < 2.0) return 0.3 + 0.7 * Ease.inOutSine((T - 1.6) / 0.4);
    return 1;
  }

  /** 粒子按真实时间设计，换算成世界时间下的参数，使慢放期间看上去仍按真实速度运动。 */
  private em(p: ParticleSpec): void {
    if (this.degraded && Math.random() < 0.5) return;
    const k = Math.max(0.1, this.timeScale);
    p.vx = (p.vx ?? 0) / k; p.vy = (p.vy ?? 0) / k;
    p.life *= k; p.drag = (p.drag ?? 0) / k; p.grav = (p.grav ?? 0) / (k * k); p.spin = (p.spin ?? 0) / k;
    this.w.fx.emit(p);
  }

  clear(): void {
    this.cast = null;
    const r = this.w.r;
    if (!r.spell) return;
    r.spell.clear();
    r.mantraZoom = 1; r.mantraInk = 0; r.mantraDim = 1; r.mantraShake = [0, 0]; r.fluidReal = false; 
  }

  start(): void {
    const w = this.w, p = w.player;
    if (this.cast) this.clear();
    this.degraded = false; this.slowFrames = 0;
    w.r.spell.refreshBrushMasks();
    this.cast = {
      color: p.weapon, age: 0, grade: w.inkScore.levels[p.weapon], budget: new Map(), damage: 0, armorSound: -1,
      landed: [false, false, false, false, false], level: 0, shakeAmp: 0, shakeAt: -9,
      trail: [[], [], [], [], []], carry: { spiral: 0, spark: 0, flame: 0, wv: 0, tail: 0 }, burning: new Map(), smashed: new Set(), burst: false,
      struck: false, strikePts: [],
      inkDrops: false, released: false, releasedAt: 0, waveStarted: false, charged: false,
    };
    w.r.spell.theme = p.weapon === 'blue' ? 1 : p.weapon === 'purple' ? 2 : 0;
    w.audio.sfx(p.weapon === 'blue' ? 'bomb_blue' : p.weapon === 'purple' ? 'bomb_purple' : 'bomb_red'); w.audio.sfx('mantra_start');
    // 起手：身边一圈本色墨环
    const x = p.x, y = p.y;
    this.em({ x, y, life: 0.3, size: 20, sizeEnd: 190, r: this.th.ring[0], g: this.th.ring[1], b: this.th.ring[2], a: 0.9, kind: PK.Ring });
    w.r.fluid.splat({ x, y, r: 95, radial: true, vx: 420, ink: this.th.ink(0.4) });
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2 + rr(-0.1, 0.1), sp = rr(260, 520);
      this.em({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, life: 0.45, size: rr(4, 9), sizeEnd: 2, r: 0.03, g: 0.01, b: 0.008, a: 0.9, kind: PK.Ink });
    }
  }

  /** 字组锚点：以飞机为中心，贴边时整体收进画面。 */
  private anchor(): [number, number] {
    const p = this.w.player;
    return [clamp(p.x, 270, PLAY_W - 270), Math.max(420, p.y)];
  }
  private glyphPos(i: number): [number, number] {
    const [ax, ay] = this.anchor();
    if (i === 4) return [ax, ay - 310];
    const a = deg(-60 + 40 * i);
    return [ax + Math.sin(a) * 210, ay - Math.cos(a) * 210];
  }
  private birdBase(): [number, number] {
    const p = this.w.player;
    return [clamp(p.x, WING_SPAN / 2 + 15, PLAY_W - WING_SPAN / 2 - 15), Math.max(330, p.y - 220)];
  }
  private birdPose(T: number): BirdPose {
    const [bx, by] = this.birdBase();
    const u = clamp((T - CHARGE) / (RELEASE - CHARGE), 0, 1), eb = inBack(u);
    const tau = clamp((T - RELEASE) / RELEASE_DUR, 0, 1);
    const build = smoothstep(1.12, 1.38, T);
    const rel = T >= RELEASE;
    return {
      cx: bx, cy: by + 55 * eb - (rel ? (by + 450) * tau * tau : 0),
      sx: (1 - 0.14 * eb) * (1 + 0.85 * Ease.outQuad(tau)), sy: (1 - 0.14 * eb) * (1 + 0.3 * tau), tail: 1 + 1.5 * Ease.outQuad(tau),
      build, flap: rel ? -0.28 * tau : Math.sin(T * 15) * 0.1 * build, time: T, alpha: 1 - smoothstep(RELEASE + 0.3, RELEASE + 0.65, T),
    };
  }
  /** 朱雀：贴图翼、身、飘落火羽。翼根在肩，振翅绕肩转动。 */
  private drawPhoenix(sp: SpellLayer['sprites'], pose: BirdPose): void {
    const T = pose.time;
    const a = pose.alpha * smoothstep(1.05, 1.12, T);
    if (a < 0.01) return;
    // 前冲：身后拖火尾残影（越早的姿态越淡）
    if (T >= RELEASE) for (let g = 4; g >= 1; g--) {
      const pg = this.birdPose(Math.max(RELEASE - 0.001, T - g * 0.028));
      this.phoenixLayer(sp, pg, a * (0.5 - g * 0.09), true);
    }
    this.phoenixLayer(sp, pose, a, false);
    // 飘落火羽
    if (T >= 1.35) for (let k = 0; k < 16; k++) {
      const t0 = 1.35 + k * 0.045, age = T - t0;
      if (age < 0 || age > 1.1) continue;
      const side = k % 2 ? 1 : -1, off = 70 + ((k * 53) % 230);
      sp.add({ tex: 'zhu-feathers', cell: k % 4, x: pose.cx + side * off * (1 + age * .35), y: pose.cy - 30 + age * (90 + (k * 17) % 100) * (T >= RELEASE ? 2.2 : 1), w: 74, h: 74, rot: side * age * (1.5 + k % 3), alpha: a * (1 - age / 1.1) * .9, glow: .15, wob: .02, seed: k });
    }
  }
  /** 一个姿态下的朱雀（身、翼）。字化形：贴图沿笔画方向逐段显现；展翅：两翼 0.3 秒从收拢转到张开，外层火羽晚一拍；前冲前缩身蓄力。 */
  private phoenixLayer(sp: SpellLayer['sprites'], pose: BirdPose, a: number, ghost: boolean): void {
    const T = pose.time;
    const rev = ghost ? 1 : smoothstep(1.08, 1.4, T);
    const gr = 0.72 + 0.28 * pose.build;
    const open = (t: number) => { const u = smoothstep(1.12, 1.45, t); return 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2); };
    const oIn = ghost ? 1 : open(T), oOut = ghost ? 1 : open(T - 0.09);
    const lean = ghost ? 1 : 1 - 0.09 * (1 - smoothstep(BURST, 1.5, T));
    const sx = pose.sx * gr, sy = pose.sy * gr * lean;
    const wob = 0.010 + 0.01 * (T >= RELEASE ? 1 : 0);
    const cx = pose.cx, cy = pose.cy;
    const bh = 700, bw = 467, bhh = bh * sy * (pose.tail ?? 1) ** .5;
    sp.add({ tex: 'zhu-body', x: cx, y: cy - 38 * sy, w: bw * sx, h: bhh, ax: .5, ay: .22, alpha: a * .92, wob, reveal: rev, revMode: 2 });
    if (!ghost) sp.add({ tex: 'zhu-body', x: cx, y: cy - 38 * sy, w: bw * sx, h: bhh, ax: .5, ay: .22, alpha: a * .95, wob, clip: .3, top: true, reveal: rev, revMode: 2 });
    const fl = ghost ? 0 : pose.flap, ww = 450 * sx, wh = 450 * sy;
    for (const [side, flip] of [[-1, false], [1, true]] as [number, boolean][]) {
      const wi = 1.3 - 1.2 * oIn - fl, wo = 1.3 - 1.2 * oOut - fl;
      const base = { tex: 'zhu-wing-l' as const, x: cx + side * 28 * sx, y: cy - 20 * sy, w: ww, h: wh, ax: .97, ay: .5, flip, wob, reveal: rev, revMode: 1 as const, seed: side };
      const ang = (r: number) => (flip ? -r : r);
      sp.add({ ...base, rot: ang(wi), alpha: a * .92, xwin: [0.42, 1.3] });
      sp.add({ ...base, rot: ang(wo), alpha: a * .92, xwin: [-0.3, 0.58] });
    }
  }
  /** 青龙：贴图龙身盘绕飞机，蓄力收紧；释放后随激流冲上屏幕。 */
  /** 龙头在 t 时刻的位置：从字心炸出，绕圈（顺时针，从左侧起、回到左侧）游一整圈，再沿正上方猛冲。 */
  private dragonHead(t: number, cx: number, cy: number): [number, number] {
    const R = DRAGON_R;
    if (t <= BURST) return [cx, cy];
    if (t <= RELEASE) {
      const u = (t - BURST) / (RELEASE - BURST), th = -Math.PI + 2 * Math.PI * u, r = R * smoothstep(0, 0.28, u);
      return [cx + Math.cos(th) * r, cy + Math.sin(th) * r];
    }
    const d = t - RELEASE;
    return [cx - R, cy - 2600 * d - 0.5 * 16000 * d * d];
  }
  /** 龙身脊线：沿龙头走过的轨迹按等弧长取点（头在前），叠加越近尾越大的横向摆动。 */
  private dragonSpine(fp: FormPose): { pts: [number, number][]; nx: number[]; ny: number[]; head: [number, number]; ang: number } {
    const T = fp.T, H = 0.003, N = 28, L = DRAGON_LEN;
    const hist: [number, number][] = [this.dragonHead(T, fp.cx, fp.cy)];
    const arc: number[] = [0];
    for (let t = T - H; arc[arc.length - 1] < L && t > BURST - 0.05; t -= H) {
      const q = this.dragonHead(t, fp.cx, fp.cy), pr = hist[hist.length - 1];
      hist.push(q); arc.push(arc[arc.length - 1] + Math.hypot(q[0] - pr[0], q[1] - pr[1]));
    }
    const total = Math.min(L, arc[arc.length - 1]);
    const pts: [number, number][] = [], nx: number[] = [], ny: number[] = [];
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = total * i / (N - 1);
      while (j < arc.length - 2 && arc[j + 1] < s) j++;
      const seg = arc[j + 1] - arc[j] || 1, f = clamp((s - arc[j]) / seg, 0, 1), p0 = hist[j], p1 = hist[Math.min(j + 1, hist.length - 1)];
      pts.push([p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f]);
    }
    for (let i = 0; i < N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      nx.push(-dy / l); ny.push(dx / l);
    }
    // 摆动：越近尾越大；释放后身体拉直，摆幅收小
    const calm = 1 - 0.75 * smoothstep(0, 0.3, T - RELEASE);
    for (let i = 1; i < N; i++) {
      const f = i / (N - 1), s = total * f, off = Math.sin(s * 0.016 - T * 9) * (4 + 40 * f * f) * calm;
      pts[i][0] += nx[i] * off; pts[i][1] += ny[i] * off;
    }
    const h = pts[0], q = this.dragonHead(T - 0.012, fp.cx, fp.cy);
    const ang = Math.atan2(h[1] - q[1], h[0] - q[0]);
    return { pts, nx, ny, head: h, ang: Math.hypot(h[0] - q[0], h[1] - q[1]) < 0.01 ? -Math.PI / 2 : ang };
  }
  private drawDragonSprite(sp: SpellLayer['sprites'], fp: FormPose): void {
    const T = fp.T, a = fp.alpha * smoothstep(BURST - 0.02, BURST + 0.03, T);
    if (a < 0.01) return;
    const sp2 = this.dragonSpine(fp), N = sp2.pts.length;
    const grow = 1 + 0.35 * outQuart(Math.min(1, fp.tau));
    const data = new Float32Array(N * 10);
    let s = 0;
    for (let i = 0; i < N; i++) {
      if (i) s += Math.hypot(sp2.pts[i][0] - sp2.pts[i - 1][0], sp2.pts[i][1] - sp2.pts[i - 1][1]);
      const f = i / (N - 1), half = 150 * grow * (1 - 0.7 * Math.pow(f, 1.1)) / 0.8 / 2;
      const u = (s - T * 260) / (half * 2 * 0.8 * 4) * 1.0;
      const al = a * (1 - smoothstep(0.82, 1, f) * 0.85);
      for (let side = 0; side < 2; side++) {
        const o = i * 10 + side * 5, k = side ? 1 : -1;
        data[o] = sp2.pts[i][0] + sp2.nx[i] * half * k; data[o + 1] = sp2.pts[i][1] + sp2.ny[i] * half * k;
        data[o + 2] = u; data[o + 3] = side; data[o + 4] = al;
      }
    }
    sp.addStrip({ tex: 'blue-strip', data, count: N, glow: 0.05, top: true });
    const hs = 450 * (1 + 0.45 * outQuart(Math.min(1, fp.tau)) + 0.12 * Math.max(0, Math.sin((T - RELEASE) * 22)) * (T > RELEASE && T < RELEASE + 0.3 ? 1 : 0));
    sp.add({ tex: 'blue-head', x: sp2.head[0], y: sp2.head[1], w: hs, h: hs, ax: 0.04, ay: 0.45, rot: sp2.ang, alpha: a, wob: 0.01, glow: 0.12, top: true });
    if (T >= RELEASE) sp.add({ tex: 'blue-wall', x: PLAY_W / 2, y: fp.cy - (fp.cy + 560) * fp.tau ** 2 - 40 + 90, w: PLAY_W * 1.1, h: 250, alpha: 0.95 * (1 - smoothstep(1.95, 2.4, T)), scroll: -T * 0.25, wob: 0.02 });
  }
  /** 紫：墨紫太极与八个卦位，随圈涨大。 */
  private drawGuaSprites(sp: SpellLayer['sprites'], fp: FormPose): void {
    const T = fp.T;
    if (fp.alpha < 0.01) return;
    const tj = 85 * smoothstep(1.15, 1.4, T) * (1 + 0.7 * outQuart(fp.tau));
    if (tj > 1) sp.add({ tex: 'purple-taiji', x: fp.cx, y: fp.cy, w: tj * 3.4, h: tj * 3.4, rot: T * 1.6, alpha: fp.alpha, wob: 0.006 });
    const sc = Math.sqrt(fp.R / 185);
    for (let k = 0; k < 8; k++) {
      const a = fp.alpha * smoothstep(0.95 + 0.035 * k, 1.15 + 0.035 * k, T);
      if (a < 0.01) continue;
      const [x, y] = guaPos(fp, k);
      sp.add({ tex: 'purple-gua', cell: k, x, y, w: 190 * sc, h: 190 * sc, rot: (fp.rot ?? 0) + k * Math.PI / 4, alpha: a, wob: 0.006 });
    }
  }
  private formCenter(): [number, number] {
    const p = this.w.player;
    return [clamp(p.x, 240, PLAY_W - 240), clamp(p.y, 300, PLAY_H - 240)];
  }
  /** 青龙与八卦圈的姿态：盘绕飞机、蓄力收缩、释放时拉起（青）或涨满全屏（紫）。 */
  private formPose(T: number): FormPose {
    const [bx, by] = this.formCenter();
    const u = clamp((T - CHARGE) / (RELEASE - CHARGE), 0, 1), eb = inBack(u);
    const tau = clamp((T - RELEASE) / RELEASE_DUR, 0, 1), e = outQuart(tau);
    if (this.cast?.color === 'purple') {
      const Rc = 185 * (1 - 0.4 * eb);
      return { cx: bx + (PLAY_W / 2 - bx) * e, cy: by + (600 - by) * e, R: Rc + (330 - Rc) * e, T, tau, alpha: 1 - smoothstep(2.0, 2.3, T), rot: (T - 0.95) * 1.5 + tau * 2 };
    }
    return { cx: bx, cy: by, R: 175 * (1 - 0.45 * eb), T, tau, alpha: 1 - smoothstep(RELEASE + 0.35, RELEASE + 0.6, T) };
  }
  /** 第 i 个字结印时飞向的目标点。 */
  private target(i: number, T: number): [number, number] {
    const col = this.cast!.color;
    if (col === 'red') { const pose = this.birdPose(T); return birdPoint(pose, BIRD_TARGETS[i][0], BIRD_TARGETS[i][1]); }
    const fp = this.formPose(T);
    if (i === 4) return [fp.cx, fp.cy];
    return col === 'blue' ? [fp.cx, fp.cy] : guaPos(fp, [0, 2, 4, 6][i]);
  }

  /** 第 i 个字此刻的位置与速度方向（结印飞行中使用贝塞尔曲线）。 */
  private glyphNow(i: number, T: number): { x: number; y: number; dx: number; dy: number; fly: number } {
    const [gx, gy] = this.glyphPos(i);
    if (T < FLY0[i]) return { x: gx, y: gy, dx: 0, dy: -1, fly: 0 };
    const u = clamp((T - FLY0[i]) / FLY[i], 0, 1), e = Ease.inOutCubic(u);
    const [tx, ty] = this.target(i, T);
    const side = i % 2 ? -1 : 1;
    const mx = (gx + tx) / 2, my = (gy + ty) / 2;
    const nx = -(ty - gy), ny = tx - gx, nl = Math.hypot(nx, ny) || 1;
    const k = i === 4 ? 0 : 130 * side;
    const cx = mx + nx / nl * k, cy = my + ny / nl * k;
    const bez = (t: number, a: number, b: number, c: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
    const x = bez(e, gx, cx, tx), y = bez(e, gy, cy, ty);
    const e2 = Math.min(1, e + 0.02);
    let dx = bez(e2, gx, cx, tx) - x, dy = bez(e2, gy, cy, ty) - y;
    const dl = Math.hypot(dx, dy);
    if (dl < 1e-4) { dx = 0; dy = -1; } else { dx /= dl; dy /= dl; }
    return { x, y, dx, dy, fly: u };
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const c = this.cast, w = this.w;
    if (!c) return;
    if (!w.player.alive) { this.clear(); w.player.bombT = 0; return; }
    const p = w.player;
    // 红、青的化形阶段（1.0 到 1.45 秒）放慢，字炸散汇成轮廓的过程多出约 0.35 秒
    c.age += dt * (c.color === 'blue' && c.age >= BURST && c.age < RELEASE ? 0.22 : c.color !== 'purple' && c.age >= 1.0 && c.age < RELEASE ? 0.56 : 1);
    const T = c.age;
    p.bombT = Math.max(0, TOTAL - T);
    this.wave(dt);
    this.sweepHits(c, T);

    // 字落定
    for (let i = 0; i < 5; i++) if (!c.landed[i] && T >= LAND[i]) { c.landed[i] = true; c.level = i + 1; this.land(c, i); }
    // 结印：字尾拖火焰丝带的轨迹
    for (let i = 0; i < 5; i++) {
      if (T >= FLY0[i] && T < FLY0[i] + FLY[i] + 0.05) {
        const g = this.glyphNow(i, T), tr = c.trail[i];
        tr.push([g.x, g.y]); if (tr.length > 14) tr.shift();
      } else if (c.trail[i].length) c.trail[i].shift();
    }
    // 蓄力：顿帧与重震
    // 神兽从字里炸出：闪光、震屏、顿帧，字的碎屑向外迸开
    if (!c.burst && c.color !== 'purple' && T >= BURST) { c.burst = true; this.emerge(c); }
    if (!c.charged && T >= CHARGE) { c.charged = true; w.hitstop(0.08); c.shakeAmp = 14; c.shakeAt = T; }
    if (!c.released && T >= RELEASE) { c.released = true; c.releasedAt = T; this.release(c); }
    else if (c.released && T < RELEASE + 0.12) w.fx.flashAmt = Math.min(w.fx.flashAmt, 0.3); // 暖白只闪一帧
    if (!c.waveStarted && T >= WAVE0) {
      c.waveStarted = true;
      w.fx.flash(0.18, this.th.flashW); w.fx.shake(0.6); w.fx.aberration(0.8);
      w.fx.shockwave(p.x, p.y, 900, 22, 1.1);
      w.clearBullets(true);
    }
    if (c.color === 'purple' && !c.struck && T >= STRIKE) { c.struck = true; this.strike(c); }
    if (!c.inkDrops && T >= 0.7) { c.inkDrops = true; this.strokeDrops(); }
    this.emitContinuous(c, dt, T);
    if (T >= TOTAL) { p.bombT = 0; this.clear(); }
  }

  /** 紫：八个卦位与正中各劈下一道粗雷，亮闪、震屏、落点迸电火花。 */
  private strike(c: Cast): void {
    const w = this.w, fp = this.formPose(STRIKE);
    c.strikePts = [...Array.from({ length: 8 }, (_, k) => guaPos(fp, k)), [fp.cx, fp.cy]] as [number, number][];
    c.strikePts = c.strikePts.map(([x, y]) => [clamp(x, 70, PLAY_W - 70), clamp(y, 150, PLAY_H - 150)] as [number, number]);
    w.fx.flash(0.3, [0.8, 0.65, 1]); w.fx.aberration(0.9); w.hitstop(0.05);
    c.shakeAmp = 16; c.shakeAt = c.age;
    w.audio.sfx('explode_m');
    for (const [x, y] of c.strikePts) {
      this.em({ x, y, life: 0.35, size: 20, sizeEnd: 170, r: 1.8, g: 0.7, b: 3, a: 0.9, kind: PK.Ring });
      w.r.fluid.splat({ x, y, r: 70, radial: true, vx: 360, ink: this.th.ink(0.7) });
      for (let k = 0; k < 14; k++) { const a = rr(0, Math.PI * 2), sp = rr(200, 520); this.em({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, life: rr(0.25, 0.5), size: 3.5, ...this.th.spW, kind: PK.Spark }); }
    }
  }

  private land(c: Cast, i: number): void {
    const w = this.w, p = w.player;
    const [gx, gy] = this.glyphPos(i);
    c.shakeAmp = SHAKE[i]; c.shakeAt = c.age;
    if (i === 4) w.hitstop(0.06);
    w.audio.sfx('mantra_hit'); if (i === 4) w.audio.sfx('mantra_finale');
    // 字脚溅墨
    w.r.fluid.splat({ x: gx, y: gy + 28, r: 38 + i * 4, radial: true, vx: 280, ink: this.th.ink(0.8) });
    for (let k = 0; k < 10; k++) {
      const a = Math.PI * rr(0.1, 0.9), sp = rr(120, 330);
      this.em({ x: gx + rr(-30, 30), y: gy + 30, vx: Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1), vy: -Math.sin(a) * sp * 0.6, grav: 900, drag: 1, life: 0.5, size: rr(3, 8), sizeEnd: 1.5, r: 0.03, g: 0.01, b: 0.008, a: 0.9, kind: PK.Ink });
    }
    // 飞机放出一圈本色冲击环
    this.em({ x: p.x, y: p.y, life: 0.35, size: 18, sizeEnd: 150 + i * 28, r: this.th.ring[0], g: this.th.ring[1], b: this.th.ring[2], a: 0.85, kind: PK.Ring });
    w.fx.shockwave(p.x, p.y, 160 + i * 30, 4 + i, 0.3);
    // 字落点的火花
    for (let k = 0; k < 14; k++) {
      const a = rr(0, Math.PI * 2), sp = rr(180, 420);
      this.em({ x: gx, y: gy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, drag: 3, life: rr(0.25, 0.5), size: 3, ...this.th.sp, kind: PK.Spark });
    }
  }

  private release(c: Cast): void {
    const w = this.w;
    w.fx.flash(this.th.flashAmt, this.th.flash);
    w.audio.sfx('explode_m');
    w.hitstop(0.07); w.fx.shake(0.6);
    if (c.color === 'red') {
      // 冲出时爆开：火环与四散火舌，从朱雀身上炸出
      const pp = this.birdPose(RELEASE);
      this.em({ x: pp.cx, y: pp.cy, life: 0.4, size: 40, sizeEnd: 420, r: 2.6, g: 0.9, b: 0.15, a: 0.8, kind: PK.Ring });
      for (let k = 0; k < 46; k++) { const a = rr(0, Math.PI * 2), sp = rr(180, 700); this.em({ x: pp.cx + Math.cos(a) * 40, y: pp.cy + Math.sin(a) * 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.4, life: rr(0.3, 0.6), size: rr(16, 34), sizeEnd: 4, r: 2.6, g: 1.6, b: 0.4, r1: 1.4, g1: 0.15, b1: 0.03, a: 0.9, kind: PK.Flame }); }
      w.fx.shake(0.5);
    }
    const list = w.enemies.filter(e => w.targetable(e)).slice(0, 24);
    for (const e of list) {
      c.burning.set(e, c.age + 1.3);
      for (let k = 0; k < 10; k++) this.em({ x: e.x + rr(-e.radius, e.radius), y: e.y + rr(-e.radius, e.radius), vx: rr(-60, 60), vy: rr(-180, -60), drag: 1.5, life: 0.5, size: rr(14, 26), sizeEnd: 4, a: 0.8, ...this.th.fl, kind: PK.Flame });
    }
  }

  /** 神兽碰到敌机：当场结算一次伤害，在敌机身上炸开并点燃。 */
  private smash(c: Cast, e: Enemy, dmg: number): void {
    if (c.smashed.has(e)) return;
    c.smashed.add(e);
    this.damage(e, dmg);
    c.burning.set(e, c.age + 1.3);
    this.em({ x: e.x, y: e.y, life: 0.3, size: e.radius * 0.8, sizeEnd: e.radius * 3.2, a: 0.8, ...this.th.fl, kind: PK.Ring });
    for (let k = 0; k < 16; k++) { const a = rr(0, Math.PI * 2), sp = rr(120, 420); this.em({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.5, life: rr(0.25, 0.5), size: rr(10, 22), sizeEnd: 3, a: 0.85, ...this.th.fl, kind: PK.Flame }); }
    this.w.audio.sfx('explode_s');
  }
  /** 朱雀扫过的敌机、青龙身子盘到与龙头撞到的敌机，在碰到的那一刻受伤。 */
  private sweepHits(c: Cast, T: number): void {
    const w = this.w;
    if (c.color === 'red' && T >= RELEASE && T < RELEASE + 0.5) {
      const b = this.birdPose(T), half = 330 * b.sx;
      for (const e of w.enemies) if (w.targetable(e) && Math.abs(e.x - b.cx) < half && e.y > b.cy - 160) this.smash(c, e, 260);
    } else if (c.color === 'blue' && T >= BURST && T < RELEASE + 0.5) {
      const sp = this.dragonSpine(this.formPose(T));
      const [hx, hy] = sp.head, k = 1 + 0.35 * Math.min(1, (T - RELEASE) / RELEASE_DUR);
      for (const e of w.enemies) {
        if (!w.targetable(e)) continue;
        if (T >= RELEASE) { if (Math.abs(e.x - hx) < 240 && e.y > hy - 120) this.smash(c, e, 260); }
        else if (Math.hypot(hx - e.x, hy - e.y) < 160 + e.radius) this.smash(c, e, 260);
        else if (sp.pts.some(([x, y]) => Math.hypot(x - e.x, y - e.y) < 70 * k + e.radius)) this.smash(c, e, 150);
      }
    }
  }

  private emerge(c: Cast): void {
    const w = this.w;
    const [x, y] = c.color === 'red' ? (() => { const b = this.birdPose(BURST); return [b.cx, b.cy - 40]; })() : (() => { const f = this.formPose(BURST); return [f.cx, f.cy]; })();
    w.fx.flash(0.5, this.th.flash); w.fx.shake(0.45); w.hitstop(0.06); w.fx.aberration(0.5);
    this.em({ x, y, life: 0.45, size: 60, sizeEnd: 520, a: 0.9, ...this.th.fl, kind: PK.Ring });
    for (let k = 0; k < 60; k++) { const a = rr(0, Math.PI * 2), sp = rr(250, 900); this.em({ x: x + Math.cos(a) * 60, y: y + Math.sin(a) * 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.2, life: rr(0.3, 0.7), size: rr(14, 34), sizeEnd: 4, a: 0.9, ...this.th.sp, kind: k % 3 ? PK.Flame : PK.Spark }); }
    w.audio.sfx('explode_m');
  }

  private strokeDrops(): void {
    for (let i = 0; i < 34; i++) {
      this.em({ x: rr(20, PLAY_W - 20), y: STROKE.cy + rr(-70, 70), vx: rr(-40, 40), vy: rr(-30, 60), grav: 1800, life: 0.38, size: rr(4, 11), sizeEnd: 2, r: 0.02, g: 0.012, b: 0.01, a: 0.95, kind: PK.Ink });
    }
  }

  /** 每帧持续发射：螺旋吸入、光晕、字上火星、朱雀火星、火墙与着火敌机。 */
  private emitContinuous(c: Cast, dt: number, T: number): void {
    const p = this.w.player;
    // 能量光晕随字数升档
    if (T < RELEASE) {
      const lv = c.level, e = 1 + 0.25 * Math.sin(T * 30);
      const pulse = T >= CHARGE ? 1 + 5 * (T - CHARGE) : 1;
      const k = 0.45 + 0.1 * lv;
      this.em({ x: p.x, y: p.y, life: 0.05, size: AURA[lv] * e * pulse * 1.5, r: this.th.auraS[0], g: this.th.auraS[1], b: this.th.auraS[2], a: 0.5, kind: PK.Ink });
      this.em({ x: p.x, y: p.y, life: 0.05, size: AURA[lv] * e * pulse, r: this.th.aura[0] * k, g: this.th.aura[1] * k, b: this.th.aura[2] * k, a: 0.22, kind: PK.Dot });
    }
    // 螺旋吸入
    if (T >= 0.08 && T < CHARGE) {
      c.carry.spiral += SPIRAL_RATE[c.level] * dt;
      while (c.carry.spiral >= 1) {
        c.carry.spiral--;
        const arm = Math.floor(Math.random() * 5), R = 70 + 650 * Math.random() ** 1.6;
        const th = arm * Math.PI * 2 / 5 + 1.4 * Math.log(R / 60) - T * 6.5;
        const x = p.x + Math.cos(th) * R, y = p.y + Math.sin(th) * R;
        if (x < -20 || x > PLAY_W + 20 || y < -20 || y > PLAY_H + 20) continue;
        const vin = R * 0.6, white = Math.random() < 0.25;
        this.em({ x, y, vx: vin * (-Math.cos(th) + 1.1 * Math.sin(th)), vy: vin * (-Math.sin(th) - 1.1 * Math.cos(th)), life: 0.3, size: rr(4, 8), ...(white ? this.th.spW : this.th.sp), a: 0.9, kind: PK.Spark });
      }
    }
    // 字上沿冒火星
    if (T < FLY0[0] + 0.1) {
      c.carry.spark += 46 * dt * c.level;
      while (c.carry.spark >= 1) {
        c.carry.spark--;
        const i = Math.floor(Math.random() * c.level);
        if (!c.landed[i]) continue;
        const [gx, gy] = this.glyphPos(i), s = i === 4 ? GLYPH_LAST : GLYPH;
        this.em({ x: gx + rr(-0.4, 0.4) * s, y: gy - s * 0.35 + rr(-0.15, 0.15) * s, vx: rr(-30, 30), vy: rr(-260, -130), drag: 0.8, life: rr(0.4, 0.7), size: rr(2.5, 4.5), ...this.th.sp, kind: PK.Ember });
      }
    }
    // 朱雀的火星
    if (c.color === 'red' && T >= 1.2 && T < 1.9) {
      const pose = this.birdPose(T);
      c.carry.flame += 600 * dt;
      while (c.carry.flame >= 1) {
        c.carry.flame--;
        const k = Math.random() < 0.5 ? -1 : 1, wing = Math.random() < 0.7;
        const [lx, ly] = wing ? wingTip(k, pose.flap, T) : [rr(-20, 20), rr(40, 280)];
        const [x, y] = birdPoint(pose, wing ? lx * rr(0.5, 1) : lx, wing ? ly * rr(0.6, 1) : ly);
        this.em({ x, y, vx: rr(-50, 50), vy: rr(-40, 90), drag: 1.5, life: rr(0.25, 0.5), size: rr(14, 26), sizeEnd: 3, a: 0.7, ...this.th.fl, kind: PK.Flame });
        if (Math.random() < 0.3) this.em({ x, y: y - 10, vx: rr(-30, 30), vy: rr(-120, -50), drag: 0.8, life: rr(0.5, 0.8), size: rr(14, 22), sizeEnd: rr(30, 46), r: 0.03, g: 0.02, b: 0.02, a: 0.5, kind: PK.Ink });
      }
    }
    // 朱雀尾：边缘冒火星，尾端散成黑烟
    if (c.color === 'red' && T >= 1.3 && T < RELEASE + 0.7) {
      const pose = this.birdPose(T);
      c.carry.tail += 260 * dt;
      while (c.carry.tail >= 1) {
        c.carry.tail--;
        const s2 = rr(0.2, 1), [x, y] = tailPoint(pose, Math.floor(Math.random() * 3), s2);
        if (s2 < 0.85) this.em({ x: x + rr(-10, 10), y, vx: rr(-60, 60), vy: rr(-60, 40), drag: 2, life: rr(0.25, 0.5), size: 3.5, ...this.th.sp, kind: PK.Spark });
        else this.em({ x, y, vx: rr(-30, 30), vy: rr(20, 90), drag: 1, life: rr(0.5, 0.8), size: rr(16, 24), sizeEnd: rr(36, 52), r: 0.03, g: 0.02, b: 0.02, a: 0.45, kind: PK.Ink });
      }
    }
    // 青龙与八卦圈的火花（水光碎沫、电火花）
    if (c.color !== 'red' && T >= 1.0 && T < 2.1) {
      const fp = this.formPose(T);
      c.carry.flame += (c.color === 'blue' ? 520 : 380) * dt;
      while (c.carry.flame >= 1) {
        c.carry.flame--;
        let x: number, y: number;
        if (c.color === 'blue') { const sps = this.dragonSpine(fp).pts; [x, y] = T < BURST ? [fp.cx + rr(-40, 40), fp.cy + rr(-40, 40)] : sps[Math.floor(Math.random() * sps.length)]; }
        else { const k = Math.floor(Math.random() * 8); [x, y] = guaPos(fp, k, rr(-0.2, 0.2) * fp.R); }
        const ve = c.color === 'blue' ? 60 : 160;
        this.em({ x: x + rr(-8, 8), y: y + rr(-8, 8), vx: rr(-ve, ve), vy: rr(-ve, ve * 0.4), drag: 2, life: rr(0.2, 0.45), size: c.color === 'blue' ? rr(3, 6) : 3.5, ...(Math.random() < 0.3 ? this.th.spW : this.th.sp), kind: PK.Spark });
      }
    }
    // 火墙（青为激流飞沫）：沿朱雀 / 青龙途经之处升起
    if (c.color !== 'purple' && T >= RELEASE && T < RELEASE + 0.6) {
      const pose = this.birdPose(Math.min(T, RELEASE + RELEASE_DUR));
      const n = Math.round(12 * Math.min(1, dt * 60));
      for (let k = 0; k < n; k++) {
        const y = pose.cy + rr(-10, Math.max(40, this.birdBase()[1] - pose.cy + 40));
        this.em({ x: rr(0, PLAY_W), y, vx: rr(-30, 30), vy: rr(-200, -80), drag: 1, life: rr(0.3, 0.55), size: rr(16, 30), sizeEnd: 5, a: 0.4, ...this.th.fl, kind: PK.Flame });
      }
    }
    // 着火的敌机
    for (const [e, until] of c.burning) {
      if (e.dead || T > until) { c.burning.delete(e); continue; }
      this.em({ x: e.x + rr(-e.radius, e.radius) * 0.7, y: e.y + rr(-e.radius, e.radius * 0.3), vx: rr(-20, 20), vy: rr(-140, -60), drag: 1, life: 0.4, size: rr(12, 22), sizeEnd: 3, a: 0.7, ...this.th.fl, kind: PK.Flame });
    }
  }

  /** 全屏墨浪：原样移植 V1/V2 player.updateBomb（main/v2 相同）。u 按 2.6 秒基准，从释放（1.45s）起算；
   *  墨浪自下而上扫 55% 行程，前 60% 时间每帧 9 团墨流体、墨滴。叶片与花瓣改用翻转叶形，数量取 V1 的零头。 */
  private wave(dt: number): void {
    const w = this.w, c = this.cast!;
    const T = c.age, u = (T - WAVE0) / V1_DUR;
    if (T < 2.6) for (const e of w.enemies) if (w.targetable(e)) this.damage(e, (e.phaseLock ? 160 : 320) * dt);
    if (u < 0) return;
    const waveY = PLAY_H + 80 - Math.min(1, u / 0.55) * (PLAY_H + 300);
    if (u < 0.6) {
      for (let i = 0; i < 9; i++) {
        const x = (i + 0.5) * (PLAY_W / 9) + (Math.random() - 0.5) * 60;
        w.r.fluid.splat({ x, y: waveY, r: 55, vx: (Math.random() - 0.5) * 300, vy: -1100, ink: this.th.waveInk });
      }
      const n = Math.round(14 * w.fx.density * Math.min(1, dt * 60));
      for (let i = 0; i < n; i++) {
        const x = Math.random() * PLAY_W;
        this.em({ x, y: waveY + Math.random() * 60, vx: (Math.random() - 0.5) * 200, vy: -500 - Math.random() * 600, drag: 2, grav: 300, life: 1.2, size: 4 + Math.random() * 7, sizeEnd: 2, r: 0.02, g: 0.02, b: 0.02, a: 0.9, kind: PK.Ink });
        this.waveFx(x, waveY);
      }
    }
    if (Math.floor((T - dt) * 10) !== Math.floor(T * 10)) w.clearBullets(true);
  }

  draw(): void {
    const c = this.cast, r = this.w.r;
    if (!c) { r.mantraZoom = 1; r.mantraInk = 0; r.mantraDim = 1; r.mantraShake = [0, 0]; r.fluidReal = false; return; }
    const T = c.age, S = r.spell;
    r.mantraInk = 0; r.fluidReal = T >= WAVE0 - 0.1;
    // 压暗背景（只乘亮度，不去色），火焰才有深色底可以透出来
    r.mantraDim = 1 - 0.62 * smoothstep(0, 0.2, T) * (1 - smoothstep(1.9, 2.4, T));
    // 屏幕震动：落定瞬间按各字力度，随后衰减
    const since = T - c.shakeAt, amp = since < 0.4 ? c.shakeAmp * Math.exp(-since * 22) : 0;
    r.mantraShake = [Math.cos(T * 137) * amp, Math.sin(T * 173) * amp];
    r.mantraZoom = 1;
    // 墨色暗角：只压暗，保留颜色
    S.vignette = 0.7 * (T < 0.15 ? Ease.outCubic(T / 0.15) : 1) * (T > RELEASE ? 1 - clamp((T - RELEASE) / 0.5, 0, 1) : 1);
    // 立绘笔触
    if (T >= 0.05 && T < 0.9) {
      S.stroke = { head: (PLAY_W + 300) * outQuart(clamp((T - 0.05) / 0.12, 0, 1)) - 140, exit: clamp((T - 0.7) / 0.2, 0, 1), alpha: 1, slide: -20 * clamp((T - 0.05) / 0.85, 0, 1) };
    }
    // 字
    const col = c.color, pose = this.birdPose(T), lv = c.level, fp = col === 'red' ? null : this.formPose(T);
    for (let i = 0; i < 5; i++) {
      if (T < LAND[i] - DROP) continue;
      const base = i === 4 ? GLYPH_LAST : GLYPH;
      const u = clamp((T - (LAND[i] - DROP)) / DROP, 0, 1);
      let size = base * (u < 1 ? 3 + (1 - 3) * backOut(u) : 1);
      let alpha = u < 1 ? Math.min(1, u * 2.5) : 1;
      if (u >= 1) size *= 1 + 0.07 * Math.exp(-(T - LAND[i]) * 25);
      let [x, y] = this.glyphPos(i);
      let dx = 0, dy = -1, stretch = 1, spread = 0, flash = 0;
      const heat = 0.1 + 0.13 * lv + (T >= CHARGE ? 0.3 : 0);
      if (T >= FLY0[i]) {
        const g = this.glyphNow(i, T);
        x = g.x; y = g.y; dx = g.dx; dy = g.dy;
        stretch = 1 + 1.5 * Math.sin(Math.PI * g.fly);
        spread = 0.35 * Math.sin(Math.PI * g.fly) ** 2;
        if (i === 4) {
          size = base * (col === 'red' ? (pose.sx + pose.sy) / 2 : 0.9) * (1 - 0.15 * Math.sin(Math.PI * g.fly));
          if (g.fly >= 1) {
            const cu = clamp((T - CHARGE) / 0.1, 0, 1);
            flash = T < RELEASE ? cu * cu : Math.max(0, 1 - (T - RELEASE) / 0.12) * 0.9;
            alpha = col === 'red' ? (T > 1.8 ? clamp(1 - (T - 1.8) / 0.1, 0, 1) : 1)
              : col === 'blue' ? 1 - smoothstep(RELEASE, RELEASE + 0.2, T) : 1 - smoothstep(1.22, 1.4, T);
          }
        } else {
          size = base * (1 - 0.35 * g.fly);
          alpha = g.fly >= 1 ? clamp(1 - (T - FLY0[i] - FLY[i]) / 0.1, 0, 1) : 1;
        }
      }
      if (alpha > 0.01) S.addGlyph({ cell: i, x, y, size, dx, dy, stretch, alpha, heat, flash, spread });
      // 结印：字后拖火焰丝带
      const tr = c.trail[i];
      if (tr.length > 2 && T >= FLY0[i]) {
        const n = tr.length;
        for (const off of [-1, 0, 1]) {
          const pts: number[] = [], ws: number[] = [];
          tr.forEach(([px, py], k) => {
            const f = k / (n - 1);
            const wob = Math.sin(k * 0.9 + T * 25 + off * 2) * 9 * (1 - f) * off;
            pts.push(px + wob, py + wob * 0.4); ws.push((k === 0 ? 0 : 1) * (off === 0 ? 26 : 15) * f * (size / base));
          });
          if (off === 0) { const dk = col === 'blue' ? [0.004, 0.03, 0.045] : col === 'purple' ? [0.03, 0.008, 0.06] : [0.07, 0.01, 0.006]; r.ribbonMid.strip(pts, ws.map(x => x * 1.5), RS.InkArrow, dk[0], dk[1], dk[2], 0.6 * alpha); }
          r.ribbonMid.strip(pts, ws, col === 'blue' ? RS.WaterBody : col === 'purple' ? RS.SparkBolt : RS.AuraFire, 1, 1, 1, alpha);
        }
      }
    }
    if (col === 'red') {
      this.drawPhoenix(S.sprites, pose);
      // 火墙
      if (T >= RELEASE) S.wall = { head: pose.cy - 100 * pose.sy, len: 130, alpha: 1 - smoothstep(1.9, 2.4, T) };
      if (T >= RELEASE) S.sprites.add({ tex: 'zhu-wall', x: PLAY_W / 2, y: pose.cy - 100 * pose.sy + 70, w: PLAY_W, h: 220, alpha: 0.9 * (1 - smoothstep(1.9, 2.4, T)), scroll: T * 0.15, wob: 0.015 });
    } else if (col === 'blue') {
      this.drawDragonSprite(S.sprites, fp!);
      // 激流：随龙头冲上屏幕，前沿左右横扫
      if (T >= RELEASE) S.wall = { head: fp!.cy - (fp!.cy + 560) * fp!.tau ** 2 - 40, len: 210, alpha: 1 - smoothstep(1.95, 2.4, T), sweep: (T - RELEASE) * 9 };
    } else {
      this.drawGuaSprites(S.sprites, fp!);
      // 天雷
      if (c.struck) {
        const dt2 = T - STRIKE, a = dt2 < 0.28 ? 1 - Math.pow(dt2 / 0.28, 1.6) : 0;
        c.strikePts.forEach(([x, y], k) => {
          S.sprites.add({ tex: 'purple-bolt', x, y: y + 20, w: 190, h: y + 100, ax: .5, ay: 1, alpha: a, glow: .3, wob: .01, seed: k, top: true });
          drawThunder(r.ribbonMid, x, y, k + 1, T, a * .6);
        });
      }
    }
  }
}
