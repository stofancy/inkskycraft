import { volley } from './stage1_rhythm';
// 第一章大场面主体：空中堡垒。本体是场景图，4 座炮塔与 2 条钳臂是独立敌机；两条钳臂都断后开舱，雷石落下。
// 分件坐标取自 local-source/layout.png，本体 1080x540 按 0.5 显示，下列偏移相对本体中心。
import type { Co,G } from '../game/api';
import type { Enemy,EnemyDef } from '../game/enemy';
import type { Scenery } from '../game/scenery';
import type { World } from '../game/world';
import { normal } from './ordinary';
import { closeBurst } from './stage1_air_enemies';

/** 暂定数值（普通难度）。 */
export const FORTRESS={arriveAt:9,restY:330,driftX:90,driftPeriod:18,turretHp:90,clampHp:150,clampSlam:{first:5,gap:7,warn:1.3,hold:.8},fire:{inner:3.4,outer:4.2,charge:1.1},leaveAfterOpen:3};

const TURRETS=[{ox:-100.5,oy:-28.5,kind:'inner',phase:0},{ox:100,oy:-28.5,kind:'inner',phase:1.7},{ox:-143,oy:12.5,kind:'outer',phase:.8},{ox:143.5,oy:12.5,kind:'outer',phase:2.5}] as const;
const CLAMPS=[{ox:-35,oy:15.5,side:-1},{ox:35,oy:15.5,side:1}] as const;

export interface Fortress{x:number;y:number;open:boolean;gone:boolean;openX:number;openY:number}

const FortressTurret:EnemyDef={name:'堡垒炮塔',sprite:'story_fortress-turret',hp:FORTRESS.turretHp,armor:.8,score:1200,noCollide:true,explosion:'l',
 onDeath(e,g){(g as World).fx.shake(.4);(g as World).hitstop(.07);g.fx.shockwave(e.x,e.y,120,.5,.5);g.sfx('explode_l',{vol:.8});}};
const FortressClamp:EnemyDef={name:'堡垒钳臂',sprite:'story_fortress-clamp',hp:FORTRESS.clampHp,armor:.7,score:2000,noCollide:true,explosion:'l',
 onDeath(e,g){(g as World).fx.shake(.5);(g as World).hitstop(.09);g.fx.shockwave(e.x,e.y,150,.6,.6);g.sfx('explode_l',{vol:.9});}};
const FortressClampR:EnemyDef={...FortressClamp,sprite:'story_fortress-clamp-mirror'};

/** 开始堡垒演出：阴影先盖住屏幕，随后本体压下、停在上三分之一并缓慢横移。返回的状态由大场面事件每帧读取。 */
export function startFortress(g:G,seconds:number):Fortress{
 const w=g as World,f:Fortress={x:450,y:-200,open:false,gone:false,openX:0,openY:0};
 const shadow=g.scene('story_fortress-shadow',450,520);shadow.layer='ground';shadow.alpha=0;
 const body=g.scene('story_fortress-body',450,f.y);body.layer='ground';
 const stone=g.scene('sky_rock',450,f.y);stone.layer='ground';stone.sx=stone.sy=.5;
 const bay=g.scene('story_fortress-bay-open',450,f.y);bay.layer='air';bay.alpha=0;
 const marks:Scenery[]=[];
 const turrets=TURRETS.map((t,i)=>{const e=g.spawn(FortressTurret,450+t.ox,f.y+t.oy,e=>{e.data.contentRole='part';e.data.noSupplementFire=true;e.hp=e.maxHp=FORTRESS.turretHp/g.difficulty.hp;e.invulnerable=true;});
  if(!normal(g))closeBurst(e,g);const ov=g.scene('story_fortress-turret-charge',e.x,e.y);ov.layer='air';ov.alpha=0;return {t,e,ov,next:normal(g)?FORTRESS.arriveAt+.9+i*.6:t.phase+FORTRESS.arriveAt+2};});
 const clamps=CLAMPS.map(c=>{const e=g.spawn(c.side<0?FortressClamp:FortressClampR,450+c.ox,f.y+c.oy,e=>{e.data.contentRole='part';e.data.noSupplementFire=true;e.data.fortressClamp=true;e.hp=e.maxHp=FORTRESS.clampHp/g.difficulty.hp;e.invulnerable=true;});
  const ring=g.scene('story_warning',e.x,e.y);ring.layer='air';ring.alpha=0;ring.sx=ring.sy=.7;marks.push(ring);return {c,e,ring,next:FORTRESS.clampSlam.first+(c.side>0?FORTRESS.clampSlam.gap/2:0)};});
 const t0=g.t;let prompted=false,openAt=-1,leaving=false;
 g.fork((function*():Co{
  while(!f.gone){
   const t=g.t-t0;
   // 阴影 0..4 秒盖上，本体 3..12 秒压下，到位后横移。
   const sh=Math.min(1,t/4);shadow.alpha=leaving?Math.max(0,shadow.alpha-g.dt*.3):sh*.75;shadow.x=f.x;shadow.y=Math.max(f.y+160,360);shadow.sx=shadow.sy=1.1+.25*sh;
   if(!leaving){
    const k=Math.min(1,Math.max(0,(t-3)/9)),ease=1-(1-k)**3;
    f.y=-200+(FORTRESS.restY+200)*ease;
    f.x=450+(k>=1?FORTRESS.driftX*Math.sin((t-12)*2*Math.PI/FORTRESS.driftPeriod):0);
   }else{f.y-=g.dt*70;if(f.y<-260)f.gone=true;}
   const here=!leaving&&t>=FORTRESS.arriveAt;
   body.x=f.x;body.y=f.y;stone.x=f.x;stone.y=f.y+32;stone.alpha=f.open?0:1;bay.x=f.x;bay.y=f.y+32;bay.alpha=f.open?1:0;
   for(const o of turrets){const e=o.e;if(e.dead){o.ov.dead=true;continue;}
    e.x=f.x+o.t.ox;e.y=f.y+o.t.oy;e.vx=e.vy=0;e.invulnerable=!here;o.ov.x=e.x;o.ov.y=e.y;
    let dt=o.next-t;const ch=normal(g)?.9:FORTRESS.fire.charge;
    if(here&&dt<ch&&!e.data.volleyReady){if(!volley(e,g,o.t.kind==='inner'?'aim':'area',o.t.kind==='inner'?5:7,ch)){o.next=t+ch;continue;}e.data.volleyReady=true;o.next=t+ch;dt=ch;}
    e.charging=here&&dt<ch&&dt>0;o.ov.alpha=e.charging?1:0;o.ov.glow=e.charging?1.2+.6*Math.sin(t*20):0;
    if(here&&dt<=0){const inner=o.t.kind==='inner',sx=e.x,sy=e.y+30;
     if(normal(g)&&g.bulletCount()<55){
      if(inner)g.fan(sx,sy,g.aim(sx,sy),Math.round(3/g.difficulty.count),.22,170/w.enemyBulletSpeed,{shape:'crystal',color:'amber',life:5});
      else for(const off of [-.6,-.3,.3,.6])g.shoot(sx,sy,Math.PI/2+off,95/w.enemyBulletSpeed,{shape:'orb',color:'magenta',life:7});
     }else if(!normal(g)&&g.bulletCount()<56){if(inner)g.fan(sx,sy,g.aim(sx,sy),3,.22,170,{shape:'crystal',color:'amber',life:5});else g.fan(sx,sy,Math.PI/2,5,.7,140,{shape:'orb',color:'magenta',life:7});}
     g.fx.burst(sx,sy,8,70,[1.5,.7,.2]);e.data.volleyReady=false;o.next=t+(inner?FORTRESS.fire.inner:FORTRESS.fire.outer);}}
   const sway=Math.sin(t*.9)*.06;
   for(const o of clamps){const e=o.e;if(e.dead){o.ring.dead=true;continue;}
    e.x=f.x+o.c.ox;e.y=f.y+o.c.oy;e.vx=e.vy=0;e.angle=o.c.side*sway;e.invulnerable=!(here&&t>=FORTRESS.arriveAt+4);
    o.ring.x=e.x;o.ring.y=e.y+30;o.ring.alpha=e.invulnerable?0:.5+.4*Math.sin(t*6);e.glow=e.invulnerable?1:1.5+.5*Math.sin(t*6);}
   // 钳臂合拢：露出弱点后每 7 秒（左右错开）从钳口放一道扫向身前的光刃，金线预警 1.3 秒。
   for(const o of clamps){const e=o.e;if(e.dead||e.invulnerable||t-FORTRESS.arriveAt<o.next)continue;if(!volley(e,g,'area',FORTRESS.clampSlam.hold,FORTRESS.clampSlam.warn*g.difficulty.warn))continue;o.next=t-FORTRESS.arriveAt+FORTRESS.clampSlam.gap;
    g.laser(e.x,e.y+30,Math.PI/2+o.c.side*.75,{warn:FORTRESS.clampSlam.warn,duration:FORTRESS.clampSlam.hold,width:12,length:600,color:'red',sweep:-o.c.side*.55,follow:e});}
   if(!prompted&&here&&t>=FORTRESS.arriveAt+4){prompted=true;g.caption('','打断钳臂',4);}
   if(!f.open&&clamps.every(o=>o.e.dead)){f.open=true;f.openX=f.x;f.openY=f.y+32;openAt=t;g.fx.flash(.35);w.fx.shake(.6);w.hitstop(.1);g.sfx('explode_boss',{vol:.8});}
   if(f.open&&!leaving&&t-openAt>FORTRESS.leaveAfterOpen)leaving=true;
   if(!f.open&&!leaving&&t>seconds)leaving=true;
   yield;
  }
  for(const o of turrets){o.e.dead||g.remove(o.e);o.ov.dead=true;}
  for(const o of clamps){o.e.dead||g.remove(o.e);o.ring.dead=true;}
  shadow.dead=body.dead=stone.dead=bay.dead=true;
 })());
 return f;
}
