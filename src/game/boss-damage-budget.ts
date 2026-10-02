// P4-25 的最小额度接口；P4-24 整合时以泼墨岗位接口为准。
import type { Enemy } from './enemy';
import type { WeaponColor } from '../types';
export class BossDamageBudget {
 private phases=new WeakMap<Enemy,{phase:number;companion:number;bomb:number;casts:Map<number,number>}>();
 castId=0;color:WeaponColor='red';level=0;
 beginBomb(color:WeaponColor,level=0):number {this.color=color;this.level=level;return ++this.castId;}
 beginPhase(boss:Enemy):void {this.phases.set(boss,{phase:boss.data.phase,companion:0,bomb:0,casts:new Map()});}
 read(boss:Enemy){return this.phases.get(boss);}
 allowBossDamage(boss:Enemy,amount:number,source:string):number {
  let a=this.phases.get(boss);if(!a||a.phase!==boss.data.phase){this.beginPhase(boss);a=this.phases.get(boss)!;}
  if(source!=='bomb'&&source!=='companion')return Math.min(amount,Math.max(0,boss.hp));
  const hand=Math.max(0,boss.hp-boss.maxHp*.15);
  let admitted=Math.min(amount,hand);
  if(source==='companion'){admitted=Math.min(admitted,Math.max(0,boss.maxHp*.12-a.companion));a.companion+=admitted;}
  else {const once=(this.color==='blue'?.12:.06)+this.level*(this.color==='blue'?.02:.01),total=this.color==='blue'&&this.level>=3?.20:.15,used=a.casts.get(this.castId)??0;
   admitted=Math.min(admitted,Math.max(0,boss.maxHp*once-used),Math.max(0,boss.maxHp*total-a.bomb));a.bomb+=admitted;a.casts.set(this.castId,used+admitted);
  }
  return Math.max(0,admitted);
 }
}
