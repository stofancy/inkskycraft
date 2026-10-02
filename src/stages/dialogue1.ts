// 第一章对白：剧情按页确认，战斗短句按游戏时钟排队；演出使用独立时钟。
import { BOSS_DIALOGUE_BY_ID } from './dialogue1_boss_data';
import type { Co,G } from '../game/api';
import type { World } from '../game/world';
import type { DialogueActor } from '../types';
import { CH1_LINES } from './dialogue1_data';
export { CH1_LINES };
const LABEL={calm:'平静',smug:'得意',alarmed:'着急'} as const;
const IDS:Record<string,string>={小满:'xiaoman',赤燕:'chiyan',老盾:'laodun',算盘:'suanpan',总镖头:'zhangmen',铜雀:'tongque',纸龙:'zhilong',屿长:'gongtou',蜃:'mirage',墨鸢:'moyuan',雷公:'leigong'};
export type Line={id:string;trigger:string;speaker:string;emotion:'calm'|'smug'|'alarmed';text:string;memory:boolean;pause?:boolean;identity?:string};
export const DISABLED_BOSS_EVENTS=new Set(['PD.arrival','PD.P1.paperArmorShown','PD.P2.repeatSlipShown','PD.P3.sealTargetReady','PD.P3.foldConfirmed','PD.exitRouteOpened','PD.sealTimeout','TQ.T1.returnOrderShown','TQ.T1.chestOpen','TQ.T2.verticalUnlocked','TQ.T2.firstShellHanging','TQ.T2.firstShellFallen','TQ.T3.padAimLocked','TQ.T3.powerActuallyCut','TQ.T4.tailLatchExposed','TQ.T5.controllerReady','TQ.T5.sealMissed','TQ.controlStopped','TQ.sealTimeout']);
interface Group {event:string;lines:Line[];at:number;queuedAt:number;notBefore:number;long:boolean;filler:boolean;persistent:boolean;started?:number;index:number;done:boolean;expired?:boolean;afterLine?:string;segment:string}
export class ChapterDialogue {
 queue:Group[]=[];current:Group|null=null;until=0;briefRemaining=0;
 triggered=new Set<string>();history:Line[]=[];dropped:{id:string;reason:string}[]=[];
 briefIds:number[]=[];groups:Group[]=[];lineStarts:Record<string,number>={};lineEnds:Record<string,number>={};
 onLineStart?: (line:Line)=>void;onLineEnd?: (line:Line)=>void;
 private completed=false;private segment=0;
 get groupTimings(){return this.groups.map(v=>({event:v.event,ids:v.lines.map(l=>l.id),grouped:v.lines.length>1,triggered:v.at,started:v.started,delay:v.started===undefined?null:v.started-v.at,dropped:!!v.expired,done:v.done,afterLine:v.afterLine}));}
 constructor(readonly g:World,readonly lines:readonly Line[]=[...CH1_LINES,...Object.values(BOSS_DIALOGUE_BY_ID)]){g.ui.resetCommunications();}
 get spawnPaused(){return this.paused;}
 get paused(){return this.briefRemaining>0||this.g.ui.dialogueState().active;}
 event(event:string,long=false,afterLine?:string):Group|undefined{
  if(this.triggered.has(event))return;
  this.triggered.add(event);
  const skill=event==='PD.partSalvaged'?'tishen':event==='TQ.POST.partSalvaged'?'zhongpao':null;
  if(skill&&!this.g.skills.unlocked.has(skill))this.g.skills.unlock(skill,450,350);
  if(DISABLED_BOSS_EVENTS.has(event))return;
  const lines:Line[]=this.lines.filter(l=>l.trigger===event);if(!lines.length)return;
  const group:Group={event,lines,at:this.g.presentationTime,queuedAt:this.g.real,notBefore:this.g.real+(event.startsWith('B-')&&/(成功|失败)$/.test(event)?.5:0),long:long||lines.some(l=>l.pause),filler:!long&&!lines.some(l=>l.pause)&&/中弹/.test(event),persistent:/^E02\.cannonStopped$|HP≤|^B-4\..*(成功|失败)$/.test(event),index:0,done:false,afterLine,segment:event};this.enqueue(group);return group;
 }
 short(id:string,speaker:string,text:string):void {const line:Line={id,trigger:id,speaker,emotion:'calm',text,memory:false,pause:false};const group:Group={event:id,lines:[line],at:this.g.presentationTime,queuedAt:this.g.real,notBefore:this.g.real,long:false,filler:false,persistent:true,index:0,done:false,segment:id};this.enqueue(group);}
 private drop(group:Group,reason:string){group.done=true;group.expired=true;this.dropped.push(...group.lines.map(l=>({id:l.id,reason})));}
 private enqueue(group:Group){
  this.groups.push(group);
  if(group.filler&&this.queue.length>0){this.drop(group,'填充喊话让位于排队对白');return;}
  if(!group.filler){for(const v of this.queue.filter(v=>v.filler))this.drop(v,'填充喊话让位于排队对白');this.queue=this.queue.filter(v=>!v.filler);}
  this.queue.push(group);
 }
 *conversation(...events:string[]):Co{const segment=`conversation-${++this.segment}`;const groups=events.map(id=>this.event(id,true)).filter(Boolean) as Group[];for(const group of groups)group.segment=segment;while(groups.some(v=>!v.done))yield;}
 brief(id:number):void{this.briefIds.push(id);this.briefRemaining=3.65;this.g.ui.missionBrief(id);}
 private actor(line:Line):DialogueActor{const id=IDS[line.speaker],expr=LABEL[line.emotion];if(!id)return {name:line.speaker,identity:line.identity,portrait:'',expressions:{}};return {name:line.speaker,identity:line.identity,portrait:`/art/portraits/${id}/calm.png`,expressions:{[expr]:`/art/portraits/${id}/${id==='suanpan'?'calm':line.emotion}.png`}};}
 private end(line:Line){this.lineEnds[line.id]=this.g.presentationTime;this.onLineEnd?.(line);}
 private skipSegment(){
  const group=this.current;if(!group)return;const pending=[group,...this.queue.filter(v=>v.segment===group.segment)];
  this.queue=this.queue.filter(v=>v.segment!==group.segment);
  for(const v of pending){if(v===group)this.end(v.lines[v.index-1]);for(const line of v.lines.slice(v.index)){this.history.push(line);this.g.ui.recordCommunication(this.actor(line),LABEL[line.emotion],line.text,line.id,line.memory);this.lineStarts[line.id]=this.g.presentationTime;this.onLineStart?.(line);this.end(line);}v.done=true;}
  this.current=null;this.completed=false;this.until=0;
 }
 tick(dt:number):void{
  const blocked=this.g.bossCombat.dialogueBlocked;const el=document.querySelector<HTMLElement>('.communication');if(el)el.style.visibility=blocked?'hidden':'';if(blocked){if(this.current)this.until+=dt;return;}
  if(this.briefRemaining>0){this.briefRemaining=Math.max(0,this.briefRemaining-dt);return;}
  if(this.current&&this.current.index>0&&(this.completed||(!this.current.long&&this.g.real>=this.until))){const group=this.current;this.end(group.lines[group.index-1]);this.completed=false;if(group.index>=group.lines.length){group.done=true;this.current=null;}}
  if(!this.current){while(this.queue.length){const index=this.queue.findIndex(v=>this.g.real>=v.notBefore&&(!v.afterLine||this.lineEnds[v.afterLine]!==undefined));if(index<0)break;const next=this.queue.splice(index,1)[0];
   if(!next.long&&!next.persistent&&(next.lines.length===1||next.event.startsWith('B-'))&&this.g.real-next.queuedAt>6){this.drop(next,'战斗喊话排队超过6秒');continue;}
   next.started=this.g.presentationTime;this.current=next;this.until=0;break;
  }}
  if(!this.current){this.g.ui.chapterSay({name:''},'','','',false);return;}
  if(this.g.ui.dialogueState().active)return;
  if(this.current.long||this.g.real>=this.until){
   const line=this.current.lines[this.current.index];
   this.current.index++;this.history.push(line);this.lineStarts[line.id]=this.g.presentationTime;
   this.until=this.g.real+Math.max(2.5,Array.from(line.text).length*.18);
   this.g.ui.chapterSay(this.actor(line),LABEL[line.emotion],line.text,line.id,line.memory,this.current.long?{pause:true,onDone:()=>{this.completed=true;},onSkip:()=>this.skipSegment()}:undefined);
   this.onLineStart?.(line);
  }
 }
}
export const director=(g:G)=>(g as World).chapterDialogue!;
export function resetDialogue(g:G):void{(g as World).chapterDialogue=new ChapterDialogue(g as World);}
export function sayLine(g:G,event:string,_opts:unknown={}):boolean{return !!director(g)?.event(event);}
export const sayEvent=sayLine;
