import type { Renderer } from '../gl/renderer';
import { RS } from '../gl/ribbons';
import type { World } from './world';
import type { Enemy } from './enemy';
import { segDist2, pointInPoly } from '../core/math';
export type DamageSource = 'red'|'blue'|'purple'|'ink'|'companion'|'neutral';
export type CombatWorld = Omit<World,'damage'> & { damage(e:Enemy,amount:number,x?:number,y?:number,quiet?:boolean,source?:DamageSource):void };
export interface Talent { id:string; name:string; route:string; description:string; requires?:string; requiresAny?:string[]; exclusive?:string; preview:string; icon:string; max:number }
export interface ProgressionAction { kind:'hit'|'kill'|'graze'|'brushRelease'|'seal'|'bomb'|'focus'|'weaponChange'; source?:DamageSource; amount?:number; enemy?:Enemy; pts?:number[]; erased?:number; hits?:number }
export const TALENTS: Talent[] = [
 {id:'R1',name:'双路火羽',route:'朱 · 行为',description:'朱弹分成左右两路，中间留缝；横移对准单敌。',preview:'split',icon:'羽',max:1},
 {id:'B1',name:'偏转光束',route:'青 · 行为',description:'集中射击时，左右移动让光束偏向侧敌；松开集中回正。',preview:'beam',icon:'光',max:1},
 {id:'T1',name:'定点落雷',route:'雷 · 行为',description:'雷击优先墨鸢标记的目标；标记结束恢复普通选敌。',preview:'mark',icon:'雷',max:1},
 {id:'W1',name:'回笔再斩',route:'执笔 · 行为',description:'开放笔画收笔后，沿原线返回斩一次；与留圈封敌互斥。',preview:'echo',icon:'笔',exclusive:'W2',max:1},
 {id:'W2',name:'留圈封敌',route:'执笔 · 行为',description:'闭环留下圈界，普通敌首次进圈短封印；与回笔再斩互斥。',preview:'seal',icon:'圈',exclusive:'W1',max:1},
 {id:'I1',name:'随行墨池',route:'泼墨 · 行为',description:'泼墨后墨池跟随玩家移动；与定点墨池互斥。',preview:'poolMoving',icon:'池',exclusive:'I2',max:1},
 {id:'I2',name:'定点墨池',route:'泼墨 · 行为',description:'泼墨后墨池留在施放处，引敌进入；与随行墨池互斥。',preview:'poolFixed',icon:'池',exclusive:'I1',max:1},
 {id:'Q1',name:'前锋阵',route:'伙伴 · 行为',description:'赤燕、墨鸢站到前方，跟笔追击；与两翼阵互斥。',preview:'front',icon:'阵',exclusive:'Q2',max:1},
 {id:'Q2',name:'两翼阵',route:'伙伴 · 行为',description:'老盾、算盘分列两翼，横移护航；与前锋阵互斥。',preview:'wings',icon:'阵',exclusive:'Q1',max:1},
 {id:'R4',name:'火羽增伤',route:'朱 · 数值',description:'朱色主射伤害增加 15%。',preview:'damage',icon:'羽',requires:'R1',max:1},
 {id:'B4',name:'光束增伤',route:'青 · 数值',description:'青色光束伤害增加 15%。',preview:'damage',icon:'光',requires:'B1',max:1},
 {id:'T4',name:'雷击增伤',route:'雷 · 数值',description:'雷色主射伤害增加 15%。',preview:'damage',icon:'雷',requires:'T1',max:1},
 {id:'W4',name:'执笔省墨',route:'执笔 · 数值',description:'运笔耗墨减少 15%。',preview:'ink',icon:'笔',requiresAny:['W1','W2'],max:1},
 {id:'I4',name:'泼墨增伤',route:'泼墨 · 数值',description:'泼墨和墨池伤害增加 15%。',preview:'damage',icon:'池',requiresAny:['I1','I2'],max:1},
 {id:'Q4',name:'伙伴增伤',route:'伙伴 · 数值',description:'赤燕追击伤害增加 15%。',preview:'damage',icon:'阵',requiresAny:['Q1','Q2'],max:1},
];
interface Field {x:number;y:number;r:number;t:number;damage:number;clear:boolean;source:DamageSource; follow?:boolean}
interface Echo { pts:number[];t:number;damage:number;seen:Set<Enemy> }
export class Progression {
 level=1; xp=0; brushLevel=1; bombLevel=1; brushXP=0; bombXP=0;
 pendingChoices=0; offers:Talent[]=[]; readonly talents=new Map<string,number>();
 private fields:Field[]=[]; private echoes:Echo[]=[];
 private choicesClaimed=new Set<string>();
 private signals=new Map<string,{timer:number;triggers:number}>();
 private circles:{pts:number[];t:number;seen:Set<Enemy>}[]=[];
 private time=0; private hitBudget=0;
 constructor(readonly w:CombatWorld){}
 rank(id:string):number{return this.talents.get(id)??0;}
 has(id:string):boolean{return this.rank(id)>0;}
 get brushMods(){return {minInk:Math.max(.15,.25-this.brushLevel*.012),costScale:Math.max(.62,1-this.brushLevel*.045)*(this.has('W4')?.85:1),maxTime:3.2+(this.brushLevel-1)*.2,width:18+(this.brushLevel-1)*2,sealDuration:2.8,damageScale:1+(this.brushLevel-1)*.12};}
 get bombMods(){return {duration:2.6,inkReturn:0,damageScale:(1+(this.bombLevel-1)*.1)*(this.has('I4')?1.15:1)};}
 resetRun():void{this.level=1;this.xp=0;this.brushLevel=this.bombLevel=1;this.brushXP=this.bombXP=0;this.pendingChoices=0;this.offers=[];this.talents.clear();this.choicesClaimed.clear();this.signals.clear();this.resetStage();}
 resetStage():void{this.circles=[];for(const s of this.signals.values())s.timer=0;this.fields=[];this.echoes=[];this.hitBudget=0;}
 grant(kind:'combat'|'brush'|'bomb'|'companion',amount=1):void {
  if(!Number.isFinite(amount)||amount<=0)return;
  this.xp+=amount;
  if(kind==='brush'){this.brushXP+=amount;while(this.brushLevel<5&&this.brushXP>=this.brushLevel*24){this.brushXP-=this.brushLevel*24;this.brushLevel++;}}
  if(kind==='bomb'){this.bombXP+=amount;while(this.bombLevel<5&&this.bombXP>=this.bombLevel*12){this.bombXP-=this.bombLevel*12;this.bombLevel++;}}
  while(this.xp>=24+this.level*12){this.xp-=24+this.level*12;this.level++;}
  if(this.pendingChoices&&!this.offers.length)this.offerTalents();
 }
 claimChoice(chapter:number,slot:number):boolean {
  const key=`${chapter}:${slot}`;if(this.choicesClaimed.has(key))return false;
  this.choicesClaimed.add(key);this.pendingChoices++;return true;
 }
 offerTalents():Talent[]{
  const eligible=TALENTS.filter(t=>!this.has(t.id)&&(!t.requires||this.has(t.requires))&&(!t.requiresAny||t.requiresAny.some(id=>this.has(id)))&&(!t.exclusive||!this.has(t.exclusive)));
  const color=this.w.player.weapon==='red'?'R1':this.w.player.weapon==='blue'?'B1':'T1';
  const priority=this.talents.size===0?[color,'W1','Q1']:this.talents.size===1?['W2','I1','Q2','T1','B1','R1']:['I2','W1','Q2','T1','B1','R1','Q1'];
  eligible.sort((a,b)=>(priority.indexOf(a.id)<0?99:priority.indexOf(a.id))-(priority.indexOf(b.id)<0?99:priority.indexOf(b.id)));
  this.offers=eligible.slice(0,3);return this.offers;
 }
 choose(id:string):boolean {
  if(!this.pendingChoices||!this.offers.some(t=>t.id===id))return false;
  this.talents.set(id,1);this.pendingChoices--;this.offers=[];this.signals.set(id,{timer:0,triggers:0});
  const t=TALENTS.find(t=>t.id===id)!;this.w.say('算盘','得意',`选好${t.name}了，按说明行动就会生效。`,3);return true;
 }
 trigger(id:string):void {
  if(!this.has(id))return;const s=this.signals.get(id)??{timer:0,triggers:0};
  if(s.timer>0)return;s.timer=1.5;s.triggers++;this.signals.set(id,s);
  const t=TALENTS.find(t=>t.id===id)!;this.w.ui.popup(this.w.player.x,this.w.player.y-42,t.name,'chain',`passive:${id}`);
 }
 passiveHud(){return [...this.talents.keys()].map(id=>{const t=TALENTS.find(t=>t.id===id)!;const s=this.signals.get(id);return{id,name:t.name,icon:t.icon,timer:s?.timer??0,triggers:s?.triggers??0};});}
 primaryScale(source:DamageSource):number {const id=source==='red'?'R4':source==='blue'?'B4':source==='purple'?'T4':'';if(id&&this.has(id)){this.trigger(id);return 1.15;}return 1;}
 recordAction(a:ProgressionAction):void {
  if(a.kind==='hit'&&a.source!=='companion'&&a.source!=='neutral'){const gain=Math.min(Math.max(0,a.amount??1)*.012,Math.max(0,2-this.hitBudget));this.hitBudget+=gain;this.grant('combat',gain);}
  if(a.kind==='kill')this.grant('combat',a.amount??3);
  if(a.kind==='graze')this.grant('combat',.15);
 }
 onBrushRelease(pts:number[],hits=0,erased=0,sealed=0):void{
  const effective=hits+sealed+Math.min(8,erased*.15);if(effective>0)this.grant('brush',effective*2);
  if(pts.length<4)return;
  const x=pts[pts.length-2],y=pts[pts.length-1];
  const closed=pts.length>24&&Math.hypot(pts[0]-x,pts[1]-y)<55;
  if(this.has('W1')&&!closed){this.echoes.push({pts:pts.slice(),t:.95,damage:24,seen:new Set()});this.trigger('W1');}
  if(this.has('W2')&&closed){this.circles.push({pts:pts.slice(),t:3,seen:new Set()});this.trigger('W2');}
  if(this.has('W4'))this.trigger('W4');
 }
 onBomb():void {
  const targets=this.w.enemies.filter(e=>this.w.targetable(e)).length;
  const threats=this.w.bullets.list.filter(b=>!b.dead&&!b.hard).length;
  if(targets||threats)this.grant('bomb',Math.min(8,targets*2+threats*.08));
  this.w.player.ink=Math.min(1,this.w.player.ink+this.bombMods.inkReturn);
  if(this.has('I1')||this.has('I2')){const follow=this.has('I1');this.addField(this.w.player.x,this.w.player.y-70,120,3,28*this.bombMods.damageScale,false);this.fields[this.fields.length-1].follow=follow;this.trigger(follow?'I1':'I2');}
  if(this.has('I4'))this.trigger('I4');
 }
 addField(x:number,y:number,r:number,duration:number,damage=0,clear=true,source:DamageSource='ink'):void{this.fields.push({x,y,r,t:duration,damage,clear,source});if(this.fields.length>24)this.fields.shift();}
 strike(x:number,y:number,r:number,damage:number,source:DamageSource='ink'):number{let n=0;for(const e of this.w.enemies)if(this.w.targetable(e)&&Math.hypot(e.x-x,e.y-y)<r+e.radius){this.w.damage(e,damage,e.x,e.y,true,source);n++;}this.w.fx.shockwave(x,y,r,5,.4);return n;}
 draw(r:Renderer):void {
  for(const f of this.fields){for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;r.ribbonMid.line(f.x+Math.cos(a)*f.r,f.y+Math.sin(a)*f.r,f.x+Math.cos(b)*f.r,f.y+Math.sin(b)*f.r,3,RS.InkHalo,.3,.6,.7,.6);}}
  for(const c of this.circles)for(let i=0;i<c.pts.length-2;i+=2)r.ribbonMid.line(c.pts[i],c.pts[i+1],c.pts[i+2],c.pts[i+3],3,RS.InkTrail,.5,.5,.9,.7);
  for(const e of this.echoes){
   const n=e.pts.length/2,index=Math.min(n-1,Math.floor(Math.max(0,1-e.t/.5)*(n-1)));
   for(let i=n-2;i>=n-2-index;i--)if(i>=0)r.ribbonMid.line(e.pts[i*2],e.pts[i*2+1],e.pts[i*2+2],e.pts[i*2+3],5,RS.Calligraphy,.8,.7,.4,.65);
  }
 }
 update(dt:number):void {
  this.time+=dt;for(const s of this.signals.values())s.timer=Math.max(0,s.timer-dt);
  for(const c of this.circles){c.t-=dt;for(const e of this.w.enemies)if(!c.seen.has(e)&&!e.phaseLock&&!e.def.boss&&!e.parent?.phaseLock&&this.w.targetable(e)&&pointInPoly(e.x,e.y,c.pts)){c.seen.add(e);e.sealed=Math.max(e.sealed,.7);this.trigger('W2');}}this.circles=this.circles.filter(c=>c.t>0);
  this.hitBudget=Math.max(0,this.hitBudget-dt*2);
  for(const f of this.fields){f.t-=dt;if(f.follow){f.x=this.w.player.x;f.y=this.w.player.y-70;}if(f.damage)for(const e of this.w.enemies)if(this.w.targetable(e)&&Math.hypot(e.x-f.x,e.y-f.y)<f.r+e.radius)this.w.damage(e,f.damage*dt,e.x,e.y,true,f.source);if(f.clear)for(const b of this.w.bullets.list)if(!b.dead&&!b.hard&&Math.hypot(b.x-f.x,b.y-f.y)<f.r){b.dead=true;this.w.fx.gold(b.x,b.y);}if(Math.floor(this.time*12)!==Math.floor((this.time-dt)*12))this.w.fx.glowSplat(f.x,f.y,f.r,[.02,.06,.08]);}
  this.fields=this.fields.filter(f=>f.t>0);
  for(const e of this.echoes){
   const old=e.t;e.t-=dt;if(e.t>.5)continue;
   const n=e.pts.length/2;
   const begin=Math.max(0,Math.floor((1-Math.min(.5,old)/.5)*(n-1)));
   const end=Math.min(n-2,Math.floor((1-Math.max(0,e.t)/.5)*(n-1)));
   for(const target of this.w.enemies){
    if(e.seen.has(target)||!this.w.targetable(target))continue;
    for(let j=begin;j<=end;j++){const i=(n-2-j)*2;if(segDist2(target.x,target.y,e.pts[i],e.pts[i+1],e.pts[i+2],e.pts[i+3])<(target.radius+this.brushMods.width)**2){e.seen.add(target);this.w.damage(target,e.damage,target.x,target.y,true,'ink');this.w.fx.hit(target.x,target.y,[1.5,.4,.2],6);break;}}
   }
  }
  this.echoes=this.echoes.filter(e=>e.t>0);
 }
}
