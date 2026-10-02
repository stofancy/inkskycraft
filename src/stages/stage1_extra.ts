import type { Co, G } from '../game/api';
import type { Enemy, EnemyDef } from '../game/enemy';
const PI = Math.PI;
const clamp = (x:number)=>Math.max(75,Math.min(825,x));
function aim(e:Enemy,g:G,lead=0):number {
  const last=e.data.lastPlayer ?? g.player.x;
  const x=clamp(g.player.x+(g.player.x-last)*g.difficulty.intelligence*lead);
  e.data.lastPlayer=g.player.x;
  return Math.atan2(g.player.y-e.y,x-e.x);
}
function* exit(e:Enemy,g:G):Co { yield* g.wait(1);e.vel(-PI/2,160); }
function def(kind:string,hp:number,ai:(e:Enemy,g:G)=>Co):EnemyDef {
  return {name:kind,sprite:`e_${kind}`,hp,score:hp*30,explosion:hp>=200?'l':hp>=60?'m':'s',ai};
}
export const Swallow=def('swallow',16,function*(e,g){
  e.data.weakWeapon='blue';e.data.weakLabel='流 · 旧位急转';
  e.vel(PI/2,230);yield* g.wait(.8);const tx=clamp(g.player.x);g.fx.charge(tx,430,22,.9,[.3,1,1]);yield* g.wait(.9);
  yield* e.moveTo(tx,430,1.1);g.shoot(e.x,e.y,aim(e,g,1),190,{color:'cyan',shape:'rice'});e.vel(PI/2+(tx<450?.45:-.45),240);
});
export const SwordShuttle=def('swordshuttle',20,function*(e,g){
  e.data.weakWeapon='red';e.data.weakLabel='刃 · 示线贯穿';yield* e.moveTo(e.x,220,1);
  const a=aim(e,g,2);g.laser(e.x,e.y,a,{warn:1,duration:.18,width:4,color:'cyan',follow:e});yield* g.wait(1.1);e.vel(a,440);
});
export const ShieldKite=def('shieldkite',90,function*(e,g){
  e.data.weakWeapon='red';e.data.weakLabel='刃 · 盾翼';yield* e.moveTo(e.x,230,1.5);e.data.bodyPhase='shield';
  for(let k=0;k<3;k++){const escorted=g.liveEnemies().find(n=>n!==e&&!n.parent&&!n.def.boss&&n.y>100&&n.y<450&&Math.abs(n.x-e.x)<180);if(escorted){e.data.linkTo=escorted.id;yield* e.moveTo(escorted.x,escorted.y+60,.6);}g.fx.charge(e.x,e.y,42,.9,[1,.6,.2]);yield* g.wait(.9);g.fan(e.x,e.y,PI/2,3,.65,120,{color:'amber',shape:'crystal'});yield* g.wait(1.6/g.difficulty.aggression);yield* e.moveBy(k%2?100:-100,20,.6);}yield* exit(e,g);
});
export const SealBee=def('sealbee',18,function*(e,g){
  e.data.weakWeapon='purple';e.data.weakLabel='印 · 清阵记';yield* e.moveTo(e.x,300,1.2);
  for(let k=0;k<3;k++){g.ring(e.x,e.y,4,65,{color:'magenta',shape:'orb',life:5},PI/4);yield* g.wait(1.9/g.difficulty.aggression);}yield* exit(e,g);
});
export const InkSnail=def('inksnail',75,function*(e,g){
  e.data.weakWeapon='blue';e.data.weakLabel='流 · 救墨池';yield* e.moveTo(e.x,390,2);
  for(let k=0;k<3;k++){g.fx.charge(e.x,e.y,48,1,[.2,.8,.7]);yield* g.wait(1);if(Math.hypot(g.player.x-e.x,g.player.y-e.y)<170)g.player.ink=Math.max(.2,g.player.ink-.08);g.shoot(e.x,e.y,aim(e,g),110,{color:'magenta',shape:'big'});yield* g.wait(1.3/g.difficulty.aggression);}g.drop('ink',e.x,e.y);yield* exit(e,g);
});
const ArrayNode:EnemyDef={sprite:'e_sealbee',hp:16,score:150,noCollide:true};
export const ArrayDisc=def('arraydisc',85,function*(e,g){
  e.data.weakWeapon='purple';e.data.weakLabel='印 · 三点开路';yield* e.moveTo(e.x,250,1.5);
  const nodes=[-65,0,65].map((dx)=>g.attach(e,ArrayNode,[dx,35]));nodes.forEach(n=>{n.data.weakWeapon='purple';n.data.linkTo=e.id;});
  for(let k=0;k<3;k++){for(const n of nodes.filter(n=>!n.dead))g.laser(n.x,n.y,PI/2,{warn:1,duration:.45,width:5,color:'magenta',follow:n});yield* g.wait(2.5/g.difficulty.aggression);}yield* exit(e,g);
});
export const DartSkater=def('dartskater',22,function*(e,g){
  yield* e.moveTo(e.x,280,1);for(let k=0;k<3;k++){const a=aim(e,g,2);g.shoot(e.x,e.y,a,180,{color:'amber',shape:'petal',angVel:.65,life:5});yield* e.moveBy(e.x<450?140:-140,65,1.1/g.difficulty.aggression);}e.vel(PI/2,190);
});
export const BellBoat=def('bellboat',80,function*(e,g){
  yield* e.moveTo(e.x,230,1.6);for(let k=0;k<3;k++){g.fx.charge(e.x,e.y,60,1,[1,.7,.2]);yield* g.wait(1);g.fx.shockwave(e.x,e.y,180,3,.4);for(const n of g.liveEnemies())if(n!==e&&!n.parent&&!n.def.boss&&Math.hypot(n.x-e.x,n.y-e.y)<180){n.vx=(n.x<e.x?-1:1)*70;n.data.fireAt=.15;}g.ring(e.x,e.y,5,95,{color:'amber',shape:'orb'});yield* g.wait(1.7/g.difficulty.aggression);}yield* exit(e,g);
});
const Rock:EnemyDef={sprite:'e_sealbee',hp:18,score:100};
export const MountainApe=def('mountainape',210,function*(e,g){
  e.data.weakWeapon='red';e.data.weakLabel='刃 · 搬山臂';yield* e.moveTo(e.x,230,2);
  for(let k=0;k<3;k++){const x=clamp(g.player.x);g.fx.charge(x,600,35,1,[1,.7,.2]);yield* g.wait(1);const rock=g.attach(e,Rock,[x-e.x,30]);rock.data.bodyPhase='rock';rock.run((function*():Co{while(!rock.dead){rock.offY+=150*g.dt;yield;}})());yield* g.wait(2/g.difficulty.aggression);}yield* exit(e,g);
});
export const InkOtter=def('inkotter',18,function*(e,g){
  yield* e.moveTo(e.x,450,1.5);g.drop('ink',e.x<450?300:600,620);yield* g.wait(.9);
  const tx=clamp(g.player.x);g.fx.charge(tx,620,25,.9,[.3,1,1]);yield* g.wait(.9);yield* e.moveTo(tx,620,.65);g.shoot(e.x,e.y,aim(e,g,1),160,{color:'cyan',shape:'rice'});e.vel(PI/2,210);
});
export const LanternFox=def('lanternfox',65,function*(e,g){
  e.data.weakWeapon='purple';e.data.weakLabel='印 · 指挥机';yield* e.moveTo(e.x,200,1.4);
  for(let k=0;k<3;k++){g.fx.charge(e.x,e.y,55,1,[1,.5,.5]);yield* g.wait(1);const friends=g.liveEnemies().filter(n=>n!==e&&!n.parent&&!n.def.boss&&n.y<550).slice(0,Math.round(2+2*g.difficulty.intelligence));for(const n of friends)g.shoot(n.x,n.y,aim(n,g,2),160,{color:'cyan',shape:'rice'});yield* g.wait(2/g.difficulty.aggression);}yield* exit(e,g);
});
export const BridgeBreaker=def('bridgebreaker',220,function*(e,g){
  e.data.weakWeapon='red';e.data.weakLabel='刃 · 桥吊';yield* e.moveTo(e.x,200,2);
  for(let k=0;k<3;k++){const side=k%2===0?-1:1;g.fx.charge(e.x+side*55,e.y,45,1,[1,.5,.2]);yield* g.wait(1);g.laser(e.x+side*55,e.y,PI/2+side*.18,{warn:1,duration:1,width:12,color:'amber',follow:e});yield* g.wait(2.5/g.difficulty.aggression);}yield* exit(e,g);
});
export const EXTRA_ENEMIES=[Swallow,SwordShuttle,ShieldKite,SealBee,InkSnail,ArrayDisc,DartSkater,BellBoat,MountainApe,InkOtter,LanternFox,BridgeBreaker];
