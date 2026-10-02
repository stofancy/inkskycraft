// 第一幕 · 墨山晓：普通敌人定义（杂兵、纸鹤、风筝、铜龟、炮台、战车）。
// 颜色约定：cyan = 自机狙 / 快弹；magenta = 慢速花瓣、圆弹（适合画圈）；amber = 炮塔 / 战车的水晶弹。
import type { Enemy,EnemyDef } from '../game/enemy';
import type { Co,G } from '../game/api';
import type { World } from '../game/world';

const PI = Math.PI;

/** 杂兵：沿 data.angle 方向直线飞行，途中朝玩家打 burst 发，然后转向离场。 */
export const Hornet: EnemyDef = {
  sprite: 'e_hornet', hp: 14, score: 200, face: 'move', faceUp: true,
  *ai(e, g) {
    const d = e.data;
    const sp: number = d.speed ?? 250;
    e.vel(d.angle ?? PI / 2, sp);
    yield* g.wait(d.fireAt ?? 0.75);
    const burst: number = d.burst ?? 1;
    for (let i = 0; i < burst && d.fire !== false; i++) {
      const m = e.anchor('muzzle');
      g.shoot(m.x, m.y, g.aim(m.x, m.y), 200 + g.rank * 50, { shape: 'rice', color: 'cyan' });
      yield* g.wait(0.14);
    }
    const side: number = d.turn ?? (e.x < 450 ? 1 : -1);
    for (;;) {
      e.vel(Math.atan2(e.vy, e.vx) - side * 1.5 * g.dt, sp);
      yield;
    }
  },
};

/** 纸鹤：从侧面滑入编队位置（data.slot），悬停撒慢速圆弹环，然后向侧面离场。 */
export const Crane: EnemyDef = {
  sprite: 'e_crane', hp: 20, score: 400,
  *ai(e, g) {
    const d = e.data;
    const [sx, sy] = d.slot as [number, number];
    yield* e.moveTo(sx, sy, d.enter ?? 1.7, 'outQuad');
    yield* g.wait(d.fireAt ?? 0.3);
    const volleys: number = d.volleys ?? 3;
    for (let k = 0; k < volleys; k++) {
      const m = e.anchor('muzzle');
      const n = 9 + Math.round(g.rank * 3);
      g.ring(m.x, m.y, n, 125 + g.rank * 30, { shape: 'orb', color: 'magenta' }, k * 0.2 + (e.x < 450 ? 0 : 0.17));
      if (k === 1) g.shoot(m.x, m.y, g.aim(m.x, m.y), 190, { shape: 'rice', color: 'cyan' });
      yield* g.wait((d.gap ?? 1.0) / g.difficulty.aggression);
    }
    yield* g.wait(0.3);
    e.vel(e.x < 450 ? PI : 0, 190);
    e.vy = -60;
  },
};

/** 铜风筝（中型）：沿 data.dir 方向横穿，边飞边撒慢速花瓣环（适合画圈）。 */
export const Kite: EnemyDef = {
  sprite: 'e_kite', hp: 70, score: 1500, armor: 0.85, drops: 'medal', explosion: 'm',
  *ai(e, g) {
    const d = e.data;
    const dir: number = d.dir ?? 1;
    const y0 = e.y;
    e.vx = dir * (d.speed ?? 120);
    yield* g.wait(0.8);
    let t = 0;
    for (let i = 0; ; i++) {
      // 边飞边缓慢起伏
      const until = t + 0.65;
      while (t < until) { e.y = y0 + 26 * Math.sin(t * 1.5); t += g.dt; yield; }
      const m = e.anchor('muzzle');
      const n = 9 + Math.round(g.rank * 3);
      g.ring(m.x, m.y, n, 100 + g.rank * 20, { shape: 'petal', color: 'magenta', angVel: dir * 0.35, life: 7 }, i * 0.31);
      if (i % 3 === 2) g.fan(m.x, m.y, g.aim(m.x, m.y), 3, 0.32, 210, { shape: 'rice', color: 'cyan' });
    }
  },
};

/** 铜龟炮塔（部件）：朝玩家扇形晶弹。 */
export const TurtleGun: EnemyDef = {
  sprite: 'e_turtle_gun', hp: 30, score: 600, ground: true, face: 'player',
  *ai(e, g) {
    yield* g.wait(1.2);
    for (;;) {
      const m = e.anchor('muzzle');
      g.fan(m.x, m.y, g.aim(m.x, m.y), 3, 0.4, 190 + g.rank * 30, { shape: 'crystal', color: 'amber' });
      yield* g.wait((1.7 - g.rank * 0.3) / g.difficulty.aggression);
    }
  },
};
/** 浮石林上的铜龟（地面，随卷轴移动）。 */
export const Turtle: EnemyDef = {
  sprite: 'e_turtle', hp: 85, score: 1000, ground: true, armor: 0.7,
  *ai(e, g) {
    g.attach(e, TurtleGun, 'turret');
  },
};

/** 山体炮台（地面）：两连发自机狙。 */
export const Turret: EnemyDef = {
  sprite: 'e_turret', hp: 65, score: 500, ground: true, face: 'player',
  *ai(e, g) {
    yield* g.wait(0.8 + (e.data.delay ?? 0));
    for (;;) {
      for (let i = 0; i < 2; i++) {
        if (e.data.disabled) { yield* g.wait(.3); continue; }
        const m = e.anchor('muzzle');
        g.shoot(m.x, m.y, g.aim(m.x, m.y), 215 + g.rank * 30, { shape: 'crystal', color: 'amber' });
        yield* g.wait(0.16);
      }
      yield* g.wait((1.9 - g.rank * 0.3) / g.difficulty.aggression);
    }
  },
};

/** 飞行战车（中型轰炸机）：入场压制，双炮自机狙三连发，舱口投下大慢弹。 */
export const Chariot: EnemyDef = {
  sprite: 'e_chariot', hp: 260, score: 4000, armor: 0.85, drops: ['medal', 'medal'], explosion: 'l',
  *ai(e, g) {
    const d = e.data;
    const ty: number = d.ty ?? 210;
    yield* e.moveTo(e.x, ty, 2.2, 'outCubic');
    g.fx.shockwave(e.x, e.y, 180, 6, 0.6);
    g.fx.shake(0.25);
    const hold: number = d.hold ?? 13;
    let t = 0;
    for (let i = 0; t < hold; i++) {
      for (let k = 0; k < 3; k++) {
        for (const a of ['gunL', 'gunR']) {
          const m = e.anchor(a);
          g.shoot(m.x, m.y, g.aim(m.x, m.y) + (a === 'gunL' ? -0.05 : 0.05), 225 + g.rank * 30, { shape: 'rice', color: 'cyan' });
        }
        yield* g.wait(0.13);
        t += 0.13;
      }
      if (i % 2 === 1) {
        const b = e.anchor('bay');
        g.ring(b.x, b.y, 6, 105, { shape: 'big', color: 'magenta' }, PI / 6);
        g.ring(b.x, b.y, 12, 135, { shape: 'orb', color: 'magenta' }, i * 0.2);
      }
      const w = 1.5 / g.difficulty.aggression;
      yield* g.wait(w);
      t += w;
    }
    e.vel(-PI / 2, 130);
  },
};

// P3 剧情家族：各自有明确的进入、攻击窗口与退场，沿用第一章正式分镜。
/** 蜂机：data.shot=true 为亮相用的单发瞄准点射；默认是成窝俯冲：先亮肚灯和瞄准线，再沿线冲向锁定点，拉起离场。 */
export const RouteHornet:EnemyDef={name:'巡山蜂机',sprite:'e_hornet',hp:18,score:200,face:'move',faceUp:true,
 *ai(e,g){const d=e.data;
  if(d.shot){yield* e.moveTo(d.tx??450,330,2);const a=g.aim(e.x,e.y);g.fx.charge(e.x,e.y,20,.8,[1.5,.7,.2]);e.vel(a,1);yield* g.wait(.8);g.shoot(e.x,e.y,a,190,{shape:'rice',color:'cyan'});yield* e.moveTo(e.x<450?-100:1000,600,3);g.remove(e);return;}
  // 扫过：沿给定方向直线飞过整屏，一架只放一发瞄准点射，一两下就能打掉；data.ang 初始方向，data.turn 转弯角速度。
  if(d.sweep){if(d.delay)yield* g.wait(d.delay);let ang=d.ang??PI/2;const turn=d.turn??0,spd=d.spd??230,fireAt=d.fireAt??1.1;
   while(e.x>-120&&e.x<1020&&e.y>-140&&e.y<1340){ang+=turn*g.dt;e.vel(ang,spd);
    if(!d.fired&&e.age>fireAt&&e.y>40&&e.y<900&&e.x>40&&e.x<860){d.fired=true;g.shoot(e.x,e.y,g.aim(e.x,e.y),d.bulletSpd??170,{shape:'rice',color:'cyan'});}
    yield;}
   g.remove(e);return;}
  yield* e.moveTo(d.tx??450,d.ty??230,1.1,'outQuad');if(d.delay)yield* g.wait(d.delay);
  // 锁定：金线指向玩家当前位置，肚灯亮 0.7 秒。
  const px=g.player.x,py=g.player.y,a=Math.atan2(py-e.y,px-e.x),dist=Math.hypot(px-e.x,py-e.y);
  g.laser(e.x,e.y,a,{warn:.7,duration:.02,length:dist+60,width:2,color:'amber'});g.fx.charge(e.x,e.y,22,.7,[1.5,.8,.3]);e.vel(a,1);yield* g.wait(.7);
  // 俯冲到锁定点（最长 2.6 秒），不追踪。
  e.vel(a,340);let t=0;while(t<2.6&&Math.hypot(px-e.x,py-e.y)>40){t+=g.dt;yield;}
  // 拉起：向后甩一发慢弹，再朝外侧弧线离场。
  g.shoot(e.x,e.y,g.aim(e.x,e.y),140,{shape:'rice',color:'amber'});
  const side=e.x<450?-1:1;let ang=Math.atan2(e.vy,e.vx);for(;;){ang+=-side*2.4*g.dt;e.vel(ang,340);yield;}
 }};
/** 纸鹤：data.row 为整排压下：到位后左右慢摆，按 data.slot 错开依次撒环；半血折翼成纸团撞船。默认保留原来的「到位、等 delay、两圈」。 */
export const RouteCrane:EnemyDef={name:'巡路纸鹤',sprite:'e_crane',hp:65,score:650,
 *ai(e,g){const d=e.data,half=()=>e.hp<=e.maxHp*.5;
  const wait=function*(sec:number):Generator<void,boolean>{let t=0;while(t<sec){if(half())return true;t+=g.dt;yield;}return half();};
  const x0=d.tx??450;yield* e.moveTo(x0,d.row?240:260,d.row?1.6:2);
  const rounds=2;
  if(!d.row&&(yield* wait(d.delay??3))){yield* crumple(e,g);return;}
  if(d.row&&(yield* wait(.4+(d.slot??0)*1.2))){yield* crumple(e,g);return;}
  for(let i=0;i<rounds;i++){g.fx.charge(e.x,e.y,25,1,[1.5,.7,.2]);if(yield* wait(1)){yield* crumple(e,g);return;}
   g.ring(e.x,e.y,Math.round((d.row?5:6)/g.difficulty.count),95,{shape:"orb",color:"magenta",life:11},i*.25);
   if(d.row){const t0=e.age;let w=0;while(w<5.2){if(half()){yield* crumple(e,g);return;}e.x=x0+Math.sin((e.age-t0)*.9+(d.slot??0))*40;w+=g.dt;yield;}}
   else if(yield* wait(4)){yield* crumple(e,g);return;}}
  yield* e.moveTo(e.x<450?-100:1000,200,2);g.remove(e);}};
/** 纸鹤半血：折成纸团，直冲最近一条船，撞上扣 3 点耐久。 */
function* crumple(e:Enemy,g:G):Co{
 const ship=(g as World).escort;e.scaleX=e.scaleY=.6;e.tint=[.95,.85,.7];g.fx.burst(e.x,e.y,8,40,[1.2,.9,.5]);e.charging=false;
 yield* g.wait(.3);
 for(;;){if(e.dead)return;const vs=ship?.vessels.length?ship.vessels:ship?[ship.scene]:[];let best=vs[0];for(const v of vs)if(!best||Math.hypot(v.x-e.x,v.y-e.y)<Math.hypot(best.x-e.x,best.y-e.y))best=v;
  if(!best){e.vel(PI/2,220);yield;continue;}
  const a=Math.atan2(best.y-e.y,best.x-e.x);e.vel(a,220);
  if(Math.hypot(best.x-e.x,best.y-e.y)<80){ship!.hit(3);g.fx.explosion(e.x,e.y,'s');g.remove(e);return;}
  yield;}
}
export const RouteTurtle:EnemyDef={name:'浮石林铜龟',sprite:'e_turtle',hp:110,armor:.7,score:1000,
 *ai(e,g){yield* e.moveTo(e.data.tx??450,440,2);e.charging=true;g.fx.charge(e.x,e.y,32,4,[1.5,.7,.2]);yield* g.wait(4);if(e.charging){g.fan(e.x,e.y,g.aim(e.x,e.y),Math.round(2/g.difficulty.count),.35,145,{shape:'crystal',color:'amber'});e.charging=false;}yield* g.wait(3);yield* e.moveTo(e.x<450?-100:1000,390,2);g.remove(e);}};
export const RouteTurret:EnemyDef={name:'两岸山炮',sprite:'e_turret',hp:65,score:700,
 *ai(e,g){e.stop();const a=g.aim(e.x,e.y);e.data.aimLocked=true;e.data.lockedAngle=a;g.fx.charge(e.x,e.y,22,1.2,[1.5,.7,.2]);yield* g.wait(1.2);g.fan(e.x,e.y,a,Math.round(2/g.difficulty.count),.12,190,{shape:'rice',color:'amber'});yield* g.wait(4);g.remove(e);}};
/** 纸鸢：顺风滑翔、被阵风吹偏，每 2.5 秒撒一圈慢花瓣。data.hook=true 时滑到船上方放钩（线先亮 1.5 秒），钩住后每 2 秒扣船 1 点；半血断线逃走。 */
export const RouteKite:EnemyDef={name:'横越风筝',sprite:'e_kite',hp:90,score:1100,
 *ai(e,g){const d=e.data,dir=e.x<450?1:-1,y0=e.y,seed=e.id*1.7,ship=(g as World).escort;
  const glide=function*(sec:number):Co{let t=0;while(t<sec){t+=g.dt;e.x+=(dir*80+38*Math.sin(e.age*.55+seed))*g.dt;e.y=y0+34*Math.sin(e.age*.9+seed);yield;}};
  const petals=function*():Co{g.fx.charge(e.x,e.y,22,.8,[1.5,.7,.2]);yield* g.wait(.8);g.ring(e.x,e.y,5,95,{shape:'petal',color:'magenta',life:9});};
  if(!d.hook||!ship){for(let i=0;i<3;i++){yield* glide(2.5);yield* petals();}g.remove(e);return;}
  yield* glide(2);
  // 顺风滑到船正上方
  while(Math.abs(e.x-ship.scene.x)>12){const k=Math.sign(ship.scene.x-e.x);e.x+=(k*110+30*Math.sin(e.age*.7+seed))*g.dt;e.y=y0+20*Math.sin(e.age*.9+seed);yield;}
  const ax=ship.scene.x,ay=ship.scene.y-70;g.laser(e.x,e.y,Math.atan2(ay-e.y,ax-e.x),{warn:1.5,duration:.02,length:Math.hypot(ax-e.x,ay-e.y),width:3,color:'gold'});g.fx.charge(e.x,e.y+20,26,1.5,[1.5,.9,.3]);
  yield* g.wait(1.5);
  // 红链挂住云梭并往上拖；8 秒内把钩机打掉一半血，链断云梭回队，否则云梭受 12 点损伤后松钩。
  if(d.hookLabel)(g as World).fodder?.mark(d.hookLabel,e,8);
  ship.hooks.push(e);d.hooked=true;let next=1.5,held=0;const pl=ship.pull[Math.max(0,ship.vessels.indexOf(ship.scene))];
  while(held<8&&e.hp>e.maxHp*.5){held+=g.dt;next-=g.dt;e.x+=(ship.scene.x-e.x)*Math.min(1,g.dt*1.2);e.y=y0+14*Math.sin(e.age*.9+seed);
   if(ship.follow&&ship.scene.y>e.y+170)pl.y=Math.max(-900,pl.y-120*g.dt);
   if(next<=0){ship.hit(1);next=1.5;}yield;}
  if(held>=8&&e.hp>e.maxHp*.5)ship.hit(12);
  d.hooked=false;ship.hooks.splice(ship.hooks.indexOf(e),1);g.fx.burst(e.x,e.y+20,8,60,[1,.9,.6]);
  e.vy=-120;e.vx=dir*60;yield* g.wait(4);g.remove(e);}};
export const BatteryCarrier:EnemyDef={name:'电池搬运机',sprite:'story_carrier-body',hp:240,armor:.65,score:2000,
 onHit(e,_g,x,y,source){if(e.charging&&['red','blue','purple','companion'].includes(source)&&Math.min(Math.hypot(x-e.x-55*e.scaleX,y-e.y-2*e.scaleX),Math.hypot(x-e.x+55*e.scaleX,y-e.y-2*e.scaleX))<=32*e.scaleX)e.interrupt(.4);},
 *ai(e,g){e.stop();const k=e.scaleX;const gun=g.scene('story_carrier-gun-charge',e.x+55*k,e.y+2*k);gun.layer='air';const gunLeft=g.scene('story_carrier-gun-charge-mirror',e.x-55*k,e.y+2*k);gunLeft.layer='air';const claw=g.scene('story_carrier-claw',e.x-22*k,e.y+44*k);const clawRight=g.scene('story_carrier-claw-mirror',e.x+22*k,e.y+44*k);claw.layer=clawRight.layer='air';const battery=g.scene('sky_rock',e.x,e.y);battery.layer='air';const lid=g.scene('story_carrier-lid',e.x,e.y-35*k);lid.layer='air';
  // 场景层先绘制电池，再绘制舱盖；所有分件随本体，电池没有敌人身份。
  const warning=g.scene('story_warning',e.x+55*k,e.y+50*k);warning.layer='air';warning.sx=warning.sy=.55;warning.alpha=0;warning.owner=e;gunLeft.owner=claw.owner=clawRight.owner=gun.owner=lid.owner=battery.owner=e;lid.alpha=1;battery.alpha=0;e.onInterrupt=()=>{if(e.data.chargeLive)e.data.interrupted=true;e.data.chargeLive=false;e.data.cargoOpen=true;lid.rot=-1.05;lid.sy=.45*k;battery.alpha=0;warning.alpha=0;};e.data.cargoOpen=false;let opened=0;for(const v of [gun,gunLeft,claw,clawRight,battery,lid])v.sx=v.sy=k;warning.sx=warning.sy=.55*k;
  g.fork((function*(){while(!e.dead){gun.x=e.x+55*k;gun.y=e.y+2*k;gun.rot=e.charging?-.65:0;gun.sprite=e.charging?'story_carrier-gun-charge':'story_carrier-gun';gunLeft.sprite=e.charging?'story_carrier-gun-charge-mirror':'story_carrier-gun-mirror';gunLeft.x=e.x-55*k;gunLeft.y=e.y+2*k;gunLeft.rot=-gun.rot;claw.x=e.x-22*k;claw.y=e.y+44*k;clawRight.x=e.x+22*k;clawRight.y=e.y+44*k;warning.x=e.x+55*k;warning.y=e.y+50*k;warning.alpha=e.charging?.8:0;lid.x=e.x;lid.y=e.y-35*k;battery.x=e.x;battery.y=e.y;if(e.data.cargoOpen){opened=Math.min(1,opened+g.dt*2);lid.rot=-opened*1.05;lid.sy=k*(1-opened*.55);battery.alpha=0;}yield;}gun.dead=lid.dead=battery.dead=true;})());
  yield* g.wait(e.data.delay??8);e.charging=true;e.data.wasCharging=true;e.data.chargeLive=true;g.fx.charge(e.x+55*k,e.y+55*k*k,36,5,[1.5,.7,.2]);yield* g.wait(5);
  if(e.charging){const n=Math.round(3/g.difficulty.count);if(g.bulletCount()+Math.max(1,Math.round(n*g.difficulty.count))*2<=60){for(const side of [-1,1])g.fan(e.x+side*55*k,e.y+55*k*k,g.aim(e.x+side*55*k,e.y+55*k*k),n,.3,155,{shape:'crystal',color:'amber'});}e.charging=false;e.data.chargeLive=false;}else{e.data.cargoOpen=true;}
  if(e.data.splashLesson){yield* g.wait(1.5);e.data.cargoOpen=true;g.ring(e.x,e.y+45*k,Math.round(6/g.difficulty.count),95,{shape:'orb',color:'magenta',life:8});}
  yield* g.wait(5);e.data.cargoOpen=true;yield* g.wait(5);yield* e.moveTo(920,e.y-100,4);g.remove(e);
 },onDeath(e,g){e.data.releasedBattery=g.scene('sky_rock',e.x,e.y);}};
export const LiftingArm:EnemyDef={name:'浮石吊臂',sprite:'e_mountainape',hp:140,score:1500,armor:.8,
 onHit(e,g){if(e.data.fodderDriver)(g as import('../game/world').World).fodder?.bubble('老耿','03',e);},
 *ai(e,g){e.stop();if(e.data.delay)yield* g.wait(e.data.delay);const warning=g.scene('story_warning',e.data.targetX??450,750);warning.sx=1.3;warning.sy=.4;if(e.data.fodderDriver){const f=(g as import('../game/world').World).fodder!;f.actors.push({name:'老耿',e,state:'driver',at:g.real,next:0,count:0});f.bubble('老耿','01',e);f.record('老耿','armWarning');g.sfx('warning',{vol:.5,pitch:1.4});g.fx.burst(e.x,e.y+120,12,50,[.6,.45,.25]);}yield* g.wait(1.2);warning.dead=true;yield* e.moveTo(e.data.targetX??450,750,2);yield* g.wait(1.5);yield* e.moveTo(e.data.homeX??e.x,380,2);g.remove(e);}};

/** 云哨：躲在浮石后的弩手。露头 1.6 秒：红眼亮、瞄准线 1 秒后发一支快弹，再缩回浮石（缩回时无敌）并换到另一块石头。data.atShip=true 瞄船。 */
export const RouteScout:EnemyDef={name:'云哨',sprite:'e_turret',hp:40,score:600,noCollide:true,
 *ai(e,g){const d=e.data,ship=(g as World).escort,home=e.x;
  const rock=g.scene('sky_rock',e.x,e.y+10);rock.layer='ground';rock.sx=rock.sy=.55;rock.owner=e;
  const hide=(on:boolean)=>{e.invulnerable=on;e.alpha=on?0:1;};
  hide(true);yield* g.wait(d.delay??.6);
  for(let round=0;round<3;round++){
   hide(false);g.fx.burst(e.x,e.y,6,35,[.8,.8,.8]);
   const t=d.atShip&&ship&&!ship.protected?ship.scene:g.player,a=Math.atan2(t.y-e.y,t.x-e.x);e.angle=a-PI/2;
   g.laser(e.x,e.y,a,{warn:1,duration:.02,length:Math.hypot(t.x-e.x,t.y-e.y),width:2,color:'amber'});g.fx.charge(e.x,e.y,20,1,[1.5,.7,.2]);
   yield* g.wait(1);g.shoot(e.x,e.y,a,200,{shape:'crystal',color:'amber'});yield* g.wait(.6);
   hide(true);g.fx.burst(e.x,e.y,6,35,[.8,.8,.8]);yield* g.wait(1.4);
   const nx=Math.max(110,Math.min(790,home+(round%2?-1:1)*140));e.x=nx;rock.x=nx;
  }
  rock.dead=true;g.remove(e);}};

/** 盾筝：编队前的方形大筝。盾面上时只有青（贯穿）能正常打伤；其余颜色伤害 ×0.4；每 4 秒给 250 范围内的蜂机加 3 秒半伤护盾；血量降到一半盾碎，狂暴直撞玩家。 */
export const RouteShield:EnemyDef={name:'盾筝',sprite:'e_kite',hp:70,score:900,
 onHit(e,_g,_x,_y,source){if(!e.data.broken)e.data.damageBonus=source==='blue'?1:.4;},
 *ai(e,g){const d=e.data,x0=d.tx??450;e.scaleX=e.scaleY=1.25;e.tint=[1.2,.95,.7];e.data.damageBonus=.4;
  yield* e.moveTo(x0,d.ty??330,2);let next=1.5,t=0;
  while(e.hp>e.maxHp*.5&&t<16){t+=g.dt;next-=g.dt;e.x=x0+Math.sin(e.age*.8)*70;
   if(next<=0){next=4;g.fx.shockwave(e.x,e.y,120,1,.5);for(const a of g.liveEnemies())if(a!==e&&a.def===RouteHornet&&Math.hypot(a.x-e.x,a.y-e.y)<250&&!a.data.shielded){a.data.shielded=true;a.data.damageBonus=.5;a.tint=[1.3,1.1,.7];g.fork((function*(){yield* g.wait(3);a.data.damageBonus=1;a.tint=[1,1,1];a.data.shielded=false;})());}}
   yield;}
  e.data.damageBonus=1;
  if(e.hp>e.maxHp*.5){e.vy=-120;yield* g.wait(3);g.remove(e);return;}
  // 盾碎：变红，直撞玩家一次
  e.data.broken=true;e.tint=[1.5,.7,.6];g.fx.burst(e.x,e.y,14,80,[1.4,.9,.5]);e.vel(0,0);yield* g.wait(.5);
  const a=g.aim(e.x,e.y);e.vel(a,260);yield* g.wait(2.6);e.vy=-160;yield* g.wait(2);g.remove(e);}};

/** 巡检机：绕船盘旋一圈后拉线（1.2 秒）飞贴船，贴上催缴符，6 秒后扣船 8 点耐久；打死巡检机符立刻揭掉。半血放信号烟，叫来 2 架蜂机。 */
export const RouteInspector:EnemyDef={name:'巡检机',sprite:'e_rotor',hp:60,score:1200,
 *ai(e,g){const ship=(g as World).escort;e.tint=[.85,1,1];
  if(!ship){yield* g.wait(1);g.remove(e);return;}
  let called=false;
  e.run((function*(){while(e.hp>e.maxHp*.5)yield;if(called)return;called=true;g.fx.burst(e.x,e.y,12,60,[1.4,1.1,.6]);for(let i=0;i<2;i++)g.spawn(RouteHornet,i?960:-60,150,b=>{b.data.contentRole='normal';b.data.patrol=true;b.data.tx=i?640:260;b.data.ty=210;b.data.delay=i*.5;});})());
  const R=230;let ang=e.x<450?PI:0,sweep=0;
  // 绕船一圈
  while(sweep<PI*2){const cx=ship.scene.x,cy=Math.min(ship.scene.y-130,760);ang+=.8*g.dt;sweep+=.8*g.dt;e.x+=(cx+Math.cos(ang)*R-e.x)*Math.min(1,g.dt*4);e.y+=(cy+Math.sin(ang)*R*.6-e.y)*Math.min(1,g.dt*4);yield;}
  // 拉线 1.2 秒，然后贴符
  const lx=ship.scene.x,ly=ship.scene.y-40;g.laser(e.x,e.y,Math.atan2(ly-e.y,lx-e.x),{warn:1.2,duration:.02,length:Math.hypot(lx-e.x,ly-e.y),width:3,color:'gold'});g.fx.charge(e.x,e.y,28,1.2,[1.5,.9,.3]);yield* g.wait(1.2);
  while(Math.hypot(ship.scene.x-e.x,ship.scene.y-80-e.y)>30){const a=Math.atan2(ship.scene.y-80-e.y,ship.scene.x-e.x);e.x+=Math.cos(a)*320*g.dt;e.y+=Math.sin(a)*320*g.dt;yield;}
  const mark=g.scene('story_warning',ship.scene.x,ship.scene.y-30);mark.layer='air';mark.sx=mark.sy=.5;mark.owner=e;
  let left=6;while(left>0){left-=g.dt;e.x=ship.scene.x+Math.sin(e.age*3)*20;e.y=ship.scene.y-120;mark.x=ship.scene.x;mark.y=ship.scene.y-30;mark.alpha=.5+.5*Math.sin(e.age*(6+(6-left)*3));yield;}
  mark.dead=true;ship.hit(8);g.fx.explosion(ship.scene.x,ship.scene.y-30,'s');e.vy=-200;yield* g.wait(3);g.remove(e);}};
