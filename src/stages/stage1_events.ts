// 第一章分段：出港、第一波、屏障、劫机、喘息、大场面、急行、关前；中间接纸龙，末尾接铜雀。
import type { Co,G } from '../game/api';
import type { Enemy,EnemyDef } from '../game/enemy';
import type { Scenery } from '../game/scenery';
import { startFortress,type Fortress } from './stage1_fortress';
import type { World } from '../game/world';
import type { EscortShip } from '../game/escort';
import { CH1_AIR_ART } from '../game/escort';
import { NetPost,BridgeTurret,ShoreCannon,Bomber } from './stage1_air_enemies';
import { beeSwarm,beeShot,craneRow,kiteGlide,kitePair,scout,shieldSquad,inspector,stopGo,turtle,arm,sweepTop,sweepSide,sweepWave,chaseBehind,sweepLaser,seq } from './stage1_patrol';
import { director,sayEvent } from './dialogue1';
import { enterLowPass,LowCannon,LowBallista,LowEaveGunner,lowTarget,type LowPass } from './stage1_low';
export interface RouteState {low?:LowPass;ship:EscortShip;cart:Scenery;gatePosts?:Enemy[]; gate?:Scenery; bridge:Scenery[]; tools:Scenery[]; events:string[];times:Record<string,number>;lastStrikeBlocked?:boolean;bossResults?:Record<string,{result:string;events:unknown;phases:unknown;timing?:unknown;assisted?:boolean;paperStats?:unknown}>}
export function routeState(g:G):RouteState{const ship=(g as World).createEscort();const s:RouteState={ship,cart:ship.scene,bridge:[],tools:[],events:[],times:{}};(g as World).sceneState=s;return s;}
function emit(g:G,s:RouteState,id:string,_replace=false):boolean {if(s.events.includes(id))return true;s.events.push(id);sayEvent(g,id);return true;}
export function* conversation(g:G,s:RouteState,...ids:string[]):Co{for(const id of ids)if(!s.events.includes(id))s.events.push(id);yield* director(g).conversation(...ids);}
function join(g:G,id:'chiyan'|'laodun'):boolean{const c=(g as G & {companions:{onChange:(id:string,joined:boolean)=>void}}).companions;const hook=c.onChange;c.onChange=()=>{};try{return g.joinCompanion(id);}finally{c.onChange=hook;}}
function spawn(g:G,def:EnemyDef,x:number,y:number,data:Record<string,unknown>={}):Enemy{return g.spawn(def,x,y,e=>{e.data.contentRole='normal';if(def===NetPost||def===Bomber)e.hp=e.maxHp=def.hp/g.difficulty.hp;Object.assign(e.data,data);});}
function defeated(e:Enemy|undefined):boolean{return !!e?.dead&&e.hp<=0;}
function clear(g:G,preserveFodder=false):void{for(const e of g.liveEnemies())if(!e.def.boss&&(!preserveFodder||!e.data.fodder))g.remove(e);g.clearBullets();}
function* run(g:G,seconds:number,update:(elapsed:number)=>void):Co{const start=g.t;while(g.t-start<seconds){update(g.t-start);yield;}}
function* travel(g:G,s:Scenery,x:number,y:number,seconds:number):Co{const sx=s.x,sy=s.y;yield* run(g,seconds,t=>{const k=t/seconds;s.x=sx+(x-sx)*k;s.y=sy+(y-sy)*k;});s.x=x;s.y=y;}
export function copperGate(g:G,s:RouteState):void{
 enterLowPass(g,s);
 if(s.bridge.some(p=>p.sprite==='sky_low-bridge'))return;
 s.bridge.push(g.scene('sky_low-bridge',450,300));s.low!.stop=(g as World).scroll;
}
export function* barrier(g:G,s:RouteState):Co{
 const d=director(g),w=g as World;s.ship.protected=false;
 // 根部在370，挂网点相对根部-70，网线保持y=300；两桩均不镜像。
 const posts=[spawn(g,NetPost,110,370,{noSupplementFire:true,weakLabel:'阵眼',weakWeapon:'red'}),spawn(g,NetPost,790,370,{noSupplementFire:true,weakLabel:'阵眼',weakWeapon:'red'})];s.gatePosts=posts;
 const left=posts[0].x+CH1_AIR_ART.post.anchors.netR[0],right=posts[1].x+CH1_AIR_ART.post.anchors.netL[0],y=posts[0].y+CH1_AIR_ART.post.anchors.netR[1];
 const n=Math.ceil((right-left)/CH1_AIR_ART.net.tileStep),scale=(right-left)/(n*CH1_AIR_ART.net.tileStep+1),tiles:Scenery[]=[];
 for(let i=0;i<n;i++){const tile=g.scene(CH1_AIR_ART.net.atlas,left+(i*CH1_AIR_ART.net.tileStep+36)*scale,y);tile.sx=tile.sy=scale;tiles.push(tile);}
 s.gate=g.scene(CH1_AIR_ART.brokenNet.atlas,(left+right)/2,y);s.gate.sx=(right-left)/640;s.gate!.alpha=0;
 // 完整开场的拦网从右侧滑入；检查点入口沿用原来的静态位置。
 if(s.times['air.start']!==undefined){
  const pieces=[...posts,...tiles,s.gate],xs=pieces.map(p=>p.x),start=w.presentationTime;
  pieces.forEach(p=>p.x+=900);
  w.presentation.run((function*():Co{while(w.presentationTime-start<3){const k=Math.min(1,(w.presentationTime-start)/3),offset=900*(1-k)*(1-k);pieces.forEach((p,i)=>p.x=xs[i]+offset);yield;}pieces.forEach((p,i)=>p.x=xs[i]);})());
 }
 const dock=g.scene('sky_rock',75,690);dock.sx=dock.sy=.5;const pad=g.scene('companion_chiyan',75,640);s.ship.chiyanPad=pad;let takeoff:number|null=null,opened=false,fallback=false,rightDone=false;
 const event=(id:string)=>{if(!s.events.includes(id))s.events.push(id);return d.event(id,id==='E01.gateVisible');};
 d.event('CH1.air.net');for(const p of posts)w.fodder?.mark('击破阵眼',p,40);event('E01.gateVisible');
 let finished=false;w.presentation.run((function*():Co{try{for(;;){if(takeoff===null&&!d.paused){const ready=event('E01.chiyanReady');while(ready&&!ready.done)yield;takeoff=w.presentationTime;event('E01.chiyanJoin');s.times['chiyan.takeoff']=takeoff;pad.dead=true;join(g,'chiyan');const c=w.companions.team.find(c=>c.kind==='chiyan');if(c){c.x=75;c.y=640;c.cooldown=999;c.penFlight=true;}}const since=takeoff===null?null:w.presentationTime-takeoff;
   if(since!==null){
    const target=!rightDone&&!posts[1].dead?posts[1]:since>=20?posts.filter(p=>!p.dead).sort((a,b)=>a.hp-b.hp)[0]:undefined;
    s.ship.supportTarget=target?.id??null;
    if(target){if(since>=20&&!fallback){fallback=true;s.times['chiyan.fallback']=w.presentationTime;}g.damage(target,target.maxHp/8*w.lastRealDt,target.x,target.y,true,'companion');if(!rightDone&&since>=8)g.damage(target,9999,undefined,undefined,true,'companion');}
    // 补过的桩仍可打；起飞后25秒内打开拦网。
    const deadline=takeoff??undefined;if(deadline!==undefined&&w.presentationTime>=deadline+25){for(const p of posts)if(!p.dead)g.damage(p,9999,undefined,undefined,true,'companion');}
   }
   if(!rightDone&&posts[1].dead){rightDone=true;s.times['chiyan.rightBroken']=w.presentationTime;}
   if(posts.every(e=>e.dead&&!e.data.densityQueued)){
    if(!opened){opened=true;s.times['net.opened']=w.presentationTime;s.events.push('E01.gateOpened');for(const tile of tiles)tile.dead=true;s.gate!.alpha=1;d.event('E01.gateOpened');}
   }else {for(const tile of tiles)tile.dead=false;s.gate!.alpha=0;}
   if(opened&&takeoff!==null&&w.presentationTime-s.times['net.opened']>=2&&d.groups.filter(v=>v.event.startsWith('E01.')).every(v=>v.done))break;
   yield;
  }
 }finally{d.onLineStart=d.onLineEnd=undefined;s.ship.supportTarget=null;s.ship.chiyanEngine=false;pad.dead=dock.dead=true;const c=w.companions.team.find(c=>c.kind==='chiyan');if(c){c.cooldown=.9;c.penFlight=false;}finished=true;}})());
 while(!finished)yield;
 s.gate.dead=true;for(const tile of tiles)tile.dead=true;for(const post of posts)if(post.data.remains)post.data.remains.dead=true;g.drop('p',450,600);clear(g);
}

type Plan={at:number;go:(g:G)=>void}[];
/** 按秒出场：到点且对白未暂停时执行；最后 6 秒不再出新敌，到时清场。 */
function* timeline(g:G,seconds:number,plan:Plan,each?:(t:number)=>void):Co{
 const w=g as World,start=g.t;let i=0;
 while(g.t-start<seconds){const t=g.t-start;while(i<plan.length&&t>=plan[i].at&&!w.chapterDialogue?.spawnPaused){plan[i++].go(g);}each?.(t);yield;}
}
const bark=(g:G,id:string):Plan[number]=>({at:0,go:()=>{director(g).event(id);}});
const drop=(kind:'p'|'ink'|'bomb'|'medal',x:number,y=40)=>(g:G)=>g.drop(kind,x,y);
const dragDecay=(s:RouteState,dt:number)=>{if(s.ship.hooks.length)return;for(const p of s.ship.pull){const k=Math.max(0,1-3*dt);p.x*=k;p.y*=k;}};
/** 出港：墨空慢慢展开，云梭排在身后，只有零星的蜂机。 */
export function* depart(g:G,s:RouteState):Co{
 s.ship.follow=true;s.ship.protected=false;const w=g as World;
 g.scrollSpeed(200,.1);g.scrollSpeed(80,12);
 const rock=g.scene('sky_rock-medium-vine',1080,1020);rock.sx=rock.sy=.8;const start=g.t;let said=0;
 const plan:Plan=[{at:.5,go:()=>director(g).event('CH1.air.turn')},{at:7.6,go:()=>director(g).event('CH1.air.rock')},{at:9,go:beeShot(-1)},{at:12,go:beeShot(1)}];
 yield* timeline(g,15,plan,t=>{rock.x=1080-t*58;rock.y=s.ship.scene.y-70;rock.rot=Math.sin(t*.3)*.06;rock.alpha=Math.min(1,(15-t)/2);void said;void w;});
 rock.dead=true;clear(g);
}
/** 第一波：弱蜂机成群从上方和两侧扫过，一两下就能打掉，掉火力。 */
export function* wave(g:G,s:RouteState):Co{
 s.ship.follow=true;
 const plan:Plan=[
  {at:2,go:g=>director(g).event('CH1.air.radar')},
  {at:1,go:sweepTop(4)},{at:7,go:sweepSide(-1,4)},{at:10,go:drop('p',300)},{at:12,go:stopGo(1)},
  {at:16,go:seq(sweepWave(5,300,400),sweepTop(5,600,400))},{at:20,go:g=>director(g).event('CH1.air.raid')},
  {at:22,go:sweepSide(-1,5)},{at:23,go:stopGo(1,200)},{at:27,go:beeSwarm(4)},{at:28,go:drop('p',600)},
  {at:28,go:g=>director(g).event('CH1.air.fight')},
  {at:29,go:seq(sweepWave(6,450,700),sweepSide(-1,4,160))},{at:33,go:seq(sweepSide(1,5,120),sweepSide(-1,5,200))},{at:35,go:drop('p',450)},
 ];
 yield* timeline(g,40,plan);clear(g);
}
/** 劫机：钩机放红链挂住云梭往上拖，第一次出现时标「打掉钩机」；断链后云梭回队。 */
export function* hijack(g:G,s:RouteState):Co{
 s.ship.follow=true;s.ship.protected=false;
 const hook=(side:-1|1,first=false)=>(g:G)=>{kiteGlide(true,side,first?{weakLabel:'钩机',weakWeapon:'red',hookLabel:'打掉钩机'}:{})(g);if(first)director(g).event('CH1.hijack');};
 const plan:Plan=[
  {at:1,go:sweepTop(3)},{at:3,go:hook(-1,true)},{at:9,go:craneRow},{at:13,go:turtle(450)},{at:16,go:kitePair},
  {at:19,go:hook(1)},{at:21,go:shieldSquad(2)},{at:25,go:scout(250,330)},
  {at:26,go:hook(-1)},{at:27,go:sweepTop(4,600,400)},{at:31,go:seq(stopGo(-1),sweepSide(1,4))},
 ];
 yield* timeline(g,37,plan,()=>dragDecay(s,(g as World).lastRealDt));
 while(s.ship.hooks.length){dragDecay(s,0);yield;}
 for(const p of s.ship.pull){p.x=p.y=0;}clear(g);
}
/** 喘息：飞行放缓，总镖头说明纸龙。 */
export function* breather(g:G,s:RouteState):Co{
 s.ship.follow=true;const start=g.t;g.unlockBrush('横');g.drop('ink',450,40);g.drop('p',300,40);
 yield* conversation(g,s,'CH1.breather');
 while(g.t-start<15)yield;clear(g);
}
/** 大场面：拦截雷石。空中堡垒为主体，4 座炮塔各自可毁，2 条钳臂夹着雷石；钳臂全断后开舱，雷石落下并被拖走。给一次泼墨。 */
export function* battery(g:G,s:RouteState):Co{
 s.ship.follow=true;s.ship.protected=false;const w=g as World;
 director(g).brief(3);while(director(g).briefRemaining>0)yield;
 let fort:Fortress|undefined,stone:Scenery|undefined,tow:Scenery|undefined,openedAt=-1;
 const bombers=(g:G)=>{for(let i=0;i<3;i++)spawn(g,Bomber,250+i*200,-80-i*40,{noSupplementFire:true,attack:i===0?'oil':i===2?'rocket':undefined});};
 const plan:Plan=[
  {at:0,go:seq(bombers,sweepTop(4))},{at:6,go:g=>{director(g).event('E07.rockWarningShown');}},
  {at:8,go:seq(sweepSide(-1,4),sweepSide(1,4))},
  {at:11,go:g=>{fort=startFortress(g,56);emit(g,s,'E08.batteryCargoShown');g.drop('bomb',450,700);g.caption('','拦下空中堡垒',4);}},
  {at:38,go:seq(bombers,sweepTop(5,300,500))},
  {at:50,go:seq(stopGo(-1),stopGo(1,200))},
 ];
 const each=(t:number)=>{
  if(fort&&openedAt<0&&fort.open){openedAt=t;stone=g.scene('sky_rock',fort.openX,fort.openY);stone.layer='front';stone.glow=1.5;stone.sx=stone.sy=.9;tow=g.scene('e_kite',stone.x+110,stone.y-40);tow.sx=tow.sy=1.4;tow.layer='air';emit(g,s,'E08.transportDirectionShown');}
  if(stone&&tow){const k=t-openedAt;stone.sx=stone.sy=Math.min(1.1,.9+k*.1);stone.x+=(k<1.2?0:40+(k-1.2)*2.5)*w.lastRealDt;stone.y+=(k<1.2?120:-18)*w.lastRealDt;tow.x=stone.x+110;tow.y=stone.y-40;tow.rot=.9;if(stone.x>1000){stone.dead=tow.dead=true;stone=tow=undefined;}}
 };
 yield* timeline(g,66,plan,each);
 if(stone)stone.dead=true;if(tow)tow.dead=true;g.drop('medal',450,40);clear(g);
}
/** 急行：穿云俯冲进入两侧崖台，追兵与地面火力交错。 */
export function* rush(g:G,s:RouteState):Co{
 s.ship.follow=true;s.ship.protected=false;enterLowPass(g,s,true);director(g).event('CH1.rush');
 const plan:Plan=[
  {at:2,go:seq(chaseBehind(3),lowTarget(LowCannon,-1))},
  {at:5,go:lowTarget(LowBallista,1)},
  {at:8,go:sweepSide(1,2)},
  {at:9,go:lowTarget(LowEaveGunner,-1)},
  {at:11,go:chaseBehind(3)},
  {at:13,go:lowTarget(LowCannon,1)},
  {at:14,go:seq(sweepLaser(1,400),sweepSide(-1,2))},
  {at:17,go:lowTarget(LowBallista,-1)},
  {at:20,go:shieldSquad(1,600)},
  {at:21,go:seq(chaseBehind(2),lowTarget(LowEaveGunner,1))},
  {at:25,go:seq(sweepSide(-1,2),sweepSide(1,2),lowTarget(LowCannon,-1))},
  {at:28,go:lowTarget(LowBallista,1)},
  {at:30,go:chaseBehind(3)},{at:32,go:drop('ink',450)},
 ];
 yield* timeline(g,36,plan);clear(g);
}
/** 关前：石桥随卷轴滚入并停在铜雀脚下。 */
export function* gate(g:G,s:RouteState):Co{
 s.ship.follow=true;copperGate(g,s);const w=g as World,bridge=s.bridge.find(p=>p.sprite==='sky_low-bridge')!;
 const start=w.scroll;s.low!.stop=undefined;bridge.y=-180;
 const silhouette=g.scene('b_sparrow_body',450,-250);silhouette.sx=silhouette.sy=.35;silhouette.alpha=.65;silhouette.layer='air';
 const cannons=[spawn(g,LowCannon,112,-180),spawn(g,LowCannon,788,-180)];
 g.scrollSpeed(80,1.8);
 while(bridge.y<300){bridge.y=Math.min(300,-180+w.scroll-start);silhouette.y=bridge.y-70;yield;}
 // 停靠后景物锁在同一地面坐标，首领的空战卷轴不带走石桥。
 s.low!.stop=w.scroll;g.scrollSpeed(0);
 for(const e of cannons)e.y=bridge.y;
 yield* timeline(g,3,[{at:0,go:sweepSide(-1,2)}]);
 yield* conversation(g,s,'E10.tongqueBlockShown');
 g.drop('ink',450,700);clear(g);
 // 保留桥上剪影，正式首领登场时交接。
 g.fork((function*():Co{while(!g.liveEnemies().some(e=>e.def.boss))yield;silhouette.dead=true;})());
}
export function* escortEnd(g:G,s:RouteState):Co{
 g.music('rest',.8);clear(g);yield* conversation(g,s,'TQ.POST.laodunJoin');join(g,'laodun');s.cart.rot=0;const escortY=s.cart.y;
 // 末击是场景攻击表现，盾面相交后才消失；伙伴真正加入并参与随后护送。
 const strike=g.scene('sky_chain-gate',450,330);strike.sx=.15;strike.layer='air';let blocked=false;
 yield* run(g,10,t=>{s.cart.y=escortY+(1260-escortY)*t/10;strike.y=330+t*140;const shield=(g as G & {companions:{team:{kind:string;x:number;y:number}[]}}).companions.team.find(c=>c.kind==='laodun');
  if(shield){strike.x=450+(shield.x-450)*Math.min(1,t/3);}if(shield&&!blocked&&Math.abs(strike.x-shield.x)<=84&&strike.y>=shield.y-25){blocked=true;strike.dead=true;g.fx.burst(shield.x,shield.y,25,160,[.3,1.5,.8]);}if(blocked){s.lastStrikeBlocked=true;if(!s.events.includes('TQ.POST.lastStrikeBlocked')){s.events.push('TQ.POST.lastStrikeBlocked');director(g).event('TQ.POST.lastStrikeBlocked',true);}}
 });strike.dead=true;s.cart.y=1260;yield* conversation(g,s,'TQ.POST.lastStrikeBlocked','TQ.POST.reunion','TQ.POST.partSalvaged','TQ.POST.escortComplete','H.lampsStillDark','H.interlude');
}
export interface Ch1Segment {id:string;label:string;speed:number;bg:number;run:(g:G,s:RouteState)=>Co}
export const CH1_SEGMENTS:Ch1Segment[]=[
 {id:'S1',label:'出港',speed:200,bg:.1,run:depart},
 {id:'S2',label:'第一波',speed:80,bg:.1,run:wave},
 {id:'S3',label:'屏障',speed:30,bg:.2,run:barrier},
 {id:'S4',label:'劫机',speed:90,bg:.3,run:hijack},
 {id:'S5',label:'喘息',speed:45,bg:.3,run:breather},
 {id:'S6',label:'大场面',speed:120,bg:.5,run:battery},
 {id:'S7',label:'急行',speed:160,bg:.5,run:rush},
 {id:'S8',label:'关前',speed:30,bg:.5,run:gate},
];
