// 执笔三色的持续体与真实时钟。每笔捕获颜色、笔力、数字预算，延迟效果复用同一上下文。
import { segDist2 } from '../core/math';
import { PK } from '../gl/particles';
import { RS } from '../gl/ribbons';
import { burnDraw, burnEmit } from './burn-fx';
import type { WeaponColor, PopupKind } from '../types';
import type { Enemy } from './enemy';
import type { World, InkDamageOptions } from './world';

export const BRUSH_COLORS: Record<WeaponColor, [number, number, number]> = {
  red: [1.8, .4, .1], blue: [.1, 1.3, .9], purple: [1.2, .3, 1.7],
};
export interface BrushCast { id:number; color:WeaponColor; scale:number; x:number; y:number; numbers:number; total:number; keys:Set<string> }
interface Mark { e:Enemy; cast:BrushCast; left:number; duration:number; breakDamage:number; boss:boolean }
interface Burn { e:Enemy; cast:BrushCast; left:number; next:number; age:number }
interface Field { pts:number[]; left:number; next:number; cast:BrushCast; kind:'fire'|'orb' }
interface Network { targets:Enemy[]; cast:BrushCast; left:number; next:number }
interface Wall { pts:number[]; left:number; cast:BrushCast; partner:boolean }
interface Sweep { pts:number[]; cast:BrushCast; seen:Set<Enemy>; left:number; offset:number }
interface Trace { pts:number[]; color:WeaponColor; left:number; duration:number; kind:'sword'|'arc'|'burst'; radius?:number }

export class BrushColors {
  private serial=0;
  private now=0;
  private sealAt=-Infinity;
  readonly marks=new Map<Enemy,Mark>();
  readonly burns=new Map<Enemy,Burn>();
  readonly walls:Wall[]=[];
  private resistance=new Map<Enemy,number>();
  private wallGate=new Map<Enemy,number>();
  private electricGate=new Map<Enemy,number>();
  private netGate=new Map<Enemy,number>();
  private numbers=new Map<Enemy,{at:number; amount:number; key:string}>();
  private fields:Field[]=[];
  private networks:Network[]=[];
  private sweeps:Sweep[]=[];
  private traces:Trace[]=[];
  private pending:{at:number; run:()=>void}[]=[];
  constructor(readonly w:World){}

  cast(pts:number[]):BrushCast {
    let x=0,y=0;for(let i=0;i<pts.length;i+=2){x+=pts[i];y+=pts[i+1];}
    return {id:++this.serial,color:this.w.player.weapon,scale:[1,1.25,1.5][this.w.brush.power.level-1],x:x/(pts.length/2),y:y/(pts.length/2),numbers:0,total:0,keys:new Set()};
  }
  get slow():number {const age=this.now-this.sealAt;return age>=.1-1e-9&&age<.45-1e-9?.25+.75*Math.max(0,age-.1)/.35:1;}
  vulnerability(e:Enemy):number {return this.marks.get(e)?.boss?1.25:e.sealed>0?1.5:1;}
  boss(e:Enemy):boolean {
    for(let owner:Enemy|null=e;owner;owner=owner.parent)if(owner.phaseLock||owner.def.boss)return true;
    return !!(e.data.bossOwner?.phaseLock||e.data.bossOwner?.def.boss);
  }
  damage(e:Enemy,amount:number,cast:BrushCast,options:InkDamageOptions={}):number {
    const actual=this.w.damage(e,amount,e.x,e.y,false,'ink',{...options,inkColor:cast.color,castKey:cast});
    if(actual>0)this.number(e,actual,cast);
    return actual;
  }
  private number(e:Enemy,amount:number,cast:BrushCast):void {
    const old=this.numbers.get(e);
    let value=amount,key:string,x=e.x,y=e.y-52;
    if(old&&this.now-old.at<=.3&&(cast.keys.has(old.key)||cast.keys.size<7)){value+=old.amount;key=old.key;if(!cast.keys.has(key))cast.numbers++;}
    else if(cast.numbers<7){key=`brush:damage:${cast.id}:${++cast.numbers}`;}
    else {cast.total+=amount;value=cast.total;key=`brush:damage:${cast.id}:total`;x=cast.x;y=cast.y-72;cast.numbers=8;}
    cast.keys.add(key);
    if(!key.endsWith(':total'))this.numbers.set(e,{at:this.now,amount:value,key});
    const size=value<50?'small':value<=120?'medium':'large';
    this.w.ui.popup(x,y,`${Math.round(value)}`,`damage-${cast.color}-${size}` as PopupKind,key);
  }
  private along(e:Enemy,pts:number[],width:number):boolean {
    for(let i=0;i<pts.length-2;i+=2)if(segDist2(e.x,e.y,pts[i],pts[i+1],pts[i+2],pts[i+3])<=(width+e.radius)**2)return true;
    return false;
  }
  private nearest(e:Enemy,radius:number,count=1,excluded:ReadonlySet<Enemy>=new Set()):Enemy[] {
    return this.w.enemies.filter(n=>n!==e&&!excluded.has(n)&&this.w.targetable(n)&&Math.hypot(n.x-e.x,n.y-e.y)<=radius).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y)||a.id-b.id).slice(0,count);
  }
  arc(a:{x:number;y:number},b:{x:number;y:number},color:WeaponColor='purple'):void {
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,pts=[a.x,a.y];
    for(let i=1;i<8;i++){const k=i/8,j=(i%2?1:-1)*10;pts.push(a.x+dx*k-dy/d*j,a.y+dy*k+dx/d*j);}pts.push(b.x,b.y);
    this.traces.push({pts,color,left:.28,duration:.28,kind:'arc'});
    this.w.fx.hit(b.x,b.y,BRUSH_COLORS[color],5);
  }
  chain(e:Enemy,amount:number,radius:number,count:number,cast:BrushCast):void {
    for(const n of this.nearest(e,radius,count)){this.arc(e,n,cast.color);this.damage(n,amount*cast.scale,cast);}
  }
  burn(e:Enemy,cast:BrushCast):void {
    if(e.dead)return;const old=this.burns.get(e);
    if(old){old.left=3;old.cast=cast;}else this.burns.set(e,{e,cast,left:3,next:1,age:0});
  }
  field(pts:number[],kind:'fire'|'orb',cast:BrushCast):void {this.fields.push({pts:pts.slice(),kind,cast,left:2,next:.4});}
  burst(x:number,y:number,radius:number,cast:BrushCast,amount=0,scale=true):void {
    if(amount)for(const e of this.w.enemies)if(this.w.targetable(e)&&Math.hypot(e.x-x,e.y-y)<=radius)this.damage(e,amount*(scale?cast.scale:1),cast);
    this.traces.push({pts:[x,y],color:cast.color,left:.42,duration:.42,kind:'burst',radius});
    this.w.fx.burst(x,y,18,270,BRUSH_COLORS[cast.color],.45);
    this.w.fx.shockwave(x,y,radius,5,.4);this.w.fx.ink(x,y,radius*.35,.4);
  }
  beam(x:number,y:number,angle:number,length:number,amount:number,cast:BrushCast):void {
    const pts=[x,y,x+Math.cos(angle)*length,y+Math.sin(angle)*length];
    if(amount>0)for(const e of this.w.enemies)if(this.w.targetable(e)&&this.along(e,pts,18))this.damage(e,amount*cast.scale,cast);
    this.traces.push({pts,color:cast.color,left:.42,duration:.42,kind:'sword'});
  }
  wall(pts:number[],cast:BrushCast,partner=false):void {
    this.walls.push({pts:pts.slice(),left:3,cast,partner});while(this.walls.length>2)this.walls.shift();
    if(!partner&&cast.color==='blue')this.sweeps.push({pts:pts.slice(),cast,seen:new Set(),left:1.3,offset:0});
  }
  /** 返回新封计分资格；抗性期间普通机只刷新控制与印记。 */
  seal(e:Enemy,cast:BrushCast,index:number):boolean {
    const boss=this.boss(e);
    const repeated=this.now-(this.resistance.get(e)??-Infinity)<(boss?8:6);
    e.data.lastSealedAt=this.w.t; // 已有首领脚本使用游戏时钟读取封窗口。
    if(repeated&&!boss){
      const mark=this.marks.get(e);if(mark){mark.left=mark.duration;e.sealed=mark.duration;}
      else {const duration=e.maxHp>=200?1:2;e.sealed=duration;this.marks.set(e,{e,cast,left:duration,duration,breakDamage:0,boss:false});}
      return false;
    }
    if(!repeated)this.resistance.set(e,this.now);
    const blast=boss?Math.max(120,e.maxHp*.35):e.maxHp>=200?Math.max(45,e.maxHp*.12):45;
    const duration=boss?3:e.maxHp>=200?1:2;
    const mark:Mark={e,cast,left:duration,duration,breakDamage:boss?0:30*blast/45,boss};
    this.marks.set(e,mark); // 先登记，让当场击坠也触发封杀；封爆自行忽略易伤。
    this.damage(e,blast*(repeated?.25:1),cast,boss?{unmodified:true}:{armor:'half',ignoreSeal:true,ignoreLoosen:true});
    if(e.dead)return !repeated;
    if(!boss)e.sealed=duration;
    if(boss&&!repeated){e.interrupt(cast.color==='blue'?2:1.5);this.w.ui.popup(e.x,e.y-95,'蓄力打断','chain',`brush:interrupt:${e.id}`);}
    if(!repeated){
      if(cast.color==='red')this.burn(e,cast);
      if(cast.color==='blue')this.pending.push({at:this.now+index*.12,run:()=>{if(e.dead)return;this.beam(e.x,e.y+105,-Math.PI/2,230,0,cast);this.damage(e,35*cast.scale,cast,{unmodified:true});}});
    }
    return !repeated;
  }
  network(targets:Enemy[],cast:BrushCast):void {
    if(cast.color==='purple'&&targets.length)this.networks.push({targets:targets.slice(),cast,left:2,next:.4});
  }
  sealImpact(count:number,boss:boolean):void {this.sealAt=this.now;this.w.hitstop(boss||count>=3?.12:.08);this.w.fx.downwardShake(boss?.9:.7);this.w.fx.aberration(.2);}
  killed(e:Enemy):void {
    const mark=this.marks.get(e);if(!mark)return;
    this.marks.delete(e);e.sealed=0;
    this.shatter(mark,true);this.w.addScore(1500);this.w.ui.popup(e.x,e.y-100,'封杀','chain',`brush:kill:${e.id}`);
  }
  private shatter(mark:Mark,killed=false):void {
    const {e,cast}=mark;this.burst(e.x,e.y,52,cast);
    if(cast.color==='blue')this.beam(e.x,e.y+105,-Math.PI/2,230,0,cast);
    for(const c of Object.values(BRUSH_COLORS))for(let i=0;i<5;i++){const a=this.w.rng.next()*Math.PI*2;this.w.fx.emitHigh({x:e.x,y:e.y,vx:Math.cos(a)*240,vy:Math.sin(a)*240,drag:2,grav:100,life:.6,size:6,spin:8,r:c[0],g:c[1],b:c[2],kind:PK.Shard});}
    if(!killed&&!mark.boss&&mark.breakDamage)this.damage(e,mark.breakDamage,cast,{ignoreSeal:true});
    if(!mark.boss&&mark.breakDamage&&cast.color==='red')this.burst(e.x,e.y,100,cast,40);
    this.w.audio.sfx('hit',{vol:.35,pan:e.x/450-1});
  }
  update(realDt:number,worldDt:number):void {
    this.now+=realDt;
    for(const trace of this.traces)trace.left-=realDt;this.traces=this.traces.filter(v=>v.left>0);
    const due=this.pending.filter(v=>v.at<=this.now);this.pending=this.pending.filter(v=>v.at>this.now);for(const v of due)v.run();
    for(const [e,mark] of this.marks){
      if(e.dead){this.marks.delete(e);continue;}mark.left-=realDt;
      if(!mark.boss)e.sealed=Math.max(0,mark.left);
      if(mark.left<=1e-9){this.marks.delete(e);e.sealed=0;this.shatter(mark);}
    }
    for(const [e,b] of this.burns){
      if(e.dead){this.burns.delete(e);continue;}
      const elapsed=Math.min(realDt,b.left);b.left-=realDt;b.next-=elapsed;
      while(b.next<=1e-9&&!e.dead){this.damage(e,12*b.cast.scale,b.cast,{tag:'burn'});b.next+=1;}
      if(b.left<=1e-9)this.burns.delete(e);
      b.age+=realDt;burnEmit(this.w,e,b.age,realDt);
    }
    for(const wall of this.walls){
      wall.left-=realDt;
      for(const b of this.w.bullets.list){if(b.dead||b.hard||b.delay>0)continue;for(let i=0;i<wall.pts.length-2;i+=2)if(segDist2(b.x,b.y,wall.pts[i],wall.pts[i+1],wall.pts[i+2],wall.pts[i+3])<(12+b.radius)**2){b.dead=true;if(!wall.partner&&wall.cast.color==='red')this.w.fx.burst(b.x,b.y,5,180,BRUSH_COLORS.red,.35);else this.w.fx.gold(b.x,b.y);break;}}
      if(wall.partner||wall.cast.color==='blue')continue;
      for(const e of this.w.enemies)if(this.w.targetable(e)&&this.along(e,wall.pts,16)&&this.now>=(this.wallGate.get(e)??-1)){
        if(wall.cast.color==='red'){this.wallGate.set(e,this.now+.25);this.damage(e,10*wall.cast.scale,wall.cast);this.burn(e,wall.cast);}
        else if(this.now>=(this.electricGate.get(e)??-1)){
          this.wallGate.set(e,this.now+.25);this.electricGate.set(e,this.now+1);this.damage(e,30*wall.cast.scale,wall.cast);
          const n=this.nearest(e,140,this.w.enemies.length).find(n=>this.now>=(this.wallGate.get(n)??-1));
          if(n){this.wallGate.set(n,this.now+.25);this.arc(e,n);this.damage(n,20*wall.cast.scale,wall.cast);}
        }
      }
    }
    for(let i=this.walls.length-1;i>=0;i--)if(this.walls[i].left<=0)this.walls.splice(i,1);
    for(const s of this.sweeps){const prev=s.offset;s.offset+=1100*worldDt;s.left-=worldDt;
      const pts=s.pts.map((v,i)=>i%2?v-s.offset:v);
      for(const e of this.w.enemies)if(!s.seen.has(e)&&this.w.targetable(e)){
        const oldY=e.y;e.y+=s.offset;const on=this.along(e,s.pts,16+Math.abs(s.offset-prev));e.y=oldY;
        if(on){s.seen.add(e);this.damage(e,80*s.cast.scale,s.cast);}
      }
      for(const b of this.w.bullets.list)if(!b.dead&&!b.hard&&b.delay<=0){for(let i=0;i<pts.length-2;i+=2)if(segDist2(b.x,b.y,pts[i],pts[i+1],pts[i+2],pts[i+3])<=(16+b.radius+Math.abs(s.offset-prev))**2){b.dead=true;this.w.brush.paths.drops.push({x:b.x,y:b.y});break;}}
    }this.sweeps=this.sweeps.filter(s=>s.left>0);
    for(const f of this.fields){f.left-=realDt;f.next-=Math.min(realDt,f.left+realDt);
      if(f.kind==='fire'){for(const e of this.w.enemies)if(this.w.targetable(e)&&(f.pts.length===3?Math.hypot(e.x-f.pts[0],e.y-f.pts[1])<=f.pts[2]:this.along(e,f.pts,20)))this.burn(e,f.cast);}
      else while(f.next<=1e-9){f.next+=.4;const nearest=this.w.enemies.filter(e=>this.w.targetable(e)&&Math.hypot(e.x-f.pts[0],e.y-f.pts[1])<=260).sort((a,b)=>Math.hypot(a.x-f.pts[0],a.y-f.pts[1])-Math.hypot(b.x-f.pts[0],b.y-f.pts[1]))[0];if(nearest){this.arc({x:f.pts[0],y:f.pts[1]},nearest);this.damage(nearest,20*f.cast.scale,f.cast);}}
    }this.fields=this.fields.filter(f=>f.left>1e-9);
    for(const net of this.networks){net.left-=realDt;net.next-=Math.min(realDt,net.left+realDt);while(net.next<=1e-9){net.next+=.4;const alive=net.targets.filter(e=>!e.dead);for(const e of alive){const linked=net.targets.length===1||alive.some(n=>n!==e&&Math.hypot(n.x-e.x,n.y-e.y)<=260);if(linked&&this.now>=(this.netGate.get(e)??-1)){this.netGate.set(e,this.now+.4-1e-9);const other=alive.find(n=>n!==e&&Math.hypot(n.x-e.x,n.y-e.y)<=260);this.arc(e,other??{x:net.cast.x,y:net.cast.y});this.damage(e,(net.targets.length===1?10:15)*net.cast.scale,net.cast);}}}}
    this.networks=this.networks.filter(n=>n.left>1e-9);
    for(const map of [this.resistance,this.wallGate,this.electricGate,this.netGate,this.numbers])for(const e of map.keys())if(e.dead)map.delete(e);
  }
  private stroke(pts:number[],width:number,color:WeaponColor,style:RS,alpha=1):void {
    const r=this.w.r;r.ribbonTop.strip(pts,width+5,RS.InkArrow,.035,.025,.04,alpha*.9);r.ribbonTop.strip(pts,width,style,...BRUSH_COLORS[color],alpha);
  }
  draw():void {
    const r=this.w.r;
    for(const wall of this.walls){const a=Math.min(1,wall.left/.3);this.stroke(wall.pts,20,wall.cast.color,RS.Brush,a);if(!wall.partner&&wall.cast.color!=='blue')this.stroke(wall.pts,wall.cast.color==='red'?14:7,wall.cast.color,wall.cast.color==='red'?RS.AuraFire:RS.AuraArc,a);}
    for(const sweep of this.sweeps)this.stroke(sweep.pts.map((v,i)=>i%2?v-sweep.offset:v),18,'blue',RS.Sword,Math.min(1,sweep.left/.2));
    for(const trace of this.traces){const a=trace.left/trace.duration;if(trace.kind==='burst'){const [x,y]=trace.pts,rad=(trace.radius??50)*(1-.5*a),pts:number[]=[];for(let i=0;i<=48;i++){const angle=i*Math.PI/24;pts.push(x+Math.cos(angle)*rad,y+Math.sin(angle)*rad);}this.stroke(pts,trace.color==='red'?14:5,trace.color,trace.color==='red'?RS.AuraFire:RS.InkHalo,a);}else this.stroke(trace.pts,trace.kind==='sword'?16:5,trace.color,trace.kind==='sword'?RS.Sword:RS.AuraArc,a);}
    for(const f of this.fields){if(f.kind==='fire'){if(f.pts.length===3){const [x,y,rad]=f.pts,pts:number[]=[];for(let i=0;i<=48;i++){const angle=i*Math.PI/24;pts.push(x+Math.cos(angle)*rad,y+Math.sin(angle)*rad);}this.stroke(pts,12,'red',RS.AuraFire,Math.min(1,f.left/.3));}else this.stroke(f.pts,12,'red',RS.AuraFire,Math.min(1,f.left/.3));}else {const [x,y]=f.pts;this.stroke([x-12,y,x,y-18,x+12,y,x,y+18,x-12,y],9,'purple',RS.AuraArc,Math.min(1,f.left/.3));}}
    for(const net of this.networks){const alive=net.targets.filter(e=>!e.dead);if(net.targets.length===1&&alive[0])this.stroke([alive[0].x,alive[0].y,net.cast.x,net.cast.y],4,'purple',RS.AuraArc,.8);else for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++)if(Math.hypot(alive[i].x-alive[j].x,alive[i].y-alive[j].y)<=260)this.stroke([alive[i].x,alive[i].y,alive[j].x,alive[j].y],4,'purple',RS.AuraArc,.75);}
    for(const [e,m] of this.marks){const x=e.x,y=e.y-e.radius-34,pts:number[]=[];for(let i=0;i<=32;i++){const a=-Math.PI/2+i/32*Math.PI*2*m.left/m.duration;pts.push(x+Math.cos(a)*29,y+Math.sin(a)*29);}this.stroke([x-25,y-25,x+25,y-25,x+25,y+25,x-25,y+25,x-25,y-25],2,m.cast.color,RS.InkArrow,.85);this.stroke(pts,3,m.cast.color,RS.InkHalo,.95);r.top.add('fx_seal',{x,y,sx:48/256,sy:48/256,alpha:.95,glow:.2});}
    for(const [e,b] of this.burns)burnDraw(r.ribbonMid,e,b.age,this.now);
  }
  clear():void {this.marks.clear();this.burns.clear();this.walls.length=0;this.resistance.clear();this.wallGate.clear();this.electricGate.clear();this.netGate.clear();this.numbers.clear();this.fields=[];this.networks=[];this.sweeps=[];this.traces=[];this.pending=[];this.sealAt=-Infinity;this.now=0;}
}
