// 第二章友方与演出状态；船队、取景对象均为场景精灵。
import { EscortShip } from '../game/escort';
import type { World } from '../game/world';
import type { Enemy } from '../game/enemy';
import type { Scenery } from '../game/scenery';
import type { DamageSource } from '../types';
import type { CompanionKind } from '../game/companion';
import { RS } from '../gl/ribbons';
import { segDist2 } from '../core/math';
import { storyFrame } from '../art/ch2_story_assets';
import { CH2_BRIEFS,CH2_BUBBLES,CH2_NAME } from './dialogue2_data';
import { director } from './dialogue1';
import { drawCloudTown } from '../bg/stage2-scroll';

export class BatteryFleet extends EscortShip {
 visible=false;clamped=false;approach=0;laserHits=new Map<object,number>();
 constructor(w:World){super(w,false);this.scene.sprite='c2_battery-ship';this.vessels.push(this.scene);this.vessels.forEach(s=>{s.layer='ground';s.alpha=0;});}
 override get state(){return this.durability<30?'leak':this.durability<60?'smoke':'healthy';}
 override get bottom(){return this.scene.y+130;}
 get deckK(){return .5;}
 override update(dt:number){
  // 第 2 章船队同样跟在主角后面；停泊、潜入云下、Boss 靠拢和离场时由脚本定位。
  const part=this.w.chapter2?.part??0;this.follow=this.visible&&![0,9,10].includes(part);this.shipScale=.33;
  if(this.follow){this.followUpdate(dt);for(const s of this.vessels){s.alpha=1;s.frame=storyFrame('battery-ship',this.clamped?'clamped':this.state==='leak'?'leaking':this.state==='smoke'?'smoke':'intact',this.w.real);}
   if(!this.protected){this.absorbBullets(92*this.deckK,110*this.deckK,2,'c2ShipDamage');
    for(const e of this.w.enemies)if(!e.dead&&e.data.c2Charge&&!e.data.c2RamHit&&this.vessels.some(s=>Math.hypot(e.x-s.x,e.y-s.y)<95*this.deckK)){e.data.c2RamHit=true;this.hit(e.data.c2Charge);this.w.remove(e);}}
   return;}
  if(!this.visible)this.placed=false;
  for(const s of this.vessels){s.alpha=this.visible?1:0;s.sx=s.sy=(.8-.4*this.approach)*.41;s.frame=storyFrame('battery-ship',this.clamped?'clamped':this.state==='leak'?'leaking':this.state==='smoke'?'smoke':'intact',this.w.real);}
  if(this.visible&&!this.protected){this.absorbBullets(92*this.deckK,110*this.deckK,2,'c2ShipDamage');
   for(const e of this.w.enemies)if(!e.dead&&e.data.c2Charge&&!e.data.c2RamHit&&this.vessels.some(s=>Math.hypot(e.x-s.x,e.y-s.y)<95*this.deckK)){e.data.c2RamHit=true;this.hit(e.data.c2Charge);this.w.remove(e);}
  }
 }
 override updatePresentation(_dt:number){}
 override draw(){if(!this.visible)return;const r=this.w.r,x=this.scene.x,y=this.scene.y+(this.follow?60:160);r.ribbonTop.line(x-80,y,x+80,y,6,RS.Brush,.12,.1,.08,.9);r.ribbonTop.line(x-80,y,x-80+160*this.durability/100,y,6,RS.Brush,.8,.7,.35,1);}
}
type Bubble={owner:Enemy;text:string;at:number;until:number;voice:import('../types').DialogueVoiceState|null;pos?:{x:number;y:number}};
export class Chapter2 {
 readonly times:Record<string,number>={};events:string[]=[];segments:{id:string;seconds:number;dialogueSeconds:number}[]=[];
 readonly flights:{kind:CompanionKind;event:string;at:number;roster:string[]}[]=[];
 fleet:BatteryFleet;part=0;maxEnemies=0;maxBullets=0;beaconLabel=false;beaconActive=false;
 assisted=false;endScene:Scenery|null=null;lockedBird:Scenery|null=null;
 bossResults:Record<string,unknown>={};background='lantern-canyon';private oldBg='lantern-canyon';private bgAt=0;private bubbles:Bubble[]=[];private bubbleAt=new Map<string,number>();private overlay:HTMLDivElement;briefUntil=0;brief=0;
 constructor(readonly w:World){this.fleet=new BatteryFleet(w);w.escort=this.fleet;this.overlay=document.createElement('div');this.overlay.className='chapter2-scenes';Object.assign(this.overlay.style,{position:'fixed',pointerEvents:'none',zIndex:'13',fontFamily:'InkskyFangsong,serif',color:'#f2e6cb'});document.body.append(this.overlay);}
 dispose(){if(this.bubbles.some(b=>b.voice?.state==='playing'||b.voice?.state==='loading'))this.w.audio.stopDialogue();this.overlay.remove();}
 log(id:string){if(!this.events.includes(id))this.events.push(id);this.times[id]=this.w.real;}
 *wait(seconds:number){const at=this.w.real;while(this.w.real-at<seconds)yield;}
 *conversation(id:string){this.log(id);yield* director(this.w).conversation(id);}
 short(n:number){const id=`C2.s${String(n).padStart(2,'0')}`;if(!this.events.includes(id)){switch(n){case 2:this.w.caption('','先打灯船 · 周围小灯一起暗',5);break;case 3:this.w.caption('','中键换朱 · 打穿蟹壳',5);break;case 20:this.w.caption('','F 泼墨 · 一次清掉场上小敌，留给闸楼炮',6);break;case 6:this.w.caption('','守在船后 · 中键换青打镜鱼',5);break;case 7:this.w.caption('','炮口发亮时打断蓄力',5);break;case 19:this.w.caption('','执笔圈住闪紫的真影 · 钉住它才能打',6);break;case 11:this.w.caption('','E放探针 · 牵住敌机减速增伤',5);break;case 15:this.w.caption('','伞客收伞露弱点 · 中键换青打',5);break;}}this.log(id);director(this.w).event(id);}
 mission(id:number){this.brief=id;this.briefUntil=this.w.presentationTime+3.65;director(this.w).briefIds.push(id);director(this.w).briefRemaining=3.65;}
 changeBackground(key:string){if(key===this.background)return;this.oldBg=this.background;this.background=key;this.bgAt=this.w.t;}
 roster(ids:CompanionKind[]){this.w.companions.setRoster(ids);}
 join(kind:CompanionKind,from:{x:number;y:number}){this.w.companions.join(kind,from);this.flights.push({kind,event:'join',at:this.w.real,roster:this.w.companions.team.map(s=>s.kind)});}
 leave(kind:CompanionKind){this.w.companions.leave(kind);this.flights.push({kind,event:'leave',at:this.w.real,roster:this.w.companions.team.map(s=>s.kind)});}
 bubble(e:Enemy,name:keyof typeof CH2_BUBBLES,key:'01'|'02'='01'){const text=(CH2_BUBBLES[name] as Partial<Record<'01'|'02',string>>)[key],slot=name+key;if(!text||this.w.dialoguePaused||this.w.chapterDialogue?.current?.long||this.w.real-(this.bubbleAt.get(slot)??-10)<1.5||this.bubbles.length>=2)return;this.bubbleAt.set(slot,this.w.real);this.bubbles.push({owner:e,text:`${CH2_NAME[name]}：${text}`,at:this.w.real,until:this.w.real+1.8,voice:this.w.audio.playDialogue(`CH2.BUBBLE.${name}.${key}`,text),pos:key==='02'?{x:e.x,y:e.y}:undefined});}
 private retainBubble(b:Bubble){
  if(this.w.chapterDialogue?.current?.long||!b.pos&&b.owner.dead){if(b.voice?.state==='playing'||b.voice?.state==='loading')this.w.audio.stopDialogue();return false;}
  if(b.voice?.state==='playing'||b.voice?.state==='loading')return true;
  if(b.voice?.state==='ended'){b.until=this.w.real+.3;b.voice=null;}
  return this.w.real<b.until;
 }
 damageAllowed(e:Enemy,source:DamageSource){if(e.data.c2Fake){e.data.fakeHit=true;return false;}if(e.data.c2True&&!e.data.pinned)return false;return !(e.def.boss&&e.data.phaseIndex===2&&source!=='qte');}
 damageScale(e:Enemy,source:DamageSource,amount:number){if(e.data.c2Beacon&&['red','blue','purple'].includes(source))return (source==='red'?6:3)/amount;if(e.data.c2Master&&source==='blue')return 2/1.35;return (e.data.c2True&&source==='purple'?1.5/1.35:1)*(e.data.bossOwner?.data.damageBonus??1);}
 laserHit(l:{x:number;y:number;angle:number;t:number;dead:boolean;o:{length:number;width:number;warn:number;duration:number;follow?:Enemy}}){if(!this.fleet.visible||this.fleet.protected||l.dead||l.t<l.o.warn||l.t>l.o.warn+l.o.duration||this.fleet.laserHits.has(l))return;const x=l.x+Math.cos(l.angle)*l.o.length,y=l.y+Math.sin(l.angle)*l.o.length;if(this.fleet.vessels.some(s=>segDist2(s.x,s.y,l.x,l.y,x,y)<(80+l.o.width)**2)){this.fleet.hit(l.o.follow?.def.sprite==='e_junk'?3:2);this.fleet.laserHits.set(l,this.w.real);}}
 results(){const total=document.querySelector('.res .tot');if(!total)return;const row=document.createElement('div');row.className='rr on';row.dataset.c2FleetReward='';row.innerHTML=`<span class="rl">云梭耐久</span><span class="rv">${Math.round(this.fleet.durability)} · +${Math.round(this.fleet.durability)*100}（已计入结算）</span>`;total.before(row);}
 update(){const w=this.w;if(this.part===10)this.fleet.scene.y+=15*w.dt;if(!this.beaconActive&&this.fleet.follow)for(const p of this.fleet.pull){const k=Math.max(0,1-3*w.dt);p.x*=k;p.y*=k;}this.maxEnemies=Math.max(this.maxEnemies,w.density.count(w.enemies));this.maxBullets=Math.max(this.maxBullets,w.bulletCount());this.bubbles=this.bubbles.filter(b=>this.retainBubble(b));
  const mo=w.companions.team.find(s=>s.kind==='moyuan');if(mo&&w.companions.stats.casts.moyuan>0&&!this.events.includes('C2.s11'))this.short(11);
 }
 drawBackground(){
  const k=Math.min(1,Math.max(0,(this.w.t-this.bgAt)/2));
  const reveal=(this.oldBg==='cloud-town-real'?1-k:0)+(this.background==='cloud-town-real'?k:0);
  this.w.r.bgParams[0][0]=reveal;
  const mirage=(this.oldBg==='cloud-town-false'?1-k:0)+(this.background==='cloud-town-false'?k:0);
  drawCloudTown(this.w.r,this.w.scroll,this.w.real,reveal,Math.max(mirage,this.part===3||this.part===7?1:0)*(1-reveal));
 }
 draw(){const w=this.w,r=w.r,rect=r.playCss;Object.assign(this.overlay.style,{left:`${rect.x}px`,top:`${rect.y}px`,width:`${rect.w}px`,height:`${rect.h}px`});let html='';
  if(this.briefUntil>w.presentationTime){const [title,target,purpose]=CH2_BRIEFS[this.brief-1],age=3.65-(this.briefUntil-w.presentationTime);html+=`<div data-c2-brief="${this.brief}" style="position:absolute;top:8%;left:8%;right:8%;padding:18px;background:#151e27e8;border:1px solid #b7c9cb;opacity:${Math.min(1,age/.15,(3.65-age)/.3)};transform:translateY(${12*(1-Math.min(1,age/.3))}px);font-size:22px"><b>${title}</b><div>目标：${target}</div><p>${purpose}</p></div>`;}
  if(this.beaconLabel)html+=`<div data-c2-beacon style="position:absolute;top:22%;left:0;right:0;text-align:center;font-size:44px;letter-spacing:.2em;color:#ffd98a;text-shadow:0 0 12px #c0392b,0 2px 0 #000;opacity:${.75+.25*Math.sin(w.real*8)}">打灭假航灯</div>`;
  if(this.fleet.visible&&w.real-(this.times['fleet.depart']??w.real)<5)html+=`<div style="position:absolute;left:${this.fleet.scene.x/9-7}%;top:${(this.fleet.scene.y+180)/12}%;font-size:16px">云梭</div>`;
  if(this.part===9&&!this.times['MR.passed'])for(let x=30;x<870;x+=30)r.ribbonTop.line(x,540,x+20,540,5,RS.Glow,.5,1.1,1.5,.7);
  for(const e of w.enemies){if(e.dead)continue;if(e.data.beaconTether&&this.beaconActive){const p=this.fleet.scene;r.ribbonMid.line(e.x,e.y,p.x,p.y,2,RS.Brush,1.3,.85,.25,.75);}if(e.def.sprite==='c2_gate-tower'&&e.charging){for(const dx of [-1,1])r.ribbonTop.line(e.x+dx*140,e.y-190,e.x+dx*140,e.y+190,5,RS.Warn,1.6,.25,.15,.8);for(const dy of [-1,1])r.ribbonTop.line(e.x-140,e.y+dy*190,e.x+140,e.y+dy*190,5,RS.Warn,1.6,.25,.15,.8);}if(e.data.c2True&&e.frame===2)for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;r.ribbonTop.line(e.x+Math.cos(a)*85,e.y+Math.sin(a)*85,e.x+Math.cos(b)*85,e.y+Math.sin(b)*85,3,RS.Glow,1.2,.4,2,1);}}
  for(const b of this.bubbles){const o=b.pos??b.owner,x=o.x,y=o.y-65;if(Math.hypot(w.player.x-x,w.player.y-y)<100||w.bullets.list.some(v=>!v.dead&&Math.abs(v.x-x)<130&&Math.abs(v.y-y)<30))continue;html+=`<div style="position:absolute;left:${Math.max(2,Math.min(60,x/9-10))}%;top:${y/12}%;background:#191d26ce;border:1px solid #b56f67;padding:5px;font-size:16px">${b.text}</div>`;}
  if(this.lockedBird&&!this.lockedBird.dead){const b=this.lockedBird;r.ribbonTop.line(b.x-15,b.y,b.x+15,b.y,4,RS.Brush,.6,.5,.4,1);r.ribbonTop.line(b.x,b.y-15,b.x,b.y+15,3,RS.Brush,.6,.5,.4,1);}
  this.overlay.innerHTML=w.ui.dialogueState().active?"":html;
 }
}
