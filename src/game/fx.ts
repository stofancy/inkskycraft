// 特效系统：爆炸、火花、墨、冲击波、震屏、闪白、色差。组合 GPU 粒子、墨流体与后处理。
import type { Rng } from '../core/math';
import { PK, type ParticleSpec, type ParticleSystem } from '../gl/particles';
import { RS } from '../gl/ribbons';
import type { Renderer } from '../gl/renderer';
import { PLAY_W, type DamageSource, type GameAudio, type WeaponColor } from '../types';
import type { Fx, ExplosionPalette } from './api';
import type { Enemy } from './enemy';
import type { ExplosionSize } from './enemy';

interface Scar { x:number; y:number; angle:number; size:number; source:DamageSource; visual:Exclude<DamageSource,'bomb'|'qte'>; time:number; blocked:boolean; armor:boolean }
interface DamageState { scars:Scar[]; next:Partial<Record<DamageSource,number>> }
type RGB = [number, number, number];

interface WaveFx { x: number; y: number; r: number; str: number; t: number; dur: number }
interface InkDrop { t: number; x: number; y: number; r: number; d: number }
interface Charger { x: number; y: number; r: number; t: number; dur: number; c: RGB }

const K: Record<ExplosionSize, number> = { s: 1, m: 2, l: 3.4, xl: 5.5 };
/** 体积火球：最大半径与寿命（按规格）。 */
const FIRE_R: Record<ExplosionSize, number> = { s: 30, m: 58, l: 110, xl: 290 };
const FIRE_DUR: Record<ExplosionSize, number> = { s: 0.95, m: 1.3, l: 1.9, xl: 2.9 };
const NEON: RGB[] = [[0.3, 1.5, 1.9], [1.8, 0.3, 1.4], [0.9, 0.45, 2.0]];

export class FxSystem implements Fx {
  private damageStates = new WeakMap<Enemy,DamageState>();
  private waves: WaveFx[] = [];
  private chargers: Charger[] = [];
  /** 火球转墨烟时衔接的墨流体 splat（延时）。 */
  private inkDrops: InkDrop[] = [];
  trauma = 0;
  private downward=0;
  flashAmt = 0;
  flashCol: RGB = [1, 0.95, 0.85];
  caAmt = 0;
  /** 粒子数量倍率（画质）。 */
  density = 1;
  shakeEnabled = true;
  private low: ParticleSystem;
  private high: ParticleSystem;

  constructor(readonly r: Renderer, readonly audio: GameAudio, readonly rng: Rng) {
    this.low = r.partLow;
    this.high = r.partHigh;
  }

  private n(count: number): number {
    return Math.round(count * this.density);
  }

  private rr(a: number, b: number): number {
    return a + (b - a) * this.rng.next();
  }

  /** 按粒子类型自动选择层：墨/烟/花瓣/碎片在低层，其余在高层。 */
  emit(p: ParticleSpec): void {
    const lowKind = p.kind === PK.Ink || p.kind === PK.Smoke || p.kind === PK.SmokeShape || p.kind === PK.Shard || p.kind === PK.Petal;
    (lowKind ? this.low : this.high).emit(p);
  }

  /** 发往高层（盖在墨、敌机之上）的任意粒子。 */
  emitHigh(p: ParticleSpec): void {
    this.high.emit(p);
  }

  private radial(x: number, y: number, count: number, s0: number, s1: number, base: Omit<ParticleSpec, 'x' | 'y'>, jitter = 0, sizeJ = 0.4): void {
    for (let i = 0; i < count; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const sp = this.rr(s0, s1);
      const j = jitter * Math.sqrt(this.rng.next());
      const sz = base.size * (1 - sizeJ + 2 * sizeJ * this.rng.next());
      this.emit({
        ...base,
        x: x + Math.cos(a) * j, y: y + Math.sin(a) * j,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        size: sz, sizeEnd: base.sizeEnd !== undefined ? base.sizeEnd * sz / base.size : undefined,
        life: base.life * this.rr(0.7, 1.3),
        rot: this.rng.next() * 6.28,
      });
    }
  }

  explosion(x: number, y: number, size: ExplosionSize, palette: ExplosionPalette = 'neon', chapterInk = false): void {
    const k = K[size];
    const sk = Math.sqrt(k);
    const ink = chapterInk || palette === 'ink';
    const cold = !chapterInk && palette === 'cyan', electric = !chapterInk && palette === 'violet';
    const color: RGB = cold ? [0.12,1.6,1.05] : electric ? [1.2,0.25,1.8] : [2.2,1.2,0.32];
    // 体积火球（主体）：黑体火球 → 受光烟团 → 墨烟；墨系爆炸以墨黑翻卷为主，带朱红余烬
    const R = FIRE_R[size] * (ink ? 1.1 : 1), dur = FIRE_DUR[size] * (ink ? 1.25 : 1);
    if (chapterInk) this.r.inkBursts.spawn(this.high.time,x,y,size,this.rr(-.25,.25));
    else this.r.fireballs.spawn(this.high.time, x, y, R, dur, this.rng.next(), ink ? 1 : 0, palette === 'fire' ? 1.1 : 0.85, palette);
    if (!cold && !electric) this.inkDrops.push({ t: dur * 0.5, x, y, r: R * 0.5, d: ink ? 0.85 : 0.6 });
    if (!cold && !electric && k >= 3) for (let i = 0; i < (k >= 5 ? 3 : 1); i++) {
      const a = this.rng.next() * 6.28, d = R * this.rr(0.25, 0.5);
      this.inkDrops.push({ t: dur * this.rr(0.42, 0.6), x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: R * 0.3, d: 0.5 });
    }
    // 点火闪光短促收住，让翻卷体积的明暗面在爆发后显露。
    this.emitHigh({ x, y, life: 0.10 + 0.008 * k, size: 12 * sk, sizeEnd: 30 * sk, r: color[0], g: color[1], b: color[2], a: 0.65, kind: PK.Dot });
    if (cold || electric) {
      this.radial(x,y,this.n(18*k),180*sk,650*sk,{life:cold?0.6:0.35,drag:2.8,size:cold?4:2.4,spin:cold?8:0,r:color[0],g:color[1],b:color[2],r1:color[0]*.18,g1:color[1]*.18,b1:color[2]*.18,kind:cold?PK.Shard:PK.SparkTex});
    } else if (!ink) {
      // 火花（HDR 头 + 运动模糊尾）
      this.radial(x, y, this.n(24 * k), 260 * sk, 900 * sk, { life: 0.6, drag: 3.0, size: 5, r: 1.8, g: 1.0, b: 0.3, r1: .7, g1: .18, b1: .04, kind: PK.SparkTex });
      // 余烬（上浮）
      this.radial(x, y, this.n(10 * k), 40 * sk, 220 * sk, { life: 1.6, drag: 1.6, grav: -40, size: 2.2, r: 2.2, g: 0.8, b: 0.18, r1: 0.6, g1: 0.1, b1: 0.02, kind: PK.Ember });
    } else {
      // 朱红余烬
      this.radial(x, y, this.n(14 * k), 50 * sk, 260 * sk, { life: 1.7, drag: 1.5, grav: -30, size: 2.4, r: 2.4, g: 0.24, b: 0.06, r1: 0.6, g1: 0.05, b1: 0.01, kind: PK.Ember });
    }
    if (!chapterInk && palette === 'neon') {
      for (let i = 0; i < this.n(7 * k); i++) {
        const c = this.rng.pick(NEON);
        const a = this.rng.next() * 6.28, sp = this.rr(300, 1000) * sk;
        this.emitHigh({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.5, life: this.rr(0.4, 0.9), size: 3, r: c[0], g: c[1], b: c[2], r1: c[0] * 0.3, g1: c[1] * 0.3, b1: c[2] * 0.3, kind: PK.Spark });
      }
    }
    // 厚甲片沿三维轨迹抛出；少量大的断面带出尺度，细余烬衬托体积主体。
    this.r.debris.spawn(this.high.time, x, y, sk, this.n((ink ? 3 : 7) * k), this.rng.next(), chapterInk?'ink':palette);
    // 烟与墨滴（低层）：体积烟团之外的细碎墨点
    this.radial(x, y, this.n((ink ? 16 : 8) * k), 150 * sk, 520 * sk, { life: 1.2, drag: 4, grav: 160, size: 5 * sk, sizeEnd: 2, r: 0.02, g: 0.018, b: 0.016, a: 0.92, kind: PK.Ink });
    // 墨流体：一团墨 + 径向冲开 + 余光
    const fl = this.r.fluid;
    fl.splat({ x, y, r: 18 * sk + 6, radial: true, vx: 420 * sk, ink: [0.015, 0.012, 0.012, ink ? 0.9 : 0.55], glow: ink ? undefined : [color[0]*.45*sk,color[1]*.45*sk,color[2]*.45*sk] });
    if (!chapterInk && palette === 'neon' && k >= 2) {
      const c = this.rng.pick(NEON);
      fl.splat({ x, y, r: 26 * sk, glow: [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5] });
    }
    this.shockwave(x, y, 70 * k, 5 * sk, 0.35 + 0.08 * k);
    // 大爆炸：短暂热浪扭曲（宽而弱的第二道波）
    if (k >= 3) this.shockwave(x, y, R * 1.25, k >= 5 ? 5 : 2.4, k >= 5 ? 1.3 : 0.8);
    // 3D 背景的动态光源
    const li = ink ? 0.25 : [0.6, 0.9, 1.3, 1.6][['s', 'm', 'l', 'xl'].indexOf(size)];
    this.r.lights.pulse(x, y, [150, 220, 330, 520][['s', 'm', 'l', 'xl'].indexOf(size)], color[0] * li, color[1] * li, color[2] * li, 0.5 + 0.1 * k);
    this.shake([0.04, 0.14, 0.32, 0.6][['s', 'm', 'l', 'xl'].indexOf(size)]);
    if (k >= 3) this.flash(k >= 5 ? 0.07 : 0.025,color);
    const pan = (x / PLAY_W) * 2 - 1;
    this.audio.sfx(size === 's' ? 'explode_s' : size === 'm' ? 'explode_m' : size === 'l' ? 'explode_l' : 'explode_boss', { pan: pan * 0.6 });
    // 形状层沿爆点翻卷：保留体积主体，小中大按同一尺度递增。
    const shapeColor:RGB = cold ? [.18,.85,.65] : electric ? [.68,.3,.9] : ink ? [1.05,.24,.065] : [1.5,.55,.12];
    this.radial(x,y,this.n(4*k),25*sk,125*sk,{life:.46,drag:3,size:18*sk,sizeEnd:30*sk,spin:1.1,r:shapeColor[0],g:shapeColor[1],b:shapeColor[2],r1:shapeColor[0]*.3,g1:shapeColor[1]*.2,b1:shapeColor[2]*.2,a:.65,kind:PK.FireShape},10*sk);
    this.radial(x,y,this.n(3*k),35*sk,110*sk,{life:1.15,drag:2,grav:-22,size:14*sk,sizeEnd:36*sk,spin:.4,r:.095,g:.08,b:.065,a:.48,kind:PK.SmokeShape},14*sk);
    this.emitHigh({x,y,life:.12,size:25*sk,sizeEnd:36*sk,r:shapeColor[0],g:shapeColor[1],b:shapeColor[2],a:.4,kind:PK.FlareTex});
    if(cold||electric)this.emitHigh({x,y,life:.32,size:22*sk,sizeEnd:45*sk,rot:this.rr(-1,1),spin:1.2,r:shapeColor[0],g:shapeColor[1],b:shapeColor[2],a:.35,kind:PK.TwirlTex});
  }

  /** 每个敌人保存本地坐标伤痕；连续武器按来源节流，阻挡保留反弹标识。 */
  onDamage(enemy:Enemy,source:DamageSource,x:number,y:number,actualAmount:number,blocked=false,inkColor?:WeaponColor):void {
    let state=this.damageStates.get(enemy);
    if(!state){state={scars:[],next:{}};this.damageStates.set(enemy,state);}
    const now=this.high.time;
    if(now < (state.next[source] ?? -1))return;
    state.next[source]=now+(blocked?.16:source==='red'?.065:.11);
    const armorHit=!!enemy.data.hitArmor;
    const visual=source==='ink'&&inkColor?inkColor:source==='qte'||source==='bomb'?'ink':source;
    const c:RGB=armorHit?[.75,.78,.82]:visual==='blue'?[.1,1.45,1.0]:visual==='purple'?[1.1,.3,1.6]:visual==='red'?[2.0,.45,.06]:source==='companion'?[1.8,.55,.15]:[.7,.34,.12];
    if(!blocked){
      // 主体形状由 drawDamage 画；少量粒子补上各自材质的飞散。
      this.radial(x,y,this.n(armorHit?5:enemy.data.copperPart?14:6),armorHit?70:110,armorHit?160:320,{life:armorHit?.22:source==='blue'?.24:.2,drag:5,size:armorHit?2:enemy.data.copperPart?4:2.5,spin:source==='blue'?9:0,r:c[0],g:c[1],b:c[2],kind:PK.Spark});
      this.radial(x,y,this.n(2),60,180,{life:.22,drag:5,size:8,sizeEnd:4,r:c[0]*.7,g:c[1]*.7,b:c[2]*.7,a:.7,kind:PK.SparkTex});
      this.emitHigh({x,y,life:.045,size:12,sizeEnd:18,r:c[0]*.7,g:c[1]*.7,b:c[2]*.7,a:.45,kind:PK.FlareTex});
      if(!armorHit&&visual==='blue')this.emitHigh({x,y,life:.22,size:3,sizeEnd:20,r:.2,g:1.3,b:1.4,a:.32,kind:PK.Ring});
      if(!armorHit&&visual==='red')this.emit({x,y,vx:this.rr(-45,45),vy:this.rr(-25,40),life:.22,size:2,sizeEnd:1,r:.02,g:.015,b:.012,a:.65,kind:PK.Ink});
    }
    const cs=Math.cos(enemy.angle),sn=Math.sin(enemy.angle),dx=x-enemy.x,dy=y-enemy.y;
    const lx=(dx*cs+dy*sn)/(enemy.scaleX||1),ly=(-dx*sn+dy*cs)/(enemy.scaleY||1);
    const existing=state.scars.find(s=>s.source===source&&s.visual===visual&&Math.hypot(s.x-lx,s.y-ly)<12&&s.blocked===blocked&&s.armor===armorHit);
    if(existing){existing.time=now;existing.size=Math.min(18,existing.size+Math.max(0,actualAmount)*.12);}
    else {state.scars.push({x:lx,y:ly,angle:this.rr(-1,1),size:blocked?6:Math.min(16,7+actualAmount*.6),source,visual,time:now,blocked,armor:armorHit});if(state.scars.length>12)state.scars.shift();}
    if(!armorHit&&!blocked && actualAmount>0 && this.rng.next()<.28)this.r.debris.spawn(now,x,y,.32,source==='blue'?2:1,this.rng.next(),source==='blue'?'cyan':source==='purple'?'violet':'fire');
  }

  drawDamage(enemy:Enemy,_time:number):void {
    const state=this.damageStates.get(enemy);if(!state)return;
    // 与出生时间同用世界时钟，慢放和暂停保持播放相位。
    const time=this.high.time;
    const cs=Math.cos(enemy.angle),sn=Math.sin(enemy.angle);
    for(const s of state.scars){
      const age=Math.max(0,time-s.time);if((s.blocked||s.armor)&&age>.28)continue;
      const dx=s.x*enemy.scaleX,dy=s.y*enemy.scaleY;
      const x=enemy.x+dx*cs-dy*sn,y=enemy.y+dx*sn+dy*cs;
      if(s.armor){
        const fade=Math.max(0,1-age/.22)*enemy.alpha;
        if(fade>0)for(let i=0;i<5;i++){const a=s.angle+i*Math.PI*2/5,from=4+age*80,to=from+12;this.r.ribbonTop.line(x+Math.cos(a)*from,y+Math.sin(a)*from,x+Math.cos(a)*to,y+Math.sin(a)*to,2,RS.Trail,.8,.84,.9,fade);}
      }else this.r.impact.hit(x,y,s.visual,age,s.blocked,enemy.alpha);
      if(s.blocked||s.armor)continue;
      this.r.impact.scar(x,y,enemy.angle+s.angle,s.size,s.visual,Math.exp(-age*3.5),enemy.alpha*.85);
    }
  }

  shockwave(x: number, y: number, radius: number, strength = 6, duration = 0.45): void {
    // 炸弹级冲击波（半径 ≥ 600）：大范围红光
    if (radius >= 600) this.r.lights.pulse(x, y, 620, 1.1, 0.35, 0.2, 1.6);
    if (this.waves.length >= 16) this.waves.shift();
    this.waves.push({ x, y, r: radius, str: strength, t: 0, dur: duration });
  }

  flash(amount: number, color: RGB = [1, 0.95, 0.85]): void {
    if (amount >= this.flashAmt) this.flashCol = color;
    this.flashAmt = Math.min(1.5, Math.max(this.flashAmt, amount));
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }
  downwardShake(amount:number):void {this.trauma=Math.max(this.trauma,amount);this.downward=.22;}

  aberration(amount: number): void {
    this.caAmt = Math.min(1, Math.max(this.caAmt, amount));
  }

  ink(x: number, y: number, radius: number, density = 0.6, color: RGB = [0.015, 0.012, 0.012]): void {
    this.r.fluid.splat({ x, y, r: radius, ink: [color[0], color[1], color[2], density] });
  }

  push(x: number, y: number, vx: number, vy: number, radius: number): void {
    this.r.fluid.splat({ x, y, r: radius, vx, vy });
  }

  glowSplat(x: number, y: number, radius: number, c: RGB): void {
    this.r.fluid.splat({ x, y, r: radius, glow: c });
  }

  burst(x: number, y: number, count: number, speed: number, color: RGB, life = 0.7): void {
    this.r.lights.pulse(x, y, 130, color[0] * 0.5, color[1] * 0.5, color[2] * 0.5, 0.35);
    this.radial(x, y, this.n(count), speed * 0.3, speed, { life, drag: 2.5, size: 2.8, r: color[0], g: color[1], b: color[2], r1: color[0] * 0.2, g1: color[1] * 0.2, b1: color[2] * 0.2, kind: PK.Spark });
    this.emitHigh({ x, y, life: 0.3, size: 20, sizeEnd: 60, r: color[0], g: color[1], b: color[2], a: 0.8, kind: PK.Dot });
  }

  charge(x: number, y: number, radius: number, sec: number, color: RGB): void {
    this.chargers.push({ x, y, r: radius, t: 0, dur: sec, c: color });
  }

  /** 命中火花。 */
  hit(x: number, y: number, c: RGB = [2.2, 1.4, 0.6], n = 3): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + this.rr(-1.3, 1.3);
      const sp = this.rr(150, 500);
      this.emitHigh({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 6, life: this.rr(0.12, 0.3), size: 2, r: c[0], g: c[1], b: c[2], kind: PK.Spark });
    }
    this.emitHigh({ x, y, life: 0.08, size: 9, sizeEnd: 16, r: c[0] * 0.6, g: c[1] * 0.6, b: c[2] * 0.6, a: 0.8, kind: PK.Dot });
  }

  /** 斩击火花：沿刀光方向甩出的亮线，带一道白色斩弧。 */
  slashSpark(x: number, y: number, angle: number, c: RGB = [2.4, 2.1, 1.6]): void {
    for (let i = 0; i < 12; i++) {
      const a = angle + (i % 2 ? 0 : Math.PI) + this.rr(-.5, .5), sp = this.rr(250, 650);
      this.emitHigh({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 5, life: this.rr(.15, .32), size: 2.5, r: c[0], g: c[1], b: c[2], kind: PK.Spark });
    }
    this.emitHigh({ x, y, life: .1, size: 14, sizeEnd: 30, r: c[0] * .7, g: c[1] * .7, b: c[2] * .7, a: .85, kind: PK.Dot });
    this.emitHigh({ x, y, life: .2, size: 42, sizeEnd: 58, rot:angle-Math.PI/2, r: c[0] * .5, g: c[1] * .5, b: c[2] * .5, a: .7, kind: PK.SlashTex });
  }

  /** 子弹化金的闪光。 */
  gold(x: number, y: number): void {
    this.emitHigh({ x, y, life: 0.35, size: 5, sizeEnd: 16, r: 2.2, g: 1.6, b: 0.5, a: 0.8, kind: PK.Ring });
    this.emitHigh({x,y,life:.2,size:14,sizeEnd:20,r:1.1,g:.7,b:.2,a:.65,kind:PK.StarTex});
    const a = this.rng.next() * 6.28;
    this.emitHigh({ x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 40, drag: 1.5, life: 0.9, size: 3, spin: 8, r: 2.0, g: 1.4, b: 0.4, kind: PK.Leaf });
  }

  /** 每帧更新（dt 为游戏时间，realDt 为真实时间），并写入后处理参数。 */
  update(dt: number, realDt: number, time: number): void {
    for (const d of this.inkDrops) d.t -= dt;
    if (this.inkDrops.length && this.inkDrops.some((d) => d.t <= 0)) {
      for (const d of this.inkDrops) if (d.t <= 0) this.r.fluid.splat({ x: d.x, y: d.y, r: d.r, vx: 50, ink: [0.015, 0.012, 0.012, d.d] });
      this.inkDrops = this.inkDrops.filter((d) => d.t > 0);
    }
    for (const w of this.waves) w.t += dt;
    this.waves = this.waves.filter((w) => w.t < w.dur);
    for (const c of this.chargers) {
      c.t += dt;
      const cu = Math.min(1, c.t / c.dur);
      this.r.lights.add(c.x, c.y, 90 + c.r * 1.2, c.c[0] * 0.7 * cu, c.c[1] * 0.7 * cu, c.c[2] * 0.7 * cu);
      const n = Math.ceil(dt * 90 * this.density);
      for (let i = 0; i < n; i++) {
        const a = this.rng.next() * 6.28, d = c.r * this.rr(0.6, 1.2);
        const life = 0.45;
        this.emitHigh({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, vx: -Math.cos(a) * d / life * 1.1, vy: -Math.sin(a) * d / life * 1.1, life, size: 2.4, r: c.c[0], g: c.c[1], b: c.c[2], kind: PK.Spark });
      }
      if (this.rng.next() < dt * 20) this.emitHigh({ x: c.x, y: c.y, life: 0.2, size: 10 + 30 * (c.t / c.dur), sizeEnd: 4, r: c.c[0], g: c.c[1], b: c.c[2], a: 0.7, kind: PK.Dot });
    }
    this.chargers = this.chargers.filter((c) => c.t < c.dur);

    this.trauma = Math.max(0, this.trauma - realDt * 1.4);
    this.flashAmt = Math.max(0, this.flashAmt - realDt * 3.2);
    this.caAmt = Math.max(0, this.caAmt - realDt * 2.5);

    const post = this.r.post;
    const s = this.shakeEnabled ? this.trauma * this.trauma * 16 : 0;
    post.shake = [s * (Math.sin(time * 71.3) + Math.sin(time * 37.1) * 0.5), s * (Math.cos(time * 63.7) + Math.cos(time * 29.3) * 0.5)];
    if(this.downward>0){post.shake=[post.shake[0]*.25,s*(.5+Math.abs(Math.sin(time*63.7)))];this.downward=Math.max(0,this.downward-realDt);}
    post.zoom = 1 + (this.shakeEnabled ? this.trauma * this.trauma * 0.03 : 0);
    post.flash = this.flashAmt;
    post.flashCol = this.flashCol;
    post.ca = 0.0015 + this.caAmt * 0.012;
    post.waves = this.waves.map((w) => {
      const u = w.t / w.dur;
      return { x: w.x, y: w.y, r: w.r * (1 - (1 - u) * (1 - u)), strength: w.str * (1 - u) * (1 - u), width: 18 + w.r * 0.12 };
    });
  }

  clear(): void {
    this.damageStates = new WeakMap();
    this.waves = [];
    this.chargers = [];
    this.inkDrops = [];
    this.r.fireballs.clear();
    this.r.inkBursts.clear();
    this.r.debris.clear();
    this.r.thunder.clear();
  }
}
