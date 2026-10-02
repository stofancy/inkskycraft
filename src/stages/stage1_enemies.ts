import { normal, speed, count, visible, charge } from './ordinary';
import { bladeAttack,mineAttack,hookAttack,closeSlash,kiteLine,mountShield } from './stage1_attacks';
// 第一幕 · 墨山晓：普通敌人定义。每种敌人各有一套走位与攻击，中型以上带一种贴身手段，预警后才出手。
// 颜色约定：cyan = 自机狙 / 快弹；magenta = 慢速花瓣、圆弹（适合画圈）；amber = 炮塔 / 铜龟的水晶弹。
import type { Enemy,EnemyDef } from '../game/enemy';
import type { Co,G } from '../game/api';
import type { World } from '../game/world';
import { closeBurst } from './stage1_air_enemies';

const PI = Math.PI;
/** fan / ring 的实发数 = 名义数 × 难度 count 0.7 × 普通敌 fire 0.6；预乘回来，普通难度实发 n 发，其他档同比例升降。 */
const B=(n:number)=>Math.round(n/.42);
/** 沿直线飞向 (x,y)，sec 秒内线性减速到位；用速度推进，机头跟着走。 */
function* glideTo(e:Enemy,g:G,x:number,y:number,sec:number):Co{const dx=x-e.x,dy=y-e.y,dist=Math.hypot(dx,dy),a=Math.atan2(dy,dx);let t=0;while(t<sec){e.vel(a,2*dist/sec*(1-t/sec));t+=g.dt;yield;}e.stop();e.x=x;e.y=y;}
/** 贴身冲撞：金线锁定玩家当前位置 sec 秒（线长 = 冲刺距离），随后沿线冲出 run 秒，不追踪。 */
function* lunge(e:Enemy,g:G,sec:number,speed:number,run:number):Co{
 const a=g.aim(e.x,e.y);g.laser(e.x,e.y,a,{warn:normal(g)?sec/g.difficulty.warn:sec,duration:.02,length:speed*run+40,width:2,color:'amber'});g.fx.charge(e.x,e.y,26,sec,[1.5,.7,.2]);e.vel(a,1);yield* g.wait(sec);
 e.vel(a,speed);yield* g.wait(run);
}

// P3 剧情家族：各自有明确的进入、攻击窗口与退场，沿用第一章正式分镜。
/** 蜂机：data.shot=true 为亮相用的单发瞄准点射；data.sweep 直线或蛇形扫过（data.wave 为蛇形摆幅）；data.stopgo 走走停停，沿 data.pts 每站停 0.45 秒放扇形弹；默认是成窝俯冲：先亮肚灯和瞄准线，再沿线冲向锁定点，拉起离场。 */
export const RouteHornet:EnemyDef={normalHp:[16,'L'],name:'巡山蜂机',sprite:'e_hornet',hp:16,score:200,face:'move',faceUp:true,
 *ai(e,g){const d=e.data;
  if(normal(g)&&d.rear){
   e.run(e.moveTo(d.tx,190,1.2));yield* visible(e,g);yield* g.wait(.4+(d.delay??0));
   for(let i=0;i<5;i++){const a=g.aim(e.x,e.y);yield* charge(e,g,.3);g.shoot(e.x,e.y,a,speed(g,165),{shape:'rice',color:'cyan'});yield* g.wait(1.5);}
   yield* e.moveTo(e.x<450?-100:1000,180,1.5);g.remove(e);return;
  }
  if(normal(g)&&d.shot){
   e.run(e.moveTo(d.tx??450,330,1.3));yield* visible(e,g);yield* g.wait(.15);const a=g.aim(e.x,e.y);yield* charge(e,g,.3);
   g.shoot(e.x,e.y,a,speed(g,165),{shape:'rice',color:'cyan'});yield* g.wait(1);yield* e.moveTo(e.x<450?-100:1000,600,2);g.remove(e);return;
  }
  if(d.shot){yield* e.moveTo(d.tx??450,330,2);const a=g.aim(e.x,e.y);g.fx.charge(e.x,e.y,20,.8,[1.5,.7,.2]);e.vel(a,1);yield* g.wait(.8);g.shoot(e.x,e.y,a,190,{shape:'rice',color:'cyan'});yield* e.moveTo(e.x<450?-100:1000,600,3);g.remove(e);return;}
  // 走走停停：每站先亮光 0.45 秒再放一轮（3、1、3 发），放完再走，末站后向外上方飞走。
  if(d.stopgo){if(d.delay)yield* g.wait(d.delay);const pts=d.pts as [number,number][],shots=[3,1,3];
   for(let i=0;i<pts.length;i++){yield* glideTo(e,g,pts[i][0],pts[i][1],.8);const a=g.aim(e.x,e.y);g.fx.charge(e.x,e.y,18,.45,[1.5,.8,.3]);if(normal(g))yield* charge(e,g,.45);else yield* g.wait(.45);g.fan(e.x,e.y,normal(g)?a:g.aim(e.x,e.y),B(normal(g)?3:shots[i%3]),.3,speed(g,175),{shape:'rice',color:'cyan'});yield* g.wait(.3);}
   const out=e.x<450?PI+.4:-.4;let t=0;while(e.x>-120&&e.x<1020&&e.y>-140&&t<5){t+=g.dt;e.vel(out,260+t*120);yield;}
   g.remove(e);return;}
  // 扫过：沿给定方向直线飞过整屏，一架只放一发瞄准点射，一两下就能打掉；data.ang 初始方向，data.turn 转弯角速度。
  if(d.sweep){if(d.delay)yield* g.wait(d.delay);let ang=d.ang??PI/2;const turn=d.turn??0,spd=d.spd??230,fireAt=d.fireAt??1.1;
   const wave=d.wave??0,ph=d.phase??0;
   while(e.x>-120&&e.x<1020&&e.y>-140&&e.y<1340){ang+=turn*g.dt;e.vel(ang+wave*Math.sin(e.age*2.4+ph),spd);
    if(normal(g)&&!d.fired&&e.x>35&&e.x<865&&e.y>45&&e.y<900&&Math.hypot(e.x-g.player.x,e.y-g.player.y)>180&&(e.vy>=0||e.y<g.player.y-180)){
     d.visibleTime=(d.visibleTime??0)+g.dt;
     if(d.visibleTime>=.15&&d.locked===undefined){d.locked=g.aim(e.x,e.y);g.fx.charge(e.x,e.y,18,.3,[1.5,.8,.3]);}
     if(d.visibleTime>=.45){d.fired=true;g.shoot(e.x,e.y,d.locked,speed(g,165),{shape:'rice',color:'cyan'});}
    }
    if(!normal(g)&&!d.fired&&e.age>fireAt&&e.y>40&&e.y<900&&e.x>40&&e.x<860){d.fired=true;g.shoot(e.x,e.y,g.aim(e.x,e.y),d.bulletSpd??170,{shape:'rice',color:'cyan'});}
    yield;}
   g.remove(e);return;}
  yield* e.moveTo(d.tx??450,d.ty??230,1.1,'outQuad');if(d.delay)yield* g.wait(d.delay);
  // 锁定：金线指向玩家当前位置，肚灯亮 0.7 秒。
  const px=g.player.x,py=g.player.y,a=Math.atan2(py-e.y,px-e.x),dist=Math.hypot(px-e.x,py-e.y);
  g.laser(e.x,e.y,a,{warn:normal(g)?.8/g.difficulty.warn:.7,duration:.02,length:dist+60,width:2,color:'amber'});g.fx.charge(e.x,e.y,22,.7,[1.5,.8,.3]);e.vel(a,1);yield* g.wait(normal(g)?.8:.7);
  // 俯冲到锁定点（最长 2.6 秒），不追踪。
  e.vel(a,340);let t=0;while(t<2.6&&Math.hypot(px-e.x,py-e.y)>40){t+=g.dt;yield;}
  // 拉起：向后甩一发慢弹，再朝外侧弧线离场。
  g.shoot(e.x,e.y,g.aim(e.x,e.y),140,{shape:'rice',color:'amber'});
  const side=e.x<450?-1:1;let ang=Math.atan2(e.vy,e.vx);for(;;){ang+=-side*2.4*g.dt;e.vel(ang,340);yield;}
 }};
/** 纸鹤：编队首尾分别使用纸刃、符雷；其余按 data.slot 错开开火。每轮蓄力 1 秒撒一圈慢弹（第 2 轮加一束瞄准扇形），然后整体横移一步停下；半血折翼成纸团撞船。 */
export const RouteCrane:EnemyDef={normalHp:[60,'M'],name:'巡路纸鹤',sprite:'e_crane',hp:60,score:650,
 *ai(e,g){const d=e.data,half=()=>e.hp<=e.maxHp*.5;
  if(d.attack){d.noSupplementFire=true;if(normal(g)){yield* e.moveTo(d.tx??450,300,.3);yield* visible(e,g);yield* g.wait((d.slot??0)*.4);}else{yield* e.moveTo(d.tx??450,300,1.6);yield* g.wait(.5+(d.slot??0)*.45);}for(let i=0;i<2;i++){if(d.attack==='blade')yield* bladeAttack(e,g);else yield* mineAttack(e,g);yield* g.wait(3.5);}yield* e.moveTo(e.x<450?-100:1000,200,2);g.remove(e);return;}
  const wait=function*(sec:number):Generator<void,boolean>{let t=0;while(t<sec){if(half())return true;t+=g.dt;yield;}return half();};
  const x0=d.tx??450;
  if(normal(g)){e.run(e.moveTo(x0,d.row?240:260,1));yield* visible(e,g);yield* g.wait(.3+(d.slot??0)*.4);}
  else yield* e.moveTo(x0,d.row?240:260,d.row?1.6:2);
  if(!normal(g)&&(yield* wait(d.row?.4+(d.slot??0)*.9:(d.delay??1.5)))){yield* crumple(e,g);return;}
  for(let i=0;i<3;i++){g.fx.charge(e.x,e.y,25,normal(g)?.6:1,[1.5,.7,.2]);if(yield* wait(normal(g)?.6:1)){yield* crumple(e,g);return;}
   if(normal(g))g.fan(e.x,e.y,PI*1.5,count(g,6),PI*1.65,speed(g,95),{shape:'orb',color:'magenta',life:9});else g.ring(e.x,e.y,B(d.row?6:8),95,{shape:'orb',color:'magenta',life:11},i*PI/8);
   if(!normal(g)&&i===1)g.fan(e.x,e.y,g.aim(e.x,e.y),B(3),.5,170,{shape:'rice',color:'cyan'});
   // 走走停停：横移一步，落脚前微微上下摆
   const bx=Math.max(90,Math.min(810,e.x+(i%2?-1:1)*(d.row?80:160))),by=e.y+(d.row?0:30),sx=e.x,sy=e.y;let t=0;
   while(t<1.1){if(half()){yield* crumple(e,g);return;}t+=g.dt;const k=Math.min(1,t/1.1),ease=1-(1-k)*(1-k);e.x=sx+(bx-sx)*ease;e.y=sy+(by-sy)*ease+Math.sin(k*PI)*-24;yield;}
   if(yield* wait(1.2)){yield* crumple(e,g);return;}}
  yield* e.moveTo(e.x<450?-100:1000,200,2);g.remove(e);}};
/** 纸鹤半血：折成纸团，直冲最近一条船，撞上扣 3 点耐久。 */
function* crumple(e:Enemy,g:G):Co{
 const ship=(g as World).escort;e.scaleX=e.scaleY=.6;e.tint=[.95,.85,.7];g.fx.burst(e.x,e.y,8,40,[1.2,.9,.5]);e.charging=false;
 if(normal(g)){
  const p=ship?.scene??{x:e.x,y:1200},a=Math.atan2(p.y-e.y,p.x-e.x);
  g.laser(e.x,e.y,a,{warn:.8/g.difficulty.warn,duration:0,width:2,color:'amber'});yield* charge(e,g,.8);
  e.vel(a,220);while(e.y<1320&&e.x>-100&&e.x<1000){if(ship&&Math.hypot(ship.scene.x-e.x,ship.scene.y-e.y)<80){ship.hit(3);break;}yield;}g.remove(e);return;
 }
 yield* g.wait(.3);
 for(;;){if(e.dead)return;const best=ship?.scene;
  if(!best){e.vel(PI/2,220);yield;continue;}
  const a=Math.atan2(best.y-e.y,best.x-e.x);e.vel(a,220);
  if(Math.hypot(best.x-e.x,best.y-e.y)<80){ship!.hit(3);g.fx.explosion(e.x,e.y,'s');g.remove(e);return;}
  yield;}
}
/** 铜龟：两轮蓄力稀疏晶弹；160像素内蓄势挥斩，随后缩壳滚撞并离场。 */
export const RouteTurtle:EnemyDef={normalHp:[80,'M'],name:'浮石林铜龟',sprite:'e_turtle',hp:85,armor:.7,score:1000,
 *ai(e,g){e.data.noSupplementFire=true;closeSlash(e,g);
  if(normal(g)){
   e.run(e.moveTo(e.data.tx??450,400,1.4));yield* visible(e,g);yield* g.wait(.4);const a=g.aim(e.x,e.y);yield* charge(e,g,.6);
   for(const off of [-.6,-.36,-.12,.36,.6])g.shoot(e.x,e.y,a+off,speed(g,100),{shape:'crystal',color:'amber'});
   e.charging=false;yield* g.wait(1.4);yield* lunge(e,g,1,280,1.3);yield* e.moveTo(e.x<450?-100:1000,390,2);g.remove(e);return;
  }
  yield* e.moveTo(e.data.tx??450,440,2);
  for(let i=0;i<2;i++){e.charging=true;g.fx.charge(e.x,e.y,32,2,[1.5,.7,.2]);yield* g.wait(2);
   if(e.charging){g.fan(e.x,e.y,g.aim(e.x,e.y),B(2),.5,150,{shape:'crystal',color:'amber'});e.charging=false;}
   yield* g.wait(1.6);}
  yield* lunge(e,g,1,280,1.3);yield* g.wait(1.5);
  yield* e.moveTo(e.x<450?-100:1000,390,2);g.remove(e);}};
/** 纸鸢：顺风滑翔、被阵风吹偏，每滑 2.2 秒停下撒一圈慢花瓣（第 2 圈带瞄准扇形），三圈后金线预警俯冲撞向玩家。data.hook=true 时滑到船上方放钩（线先亮 1.5 秒），钩住后每 2 秒扣船 1 点；半血断线逃走。 */
export const RouteKite:EnemyDef={normalHp:[64,'M'],name:'横越风筝',sprite:'e_kite',hp:80,score:1100,
 *ai(e,g){const d=e.data,dir=e.x<450?1:-1,y0=e.y,seed=e.id*1.7,ship=(g as World).escort;
  if(d.lineX!==undefined){d.noSupplementFire=true;if(d.lineLead)yield* kiteLine(e,g);else{yield* e.moveTo(d.lineX,300,1.5);while(!d.lineDone&&d.linePartner&&!d.linePartner.dead)yield;}yield* e.moveTo(e.x<450?-100:1000,e.y-100,1.5);g.remove(e);return;}
  const glide=function*(sec:number):Co{let t=0;while(t<sec){t+=g.dt;e.x+=(dir*80+38*Math.sin(e.age*.55+seed))*g.dt;e.y=y0+34*Math.sin(e.age*.9+seed);yield;}};
  const petals=function*(i:number):Co{g.fx.charge(e.x,e.y,22,.8,[1.5,.7,.2]);yield* g.wait(.8);g.ring(e.x,e.y,B(8),95,{shape:'petal',color:'magenta',life:9,angVel:.3},i*PI/8);if(!normal(g)&&i===1)g.fan(e.x,e.y,g.aim(e.x,e.y),B(3),.5,185,{shape:'rice',color:'cyan'});};
  if(normal(g)&&!d.hook&&d.lineX===undefined){
   e.run(glide(9));yield* visible(e,g);yield* g.wait(.3);
   for(let i=0;i<3;i++){const a=g.aim(e.x,e.y);yield* charge(e,g,.5);
    for(const side of [-1,1])g.fan(e.x+side*25,e.y,a+side*.45,count(g,3),.28,speed(g,95),{shape:'petal',color:'magenta',life:7,angVel:-side*.12});
    yield* g.wait(2.5);}
   g.remove(e);return;
  }
  if(!d.hook||!ship){for(let i=0;i<3;i++){yield* glide(2.2);yield* petals(i);}yield* lunge(e,g,.9,340,1.1);yield* g.wait(2);g.remove(e);return;}
  yield* glide(2);
  // 顺风滑到船正上方
  while(Math.abs(e.x-ship.scene.x)>12){const k=Math.sign(ship.scene.x-e.x);e.x+=(k*110+30*Math.sin(e.age*.7+seed))*g.dt;e.y=y0+20*Math.sin(e.age*.9+seed);yield;}
  const ax=ship.scene.x,ay=ship.scene.y-70;g.laser(e.x,e.y,Math.atan2(ay-e.y,ax-e.x),{warn:normal(g)?1/g.difficulty.warn:1.5,duration:.02,length:Math.hypot(ax-e.x,ay-e.y),width:3,color:'gold'});g.fx.charge(e.x,e.y+20,26,1.5,[1.5,.9,.3]);
  yield* g.wait(normal(g)?1:1.5);
  // 红链挂住云梭并往上拖；8 秒内把钩机打掉一半血，链断云梭回队，否则云梭受 12 点损伤后松钩。
  if(d.hookLabel)(g as World).fodder?.mark(d.hookLabel,e,8);
  ship.hooks.push(e);d.hooked=true;let next=1.5,held=0;const pl=ship.pull[0];
  while(held<8&&e.hp>e.maxHp*.5){held+=g.dt;next-=g.dt;e.x+=(ship.scene.x-e.x)*Math.min(1,g.dt*1.2);e.y=y0+14*Math.sin(e.age*.9+seed);
   if(ship.follow&&ship.scene.y>e.y+170)pl.y=Math.max(-900,pl.y-120*g.dt);
   if(next<=0){ship.hit(1);next=1.5;}yield;}
  if(held>=8&&e.hp>e.maxHp*.5)ship.hit(12);
  d.hooked=false;ship.hooks.splice(ship.hooks.indexOf(e),1);g.fx.burst(e.x,e.y+20,8,60,[1,.9,.6]);
  e.vy=-120;e.vx=dir*60;yield* g.wait(4);g.remove(e);}};
/** 浮石吊臂（老耿开的）：地面金框预警 1.2 秒，吊臂砸到 y=750 并炸出一圈慢弹，停 1.2 秒再抬回半空，朝玩家补一束扇形弹后离场。 */
export const LiftingArm:EnemyDef={normalHp:[112,'F'],name:'浮石吊臂',sprite:'e_mountainape',hp:140,score:1500,armor:.8,
 onHit(e,g){if(e.data.fodderDriver)(g as World).fodder?.bubble('老耿','03',e);},
 onDeath(e,g){if(e.data.fodderDriver)(g as World).fodder?.death(e);},
 *ai(e,g){e.stop();if(normal(g)&&e.y<65)yield* e.moveTo(e.x,160,.7);if(e.data.delay)yield* g.wait(e.data.delay);const tx=e.data.targetX??450,warning=g.scene('story_warning',tx,750);warning.sx=1.3;warning.sy=.4;
  if(e.data.fodderDriver){const f=(g as World).fodder!;f.actors.push({name:'老耿',e,state:'driver',at:g.real,next:0,count:0});f.bubble('老耿','01',e);f.record('老耿','armWarning');g.sfx('warning',{vol:.5,pitch:1.4});g.fx.burst(e.x,e.y+120,12,50,[.6,.45,.25]);}
  yield* g.wait(1.2);warning.dead=true;yield* e.moveTo(tx,750,1.6,'inQuad');
  g.fx.shockwave(e.x,e.y,160,5,.5);g.fx.shake(.3);if(normal(g)){g.fan(e.x,e.y-40,PI/2,count(g,6),PI,speed(g,100),{shape:'orb',color:'magenta'});yield* g.wait(1.2);yield* e.moveTo(e.x,-160,2.5,'inQuad');g.remove(e);return;}g.ring(e.x,e.y-40,B(10),115,{shape:'orb',color:'magenta'});yield* g.wait(1.2);
  yield* e.moveTo(e.data.homeX??e.x,380,2);g.fan(e.x,e.y,g.aim(e.x,e.y),B(5),.7,150,{shape:'crystal',color:'amber'});yield* g.wait(1.5);yield* e.moveTo(e.x,-160,2.5,'inQuad');g.remove(e);}};

/** 云哨：躲在浮石后的弩手。露头 1.6 秒：红眼亮、瞄准线 1 秒后放一轮（第 1 轮单发快弹，第 2 轮 3 发扇形，第 3 轮 5 发宽扇），再缩回浮石（缩回时无敌）并换到另一块石头。data.atShip=true 瞄船。 */
export const RouteScout:EnemyDef={normalHp:[48,'M'],name:'云哨',sprite:'e_turret',hp:60,score:600,noCollide:true,
 *ai(e,g){if(!normal(g))closeBurst(e,g);const d=e.data,ship=(g as World).escort,home=e.x;
  const rock=g.scene('sky_rock',e.x,e.y+10);rock.layer='ground';rock.sx=rock.sy=.55;rock.owner=e;
  const hide=(on:boolean)=>{e.invulnerable=on;e.alpha=on?0:1;};
  hide(true);yield* g.wait(d.delay??.6);
  for(let round=0;round<3;round++){
   hide(false);g.fx.burst(e.x,e.y,6,35,[.8,.8,.8]);
   const t=d.atShip&&ship&&!ship.protected?ship.scene:g.player,a=Math.atan2(t.y-e.y,t.x-e.x);e.angle=a-PI/2;
   g.laser(e.x,e.y,a,{warn:normal(g)?.8/g.difficulty.warn:1,duration:.02,length:Math.hypot(t.x-e.x,t.y-e.y),width:2,color:'amber'});g.fx.charge(e.x,e.y,20,1,[1.5,.7,.2]);
   yield* g.wait(normal(g)?.8:1);if(round===0||(normal(g)&&round===2))g.shoot(e.x,e.y,a,speed(g,normal(g)?175:200),{shape:'crystal',color:'amber'});else g.fan(e.x,e.y,a,B(normal(g)?3:round===1?3:5),normal(g)?.3:round===1?.3:.7,speed(g,normal(g)?175:190),{shape:'crystal',color:'amber'});yield* g.wait(normal(g)?.8:.6);
   hide(true);g.fx.burst(e.x,e.y,6,35,[.8,.8,.8]);yield* g.wait(1.4);
   const nx=normal(g)?home:Math.max(110,Math.min(790,home+(round%2?-1:1)*140));e.x=nx;rock.x=nx;
  }
  rock.dead=true;g.remove(e);}};

/** 盾筝：铜盾挡在编队下方，盾可击碎，左右两侧留出射击角度。 */
export const RouteShield:EnemyDef={normalHp:[48,'F'],name:'盾筝',sprite:'e_kite',hp:60,score:900,
 *ai(e,g){e.data.noSupplementFire=true;e.scaleX=e.scaleY=1.25;
  let shield:Enemy;
  if(normal(g)){shield=mountShield(e,g);shield.hp=shield.maxHp=Math.round(28*[1,1.2,1.4,1.55][e.data.birthPower-1]);yield* e.moveTo(e.data.tx??450,e.data.ty??330,2);}
  else{yield* e.moveTo(e.data.tx??450,e.data.ty??330,2);shield=mountShield(e,g);}let t=0;
  while(t<12&&!shield.dead){t+=g.dt;const ally=g.liveEnemies().find(a=>a!==e&&!a.parent&&a.def===RouteHornet&&a.y<e.y&&Math.abs(a.x-e.x)<240);
   if(ally)e.x+=(ally.x-e.x)*Math.min(1,g.dt*1.2);yield;}
  if(!shield.dead)g.remove(shield);yield* e.moveTo(e.x<450?-120:1020,220,2);g.remove(e);
 }};

/** 巡检机：绕船盘旋时朝玩家放两次可打断钩索，随后拉线（1.2 秒）飞贴船，贴上催缴符，6 秒后扣船 8 点耐久；打死巡检机符立刻揭掉。半血放信号烟，叫来 2 架蜂机。 */
export const RouteInspector:EnemyDef={normalHp:[60,'M'],name:'巡检机',sprite:'e_rotor',hp:60,score:1200,
 *ai(e,g){const ship=(g as World).escort;e.tint=[.85,1,1];e.data.noSupplementFire=true;
  e.run((function*():Co{if(normal(g)){yield* visible(e,g);yield* g.wait(.3);}else yield* g.wait(1.2);for(let i=0;i<2;i++){yield* hookAttack(e,g);yield* g.wait(normal(g)?2.5:4.5);}})());
  if(!ship){yield* g.wait(1);g.remove(e);return;}
  let called=false;
  e.run((function*(){while(e.hp>e.maxHp*.5)yield;if(called)return;called=true;g.fx.burst(e.x,e.y,12,60,[1.4,1.1,.6]);for(let i=0;i<2;i++)g.spawn(RouteHornet,i?960:-60,150,b=>{b.data.contentRole='normal';b.data.patrol=true;b.data.tx=i?640:260;b.data.ty=210;b.data.delay=i*.5;});})());
  const R=230;let ang=e.x<450?PI:0,sweep=0;
  // 绕船一圈
  while(sweep<PI*(normal(g)?1:2)){const cx=ship.scene.x,cy=Math.min(ship.scene.y-130,760);ang+=.8*g.dt;sweep+=.8*g.dt;e.x+=(cx+Math.cos(ang)*R-e.x)*Math.min(1,g.dt*4);e.y+=(cy+Math.sin(ang)*R*.6-e.y)*Math.min(1,g.dt*4);yield;}
  // 拉线 1.2 秒，然后贴符
  const lx=ship.scene.x,ly=ship.scene.y-40;g.laser(e.x,e.y,Math.atan2(ly-e.y,lx-e.x),{warn:1.2,duration:.02,length:Math.hypot(lx-e.x,ly-e.y),width:3,color:'gold'});g.fx.charge(e.x,e.y,28,1.2,[1.5,.9,.3]);yield* g.wait(1.2);
  while(Math.hypot(ship.scene.x-e.x,ship.scene.y-80-e.y)>30){const a=Math.atan2(ship.scene.y-80-e.y,ship.scene.x-e.x);e.x+=Math.cos(a)*320*g.dt;e.y+=Math.sin(a)*320*g.dt;yield;}
  const mark=g.scene('story_warning',ship.scene.x,ship.scene.y-30);mark.layer='air';mark.sx=mark.sy=.5;mark.owner=e;
  let left=6;while(left>0){left-=g.dt;e.x=ship.scene.x+Math.sin(e.age*3)*20;e.y=ship.scene.y-120;mark.x=ship.scene.x;mark.y=ship.scene.y-30;mark.alpha=.5+.5*Math.sin(e.age*(6+(6-left)*3));yield;}
  mark.dead=true;ship.hit(8);g.fx.explosion(ship.scene.x,ship.scene.y-30,'s');e.vy=-200;yield* g.wait(3);g.remove(e);}};
