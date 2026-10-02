// 按剧情编队复用十二个家族；新增的护船动作仍走真实弹体、激光与碰撞。
import type { Enemy,EnemyDef } from '../game/enemy';
import type { Co } from '../game/api';
import type { World } from '../game/world';
import { STAGE2_ENEMIES } from './stage2_enemies';
import { storyFrame } from '../art/ch2_story_assets';
const PI=Math.PI;
const BUBBLE_KEY={lantern:'灯笼',junk:'帆船',rotor:'旋翼',lampboat:'灯船',paperray:'纸鳐',taxcrab:'税蟹',mirrorfish:'镜鱼',netspider:'网蛛',tideshuttle:'潮梭',belleel:'铃鳗',moth:'蛾',umbrellaguest:'伞客'} as const;
const WIRED=new Set(['lantern','junk','taxcrab']);
/** 出场（01，灯笼、税蟹、帆船已在各自动作里调用）与被击落（02）的气泡。 */
export function chapterEnemy(kind:keyof typeof STAGE2_ENEMIES,part:number):EnemyDef {
 const def=build(kind,part),name=BUBBLE_KEY[kind],ai=def.ai,death=def.onDeath;
 return {...def,*ai(e,g):Co{if(!WIRED.has(kind))(g as World).chapter2?.bubble(e,name);if(ai)yield* ai(e,g);},onDeath(e,g){death?.(e,g);(g as World).chapter2?.bubble(e,name,'02');}};
}
function build(kind:keyof typeof STAGE2_ENEMIES,part:number):EnemyDef {
 const base=STAGE2_ENEMIES[kind];
 if(kind==='junk')return {...base,ground:false,*ai(e,g):Co{const c=(g as World).chapter2!;e.data.weakWeapon='red';e.vy=20;c.bubble(e,'帆船');for(;;){const p=c.fleet.scene,a=Math.atan2(p.y-e.y,p.x-e.x);e.data.artAttackAt=e.age;e.data.artAttackDelay=1;c.short(4);g.laser(e.x,e.y,a,{warn:1/g.difficulty.warn,duration:.5,width:7,color:'cyan',follow:e});yield* c.wait(3.6/g.difficulty.aggression);}}};
 if(kind==='mirrorfish'&&part===6)return {...base,*ai(e,g):Co{const c=(g as World).chapter2!;e.data.weakWeapon='blue';e.data.c2Charge=5;for(;;){const p=c.fleet.scene,dy=p.y-80-e.y;e.vy=dy>0?135:-135;e.vx=Math.max(-60,Math.min(60,(p.x-e.x)*.3));if(Math.abs(dy)<25){e.data.c2RamHit=true;c.fleet.hit(5);g.fx.explosion(e.x,e.y,'s');g.remove(e);return;}const a=Math.atan2(p.y-e.y,p.x-e.x);g.laser(e.x,e.y,a,{warn:1.1,duration:.35,width:6,color:'cyan',follow:e});yield* c.wait(3.5/g.difficulty.aggression);}}};
 if(kind==='tideshuttle'&&(part===2||part===3||part===6||part===7))return {...base,*ai(e,g):Co{const c=(g as World).chapter2!;e.data.c2Charge=6;e.vy=135;yield* c.wait(1.1);const p=c.fleet.scene,a=Math.atan2(p.y-e.y,p.x-e.x);e.data.artAttackAt=e.age;e.data.artAttackDelay=.9;g.laser(e.x,e.y,a,{warn:.9,duration:.05,width:4,color:'cyan',follow:e});e.stop();yield* c.wait(.95);e.vel(a,330);yield* c.wait(2.5);g.remove(e);}};
 if(kind==='belleel')return {...base,*ai(e,g):Co{const c=(g as World).chapter2!,x=e.x,at=g.real;let shot=g.real+3;for(;;){if(g.real-at<20){e.x=x+Math.sin((g.real-at)*.8)*50;e.y=270+Math.sin((g.real-at)*.6+x)*120;}else e.vy=65;if(g.real>=shot){e.data.artAttackAt=e.age;g.fx.charge(e.x,e.y,48,1,[.3,1.3,1.6]);yield* c.wait(1);for(const ally of g.liveEnemies().filter(a=>a.def.sprite==='e_belleel'))g.shoot(ally.x,ally.y,g.aim(ally.x,ally.y),210,{shape:'crystal',color:'cyan'});shot=g.real+3/g.difficulty.aggression;}yield;}}};
 if(kind==='moth')return {...base,*ai(e,g):Co{const c=(g as World).chapter2!;e.vy=80;let shot=g.real+2;for(;;){const pts=g.brush.active?g.brush.pts:g.brush.lastStroke?.pts;const tx=pts?.length?pts[pts.length-2]:e.data.entryX;e.vx=Math.max(-85,Math.min(85,(tx-e.x)*.7));if(g.real>=shot){const p=g.player;const b=g.shoot(e.x,e.y,Math.atan2(p.y-e.y,p.x-e.x),210,{shape:'needle',color:'cyan'});b.data.c2Moth=1;shot=g.real+3/g.difficulty.aggression;}yield;}}};
 if(kind==='lantern'&&part===1)return {...base,*ai(e,g):Co{const c=(g as World).chapter2!;e.stop();e.data.launched=false;yield* c.wait(.8);e.data.launched=true;c.short(1);c.bubble(e,'灯笼');e.vy=100;yield* base.ai!(e,g);}};
 return base;
}
export const GateTower:EnemyDef={name:'浮空闸楼炮',sprite:'c2_gate-tower',hp:1000,score:1200,noCollide:true,radius:125,
 onHit(e,_g,x,y,source){if(e.charging&&['red','blue','purple','ink'].includes(source)&&Math.hypot(x-e.x,y-e.y-95)<75){e.interrupt(.4);e.data.interrupted=true;}},
 *ai(e,g):Co{const c=(g as World).chapter2!;e.data.manualFrame=true;e.stop();for(;;){e.charging=true;e.data.interrupted=false;c.short(7);const at=g.real;while(g.real-at<4){e.frame=storyFrame('gate-tower',e.charging?'charging':'intact',g.real);yield;}if(e.charging){const p=c.fleet.scene,a=Math.atan2(p.y-e.y,p.x-e.x);for(let i=0;i<3;i++){const b=g.shoot(e.x,e.y+95,a,190,{shape:'crystal',color:'amber'});b.data.c2ShipDamage=3;yield* c.wait(.15);}}e.charging=false;yield* c.wait(2);}},
 onDeath(e,g){const c=(g as World).chapter2!,s=g.scene('c2_gate-tower',e.x,e.y);e.data.wreck=s;s.layer='ground';s.frame=8;s.fps=0;c.short(8);},
};
export function noSupplement(e:Enemy){e.data.contentRole='normal';e.data.noSupplementFire=true;}
