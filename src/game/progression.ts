import type { Renderer } from '../gl/renderer';
import { RS } from '../gl/ribbons';
import { burnDraw, burnEmit } from './burn-fx';
import type { World } from './world';
import type { Enemy } from './enemy';
import { segDist2 } from '../core/math';
import { PK } from '../gl/particles';
import { auraLine, auraRing } from './aura';
import { PLAY_W } from '../types';
import type { DamageSource } from '../types';
export type { DamageSource };
export type CombatWorld = Omit<World,'damage'> & { damage(e:Enemy,amount:number,x?:number,y?:number,quiet?:boolean,source?:DamageSource,ink?:{tag?:'burn'}):void };
export interface Talent { id:string; name:string; route:string; description:string; preview:string; icon:string; max:number }
export interface ProgressionAction { kind:'hit'|'kill'|'graze'|'brushRelease'|'seal'|'bomb'|'focus'|'weaponChange'; source?:DamageSource; amount?:number; enemy?:Enemy; pts?:number[]; erased?:number; hits?:number }
const talent=(id:string,name:string,route:string,description:string,asset=id):Talent=>({id,name,route,description,preview:id,icon:`/art/icons/talents/${asset}.png`,max:1});
export const TALENTS: Talent[] = [
 talent('huoyu','火羽','朱','散射弹让目标燃烧 2 秒，再次命中刷新燃烧。'),
 talent('liaoyuan','燎原','朱','朱色时击坠普通敌机爆开火圈，火圈可以连爆。'),
 talent('niepan','涅槃','护身','每章一次：死亡爆出火环，清普通敌弹并保住火力。','yuhuo'),
 talent('fenguang','分光','青','光束命中第一架大型机，向左右分出两道斜光。'),
 talent('hujian','护剑','青','四把飞剑每 3 秒挡下一颗碰到你的普通敌弹。','yujian'),
 talent('guanri','贯日','青','光束宽度增加一半，贯穿敌机时伤害不衰减。'),
 talent('liansuo','连锁','紫','电弧多跳 2 个目标。'),
 talent('tianlei','天雷','紫','持续电击 3 秒引来天雷，落点周围的敌机也受伤。','leiji'),
 talent('dianci','电磁','紫','每次放电，电弧沿途最多消掉 2 颗普通敌弹。'),
 talent('jifeng','疾风','翻滚','翻滚充能上限从 2 次增加到 3 次。'),
 talent('monang','墨囊','泼墨','泼墨上限加 1，立即补 1 颗；之后每章再补 1 颗。'),
 talent('bili','笔力','执笔','执笔升一级，笔迹更长，运笔时敌弹更慢；最高三级。'),
];
interface Field {x:number;y:number;r:number;t:number;damage:number;clear:boolean;source:DamageSource}
interface TalentFX {id:string;x:number;y:number;left:number;duration:number}
interface SplitBeam {x:number;y:number;ex:number;ey:number;width:number;left:number}
/** 天赋结算只接收实际武器/碰撞事件；光环与伙伴伤害不会计入主电弧时间。 */
export class Progression {
 level=1; xp=0; brushLevel=1; bombLevel=1; brushXP=0; bombXP=0;
 pendingChoices=0; offers:Talent[]=[]; readonly talents=new Map<string,number>();
 private fields:Field[]=[];
 private choicesClaimed=new Set<string>();
 private signals=new Map<string,{timer:number;triggers:number}>();
 private burns=new Map<Enemy,{left:number;dps:number;ember:number;age:number}>();
 private fireQueue:Enemy[]=[]; private exploding=false; private exploded=new WeakSet<Enemy>();
 private visuals:TalentFX[]=[]; private splits:SplitBeam[]=[];
 private time=0; private hitBudget=0;
 private rebornUsed=false; private swordCooldown=0;
 swordFlash=0; swordIndex=0; thunderTime=0;
 constructor(readonly w:CombatWorld){}
 rank(id:string):number{return this.talents.get(id)??0;}
 has(id:string):boolean{return this.rank(id)>0;}
 get bombMax(){return 6+Number(this.has('monang'));}
 get brushMods(){return {minInk:.25,costScale:1,width:18,sealDuration:2.8,damageScale:1};}
 get bombMods(){return {duration:2.6,inkReturn:0,damageScale:(1+(this.bombLevel-1)*.1)};}
 resetRun():void{this.level=1;this.xp=0;this.brushLevel=this.bombLevel=1;this.brushXP=this.bombXP=0;this.pendingChoices=0;this.offers=[];this.talents.clear();this.choicesClaimed.clear();this.signals.clear();this.resetStage();}
 resetStage():void{for(const s of this.signals.values())s.timer=0;this.fields=[];this.burns.clear();this.fireQueue=[];this.exploded=new WeakSet();this.exploding=false;this.visuals=[];this.splits=[];this.hitBudget=0;this.rebornUsed=false;this.swordCooldown=this.swordFlash=this.thunderTime=0;}
 /** 由章节入口在玩家复位之后调用一次；重生不补发。 */
 beginChapter():void{if(this.has('monang'))this.supplyInk();}
 private supplyInk():void{const p=this.w.player,old=p.bombs;p.bombs=Math.min(this.bombMax,p.bombs+1);if(p.bombs>old)this.trigger('monang',p.x,p.y);}
 grant(kind:'combat'|'brush'|'bomb'|'companion',amount=1):void {
  if(!Number.isFinite(amount)||amount<=0)return;
  this.xp+=amount;if(kind==='brush')this.brushXP+=amount;
  if(kind==='bomb'){this.bombXP+=amount;while(this.bombLevel<5&&this.bombXP>=this.bombLevel*12){this.bombXP-=this.bombLevel*12;this.bombLevel++;}}
  while(this.xp>=24+this.level*12){this.xp-=24+this.level*12;this.level++;}
  if(this.pendingChoices&&!this.offers.length)this.offerTalents();
 }
 claimChoice(chapter:number,slot:number):boolean {const key=`${chapter}:${slot}`;if(this.choicesClaimed.has(key))return false;this.choicesClaimed.add(key);this.pendingChoices++;return true;}
 offerTalents():Talent[]{
  // 沿用已有的笔力三级封顶条件，满级时不提供无收益的升级卡。
  const eligible=TALENTS.filter(t=>!this.has(t.id)&&(t.id!=='bili'||this.w.brushPower<3));
  for(let i=eligible.length-1;i>0;i--){const j=this.w.rng.int(0,i);[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
  this.offers=eligible.slice(0,3);return this.offers;
 }
 choose(id:string):boolean {
  if(!this.pendingChoices||this.has(id)||!this.offers.some(t=>t.id===id))return false;
  this.talents.set(id,1);this.signals.set(id,{timer:0,triggers:0});
  if(id==='bili')this.w.brushPower=Math.min(3,this.w.brushPower+1);
  if(id==='jifeng')this.w.roll.charges=Math.min(3,this.w.roll.charges+1);
  if(id==='monang')this.supplyInk();
  this.pendingChoices--;this.offers=[];
  const t=TALENTS.find(t=>t.id===id)!;this.w.say('算盘','得意',`选好${t.name}了，按说明行动就会生效。`,3);return true;
 }
 /** 首次实际生效仅提示一次，跨章也不重复。战斗特效由各机制持续显示。 */
 trigger(id:string,x=this.w.player.x,y=this.w.player.y):void {
  if(!this.has(id))return;const s=this.signals.get(id)??{timer:0,triggers:0};
  s.timer=1.5;this.signals.set(id,s);if(s.triggers)return;s.triggers=1;
  const t=TALENTS.find(t=>t.id===id);if(!t)return;
  this.w.ui.popup(x,y-28,t.name,'chain',`passive:${id}`);this.visual(id,x,y,.8);
 }
 passiveHud(){return [...this.talents.keys()].flatMap(id=>{const t=TALENTS.find(t=>t.id===id);if(!t)return[];const s=this.signals.get(id);return[{id,name:t.name,icon:t.icon,timer:s?.timer??0,triggers:s?.triggers??0}];});}
 recordAction(a:ProgressionAction):void {
  if(a.kind==='hit'&&a.source!=='companion'&&a.source!=='neutral'){const gain=Math.min(Math.max(0,a.amount??1)*.012,Math.max(0,2-this.hitBudget));this.hitBudget+=gain;this.grant('combat',gain);}
  if(a.kind==='kill'){this.grant('combat',a.amount??3);if(a.enemy)this.fireDeath(a.enemy);}
  if(a.kind==='graze')this.grant('combat',.15);
 }
 onBrushRelease(pts:number[],hits=0,erased=0,sealed=0):void{const effective=hits+sealed+Math.min(8,erased*.15);if(effective>0)this.grant('brush',effective*2);}
 onBomb():void {const targets=this.w.enemies.filter(e=>this.w.targetable(e)).length,threats=this.w.bullets.list.filter(b=>!b.dead&&!b.hard).length;if(targets||threats)this.grant('bomb',Math.min(8,targets*2+threats*.08));}
 onRedHit(e:Enemy,damage:number):void{if(!this.has('huoyu')||e.dead||e.invulnerable)return;this.burns.set(e,{left:2,dps:damage,ember:0,age:this.burns.get(e)?.age??0});this.trigger('huoyu',e.x,e.y);}
 isBossPart(e:Enemy):boolean{for(let p:Enemy|null=e;p;p=p.parent)if(p.def.boss||p.data.bossOwner)return true;return false;}
 isLarge(e:Enemy):boolean{return e.maxHp>=300||this.isBossPart(e);}
 private fireDeath(e:Enemy):void {
  if(!this.has('liaoyuan')||this.w.player.weapon!=='red'||this.isBossPart(e)||this.exploded.has(e))return;
  this.exploded.add(e);this.fireQueue.push(e);if(this.exploding)return;this.exploding=true;
  try{while(this.fireQueue.length){const dead=this.fireQueue.shift()!;this.trigger('liaoyuan',dead.x,dead.y);this.visual('liaoyuan',dead.x,dead.y,.5);
   for(const target of this.w.enemies)if(this.w.targetable(target)&&Math.hypot(target.x-dead.x,target.y-dead.y)<=70)this.w.damage(target,Math.min(60,dead.maxHp*.3),target.x,target.y,true,'red');
  }}finally{this.exploding=false;}
 }
 onDeath():boolean{
  if(!this.has('niepan')||this.rebornUsed)return false;this.rebornUsed=true;const p=this.w.player;
  for(const b of this.w.bullets.list)if(!b.dead&&!b.hard){b.dead=true;this.w.fx.gold(b.x,b.y);}
  this.trigger('niepan',p.x,p.y);this.visual('niepan',p.x,p.y,1);return true;
 }
 blockBullet():boolean {
  if(!this.has('hujian')||this.w.player.weapon!=='blue'||this.swordCooldown>1e-8)return false;
  this.swordCooldown=3;this.swordFlash=.3;this.swordIndex=(this.swordIndex+1)%4;const p=this.w.player;
  this.trigger('hujian',p.x,p.y);this.visual('hujian',p.x,p.y,.3);return true;
 }
 splitBeam(e:Enemy,x:number,y:number,width:number,damage:number):void {
  if(!this.has('fenguang')||e.invulnerable)return;this.trigger('fenguang',x,y);
  for(const side of [-1,1]){const dx=side*Math.sin(25*Math.PI/180),dy=-Math.cos(25*Math.PI/180),length=Math.min((side<0?x:PLAY_W-x)/Math.abs(dx),y/-dy);
   const ex=x+dx*length,ey=y+dy*length;this.splits.push({x,y,ex,ey,width:width*.5,left:.04});
   const hits:{e:Enemy;x:number;y:number;d:number}[]=[];
   for(const target of this.w.enemies)if(target!==e&&this.w.targetable(target,true)&&this.w.hitSegment(target,x,y,ex,ey,width*.5))hits.push({e:target,x:this.w.hitX,y:this.w.hitY,d:Math.hypot(this.w.hitX-x,this.w.hitY-y)});
   hits.sort((a,b)=>a.d-b.d);for(const hit of hits){this.w.damage(hit.e,damage*.4,hit.x,hit.y,true,'blue');if(hit.e.invulnerable)break;}
  }
 }
 onDischarge(targets:Enemy[]):void{
  const p=this.w.player,g=p.gun('gun');if(this.has('liansuo')&&targets.length>p.baseThunderTargets)this.trigger('liansuo',targets[p.baseThunderTargets].x,targets[p.baseThunderTargets].y);
  if(!this.has('dianci'))return;
  const arcs:[number,number,number,number][]=[];let previous:Enemy|null=null;
  for(const e of targets){const from=previous&&Math.hypot(e.x-previous.x,e.y-previous.y)<320?previous:null;arcs.push([from?from.x:g.x,from?from.y+from.radius*.65:g.y,e.x,e.y+e.radius*.65]);previous=e;}
  if(!arcs.length)for(const side of [-1,1])arcs.push([g.x,g.y,g.x+side*70,g.y-280]);
  let cleared=0;for(const b of this.w.bullets.list){if(b.dead||b.hard||b.delay>0)continue;if(arcs.some(a=>segDist2(b.x,b.y,...a)<=40**2)){b.dead=true;this.w.fx.gold(b.x,b.y);this.trigger('dianci',b.x,b.y);if(++cleared===2)break;}}
 }
 onElectricHit(dt:number,target:Enemy,dps:number):void{
  if(!this.has('tianlei'))return;this.thunderTime+=dt;
  if(this.thunderTime+1e-8<3)return;this.thunderTime-=3;this.trigger('tianlei',target.x,target.y);this.visual('tianlei',target.x,target.y,.6);
  this.w.damage(target,dps*2,target.x,target.y,true,'purple');
  for(const e of this.w.enemies)if(e!==target&&this.w.targetable(e)&&Math.hypot(e.x-target.x,e.y-target.y)<=60)this.w.damage(e,dps,e.x,e.y,true,'purple');
 }
 addField(x:number,y:number,r:number,duration:number,damage=0,clear=true,source:DamageSource='ink'):void{this.fields.push({x,y,r,t:duration,damage,clear,source});if(this.fields.length>24)this.fields.shift();}
 private visual(id:string,x:number,y:number,duration:number):void{this.visuals.push({id,x,y,left:duration,duration});if(this.visuals.length>80)this.visuals.shift();}
 draw(r:Renderer):void {
  const b=r.ribbonMid;
  for(const f of this.fields)auraRing(b,f.x,f.y,f.r,f.r,[.3,.6,.7],.6,0,3);
  for(const s of this.splits){b.line(s.x,s.y,s.ex,s.ey,s.width*1.35,RS.Glow,.02,.22,.16,.45);b.line(s.x,s.y,s.ex,s.ey,s.width*.5,RS.Bolt,.08,.9,.65,.85);}
  for(const [e,burn]of this.burns)if(!e.dead)burnDraw(b,e,burn.age,this.time);
  for(const f of this.visuals){const u=1-f.left/f.duration,alpha=(1-u)*.85,x=f.x,y=f.y;
   if(['huoyu','liaoyuan','niepan'].includes(f.id)){const radius=(f.id==='niepan'?260:f.id==='liaoyuan'?70:38)*( .25+.75*u);auraRing(b,x,y,radius,radius,[1.9,.36,.06],alpha,0,6*(1-u)+1);for(let i=0;i<8;i++){const a=i*Math.PI/4;auraLine(b,[x+Math.cos(a)*radius*.8,y+Math.sin(a)*radius*.8,x+Math.cos(a)*radius,y+Math.sin(a)*radius-14],3,[2,.6,.08],alpha,RS.AuraFire);}}
   else if(f.id==='tianlei'){const pts:number[]=[];for(let i=0;i<=12;i++)pts.push(x+(i===12?0:Math.sin(i*8)*16),y*i/12);auraLine(b,pts,8*(1-u)+1,[1.3,.7,2],alpha,RS.Lightning);auraRing(b,x,y,60*u,60*u,[.8,.4,1.6],alpha,0,3);}
   else if(f.id==='fenguang')for(const side of [-1,1])auraLine(b,[x,y,x+side*45,y-96],4,[.15,1.5,1.1],alpha,RS.Beam);
   else if(f.id==='guanri')for(const side of [-1,1])auraLine(b,[x+side*(15+u*12),y+40,x+side*(15+u*12),y-80],3,[.1,1.6,1.1],alpha,RS.Beam);
   else if(f.id==='hujian'){auraRing(b,x,y,50+u*20,50+u*20,[.2,1.5,1.3],alpha,0,3);}
   else if(f.id==='liansuo')for(let i=0;i<3;i++)auraLine(b,[x-40+i*40,y-20,x-25+i*40,y,x-40+i*40,y+20],3,[1,.4,1.8],alpha,RS.Lightning);
   else if(f.id==='dianci'){for(let i=0;i<3;i++)auraRing(b,x,y,12+u*(18+i*12),12+u*(18+i*12),[.8,.5,2],alpha,0,2);}
   else if(f.id==='jifeng')for(let i=0;i<3;i++)auraLine(b,[x-45,y+25+i*12,x-20,y+15+i*12,x+30,y+15+i*12,x+55,y+5+i*12],2,[.8,1.4,1.2],alpha,RS.Trail);
   else if(f.id==='monang')for(let i=0;i<6;i++){const a=i*Math.PI/3;auraLine(b,[x+Math.cos(a)*10,y+Math.sin(a)*10,x+Math.cos(a)*(20+u*50),y+Math.sin(a)*(20+u*50)],5,[.12,.2,.19],alpha,RS.InkTrail);}
   else if(f.id==='bili')auraLine(b,[x-65,y+35,x-25,y-10,x+15,y+12,x+65,y-40],6,[.08,.16,.15],alpha,RS.Calligraphy);
  }
 }
 update(dt:number):void {
  this.time+=dt;for(const s of this.signals.values())s.timer=Math.max(0,s.timer-dt);
  this.swordCooldown=Math.max(0,this.swordCooldown-dt);this.swordFlash=Math.max(0,this.swordFlash-dt);
  this.visuals=this.visuals.filter(f=>(f.left-=dt)>0);this.splits=this.splits.filter(s=>(s.left-=dt)>0);this.hitBudget=Math.max(0,this.hitBudget-dt*2);
  for(const [e,burn]of this.burns){if(e.dead){this.burns.delete(e);continue;}const tick=Math.min(dt,burn.left);burn.left-=tick;this.w.damage(e,burn.dps*tick,e.x,e.y,true,'red',{tag:'burn'});burn.age+=dt;burnEmit(this.w,e,burn.age,dt);if(burn.left<=1e-8)this.burns.delete(e);}
  for(const f of this.fields){f.t-=dt;if(f.damage)for(const e of this.w.enemies)if(this.w.targetable(e)&&Math.hypot(e.x-f.x,e.y-f.y)<f.r+e.radius)this.w.damage(e,f.damage*dt,e.x,e.y,true,f.source);if(f.clear)for(const b of this.w.bullets.list)if(!b.dead&&!b.hard&&Math.hypot(b.x-f.x,b.y-f.y)<f.r){b.dead=true;this.w.fx.gold(b.x,b.y);}}
  this.fields=this.fields.filter(f=>f.t>0);
 }
}
