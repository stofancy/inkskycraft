import { companionSprites } from '../art/sprites_companions';
import { SpritePlayback } from '../art/playback';
import type { Renderer } from '../gl/renderer';
import { PK } from '../gl/particles';
import { RS } from '../gl/ribbons';
import { CURVES } from '../ui/motion';
import { approach, clamp, segDist2 } from '../core/math';
import type { Enemy } from './enemy';
import type { Bullet } from './bullets';
import { Progression } from './progression';
import type { World } from './world';

export type CompanionKind = 'chiyan' | 'laodun' | 'moyuan' | 'suanpan';
export type CompanionKey = 'Q' | 'E' | 'R';
export interface CompanionState {
 kind: CompanionKind; name: string; role: string; level: number; xp: number;
 penFlight?: boolean; angle?:number;
 x: number; y: number; cooldown: number; active: number; effective: number; count: number;
}
export const COMPANION_RULES = {
 chiyan: { speed: 1800, radius: 40, damage: 120, cooldown: 8, shotSpeed:900, shotDamage:5, shotRate:3, closeRate:6 },
 laodun: { offset: 60, absorbInterval: 2, duration: 4, cooldown: 16 },
 moyuan: { markScale: 1.15, radius: 140, speedScale: .4, damageScale: 1.2, duration: 4, cooldown: 12 },
 suanpan: { interval: 10, radius: 120, ink: .005, cooldown: 14 },
} as const;
const OFFSETS=[[0,-88],[-82,-15],[82,-45],[0,82]];
const NAMES: Record<CompanionKind,string> = { chiyan:'赤燕',laodun:'老盾',moyuan:'墨鸢',suanpan:'算盘' };
const SKILLS = { chiyan:['俯冲斩','chiyan-dive'],laodun:['护命符','jade-talisman'],moyuan:['墨网','moyuan-net'],suanpan:['截流','suanpan-intercept'] } as const;
const COLORS: Record<CompanionKind,[number,number,number]> = { chiyan:[1.8,.55,.15],laodun:[.2,1.3,.85],moyuan:[.65,.5,1.3],suanpan:[1.1,.8,.25] };
interface Area { kind:'moyuan'; x:number; y:number; left:number; age:number; fromX:number; fromY:number }
interface Dash {
 x:number; y:number; returning:boolean; seen:Set<Enemy>; startX:number; startY:number;
 phase:'wind'|'rush'|'back'; t:number; ux:number; uy:number; fromX:number; fromY:number; toX:number; toY:number; span:number;
}
const easeInOutQuart=(k:number)=>k<.5?8*k**4:1-(-2*k+2)**4/2;
const easeInOutCubic=(k:number)=>k<.5?4*k**3:1-(-2*k+2)**3/2;
const DASH_WIND=.1,DASH_PUSH=70,DASH_PUSH_TIME=.18,DASH_TRAIL=.18;

interface Shot {x:number;y:number;vx:number;vy:number}
export type JointKind = 'kaitian'|'zhenyue'|'zhaohun';
interface Joint {
 kind:JointKind; x:number; y:number; age:number; seen:Set<Enemy>; fired:boolean;
 target:Enemy|null; transferred:boolean; pulse:number;
 bosses:Map<Enemy,{phase:unknown;max:number;used:number}>;
 held:{enemy:Enemy;fromX:number;fromY:number;x:number;y:number}[];
}
const JOINTS:Record<JointKind,{name:string;icon:string;hint:string}> = {
 kaitian:{name:'开天阵',icon:'fire-feather-blade',hint:'向前开路'},
 zhenyue:{name:'镇岳阵',icon:'seal-plate',hint:'聚敌定身'},
 zhaohun:{name:'照魂镜',icon:'mirror-half',hint:'主炮照破弱点'},
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
 private dashTrail:{x:number;y:number;angle:number;age:number}[]=[];
 private dashArcs:{x:number;y:number;angle:number;age:number}[]=[];
 private pushes:{e:Enemy;vx:number;vy:number;left:number}[]=[];
 private marked: Enemy|null = null;
 private slowed = new Set<Enemy>();
 private shots:Shot[]=[];
 private shotTimer=0;
 private copperPass:{age:number;x:number;y:number;target:Enemy}|null=null;
 private passCooldown=0;
 private joint:Joint|null=null;
 private jointDamageDepth=0;
 private talisman:{age:number;fromX:number;fromY:number}|null=null;
 private talismanBreak:{age:number;x:number;y:number;angle:number}|null=null;
 get talismanProtection():number{return this.talismanBreak?Math.max(0,1-this.talismanBreak.age/.6):0;}
 private creditedParts=new WeakSet<Enemy>();
 private jointVictims=new WeakSet<Enemy>();
 charge=0;
 readonly chargeMax=100;
 readonly stageChargeTiming:{pairAt:number|null;fullAt:number|null;chargeAtPair:number|null}={pairAt:null,fullAt:null,chargeAtPair:null};
 private absorbTimer=0;
 private interferenceTimer=0;
 private drops:{x:number;y:number;age:number}[]=[];
 readonly stats = { damage:0, blocked:0, bound:0, ink:0, interfered:0, shots:0, shotHits:0, jointCasts:{kaitian:0,zhenyue:0,zhaohun:0}, chargeGained:0, casts:{chiyan:0,laodun:0,moyuan:0,suanpan:0} };
 constructor(readonly w:World,readonly progression:Progression) {this.resetStage();}
 get team():CompanionState[] {return [...this.present].map(id=>this.roster.find(s=>s.kind===id)!);}
 onChange:(kind:CompanionKind,joined:boolean)=>void=()=>{};
 setTestSelection(kinds:readonly CompanionKind[]|null):void {if(kinds)this.setRoster([...kinds]);}
 setRoster(ids:CompanionKind[]):void {this.present=new Set([...new Set(ids)].filter(id=>this.roster.some(s=>s.kind===id)).slice(0,2));this.resetStage();this.measureChargeTiming();}
 join(kind:CompanionKind,from?:{x:number;y:number}):boolean {if(this.present.has(kind)||this.present.size>=2)return false;this.present.add(kind);const s=this.roster.find(s=>s.kind===kind)!;s.x=from?.x??(kind==='chiyan'?-70:970);s.y=from?.y??this.w.player.y-180;s.cooldown=0;this.flights.set(kind,{left:.8,joining:true,fromX:s.x,fromY:s.y,state:s});this.onChange(kind,true);this.measureChargeTiming();return true;}
 leave(kind:CompanionKind):boolean {if(!this.present.delete(kind))return false;const s=this.roster.find(s=>s.kind===kind)!;this.flights.set(kind,{left:.8,joining:false,fromX:s.x,fromY:s.y,state:s});this.clearEffects();this.onChange(kind,false);return true;}
 resetRun():void {this.present.clear();this.charge=0;Object.assign(this.stats,{damage:0,blocked:0,bound:0,ink:0,interfered:0,shots:0,shotHits:0,chargeGained:0});for(const id of Object.keys(this.stats.jointCasts) as JointKind[])this.stats.jointCasts[id]=0;for(const kind of Object.keys(this.stats.casts) as CompanionKind[])this.stats.casts[kind]=0;this.resetStage();}
 resetStage():void {this.flights.clear();this.clearEffects();Object.assign(this.stageChargeTiming,{pairAt:null,fullAt:null,chargeAtPair:null});this.shotTimer=0;this.absorbTimer=0;this.interferenceTimer=COMPANION_RULES.suanpan.interval;for(const s of this.roster){s.x=this.w.player.x;s.y=this.w.player.y-60;s.cooldown=0;s.count=0;s.penFlight=false;s.angle=0;const def=companionSprites.find(d=>d.id===`companion_${s.kind}`)!;this.animations.set(s.kind,new SpritePlayback(def.sheet??{count:def.frames??1,fps:12,mode:'loop'}));}}
 reset(full=false):void {if(full)this.resetRun();else this.resetStage();}
 private clearEffects():void {for(const e of this.slowed)e.companionSpeed=1;this.slowed.clear();this.areas=[];this.copperPass=null;this.passCooldown=0;this.dash=null;this.dashTrail=[];this.dashArcs=[];this.pushes=[];this.marked=null;this.drops=[];this.shots=[];this.endJoint();this.talisman=null;this.talismanBreak=null;for(const s of this.roster)s.active=0;}
 beginPenFlight():void {this.dash=null;}
 gain(kind:CompanionKind,amount:number):void {const s=this.team.find(c=>c.kind===kind);if(s)s.effective+=amount;}
 isMarked(e:Enemy):boolean {return this.marked===e;}
 weaknessBonus(e:Enemy):number {
  const mark=this.isMarked(e)?COMPANION_RULES.moyuan.markScale:1;
  const net=this.areas.some(a=>a.kind==='moyuan'&&Math.hypot(e.x-a.x,e.y-a.y)<=COMPANION_RULES.moyuan.radius)?COMPANION_RULES.moyuan.damageScale:1;
  return this.mirrorActive(e)?Math.max(mark,net):mark*net;
 }
 private targets():Enemy[] {return this.w.enemies.filter(e=>this.w.targetable(e)&&e.x>=0&&e.x<=900&&e.y>=0&&e.y<=1200);}
 slot(key:CompanionKey) {
  if(key==='R') {
   const kind=this.jointKind(),joint=kind?JOINTS[kind]:null;
   return {id:kind??'',name:joint?.name??'暂无合击',icon:joint?`/art/skills/joint/${joint.icon}.png`:'',cooldown:0,cooldownMax:0,charge:this.charge,chargeMax:this.chargeMax,ready:!!kind&&this.charge>=100&&!this.joint&&this.w.player.alive&&this.w.player.entering<=0&&!this.team.some(s=>s.penFlight),visible:this.team.length>0};
  }
  const s=this.team[key==='Q'?0:1];
  return {id:s?.kind??'',name:s?(s.kind==='laodun'&&this.talisman?'护命符◇':SKILLS[s.kind][0]):'',icon:s?(s.kind==='laodun'?'/art/skills/joint/jade-talisman.png':`/art/icons/skills/${SKILLS[s.kind][1]}.png`):'',cooldown:s?.cooldown??0,cooldownMax:s?COMPANION_RULES[s.kind].cooldown*this.w.skillCooldownScale:0,ready:!!s&&!this.joint&&s.cooldown<=0&&!s.penFlight&&!(s.kind==='chiyan'&&this.dash)&&this.w.player.alive&&this.w.player.entering<=0,visible:!!s};
 }
 cast(key:CompanionKey):boolean {
  if(this.w.bossCombat.inputLocked||!this.slot(key).ready||this.w.challengeState)return false;
  const p=this.w.player,x=p.x,y=p.y;
  if(key==='R')return this.startJoint(x,y);
  const s=this.team[key==='Q'?0:1];
  s.cooldown=COMPANION_RULES[s.kind].cooldown*this.w.skillCooldownScale;this.stats.casts[s.kind]++;
  if(s.kind==='chiyan') {const all=this.targets(),parts=all.filter(e=>this.isBossPart(e)),weak=parts.filter(e=>!e.data.hitArmor&&(e.armorLoose>0||e.data.weakWeapon||e.data.copperPart||e.data.damageBonus>1)),front=all.filter(e=>e.y<p.y);const candidates=weak.length?weak:parts.length?parts:front;
   const target=candidates.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];const tx=target?.x??x,ty=target?.y??Math.max(50,y-360),len=Math.max(1,Math.hypot(tx-s.x,ty-s.y));
   this.dash={x:tx,y:ty,returning:false,seen:new Set(),startX:s.x,startY:s.y,phase:'wind',t:0,ux:(tx-s.x)/len,uy:(ty-s.y)/len,fromX:s.x,fromY:s.y,toX:tx,toY:ty,span:len};}

  else if(s.kind==='laodun') {
   this.talisman={age:0,fromX:s.x,fromY:s.y};s.active=4;
  } else if(s.kind==='moyuan') {
   const front=this.targets().filter(e=>e.y<y);let tx=x,ty=Math.max(60,y-280);
   if(front.length){const best=front.sort((a,b)=>front.filter(e=>Math.hypot(e.x-b.x,e.y-b.y)<=140).length-front.filter(e=>Math.hypot(e.x-a.x,e.y-a.y)<=140).length||Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];tx=best.x;ty=best.y;}
   this.areas.push({kind:'moyuan',x:tx,y:ty,left:4,age:0,fromX:x,fromY:y});s.active=4;
  }

  else {for(const b of this.w.bullets.list)if(!b.dead&&Math.hypot(b.x-x,b.y-y)<=COMPANION_RULES.suanpan.radius){b.dead=true;this.drops.push({x:b.x,y:b.y,age:0});const before=this.w.player.ink;this.w.player.ink=Math.min(1,before+COMPANION_RULES.suanpan.ink);this.stats.ink+=this.w.player.ink-before;}this.w.fx.shockwave(x,y,120,.2,.6);}
  this.w.audio.sfx(key==='Q'?'companion_q':'companion_e');
  this.w.ui.popup(x,y,SKILLS[s.kind][0],'chain',`companion:${s.kind}`);
  return true;
 }
 private jointKind():JointKind|null {
  const pair=this.team.map(s=>s.kind).sort().join('+');
  return pair==='chiyan+laodun'?'kaitian':pair==='laodun+moyuan'?'zhenyue':pair==='moyuan+suanpan'?'zhaohun':null;
 }
 private isBossPart(e:Enemy):boolean {
  if(!e.parent)return !!e.data.bossOwner?.def?.boss;
  let owner=e.parent;while(owner.parent)owner=owner.parent;
  return !!owner.def.boss||owner.phaseLock;
 }
 /** World 在直接击破时通知；父体消失带走的部件不重复计击破。 */
 onEnemyKilled(e:Enemy):void {
  if(this.isBossPart(e)){if(!this.creditedParts.has(e)){this.creditedParts.add(e);this.w.audio.sfx('boss_part');this.addCharge(20);}}
  else if(!e.parent&&!e.def.boss&&!e.def.decorative&&e.lastDamageSource==='companion'&&!this.jointDamageDepth&&!this.jointVictims.has(e))this.addCharge(e.maxHp>=300?25:10);
 }
 onEnemyHpDepleted(e:Enemy):void {if(this.jointDamageDepth)this.jointVictims.add(e);if(this.isBossPart(e))this.onEnemyKilled(e);}
 onBossPhaseCompleted():void {this.endJoint();this.addCharge(30);}
 private addCharge(amount:number):void {if(this.w.bossCombat.freeze)return;const before=this.charge;this.charge=Math.min(100,this.charge+amount);this.stats.chargeGained+=this.charge-before;this.measureChargeTiming();}
 private measureChargeTiming():void {
  if(this.w.stageIndex!==1||this.team.length!==2)return;
  const m=this.stageChargeTiming;if(m.pairAt===null){m.pairAt=this.w.real;m.chargeAtPair=this.charge;}
  if(m.fullAt===null&&this.charge>=100)m.fullAt=this.w.real;
 }
 private hurt(e:Enemy,amount:number,joint=false):void {
  const target:Enemy=e.data.damageTarget??e,hp=target.hp;if(joint)this.jointDamageDepth++;
  try {this.w.damage(e,amount,e.x,e.y,true,'companion',joint?{castKey:this.joint!}:{});}finally{if(joint)this.jointDamageDepth--;}
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
 /** hit() 已排除已有无敌和执笔保护，玉符只接实际扣甲入口。 */
 absorbHit():boolean {
  if(!this.talisman||this.w.challengeState||this.w.bossCombat.inputLocked)return false;
  const p=this.w.player;
  const incoming=this.w.bullets.list.find(b=>!b.dead&&Math.hypot(b.x-p.x,b.y-p.y)<b.radius+12);
  this.talismanBreak={age:0,x:p.x+48,y:p.y+12,angle:incoming?Math.atan2(-incoming.vy,-incoming.vx):-Math.PI/2};
  this.talisman=null;this.roster[1].active=0;p.invuln=Math.max(p.invuln,.6);this.stats.blocked++;
  this.w.audio.sfx('seal',{vol:.45,pitch:1.6});this.w.ui.popup(p.x,p.y-45,'护命符 · 挡下一击','info');
  return true;
 }
 private endJoint():void {if(this.joint)for(const h of this.joint.held)h.enemy.companionSpeed=1;this.joint=null;}
 private phaseValid(j:Joint):boolean {return [...j.bosses].every(([b,v])=>!b.dead&&(b.data.phase??0)===v.phase);}
 isJointCast(key?:object):boolean {return !!key&&key===this.joint;}
 jointLimit(e:Enemy,amount:number,key?:object):number {
  if(!this.isJointCast(key))return amount;
  const j=this.joint!,boss=this.w.bossCaps.bossOf(e);if(!boss)return amount;
  const b=j.bosses.get(boss);return b&&!boss.dead&&(boss.data.phase??0)===b.phase?Math.max(0,Math.min(amount,b.max*.03-b.used)):0;
 }
 jointSettled(e:Enemy,amount:number,key?:object):void {
  if(!this.isJointCast(key))return;
  const j=this.joint!,boss=this.w.bossCaps.bossOf(e),b=boss&&j.bosses.get(boss);
  if(b){b.used+=amount;if(j.kind==='zhaohun'&&b.used>=b.max*.03-1e-6)j.age=Math.max(j.age,4.4);}
 }
 private mirrorActive(e:Enemy):boolean {const j=this.joint;return !!j&&j.kind==='zhaohun'&&j.target===e&&j.age>=.4&&j.age<4.4&&this.phaseValid(j);}
 primaryHit(e:Enemy,actual:number,baseBonus:number):void {
  if(actual<=0||!this.mirrorActive(e))return;
  const j=this.joint!;j.pulse=.12;
  // 主炮已经完成护甲、颜色与弱点结算；镜光只补到最高 1.5 倍。
  this.jointDamageDepth++;
  try{this.stats.damage+=this.w.damage(e,actual*Math.max(0,1.5/baseBonus-1),e.x,e.y,true,'companion',{unmodified:true,castKey:j});}
  finally{this.jointDamageDepth--;}
 }
 private mirrorTarget():Enemy|null {
  const all=this.targets(),parts=all.filter(e=>this.w.bossCaps.bossOf(e));
  const weak=parts.filter(e=>!e.data.hitArmor&&(e.armorLoose>0||e.data.weakWeapon||e.data.copperPart||e.data.damageBonus>1));
  return (weak.length?weak:parts.length?parts:all).sort((a,b)=>b.hp-a.hp)[0]??null;
 }
 private ordinary(e:Enemy):boolean {return !e.parent&&!e.def.boss&&!e.phaseLock&&!this.isBossPart(e)&&!e.def.ground&&!e.def.decorative;}
 private startJoint(x:number,y:number):boolean {
  const kind=this.jointKind();if(!kind)return false;
  const all=this.targets();let target:Enemy|null=null;
  if(kind==='kaitian') {
   const inLane=(e:{x:number;y:number})=>Math.abs(e.x-x)<=90&&e.y<y&&e.y>=y-760;
   if(!all.some(inLane)&&!this.w.bullets.list.some(b=>!b.dead&&!b.hard&&b.age>=b.delay&&inLane(b))){this.w.ui.popup(x,y,'等待目标','info');return false;}
  }else if(kind==='zhenyue') {
   const front=all.filter(e=>e.y<y&&this.ordinary(e));
   target=front.sort((a,b)=>front.filter(e=>Math.hypot(e.x-b.x,e.y-b.y)<=200).length-front.filter(e=>Math.hypot(e.x-a.x,e.y-a.y)<=200).length||Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]??all.filter(e=>this.w.bossCaps.bossOf(e)).sort((a,b)=>b.hp-a.hp)[0]??null;
  }else target=this.mirrorTarget();
  if(kind!=='kaitian'&&!target){this.w.ui.popup(x,y,'等待目标','info');return false;}
  const bosses=new Map<Enemy,{phase:unknown;max:number;used:number}>();
  for(const e of this.w.enemies){const boss=this.w.bossCaps.bossOf(e);if(boss&&!boss.dead)bosses.set(boss,{phase:boss.data.phase??0,max:boss.maxHp,used:0});}
  this.charge=0;this.stats.jointCasts[kind]++;this.dash=null;this.copperPass=null;this.shots=[];
  this.joint={kind,x:target?.x??x,y:target?.y??y,age:0,seen:new Set(),fired:false,target,transferred:false,pulse:0,bosses,held:[]};
  this.w.audio.sfx('companion_r');this.w.ui.popup(x,y-70,`${JOINTS[kind].name} · ${JOINTS[kind].hint}`,'chain',`joint:${kind}`);
  return true;
 }
 bulletSpeedScale(_b:Bullet):number {return 1;}
/** 俯冲斩：后缩蓄力 0.1s，急加速冲过目标，减速停住，再缓出回位。 */
 private updateDash(dt:number,targets:Enemy[]):void {
  const d=this.dash!,s=this.roster[0],p=this.w.player,w=this.w;
  d.t+=dt;
  if(d.phase==='wind') {
   const k=clamp(d.t/DASH_WIND,0,1),back=1-(1-k)**2;
   s.x=d.fromX-d.ux*45*back;s.y=d.fromY-d.uy*45*back;s.angle=Math.atan2(d.uy,d.ux)+Math.PI/2;
   if(d.t>=DASH_WIND){d.phase='rush';d.t=0;d.fromX=s.x;d.fromY=s.y;const len=Math.max(1,Math.hypot(d.x-s.x,d.y-s.y));d.ux=(d.x-s.x)/len;d.uy=(d.y-s.y)/len;d.toX=d.x+d.ux*90;d.toY=d.y+d.uy*90;d.span=len+90;w.fx.burst(s.x,s.y,10,260,COLORS.chiyan,.2);}
   return;
  }
  if(d.phase==='rush') {
   const T=clamp(d.span/2400,.16,.3),k=clamp(d.t/T,0,1),f=easeInOutQuart(k),ox=s.x,oy=s.y;
   s.x=d.fromX+(d.toX-d.fromX)*f;s.y=d.fromY+(d.toY-d.fromY)*f;s.angle=Math.atan2(d.uy,d.ux)+Math.PI/2;
   this.dashTrail.push({x:s.x,y:s.y,angle:s.angle,age:0});
   w.fx.emitHigh({x:s.x,y:s.y,vx:d.ux*100,vy:d.uy*100,drag:5,life:.22,size:22,sizeEnd:4,r:1.4,g:.48,b:.1,a:.65,kind:PK.TraceTex});
   for(const e of targets)if(!d.seen.has(e)&&segDist2(e.x,e.y,ox,oy,s.x,s.y)<=40**2){
    d.seen.add(e);const before=e.hp;w.damage(e,120,e.x,e.y,true,'companion');this.stats.damage+=Math.max(0,before-e.hp);
    const ang=Math.atan2(d.uy,d.ux);w.fx.slashSpark(e.x,e.y,ang+Math.PI/2,[2.4,1.2,.5]);w.fx.hit(e.x,e.y,COLORS.chiyan,6);
    e.data.hitFlashUntil=w.real+.14;e.flash=1;this.dashArcs.push({x:e.x,y:e.y,angle:ang,age:0});
    if(!e.def.boss&&!e.parent&&!e.phaseLock&&!this.isBossPart(e))this.pushes.push({e,vx:d.ux*DASH_PUSH/DASH_PUSH_TIME*2,vy:d.uy*DASH_PUSH/DASH_PUSH_TIME*2,left:DASH_PUSH_TIME});
    w.hitstop(.05);
   }
   if(k>=1){d.phase='back';d.t=0;d.fromX=s.x;d.fromY=s.y;d.returning=true;}
   return;
  }
  const hx=p.x,hy=p.y-60,dur=clamp(Math.hypot(hx-d.fromX,hy-d.fromY)/1600,.3,.55),k=clamp(d.t/dur,0,1),f=easeInOutCubic(k);
  const ox=s.x,oy=s.y;s.x=d.fromX+(hx-d.fromX)*f;s.y=d.fromY+(hy-d.fromY)*f;
  if(Math.hypot(s.x-ox,s.y-oy)>.01)s.angle=Math.atan2(s.y-oy,s.x-ox)+Math.PI/2;
  if(k>=1)this.dash=null;
 }
 private updatePushes(dt:number):void {
  for(const v of this.pushes){const f=Math.max(0,v.left/DASH_PUSH_TIME);v.e.x+=v.vx*f*dt;v.e.y+=v.vy*f*dt;v.left-=dt;}
  this.pushes=this.pushes.filter(v=>v.left>0&&!v.e.dead);
  for(const t of this.dashTrail)t.age+=dt;this.dashTrail=this.dashTrail.filter(t=>t.age<DASH_TRAIL);
  for(const a of this.dashArcs)a.age+=dt;this.dashArcs=this.dashArcs.filter(a=>a.age<.2);
 }
 private jointImpact(j:Joint):void {
  j.fired=true;const y=j.kind==='kaitian'?j.y-40:j.y;
  this.w.hitstop(.055);this.w.fx.shake(.5);
  this.w.fx.shockwave(j.x,y,j.kind==='zhenyue'?230:150,3,.24);
  this.w.r.lights.pulse(j.x,y,220,.8,1,.85,1.1);
  this.w.audio.sfx('seal',{vol:.65,pitch:j.kind==='zhenyue'?.7:1.25});
 }
 /** 仅固定位置，AI 的开火时钟照常；收阵的 0.3 秒平滑交还移动。 */
 applyJointPosition(e:Enemy):void {
  const j=this.joint;if(!j||j.kind!=='zhenyue')return;
  const h=j.held.find(h=>h.enemy===e);if(!h||j.age<.45)return;
  const release=clamp((j.age-2.85)/.3,0,1),gather=CURVES.cubic(clamp((j.age-.45)/.4,0,1));
  const x=h.fromX+(h.x-h.fromX)*gather,y=h.fromY+(h.y-h.fromY)*gather;
  e.x=x+(e.x-x)*release;e.y=y+(e.y-y)*release;
 }
 private updateJoint(dt:number):void {
  const j=this.joint!;
  if(!this.phaseValid(j)){this.endJoint();return;}
  const old=j.age;j.age+=dt;j.pulse=Math.max(0,j.pulse-dt);
  const duration=j.kind==='kaitian'?1.25:j.kind==='zhenyue'?3.15:4.7;
  if(j.age>=duration){this.endJoint();return;}
  const p=this.w.player;
  for(const [i,s] of this.team.entries()) {const side=i?1:-1;const returnK=clamp((j.age-(duration-.25))/.25,0,1);
   this.move(s,(j.kind==='kaitian'?j.x:p.x)+side*70*(1-returnK), (j.kind==='kaitian'?j.y:p.y)-65,1400,dt);s.angle=0;}
  if(j.kind==='kaitian') {
   if(j.age>=.3&&!j.fired)this.jointImpact(j);
   if(j.age>=.3&&old<1){
    const y0=j.y-20-740*clamp((old-.3)/.7,0,1),y1=j.y-20-740*clamp((j.age-.3)/.7,0,1);
    for(const b of this.w.bullets.list)if(!b.dead&&!b.hard&&b.age>=b.delay&&crossesBox(b.x,b.y,b.x+b.vx*dt,b.y+b.vy*dt,j.x-90-b.radius,y1-18-b.radius,j.x+90+b.radius,y0+18+b.radius)){
     b.dead=true;this.stats.blocked++;this.w.fx.burst(b.x,b.y,2,35,[.7,.8,.8],.12);
    }
    for(const e of this.targets())if(!j.seen.has(e)&&crossesBox(e.x,e.y,e.x,e.y,j.x-90-e.radius,y1-18-e.radius,j.x+90+e.radius,y0+18+e.radius)){j.seen.add(e);this.hurt(e,180,true);}
   }
  }else if(j.kind==='zhenyue') {
   if(j.age>=.45&&!j.fired){
    this.jointImpact(j);
    const targets=this.targets().filter(e=>Math.hypot(e.x-j.x,e.y-j.y)<=200);
    for(const e of targets)this.hurt(e,180,true);
    const ordinary=targets.filter(e=>!e.dead&&e.hp>0&&this.ordinary(e)).sort((a,b)=>Math.hypot(a.x-j.x,a.y-j.y)-Math.hypot(b.x-j.x,b.y-j.y)).slice(0,6);
    for(const e of ordinary){const d=Math.hypot(e.x-j.x,e.y-j.y),k=Math.min(100,Math.max(0,d-e.radius))/Math.max(1,d);
     let x=e.x+(j.x-e.x)*k,y=e.y+(j.y-e.y)*k;
     // 从原位向阵心寻找最近的无重叠落点，最多移动 100 像素。
     for(let n=0;n<=10;n++){const f=1-n/10;x=e.x+(j.x-e.x)*k*f;y=e.y+(j.y-e.y)*k*f;if(j.held.every(h=>Math.hypot(x-h.x,y-h.y)>=e.radius+h.enemy.radius))break;}
     if(j.held.some(h=>Math.hypot(x-h.x,y-h.y)<e.radius+h.enemy.radius))continue;
     j.held.push({enemy:e,fromX:e.x,fromY:e.y,x,y});this.stats.bound++;
    }
   }
   for(const h of j.held)if(!h.enemy.dead)h.enemy.companionSpeed=clamp((j.age-2.85)/.3,0,1);
  }else {
   if(j.target&&!this.w.targetable(j.target)){
    if(j.transferred){j.age=Math.max(j.age,4.4);}else{j.target=this.mirrorTarget();j.transferred=true;if(!j.target)j.age=Math.max(j.age,4.4);}
   }
   if(j.target){j.x=j.target.x;j.y=j.target.y;}
   if(j.age>=.4&&!j.fired)this.jointImpact(j);
  }
 }
 private drawJoint(r:Renderer,time:number):void {
  const j=this.joint;if(!j)return;
  const duration=j.kind==='kaitian'?1.25:j.kind==='zhenyue'?3.15:4.7;
  const fade=clamp((duration-j.age)/.25,0,1),impactAt=j.kind==='kaitian'?.3:j.kind==='zhenyue'?.45:.4;
  const burst=clamp(1-(j.age-impactAt)/.22,0,1)*(j.age>=impactAt?1:0),decor=this.w.player.bombT>0?.4:1;
  const art=(id:string,x:number,y:number,sx=1,sy=sx,rot=0,alpha=fade)=>r.air.add(`joint_${id}`,{x,y,sx,sy,rot,alpha,flash:burst*.22*decor,glow:0});
  const line=(x0:number,y0:number,x1:number,y1:number,a=.3,width=2)=>r.ribbonMid.line(x0,y0,x1,y1,width,RS.Glow,.75,1,.92,a*fade*decor);
  if(j.kind!=='kaitian'&&j.age<.2){line(j.x-10,j.y,j.x+10,j.y,.5);line(j.x,j.y-10,j.x,j.y+10,.5);}
  if(j.kind==='kaitian'){
   const open=CURVES.cubic(clamp(j.age/.15,0,1)),gy=j.y-60;
   for(const side of [-1,1]){art('gate-pillar',j.x+side*100*open,gy,side*1.1,1.1);line(j.x+side*90,j.y-20,j.x+side*90,Math.max(0,j.y-760));}
   const sweep=clamp((j.age-.3)/.7,0,1),y=j.y-20-740*sweep;
   const scale=j.age<.3?clamp((j.age-.15)/.15,0,1):1;
   art('fire-feather-blade',j.x,y,(.67+burst*.33)*scale,(.67+burst*.5)*scale);
   if(j.age>=.3&&j.age<1){line(j.x-100,y,j.x+100,y,.85,4+burst*9);line(j.x-80,y+22,j.x+80,y+22,.28,2);}
  }else if(j.kind==='zhenyue'){
   const gather=clamp((j.age-.45)/.4,0,1),R=200-gather*35;
   if(j.age<.85){for(let i=0;i<4;i++){const a=i*Math.PI/2,pts:number[]=[];for(let n=0;n<=12;n++){const t=a+.12+n/12*(Math.PI/2-.24);pts.push(j.x+Math.cos(t)*R,j.y+Math.sin(t)*R);}r.ribbonMid.strip(pts,2,RS.Glow,.75,1,.92,.28*fade);art('array-corner',j.x+Math.cos(a+Math.PI/4)*R,j.y+Math.sin(a+Math.PI/4)*R,1.3,1.3,a);}}
   if(j.age<.85||j.age>2.85){const rise=j.age<.45?(1-clamp((j.age-.2)/.25,0,1))*65:0;art('seal-plate',j.x,j.y-rise,1+burst*.5,1+burst*.5);}
   if(burst){for(const side of [-1,1])line(j.x+side*145,j.y-32,j.x+side*30,j.y+12,burst*.85,7*burst);}
   for(const h of j.held)if(!h.enemy.dead){const e=h.enemy,R=e.radius+9;
    if(j.age<.85)line(e.x,e.y,j.x,j.y,.22);
    for(const dx of [-1,1])for(const dy of [-1,1])art('pin-spike',e.x+dx*R,e.y+dy*R,.7,.7,Math.atan2(dy,dx)+Math.PI/2,fade*.7);
   }
  }else if(j.target){
   const e=j.target,x=clamp(e.x+e.radius+52,48,850),y=e.y,open=CURVES.cubic(clamp(j.age/.2,0,1)),size=1+burst*.5;
   for(const side of [-1,1])art('mirror-half',x+side*23*open,y,side*.68*size,.68*size);
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3-Math.PI/2;art('jade-chip',x+Math.cos(a)*48,y+Math.sin(a)*48,.85,.85,a+Math.PI/2);}
   if(j.age<.4||burst){line(x-28,y-48,x+28,y+48,.8*(burst||.3),4+burst*8);line(x,y,e.x,e.y,.45*burst,3+burst*5);}
   if(j.age>=.4&&j.age<4.4)for(let i=0;i<3;i++){const a=-Math.PI/2+i*Math.PI*2/3,xx=e.x+Math.cos(a)*(e.radius+8),yy=e.y+Math.sin(a)*(e.radius+8),lit=Math.max(burst,j.pulse/.12);line(xx-7,yy-12,xx+3,yy, .32+lit*.6,2+lit*2);line(xx+3,yy,xx-4,yy+9,.32+lit*.6,2+lit*2);}
  }
 }
 private drawTalisman(r:Renderer,time:number):void {
  const p=this.w.player,t=this.talisman;
  if(t){const k=CURVES.cubic(clamp(t.age/.12,0,1)),x=t.fromX+(p.x+48-t.fromX)*k,y=t.fromY+(p.y+12-t.fromY)*k+Math.sin(time*3)*3;
   r.air.add('joint_jade-talisman',{x,y,alpha:clamp((4-t.age)/.5,0,1),glow:0,flash:Math.max(0,1-t.age/.3)});
   if(t.age<.3)for(const side of [-1,1])r.air.add('joint_gate-pillar',{x:this.roster[1].x+side*24,y:this.roster[1].y,sx:side*.25,sy:.25,glow:0});
  }
  const b=this.talismanBreak;if(b&&b.age<.18){const k=b.age/.18;
   for(let i=0;i<6;i++){const a=b.angle+(i-2.5)*.65,d=8+k*(24+i%3*9);r.air.add('joint_shards',{frame:i,x:b.x+Math.cos(a)*d,y:b.y+Math.sin(a)*d,rot:a*k,alpha:1-k,glow:0,flash:1-k});}
  }
 }
 private updateFlights(dt:number):void {const p=this.w.player;for(const [id,f] of this.flights){f.left=Math.max(0,f.left-dt);const k=CURVES.cubic(1-f.left/.8),tx=f.joining?clamp(p.x+(f.state.kind==='chiyan'||f.state.kind==='suanpan'?-82:f.state.kind==='moyuan'?82:0),30,870):f.fromX<450?-90:990,ty=f.joining?p.y-60:-100;if(!f.state.penFlight){f.state.x=f.fromX+(tx-f.fromX)*k;f.state.y=f.fromY+(ty-f.fromY)*k;}if(!f.left)this.flights.delete(id);}}
 updatePresentation(dt:number):void {if(this.w.bossCombat.freeze)return;this.updateFlights(dt);for(const animation of this.animations.values())animation.update(dt);}
 update(dt:number):void {
  if(this.w.bossCombat.freeze)return;
  this.updateFlights(dt);const p=this.w.player;
  if(this.talisman){this.talisman.age+=dt;if(this.talisman.age>=4)this.talisman=null;}
  if(this.talismanBreak){this.talismanBreak.age+=dt;if(this.talismanBreak.age>=.6)this.talismanBreak=null;}
  for(const animation of this.animations.values())animation.update(dt);
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
  if(this.dash&&!this.joint)this.updateDash(dt,targets);
  this.updatePushes(dt);
  if(this.copperPass&&bird){const f=this.copperPass;f.age+=dt;const k=Math.min(1,f.age/.6),back=Math.max(0,Math.min(1,(f.age-.6)/.65)),tx=f.target.x,ty=f.target.y+25;bird.x=f.x+(tx-f.x)*k;bird.y=f.y+(ty-f.y)*k;if(back){bird.x=tx+(p.x+90-tx)*back;bird.y=ty+(p.y-80-ty)*back;}bird.angle=back?Math.PI:0;if(f.age>=1.25||f.target.dead)this.copperPass=null;}
  this.updateShots(dt);
  if(!this.joint)this.fireChiyan(dt,targets);
  this.measureChargeTiming();
  for(const e of this.slowed)e.companionSpeed=1;this.slowed.clear();
  for(const a of this.areas){a.age+=dt;if(a.kind==='moyuan'&&a.age>=.3)for(const e of targets)if(Math.hypot(e.x-a.x,e.y-a.y)<=140){e.companionSpeed=.4;this.slowed.add(e);}
   a.left-=dt;
  }
  this.areas=this.areas.filter(a=>a.left>0);
  if(this.joint)this.updateJoint(dt);
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
  for(let i=0;i<this.dashTrail.length;i++){const t=this.dashTrail[i],k=1-t.age/DASH_TRAIL,n=this.dashTrail[i+1];
   r.air.add('companion_chiyan',{x:t.x,y:t.y,frame:0,sx:.85,sy:.85,rot:t.angle,alpha:k*.4,glow:1.4});
   if(n)r.ribbonMid.line(t.x,t.y,n.x,n.y,14*k+2,RS.Trail,...COLORS.chiyan,.85*k);}
  for(const a of this.dashArcs){const u=a.age/.2,pts:number[]=[],wd:number[]=[],R=62+30*u,span=1.3;
   for(let i=0;i<=14;i++){const q=i/14,th=a.angle-span/2+span*q+(u-.5)*.5;pts.push(a.x+Math.cos(th)*R,a.y+Math.sin(th)*R);wd.push(10*Math.sin(Math.PI*q)*(1-u));}
   r.ribbonTop.strip(pts,new Float32Array(wd),RS.Brush,2.6,2.3,1.8,1-u*u);}
  for(const b of this.shots){r.ribbonMid.line(b.x-b.vx/900*22,b.y-b.vy/900*22,b.x,b.y,4,RS.Glow,...COLORS.chiyan,.9);r.bullets.add(b.x,b.y,Math.atan2(b.vy,b.vx),4,0,1.8,.55,.15,1,1,.1);}
  this.drawJoint(r,time);this.drawTalisman(r,time);
  for(const a of this.areas){const radius=COMPANION_RULES[a.kind].radius,c=COLORS[a.kind];
   if(a.kind==='moyuan'&&a.age<.3){const t=CURVES.cubic(a.age/.3),x=a.fromX+(a.x-a.fromX)*t,y=a.fromY+(a.y-a.fromY)*t-Math.sin(t*Math.PI)*70;r.ribbonMid.line(a.fromX,a.fromY,x,y,8,RS.InkTrail,...c,.8);for(const dx of [-1,1])r.ribbonTop.line(x+dx*18,y-18,x-dx*18,y+18,3,RS.Glow,...c,.9);continue;}
   const pts:number[]=[];for(let i=0;i<=48;i++){const t=i/48*Math.PI*2;pts.push(a.x+Math.cos(t)*radius*Math.min(1,a.age/.15),a.y+Math.sin(t)*radius*Math.min(1,a.age/.15));}r.ribbonMid.strip(pts,5,RS.InkHalo,...c,.8);
   if(a.kind==='moyuan')for(let i=-3;i<=3;i++){const x=i*radius/4,h=Math.sqrt(radius*radius-x*x);r.ribbonMid.line(a.x+x,a.y-h,a.x+x,a.y+h,2,RS.InkTrail,...c,.5);r.ribbonMid.line(a.x-h,a.y+x,a.x+h,a.y+x,2,RS.InkTrail,...c,.5);}}
  if(this.marked){const e=this.marked,size=e.radius+12;for(const dx of [-1,1])for(const dy of [-1,1])r.ribbonMid.line(e.x+dx*size,e.y+dy*size,e.x+dx*(size-12),e.y+dy*size,3,RS.Glow,...COLORS.moyuan,.8);}
  for(const d of this.drops){const k=d.age/.6,p=this.w.player;r.bullets.add(d.x+(p.x-d.x)*k,d.y+(p.y-d.y)*k,0,7*(1-k)+2,3,1.1,.8,.25,1-k,1,.1);}
 }
}
