import { normal, speed } from './ordinary';
import type { Co, G } from '../game/api';
import type { Enemy, EnemyDef } from '../game/enemy';
import type { World } from '../game/world';
import type { RouteState } from './stage1_events';

export interface LowPass {
 start:number; scroll:number; stop?:number;
 wrecks:{x:number;y:number}[];
}
export function enterLowPass(g:G,s:RouteState,dive=false):void {
 if(s.low)return;
 s.low={start:g.t-(dive?0:2),scroll:(g as World).scroll,wrecks:[]};
 g.bg(8,dive?0:1);if(dive)g.bg(8,1,2);
}
const groundScroll=(w:World,s:LowPass)=>Math.min(w.scroll,s.stop??Infinity)-s.scroll;

/** 景物和残骸都按同一卷轴定位；只提交已烘焙的精灵。 */
export function drawLowPass(w:World):boolean {
 const low=(w.sceneState as RouteState|null)?.low;if(!low)return false;
 const r=w.r,scroll=groundScroll(w,low),reveal=Math.min(1,Math.max(0,(w.t-low.start)/2));
 const shift=(1-reveal)*190;
 for(let row=Math.floor((scroll-1710)/1020);row<=Math.ceil((scroll+510)/1020);row++){
  const y=scroll-row*1020;
  r.ground.add('sky_low-terrace-left',{x:110-shift,y,sx:1,sy:1.002,alpha:reveal});
  r.ground.add('sky_low-terrace-right',{x:790+shift,y,sx:1,sy:1.002,alpha:reveal});
  r.ground.add('sky_low-roof-a',{x:78-shift,y:y-285,alpha:reveal});
  r.ground.add('sky_low-roof-b',{x:822+shift,y:y+165,alpha:reveal});
 }
 low.wrecks=low.wrecks.filter(p=>p.y+scroll<1320);
 for(const p of low.wrecks)r.ground.add('low_wreck',{x:p.x,y:p.y+scroll});
 return true;
}
function wreck(e:Enemy,g:G):void {
 const w=g as World,s=(w.sceneState as RouteState).low;
 if(s)s.wrecks.push({x:e.x,y:e.y-groundScroll(w,s)});
 g.drop('medal',e.x,e.y);
}
function prepare(e:Enemy):void {
 e.data.noSupplementFire=true;e.data.lowGround=true;e.stop();
}
function* visible(e:Enemy):Co {while(e.y<65)yield;}
function* aimWarning(e:Enemy,g:G,seconds:number):Generator<unknown,number> {
 const a=Math.atan2(g.player.y-e.y,g.player.x-e.x);
 const line=g.laser(e.x,e.y,a,{warn:seconds/g.difficulty.warn,duration:0,follow:e,length:1200,width:2,color:'magenta'});
 // 预告线跟随炮座滚动，方向在上弦时锁定。
 yield* g.wait(seconds);
 line.kill();return a;
}
export const LowCannon:EnemyDef={normalHp:[72,'M'],
 name:'铜炮台',sprite:'low_cannon-base',hp:90,score:700,ground:true,onDeath:wreck,
 *ai(e,g){prepare(e);
  const barrel=g.attach(e,{sprite:'low_cannon-barrel',hp:1,score:0,ground:true,decorative:true,drawOrder:1},[0,-7.8],{followRot:false});barrel.data.lowGround=true;
  e.run((function*():Co{for(;;){barrel.angle=(normal(g)&&e.charging?e.data.lockedAngle:Math.atan2(g.player.y-e.y,g.player.x-e.x))+Math.PI/2;yield;}})());
  yield* visible(e);yield* g.wait(normal(g)?.2:.65);
  while(e.y<1120){
   const locked=Math.atan2(g.player.y-e.y,g.player.x-e.x);e.data.lockedAngle=locked;e.charging=true;g.fx.charge(e.x,e.y,22,.6,[1.2,.25,.55]);yield* g.wait(.6);
   if(e.charging){const a=normal(g)?locked:Math.atan2(g.player.y-e.y,g.player.x-e.x);
    if(normal(g)){barrel.offY=2;e.run((function*():Co{yield* g.wait(.15);barrel.offY=-7.8;})());}
    for(const offset of [-.18,0,.18])g.shoot(e.x+Math.cos(a)*37,e.y+Math.sin(a)*37,a+offset,speed(g,normal(g)?100:145),{shape:'orb',color:'magenta',size:9});}
   e.charging=false;yield* g.wait(normal(g)?2.2:2.4);
  }
 }
};
export const LowBallista:EnemyDef={normalHp:[52,'M'],
 name:'弩车',sprite:'low_ballista',hp:65,score:550,ground:true,onDeath:wreck,
 *ai(e,g){prepare(e);yield* visible(e);
  while(e.y<1080){e.frame=0;e.charging=true;const a=yield* aimWarning(e,g,1);
   if(e.charging){e.frame=1;g.shoot(e.x,e.y,a,speed(g,normal(g)?260:420),{shape:'needle',color:'magenta',size:11});}
   e.charging=false;yield* g.wait(normal(g)?2:2.2);
  }
 }
};
export const LowEaveGunner:EnemyDef={normalHp:[40,'M'],
 name:'檐角弩手',sprite:'low_eave-gunner',hp:50,score:450,ground:true,onDeath:wreck,
 *ai(e,g){prepare(e);e.invulnerable=true;e.frame=0;
  const roof=g.scene('sky_low-roof-a',e.x,e.y-35),w=g as World,offset=e.y-w.scroll;
  roof.sx=roof.sy=.65;
  w.root.run((function*():Co{while(roof.y<1340){roof.y=offset+w.scroll-35;yield;}roof.dead=true;})());
  yield* visible(e);yield* g.wait(normal(g)?.3:.5);
  while(e.y<1100){
   e.invulnerable=false;e.frame=1;e.charging=true;
   const a=yield* aimWarning(e,g,normal(g)?.8:1);
   if(e.charging)g.shoot(e.x,e.y,a,speed(g,normal(g)?240:270),{shape:'needle',color:'magenta',size:9});
   yield* g.wait(normal(g)?.8:.6);e.charging=false;e.invulnerable=true;e.frame=0;yield* g.wait(1.4);
  }
 }
};
export const lowTarget=(def:EnemyDef,side:-1|1)=>(g:G)=>g.spawn(def,side<0?112:788,-55,e=>{
 e.data.contentRole='normal';e.data.lowGround=true;e.data.noSupplementFire=true;
});
