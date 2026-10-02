import { normal, speed, count, visible, charge } from './ordinary';
import { oilAttack,rocketAttack } from './stage1_attacks';
// 第一章空战新增敌人；友方目标只通过 EscortShip 获取。
import type { Enemy,EnemyDef } from '../game/enemy';
import type { Co,G } from '../game/api';
import type { World } from '../game/world';
import { CH1_AIR_ART } from '../game/escort';
import { SpritePlayback } from '../art/playback';
/** 固定炮位的近身散射：玩家进到 170 以内且炮可被打时，炮口亮 0.5 秒，向四周撒一圈 10 发短射程快弹（飞约 220 就消失），冷却 4 秒。 */
export function closeBurst(e:Enemy,g:G):void{
 const k=e.data.contentRole==='normal'?.42:.7;
 e.run((function*():Co{for(;;){
  const p=g.player;if(e.invulnerable||e.alpha<=0||Math.hypot(p.x-e.x,p.y-e.y)>170){yield;continue;}
  g.fx.charge(e.x,e.y,26,.5,[1.5,.7,.2]);yield* g.wait(.5);
  g.ring(e.x,e.y,Math.round(10/k),300,{shape:'rice',color:'amber',life:220/(300*g.difficulty.speed)});yield* g.wait(4);}})());
}
export const NetPost:EnemyDef={name:'浮石林网桩',sprite:CH1_AIR_ART.post.atlas,hp:200,score:500,noCollide:true,onHit(e){e.frame=CH1_AIR_ART.post.segments.damaged.start;},*ai(e){e.stop();e.data.manualFrame=true;for(;;){e.frame=e.hp<e.maxHp?CH1_AIR_ART.post.segments.damaged.start:CH1_AIR_ART.post.segments.intact.start;yield;}},
 onDeath(e,g){const remains=g.scene(CH1_AIR_ART.post.atlas,e.x,e.y);remains.frame=CH1_AIR_ART.post.segments.destroyed.start;e.data.remains=remains;}};
export const BridgeTurret:EnemyDef={normalHp:[72,'M'],name:'浮石炮塔',sprite:'e_turret',hp:110,score:1000,noCollide:true,
 onHit(e,_g,x,y,source){if(e.charging&&['red','blue','purple','companion'].includes(source)&&Math.hypot(x-e.x,y-(e.y+20))<=40)e.interrupt(.4);},
 *ai(e,g){if(!normal(g))closeBurst(e,g);e.stop();let volley=0;e.onInterrupt=()=>{e.data.interrupted=true;};
  for(;;){const ship=(g as World).escort;const atShip=volley++%2===0&&ship&&!ship.protected;e.data.target=atShip?'ship':'player';
   const target=atShip?ship.scene:g.player;const a=Math.atan2(target.y-e.y,target.x-e.x);e.charging=true;e.data.interrupted=false;g.fx.charge(e.x,e.y,28,normal(g)?.9:4,[1.5,.7,.2]);yield* g.wait(normal(g)?.9:4);
   if(e.charging){for(let i=0;i<3&&e.charging;i++){g.shoot(e.x,e.y+20,a,speed(g,normal(g)?170:190),{shape:'crystal',color:'amber'});yield* g.wait(.15);}e.charging=false;}yield* g.wait(normal(g)?1.45:2);
  }
 }};
export const ShoreCannon:EnemyDef={...BridgeTurret,normalHp:[52,'M'],name:'两岸山炮',hp:65,score:700,*ai(e,g){if(!normal(g))closeBurst(e,g);e.stop();let volley=0;
 for(;;){const ship=(g as World).escort;const atShip=volley++%2===1&&ship&&!ship.protected;const p=atShip?ship.scene:g.player;
  const a=Math.atan2(p.y-e.y,p.x-e.x);e.data.target=atShip?'ship':'player';e.data.aimLocked=true;e.data.lockedAngle=a;e.charging=true;g.fx.charge(e.x,e.y,22,normal(g)?.8:1.2,[1.5,.7,.2]);yield* g.wait(normal(g)?.8:1.2);
  if(e.charging){g.fan(e.x,e.y,a,normal(g)?count(g,2):Math.round(2/g.difficulty.count),.12,speed(g,normal(g)?170:190),{shape:'rice',color:'amber'});e.charging=false;e.data.firedAt=g.real;}yield* g.wait(2);
 }
}};
export const AirBomb:EnemyDef={normalHp:[10,'F'],name:'轰炸机炸弹',sprite:CH1_AIR_ART.bomb.atlas,hp:10,score:0,radius:10,noCollide:true,
 *ai(e,g){const ship=(g as World).escort!;const x=e.data.landX as number,y=e.data.landY as number;
  const warning={x,y,started:g.real,dead:false};ship.warnings.push(warning);const log={warnAt:g.real,x,y,explodeAt:undefined as number|undefined,destroyed:false};ship.bombLog.push(log);e.data.bombLog=log;e.data.warning=warning;
  try{e.vy=260;if(normal(g))e.vx=(x-e.x)/Math.max(.1,(y-e.y)/260);while(e.y<y){yield;}e.stop();if(normal(g))e.x=x;while(g.real-log.warnAt<1.2)yield;
  log.explodeAt=g.real;warning.dead=true;ship.explode(x,y);g.remove(e);}finally{warning.dead=true;}
 },onDeath(e){e.data.warning&&(e.data.warning.dead=true);if(e.data.bombLog)e.data.bombLog.destroyed=true;}};
export const Bomber:EnemyDef={normalHp:[140,'M'],name:'浮石林轰炸机',sprite:CH1_AIR_ART.bomber.atlas,hp:170,score:900,
 *ai(e,g){const ship=(g as World).escort!,art=CH1_AIR_ART.bomber;
  if(e.data.attack){e.data.noSupplementFire=true;e.data.manualFrame=true;const fly=new SpritePlayback(art.segments.flight);e.run((function*():Co{for(;;){fly.update(g.dt);e.frame=art.segments.flight.start+fly.frame;yield;}})());if(normal(g)){e.run(e.moveTo(e.x,310,2));yield* visible(e,g);yield* g.wait((e.data.attack==='oil'?.55:.5)+(e.data.attackDelay??0));}else yield* e.moveTo(e.x,310,2.5);for(let i=0;i<2;i++){if(e.data.attack==='oil')yield* oilAttack(e,g);else yield* rocketAttack(e,g);yield* g.wait(4);}yield* e.moveTo(e.x<450?-180:1080,200,2);g.remove(e);return;}e.data.noSupplementFire=true;e.data.manualFrame=true;e.vy=90;
  if(normal(g)){
   const flight=new SpritePlayback(art.segments.flight);e.run((function*():Co{for(;;){flight.update(g.dt);if(!e.data.bayOpen)e.frame=art.segments.flight.start+flight.frame;yield;}})());
   yield* visible(e,g);yield* g.wait(.3+(e.data.attackDelay??0));
   for(let round=0;round<2;round++){
    e.data.bayOpen=true;e.data.bayOpenedAt=g.real;yield* charge(e,g,.6);
    const bombing=new SpritePlayback(art.segments.bombing,event=>{if(event.name!=='bombRelease')return;
     e.data.releaseAt=g.real;e.data.releaseFrame=art.segments.bombing.start+event.frame;g.sfx('bomber_release');ship.bomberReleases.push({frame:e.data.releaseFrame,opened:e.data.bayOpenedAt,at:g.real});
     const x=ship.scene.x,y=ship.scene.y;
     for(const dx of [0,round%2?-260:260])g.spawn(AirBomb,e.x+dx*.2,e.y+30,b=>{b.data.contentRole='hazard';b.data.noSupplementFire=true;b.data.landX=Math.max(60,Math.min(840,x+dx));b.data.landY=y;});
    });
    let t=0;while(t<1.4){e.frame=art.segments.bombing.start+bombing.frame;bombing.update(g.dt);t+=g.dt;yield;}e.data.bayOpen=false;yield* g.wait(2.2);
   }
   yield* e.moveTo(e.x<450?-180:1080,250,2);g.remove(e);return;
  }
  const flight=new SpritePlayback(art.segments.flight);
  // 机炮：每 2.4 秒朝玩家放 3 发扇形；玩家贴到机身下方 170 以内时，亮光 0.6 秒后近身炸一圈（冷却 5 秒）。
  let gun=1.5,burst=0;const guns=function*():Co{gun-=g.dt;burst-=g.dt;
   if(burst<=0&&Math.abs(g.player.x-e.x)<170&&g.player.y>e.y&&g.player.y-e.y<300){burst=5;g.fx.charge(e.x,e.y,30,.6,[1.5,.7,.2]);yield* g.wait(.6);g.ring(e.x,e.y+20,Math.round(8/.42),120,{shape:'orb',color:'magenta'});}
   else if(gun<=0){gun=2.4;g.fan(e.x,e.y+20,g.aim(e.x,e.y),Math.round(3/.42),.5,150,{shape:'crystal',color:'amber'});}};
  while(ship.scene.y-e.y>=260){yield* guns();flight.update(g.dt);e.frame=art.segments.flight.start+flight.frame;e.vx=Math.max(-40,Math.min(40,(ship.scene.x-e.x)*.25));yield;}
  e.vx=0;e.data.bayOpen=true;e.data.bayOpenedAt=g.real;g.fx.burst(e.x,e.y,8,30,[.9,.5,.1]);
  const bombing=new SpritePlayback(art.segments.bombing,event=>{if(event.name!=='bombRelease')return;
   e.frame=art.segments.bombing.start+event.frame;e.data.releaseFrame=e.frame;e.data.releaseAt=g.real;
   g.sfx('bomber_release');ship.bomberReleases.push({frame:e.frame,opened:e.data.bayOpenedAt,at:g.real});
   const x=ship.scene.x,y=ship.scene.y,anchor=art.anchors.bombRelease;
   for(let i=0;i<3;i++)g.spawn(AirBomb,e.x+anchor[0],e.y+anchor[1],b=>{b.hp=b.maxHp=AirBomb.hp/g.difficulty.hp;b.data.contentRole='hazard';b.data.noSupplementFire=true;b.data.landX=x;b.data.landY=y+(i-1)*45;});
  });
  while(e.y<1300){yield* guns();e.frame=art.segments.bombing.start+bombing.frame;yield;bombing.update(g.dt);}g.remove(e);
 }};
