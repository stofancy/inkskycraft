import { companionSprites } from '../art/sprites_companions';
import { SpritePlayback } from '../art/playback';
import type { Renderer } from '../gl/renderer';
import { PK } from '../gl/particles';
import { RS } from '../gl/ribbons';
import { CURVES } from '../ui/motion';
import { approach, clamp, segDist2 } from '../core/math';
import type { Enemy } from './enemy';
import type { Bullet } from './bullets';
import { type CombatWorld, Progression } from './progression';

export type CompanionKind = 'chiyan' | 'laodun' | 'moyuan' | 'suanpan';
export type CompanionKey = 'Q' | 'E' | 'R';
export interface CompanionState {
 kind: CompanionKind; name: string; role: string; level: number; xp: number;
 penFlight?: boolean; angle?:number;
 x: number; y: number; cooldown: number; active: number; effective: number; count: number;
}
export const COMPANION_RULES = {
 chiyan: { speed: 1800, radius: 40, damage: 120, cooldown: 8, shotSpeed:900, shotDamage:5, shotRate:3, closeRate:6 },
 laodun: { offset: 60, absorbInterval: 2, radius: 110, duration: 3, cooldown: 12 },
 moyuan: { markScale: 1.15, radius: 140, speedScale: .4, damageScale: 1.2, duration: 4, cooldown: 12 },
 suanpan: { interval: 10, radius: 120, ink: .005, cooldown: 14 },
} as const;
const OFFSETS=[[0,-88],[-82,-15],[82,-45],[0,82]];
const NAMES: Record<CompanionKind,string> = { chiyan:'赤燕',laodun:'老盾',moyuan:'墨鸢',suanpan:'算盘' };
const SKILLS = { chiyan:['俯冲斩','chiyan-dive'],laodun:['护盾','laodun-shield'],moyuan:['墨网','moyuan-net'],suanpan:['截流','suanpan-intercept'] } as const;
const COLORS: Record<CompanionKind,[number,number,number]> = { chiyan:[1.8,.55,.15],laodun:[.2,1.3,.85],moyuan:[.65,.5,1.3],suanpan:[1.1,.8,.25] };
interface Area { kind:'laodun'|'moyuan'; x:number; y:number; left:number; age:number; fromX:number; fromY:number }
interface Dash { x:number; y:number; returning:boolean; seen:Set<Enemy>; startX:number; startY:number }

interface Shot {x:number;y:number;vx:number;vy:number}
export type JointKind = 'shield-dive'|'tiewang'|'zhaoying';
interface Joint {
 kind:JointKind; x:number; y:number; age:number; phase:'arrival'|'rush'|'hold'|'return';
 start:number; end:number; pass:number; pause:number; seen:Set<Enemy>;
 pushed:{enemy:Enemy; y:number}[]; exposed:Set<Enemy>;
}
const JOINTS:Record<JointKind,{name:string;icon:string}> = {
 'shield-dive':{name:'盾后突击',icon:'laodun-shield'},
 tiewang:{name:'铁网',icon:'tiewang'}, zhaoying:{name:'照影',icon:'zhaoying'},
};
/** 点/弹体移动线段穿过矩形，涵盖高速穿越。 */
function crossesBox(x0:number,y0:number,x1:number,y1:number,left:number,top:number,right:number,bottom:number):boolean {
 let lo=0,hi=1;
 for(const [a,b,min,max] of [[x0,x1,left,right],[y0,y1,top,bottom]]) {
  const d=b-a;if(Math.abs(d)<1e-8){if(a<min||a>max)return false;continue;}
  const t0=(min-a)/d,t1=(max-a)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
  if(lo>hi)return false;
 }
 return true;
}
/** 自动职责、Q/E 玩家阵位技能和按编队组合的 R 合击。 */
export class CompanionSystem {
 private readonly roster: CompanionState[] = (['chiyan','laodun','moyuan','suanpan'] as CompanionKind[]).map(kind=>({kind,name:NAMES[kind],role:SKILLS[kind][0],level:1,xp:0,x:0,y:0,cooldown:0,active:0,effective:0,count:0}));
 private flights=new Map<CompanionKind,{left:number;joining:boolean;fromX:number;fromY:number;state:CompanionState}>();
 private present = new Set<CompanionKind>();
 private animations = new Map<CompanionKind,SpritePlayback>();
 private areas: Area[] = [];
 private dash: Dash|null = null;
 private marked: Enemy|null = null;
 private slowed = new Set<Enemy>();
 private shots:Shot[]=[];
 private shotTimer=0;
 private copperPass:{age:number;x:number;y:number;target:Enemy}|null=null;
 private passCooldown=0;
 private joint:Joint|null=null;
 private jointDamageDepth=0;
 private creditedParts=new WeakSet<Enemy>();
 charge=0;
 readonly chargeMax=100;
 readonly stageChargeTiming:{pairAt:number|null;fullAt:number|null;chargeAtPair:number|null}={pairAt:null,fullAt:null,chargeAtPair:null};
 private absorbTimer=0;
 private interferenceTimer=0;
 private drops:{x:number;y:number;age:number}[]=[];
 readonly stats = { damage:0, blocked:0, bound:0, ink:0, interfered:0, shots:0, shotHits:0, jointCasts:{'shield-dive':0,tiewang:0,zhaoying:0}, chargeGained:0, casts:{chiyan:0,laodun:0,moyuan:0,suanpan:0} };
 constructor(readonly w:CombatWorld,readonly progression:Progression) {this.resetStage();}
 get team():CompanionState[] {return [...this.present].map(id=>this.roster.find(s=>s.kind===id)!);}
 onChange:(kind:CompanionKind,joined:boolean)=>void=()=>{};
 setTestSelection(kinds:readonly CompanionKind[]|null):void {if(kinds)this.setRoster([...kinds]);}
 setRoster(ids:CompanionKind[]):void {this.present=new Set([...new Set(ids)].filter(id=>this.roster.some(s=>s.kind===id)).slice(0,2));this.resetStage();this.measureChargeTiming();}
 join(kind:CompanionKind,from?:{x:number;y:number}):boolean {if(this.present.has(kind)||this.present.size>=2)return false;this.present.add(kind);const s=this.roster.find(s=>s.kind===kind)!;s.x=from?.x??(kind==='chiyan'?-70:970);s.y=from?.y??this.w.player.y-180;s.cooldown=0;this.flights.set(kind,{left:.8,joining:true,fromX:s.x,fromY:s.y,state:s});this.onChange(kind,true);this.measureChargeTiming();return true;}
 leave(kind:CompanionKind):boolean {if(!this.present.delete(kind))return false;const s=this.roster.find(s=>s.kind===kind)!;this.flights.set(kind,{left:.8,joining:false,fromX:s.x,fromY:s.y,state:s});this.clearEffects();this.onChange(kind,false);return true;}
 resetRun():void {this.present.clear();this.charge=0;Object.assign(this.stats,{damage:0,blocked:0,bound:0,ink:0,interfered:0,shots:0,shotHits:0,chargeGained:0});for(const id of Object.keys(this.stats.jointCasts) as JointKind[])this.stats.jointCasts[id]=0;for(const kind of Object.keys(this.stats.casts) as CompanionKind[])this.stats.casts[kind]=0;this.resetStage();}
 resetStage():void {this.flights.clear();this.clearEffects();Object.assign(this.stageChargeTiming,{pairAt:null,fullAt:null,chargeAtPair:null});this.shotTimer=0;this.absorbTimer=0;this.interferenceTimer=COMPANION_RULES.suanpan.interval;for(const s of this.roster){s.x=this.w.player.x;s.y=this.w.player.y-60;s.cooldown=0;s.count=0;s.penFlight=false;s.angle=0;const def=companionSprites.find(d=>d.id===`companion_${s.kind}`)!;this.animations.set(s.kind,new SpritePlayback(def.sheet??{count:def.frames??1,fps:12,mode:'loop'}));}}
 reset(full=false):void {if(full)this.resetRun();else this.resetStage();}
 private clearEffects():void {for(const e of this.slowed)e.companionSpeed=1;this.slowed.clear();this.areas=[];this.copperPass=null;this.passCooldown=0;this.dash=null;this.marked=null;this.drops=[];this.shots=[];this.joint=null;for(const s of this.roster)s.active=0;}
 beginPenFlight():void {this.dash=null;}
 gain(kind:CompanionKind,amount:number):void {const s=this.team.find(c=>c.kind===kind);if(s)s.effective+=amount;}
 isMarked(e:Enemy):boolean {return this.marked===e;}
 weaknessBonus(e:Enemy):number {
  const mark=this.isMarked(e)?COMPANION_RULES.moyuan.markScale:1;
  const net=this.areas.some(a=>a.kind==='moyuan'&&Math.hypot(e.x-a.x,e.y-a.y)<=COMPANION_RULES.moyuan.radius)?COMPANION_RULES.moyuan.damageScale:1;
  return mark*net*(this.joint?.kind==='zhaoying'&&this.joint.age<5&&this.joint.exposed.has(e)?1.5:1);
 }
 private targets():Enemy[] {return this.w.enemies.filter(e=>this.w.targetable(e)&&e.x>=0&&e.x<=900&&e.y>=0&&e.y<=1200);}
 slot(key:CompanionKey) {
  if(key==='R') {
   const kind=this.jointKind(),joint=kind?JOINTS[kind]:null;
   return {id:kind??'',name:joint?.name??'暂无合击',icon:joint?`/art/icons/skills/${joint.icon}.png`:'',cooldown:0,cooldownMax:0,charge:this.charge,chargeMax:this.chargeMax,ready:!!kind&&this.charge>=100&&!this.joint&&this.w.player.alive&&this.w.player.entering<=0&&!this.team.some(s=>s.penFlight),visible:this.team.length>0};
  }
  const s=this.team[key==='Q'?0:1];
  return {id:s?.kind??'',name:s?SKILLS[s.kind][0]:'',icon:s?`/art/icons/skills/${SKILLS[s.kind][1]}.png`:'',cooldown:s?.cooldown??0,cooldownMax:s?COMPANION_RULES[s.kind].cooldown*this.w.skillCooldownScale:0,ready:!!s&&!this.joint&&s.cooldown<=0&&!s.penFlight&&!(s.kind==='chiyan'&&this.dash)&&this.w.player.alive&&this.w.player.entering<=0,visible:!!s};
 }
 cast(key:CompanionKey):boolean {
  if(this.w.bossCombat.inputLocked||!this.slot(key).ready||this.w.challengeState)return false;
  const p=this.w.player,x=p.x,y=p.y;
  if(key==='R')return this.startJoint(x,y);
  const s=this.team[key==='Q'?0:1];
  s.cooldown=COMPANION_RULES[s.kind].cooldown*this.w.skillCooldownScale;this.stats.casts[s.kind]++;
  if(s.kind==='chiyan') {const all=this.targets(),parts=all.filter(e=>this.isBossPart(e)),weak=parts.filter(e=>!e.data.hitArmor&&(e.armorLoose>0||e.data.weakWeapon||e.data.copperPart||e.data.damageBonus>1)),front=all.filter(e=>e.y<p.y);const candidates=weak.length?weak:parts.length?parts:front;
   const target=candidates.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];this.dash={x:target?.x??x,y:target?.y??Math.max(50,y-360),returning:false,seen:new Set(),startX:s.x,startY:s.y};}

  else if(s.kind==='laodun'||s.kind==='moyuan') {const kind=s.kind,front=this.targets().filter(e=>e.y<y);let tx=x,ty=Math.max(60,y-280);
   if(kind==='moyuan'&&front.length){const best=front.sort((a,b)=>front.filter(e=>Math.hypot(e.x-b.x,e.y-b.y)<=140).length-front.filter(e=>Math.hypot(e.x-a.x,e.y-a.y)<=140).length||Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];tx=best.x;ty=best.y;}
   this.areas.push({kind,x:kind==='laodun'?x:tx,y:kind==='laodun'?y:ty,left:COMPANION_RULES[kind].duration,age:0,fromX:x,fromY:y});s.active=COMPANION_RULES[kind].duration;}

  else {for(const b of this.w.bullets.list)if(!b.dead&&Math.hypot(b.x-x,b.y-y)<=COMPANION_RULES.suanpan.radius){b.dead=true;this.drops.push({x:b.x,y:b.y,age:0});const before=this.w.player.ink;this.w.player.ink=Math.min(1,before+COMPANION_RULES.suanpan.ink);this.stats.ink+=this.w.player.ink-before;}this.w.fx.shockwave(x,y,120,.2,.6);}
  this.w.audio.sfx(key==='Q'?'companion_q':'companion_e');
  this.w.ui.popup(x,y,SKILLS[s.kind][0],'chain',`companion:${s.kind}`);
  return true;
 }
 private jointKind():JointKind|null {
  const pair=this.team.map(s=>s.kind).sort().join('+');
  return pair==='chiyan+laodun'?'shield-dive':pair==='laodun+moyuan'?'tiewang':pair==='moyuan+suanpan'?'zhaoying':null;
 }
 private isBossPart(e:Enemy):boolean {
  if(!e.parent)return !!e.data.bossOwner?.def?.boss;
  let owner=e.parent;while(owner.parent)owner=owner.parent;
  return !!owner.def.boss||owner.phaseLock;
 }
 /** World 在直接击破时通知；父体消失带走的部件不重复计击破。 */
 onEnemyKilled(e:Enemy):void {
  if(this.isBossPart(e)){if(!this.creditedParts.has(e)){this.creditedParts.add(e);this.w.audio.sfx('boss_part');this.addCharge(20);}}
  else if(!e.parent&&!e.def.boss&&!e.def.decorative&&e.lastDamageSource==='companion'&&!this.jointDamageDepth)this.addCharge(e.maxHp>=300?25:10);
 }
 onEnemyHpDepleted(e:Enemy):void {if(this.isBossPart(e))this.onEnemyKilled(e);}
 onBossPhaseCompleted():void {this.addCharge(30);}
 private addCharge(amount:number):void {if(this.w.bossCombat.freeze)return;const before=this.charge;this.charge=Math.min(100,this.charge+amount);this.stats.chargeGained+=this.charge-before;this.measureChargeTiming();}
 private measureChargeTiming():void {
  if(this.w.stageIndex!==1||this.team.length!==2)return;
  const m=this.stageChargeTiming;if(m.pairAt===null){m.pairAt=this.w.real;m.chargeAtPair=this.charge;}
  if(m.fullAt===null&&this.charge>=100)m.fullAt=this.w.real;
 }
 private hurt(e:Enemy,amount:number,joint=false):void {
  const target:Enemy=e.data.damageTarget??e,hp=target.hp;if(joint)this.jointDamageDepth++;
  try {this.w.damage(e,amount,e.x,e.y,true,'companion');}finally{if(joint)this.jointDamageDepth--;}
  this.stats.damage+=Math.max(0,hp-target.hp);
 }
 private fireChiyan(dt:number,targets:Enemy[]):void {
  const s=this.team.find(s=>s.kind==='chiyan');
  if(!s||s.penFlight||this.dash||this.w.player.entering>0||this.w.challengeState)return;
  const target=targets.filter(e=>!e.dead).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
  if(!target){this.shotTimer=0;return;}
  const rate=Math.hypot(target.x-s.x,target.y-s.y)<=120?6:3;
  this.shotTimer+=dt*rate;
  while(this.shotTimer+1e-8>=1){this.shotTimer-=1;const dx=target.x-s.x,dy=target.y-s.y,d=Math.max(.001,Math.hypot(dx,dy));const vx=dx/d*900,vy=dy/d*900;const angle=Math.atan2(dy,dx)+Math.PI/2;s.angle=angle;const [mx,my]=this.w.r.atlas.get('companion_chiyan').anchors.muzzle;const x=s.x+(mx*Math.cos(angle)-my*Math.sin(angle))*.85,y=s.y+(mx*Math.sin(angle)+my*Math.cos(angle))*.85;this.shots.push({x,y,vx,vy});this.stats.shots++;}
 }
 private updateShots(dt:number):void {
  this.shots=this.shots.filter(b=>{
   const x=b.x+b.vx*dt,y=b.y+b.vy*dt;
   let hit:Enemy|null=null,first=Infinity;
   for(const e of this.w.enemies)if(e.x>=0&&e.x<=900&&e.y>=0&&e.y<=1200&&this.w.targetable(e,true)&&this.w.hitSegment(e,b.x,b.y,x,y,0)){const d=(this.w.hitX-b.x)**2+(this.w.hitY-b.y)**2;if(d<first){hit=e;first=d;}}
   if(hit){this.hurt(hit,5);this.stats.shotHits++;this.w.fx.hit(hit.x,hit.y,COLORS.chiyan,2);return false;}
   b.x=x;b.y=y;return x>=-20&&x<=920&&y>=-20&&y<=1220;
  });
 }
 private move(s:CompanionState,x:number,y:number,speed:number,dt:number):boolean {
  const d=Math.hypot(x-s.x,y-s.y),k=Math.min(1,speed*dt/Math.max(.0001,d));if(d>.001)s.angle=Math.atan2(y-s.y,x-s.x)+Math.PI/2;s.x+=(x-s.x)*k;s.y+=(y-s.y)*k;return k===1;
 }
 private startJoint(x:number,y:number):boolean {
  const kind=this.jointKind();if(!kind)return false;
  this.charge=0;this.stats.jointCasts[kind]++;this.dash=null;for(const s of this.team){s.x=x;s.y=y;}
  const actor=this.roster[kind==='shield-dive'?0:1];
  const center=x;
  const left=kind==='shield-dive'?center-300:0,right=kind==='shield-dive'?center+300:900;
  const edge=kind==='shield-dive'?y-8:y;
  const start=Math.hypot(actor.x-left,actor.y-edge)<=Math.hypot(actor.x-right,actor.y-edge)?left:right;
  const j:Joint={kind,x:center,y,age:0,phase:kind==='zhaoying'?'hold':'arrival',start,end:start===left?right:left,pass:0,pause:0,seen:new Set(),pushed:[],exposed:new Set()};
  this.joint=j;this.w.audio.sfx('companion_r');
  if(kind==='tiewang')for(const e of this.targets())if(Math.abs(e.y-y)<=40&&!e.def.boss&&!e.phaseLock&&!this.isBossPart(e)){e.stunned=Math.max(e.stunned,2);j.pushed.push({enemy:e,y:e.y});}
  this.w.fx.shockwave(this.w.player.x,this.w.player.y,180,2,.3);
  if(kind==='zhaoying'){j.exposed=new Set(this.w.enemies.filter(e=>this.w.targetable(e,true)&&e.x>=0&&e.x<=900&&e.y>=0&&e.y<=1200));this.w.fx.flash(.5,[.7,.55,1.3]);this.w.fx.shockwave(450,600,900,.2,.6);}
  this.w.ui.popup(center,y,JOINTS[kind].name,'chain',`joint:${kind}`);this.w.fx.shake(.1);
  return true;
 }
 /** 不改弹池中的原始 speed；新弹和离场弹按位置逐帧判断，到期自然恢复。 */
 bulletSpeedScale(b:Bullet):number {return this.joint?.kind==='zhaoying'&&this.joint.age<5&&b.x>=0&&b.x<=900&&b.y>=0&&b.y<=1200?.5:1;}
 private updateJoint(dt:number):void {
  const j=this.joint!;j.age+=dt;
  for(const v of j.pushed)if(!v.enemy.dead){if(j.age<2)v.enemy.stunned=Math.max(v.enemy.stunned,2-j.age+dt);if(j.age<=.4+dt){const t=clamp(j.age/.4,0,1);v.enemy.y=v.y-160*(1-(1-t)**3);}}
  if(j.kind==='shield-dive'&&j.age<=3+1e-8||j.kind==='tiewang'&&j.age<=2+1e-8) {
   const half=j.kind==='shield-dive'?300:450,thick=j.kind==='shield-dive'?8:40;
   for(const b of this.w.bullets.list){if(b.dead||j.kind==='shield-dive'&&b.hard)continue;const d=b.age>=b.delay?dt*this.bulletSpeedScale(b):0;
    if(crossesBox(b.x,b.y,b.x+b.vx*d,b.y+b.vy*d,j.x-half-b.radius,j.y-thick-b.radius,j.x+half+b.radius,j.y+thick+b.radius)){b.dead=true;this.stats.blocked++;}}
  }
  if(j.phase==='return') {
   let home=true;for(const s of this.team){const x=this.w.player.x+(s.kind==='moyuan'?82:s.kind==='suanpan'?-82:0);if(!this.move(s,x,this.w.player.y-60,1800,dt))home=false;}
   if(home)this.joint=null;return;
  }
  if(j.kind==='zhaoying'){if(j.age>=5)j.phase='return';return;}
  const s=this.roster[j.kind==='shield-dive'?0:1],y=j.kind==='shield-dive'?j.y-8:j.y;
  if(j.kind==='shield-dive'){const shield=this.roster[1];this.move(shield,j.x,j.y,1800,dt);}
  if(j.phase==='arrival'){if(this.move(s,j.start,y,j.kind==='shield-dive'?1800:1500,dt))j.phase='rush';}
  else if(j.phase==='rush') {
   if(j.pause>0){j.pause=j.pause<=dt+1e-8?0:j.pause-dt;return;}
   const ox=s.x,oy=s.y;const done=this.move(s,j.end,y,j.kind==='shield-dive'?1200:1500,dt);
   for(const e of this.targets())if(!j.seen.has(e)) {
    const hit=j.kind==='shield-dive'?e.x>=j.x-300&&e.x<=j.x+300&&e.y>=j.y-68&&e.y<=j.y-8&&e.x>=Math.min(ox,s.x)&&e.x<=Math.max(ox,s.x):this.w.hitSegment(e,ox,oy,s.x,s.y,10);
    if(hit){j.seen.add(e);this.hurt(e,j.kind==='shield-dive'?80:60,true);this.w.fx.hit(e.x,e.y,COLORS[s.kind],4);}
   }
   if(done){j.pass++;if(j.kind==='shield-dive'&&j.pass<4){const end=j.end;j.end=j.start;j.start=end;j.seen.clear();j.pause=.15;}else j.phase='hold';}
  }
  if(j.phase==='hold'&&j.age>=(j.kind==='shield-dive'?3:2))j.phase='return';
 }
 private drawJoint(r:Renderer,time:number):void {
  const j=this.joint;if(!j)return;
  if(j.kind==='shield-dive') {
   if(j.age<=3){r.ribbonMid.line(j.x-300,j.y,j.x+300,j.y,16,RS.InkHalo,...COLORS.laodun,.85);for(let x=j.x-300;x<=j.x+300;x+=50)r.ribbonMid.line(x,j.y-8,x,j.y+8,3,RS.Glow,...COLORS.laodun,.95);}
   const s=this.roster[0];if(j.phase==='rush')r.ribbonMid.line(s.x-Math.sign(j.end-s.x||1)*100,s.y,s.x,s.y,6,RS.Trail,...COLORS.chiyan,.9);
  }else if(j.kind==='tiewang'&&j.age<=2) {
   for(let x=0;x<=900;x+=40)r.ribbonMid.line(x,j.y-40,x,j.y+40,2,RS.InkTrail,...COLORS.moyuan,.8);
   for(const y of [-40,-20,0,20,40])r.ribbonMid.line(0,j.y+y,900,j.y+y,3,RS.InkTrail,...COLORS.moyuan,.8);
   const s=this.roster[1];r.ribbonMid.line(s.x-12,s.y-40,s.x+12,s.y+40,12,RS.InkHalo,...COLORS.laodun,.9);
  }else if(j.kind==='zhaoying'&&j.age<5) {
   for(const e of j.exposed)if(!e.dead){const size=e.radius+15;for(const dx of [-1,1])for(const dy of [-1,1]){r.ribbonMid.line(e.x+dx*size,e.y+dy*size,e.x+dx*(size-14),e.y+dy*size,3,RS.Glow,...COLORS.moyuan,.8);r.ribbonMid.line(e.x+dx*size,e.y+dy*size,e.x+dx*size,e.y+dy*(size-14),3,RS.Glow,...COLORS.moyuan,.8);}}
   for(const b of this.w.bullets.list)if(!b.dead&&this.bulletSpeedScale(b)<1)r.ribbonMid.line(b.x-b.vx*.06,b.y-b.vy*.06,b.x,b.y,2,RS.Trail,...COLORS.suanpan,.65);
  }
 }
 private updateFlights(dt:number):void {const p=this.w.player;for(const [id,f] of this.flights){f.left=Math.max(0,f.left-dt);const k=CURVES.cubic(1-f.left/.8),tx=f.joining?clamp(p.x+(f.state.kind==='chiyan'||f.state.kind==='suanpan'?-82:f.state.kind==='moyuan'?82:0),30,870):f.fromX<450?-90:990,ty=f.joining?p.y-60:-100;if(!f.state.penFlight){f.state.x=f.fromX+(tx-f.fromX)*k;f.state.y=f.fromY+(ty-f.fromY)*k;}if(!f.left)this.flights.delete(id);}}
 updatePresentation(dt:number):void {if(this.w.bossCombat.freeze)return;this.updateFlights(dt);for(const animation of this.animations.values())animation.update(dt);}
 update(dt:number):void {
  if(this.w.bossCombat.freeze)return;
  this.updateFlights(dt);const p=this.w.player;for(const animation of this.animations.values())animation.update(dt);
  if(!p.alive){this.clearEffects();return;}
  for(const s of this.team){s.cooldown=Math.max(0,s.cooldown-dt);s.active=Math.max(0,s.active-dt);}
  if(p.entering<=0&&!this.w.challengeState)for(const key of ['Q','E','R'] as const)if(this.w.input.pressed(`companion${key}`))this.cast(key);
  const targets=this.targets();this.passCooldown=Math.max(0,this.passCooldown-dt);
  const bird=this.team.find(s=>s.kind==='chiyan'),bossTarget=targets.find(e=>e.data.copperPart&&!e.data.hitArmor);
  if(bird&&bossTarget&&!this.dash&&!this.joint&&!bird.penFlight&&!this.copperPass&&!this.passCooldown){this.copperPass={age:0,x:bird.x,y:bird.y,target:bossTarget};this.passCooldown=4;}

  this.marked=!this.joint&&this.present.has('moyuan')?targets.reduce<Enemy|null>((best,e)=>!best||e.hp>best.hp?e:best,null):null;
  for(const s of this.team) {
   if(this.flights.has(s.kind)||this.joint||s.penFlight||(s.kind==='chiyan'&&(this.dash||this.copperPass)))continue;
   if(s.kind!=='chiyan'||!targets.length)s.angle=0;
   let x=p.x,y=p.y-60;
   if(s.kind==='chiyan'&&bossTarget){x=clamp(p.x+90,20,880);y=p.y-80;}
    else if(s.kind==='chiyan'&&targets.length){const e=targets.reduce((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)<Math.hypot(b.x-s.x,b.y-s.y)?a:b);x=clamp(e.x+e.radius+10,10,890);y=e.y;}
   else if(s.kind!=='laodun')x+=s.kind==='moyuan'?82:-82;
   s.x=approach(s.x,x,10,dt);s.y=approach(s.y,y,10,dt);
  }
  if(this.dash&&!this.joint){const d=this.dash,s=this.roster[0],tx=d.returning?p.x:d.x,ty=d.returning?p.y-60:d.y,dist=Math.hypot(tx-s.x,ty-s.y),k=Math.min(1,COMPANION_RULES.chiyan.speed*dt/Math.max(dist,.0001)),ox=s.x,oy=s.y;if(dist>.001)s.angle=Math.atan2(ty-s.y,tx-s.x)+Math.PI/2;s.x+=(tx-s.x)*k;s.y+=(ty-s.y)*k;
   if(!d.returning){this.w.fx.emitHigh({x:s.x,y:s.y,life:.22,size:13,sizeEnd:1,r:2,g:.6,b:.08,a:.9,kind:PK.Flame});}
   if(!d.returning)for(const e of targets)if(!d.seen.has(e)&&segDist2(e.x,e.y,ox,oy,s.x,s.y)<=40**2){d.seen.add(e);const before=e.hp;this.w.damage(e,120,e.x,e.y,true,'companion');this.stats.damage+=Math.max(0,before-e.hp);this.w.fx.hit(e.x,e.y,COLORS.chiyan,5);}
   if(k===1){if(d.returning)this.dash=null;else d.returning=true;}
  }
  if(this.copperPass&&bird){const f=this.copperPass;f.age+=dt;const k=Math.min(1,f.age/.6),back=Math.max(0,Math.min(1,(f.age-.6)/.65)),tx=f.target.x,ty=f.target.y+25;bird.x=f.x+(tx-f.x)*k;bird.y=f.y+(ty-f.y)*k;if(back){bird.x=tx+(p.x+90-tx)*back;bird.y=ty+(p.y-80-ty)*back;}bird.angle=back?Math.PI:0;if(f.age>=1.25||f.target.dead)this.copperPass=null;}
  this.updateShots(dt);
  if(this.joint)this.updateJoint(dt);else this.fireChiyan(dt,targets);
  this.measureChargeTiming();
  for(const e of this.slowed)e.companionSpeed=1;this.slowed.clear();
  for(const a of this.areas){a.age+=dt;if(a.kind==='laodun'){a.x=p.x;a.y=p.y;}if(a.kind==='moyuan'&&a.age>=.3)for(const e of targets)if(Math.hypot(e.x-a.x,e.y-a.y)<=140){e.companionSpeed=.4;this.slowed.add(e);}
   if(a.kind==='laodun')for(const b of this.w.bullets.list)if(!b.dead&&!b.hard&&b.age>=b.delay&&segDist2(a.x,a.y,b.x,b.y,b.x+b.vx*dt,b.y+b.vy*dt)<=(110+b.radius)**2){b.dead=true;this.stats.blocked++;}
   a.left-=dt;
  }
  this.areas=this.areas.filter(a=>a.left>0);
  this.absorbTimer=Math.max(0,this.absorbTimer-dt);
  const shield=this.team.find(s=>s.kind==='laodun');
  if(!this.joint&&shield&&this.absorbTimer===0&&p.entering<=0){const b=this.w.bullets.list.find(b=>!b.dead&&!b.hard&&b.age>=b.delay&&b.vy>0&&b.y<=shield.y+b.radius&&segDist2(shield.x,shield.y,b.x,b.y,b.x+b.vx*dt,b.y+b.vy*dt)<=(10+b.radius)**2);if(b){b.dead=true;this.absorbTimer=2;this.stats.blocked++;}}
  if(!this.joint&&this.present.has('suanpan')&&p.entering<=0){this.interferenceTimer-=dt;if(this.interferenceTimer<=0){for(const b of this.w.bullets.list)if(!b.dead&&(b.homing||b.tracking)&&b.x>=0&&b.x<=900&&b.y>=0&&b.y<=1200){b.update=undefined;b.homing=false;b.tracking=false;this.stats.interfered++;}this.interferenceTimer+=10;}}
  for(const d of this.drops)d.age+=dt;this.drops=this.drops.filter(d=>d.age<.6);
 }
 draw(r:Renderer,time:number):void {
  if(!this.w.player.alive)return;
  for(const s of this.team)r.air.add(`companion_${s.kind}`,{x:s.x,y:s.y,frame:this.animations.get(s.kind)?.frame??0,sx:.85,sy:.85,rot:(s.angle??0)+Math.sin(time*2)*.06,glow:.7});
  for(const [kind,f] of this.flights)if(!f.joining)r.air.add(`companion_${kind}`,{x:f.state.x,y:f.state.y,frame:this.animations.get(kind)?.frame??0,sx:.85,sy:.85,glow:.7});
  if(this.copperPass){const f=this.copperPass,s=this.team.find(s=>s.kind==='chiyan');if(s)r.ribbonMid.line(f.x,f.y,s.x,s.y,6,RS.Trail,...COLORS.chiyan,.85);}
  if(this.dash&&!this.joint){const d=this.dash,s=this.roster[0];r.ribbonMid.line(d.startX,d.startY,s.x,s.y,6,RS.Trail,...COLORS.chiyan,.8);}
  for(const b of this.shots){r.ribbonMid.line(b.x-b.vx/900*22,b.y-b.vy/900*22,b.x,b.y,4,RS.Glow,...COLORS.chiyan,.9);r.bullets.add(b.x,b.y,Math.atan2(b.vy,b.vx),4,0,1.8,.55,.15,1,1,.1);}
  this.drawJoint(r,time);
  for(const a of this.areas){const radius=COMPANION_RULES[a.kind].radius,c=COLORS[a.kind];
   if(a.kind==='moyuan'&&a.age<.3){const t=CURVES.cubic(a.age/.3),x=a.fromX+(a.x-a.fromX)*t,y=a.fromY+(a.y-a.fromY)*t-Math.sin(t*Math.PI)*70;r.ribbonMid.line(a.fromX,a.fromY,x,y,8,RS.InkTrail,...c,.8);for(const dx of [-1,1])r.ribbonTop.line(x+dx*18,y-18,x-dx*18,y+18,3,RS.Glow,...c,.9);continue;}
   const pts:number[]=[];for(let i=0;i<=48;i++){const t=i/48*Math.PI*2;pts.push(a.x+Math.cos(t)*radius*Math.min(1,a.age/.15),a.y+Math.sin(t)*radius*Math.min(1,a.age/.15));}r.ribbonMid.strip(pts,5,RS.InkHalo,...c,.8);
   if(a.kind==='moyuan')for(let i=-3;i<=3;i++){const x=i*radius/4,h=Math.sqrt(radius*radius-x*x);r.ribbonMid.line(a.x+x,a.y-h,a.x+x,a.y+h,2,RS.InkTrail,...c,.5);r.ribbonMid.line(a.x-h,a.y+x,a.x+h,a.y+x,2,RS.InkTrail,...c,.5);}}
  if(this.marked){const e=this.marked,size=e.radius+12;for(const dx of [-1,1])for(const dy of [-1,1])r.ribbonMid.line(e.x+dx*size,e.y+dy*size,e.x+dx*(size-12),e.y+dy*size,3,RS.Glow,...COLORS.moyuan,.8);}
  for(const d of this.drops){const k=d.age/.6,p=this.w.player;r.bullets.add(d.x+(p.x-d.x)*k,d.y+(p.y-d.y)*k,0,7*(1-k)+2,3,1.1,.8,.25,1-k,1,.1);}
 }
}
