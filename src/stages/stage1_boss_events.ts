// 首领机制保持Boss岗位实现；关卡只观察真实部件和事件，接入对白、笔法与结果。
import type { Co,G } from '../game/api';
import type { Enemy,EnemyDef } from '../game/enemy';
import { director,sayEvent,sayLine } from './dialogue1';
import { copperGate,type RouteState } from './stage1_events';
function dialogue(g:G,s:RouteState,id:string,urgent=false):void{if(s.events.includes(id))return;if((urgent?sayLine(g,id):sayEvent(g,id)))s.events.push(id);}
export function storyBoss(def:EnemyDef,kind:'paper'|'copper',s:RouteState):EnemyDef{
 return {...def,*ai(e:Enemy,g:G):Co{
  if(kind==='copper')copperGate(g,s);
  g.fork((function*():Co{
   let strokeSeen=g.brush.lastStroke?.id??0;while(!e.dead){
    if(e.data.bossCombat){yield;continue;}
    const phase=e.data.phase,rig=e.data.rig,events=(e.data.events??[]) as {id:string}[];
    const happened=(id:string)=>events.some(v=>v.id===id);
    if(kind==='paper'){
     if(phase===1){dialogue(g,s,'PD.arrival');if(g.real-(e.data.phaseStarted??g.real)>2.3)dialogue(g,s,'PD.P1.paperArmorShown');}
     if(phase===2)dialogue(g,s,'PD.P2.repeatSlipShown');
     if(phase===3&&e.data.sealWindow)dialogue(g,s,'PD.P3.sealTargetReady');
     if(happened('seal-timeout')&&s.times['paper.timeout']===undefined)s.times['paper.timeout']=g.t;

    }else{
     if(phase===1){dialogue(g,s,'TQ.T1.returnOrderShown');if(rig?.open>.7)dialogue(g,s,'TQ.T1.chestOpen');}
     if(phase===2){
      if(!(g as G & {brushForms:Set<string>}).brushForms.has('竖')){g.unlockBrush('竖');dialogue(g,s,'TQ.T2.verticalUnlocked',true);}
      dialogue(g,s,'TQ.T2.oldArmorShown');
     }
     if(e.data.armorJokeAt!==undefined)dialogue(g,s,'TQ.T2.firstShellHanging');
     if(rig?.wings?.some((w:{broken:boolean;dropped:number;shell:Enemy})=>w.broken&&g.real>w.dropped+.3))dialogue(g,s,'TQ.T2.firstShellFallen');
     if(phase===3&&e.charging)dialogue(g,s,'TQ.T3.padAimLocked');
     if(happened('supply-cut'))dialogue(g,s,'TQ.T3.powerActuallyCut');
     if(phase===4&&e.data.cutWindow)dialogue(g,s,'TQ.T4.tailLatchExposed');
     if(phase===5&&e.data.sealWindow){dialogue(g,s,'TQ.T5.controllerReady');const stroke=g.brush.lastStroke;if(stroke&&stroke.id!==strokeSeen){strokeSeen=stroke.id;if(!happened('control-sealed'))dialogue(g,s,'TQ.T5.sealMissed');}}
     if(happened('seal-timeout'))s.times['copper.timeout']=g.real;

    }
    yield;
   }
  })());
  if(def.ai)yield* def.ai(e,g);
 },onDeath(e,g){
  def.onDeath?.(e,g);s.bossResults??={};
  s.bossResults[kind]={result:e.data.bossResult,events:e.data.events,phases:e.data.phaseResults,timing:e.data.battleTiming,assisted:e.data.assisted,paperStats:e.data.paperEffects?.stats};
 }};
}

/** 首领已退场后，在关卡协程中排队；通讯不延长停火或被首领销毁取消。 */
export function* paperTimeoutFollowup(g:G,s:RouteState):Co{
 const sealed=s.bossResults?.paper?.result==='sealed';
 yield* director(g).conversation(...(sealed?['PD.P3.foldConfirmed','PD.exitRouteOpened']:['PD.sealTimeout']));
 yield* director(g).conversation('PD.partSalvaged');
}
