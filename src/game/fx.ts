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
interface Charger { x: number; y: number; r: number; t: number; dur: number; c: RGB }

const K: Record<ExplosionSize, number> = { s: 1, m: 2, l: 3.4, xl: 5.5 };
// 火球粒子的散布半径与寿命；xl 对应 Boss 爆炸。
const FIRE_R: Record<ExplosionSize, number> = { s: 30, m: 58, l: 100, xl: 180 };
const FIRE_DUR: Record<ExplosionSize, number> = { s: .5, m: .65, l: .85, xl: 1.15 };

export class FxSystem implements Fx {
  private damageStates = new WeakMap<Enemy,DamageState>();
  private waves: WaveFx[] = [];
  private chargers: Charger[] = [];
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
    const lowKind = p.kind === PK.Ink || p.kind === PK.Smoke || p.kind === PK.SmokeShape || p.kind === PK.Shard || p.kind === PK.Debris || p.kind === PK.Petal;
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
    const k=K[size], sk=Math.sqrt(k), radius=FIRE_R[size], life=FIRE_DUR[size];
    const cold=palette==='cyan', electric=palette==='violet';
    const color:RGB=cold?[.18,1.1,.85]:electric?[.95,.3,1.5]:[1.8,.65,.12];
    // 六层粒子：短闪、翻卷火球、上浮软烟、径向火星、坠落碎片、扩散光环。
    // 火焰与烟团复用 ParticleSystem 构造时上传的软边图集。
    this.radial(x,y,this.n(4+1.5*k),35*sk,150*sk,{life,drag:3,size:radius*.45,sizeEnd:radius*.6,spin:1.5,r:1,g:.23,b:.009,r1:.48,g1:.038,b1:.003,a:1,kind:PK.Fireball},radius*.4,.45);
    this.radial(x,y,this.n(3+3*k),25*sk,85*sk,{life:life+1.1,delay:.02,drag:2.4,grav:-28,size:radius*.4,sizeEnd:radius*.92,spin:.45,r:.28,g:.25,b:.23,r1:.15,g1:.13,b1:.11,a:chapterInk?.63:.55,kind:PK.SmokeShape},radius*.25,.4);
    this.radial(x,y,this.n(18*k),220*sk,650*sk,{life:.48+.06*k,drag:2.6,grav:70,size:2.6,sizeEnd:.5,r:2.2,g:1.65,b:.22,r1:.75,g1:.3,b1:.015,kind:PK.FireSpark},radius*.12);
    this.radial(x,y,this.n(8*k),50*sk,170*sk,{life:1.1,drag:1.6,grav:-30,size:2.2,sizeEnd:.4,r:1.8,g:1.25,b:.12,r1:.45,g1:.15,b1:.01,kind:PK.FireSpark});
    this.radial(x,y,this.n(5*k),110*sk,330*sk,{life:.75+.13*k,drag:1.2,grav:280,size:3.5*sk,sizeEnd:1.5,spin:9,r:.18,g:.075,b:.025,r1:.075,g1:.03,b1:.008,kind:PK.Debris},radius*.12);
    this.emitHigh({x,y,life:.25+.035*k,size:8,sizeEnd:radius*1.9,r:.7,g:.25,b:.035,a:.65,kind:PK.ShockRing});
    this.emitHigh({x,y,life:.09+.01*k,size:radius*.7,sizeEnd:radius*1.3,r:3,g:2.6,b:1.6,a:.85,kind:PK.Dot});
    this.shockwave(x,y,radius*2.1,2.0*sk,.32+.04*k);
    this.r.lights.pulse(x,y,radius*3.5,color[0]*sk*.35,color[1]*sk*.35,color[2]*sk*.35,.35);
    this.shake([.04,.14,.32,.6][['s','m','l','xl'].indexOf(size)]);
    if(k>=3)this.flash(k>=5?.055:.025,color);
    this.audio.sfx(size==='s'?'explode_s':size==='m'?'explode_m':size==='l'?'explode_l':'explode_boss',{pan:(x/PLAY_W*2-1)*.6});
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
      if(armorHit){
        this.radial(x,y,this.n(5),70,160,{life:.22,drag:5,size:2,r:c[0],g:c[1],b:c[2],kind:PK.Spark});
      }else if(visual==='red'){
        this.radial(x,y,this.n(9),120,360,{life:.24,drag:4,size:2.2,sizeEnd:.4,r:2,g:.65,b:.08,kind:PK.Spark});
        this.radial(x,y,this.n(3),25,85,{life:.22,drag:3,size:13,sizeEnd:21,spin:2,r:1.4,g:1,b:.8,a:.8,kind:PK.FlameTex},4);
      }else if(visual==='blue'){
        this.radial(x,y,this.n(7),130,300,{life:.22,drag:4,size:2.4,sizeEnd:.4,spin:10,r:.1,g:1.3,b:1.1,kind:PK.StarTex});
      }else if(visual==='purple'){
        this.radial(x,y,this.n(3),35,130,{life:.12,drag:3,size:14,sizeEnd:6,spin:7,r:1.0,g:.35,b:1.8,kind:PK.SparkTex},7);
      }else this.hit(x,y,c,4);

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
      }else if(s.blocked)this.r.impact.hit(x,y,s.visual,age,true,enemy.alpha);
      else if(s.visual==='blue'&&age<.2){
        const fade=(1-age/.2)*enemy.alpha,angle=enemy.angle+s.angle-.55;
        const dx=Math.cos(angle)*(18+age*95),dy=Math.sin(angle)*(18+age*95);
        this.r.ribbonTop.line(x-dx,y-dy,x+dx,y+dy,5,RS.Glow,.06,1.2,.9,fade*.65);
        this.r.ribbonTop.line(x-dx,y-dy,x+dx,y+dy,1.5,RS.Beam,.7,1.7,1.4,fade);
      }else if(s.visual==='purple'&&age<.15){
        const fade=(1-age/.15)*enemy.alpha*(Math.floor(age*55)%2?.5:1);
        for(let j=0;j<3;j++){
          const a=s.angle+j*2.094,cs=Math.cos(a),sn=Math.sin(a),pts:number[]=[];
          for(let i=0;i<5;i++){const along=i*7,side=i%2===0?0:(j%2?5:-5);pts.push(x+cs*along-sn*side,y+sn*along+cs*side);}
          this.r.ribbonTop.strip(pts,3,RS.Glow,.75,.18,1.5,fade*.7);
          this.r.ribbonTop.strip(pts,1,RS.Lightning,1.3,.8,2,fade);
        }
      }
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
    this.r.fireballs.clear();
    this.r.inkBursts.clear();
    this.r.debris.clear();
    this.r.thunder.clear();
  }
}
