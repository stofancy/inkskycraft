// 玩家「朱雀」：移动、倾斜、三色主武器、追踪墨矢、泼墨炸弹、死亡与重生。
import { angleDiff, approach, clamp, deg } from '../core/math';
import { PK } from '../gl/particles';
import { RS } from '../gl/ribbons';
import { makeBolt, type Bolt } from './bolt';
import type { Renderer } from '../gl/renderer';
import type { SpriteInfo } from '../gl/atlas';
import { PLAY_H, PLAY_W, type WeaponColor } from '../types';
import type { Enemy } from './enemy';
import type { World } from './world';

interface Shot {
  x: number; y: number; vx: number; vy: number;
  dmg: number; kind: 0 | 1; // 0 火羽 1 墨矢
  age: number; dead: boolean;
  target: Enemy | null;
}

/** 放电几何与其端点共存；重选目标不会改变缓存链条的拓扑。 */
interface ThunderBolt extends Bolt { from: Enemy | null; to: Enemy | null }

const RED_COUNT = [3, 4, 5, 6, 7, 8, 9, 11];
const RED_SPREAD = [10, 15, 21, 28, 35, 42, 50, 62];
const THUNDER_N = [1, 1, 2, 2, 3, 3, 4, 5];

export class Player {
  x = PLAY_W / 2;
  y = PLAY_H - 150;
  alive = true;
  /** 重生入场中（不可操作）。 */
  entering = 0;
  invuln = 0;
  respawnT = 0;
  lives = 3;
  bombs = 3;
  /** 新游戏的初始残机 / 炸弹（由难度决定）。 */
  startLives = 3;
  startBombs = 3;
  power = 1;
  weapon: WeaponColor = 'red';
  missile = 0;
  ink = 0.4;
  bank = 0;
  focus = false;
  firing = false;
  bombT = 0;
  readonly hitR = 3.2;
  readonly grazeR = 26;
  private shots: Shot[] = [];
  private fireCd = 0;
  private missileCd = 0;
  private sfxCd = 0;
  private thunderTargets: Enemy[] = [];
  private thunderRetarget = 0;
  private bolts: ThunderBolt[][] = [];
  private boltT = 0;
  private laserOn = 0;
  private beamTilt=0;
  private focusCharge = 0;
  private info!: SpriteInfo;

  constructor(readonly w: World) {}

  get sprite(): SpriteInfo {
    return (this.info ??= this.w.r.atlas.get('player'));
  }

  gun(name: string): { x: number; y: number } {
    const a = this.sprite.anchors[name];
    return a ? { x: this.x + a[0], y: this.y + a[1] } : { x: this.x, y: this.y - 30 };
  }

  reset(full: boolean): void {
    this.x = PLAY_W / 2;
    this.y = PLAY_H - 150;
    this.alive = true;
    this.entering = 0;
    this.invuln = 2;
    this.bombT = 0;
    this.shots = [];
    this.thunderTargets = [];
    this.focusCharge=0;this.laserOn=0;this.beamTilt=0;this.fireCd=0;this.bolts=[];
    if (full) {
      this.lives = this.startLives;
      this.bombs = this.startBombs;
      this.power = 1;
      this.weapon = 'red';
      this.missile = 0;
      this.ink = 0.4;
    }
  }

  // ------------------------------------------------------------ 更新

  update(realDt: number, dt: number): void {
    const w = this.w, inp = w.input;
    this.invuln = Math.max(0, this.invuln - realDt);
    this.sfxCd -= realDt;

    if (!this.alive) {
      this.respawnT -= realDt;
      if (this.respawnT <= 0 && this.lives >= 0) this.respawn();
      this.updateShots(dt);
      return;
    }
    if (this.entering > 0) {
      this.entering -= realDt;
      this.y = approach(this.y, PLAY_H - 170, 5, realDt);
    } else {
      this.focus = inp.down('focus');
      const sp = this.focus ? 200 : 420;
      this.x = clamp(this.x + inp.axisX * sp * realDt, 26, PLAY_W - 26);
      this.y = clamp(this.y + inp.axisY * sp * realDt, 50, PLAY_H - 36);
      this.bank = approach(this.bank, inp.axisX, 9, realDt);
      if(inp.pressed('weapon')) { const colors:WeaponColor[]=['red','blue','purple'];this.weapon=colors[(colors.indexOf(this.weapon)+1)%3];this.focusCharge=0;this.thunderTargets=[];w.audio.sfx('weapon_change'); }
      if (inp.pressed('bomb')) this.bomb();
    }
    this.firing = inp.down('shoot') && this.entering <= 0;
    this.ink = Math.min(1, this.ink + realDt * 0.012);
    this.engineFx(realDt);
    this.fire(dt);
    this.updateShots(dt);
    this.updateBomb(dt);
  }

  private engineFx(realDt: number): void {
    const w = this.w;
    const c=this.weapon==='blue'?[.12,1.25,.8]:this.weapon==='purple'?[1.15,.22,1.55]:[2.2,.75,.15];
    for (const side of ['engineL', 'engineR']) {
      const p = this.gun(side);
      for (let i = 0; i < 2; i++) {
        w.fx.emitHigh({
          x: p.x + (Math.random() - 0.5) * 3, y: p.y + 2, vx: (Math.random() - 0.5) * 40, vy: 260 + Math.random() * 200,
          life: 0.09 + Math.random() * 0.05, size: this.focus ? 4 : 6, sizeEnd: 1.5,
          r:c[0],g:c[1],b:c[2],r1:c[0]*.3,g1:c[1]*.3,b1:c[2]*.3, kind: PK.Dot,
        });
      }
    }
    if (w.frameNo % 2 === 0) {
      w.fx.push(this.x, this.y + 40, 0, 520, 16);
      w.fx.glowSplat(this.x, this.y + 36, 10, [0.25 * realDt * 60, 0.08 * realDt * 60, 0.02 * realDt * 60]);
    }
  }

  // ------------------------------------------------------------ 射击

  private fire(dt: number): void {
    const w = this.w;
    this.fireCd -= dt;
    this.missileCd -= dt;
    this.focusCharge=approach(this.focusCharge,this.weapon==='blue'&&this.focus&&this.firing?1:0,this.focus&&this.firing?1.3:8,dt);
    this.laserOn = this.firing && this.weapon === 'blue' ? Math.min(1, this.laserOn + dt * 8) : Math.max(0, this.laserOn - dt * 10);
    if (!this.firing) {
      this.thunderTargets = [];
      return;
    }
    const lv = this.power;
    if(w.progression.has('B1')&&this.weapon==='blue'&&this.focus&&this.firing){if(w.input.axisX)this.beamTilt=Math.sign(w.input.axisX)*.16;w.progression.trigger('B1');}else this.beamTilt=0;
    if (this.weapon === 'red' && this.fireCd <= 0) {
      this.fireCd = 0.105;
      if(w.progression.has('R1'))w.progression.trigger('R1');
      const n = RED_COUNT[lv - 1], spread = deg(RED_SPREAD[lv - 1]);
      const g = this.gun('gun');
      for (let i = 0; i < n; i++) {
        const k = n === 1 ? 0 : i / (n - 1) - 0.5;
        const a = -Math.PI / 2 + k * spread;
        if(w.progression.has('R1')){for(const side of [-1,1])this.shots.push({x:g.x+side*13+k*13,y:g.y+Math.abs(k)*14,vx:Math.cos(-Math.PI/2+side*(.11+(k+.5)*spread*.5))*1500,vy:Math.sin(-Math.PI/2+side*(.11+(k+.5)*spread*.5))*1500,dmg:.625,kind:0,age:0,dead:false,target:null});continue;}
        this.shots.push({ x: g.x + k * 26, y: g.y + Math.abs(k) * 14, vx: Math.cos(a) * 1500, vy: Math.sin(a) * 1500, dmg: 1.25, kind: 0, age: 0, dead: false, target: null });
      }
      if (this.sfxCd <= 0) { w.audio.sfx('shot_red', { vol: 0.5 }); this.sfxCd = 0.09; }
    }
    if (this.weapon === 'blue') {
      if (this.sfxCd <= 0) { w.audio.sfx('shot_blue', { vol: 0.45 }); this.sfxCd = 0.14; }
    }
    if (this.weapon === 'purple') {
      this.thunderRetarget -= dt;
      if (this.thunderRetarget <= 0) {
        this.thunderRetarget = 0.12;
        const n = THUNDER_N[lv - 1];
        const cands = w.enemies.filter((e) => w.targetable(e,true) && e.y < this.y + 60 && Math.hypot(e.x - this.x, e.y - this.y) < 760);
        cands.sort((a, b) => (w.progression.has('T1')?Number(w.companions.isMarked(b))-Number(w.companions.isMarked(a)):0)||Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
        this.thunderTargets = cands.slice(0, n);if(w.progression.has('T1')&&this.thunderTargets.some(e=>w.companions.isMarked(e)))w.progression.trigger('T1');
      }
      this.thunderTargets = this.thunderTargets.filter((e) => !e.dead);
      if (this.sfxCd <= 0) { w.audio.sfx('shot_purple', { vol: 0.45 }); this.sfxCd = 0.12; }
    }
    // 追踪墨矢
    if (this.missile > 0 && this.missileCd <= 0) {
      this.missileCd = 0.75;
      for (let i = 0; i < this.missile * 2; i++) {
        const left = i % 2 === 0;
        const g = this.gun(left ? 'missileL' : 'missileR');
        const a = -Math.PI / 2 + (left ? -1 : 1) * (0.6 + 0.25 * Math.floor(i / 2));
        this.shots.push({ x: g.x, y: g.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, dmg: 7, kind: 1, age: 0, dead: false, target: null });
      }
      w.audio.sfx('missile', { vol: 0.5 });
    }
  }

  private updateShots(dt: number): void {
    const w = this.w;
    const lv = this.power;
    for (const s of this.shots) {
      s.age += dt;
      if (s.kind === 1) {
        if (!s.target || s.target.dead || !w.targetable(s.target,true)) {
          s.target = w.nearestEnemy(s.x, s.y, s.y + 100);
        }
        const sp = Math.min(1150, Math.hypot(s.vx, s.vy) + 1800 * dt);
        let a = Math.atan2(s.vy, s.vx);
        if (s.target && s.age > 0.12) {
          const ta = Math.atan2(s.target.y - s.y, s.target.x - s.x);
          a += clamp(angleDiff(a, ta), -7 * dt, 7 * dt);
        } else if (s.age > 0.12) {
          a += clamp(angleDiff(a, -Math.PI / 2), -3 * dt, 3 * dt);
        }
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp;
        if (w.frameNo % 2 === 0) {
          w.fx.emit({ x: s.x, y: s.y, vx: -s.vx * 0.05, vy: -s.vy * 0.05, life: 0.5, drag: 2, size: 3.2, sizeEnd: 1, r: 0.02, g: 0.02, b: 0.02, a: 0.7, kind: PK.Ink });
          w.fx.emitHigh({ x: s.x, y: s.y, life: 0.12, size: 5, sizeEnd: 2, r: 2.0, g: 0.5, b: 0.15, kind: PK.Dot });
        }
      }
      const px0 = s.x, py0 = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y < -40 || s.y > PLAY_H + 40 || s.x < -40 || s.x > PLAY_W + 40 || s.age > 3) s.dead = true;
      if (s.dead) continue;
      const hit = w.shotHit(s.x, s.y, s.kind === 0 ? 7 : 8, px0, py0);
      if (hit) {
        s.x = w.hitX; s.y = w.hitY;
        w.damage(hit, s.dmg, s.x, s.y, false, s.kind===0?'red':'neutral');
        s.dead = true;

      }
    }
    this.shots = this.shots.filter((s) => !s.dead);

    if (!this.alive) return;
    // 青光束：贯穿
    if (this.laserOn > 0 && this.weapon==='blue' && this.firing) {
      const g = this.gun('gun');
      const hw = (7 + lv * 2.2) * this.laserOn;
      const dps = (24+(lv-1)*40/7) * (.82+.18*this.focusCharge);
      const hits:{e:Enemy;x:number;y:number}[]=[];
      for(const e of w.enemies)if(w.targetable(e,true)&&w.hitSegment(e,g.x,g.y,g.x+Math.tan(this.beamTilt)*(g.y+60),-60,hw))hits.push({e,x:w.hitX,y:w.hitY});
      hits.sort((a,b)=>b.y-a.y);
      for(let i=0;i<hits.length;i++){
        const h=hits[i];w.damage(h.e,dps*dt*this.laserOn*Math.pow(.66,i),h.x,h.y,false,'blue');
        if(h.e.invulnerable)break;
      }
    }
    // 雷弧
    if (this.weapon === 'purple' && this.firing) {
      const n = Math.max(1, this.thunderTargets.length);
      const per = (20 + (lv-1)*34/7) * (n === 1 ? 1 : 1.25 / n);
      for (const e of this.thunderTargets) {
        w.damage(e, per * dt, e.x, e.y + e.radius*.65,false,'purple');

      }
      if (!this.thunderTargets.length) {
        // 无目标：向前喷出短雷弧，扫到的敌人受伤
        const g = this.gun('gun');
        const struck=new Set<Enemy>();
        for (const side of [-1, 1]) {
          const ex = g.x + side * 70, ey = g.y - 280;
          for (const e of w.enemies) {
            if (!struck.has(e) && w.targetable(e,true) && w.hitSegment(e,g.x,g.y,ex,ey,18)) {struck.add(e);w.damage(e,per*.6*dt,w.hitX,w.hitY,false,'purple');}
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ 炸弹「泼墨」

  bomb(): void {
    const w = this.w;
    if (this.bombs <= 0 || this.bombT > 0 || !this.alive || w.brush.active) return;
    this.bombs--;
    this.bombT = w.progression.bombMods.duration;
    w.progression.onBomb();
    w.combos.record('bomb');
    this.invuln = Math.max(this.invuln, 3.4);
    w.audio.sfx('bomb');
    w.fx.flash(0.3, [0.9, 0.35, 0.2]);
    w.fx.shake(0.6);
    w.fx.aberration(0.8);
    w.fx.shockwave(this.x, this.y, 900, 22, 1.1);
    w.clearBullets(true);
    w.bombsUsed++;
  }

  private updateBomb(dt: number): void {
    if (this.bombT <= 0) return;
    const w = this.w;
    const prev = this.bombT;
    this.bombT = Math.max(0, this.bombT - dt);
    const u = 1 - this.bombT / w.progression.bombMods.duration; // 0..1
    // 墨浪自下而上横扫
    const waveY = PLAY_H + 80 - Math.min(1, u / 0.55) * (PLAY_H + 300);
    if (u < 0.6) {
      for (let i = 0; i < 9; i++) {
        const x = (i + 0.5) * (PLAY_W / 9) + (Math.random() - 0.5) * 60;
        w.r.fluid.splat({ x, y: waveY, r: 55, vx: (Math.random() - 0.5) * 300, vy: -1100, ink: [0.012, 0.01, 0.01, 0.6] });
      }
      for (let i = 0; i < 14 * w.fx.density; i++) {
        const x = Math.random() * PLAY_W;
        w.fx.emit({ x, y: waveY + Math.random() * 60, vx: (Math.random() - 0.5) * 200, vy: -500 - Math.random() * 600, drag: 2, grav: 300, life: 1.2, size: 4 + Math.random() * 7, sizeEnd: 2, r: 0.02, g: 0.02, b: 0.02, a: 0.9, kind: PK.Ink });
        w.fx.emitHigh({ x, y: waveY, vx: (Math.random() - 0.5) * 300, vy: -700 - Math.random() * 500, drag: 2.5, life: 0.8, size: 3, spin: 10, r: 2.2, g: 1.4, b: 0.35, kind: PK.Leaf });
        w.fx.emit({ x, y: waveY, vx: (Math.random() - 0.5) * 200, vy: -300 - Math.random() * 400, drag: 1.2, grav: 60, life: 1.8, size: 5, spin: 4, rot: Math.random() * 6, r: 0.75, g: 0.08, b: 0.05, a: 0.9, kind: PK.Petal });
      }
    }
    // 伤害与持续清弹
    for (const e of w.enemies) if (w.targetable(e)) w.damage(e, (e.phaseLock ? 160 : 320) * dt * w.progression.bombMods.damageScale, e.x, e.y, true,'ink');
    if (Math.floor(prev * 10) !== Math.floor(this.bombT * 10)) w.clearBullets(true);
  }

  // ------------------------------------------------------------ 死亡与重生

  die(): void {
    const w = this.w;
    if (!this.alive || this.invuln > 0 || this.bombT > 0) return;
    this.alive = false;
    this.lives--;
    this.respawnT = 1.4;
    w.noMiss = false;
    w.fx.explosion(this.x, this.y, 'l', 'fire');
    w.fx.flash(0.6, [1, 0.3, 0.2]);
    w.fx.aberration(1);
    w.audio.sfx('player_die');
    w.brush.cancel();
    // 掉落部分火力
    if (this.power > 1) w.drop('p', this.x, this.y);
    if (this.power > 3) w.drop('weapon', this.x, this.y);
    this.power = Math.max(1, this.power - 2);
    this.missile = Math.max(0, this.missile - 1);
    w.clearBullets(false);
    if (this.lives < 0) w.onGameOver();
  }

  respawn(): void {
    this.alive = true;
    this.x = PLAY_W / 2;
    this.y = PLAY_H + 60;
    this.entering = 0.9;
    this.invuln = 3.2;
    this.bombs = Math.max(this.bombs, 3);
    this.bank = 0;
  }

  // ------------------------------------------------------------ 绘制

  draw(r: Renderer, time: number): void {
    const w = this.w;
    for (const s of this.shots) {
      const rot = Math.atan2(s.vy, s.vx) + Math.PI / 2;
      if (s.kind === 0) {
        r.impact.feather(s.x,s.y,rot,13+this.power*.6,'red');
        const sp=Math.hypot(s.vx,s.vy);
        r.ribbonMid.line(s.x-s.vx/sp*40,s.y-s.vy/sp*40,s.x,s.y,2.4,RS.Trail,1.5,.22,.035,.65);
      }
      else r.air.add('player_missile', { x: s.x, y: s.y, rot, glow: 1.5 });
    }
    if (!this.alive) return;
    let frame = clamp(Math.round((this.bank + 1) * 2), 0, 4);
    if (this.sprite.frames.length === 16) { // 正式分镜：待机 0-3 循环，左倾 4-7、右倾 12-15 保持末帧
      frame = this.bank < -.35 ? 4 + Math.min(3, Math.floor((-this.bank - .35) * 6)) : this.bank > .35 ? 12 + Math.min(3, Math.floor((this.bank - .35) * 6)) : Math.floor(time * 10) % 4;
    }
    const blink = this.invuln > 0 && Math.floor(time * 20) % 2 === 0;
    const alpha = blink ? 0.35 : 1;
    r.shadows.add(this.sprite, { x: this.x, y: this.y, frame, alpha });
    r.player.add(this.sprite, { x: this.x, y: this.y, frame, alpha, glow: .7 + this.power*.045 });
    r.impact.armor(this.x,this.y,this.power,this.weapon,this.bank,alpha);
    if (this.focus || w.brush.active) {
      r.bullets.add(this.x, this.y, 0, 4.5, 0, 1.6, 0.25, 0.15, 1, 1, 0.5);
    }
    // 青光束
    if (this.laserOn > 0) {
      const g = this.gun('gun');
      const hw = (7 + this.power * 2.2) * this.laserOn;
      for(let i=0;i<9;i++){const yy=g.y-((time*460+i*97)%Math.max(1,g.y+50));r.impact.feather(g.x+Math.tan(this.beamTilt)*(g.y-yy)+Math.sin(i*2.7+time*4)*hw*.18,yy,Math.sin(i+time)*.12,9+this.power*.5,'blue',this.laserOn*.7);}
      const flick = 0.9 + 0.1 * Math.sin(time * 90);
      r.ribbonMid.line(g.x, g.y, g.x+Math.tan(this.beamTilt)*(g.y+40), -40, hw * 1.35 * flick, RS.Glow, 0.02, 0.22, 0.16, 0.45);
      r.ribbonMid.line(g.x, g.y, g.x+Math.tan(this.beamTilt)*(g.y+40), -40, hw * (.4+.25*this.focusCharge), RS.Bolt, 0.08, 0.9, 0.65, .85);
      w.fx.emitHigh({ x: g.x, y: g.y, life: 0.06, size: hw * 2.2, sizeEnd: hw, r: 0.1, g: 1.2, b: 0.85, a: 0.5, kind: PK.Dot });
    }
    // 雷弧
    if (this.weapon === 'purple' && this.firing) this.drawThunder(r, time);
    else this.bolts.length = 0;
  }

  private drawThunder(r: Renderer, time: number): void {
    const w = this.w, lv = this.power;
    const g = this.gun('gun');
    if (time - this.boltT >= 0.05 || this.boltT > time) {
      this.boltT = time;
      const hw = 5.0 + lv * 0.85;
      const set: ThunderBolt[] = [];
      const hits: [number, number][] = [];
      if (this.thunderTargets.length) {
        let px = g.x, py = g.y;
        this.thunderTargets.forEach((e, i) => {
          const from = i > 0 && Math.hypot(e.x - px, e.y - py) < 320 ? this.thunderTargets[i - 1] : null;
          const fx = from ? px : g.x, fy = from ? py : g.y;
          set.push({ ...makeBolt(fx, fy, e.x, e.y+e.radius*.65, hw * (i > 0 ? 0.75 : 1), 1 + (lv >> 2)), from, to: e });
          hits.push([e.x, e.y+e.radius*.65]);
          px = e.x; py = e.y+e.radius*.65;
        });
      } else {
        const k = 2 + (lv >> 2);
        for (let i = 0; i < k; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
          const l = 90 + Math.random() * 130;
          set.push({ ...makeBolt(g.x, g.y - 6, g.x + Math.cos(a) * l, g.y + Math.sin(a) * l, hw * 0.7, Math.random() < 0.5 ? 1 : 0), from: null, to: null });
        }
      }
      this.bolts.unshift(set);
      if (this.bolts.length > 2) this.bolts.length = 2;
      if (hits.length) r.lights.pulse(g.x, g.y - 30, 150, 0.6, 0.35, 1.1, 0.1);
    }
    for (let gi = this.bolts.length - 1; gi >= 0; gi--) {
      for (let bi = 0; bi < this.bolts[gi].length; bi++) {
        const b = this.bolts[gi][bi];
        let t = b.trunk, branches = b.branches;
        if (gi === 0) {
          const pts = t.pts, last = pts.length - 2;
          const { from, to } = b;
          const sx = (from ? from.x : g.x) - pts[0], sy = (from ? from.y + from.radius * .65 : g.y) - pts[1];
          const ex = to ? to.x - pts[last] : sx, ey = to ? to.y+to.radius*.65 - pts[last + 1] : sy;
          const move = (p: number[], u?: number): number[] => p.map((v, i) => {
            const f = u ?? Math.floor(i / 2) / (p.length / 2 - 1);
            return v + (i % 2 ? sy + (ey - sy) * f : sx + (ex - sx) * f);
          });
          branches = b.branches.map(br => {
            let nearest = 0, best = Infinity;
            for (let i = 0; i < pts.length; i += 2) {
              const d = Math.hypot(pts[i] - br.pts[0], pts[i + 1] - br.pts[1]);
              if (d < best) { best = d; nearest = i; }
            }
            return { pts: move(br.pts, nearest / last), w: br.w };
          });
          t = { pts: move(pts), w: t.w };
        }
        const phase = this.boltT * 12 + bi * 2.7;
        // 余像仅留下弱紫辉，主形保留单次放电的清晰体积。
        if (gi > 0) {
          r.ribbonMid.strip(t.pts, t.w.map(x => x * 2.3), RS.Glow, 0.25, 0.035, 0.6, 0.11);
          continue;
        }
        r.ribbonMid.strip(t.pts, t.w.map(x => x * 3.8), RS.Glow, 0.33, 0.06, 0.78, 0.28);
        r.thunder.path(t.pts, t.w, 1, phase);
        for (let j = 0; j < branches.length; j++) {
          const br = branches[j];
          r.ribbonMid.strip(br.pts, br.w.map(x => x * 3), RS.Glow, 0.35, 0.06, 0.8, 0.17);
          r.thunder.path(br.pts, br.w, 0.8, phase + j * 1.6, true);
        }
        const n = t.pts.length / 2;
        for (let i = 2; i < n - 2; i += 5) {
          r.lights.add(t.pts[i * 2], t.pts[i * 2 + 1], 130, 0.32, 0.14, 0.68);
        }
      }
    }
  }
}
