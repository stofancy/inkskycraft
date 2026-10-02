// 第一章破招与来源账本。只在标记 bossCombat 的纸龙/铜雀开启；UI 由本模块挂载，不改共享 UI/渲染器。
import { clamp,pointInPoly,polyArea,segDist2,segIntersect } from '../core/math';
import { RS } from '../gl/ribbons';
import type { World } from './world';
import type { Enemy } from './enemy';
import type { DamageSource,WeaponColor } from '../types';
import type { Co } from './api';
import { BossDamageBudget } from './boss-damage-budget';
export type BossCommand='封'|'竖'|'横'|'色击'|'翻滚';
export interface BossQte {boss:Enemy;command:BossCommand;target:Enemy|{x:number;y:number;radius:number};hint:string;failure:string;color?:WeaponColor;band?:{x:number;width:number};teach?:boolean;final?:boolean;onSuccess?:()=>void;onFailure?:()=>void}
interface Window extends BossQte {id:number;state:'warning'|'entry'|'window'|'success'|'failure'|'exit';age:number;remaining:number;duration:number;result:boolean|null;wrong:string;settled:boolean;rollStarted:boolean;rollCrossed:boolean;rollX:number;rollY:number}
export type DamageKind='炮'|'笔'|'破'|'墨'|'友';
export interface PhaseLedger {boss:string;phase:number;maxHp:number;damage:Record<DamageKind,number>;events:{source:DamageSource;amount:number;target:number;real:number}[];last:string;elapsed:number;broken?:boolean;percent?:Record<DamageKind,number>}
const weaponNames={red:'朱',blue:'青',purple:'紫'};
export class BossCombat {
 readonly budget=new BossDamageBudget();
 qte:Window|null=null;history:{id:number;boss:string;phase:number;command:BossCommand;result:boolean;duration:number;wrong:number;real:number}[]=[];
 phase:PhaseLedger|null=null;recent:PhaseLedger[]=[];excluded=0;private serial=0;private first=new WeakSet<Enemy>();private counts=new Map<string,number>();
 private recoveryLeft=0;private lockedFlash='';
 private wrongCount=0;private stroke:number[]|null=null;private brushArmed=false;private rollArmed=false;private shootArmed=false;private inputSerial=0;
 private battlePauseStarted=0;
 private battle:{boss:string;start:number;total:number;pausedDialogueSeconds:number;categories:Record<string,number>;segments:{name:string;kind:string;seconds:number}[]}|null=null;
 battles:NonNullable<BossCombat['battle']>[]=[];private modeName='';private modeKind='对白演出';
 mode(name:string,kind:'对白演出'|'机制段'|'打血时间'):void{this.modeName=name;this.modeKind=kind;}
 beginBattle(e:Enemy):void {this.battlePauseStarted=this.w.dialoguePauseSeconds;this.battle={boss:e.def.name!,start:this.w.real,total:0,pausedDialogueSeconds:0,categories:{对白演出:0,机制段:0,破招窗口:0,打血时间:0},segments:[]};e.data.battleStartedClock=this.clock;e.data.battleHardDeadline=this.w.real+(e.def.name==='纸龙'?300:250);}
 endBattle(e:Enemy):void {if(!this.battle)return;this.battle.pausedDialogueSeconds=this.w.dialoguePauseSeconds-this.battlePauseStarted;this.battle.total=Object.values(this.battle.categories).reduce((s,v)=>s+v,0);e.data.battleTiming=this.battle;this.battles.push(this.battle);this.battle=null;this.qte=null;this.present();}
 private overlay:HTMLDivElement|null=null;private summaryLeft=0;private summary:PhaseLedger|null=null;private locks=new Set<string>();private transitionUntil=0;
 private blocked:{x:number;y:number;left:number;label:string}[]=[];
 get clock(){return this.w.real-this.excluded;}
 get freeze(){return !!this.qte&&this.qte.state!=='warning';}
 get inputLocked(){return this.freeze;}
 get dialogueBlocked(){return !!this.qte&&['warning','entry','window'].includes(this.qte.state)||this.w.real<this.transitionUntil;}
 get scale(){const q=this.qte;if(!q)return 1;if(q.state==='entry')return 1-.94*clamp(q.age/.4,0,1);if(q.state==='window'||q.state==='success'||q.state==='failure')return .06;if(q.state==='exit')return .06+.94*clamp(q.age/.3,0,1);return 1;}
 constructor(readonly w:World){window.addEventListener('keydown',e=>{if(this.inputLocked&&/^Digit[1-5]$/.test(e.code)){this.lockedFlash=e.code.slice(-1);this.present();document.querySelector('[data-boss-lock]')?.animate([{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:180});}});}
 reset():void {this.transitionUntil=0;this.recoveryLeft=0;this.lockedFlash='';this.summary=null;this.battle=null;this.qte=null;this.phase=null;this.excluded=0;this.counts.clear();this.locks.clear();this.stroke=null;this.summaryLeft=0;this.blocked=[];this.present();}
 newGame():void {this.battles=[];this.recent=[];this.history=[];this.first=new WeakSet();this.reset();}
 beginPhase(e:Enemy):void {if(!e.data.bossCombat)return;this.budget.beginPhase(e);this.phase={boss:e.def.name!,phase:e.data.phase,maxHp:e.maxHp,damage:{炮:0,笔:0,破:0,墨:0,友:0},events:[],last:'',elapsed:0};}
 endPhase(e:Enemy,broken:boolean):void {if(!e.data.bossCombat||!this.phase)return;const a=this.phase;a.broken=broken;const total=Object.values(a.damage).reduce((s,v)=>s+v,0);a.percent={炮:0,笔:0,破:0,墨:0,友:0};if(total>0)for(const k of Object.keys(a.damage) as DamageKind[])a.percent[k]=a.damage[k]/total*100;
  this.recent.push(a);this.summary=a;this.summaryLeft=1.2;this.phase=null;this.transitionUntil=this.w.real+.5;this.present();
 }
 owner(e:Enemy):Enemy|null {if(e.data.bossOwner?.data?.bossCombat)return e.data.bossOwner;let p:Enemy|null=e;while(p){if(p.data.bossCombat)return p;p=p.parent;}return null;}
 allow(e:Enemy,amount:number,source:DamageSource):number {
  const boss=this.owner(e);if(!boss)return amount;
  if(this.freeze&&source!=='qte')return 0;
  if(boss.data.copperSimple)return Math.min(amount,Math.max(0,(e.data.damageTarget??e).hp));
  const admissible=this.budget.allowBossDamage(boss,Math.min(amount,e.hp),source);
  if(admissible+1e-8<amount&&(source==='bomb'||source==='companion')){e.flash=.28;if(!this.blocked.length)this.w.audio.sfx('hit_armor');this.blocked.push({x:e.x,y:e.y,left:.5,label:boss.hp<=boss.maxHp*.15+1e-6?'亲手区':'额度已满'});if(this.blocked.length>8)this.blocked.shift();}
  return admissible;
 }
 record(e:Enemy,amount:number,source:DamageSource):void {const boss=this.owner(e),a=this.phase;if(!boss||!a||a.phase!==boss.data.phase||amount<=0)return;
  const kind:DamageKind=source==='ink'?'笔':source==='qte'?'破':source==='bomb'?'墨':source==='companion'?'友':'炮';
  a.damage[kind]+=amount;a.events.push({source,amount,target:e.id,real:this.w.real});a.last=source==='qte'?'朱雀·破':source==='ink'?'朱雀·执笔':source==='bomb'?'朱雀·泼墨':source==='companion'?'赤燕':`朱雀·${weaponNames[source as WeaponColor]??'主炮'}`;

 }
 *challenge(opts:BossQte):Generator<unknown,boolean,unknown> {
  if(this.qte)return false;const key=`${opts.boss.id}:${opts.boss.data.phase}:${opts.final?'seal':'attack'}`,used=this.counts.get(key)??0;if(used>=(opts.final?3:2))return false;
  this.counts.set(key,used+1);const first=!this.first.has(opts.boss);this.first.add(opts.boss);
  const q:Window={...opts,id:++this.serial,state:'warning',age:0,remaining:0,duration:first||opts.teach?5:3.5,result:null,wrong:'',settled:false,rollStarted:false,rollCrossed:false,rollX:this.w.player.x,rollY:this.w.player.y};
  this.qte=q;opts.boss.charging=true;this.present();this.w.audio.sfx('menu_ok');
  try {while(this.qte===q){yield;}return q.result===true;}finally {if(this.qte===q){this.qte=null;this.w.brush.cancel();this.stroke=null;this.present();}opts.boss.charging=false;}
 }
 private open():void {const q=this.qte!;q.state='window';q.age=0;q.remaining=q.duration;this.w.brush.cancel();this.stroke=null;this.w.input.pointerSamples.length=0;this.brushArmed=!this.w.input.down('brush');this.shootArmed=!this.w.input.down('shoot');this.rollArmed=!this.w.input.down('roll');this.inputSerial=this.w.input.resetSerial;this.wrongCount=0;
  if(q.teach)this.w.brushForms.add('竖');for(const b of this.w.bullets.list)if(!b.dead&&Math.hypot(b.x-this.w.player.x,b.y-this.w.player.y)<=160){b.dead=true;this.w.brush.paths.drops.push({x:b.x,y:b.y});}
 }
 private settle(success:boolean):void {const q=this.qte;if(!q||q.settled||q.state!=='window')return;q.settled=true;q.result=success;q.state=success?'success':'failure';q.age=0;this.stroke=null;this.w.input.pointerSamples.length=0;this.w.brush.cancel();
  this.history.push({id:q.id,boss:q.boss.def.name!,phase:q.boss.data.phase,command:q.command,result:success,duration:q.duration,wrong:this.wrongCount,real:this.w.real});
  if(success){if(!q.boss.data.c2Mirage||q.command!=='色击'&&q.command!=='翻滚'){q.boss.invulnerable=false;this.w.damage(q.boss,q.boss.maxHp*.18,q.target.x,q.target.y,true,'qte');}this.w.player.ink=Math.min(1,this.w.player.ink+.1);this.w.hitstop(.25);q.boss.data.qteInterruptedAt=this.clock;q.onSuccess?.();this.w.audio.sfx('counter_success');this.w.fx.shockwave(q.target.x,q.target.y,90,10,.6);}
  else {q.wrong=q.failure;q.onFailure?.();this.w.audio.sfx('counter_fail');}
 }
 private judge(pts:number[]):boolean {
  const q=this.qte!;if(pts.length<4)return false;let length=0;for(let i=0;i<pts.length-2;i+=2)length+=Math.hypot(pts[i+2]-pts[i],pts[i+3]-pts[i+1]);const n=pts.length,x=q.target.x,y=q.target.y,r=q.target.radius,dx=pts[n-2]-pts[0],dy=pts[n-1]-pts[1];
  if(q.command==='封'){
   // 与普通执笔同一自交闭环算法；缺口允许目标直径，补最后一段后仍须含目标中心。
   const loops:number[][]=[];
   if(Math.hypot(dx,dy)<=2*r)loops.push([...pts,pts[0],pts[1]]);
   for(let i=0;i<n-6;i+=2)for(let j=n-4;j>=i+4;j-=2){const t=segIntersect(pts[i],pts[i+1],pts[i+2],pts[i+3],pts[j],pts[j+1],pts[j+2],pts[j+3]);if(t>=0){const xx=pts[i]+(pts[i+2]-pts[i])*t,yy=pts[i+1]+(pts[i+3]-pts[i+1])*t;loops.push([xx,yy,...pts.slice(i+2,j+2),xx,yy]);break;}}
   return loops.some(poly=>{let perimeter=0;for(let i=0;i<poly.length-2;i+=2)perimeter+=Math.hypot(poly[i+2]-poly[i],poly[i+3]-poly[i+1]);return perimeter>=r*6&&perimeter<=r*12&&Math.abs(polyArea(poly))>r*r&&pointInPoly(x,y,poly);});
  }
  const distance=Math.hypot(dx,dy),straight=length<=distance*1.25&&pts.every((_,i)=>i%2||segDist2(pts[i],pts[i+1],pts[0],pts[1],pts[n-2],pts[n-1])<=35**2);
  if(!straight||distance<240)return false;
  if(q.command==='竖')return Math.abs(dx)<=Math.abs(dy)*Math.tan(25*Math.PI/180)&&segDist2(x,y,pts[0],pts[1],pts[n-2],pts[n-1])<=r*r;
  if(q.command==='横')return Math.abs(dy)<=Math.abs(dx)*Math.tan(25*Math.PI/180)&&Math.min(pts[0],pts[n-2])<=x-r&&Math.max(pts[0],pts[n-2])>=x+r&&segDist2(x,y,pts[0],pts[1],pts[n-2],pts[n-1])<=r*r;
  return false;
 }
 update(realDt:number):void {
  if(this.battle){const kind=this.qte?'破招窗口':this.modeKind==='打血时间'&&this.w.enemies.some(e=>e.data.bossCombat&&!e.dead&&e.hp<=0)?'机制段':this.modeKind,name=this.qte?`${this.qte.command}破招`:this.modeName;this.battle.categories[kind]+=realDt;const last=this.battle.segments.at(-1);if(last?.name===name&&last.kind===kind)last.seconds+=realDt;else this.battle.segments.push({name,kind,seconds:realDt});}
  this.recoveryLeft=Math.max(0,this.recoveryLeft-realDt);
  this.summaryLeft=Math.max(0,this.summaryLeft-realDt);for(const b of this.blocked)b.left-=realDt;this.blocked=this.blocked.filter(b=>b.left>0);
  const q=this.qte;if(!q){this.present();return;}this.excluded+=realDt;
  q.age+=realDt;const inp=this.w.input,p=this.w.player;
  if(this.inputLocked)for(const a of ['bomb','companionQ','companionE','companionR','move'] as const)if(inp.pressed(a)){inp.consume(a);this.lockedFlash=a;this.w.ui.popup(p.x,p.y-70,'破招时暂不可用','chain');}
  if(q.state==='warning'&&q.age>=.6){q.state='entry';q.age=0;this.w.brush.cancel();}
  else if(q.state==='entry'&&q.age>=.4)this.open();
  else if(q.state==='window'){
   q.remaining=Math.max(0,q.duration-q.age);
   if(this.inputSerial!==inp.resetSerial){this.stroke=null;this.inputSerial=inp.resetSerial;this.brushArmed=this.shootArmed=this.rollArmed=false;}
   if(!inp.down('brush'))this.brushArmed=true;if(!inp.down('shoot'))this.shootArmed=true;if(!inp.down('roll'))this.rollArmed=true;
   if(q.command==='色击'&&this.shootArmed&&inp.pressed('shoot')&&inp.pointer.inside){this.shootArmed=false;if(p.weapon===q.color&&Math.hypot(inp.pointer.x-q.target.x,inp.pointer.y-q.target.y)<=q.target.radius)this.settle(true);else{q.wrong=p.weapon!==q.color?'先切到'+weaponNames[q.color!]:'点击发光的目标';this.wrongCount++;}}
   if(['封','竖','横'].includes(q.command)){
    if(this.brushArmed&&inp.pressed('brush')&&inp.pointer.inside){this.brushArmed=false;const ps=inp.pointerSamples;this.stroke=ps.length>=2?[ps[0],ps[1]]:[inp.pointer.x,inp.pointer.y];}
    if(this.stroke){this.stroke.push(...inp.pointerSamples.splice(0),inp.pointer.x,inp.pointer.y);if(this.stroke.length>2048)this.stroke.splice(2,2);if(!inp.down('brush')){const pts=this.stroke;this.stroke=null;if(this.judge(pts))this.settle(true);else{q.wrong=q.command==='封'?'圈要套住发光的目标':'要画'+q.command;this.wrongCount++;}}}else inp.pointerSamples.length=0;
   }
   if(q.command==='翻滚'&&this.rollArmed&&inp.pressed('roll')&&this.w.roll.charges>0){q.rollStarted=true;q.rollX=p.x;q.rollY=p.y;this.rollArmed=false;}
   if(q.remaining<=0&&q.state==='window')this.settle(false);
  }else if((q.state==='success'&&q.age>=.25)||(q.state==='failure'&&q.age>=.4)){q.state='exit';q.age=0;p.invuln=Math.max(p.invuln,1);this.recoveryLeft=1;}
  else if(q.state==='exit'&&q.age>=.3){this.qte=null;this.stroke=null;inp.pointerSamples.length=0;this.w.audio.sfx('seal');}
  this.present();
 }
 afterPlayer():void {const q=this.qte;if(q?.state!=='window'||q.command!=='翻滚'||!q.rollStarted)return;const p=this.w.player,b=q.band!;
  if(this.w.roll.frameActive&&Math.min(q.rollX,p.x)<=b.x+b.width/2&&Math.max(q.rollX,p.x)>=b.x-b.width/2)q.rollCrossed=true;
  if(!this.w.roll.active&&q.rollCrossed&&Math.abs(p.x-b.x)>b.width/2+p.hitR)this.settle(true);
 }
 draw():void {this.present();const q=this.qte,r=this.w.r;if(this.recoveryLeft>0){const p=this.w.player;for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;r.ribbonTop.line(p.x+Math.cos(a)*38,p.y+Math.sin(a)*38,p.x+Math.cos(b)*38,p.y+Math.sin(b)*38,3,RS.Glow,1.4,1.2,.6,.8);}}if(q&&this.freeze)for(const s of this.w.companions.team)for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;r.ribbonTop.line(s.x+Math.cos(a)*23,s.y-38+Math.sin(a)*9,s.x+Math.cos(b)*23,s.y-38+Math.sin(b)*9,2,RS.Glow,1,1,.8,.95);}
  if(this.stroke)r.ribbonTop.strip(this.stroke,4,RS.Calligraphy,.08,.07,.06,1);
  if(this.qte?.state==='success')for(let i=0;i<48;i++){const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2;r.ribbonTop.line(q!.target.x+Math.cos(a)*q!.target.radius*1.6,q!.target.y+Math.sin(a)*q!.target.radius*1.6,q!.target.x+Math.cos(b)*q!.target.radius*1.6,q!.target.y+Math.sin(b)*q!.target.radius*1.6,5,RS.Glow,2,1.5,.4,1);}
 }
 private present():void {
  const comm=document.querySelector<HTMLElement>('.communication');if(comm)comm.style.visibility=this.dialogueBlocked?'hidden':'';const q=this.qte;if(!this.overlay){this.overlay=document.createElement('div');this.overlay.id='boss-combat';document.body.append(this.overlay);}
  const r=this.w.r.playCss;Object.assign(this.overlay.style,{position:'fixed',left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px',pointerEvents:'none',zIndex:'22',fontFamily:'InkskyFangsong,serif',color:'#f5e8ca'});
  const paper=this.w.enemies.find(e=>!e.dead&&e.data.paperEffects)?.data.paperEffects;const program=paper?`<svg viewBox="0 0 900 1200" style="position:absolute;inset:0;width:100%;height:100%">${paper.svg()}</svg>`:'';
  const target=q?`<svg viewBox="0 0 900 1200" style="position:absolute;inset:0;width:100%;height:100%"><defs><marker id="boss-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="white"/></marker></defs><path d="M450 180 L${q.target.x} ${q.target.y-q.target.radius-15}" stroke="white" stroke-width="2" stroke-dasharray="10 8" marker-end="url(#boss-arrow)"/><circle cx="${q.target.x}" cy="${q.target.y}" r="${q.target.radius+8+Math.sin(q.age*3)*3}" stroke="${q.state==='success'?'#edc868':'white'}" stroke-width="4" fill="none"/>${q.band?`<rect x="${q.band.x-q.band.width/2}" y="210" width="${q.band.width}" height="980" stroke="white" stroke-width="3" fill="#d548413b"/>`:''}${q.command==='横'?`<path d="M${q.target.x-q.target.radius} ${q.target.y-12}v24 M${q.target.x+q.target.radius} ${q.target.y-12}v24" stroke="white" stroke-width="4"/>`:''}${(['封','竖'].includes(q.command)&&(q.duration===5||q.teach))?`<path d="${q.command==='封'?`M${q.target.x+q.target.radius*1.3} ${q.target.y}a${q.target.radius*1.3} ${q.target.radius*1.3} 0 1 1 0 -1`:`M${q.target.x} ${q.target.y+140}v-280`}" stroke="#ddd" stroke-width="5" fill="none" stroke-dasharray="25 12" opacity=".55"><animate attributeName="stroke-dashoffset" values="100;0" dur="1.5s" repeatCount="indefinite"/></path>`:''}</svg>`:'';
  const bar=q?`<div data-qte="${q.state}" style="position:absolute;top:9%;left:5%;right:5%;background:#202329ed;border:2px solid ${q.state==='success'?'#edc868':q.state==='failure'?'#888':'#d95a50'};padding:10px 12px;display:flex;gap:10px;align-items:center;font-size:${Math.max(16,r.w*.031)}px"><b>${q.state==='success'?'破':q.command==='翻滚'?'Shift':q.command==='色击'?'中键':q.command}</b><span style="flex:1">${q.state==='success'?'破招成功':q.wrong||q.hint}</span>${q.color?`<i style="width:18px;height:18px;background:${q.color==='red'?'#de5938':q.color==='blue'?'#6ecdae':'#ad79e8'}"></i>`:''}<svg viewBox="0 0 40 40" width="36" height="36"><circle cx="20" cy="20" r="16" stroke="#56595a" stroke-width="3" fill="none"/><circle cx="20" cy="20" r="16" stroke="${q.state==='failure'?'#888':'#edc868'}" stroke-width="3" fill="none" stroke-dasharray="${100*q.remaining/q.duration} 101" transform="rotate(-90 20 20)"/></svg></div>`:'';
  const boss=this.w.enemies.find(e=>!e.dead&&e.data.copperSimple);
  const rig=boss?.data.rig;
  const title=boss&&this.w.real<(boss.data.phaseTitleUntil??0)?`<div data-phase-title style="position:absolute;top:43%;left:10%;width:80%;padding:16px 0;background:url('/art/ui/ink-brush-v1.png') center/100% 100% no-repeat;text-align:center;font-size:42px;letter-spacing:.28em;color:#f3e7cd;text-shadow:0 3px 8px #191c20">${boss.data.phaseTitle}</div>`:'';
  const wings=rig&&boss?.data.phaseIndex===2?rig.wings.filter((v:any)=>!v.broken).map((v:any)=>{
   const p=v.lock,scale=boss.scaleX,ink=this.w.player.ink>=this.w.progression.brushMods.minInk;
   return `<rect x="${p.x-34*scale}" y="${p.y-56*scale}" width="${68*scale}" height="6" fill="#20232a"/><rect data-wing-hp x="${p.x-34*scale}" y="${p.y-56*scale}" width="${68*scale*p.hpFrac}" height="6" fill="#de6049"/>${ink?`<path data-vertical-guide d="M${p.x} ${p.y+145}v-290" stroke="#3a3530" stroke-width="8" stroke-dasharray="30 10" opacity=".45"/>`:''}`;
  }).join(''):'';
  const seal=boss?.data.sealWindow?`<circle data-seal-guide cx="${rig.controller.x}" cy="${rig.controller.y}" r="${72*boss!.scaleX}" fill="none" stroke="#39352f" stroke-width="8" stroke-dasharray="28 7" opacity=".5"/>`:'';
  const copper=rig?`<svg viewBox="0 0 900 1200" style="position:absolute;inset:0;width:100%;height:100%">${wings}${seal}</svg>`:'';
  const html=program+target+bar+copper+title;
  if(this.overlay.innerHTML!==html)this.overlay.innerHTML=html;
  const canvas=document.querySelector<HTMLCanvasElement>('#gl');if(canvas)canvas.style.filter=this.freeze?'saturate(.35)':'';
  this.overlay.style.boxShadow=q?.state==='warning'?'inset 0 0 0 5px #db554b':'';
 }
}
