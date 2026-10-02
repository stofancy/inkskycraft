// P4-05b：可见敌机巡逻、最低开火频率与整组弹预算。
import { Scope } from '../core/tasks';
import type { Enemy } from './enemy';
import type { Bullet } from './bullets';
export const DENSITY_LIMITS:Record<number,{enemies:number;bullets:number;bossBullets:number}>={
 1:{enemies:10,bullets:60,bossBullets:60},2:{enemies:14,bullets:60,bossBullets:60},
};
export const MINIMUM_FIRE:Record<number,{interval:number;speed:number}>={1:{interval:2.2,speed:190},2:{interval:1.6,speed:210}};
export interface AttackContext {stage:number;boss:string;phase:number;phaseName:string;attack:string;time:number}
export interface AttackAttempt extends AttackContext {size:number;groupSize:number;existing:number;cap:number;rejected:boolean;reason:string;guardExisting?:number}
export class Density {
 readonly attackLog:AttackAttempt[]=[];
 private batches:Map<Scope,{shots:Bullet[];attacks:Map<string,{context:AttackContext;size:number}>}>|null=null;
 normalLimitOverride:number|null=null;
 /** 难度的 enemyCount：同屏敌机上限按它放缩，普通敌弹上限按 (1+它)/2 放缩。 */
 scale=1;
 /** 同屏普通敌弹上限，由难度表给出。 */
 bulletLimit=60;
 bulletCap(stage:number):number{return DENSITY_LIMITS[stage]?this.bulletLimit:Infinity;}
 patrolBodies=0;
 skippedShots=0;
 reset():void{this.attackLog.length=0;this.batches=null;this.normalLimitOverride=null;this.patrolBodies=this.skippedShots=0;}
 count(enemies:readonly Enemy[]):number{return enemies.filter(e=>!e.dead&&!e.data.densityQueued&&e.data.contentRole==='normal'&&!e.def.boss).length;}
 limit(stage:number):number{return this.normalLimitOverride??Math.round((DENSITY_LIMITS[stage]?.enemies??Infinity)*this.scale);}
 queue(e:Enemy,stage:number,enemies:readonly Enemy[]):void{
  if(e.data.contentRole!=='normal'||e.def.boss||this.count(enemies)<=this.limit(stage))return;
  e.data.densityQueued=true;e.data.densityAlpha=e.alpha;e.alpha=0;e.scope.paused=true;
 }
 release(stage:number,enemies:readonly Enemy[]):void{
  let available=this.limit(stage)-this.count(enemies);
  for(const e of enemies)if(!e.dead&&e.data.densityQueued&&available>0){e.data.densityQueued=false;e.alpha=e.data.densityAlpha;e.scope.paused=false;available--;}
 }
 visible(e:Enemy):boolean{
  if(e.dead||e.alpha<=0||e.data.densityQueued)return false;
  const {w,h,pivot}=e.info,sx=e.scaleX*(e.mirror?-1:1),sy=e.scaleY,c=Math.cos(e.angle),s=Math.sin(e.angle),xs:number[]=[],ys:number[]=[];
  for(const u of [-.5,.5])for(const v of [-.5,.5]){const x=(u*w-pivot[0])*sx,y=(v*h-pivot[1])*sy;xs.push(e.x+x*c-y*s);ys.push(e.y+x*s+y*c);}
  return Math.max(...xs)>0&&Math.min(...xs)<900&&Math.max(...ys)>0&&Math.min(...ys)<1200;
 }
 visibleCount(enemies:readonly Enemy[]):number{return enemies.filter(e=>e.data.contentRole==='normal'&&!e.def.boss&&this.visible(e)).length;}
 emitter(enemies:readonly Enemy[]):Enemy|undefined{
  for(let scope=Scope.current;scope;scope=scope.parent??null){const e=enemies.find(e=>!e.dead&&e.scope===scope);if(e)return e;}
 }
 recordFire(enemies:readonly Enemy[],time:number):void{const e=this.emitter(enemies);if(e?.data.contentRole==='normal'&&!e.def.boss)e.data.densityLastFire=time;}
 // Boss 的连续单发属于同一次协程攻击，统一在本帧协程结束后核对整组预算。
 beginBossBatch():void{this.batches=new Map();}
 recordAttack(context:AttackContext,size:number,existing:number,cap:number,rejected:boolean,groupSize=size,reason='density'):void{
  this.attackLog.push({...context,size,groupSize,existing,cap,rejected,reason});
 }
 trackBossShots(shots:Bullet[],context:AttackContext|null):void{
  if(!context||!this.batches||!Scope.current)return;
  const group=this.batches.get(Scope.current)??{shots:[] as Bullet[],attacks:new Map<string,{context:AttackContext;size:number}>()};group.shots.push(...shots);
  const attack=group.attacks.get(context.attack)??{context,size:0};attack.size+=shots.length;group.attacks.set(context.attack,attack);this.batches.set(Scope.current,group);
 }
 finishBossBatch(stage:number,bullets:readonly Bullet[]):void{
  const cap=DENSITY_LIMITS[stage]?.bossBullets??Infinity,groups=[...(this.batches?.values()??[])];this.batches=null;
  const pending=new Set(groups.flatMap(g=>g.shots)),existing=bullets.filter(b=>!b.dead&&!pending.has(b)).length;let used=existing;
  for(const group of groups){
   const alive=group.shots.filter(b=>!b.dead);if(!alive.length)continue;
   const rejected=used+alive.length>cap;
   for(const a of group.attacks.values())this.recordAttack(a.context,a.size,used,cap,rejected,alive.length);
   if(rejected){alive.forEach(b=>b.dead=true);this.skippedShots++;}else used+=alive.length;
  }
 }
 allowFire(stage:number,enemies:readonly Enemy[],bullets:number,count:number,boss:boolean):boolean{
  const cfg=DENSITY_LIMITS[stage];if(!cfg)return true;
  if(boss&&this.batches&&Scope.current)return true;
  const ordinary=this.emitter(enemies)?.data.contentRole==='normal';
  if(!boss&&!ordinary)return true;
  if(bullets+count<=(boss?cfg.bossBullets:this.bulletCap(stage)))return true;
  this.skippedShots++;return false;
 }
}
