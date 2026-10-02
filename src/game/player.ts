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
import { MAX_POWER } from './items';
import { PRIMARY_SHOT_FRAME, PRIMARY_HIT_FRAME } from '../art/sprites_player';

interface Shot {
  x: number; y: number; vx: number; vy: number;
  color: WeaponColor; visual?: boolean;
  missile?: boolean;
  dmg: number;
  age: number; dead: boolean;
  target: Enemy | null;
  pierce?:number; hits?:Set<number>;
}

/** 放电几何与其端点共存；重选目标不会改变缓存链条的拓扑。 */
interface ThunderBolt extends Bolt { from: Enemy | null; to: Enemy | null }
interface PrimaryHit { x: number; y: number; color: WeaponColor; target: number; age: number; size: number }

// 显示四级火力，主武器沿用旧八级表的 1、3、6、8 级。
const WEAPON_LEVEL = [1, 3, 6, 8];
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
  /** 当前命的羽甲格数，掉光才掉命。 */
  armor = 3;
  /** 最近一次受击的时间戳（real 时钟），用于机身闪白。 */
  hurtAt = -9;
  /** 累计受击次数，界面据此触发边缘淡红闪。 */
  hurtSeq = 0;
  bombs = 3;
  /** 新游戏的初始残机 / 炸弹（由难度决定）。 */
  startLives = 3;
  startBombs = 3;
  private powerLevel = 1;
  get power(): number { return this.powerLevel; }
  private get weaponLevel(): number { return WEAPON_LEVEL[this.powerLevel - 1]; }
  set power(value: number) { this.powerLevel = Number.isFinite(value) ? clamp(Math.floor(value), 1, MAX_POWER) : 1; }
  private color:WeaponColor='red';
  private previousColor:WeaponColor='red';private colorChangedAt=-1;
  get weapon():WeaponColor{return this.color;}
  set weapon(value:WeaponColor){if(value===this.color)return;this.previousColor=this.color;this.color=value;this.colorChangedAt=this.w.presentationTime;}
  ink = 0.4;
  missile = 0;
  bank = 0;
  focus = false;
  firing = false;
  /** 被关卡机制锁住：不能移动、不能翻滚，射击与技能照常。 */
  locked = false;
  bombT = 0;
  readonly hitR = 3.2;
  readonly grazeR = 26;
  private shots: Shot[] = [];
  private primaryHits: PrimaryHit[] = [];
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

  constructor(readonly w: World,readonly echo=false) {}

  syncEcho(p:Player,reset=false):void{
    if(reset){this.reset(false);this.fireCd=p.fireCd;this.thunderRetarget=0;}
    this.x=PLAY_W-p.x;this.y=p.y;this.weapon=p.weapon;this.power=p.power;this.focus=p.focus;this.firing=p.firing;this.bank=-p.bank;this.alive=p.alive;
  }
  updateEcho(dt:number):void{this.fire(dt);this.updateShots(dt);}
  private primaryDamage(e:Enemy,amount:number,x:number,y:number,source:WeaponColor):void{
    const hit=this.w.targetable(e)&&amount>0;
    // 三色平射伤害 +30%；Boss 战时长按既有预算走，不加成。
    if(!this.w.progression.isBossPart(e))amount*=1.3;
    if(hit&&!this.echo)this.w.aura.gun.onHit(e,source);
    this.w.damage(e,amount,x,y,this.echo,source);
    if(hit)this.hitBurst(x,y,source,e.id);
    if(hit&&!this.echo)this.w.skills.primaryHit(e.id,source);
  }

  get sprite(): SpriteInfo {
    return this.w.r.atlas.get(`player_body_${this.weapon}`);
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
    this.armor = 3;
    this.colorChangedAt=-1;this.previousColor=this.color;this.bombT = 0;if(!this.echo)this.w.roll?.reset();
    this.shots = [];
    this.primaryHits = [];
    this.missileCd = 0;
    this.thunderTargets = [];
    this.focusCharge=0;this.laserOn=0;this.beamTilt=0;this.beamEndY=-40;this.fireCd=0;this.thunderRetarget=0;this.bolts=[];
    if (full) {
      this.lives = this.startLives;
      this.bombs = this.startBombs;
      this.power = 1;
      this.missile = 0;
      this.weapon = 'red';
      this.ink = 0.4;
    }
  }

  // ------------------------------------------------------------ 更新

  update(realDt: number, dt: number): void {
    const w = this.w, inp = w.input;
    this.invuln = Math.max(0, this.invuln - realDt);
    this.sfxCd -= realDt;

    if (!this.alive) {
      w.aura.update(realDt);w.mantra.update(realDt);
      this.respawnT -= realDt;
      if (this.respawnT <= 0 && this.lives >= 0) this.respawn();
      this.updateShots(dt);
      return;
    }
    if (this.entering > 0) {
      this.entering -= realDt;
      this.y = approach(this.y, PLAY_H - 170, 5, realDt);
    } else {
      this.focus=inp.down('focus');w.roll.update(realDt);
      const sp=w.roll.frameActive||this.locked?0:420*(w.skills.boosted?1.1:1)*(w.bossCombat.inputLocked?.3:1);
      this.x = clamp(this.x + inp.axisX * sp * realDt, 26, PLAY_W - 26);
      this.y = clamp(this.y + inp.axisY * sp * realDt, 50, PLAY_H - 36);
      this.bank = approach(this.bank, inp.axisX, 9, realDt);
      if(inp.pressed('weapon')) { const colors:WeaponColor[]=['red','blue','purple'];this.weapon=colors[(colors.indexOf(this.weapon)+1)%3];this.focusCharge=0;this.thunderTargets=[];w.ui.popup(this.x,this.y-70,{red:'朱',blue:'青',purple:'紫'}[this.weapon],'info'); }
      if (inp.pressed('bomb')&&!w.bossCombat.inputLocked) this.bomb();
    }
    this.firing = inp.down('shoot') && !inp.down('brush') && this.entering <= 0&&!w.bossCombat.inputLocked;
    this.ink = Math.min(1, this.ink + realDt * 0.012);
    if(!w.bossCombat.inputLocked)w.aura.update(realDt);
    this.fire(dt);
    this.updateShots(dt);
    if(!w.bossCombat.inputLocked)w.mantra.update(realDt);
  }

  // ------------------------------------------------------------ 射击

  get baseThunderTargets(){return THUNDER_N[this.weaponLevel-1];}
  get thunderDps(){return 20+(this.weaponLevel-1)*34/7;}

  private beamEndY=-40;
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
    const lv = this.weaponLevel,boost=w.skills.boosted;
    this.beamTilt=0;
    if (this.weapon === 'red' && this.fireCd <= 0) {
      this.fireCd = 0.105/(boost?1.6:1);
      const n = RED_COUNT[lv - 1]+(boost?2:0), spread = deg(RED_SPREAD[lv - 1])*(boost?1.6:1);
      const g = this.gun('gun');
      for (let i = 0; i < n; i++) {
        const k = n === 1 ? 0 : i / (n - 1) - 0.5;
        const a = -Math.PI / 2 + k * spread;
        this.shots.push({ x: g.x + k * 26, y: g.y + Math.abs(k) * 14, vx: Math.cos(a) * 1500, vy: Math.sin(a) * 1500, color: 'red', dmg: 1.25,  age: 0, dead: false, target: null,pierce:boost?1:0,hits:new Set() });
      }
      if (this.sfxCd <= 0) { w.audio.sfx('shot_red', { vol: 0.5 }); this.sfxCd = 0.09; }
    }
    // 青与紫沿既有光束/锁敌通路播放短弹脉冲，伤害仍由原主炮结算。
    if (this.weapon !== 'red' && this.fireCd <= 0) {
      this.fireCd=.075/(boost?1.6:1);const g=this.gun('gun');
      const ends=this.weapon==='purple'&&this.thunderTargets.length?this.thunderTargets.map(e=>({x:e.x,y:e.y+e.radius*.65})): [{x:g.x,y:-40}];
      for(const end of ends){const d=Math.hypot(end.x-g.x,end.y-g.y)||1;
       for(let k=0;k<(this.weapon==='blue'?3:1);k++)this.shots.push({x:g.x+(k-1)*(this.weapon==='blue'?6:0),y:g.y,vx:(end.x-g.x)/d*1800,vy:(end.y-g.y)/d*1800,color:this.weapon,visual:true,dmg:0,age:0,dead:false,target:this.weapon==='purple'?this.thunderTargets.find(e=>e.x===end.x)??null:null});
      }
    }
    if(this.shots.length>256)this.shots.splice(0,this.shots.length-256);
    if (this.weapon === 'blue') {
      if (this.sfxCd <= 0) { w.audio.sfx('shot_blue', { vol: 0.45 }); this.sfxCd = 0.14; }
    }
    if (this.weapon === 'purple') {
      this.thunderRetarget -= dt;
      if (this.thunderRetarget <= 0) {
        this.thunderRetarget = 0.12;
        const n = this.baseThunderTargets+(boost?2:0) + (w.progression.has('liansuo')?2:0);
        const cands = w.enemies.filter((e) => w.targetable(e,true) && e.y < this.y + 60 && Math.hypot(e.x - this.x, e.y - this.y) < 760);
        cands.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
        this.thunderTargets = cands.slice(0, n);w.progression.onDischarge(this.thunderTargets);
      }
      this.thunderTargets = this.thunderTargets.filter((e) => !e.dead);
      if (this.sfxCd <= 0) { w.audio.sfx('shot_purple', { vol: 0.45 }); this.sfxCd = 0.12; }
    }
    // V2 追踪墨矢：左右展开后加速转向，与主武器颜色独立。
    if (!this.echo && this.missile > 0 && this.missileCd <= 0) {
      this.missileCd = 0.75;
      for (let i = 0; i < this.missile * 2; i++) {
        const left = i % 2 === 0;
        const g = this.gun(left ? 'missileL' : 'missileR');
        const a = -Math.PI / 2 + (left ? -1 : 1) * (0.6 + 0.25 * Math.floor(i / 2));
        this.shots.push({ x: g.x, y: g.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, color: 'red', missile: true, dmg: 7, age: 0, dead: false, target: null });
      }
      w.audio.sfx('missile', { vol: 0.5 });
    }
  }

  /** 实际主炮命中点。分身共用主机池；持续伤害等本轮两帧播完再起下一轮。 */
  private hitBurst(x:number,y:number,color:WeaponColor,target:number):void{
    const hits=this.w.player.primaryHits;
    if(hits.length>=12)return;
    if(color!=='red'&&hits.some(h=>h.target===target&&h.color===color))return;
    hits.push({x,y,color,target,age:0,size:this.w.skills.boosted?1.65:1});
  }

  private updateShots(dt: number): void {
    const w = this.w;
    const lv = this.weaponLevel;
    if(!this.echo){
      for(const hit of this.primaryHits)hit.age+=dt;
      this.primaryHits=this.primaryHits.filter(hit=>hit.age<.16);
    }
    for (const s of this.shots) {
      s.age += dt;
      if (s.missile) {
        if (!s.target || s.target.dead || !w.targetable(s.target, true)) {
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
      if (s.missile) {
        const hit = w.shotHit(s.x, s.y, 8, px0, py0);
        if (hit) {
          s.x = w.hitX; s.y = w.hitY;
          w.damage(hit, s.dmg, s.x, s.y, false, 'neutral');
          s.dead = true;
        }
        continue;
      }
      if(s.visual){
        if(s.target && (s.target.dead||Math.hypot(s.x-s.target.x,s.y-s.target.y)<35||s.y<s.target.y))s.dead=true;
        if(s.color==='blue'&&s.y<this.beamEndY)s.dead=true;
        continue;
      }
      while(!s.dead){
        const hit=w.shotHit(s.x,s.y,7,px0,py0,s.hits);
        if(!hit)break;
        this.primaryDamage(hit,s.dmg,w.hitX,w.hitY,'red');
        s.hits?.add(hit.id);
        if((s.pierce??0)>0&&!hit.invulnerable)s.pierce!--;
        else{s.x=w.hitX;s.y=w.hitY;s.dead=true;}
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);

    if (!this.alive) return;
    // 青光束：贯穿
    if (this.laserOn > 0 && this.weapon==='blue' && this.firing) {
      const g = this.gun('gun');
      const hw = (7 + lv * 2.2) * this.laserOn*(w.progression.has('guanri')?1.5:1)*(w.skills.boosted?2:1);
      const dps = (24+(lv-1)*40/7) * (.82+.18*this.focusCharge)*(w.skills.boosted?1.6:1);
      const hits:{e:Enemy;x:number;y:number}[]=[];
      for(const e of w.enemies)if(w.targetable(e,true)&&w.hitSegment(e,g.x,g.y,g.x+Math.tan(this.beamTilt)*(g.y+60),-60,hw))hits.push({e,x:w.hitX,y:w.hitY});
      hits.sort((a,b)=>b.y-a.y);
      let split=false;this.beamEndY=-40;
      for(let i=0;i<hits.length;i++){
        const h=hits[i],amount=dps*dt*this.laserOn*(w.progression.has('guanri')?1:Math.pow(.66,i));
        if(!h.e.invulnerable&&w.progression.has('guanri'))w.progression.trigger('guanri',h.x,h.y);
        if(!split&&w.progression.isLarge(h.e)){split=true;w.progression.splitBeam(h.e,h.x,h.y,hw,amount);}
        this.primaryDamage(h.e,amount,h.x,h.y,'blue');
        if(h.e.invulnerable){this.beamEndY=h.y;break;}
      }
    }
    // 雷弧
    if (this.weapon === 'purple' && this.firing) {
      const n = Math.max(1, this.thunderTargets.length);
      const per = (20 + (lv-1)*34/7) * (n === 1 ? 1 : 1.25 / n)*(w.skills.boosted?1.6:1);
      for (const e of this.thunderTargets) {
        this.primaryDamage(e, per * dt, e.x, e.y + e.radius*.65,'purple');

      }
      if (!this.thunderTargets.length) {
        // 无目标：向前喷出短雷弧，扫到的敌人受伤
        const g = this.gun('gun');
        const struck=new Set<Enemy>();
        for (const side of [-1, 1]) {
          const ex = g.x + side * 70, ey = g.y - 280;
          for (const e of w.enemies) {
            if (!struck.has(e) && w.targetable(e,true) && w.hitSegment(e,g.x,g.y,ex,ey,18)) {struck.add(e);this.primaryDamage(e,per*.6*dt,w.hitX,w.hitY,'purple');}
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ 炸弹「泼墨」

  bomb(): void {
    const w = this.w;
    if(w.bossCombat.inputLocked||w.mantra.bombBlocked||this.bombT>0){w.audio.sfx('menu_back',{vol:.3});return;}
    if (this.bombs <= 0 || !this.alive) return;
    this.bombs--;
    this.bombT = 3.0;
    this.invuln = Math.max(this.invuln, 3.4);
    w.clearBullets(true, { x: this.x, y: this.y, r: 180 });
    w.bombsUsed++;
    w.progression.onBomb();
    w.combos.record('bomb');
    w.bossCombat.budget.beginBomb(this.weapon);w.mantra.start();
  }

  // ------------------------------------------------------------ 死亡与重生

  /** 撞机扣 1 格羽甲并弹开，不掉火力；普通敌机承受碰撞伤害。 */
  collideWith(enemy: Enemy): void {
    const w = this.w;
    if (!this.alive || this.invuln > 0 || w.brush.protected) return;
    this.hit();
    if (!this.alive) return;
    const x = this.x, y = this.y;
    let dx = x - enemy.x, dy = y - enemy.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) { dx = 0; dy = 1; }
    else { dx /= length; dy /= length; }
    this.x = clamp(x + dx * 60, 26, PLAY_W - 26);
    this.y = clamp(y + dy * 60, 50, PLAY_H - 36);
    let body = enemy;
    while (body.parent) body = body.parent;
    if (!body.def.boss && !enemy.phaseLock) w.damage(enemy, 50, x, y, false, 'neutral');
    w.fx.shockwave(x, y, 60, 6, .3);
    w.fx.shake(.2);
    w.ui.popup(this.x, this.y - 40, '撞机 · 弹开', 'info');
  }

  /** 所有致死入口（弹幕、激光、撞机、Boss 机制判死）统一走这里：扣 1 格羽甲，掉光才掉命。 */
  hit(): void {
    const w = this.w;
    if (!this.alive || this.invuln > 0 || w.brush.protected) return;
    const boss=w.enemies.find(e=>e.data.bossCombat&&!e.dead);if(boss)boss.data.playerHits=(boss.data.playerHits??0)+1;
    w.noMiss = false;
    this.armor--;
    this.hurtAt = w.real;
    this.hurtSeq++;
    if (this.armor <= 0) { this.lose(); return; }
    this.invuln = 1.5;
    w.fx.flash(0.12, [1, 0.25, 0.2]);
    w.fx.shake(0.2);
    w.fx.burst(this.x, this.y, 10, 120, [1, 0.9, 0.8], 0.4);
    w.audio.sfx('graze', { vol: 0.8 });
  }

  private lose(): void {
    const w = this.w;
    this.alive = false;
    this.lives--;
    this.respawnT = 1.4;
    w.fx.explosion(this.x, this.y, 'l', 'fire');
    w.fx.flash(0.6, [1, 0.3, 0.2]);
    w.fx.aberration(1);
    w.audio.sfx('player_die');
    w.brush.cancel();w.roll.cancel();w.skills.clearEffects();
    const preserved=w.progression.onDeath();
    w.items.spawn('p', this.x, this.y);
    if(!preserved)this.power = Math.max(1, this.power - 2);
    this.missile = Math.max(0, this.missile - 1);
    if(!preserved)w.clearBullets(false);
    if (this.lives < 0) w.onGameOver();
  }

  respawn(): void {
    this.alive = true;
    this.x = PLAY_W / 2;
    this.y = PLAY_H + 60;
    this.entering = 0.9;
    this.invuln = 3.2;
    this.armor = 3;
    this.bombs = Math.max(this.bombs, 3);
    this.bank = 0;
  }

  // ------------------------------------------------------------ 绘制

  draw(r: Renderer, time: number): void {
    const w = this.w;
    for (const s of this.shots) {
      if (s.missile) {
        r.air.add('player_missile', { x: s.x, y: s.y, rot: Math.atan2(s.vy, s.vx) + Math.PI / 2, glow: 1.5 });
        continue;
      }
      const speed=Math.hypot(s.vx,s.vy),dx=s.vx/speed,dy=s.vy/speed;
      const size=w.skills.boosted?1.65:1;
      r.shotArt.add('player_primary_art',{x:s.x-dx*21*size,y:s.y-dy*21*size,
        rot:Math.atan2(s.vy,s.vx)+Math.PI/2,frame:PRIMARY_SHOT_FRAME[s.color],sx:42/72*size,sy:42/72*size,glow:0});
    }
    if(!this.echo)for(const hit of this.primaryHits){
      const spread=clamp((hit.age-.06)/.1,0,1),size=hit.size*(1+spread*.55);
      r.shotArt.add('player_primary_art',{x:hit.x,y:hit.y,frame:PRIMARY_HIT_FRAME[hit.color]+(hit.age>=.06?1:0),
        sx:size,sy:size,alpha:1-spread,glow:0});
    }
    if (!this.alive) return;
    let frame = clamp(Math.round((this.bank + 1) * 2), 0, 4);
    if (this.sprite.frames.length === 16) { // 正式分镜：待机 0-3 循环，左倾 4-7、右倾 12-15 保持末帧
      frame = this.bank < -.35 ? 4 + Math.min(3, Math.floor((-this.bank - .35) * 6)) : this.bank > .35 ? 12 + Math.min(3, Math.floor((this.bank - .35) * 6)) : Math.floor(time * 10) % 4;
    }
    const blink = !this.echo && w.roll.protectionRemaining<=0 && this.invuln > 0 && Math.floor(time * 20) % 2 === 0;
    const inkBody=!this.echo&&w.brush.protected,restore=inkBody?1-clamp(w.brush.protectionRemaining/.3,0,1):1;
    const alpha = this.echo?(w.skills.mirrorFlash>0?.9:.45):inkBody ? .55+.45*restore : blink ? .35 : 1;
    if(inkBody)r.player.add(this.sprite,{x:this.x,y:this.y,frame,sx:1.09,sy:1.09,r:.12,g:.18,b:.17,alpha:.28*(1-restore),glow:0});
    r.shadows.add(this.sprite, { x: this.x, y: this.y, frame, alpha });
    const tint=inkBody?.18+.82*restore:1;
    const mix=clamp((w.presentationTime-this.colorChangedAt)/.15,0,1);
    const body={x:this.x,y:this.y,frame,sx:this.echo?1+Math.sin(time*9)*.018:w.roll.scaleX,sy:this.echo?1+Math.cos(time*8)*.018:1,flash:this.echo?w.skills.mirrorFlash*5:Math.max(w.roll.flash,clamp(1-(w.real-this.hurtAt)/.2,0,1)*3),r:tint,g:tint*(!this.echo&&w.skills.boosted?.4:1),b:tint*(!this.echo&&w.skills.boosted?.2:1),glow:inkBody?restore*(.7+this.weaponLevel*.045):.7+this.weaponLevel*.045};
    if(mix<1)r.player.add(r.atlas.get(`player_body_${this.previousColor}`),{...body,alpha:alpha*(1-mix)});
    r.player.add(!this.echo&&w.skills.boosted?'player_body_red':this.sprite,{...body,alpha:alpha*mix});
    if(!this.echo)r.impact.armor(this.x,this.y,this.weaponLevel,this.weapon,this.bank,inkBody?alpha*restore:alpha);
    if (this.focus || w.brush.active) {
      r.bullets.add(this.x, this.y, 0, 4.5, 0, 1.6, 0.25, 0.15, 1, 1, 0.5);
    }
    // 青光束
    if (this.laserOn > 0) {
      const g = this.gun('gun');
      const hw = (7 + this.weaponLevel * 2.2) * this.laserOn*(w.progression.has('guanri')?1.5:1)*(w.skills.boosted?2:1);
      const flick = 0.9 + 0.1 * Math.sin(time * 90);
      r.ribbonMid.line(g.x, g.y, g.x+Math.tan(this.beamTilt)*(g.y-this.beamEndY), this.beamEndY, hw * .65 * flick, RS.Glow, 0.02, 0.22, 0.16, 0.09);
      r.ribbonMid.line(g.x, g.y, g.x+Math.tan(this.beamTilt)*(g.y-this.beamEndY), this.beamEndY, hw * (.12+.1*this.focusCharge), RS.Trail, 0.08, 0.9, 0.85, .22);

    }
    // 雷弧
    if (this.weapon === 'purple' && this.firing) this.drawThunder(r, time);
    else this.bolts.length = 0;
  }

  private drawThunder(r: Renderer, time: number): void {
    const w = this.w, lv = this.weaponLevel;
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
        r.thunder.path(t.pts, t.w.map(x=>x*.35), .18, phase);
        for (let j = 0; j < branches.length; j++) {
          const br = branches[j];
          r.ribbonMid.strip(br.pts, br.w.map(x => x * 3), RS.Glow, 0.35, 0.06, 0.8, 0.045);
          r.thunder.path(br.pts, br.w.map(x=>x*.5), 0.2, phase + j * 1.6, true);
        }
        const n = t.pts.length / 2;
        for (let i = 2; i < n - 2; i += 5) {
          r.lights.add(t.pts[i * 2], t.pts[i * 2 + 1], 130, 0.32, 0.14, 0.68);
        }
      }
    }
  }
}
