// 实际伤害口径统一覆盖墨浪、砸字、连线、刀光、字灵与收势。
import type { Enemy } from './enemy';
import type { World } from './world';
import type { Cast } from './mantra';
interface PhaseBudget { id:unknown; observed:unknown; maxHp:number; spent:number; limited:boolean; handsOn:boolean }
export class MantraBudget {
 phases=new WeakMap<Enemy,PhaseBudget>();
 constructor(readonly w:World){}
 resetRun(){this.phases=new WeakMap();}
 owner(e:Enemy):Enemy|null{let root=e;while(root.parent)root=root.parent;return e.data.bossOwner??root.data.bossOwner??(root.def.boss?root:e.def.boss?e:null);}
 beginPhase(owner:Enemy,id:unknown,maxHp:number){this.phases.set(owner,{id,observed:owner.data.phase??0,maxHp,spent:0,limited:false,handsOn:false});}
 state(owner:Enemy){return this.phases.get(owner);}
 phase(owner:Enemy){const id=owner.data.phase??0;let p=this.phases.get(owner);if(!p||p.observed!==id){this.beginPhase(owner,id,owner.maxHp);p=this.phases.get(owner)!;}return p;}
 damage(c:Cast|null,e:Enemy,amount:number,fraction?:number):number{
  const w=this.w,owner=this.owner(e),mult=(e.def.armor??1)*(e.armorLoose>0?3:1)*w.brush.colors.vulnerability(e)*w.companions.weaknessBonus(e)*(e.data.damageBonus??1);
  if(e.dead||e.invulnerable||mult<=0)return 0;
  let wanted=amount*mult,allowed=wanted,p:PhaseBudget|undefined,key:object=e;
  if(owner){p=this.phase(owner);key=p;if(fraction!==undefined)wanted=p.maxHp*fraction;allowed=wanted;
   const used=c?.budget.get(key)??0,cap=p.maxHp*((c?.color==='blue'?.12:.06)+(c?.grade??0)*(c?.color==='blue'?.02:.01));
   const phaseCap=p.maxHp*(c?.color==='blue'&&c.grade===3?.20:.15);
   p.handsOn=owner.hp<=p.maxHp*.15+1e-6;
   allowed=Math.max(0,Math.min(wanted,cap-used,phaseCap-p.spent,owner.hp-p.maxHp*.15));
   // 额度边界立即可见，亲手区同样留甲面命中反馈。
   if(allowed<wanted-1e-6){p.limited=true;e.flash=Math.max(e.flash,.28);w.fx.onDamage(e,'ink',e.x,e.y,0,true);if(w.real-(c?.armorSound??-1)>.15){w.audio.sfx('hit_armor',{vol:.3});if(c)c.armorSound=w.real;}}
  }else if(c&&e.maxHp>=300)allowed=Math.max(0,Math.min(wanted,e.maxHp*.7-(c.budget.get(key)??0)));
  if(allowed<=0)return 0;
  const before=e.hp;w.damage(e,allowed,e.x,e.y,true,'bomb',{unmodified:true,inkColor:c?.color,castKey:c??undefined});const actual=Math.max(0,before-Math.max(0,e.hp));
  if(c){c.budget.set(key,(c.budget.get(key)??0)+actual);c.damage+=actual;}if(p)p.spent+=actual;return actual;
 }
}
