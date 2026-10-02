import { Progression, type CombatWorld, type DamageSource } from './progression';
import { CompanionSystem } from './companion';
export type ComboEvent='shoot'|'weaponChange'|'brushRelease'|'seal'|'bomb'|'focus';
interface Event {kind:ComboEvent;source?:DamageSource;time:number;serial:number}
export interface ComboMove {id:string;name:string;sequence:ComboEvent[];window:number;cost:number;description:string;talent?:string}
export const COMBO_MOVES:ComboMove[]=[
 {id:'drawcut',name:'跟笔追击',sequence:['shoot','brushRelease'],window:2.2,cost:.08,description:'命中 → 收笔：赤燕沿预示线追击',talent:'W1'},
 {id:'jade',name:'收笔护航',sequence:['focus','brushRelease'],window:3.5,cost:.06,description:'集中 → 收笔：老盾展开有限护盾',talent:'Q2'},
 {id:'prison',name:'圈封标记',sequence:['brushRelease','seal'],window:1,cost:.12,description:'收笔成封：墨鸢标记有效敌人',talent:'W2'},
 {id:'lance',name:'标记追雷',sequence:['focus','weaponChange','shoot'],window:2.5,cost:.08,description:'集中 → 换色 → 命中：墨鸢指向目标',talent:'T1'},
];
export class ComboSystem {
 readonly moves=COMBO_MOVES;lastName='';lastTimer=0;total=0;
 private events:Event[]=[];private time=0;private serial=0;private lastShoot=-10;private cooldown=new Map<string,number>();
 constructor(readonly w:CombatWorld,readonly progression:Progression,readonly companions:CompanionSystem){}
 resetRun():void{this.total=0;this.resetStage();}
 resetStage():void{this.events=[];this.lastName='';this.lastTimer=0;this.cooldown.clear();this.lastShoot=-10;}
 update(dt:number):void{this.time+=dt;this.lastTimer=Math.max(0,this.lastTimer-dt);this.events=this.events.filter(e=>this.time-e.time<=6);}
 get moveList():string[]{return this.moves.map(m=>`${m.name} · ${m.description} · 墨${Math.round(m.cost*100)}${m.talent&&!this.progression.has(m.talent)?' [天赋未解锁]':''}`);}
 record(kind:ComboEvent,source?:DamageSource):string|null{
  if(!this.w.player.alive)return null;
  if(kind==='shoot'){
   // Only real primary-weapon hits count. Companion/ink echoes cannot manufacture chains.
   if(source!=='red'&&source!=='blue'&&source!=='purple')return null;
   const previous=this.events[this.events.length-1];
   if(this.time-this.lastShoot<.18&&previous?.kind==='shoot'&&previous.source===source)return null;
   if(previous?.kind==='shoot'&&previous.source===source){previous.time=this.time;this.lastShoot=this.time;return null;}
   this.lastShoot=this.time;
  }
  this.events.push({kind,source,time:this.time,serial:++this.serial});
  if(this.events.length>24)this.events.shift();
  // More specific talent chains resolve before their shorter suffixes.
  const moves=this.moves.filter(m=>!m.talent||this.progression.has(m.talent)).sort((a,b)=>b.sequence.length-a.sequence.length);
  for(const move of moves){
   if((this.cooldown.get(move.id)??0)>this.time)continue;
   const matched=this.match(move);if(!matched)continue;
   if(this.w.player.ink<move.cost)continue;
   if(!this.execute(move))continue;
   this.w.player.ink-=move.cost;this.cooldown.set(move.id,this.time+3.5);
   // Keep history for longer derived moves; this event resolves only one finisher.
   // Per-move cooldown and the newest-event check prevent repeated stale triggers.
   this.lastName=move.name;this.lastTimer=2.6;this.total++;
   this.w.ui.popup(this.w.player.x,this.w.player.y-95,`${move.name}！`,'seal');
   if(move.talent)this.progression.trigger(move.talent);this.w.fx.shake(.1);this.progression.grant('combat',2);return move.id;
  }
  return null;
 }
 private match(move:ComboMove):Event[]|null{
  const matched:Event[]=[];let idx=move.sequence.length-1;
  for(let i=this.events.length-1;i>=0&&idx>=0;i--){const e=this.events[i];if(this.time-e.time>move.window)break;if(e.kind===move.sequence[idx]){matched.unshift(e);idx--;}}
  // The new event must finish this move, stale completed subsequences do not retrigger.
  if(idx>=0||matched[matched.length-1]?.serial!==this.serial)return null;
  return matched;
 }
 private execute(move:ComboMove):boolean{
  const power=1;
  switch(move.id){
   case 'drawcut':return this.companions.burst('chiyan',power);
   case 'jade':return this.companions.burst('laodun',power);
   case 'prison':case 'lance':return this.companions.burst('moyuan',power);
  }
  return false;
 }
}
