import type { Co } from '../game/api';
import type { EnemyDef } from '../game/enemy';
import { ordinary, leave, PI, clamp } from './stage3_enemies';
import { charge, visible } from './ordinary';
import { lockLine } from './stage3_scene';

export const ThunderRay=ordinary('thunderray','e_thunderray',90,function*(e,g){
 e.data.weakWeapon='blue';e.vel(PI/2,190);yield* visible(e,g);e.stop();
 e.run(e.moveTo(e.x,270,.8));e.charging=true;e.data.bodyPhase='蓄雷';
 g.laser(e.x,e.y,PI/2,{warn:1/g.difficulty.warn,duration:.4,width:8,color:'cyan',follow:e});
 yield* g.wait(1.4);e.charging=false;e.data.bodyPhase='露背';e.data.weakLabel='收雷露背，趁现在打';
 yield* g.wait(2);yield* leave(e,g);
});
const End:EnemyDef={sprite:'c3_web-end',hp:18,normalHp:[18,'L'],noCollide:true,score:150};
export const CloudSpider=ordinary('cloudspider','e_cloudspider',80,function*(e,g){
 e.data.weakWeapon='purple';e.vel(PI/2,190);yield* visible(e,g);e.stop();
 const ns=[-90,90].map(x=>g.attach(e,End,[x,45]));
 ns.forEach(n=>{n.data.weakWeapon='purple';n.data.linkTo=e.id;n.data.contentRole='part';});
 e.run(e.moveTo(e.x,390,.8));
 const web=g.laser(ns[0].x,ns[0].y,0,{length:180,warn:1/g.difficulty.warn,duration:1,width:7,color:'magenta',follow:ns[0]});
 try {for(let t=0;t<2;t+=g.dt){if(ns.some(n=>n.dead)){web.kill();break;}yield;}}
 finally {web.kill();}
 yield* leave(e,g);
});
export const WhaleCalf=ordinary('whalecalf','e_whalecalf',95,function*(e,g){
 e.data.weakWeapon='blue';e.vel(PI/2,190);yield* visible(e,g);e.stop();e.run(e.moveTo(e.x,270,.8));
 yield* g.wait(.2);const target={...g.aimTarget(e.x,e.y)};e.data.bodyPhase='吸气';
 yield* charge(e,g,.8);e.charging=false;e.data.bodyPhase='吐';
 g.shoot(e.x,e.y+25,Math.atan2(target.y-e.y-25,target.x-e.x),120,{color:'cyan',shape:'big'});
 yield* g.wait(1.9);yield* leave(e,g);
});
export const JadeShuttle=ordinary('jadeshuttle','e_jadeshuttle',18,function*(e,g){
 e.vel(PI/2,190);yield* visible(e,g);e.stop();
 const origin={x:e.x,y:180},target=g.aimTarget(e.x,e.y),locked={x:clamp(target.x),y:Math.min(920,target.y)};
 e.run(e.moveTo(origin.x,origin.y,.6));yield* lockLine(e,g,locked,.9);
 yield* e.moveTo(locked.x,locked.y,.5,'linear');
 yield* lockLine(e,g,origin,.8);yield* e.moveTo(origin.x,origin.y,.5,'linear');e.vel(-PI/2,210);
});
export const STAGE3_EXTRA=[ThunderRay,CloudSpider,WhaleCalf,JadeShuttle];

export const LightningPillar:EnemyDef={name:'引雷柱',sprite:'s3_pillar',hp:60,normalHp:[60,'F'],noCollide:true,score:400,drops:'ink',*ai(e,g):Co{
 e.hp=e.maxHp=60;e.data.contentRole='prop';e.data.weakWeapon='blue';e.data.weakLabel='靠近亮线后撤开，引雷击鼓';
 while(!e.dead){
  yield* g.until(()=>Math.hypot(g.player.x-e.x,g.player.y-e.y)<180);
  e.charging=true;
  // 光束锚在柱身向上打；摧毁柱子时引擎同步撤销预告及雷束。
  const bolt=g.laser(e.x,e.y,-PI/2,{warn:1/g.difficulty.warn,duration:.25,width:18,color:'cyan',follow:e});
  try {
   yield* g.wait(1);if(e.dead)return;e.charging=false;g.bgFlash(.3);g.sfx('thunder');
   for(const n of g.liveEnemies())if((n.def.sprite==='e_drum'||n.data.bodyPhase==='fin')&&n.y<e.y&&Math.abs(n.x-e.x)<n.radius*Math.abs(n.scaleX)+18)g.damage(n,180,n.x,n.y,false,'ink');
   yield* g.wait(.25);
  } finally {bolt.kill();e.charging=false;}
  yield* g.wait(2);
 }
}};
