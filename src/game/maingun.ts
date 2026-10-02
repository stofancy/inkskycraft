import type { CannonCast } from './boss-caps';
// 主炮三色「积势 → 发作」：朱 · 浴火（朱砂符印叠满自燃成凤火）、青 · 御剑（四剑依次亮起合成巨剑直刺）、
// 紫 · 雷殛（雷印积满引天雷劈下并跳向附近敌机）。出手方式仍在 player.ts，这里只管积势、发作和实时绘制。
import { clamp } from '../core/math';
import { PK } from '../gl/particles';
import { RS, type RibbonBatch } from '../gl/ribbons';
import { PLAY_W, PLAY_H, type WeaponColor } from '../types';
import type { Enemy } from './enemy';
import type { World } from './world';
import { auraLine, auraRing } from './aura';

/** 暂定数值。发作伤害 = 平射参考 DPS 的一半 × 色系系数；Boss 部件再乘 BOSS_SCALE。 */
const RED_LAYERS = 5, RED_GATE = .1, RED_FUSE = .15, RED_FIRE_LIFE = .5;
const BLUE_STEP = .4, BLUE_THRUST = .12, BLUE_RETURN = .45;
const THUNDER_NEED = 1.2, THUNDER_WARN = .12, THUNDER_LIFE = .24;
const BURST = { red: .9, blue: 1.6, purple: 1.2 }, JUMP_SCALE = .6, BOSS_SCALE = .5;
const FIRE_R = [110, 125, 140, 155], FIRE_PASS = [2, 3, 3, 4], JUMPS = [2, 3, 4, 6];
// 与 aura.ts 的 AURA_COLORS 同值；两个模块互相引用，这里不在加载时取值。
const RED: [number, number, number] = [1.8, .32, .045], CYAN: [number, number, number] = [.4, 1.5, 1.4], VIOLET: [number, number, number] = [.75, .26, 1.7];

const rnd = (i: number, seed: number): number => { const v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return v - Math.floor(v); };
/** 折线闪电：端点固定，中间点按种子偏移。 */
function jag(x0: number, y0: number, x1: number, y1: number, n: number, amp: number, seed: number): number[] {
  const pts: number[] = [], dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (let i = 0; i <= n; i++) {
    const t = i / n, o = i && i < n ? (rnd(i, seed) - .5) * 2 * amp : 0;
    pts.push(x0 + dx * t + nx * o, y0 + dy * t + ny * o);
  }
  return pts;
}

interface RedMark { n: number; gate: number; hit: number; lastFire: number }
interface Ignite { cast?:CannonCast; e: Enemy; x: number; y: number; left: number; max: number }
interface Fire { cannon?:boolean; x: number; y: number; r: number; age: number }
interface ThunderMark { t: number; hit: number }
interface Strike { cast?:CannonCast; e: Enemy; x: number; y: number; age: number; fired: boolean; bolts: { pts: number[]; delay: number }[] }

export class MainGun {
  private t = 0;
  private red = new Map<Enemy, RedMark>();
  private ignites: Ignite[] = [];
  private fires: Fire[] = [];
  private thunder = new Map<Enemy, ThunderMark>();
  private thunderHit = new Set<Enemy>();
  private strikes: Strike[] = [];
  // 青
  private charge = 0; private lit = 0; private litAt = [-9, -9, -9, -9];
  private phase: 'orbit' | 'thrust' | 'return' = 'orbit'; private ph = 0;
  private thrust = { x: 0, y: 0, hw: 0 };
  constructor(readonly w: World) {}

  clear(): void {
    this.red.clear(); this.ignites = []; this.fires = []; this.thunder.clear(); this.thunderHit.clear(); this.strikes = [];
    this.charge = 0; this.lit = 0; this.phase = 'orbit'; this.ph = 0; this.t = 0;
  }

  /** 重炮只消费已有积势；已排队的主炮发作保留原归属。 */
  igniteCannon(cast:CannonCast):void {
    for(const [e,m] of this.red)if(m.n>0&&this.onScreen(e)&&!this.ignites.some(i=>i.e===e)){
      m.n=0;m.lastFire=this.t;this.ignites.push({cast,e,x:e.x,y:e.y,left:RED_FUSE,max:RED_FUSE});
    }
  }
  takeCannonSwords():number {if(this.phase!=='orbit')return 0;const n=this.lit;this.charge=0;this.lit=0;return n;}
  fillCannonThunder(cast:CannonCast):void {
    for(const [e,m] of this.thunder)if(m.t>0&&this.onScreen(e)&&!this.strikes.some(s=>s.e===e)){
      m.t=-.4;this.strikes.push({cast,e,x:e.x,y:e.y,age:0,fired:false,bolts:[]});
    }
  }
  private onScreen(e:Enemy):boolean{return this.w.targetable(e)&&!e.invulnerable&&e.x>=0&&e.x<=PLAY_W&&e.y>=0&&e.y<=PLAY_H;}
  cannonSwordDamage(e:Enemy):number{return this.refDps*.2*(this.w.progression.isBossPart(e)?BOSS_SCALE:1);}
  cannonControl(e:Enemy,cast:CannonCast,seconds:number):void {
    if(e.invulnerable||!this.w.bossCaps.cannonValid(e,cast))return;
    const boss=this.w.bossCaps.bossOf(e);
    if(!boss){e.interrupt(seconds);return;}
    if(!cast.interrupted.has(boss)&&boss.charging&&boss.onInterrupt&&!boss.phaseLock&&!boss.invulnerable){cast.interrupted.add(boss);boss.interrupt(.15);}
  }

  private get lv(): number { return this.w.player.power; }
  private get refDps(): number { return this.w.player.thunderDps * 1.3; }
  private scaled(e: Enemy, color: WeaponColor): number {
    return this.refDps * .5 * BURST[color] * (this.w.progression.isBossPart(e) ? BOSS_SCALE : 1);
  }

  /** 主炮实际命中一次（由 Player.primaryDamage 调用）。 */
  onHit(e: Enemy, color: WeaponColor): void {
    if (color === 'red') {
      const m = this.mark(e);
      m.hit = this.t;
      if (this.t - m.gate >= RED_GATE) { m.gate = this.t; this.stack(e, 1); }
    } else if (color === 'purple') this.thunderHit.add(e);
  }

  private mark(e: Enemy): RedMark {
    let m = this.red.get(e);
    if (!m) { m = { n: 0, gate: -9, hit: this.t, lastFire: -9 }; this.red.set(e, m); }
    return m;
  }

  private stack(e: Enemy, n: number, cast?:CannonCast): void {
    const m = this.mark(e);
    if (this.ignites.some(i => i.e === e) || this.t - m.lastFire < .8) return;
    m.n = Math.min(RED_LAYERS, m.n + n); m.hit = this.t;
    if (m.n >= RED_LAYERS) {
      m.n = 0; m.lastFire = this.t;
      this.ignites.push({ cast, e, x: e.x, y: e.y, left: RED_FUSE, max: RED_FUSE });
      this.w.audio.sfx('seal', { vol: .25, pitch: 1.3 });
    }
  }

  update(dt: number): void {
    const w = this.w, p = w.player;
    this.t += dt;
    for (const e of this.red.keys()) if (e.dead) this.red.delete(e);
    for (const e of this.thunder.keys()) if (e.dead) this.thunder.delete(e);
    // 朱：久未命中的符印自行散去；符纸展开后引爆。
    for (const [e, m] of this.red) if (this.t - m.hit > 2 && m.n) m.n = 0;
    for (let i = this.ignites.length - 1; i >= 0; i--) {
      const ig = this.ignites[i];
      if(ig.cast&&w.dt===0)continue;
      if (!ig.e.dead) { ig.x = ig.e.x; ig.y = ig.e.y; }
      if ((ig.left -= dt) <= 0) { this.ignites.splice(i, 1); this.detonate(ig); }
    }
    for (let i = this.fires.length - 1; i >= 0; i--) if ((this.fires[i].age += dt) > RED_FIRE_LIFE) this.fires.splice(i, 1);
    this.updateBlue(dt, p);
    this.updateThunder(dt);
  }

  // ------------------------------------------------------------ 朱

  private detonate(ig: Ignite): void {
    const w = this.w, lv = this.lv, R = FIRE_R[lv - 1] * (w.progression.has('huoyu') ? 1.25 : 1), pass = FIRE_PASS[lv - 1];
    const fx = w.fx;
    const show=!ig.cast||this.fires.filter(f=>f.cannon).length<6;
    if(show){this.fires.push({cannon:!!ig.cast, x: ig.x, y: ig.y, r: R, age: 0 });
    if (this.fires.length > 8) this.fires.shift();}
    for (const e of w.enemies.slice()) {
      if (!w.targetable(e)||(ig.cast&&!w.bossCaps.cannonValid(e,ig.cast))) continue;
      const self = e === ig.e;
      if (!self && Math.hypot(e.x - ig.x, e.y - ig.y) > R + e.radius * .6) continue;
      const dmg = this.scaled(e, 'red');
      w.damage(e, dmg, e.x, e.y, true, 'red', {castKey:ig.cast});
      w.progression.ignite(e, dmg * .25, ig.cast);
      if (!self && !e.dead) this.stack(e, pass, ig.cast);
    }
    if(!show)return;
    for (let i = 0; i < (ig.cast?10:36); i++) {
      const a = Math.random() * 6.283, sp = R * (1.2 + Math.random() * 2.6);
      fx.emitHigh({ x: ig.x, y: ig.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3.2, life: .3 + Math.random() * .3, size: 5 + Math.random() * 6, sizeEnd: 1,
        r: 2.6, g: 1.5, b: .4, r1: .9, g1: .12, b1: .02, a: .8, kind: PK.Flame, rot: Math.random() * 6, spin: Math.random() * 6 - 3 });
    }
    for (let i = 0; i < (ig.cast?4:14); i++) {
      const a = Math.random() * 6.283, sp = 90 + Math.random() * 220;
      fx.emit({ x: ig.x, y: ig.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, drag: 1.5, grav: -30, life: 1 + Math.random() * .6, size: 2.2, r: 2.2, g: .8, b: .18, r1: .6, g1: .1, b1: .02, kind: PK.Ember });
    }
    fx.shockwave(ig.x, ig.y, R * 1.15, 4, .4);
    fx.ink(ig.x, ig.y, R * .35, .4, [.1, .015, .005]);
    if(!ig.cast){fx.shake(.12); fx.flash(.07, [1, .5, .2]);}
    w.r.lights.pulse(ig.x, ig.y, R * 2.2, 1.6, .6, .15, .45);
    w.audio.sfx('explode_m', { vol: .35, pitch: 1.1 });
  }

  // ------------------------------------------------------------ 青

  private orbit(i: number, merge = 0): { x: number; y: number } {
    const p = this.w.player, a = this.t * 2.4 + i * Math.PI / 2, k = 1 - merge;
    const g = p.gun('gun');
    return { x: p.x + Math.cos(a) * 50 * k + (g.x - p.x) * merge, y: p.y + 4 + Math.sin(a) * 34 * k + (g.y - p.y - 4) * merge };
  }

  private updateBlue(dt: number, p: World['player']): void {
    const w = this.w;
    if (p.weapon !== 'blue' || !p.alive) { this.charge = 0; this.lit = 0; if (this.phase !== 'orbit') { this.phase = 'orbit'; this.ph = 0; } return; }
    if (this.phase === 'thrust') {
      if ((this.ph += dt) >= BLUE_THRUST + .2) { this.phase = 'return'; this.ph = 0; }
      return;
    }
    if (this.phase === 'return') {
      if ((this.ph += dt) >= BLUE_RETURN) { this.phase = 'orbit'; this.ph = 0; this.charge = 0; this.lit = 0; }
      return;
    }
    this.charge = p.firing ? this.charge + dt : Math.max(0, this.charge - dt * 1.2);
    const lit = Math.min(4, Math.floor(this.charge / BLUE_STEP));
    if (lit > this.lit) { this.litAt[lit - 1] = this.t; w.audio.sfx('seal', { vol: .18, pitch: 1.2 + lit * .15 }); }
    this.lit = lit;
    if (this.charge >= BLUE_STEP * 4 && p.firing) this.stab();
  }

  private stab(): void {
    const w = this.w, p = w.player, g = p.gun('gun'), lv = this.lv;
    const hw = (11 + lv * 4) * (w.progression.has('guanri') ? 1.5 : 1) * (w.skills.boosted ? 1.5 : 1);
    this.phase = 'thrust'; this.ph = 0; this.thrust = { x: g.x, y: g.y, hw };
    const hits: { e: Enemy; x: number; y: number }[] = [];
    for (const e of w.enemies) if (w.targetable(e, true) && w.hitSegment(e, g.x, g.y, g.x, -80, hw)) hits.push({ e, x: w.hitX, y: w.hitY });
    hits.sort((a, b) => b.y - a.y);
    let large = false;
    for (const h of hits) {
      if (h.e.invulnerable) { this.thrust.y = Math.max(this.thrust.y, g.y); w.damage(h.e, 1, h.x, h.y, true, 'blue'); break; }
      large = large || w.progression.isLarge(h.e);
      w.damage(h.e, this.scaled(h.e, 'blue'), h.x, h.y, true, 'blue');
      w.fx.hit(h.x, h.y, [.4, 1.8, 1.6], 6);
      w.fx.slashSpark(h.x, h.y, 0, [.5, 2, 1.8]);
    }
    if (large) w.hitstop(.04);
    w.fx.shake(large ? .22 : .12); w.fx.flash(.08, [.5, 1.2, 1.1]); w.fx.aberration(.25);
    w.fx.shockwave(g.x, g.y - 30, 90, 3, .3);
    w.audio.sfx('slash', { vol: .5, pitch: .85 });
  }

  // ------------------------------------------------------------ 紫

  private updateThunder(dt: number): void {
    const w = this.w, need = w.progression.has('tianlei') ? .8 : THUNDER_NEED;
    for (const e of this.thunderHit) {
      if (e.dead || !w.targetable(e) || e.invulnerable) continue;
      let m = this.thunder.get(e);
      if (!m) { m = { t: 0, hit: this.t }; this.thunder.set(e, m); }
      m.hit = this.t; m.t += dt;
      if (m.t >= need) { m.t = -.4; this.strikes.push({ e, x: e.x, y: e.y, age: 0, fired: false, bolts: [] }); w.audio.sfx('warning', { vol: .2, pitch: 1.6 }); }
    }
    this.thunderHit.clear();
    for (const [e, m] of this.thunder) if (this.t - m.hit > .35 && m.t > 0) m.t = Math.max(0, m.t - dt * 1.5);
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      if(s.cast&&w.dt===0)continue;
      if (!s.e.dead) { s.x = s.e.x; s.y = s.e.y; }
      s.age += dt;
      if (!s.fired && s.age >= THUNDER_WARN) { s.fired = true; this.fireStrike(s); }
      if (s.age > THUNDER_WARN + THUNDER_LIFE) this.strikes.splice(i, 1);
    }
  }

  private fireStrike(s: Strike): void {
    const w = this.w, lv = this.lv, e = s.e, fx = w.fx;
    const ty = e.y + e.radius * .3;
    if (w.targetable(e)) {
      w.damage(e, this.scaled(e, 'purple') * 1.25, e.x, ty, true, 'purple', {castKey:s.cast});
      if(s.cast)this.cannonControl(e,s.cast,.3);
      else if (!w.progression.isBossPart(e)) e.interrupt(.3);
    }
    const hit = new Set<Enemy>([e]);
    let from = { x: s.x, y: ty }, delay = .05;
    const jumps = JUMPS[lv - 1] + (w.progression.has('tianlei') ? 1 : 0);
    for (let j = 0; j < jumps; j++) {
      let best: Enemy | null = null, bd = 340;
      for (const c of w.enemies) { if (hit.has(c) || !w.targetable(c)) continue; const d = Math.hypot(c.x - from.x, c.y - from.y); if (d < bd) { bd = d; best = c; } }
      if (!best) break;
      hit.add(best);
      const to = { x: best.x, y: best.y + best.radius * .3 };
      s.bolts.push({ pts: jag(from.x, from.y, to.x, to.y, 8, 12, j + 3), delay });
      w.damage(best, this.scaled(best, 'purple') * JUMP_SCALE, to.x, to.y, true, 'purple', {castKey:s.cast});
      if(s.cast)this.cannonControl(best,s.cast,.15);
      else if (!w.progression.isBossPart(best)) best.interrupt(.15);
      fx.hit(to.x, to.y, [1.2, .6, 2.4], 5);
      from = to; delay += .05;
    }
    if(s.cast&&this.strikes.filter(q=>q.cast&&q.fired).length>6)return;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 6.283, sp = 120 + Math.random() * 360;
      fx.emitHigh({ x: s.x, y: ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 4, life: .15 + Math.random() * .25, size: 2, r: 1.8, g: .8, b: 3, kind: PK.Spark });
    }
    fx.shockwave(s.x, ty, 110, 4, .35); if(!s.cast){fx.flash(.22, [.7, .5, 1.2]); fx.shake(.25); fx.aberration(.4);
    w.hitstop(.03);}
    w.r.lights.pulse(s.x, ty, 380, 1.1, .5, 2, .4);
    w.audio.sfx('thunder', { vol: .6 });
  }

  // ------------------------------------------------------------ 绘制

  /** 剑：中心 (x,y)、朝向 a，剑身收尖并带护手；Sword 风格自带暗轮廓，亮底上也看得清。 */
  private sword(b: RibbonBatch, x: number, y: number, a: number, len: number, w: number, alpha = 1): void {
    const c = Math.cos(a), s = Math.sin(a), pts: number[] = [], ws: number[] = [], prof = [.55, .9, 1, .95, .7, .3, 0];
    for (let i = 0; i < prof.length; i++) { const t = (i / (prof.length - 1) - .5) * len; pts.push(x + c * t, y + s * t); ws.push(w * prof[i]); }
    b.strip(pts, ws, RS.Sword, CYAN[0], CYAN[1], CYAN[2], alpha);
    const gx = x - c * len * .32, gy = y - s * len * .32;
    b.line(gx - s * w * 1.6, gy + c * w * 1.6, gx + s * w * 1.6, gy - c * w * 1.6, w * .3, RS.Sword, CYAN[0], CYAN[1], CYAN[2], alpha);
  }

  draw(b: RibbonBatch, near: RibbonBatch): void {
    this.drawRed(b);
    this.drawBlue(b, near);
    this.drawThunder(b);
  }

  private drawRed(b: RibbonBatch): void {
    const t = this.t;
    for (const [e, m] of this.red) {
      if (e.dead || m.n <= 0) continue;
      const R = clamp(e.radius * .85, 16, 58), pulse = m.n >= RED_LAYERS - 1 ? .75 + .25 * Math.sin(t * 30) : 1;
      for (let i = 0; i < m.n; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / RED_LAYERS + t * .9, px = e.x + Math.cos(a) * R, py = e.y + Math.sin(a) * R * .85, sw = Math.sin(t * 19 + i * 2) * 2.5;
        auraLine(b, [px, py + 5, px + sw, py - 2, px + sw * .4, py - 11 - m.n], 2.6, RED, .95 * pulse, RS.AuraFire);
      }
      if (m.n >= 3) b.line(e.x - R, e.y, e.x + R, e.y, R * .9, RS.Glow, 2, .4, .06, .05 * m.n * pulse);
    }
    for (const ig of this.ignites) {
      const u = 1 - ig.left / ig.max, h = 12 + 46 * Math.min(1, u * 1.6), x = ig.x, y = ig.y - clamp(ig.e.radius, 14, 50) - h * .55, fade = u > .7 ? 1 - (u - .7) / .3 * .5 : 1;
      // 朱砂符：朱底、金边、三道墨画，展开后随即点燃。
      b.line(x, y + h * .5, x, y - h * .5, 7.5, RS.Brush, .95, .12, .04, fade);
      b.line(x - 7.5, y + h * .5, x - 7.5, y - h * .5, 1.1, RS.Glow, 2.2, 1.5, .4, .85 * fade);
      b.line(x + 7.5, y + h * .5, x + 7.5, y - h * .5, 1.1, RS.Glow, 2.2, 1.5, .4, .85 * fade);
      for (let k = 0; k < 3; k++) { const yy = y - h * .3 + k * h * .28; if (Math.abs(yy - y) < h * .5) b.line(x - 3.5, yy, x + 3.5, yy, 1.1, RS.Calligraphy, .05, .02, .02, fade); }
      b.line(x, y, x, y, 18, RS.Glow, 2.4, .8, .1, .22 * u);
    }
    for (const f of this.fires) {
      const u = f.age / RED_FIRE_LIFE, e = 1 - Math.pow(1 - Math.min(1, u * 2.2), 3), r = f.r * e, al = 1 - u;
      auraRing(b, f.x, f.y, r, r, [2.2, .6, .08], al * .95, 0, 5 * al + 1.5);
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5 + .3, r0 = r * .15, r1 = r * (.6 + .4 * rnd(i, 1)), sw = (i % 2 ? 1 : -1) * (.5 + .25 * Math.sin(u * 6 + i));
        const pts: number[] = [], ws: number[] = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8, rr = r0 + (r1 - r0) * t, an = a + sw * t * t;
          pts.push(f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr - 10 * u * t); ws.push((7 * al + 1.5) * Math.sin(Math.PI * (.15 + .85 * t)) * (1 - t * .5));
        }
        b.strip(pts, ws, RS.AuraFire, 2.2, .7, .1, al);
      }
      b.line(f.x - r * .6, f.y, f.x + r * .6, f.y, r * .55, RS.Glow, 2.4, .6, .08, .3 * al);
      if (u > .25) auraRing(b, f.x, f.y, r * .75, r * .75, [.12, .02, .01], .35 * al, 0, 3);
    }
  }

  private drawBlue(b: RibbonBatch, near: RibbonBatch): void {
    const w = this.w, p = w.player;
    if (p.weapon !== 'blue' || !p.alive) return;
    const t = this.t, th = this.thrust;
    if (this.phase === 'orbit') {
      const merge = clamp((this.charge - BLUE_STEP * 3.3) / (BLUE_STEP * .7), 0, 1);
      for (let i = 0; i < 4; i++) {
        const s = this.orbit(i, merge * merge), on = i < this.lit, pop = clamp(1 - (t - this.litAt[i]) / .2, 0, 1);
        if (on) near.line(s.x, s.y + 20, s.x, s.y - 20, 11 + pop * 8, RS.Glow, .1, .9, .85, .4 + pop * .4);
        this.sword(near, s.x, s.y, -Math.PI / 2, 56, on ? 5.5 : 4, on ? 1 : .45);
        if (pop > 0) auraRing(near, s.x, s.y, 6 + (1 - pop) * 16, 6 + (1 - pop) * 16, CYAN, pop * .8, 0, 2);
      }
      return;
    }
    const x = th.x;
    if (this.phase === 'thrust') {
      const u = clamp(this.ph / BLUE_THRUST, 0, 1), e = 1 - Math.pow(1 - u, 2), tip = th.y - (th.y + 90) * e;
      const after = clamp((this.ph - BLUE_THRUST) / .2, 0, 1), hw = th.hw;
      if (u < 1) {
        near.line(x, tip + 40, x, tip + 200, hw * .6, RS.Trail, .1, 1.3, 1.2, .55);
        near.line(x, th.y, x, tip, hw * .75, RS.Trail, .1, 1.3, 1.2, .6);
        near.line(x, tip + 190, x, tip, hw * 1.3, RS.Glow, .1, .9, .9, .7);
        this.sword(near, x, tip + 95, -Math.PI / 2, 240, hw * .55);
        near.line(x, tip + 140, x, tip, hw * .12, RS.Beam, 1.6, 2.2, 2.1, 1);
      } else {
        const al = 1 - after;
        near.line(x, th.y, x, -80, hw * (1.3 + after * .5), RS.Glow, .1, .9, .85, .6 * al);
        near.line(x, th.y, x, -80, hw * .5 * al, RS.Sword, .4, 1.6, 1.5, .8 * al);
        near.line(x, th.y, x, -80, hw * .2 * al, RS.Beam, 1.6, 2.2, 2.2, al);
      }
      return;
    }
    // 回收：四剑从屏顶飞回机身。
    const u = clamp(this.ph / BLUE_RETURN, 0, 1), e = 1 - Math.pow(1 - u, 3);
    for (let i = 0; i < 4; i++) {
      const o = this.orbit(i), sx = x + (i - 1.5) * 16, sy = 10, px = sx + (o.x - sx) * e + Math.sin(u * 3.14 + i) * 40 * (1 - e) * (i % 2 ? 1 : -1), py = sy + (o.y - sy) * e;
      const tx = sx + (o.x - sx) * Math.max(0, e - .15), ty = sy + (o.y - sy) * Math.max(0, e - .15);
      near.line(tx, ty, px, py, 3, RS.Trail, .1, 1.2, 1.1, .5 * (1 - u * .6));
      const a = Math.atan2(py - ty, px - tx) || -Math.PI / 2;
      this.sword(near, px, py, u > .85 ? -Math.PI / 2 : a, 56, 5);
    }
  }

  private drawThunder(b: RibbonBatch): void {
    const t = this.t, need = this.w.progression.has('tianlei') ? .8 : THUNDER_NEED;
    for (const [e, m] of this.thunder) {
      if (e.dead || m.t <= 0.05) continue;
      const f = clamp(m.t / need, 0, 1), R = clamp(e.radius * .9, 16, 60) + 4, seed = Math.floor(t * 16) + e.id;
      const pts: number[] = [], n = 16, span = Math.PI * 2 * (.35 + .65 * f);
      for (let i = 0; i <= n; i++) { const a = i / n * span + t * 1.5, r = R + (i && i < n ? (rnd(i, seed) - .5) * 7 : 0); pts.push(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * .9); }
      auraLine(b, pts, 1.4 + f * 1.2, VIOLET, .25 + .65 * f, RS.Lightning);
      if (f > .6) b.line(e.x - R, e.y, e.x + R, e.y, R * .8, RS.Glow, .5, .15, 1.2, (f - .6) * .5);
    }
    for (const s of this.strikes) {
      const topY = -30;
      if (!s.fired) {
        const u = clamp(s.age / THUNDER_WARN, 0, 1), r = 62 - 38 * u;
        // 收紧、变深的暗云影，叠一道细紫线从天顶指向落点。
        auraRing(b, s.x, s.y, r, r * .7, [.06, .03, .12], .35 + .5 * u, 0, 7 + 5 * u);
        b.line(s.x, s.y, s.x, s.y, r * .9, RS.InkHalo, .05, .03, .1, .35 * u);
        b.line(s.x, topY, s.x, s.y - r, 1.2, RS.Warn, 1, .5, 2, .35 + .4 * u);
        continue;
      }
      const age = s.age - THUNDER_WARN, al = clamp(1 - age / THUNDER_LIFE, 0, 1), seed = Math.floor(age * 28);
      const ty = s.e.dead ? s.y : s.y + s.e.radius * .3, pts = jag(s.x + (rnd(1, seed) - .5) * 30, topY, s.x, ty, 16, 22, seed);
      b.strip(pts, 11 * al + 3, RS.InkTrail, .04, .02, .09, .5 * al);
      b.strip(pts, 44 * al + 8, RS.Glow, .8, .35, 2.2, .7 * al);
      auraLine(b, pts, 9 * al + 2, [1.4, .9, 2.8], al, RS.Lightning);
      b.strip(pts, 3.5 * al + 1, RS.Beam, 2.4, 2.4, 2.8, al);
      auraRing(b, s.x, ty, 20 + age * 220, 14 + age * 150, VIOLET, al * .8, 0, 3);
      for (const bolt of s.bolts) {
        const k = age - bolt.delay; if (k < 0) continue;
        const a2 = clamp(1 - k / (THUNDER_LIFE * .8), 0, 1);
        auraLine(b, bolt.pts, 4 * a2 + 1, [1.3, .8, 2.6], a2, RS.Lightning);
        b.strip(bolt.pts, 12 * a2 + 3, RS.Glow, .6, .25, 1.6, .4 * a2);
      }
    }
  }
}
