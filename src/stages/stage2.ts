// P5-01：十二段手写空战剧情；检查点与段落计时共用同一顺序。
import type { Co,G } from '../game/api';
import type { World } from '../game/world';
import type { Enemy } from '../game/enemy';
import type { StageDef } from './types';
import { ChapterDialogue,director } from './dialogue1';
import { CH2_LINES } from './dialogue2_data';
import { Chapter2 } from './stage2_air';
import { chapterEnemy,GateTower,noSupplement } from './stage2_air_enemies';
import { STAGE2_ENEMIES } from './stage2_enemies';
import { Mirage } from './stage2_boss';
import { beaconWave } from './stage2_beacon';
const PI=Math.PI;
const names=['灯河夜航','护船下游','打灭假航灯','屿长说来历','闸楼炮大场面','镜鱼突袭','急行横扫','云闸前九灯','蜃','章末'];
export const C2_PARTS=names.map((label,i)=>({id:`C2.P${i+1}`,label}));
function clear(w:World){for(const e of [...w.enemies])w.remove(e);w.clearBullets(false);}
function* untilPart(c:Chapter2,start:number,seconds:number):Co{while(c.w.real-start<seconds)yield;}
function spawn(c:Chapter2,kind:keyof typeof STAGE2_ENEMIES,x:number,y:number,data:Record<string,unknown>={}):Enemy{return c.w.spawn(chapterEnemy(kind,c.part),x,y,e=>{noSupplement(e);e.data.entryX=x;Object.assign(e.data,data);});}
function* batch(c:Chapter2,kind:keyof typeof STAGE2_ENEMIES,n:number,positions:(i:number)=>[number,number],data:(i:number)=>Record<string,unknown>=()=>({})):Co{for(let i=0;i<Math.round(n*c.w.difficulty.quantity);i++){const [x,y]=positions(i);spawn(c,kind,x,y,data(i));yield* c.wait(.45);}}
function* part(c:Chapter2,n:number):Co{const w=c.w,start=w.real;c.part=n;
 switch(n){
 case 1:w.scrollSpeed(45,1);c.mission(1);yield* c.conversation('C2.P1.riverNight');w.scrollSpeed(80,2);yield* untilPart(c,start,15);yield* batch(c,'lantern',5,i=>[190+(i%2)*510,210+i*75]);yield* batch(c,'rotor',3,i=>[150+i*300,-60-i*40],i=>({flank:i%2?1:-1,amp:120}));yield* untilPart(c,start,30);yield* batch(c,'lantern',5,i=>[190+(i%2)*510,210+i*75]);yield* batch(c,'rotor',3,i=>[750-i*300,-60-i*40]);yield* untilPart(c,start,45);c.short(2);yield* batch(c,'lampboat',2,i=>[260+i*380,-70]);yield* untilPart(c,start,60);break;
 case 2:c.mission(2);w.scrollSpeed(80,1.5);c.fleet.visible=true;c.fleet.protected=false;c.fleet.scene.y=860;c.log('fleet.depart');
 yield* batch(c,'paperray',5,i=>[120+(i%2)*660,-60-i*45],i=>({flank:i%2?-1:1}));yield* batch(c,'junk',2,i=>[180+i*540,240]);yield* batch(c,'tideshuttle',4,i=>[150+i*190,-90]);yield* batch(c,'taxcrab',2,i=>[250+i*400,300]);yield* batch(c,'netspider',2,i=>[120+i*660,260]);c.short(5);yield* untilPart(c,start,28);c.fleet.scene.x=450;
 yield* batch(c,'paperray',5,i=>[780-(i%2)*660,-60-i*45],i=>({flank:i%2?1:-1}));yield* batch(c,'junk',2,i=>[720-i*540,260]);yield* batch(c,'tideshuttle',4,i=>[720-i*180,-60]);yield* untilPart(c,start,55);break;
 case 3:{w.scrollSpeed(110,1.5);yield* batch(c,'paperray',4,i=>[120+(i%2)*660,-60-i*45],i=>({flank:i%2?-1:1}));yield* batch(c,'taxcrab',2,i=>[300+i*300,300]);yield* untilPart(c,start,8);
 yield* beaconWave(w,[[90,330],[810,560]],true);yield* batch(c,'junk',2,i=>[180+i*540,240]);yield* batch(c,'tideshuttle',3,i=>[200+i*250,-90]);yield* untilPart(c,start,30);
 yield* beaconWave(w,[[90,330],[90,560],[810,450]],true);yield* batch(c,'netspider',2,i=>[120+i*660,270]);yield* batch(c,'lantern',3,i=>[200+i*220,-60]);yield* untilPart(c,start,52);break;}
 case 4:w.scrollSpeed(45,2);yield* batch(c,'lantern',2,i=>[250+i*400,-60]);yield* c.conversation('C2.P4.origin');yield* untilPart(c,start,15);break;
 case 5:{w.scrollSpeed(80,1.5);const towers=[w.spawn(GateTower,200,300,noSupplement),w.spawn(GateTower,700,300,noSupplement)];c.short(20);
 yield* batch(c,'umbrellaguest',3,i=>[180+i*270,-60]);yield* batch(c,'lampboat',2,i=>[250+i*400,-80]);yield* batch(c,'rotor',3,i=>[170+i*280,-60]);yield* untilPart(c,start,16);
 yield* batch(c,'umbrellaguest',3,i=>[720-i*270,-60]);yield* batch(c,'lampboat',2,i=>[650-i*400,-80]);yield* batch(c,'netspider',2,i=>[120+i*660,270]);yield* untilPart(c,start,34);
 yield* batch(c,'umbrellaguest',3,i=>[200+i*250,-60]);yield* batch(c,'lampboat',2,i=>[300+i*300,-80]);yield* batch(c,'rotor',3,i=>[750-i*280,-60]);
 while(towers.some(t=>!t.dead)&&w.real-start<60)yield;for(const tower of towers)if(!tower.dead){w.damage(tower,10000,tower.x,tower.y,true,'companion');c.log('gate.chiyanAssist');}
 yield* c.wait(1.5);for(const tower of towers)if(tower.data.wreck)tower.data.wreck.dead=true;yield* c.conversation('C2.P6.bellSilence');c.leave('chiyan');yield* c.wait(.8);break;}
 case 6:{w.scrollSpeed(150,1.5);const cave=w.scene('c2_cliff-cave',810,520);cave.layer='ground';c.short(17);yield* batch(c,'mirrorfish',7,i=>[120+i*100,-60-Math.abs(3-i)*60]);yield* batch(c,'tideshuttle',4,i=>[180+i*180,-70]);yield* untilPart(c,start,15);spawn(c,'mirrorfish',840,520,{flank:-1});c.join('moyuan',{x:900,y:520});yield* c.conversation('C2.moyuanJoin');for(let i=1;i<Math.round(7*w.difficulty.quantity);i++){spawn(c,'mirrorfish',750-i*100,-60-Math.abs(3-i)*60);yield* c.wait(.45);}while(w.real-start<45&&w.enemies.some(e=>!e.dead&&e.def.sprite==='e_mirrorfish'))yield;yield* c.conversation('C2.moyuanIntro');yield* untilPart(c,start,50);cave.dead=true;break;}
 case 7:{w.scrollSpeed(160,1.5);c.short(15);
 w.fork((function*():Co{for(let i=0;i<5;i++){yield* c.wait(6);const left=i%2===0;w.laser(left?40:860,60,left?PI/2-.7:PI/2+.7,{warn:1,duration:2.6,width:30,color:'amber',sweep:left?.55:-.55});}})());
 yield* batch(c,'umbrellaguest',4,i=>[180+i*160,180+i*150]);yield* batch(c,'mirrorfish',6,i=>[200+(i%3)*200,140+Math.floor(i/3)*300]);yield* batch(c,'moth',3,i=>[200+i*250,-80]);yield* batch(c,'netspider',2,i=>[700-i*500,330+i*250]);yield* untilPart(c,start,45);break;}
 case 8:w.scrollSpeed(45,1.5);c.changeBackground('cloud-town-real');yield* batch(c,'lantern',3,i=>[200+i*220,-60]);yield* untilPart(c,start,12);clear(w);yield* c.conversation('C2.P8.belowCloud');c.changeBackground('cloud-town-false');yield* w.milestone('云闸前补给');yield* c.conversation('C2.MR.arrival');yield* untilPart(c,start,36);break;
 case 9:clear(w);c.mission(3);w.scrollSpeed(25,2);c.fleet.visible=true;c.fleet.protected=false;c.fleet.scene.x=450;c.fleet.scene.y=900;yield* w.boss(Mirage,450,290,{startPhase:w.testBossPhase('MIRAGE'),warning:false,resumeMusic:'stage2'});w.clearBullets(false);break;
 case 10:clear(w);w.scrollSpeed(45,1.5);c.changeBackground('cloud-town-real');yield* c.conversation('C2.MR.reveal');w.unlockSkill('shenying');c.log('skill.shenying');yield* untilPart(c,start,20);
 for(const strength of [.6,.8,1]){w.bgFlash(strength);w.sfx('warning');c.log(`end.flash.${strength}`);yield* c.wait(2);}c.endScene=w.scene('c2_enforcement-ship',730,260);c.endScene.layer='air';c.lockedBird=w.scene('companion_chiyan',729.52,346.19);c.lockedBird.layer='air';c.lockedBird.sx=c.lockedBird.sy=.4;
 yield* c.wait(6);yield* c.conversation('C2.end.thunderCall');const end=w.real;while(w.real-end<8){const k=(w.real-end)/8;c.endScene.x=730+k*180;c.endScene.y=260-k*180;c.endScene.sx=c.endScene.sy=1-k*.6;c.endScene.alpha=1-k;c.lockedBird.x=c.endScene.x;c.lockedBird.y=c.endScene.y+86.19*(1-k*.6);c.lockedBird.alpha=1-k;yield;}c.endScene.dead=c.lockedBird.dead=true;const mo=w.companions.team.find(s=>s.kind==='moyuan'),flight=w.real,ox=w.player.x,oy=w.player.y;if(mo){mo.penFlight=true;mo.angle=0;}while(w.real-start<45){const k=Math.min(1,(w.real-flight)/Math.max(.1,45-(flight-start)));w.player.x=ox+(450-ox)*k;w.player.y=oy+(-90-oy)*k;if(mo){mo.x=w.player.x+82;mo.y=w.player.y-60;}yield;}break;
 }
}
export const STAGE2:StageDef={index:2,title:'第二章 · 蜃海',subtitle:'认清真灯，穿过云海',name:'蜃海',bg:'stage2',music:'stage2',
 content:{baselineBodies:0,normalBodies:135,baselineTypes:13,enemyTypes:[...Object.keys(STAGE2_ENEMIES),'gatetower'],encounters:10,chapters:names},
 *script(g:G):Co{const w=g as World;w.chapterDialogue=new ChapterDialogue(w,CH2_LINES);const c=w.chapter2=new Chapter2(w);w.sceneState=c;c.roster(['chiyan','laodun']);
 if(!g.seekingCheckpoint){g.card(this.title,this.subtitle);yield* c.wait(3);}if(w.checkpointTarget&&/^C2.P(?:[6-9]|10)$|MIRAGE/.test(w.checkpointTarget)){c.roster(['laodun','moyuan']);}if(w.checkpointTarget&&/^C2.P(?:[3-9]|10)$|MIRAGE/.test(w.checkpointTarget)){c.fleet.visible=true;c.fleet.protected=false;}
 for(let n=1;n<=10;n++){if(!(g.checkpoint(`C2.P${n}`)||(n===9&&g.checkpoint('MIRAGE'))))continue;clear(w);const at=w.real,paused=w.dialoguePauseSeconds;c.times[`P${n}.start`]=at;yield* part(c,n);c.times[`P${n}.end`]=w.real;c.segments.push({id:`C2.P${n}`,seconds:w.real-at,dialogueSeconds:w.dialoguePauseSeconds-paused});clear(w);
 if(n===3||n===5||n===8){yield* g.growthChoice(n===3?1:n===5?2:3);} }
 }};
