// 蜃：四阶段，壳、真影、假航灯、合壳；破招复用 BossCombat。
import type { Co,G } from '../game/api';
import type { Enemy,EnemyDef } from '../game/enemy';
import type { World } from '../game/world';
import { director } from './dialogue1';
import { storyFrame } from '../art/ch2_story_assets';
import { beaconWave,spawnBeacon } from './stage2_beacon';
const PI=Math.PI;
// P6-14 暂定值：flow power=4。壳/真身延长打血，壳铰保持原流程；只调血量。
export const MIRAGE_HP={shell:1890,trueBody:3360,lamp:2835,hinges:378,body:2100};
const VALVE_HP=231;
export class ClosureModel {
 closure=0;elapsed=0;pause=0;bow=859;passed=false;failed=false;
 step(dt:number,broken:number){this.elapsed+=dt;if(this.pause>0)this.pause=Math.max(0,this.pause-dt);else this.closure=Math.min(1,this.closure+dt*.05*Math.pow(.5,broken));this.bow-=22*dt;if(this.bow<=540&&!this.passed&&!this.failed){this.passed=420*(1-this.closure)>=240;this.failed=!this.passed;}}
 reset(){this.closure=.2;this.elapsed=0;this.pause=0;this.bow=859;this.passed=this.failed=false;}
}
const decor=(sprite:string):EnemyDef=>({sprite,hp:1,decorative:true,noCollide:true,score:0});
const say=(g:G,id:number)=>director(g).event(`B-MR-${String(id).padStart(2,'0')}`);
const clock=(g:G)=>(g as World).bossCombat.clock;
function* waitClock(g:G,sec:number):Co{const at=clock(g);while(clock(g)-at<sec)yield;}
function mode(g:G,name:string,kind:'对白演出'|'机制段'|'打血时间'){(g as World).bossCombat.mode(name,kind);}
interface Rig {shells:Enemy[];bay:Enemy;hinges:Enemy[];shadows:Enemy[];lights:Enemy[];open:number;closure?:ClosureModel}
function frame(e:Enemy,key:string,state:string,g:G){e.data.manualFrame=true;e.frame=storyFrame(key,state,g.presentationTime);}
function valve(e:Enemy,g:G,x:number,mirror:boolean):Enemy{const n=g.attach(e,{sprite:'c2_mirage-valve',hp:VALVE_HP/g.difficulty.hp,radius:60,noCollide:true,score:0},[x,0],mirror?{mirror:true}:undefined);n.phaseLock=true;n.data.bossOwner=e;n.data.contentRole='part';n.data.manualFrame=true;n.data.weakWeapon='red';n.data.weakLabel='壳阀';return n;}
function rig(e:Enemy,g:G):Rig {const shells=[valve(e,g,-180,false),valve(e,g,180,true)];const bay=g.attach(e,decor('c2_battery-bay'),[0,70]);bay.alpha=0;return {shells,bay,hinges:[],shadows:[],lights:[],open:0};}
function remove(g:G,es:Enemy[]){for(const e of es)if(!e.dead)g.remove(e);}
function* phase(e:Enemy,g:G,index:number,hp:number,limit:number,min:number,name:string,body:()=>Co,complete:()=>boolean=()=>e.hp<=0):Co{
 e.data.phaseIndex=index;e.data.phaseStartedClock=clock(g);e.data.attackRounds=0;e.data.qteCount=0;e.data.c2PhaseMin=min;
 yield* g.phase(e,{hp:hp/g.difficulty.hp,time:limit,clock:'boss',name,transitionTime:0,complete:()=>clock(g)-e.data.phaseStartedClock>=min&&complete()},body);
 (e.data.phaseResults??=[]).push({phase:index,seconds:clock(g)-e.data.phaseStartedClock,attackRounds:e.data.attackRounds,qteCount:e.data.qteCount,last:(g as World).bossCombat.recent.at(-1)?.last});
}
function* scene(e:Enemy,g:G,seconds:number,name:string,ids:number[],animate?:(t:number)=>void):Co{mode(g,name,'对白演出');g.clearBullets(false);ids.forEach(id=>say(g,id));const at=clock(g);while(clock(g)-at<seconds){animate?.(Math.min(1,(clock(g)-at)/seconds));yield;}}
function shadow(e:Enemy,g:G,r:Rig,i:number,trueOne:boolean):Enemy{
 const n=g.spawn({sprite:'c2_mirage-shadow',hp:100000,score:0,noCollide:true,radius:62,onHit(v){if(!trueOne)v.data.fakeHit=true;}},250+(i%3)*200,350+Math.floor(i/3)*170,v=>{v.data.contentRole='part';v.data.noSupplementFire=true;v.data.c2Fake=!trueOne;v.data.c2True=trueOne;v.data.bossOwner=trueOne?e:undefined;v.data.weakWeapon=trueOne?'purple':undefined;v.data.targetDisabled=false;v.data.manualFrame=true;});n.phaseLock=true;n.alpha=.65;r.shadows.push(n);return n;
}
export const Mirage:EnemyDef={name:'蜃',sprite:'c2_mirage-body',hp:1,score:80000,noCollide:true,radius:100,boss:{name:'蜃 · 吐影蚌龙',music:'boss-shen',phases:4,defeat:'disable'},
 *ai(e,g):Co{
 const w=g as World,c=w.chapter2!,start=e.data.startPhase??1,r=rig(e,g);e.stop();let hitPhase=0;e.data.bossCombat=true;e.data.c2Mirage=true;e.data.weakCustom=true;e.data.manualFrame=true;e.data.guides=[{x:450,y:540}];w.bossCombat.beginBattle(e);e.data.battleHardDeadline=Infinity;
 const render=g.fork((function*():Co{for(;;){if(e.data.playerHits&&hitPhase!==e.data.phaseIndex&&e.data.phaseIndex<=2){hitPhase=e.data.phaseIndex;e.data.playerHits=0;say(g,e.data.phaseIndex===2?12:4);}const open=r.closure?1-r.closure.closure:r.open;r.shells.forEach((s,i)=>{s.offX=(i?1:-1)*(open*210+34);frame(s,'mirage-valve',open>.75?'open':open>.2?'half-open':'closed',g);});r.bay.alpha=Math.min(1,r.open*1.5);frame(r.bay,'battery-bay',e.data.phaseIndex===4?'empty':r.open>.8?'full':'pried',g);frame(e,'mirage-body',e.data.truth?'truth':e.data.phaseIndex===4?'uneasy':'polite',g);yield;}})());
 try {
  e.invulnerable=true;r.open=0;mode(g,'蜃浮出云面','对白演出');yield* scene(e,g,start===1?16:1,'蜃登场',[1,2,3],t=>{e.alpha=t;for(const s of r.shells)s.alpha=t;});e.alpha=1;
  // 部件没打掉前锁住本体血量；部件伤害会同步扣本体，这里每帧还原。
  const gate=(lock:number,open:boolean)=>{if(!open){e.invulnerable=true;e.hp=lock;}else e.invulnerable=false;};
  if(start<=1){e.data.weakWeapon='red';let lock=0,opened=false,nextWeak=0;
   yield* phase(e,g,1,MIRAGE_HP.shell,Infinity,0,'拆开壳甲',function*():Co{let fire=0,beam=0,ring=0;lock=e.hp;for(;;){const t=clock(g)-e.data.phaseStartedClock,k=t%21;mode(g,'M1 壳甲','打血时间');e.data.attackRounds=t>=21?2:1;
    const broken=r.shells.filter(n=>n.hp<=0).length;r.open=opened?1:broken*.3;
    for(const n of r.shells)if(n.hp<=0&&!n.data.targetDisabled){n.data.targetDisabled=true;n.data.weakLabel=undefined;n.alpha=.35;w.fx.explosion(n.x,n.y,'m');}
    if(broken===2&&!opened){opened=true;nextWeak=clock(g)+10;w.bossCaps.openWeak(e,'壳阀已破');e.data.weakLabel='蜃身';}
    if(opened&&clock(g)>=nextWeak){nextWeak=clock(g)+10;w.bossCaps.openWeak(e,'壳阀已破');}
    gate(lock,opened);
    if(k<7&&clock(g)>=fire){g.fan(450,410,PI/2,3,.8,150,{shape:'orb',color:'amber'});fire=clock(g)+2.4;}
    if(k>=7&&k<13&&clock(g)>=beam){const x=beam%2?220:680;g.laser(x,330,PI/2,{warn:.8,duration:.6,width:40,color:'amber'});beam=clock(g)+2.4;}
    if(k>=13&&clock(g)>=ring){g.ring(450,350,24,100,{shape:'orb',color:'amber'});ring=clock(g)+2.6;}
    if(e.hpFrac<=.2)say(g,7);yield;
   }});
   e.invulnerable=true;remove(g,r.shells);r.open=1;yield* scene(e,g,3,'壳甲张开',[8]);c.short(16);
  }else{r.open=1;remove(g,r.shells);}
  if(start<=2){e.data.targetDisabled=true;e.data.weakWeapon=undefined;e.data.weakLabel=undefined;const trueOne=shadow(e,g,r,0,true);for(let i=1;i<4;i++)shadow(e,g,r,i,false);say(g,9);c.short(19);
   yield* phase(e,g,2,MIRAGE_HP.trueBody,Infinity,0,'识别真身',function*():Co{let shots=0,shuffle=0,second=false,pinUntil=0,sealed=trueOne.data.lastSealedAt??0,weakAt=0;for(;;){const t=clock(g)-e.data.phaseStartedClock;mode(g,'M2 真假影','打血时间');e.data.attackRounds=t>=15?2:1;
    const pinned=clock(g)<pinUntil;trueOne.data.pinned=pinned;
    if((trueOne.data.lastSealedAt??0)!==sealed){sealed=trueOne.data.lastSealedAt;pinUntil=clock(g)+9;trueOne.frame=2;trueOne.data.weakLabel='真影被钉住';w.bossCaps.openWeak(e,'真影被钉住');weakAt=pinUntil;for(const n of r.shadows.filter(n=>n.data.c2Fake&&!n.dead))n.data.c2FrozenUntil=pinUntil;}
    const period=second?5:4,lit=(t%period)<(second?.6:.8);if(!pinned){trueOne.frame=lit?2:1;trueOne.data.weakLabel=lit?'闪紫的真影 · 执笔圈住':undefined;}
    for(const n of [...r.shadows]){if(n.dead)continue;if(n.data.c2Fake&&n.data.fakeHit&&!n.data.respawnAt){n.alpha=0;n.data.targetDisabled=true;n.frame=3;n.data.respawnAt=clock(g)+3;}if(n.data.respawnAt&&clock(g)>=n.data.respawnAt){n.data.fakeHit=false;n.data.respawnAt=0;n.data.targetDisabled=false;n.alpha=.65;n.x=180+w.rng.next()*540;n.y=300+w.rng.next()*220;}}
    if(t>=15&&!second){second=true;for(let i=4;i<6;i++)shadow(e,g,r,i,false);}
    if(!pinned&&clock(g)>=shots){for(const n of r.shadows.filter(n=>!n.dead&&n.alpha>0&&clock(g)>=(n.data.c2FrozenUntil??0))){if(n.data.c2Fake&&w.bullets.list.filter(b=>!b.dead&&b.data.c2FakeShot).length<20){const b=g.shoot(n.x,n.y,PI/2,90,{shape:'orb',color:'violet'});b.data.c2FakeShot=1;}else if(n===trueOne)g.fan(n.x,n.y,PI/2,3,.7,150,{shape:'rice',color:'violet'});}shots=clock(g)+3;}
    if(!pinned&&t>6&&clock(g)>=shuffle){const alive=r.shadows.filter(n=>!n.dead&&clock(g)>=(n.data.c2FrozenUntil??0)),positions=alive.map(n=>({x:n.x,y:n.y}));const at=clock(g);while(clock(g)-at<1&&clock(g)>=pinUntil){const k=clock(g)-at;alive.forEach((n,i)=>{const to=positions[(i+1)%positions.length];n.x=positions[i].x+(to.x-positions[i].x)*k;n.y=positions[i].y+(to.y-positions[i].y)*k;});yield;}g.fan(450,340,PI/2,3,.8,160,{shape:'rice',color:'violet'});if(second)g.laser(trueOne.x,trueOne.y,PI/2,{warn:1,duration:.4,width:12,color:'violet'});shuffle=clock(g)+6;}
    if(e.hpFrac<=.2)say(g,13);yield;
   }});
   remove(g,r.shadows);e.data.targetDisabled=false;e.invulnerable=true;yield* scene(e,g,3,'假景收拢',[14]);
  }
  if(start<=3){e.invulnerable=true;c.fleet.scene.x=450;c.fleet.scene.y=900;
   yield* phase(e,g,3,MIRAGE_HP.lamp,Infinity,0,'打灭假航灯',function*():Co{let lock=e.hp,master:Enemy|null=null,ring=0,rain=0,stage=0,nextWeak=0;e.data.weakLabel=undefined;
    for(;;){const t=clock(g)-e.data.phaseStartedClock;mode(g,'M3 航灯引船',master?'打血时间':'机制段');
     if(stage<2){say(g,15);const pts:[number,number][]=stage===0?[[70,380],[830,600]]:[[70,380],[70,600]];const ok=yield* beaconWave(w,pts,true);c.fleet.scene.x=450;stage++;if(!ok)stage--;if(stage===2||t>26)stage=2;yield* waitClock(g,.8);continue;}
     if(!master){master=spawnBeacon(w,450,250,true);master.hp=master.maxHp=100000;master.data.bossOwner=e;master.data.weakLabel='总航灯';master.phaseLock=true;e.invulnerable=true;w.bossCaps.openWeak(e,'总航灯露出');nextWeak=clock(g)+10;}
     if(clock(g)>=nextWeak){nextWeak=clock(g)+10;w.bossCaps.openWeak(e,'总航灯露出');}
     e.invulnerable=false;
     if(clock(g)>=ring){g.ring(master.x,master.y,8,70,{shape:'orb',color:'amber'});ring=clock(g)+2.6;}
     if(clock(g)>=rain){g.fan(450,370,PI/2,3,1.4,100,{shape:'rice',color:'amber'});rain=clock(g)+3;}
     yield;
    }},()=>e.hp<=0);
   remove(g,r.lights);for(const n of w.enemies.filter(n=>n.data.c2Master))w.remove(n);yield* scene(e,g,10,'向雷公报信',[18,19,20],t=>{const x=450+t*500,y=300-t*350;w.r.ribbonTop.line(x-40,y+28,x,y,5,1,1.2,.3,2,.9);if(t>.65&&!e.data.signalled){e.data.signalled=true;w.bgFlash(.8);}});
  }
  e.data.targetDisabled=true;e.invulnerable=true;r.closure=new ClosureModel();e.data.closure=r.closure;c.fleet.scene.x=450;c.fleet.scene.y=963; // 船首(.8×130)距闸线319，约14.5秒。
  say(g,21);g.caption('','打坏两只壳铰 · 壳缝才不会合拢',5);for(const x of [-290,290]){const n=g.attach(e,{sprite:'c2_mirage-hinge',hp:MIRAGE_HP.hinges/2/g.difficulty.hp,radius:45,noCollide:true,score:0},[x,210]);n.phaseLock=true;n.data.bossOwner=e;n.data.contentRole='part';n.data.manualFrame=true;n.data.weakWeapon='red';n.data.weakLabel='壳铰';r.hinges.push(n);}
  let finished=false;yield* phase(e,g,4,MIRAGE_HP.body,Infinity,0,'撑开壳缝',function*():Co{let attempts=0,last=clock(g),shot=clock(g),lock=e.hp,opened=false,nextWeak=0,passedAt=0;const model=r.closure!;for(;;){const now=clock(g),dt=now-last;last=now;mode(g,'M4 合拢与壳铰',opened?'打血时间':'机制段');const broken=r.hinges.filter(n=>n.hp<=0).length;
    r.hinges.forEach(n=>{frame(n,'mirage-hinge',n.hp<=0?'broken':n.hp<n.maxHp*.5?'smoke':'intact',g);if(n.hp<=0)n.data.targetDisabled=true;});if(broken)say(g,22);
    if(broken===2&&!opened){opened=true;nextWeak=now+10;e.data.targetDisabled=false;e.data.weakLabel='蜃身';w.bossCaps.openWeak(e,'壳铰已断');}
    if(opened&&now>=nextWeak){nextWeak=now+10;w.bossCaps.openWeak(e,'壳铰已断');}
    gate(lock,opened);
    if(!model.passed&&!passedAt)model.step(dt,broken);c.fleet.approach=Math.min(1,model.elapsed/14.5);if(!passedAt)c.fleet.scene.y=model.bow+130*(.8-.4*c.fleet.approach);
    if(now>=shot&&!model.passed){g.fan(450,390,PI/2,3,1.4,95,{shape:'orb',color:'amber'});if(model.elapsed>=7)g.laser(model.elapsed%4<2?210:690,400,PI/2,{warn:.8,duration:.4,width:24,color:'amber'});shot=now+3;}
    if(opened&&now>=shot&&model.passed){g.fan(e.x,e.y+60,PI/2,5,1.2,110,{shape:'orb',color:'amber'});shot=now+2.6;}
    if(model.failed){attempts++;say(g,26);c.fleet.clamped=true;c.fleet.hit(30);(e.data.closureAttempts??=[]).push({attempt:attempts,closure:model.closure,broken,passed:false});g.clearBullets(false);mode(g,'夹船后重新张壳','机制段');yield* waitClock(g,.4);c.fleet.clamped=false;
     if(attempts>=2){c.assisted=e.data.assisted=true;c.log('MR.assisted');say(g,37);mode(g,'墨鸢投假光','机制段');g.fx.charge(740,180,80,5,[.5,1,2]);yield* waitClock(g,5);model.passed=true;model.failed=false;model.closure=.2;}
     else {model.reset();for(const n of r.hinges){n.hp=n.maxHp*.5;n.data.targetDisabled=false;}opened=false;e.data.weakLabel=undefined;last=clock(g);continue;}}
    if(model.passed&&!passedAt){c.log('MR.passed');say(g,25);(e.data.closureAttempts??=[]).push({attempt:attempts+1,closure:model.closure,broken,passed:true});passedAt=now;}
    if(passedAt&&now-passedAt<3)c.fleet.scene.y-=60*w.dt;
    if(passedAt&&opened&&now-passedAt>=3)finished=true;yield;
  }},()=>finished&&e.hp<=0);
  remove(g,r.hinges);e.data.targetDisabled=false;e.invulnerable=true;r.closure=undefined;r.open=1;mode(g,'蜃说出实情','对白演出');yield* scene(e,g,12,'壳摊平，投影熄灭',[27,28,29],()=>{c.changeBackground('cloud-town-real');e.data.truth=true;frame(e,'mirage-body','truth',g);});
  e.data.finalSource=w.bossCombat.recent.at(-1)?.last??'';c.bossResults.mirage={assisted:c.assisted,finalSource:e.data.finalSource,breakResults:e.data.breakResults,phaseResults:e.data.phaseResults,closureAttempts:e.data.closureAttempts};
 }finally{remove(g,[...r.shells,r.bay,...r.hinges,...r.shadows,...r.lights]);w.bossCombat.endBattle(e);g.clearBullets(false);}
 }};
