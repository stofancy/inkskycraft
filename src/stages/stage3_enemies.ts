import type { Co, G } from '../game/api';
import type { Enemy, EnemyDef } from '../game/enemy';
import { visible, charge } from './ordinary';
import { lockLine } from './stage3_scene';
export const PI=Math.PI;
export const clamp=(v:number)=>Math.max(80,Math.min(820,v));
export function aim(e:Enemy,g:G):number{const target=g.aimTarget(e.x,e.y);if(target.x!==g.player.x||target.y!==g.player.y)return Math.atan2(target.y-e.y,target.x-e.x);const old=e.data.oldX??g.player.x;const x=old+(g.player.x-old)*(1+g.difficulty.intelligence);e.data.oldX=g.player.x;return Math.atan2(g.player.y-e.y,clamp(x)-e.x);}
export function* leave(e:Enemy,g:G):Co{yield* g.wait(.7);e.vel(-PI/2,180);}
export function ordinary(name:string,sprite:string,hp:number,ai:(e:Enemy,g:G)=>Co):EnemyDef{return{name,sprite,hp,normalHp:[hp,hp<40?'L':'M'],score:hp*25,drops:hp>=60?'ink':undefined,*ai(e,g){e.data.noSupplementFire=true;yield* ai(e,g);}};}
function* enter(e:Enemy,g:G):Co {e.vel(PI/2,220);yield* visible(e,g);e.stop();}
export const Hornet:EnemyDef={face:'move',faceUp:true,...ordinary('hornet','e_hornet',16,function*(e,g){
 e.data.weakWeapon='red';yield* enter(e,g);e.vel(PI/2,160);
 yield* g.wait(.15);const target={...g.aimTarget(e.x,e.y)};
 yield* charge(e,g,.3);e.charging=false;
 g.shoot(e.x,e.y,Math.atan2(target.y-e.y,target.x-e.x),180,{color:'cyan',shape:'rice'});
 yield* g.wait(.65);e.vel(PI/2+(e.x<450?-.6:.6),280);
})};
// 资产与旧定义保留，第三章出敌表不再使用风筝。
export const Kite=ordinary('kite','e_kite',70,function*(e,g){e.data.weakWeapon='purple';yield* e.moveTo(e.x,260,1.2);for(let k=0;k<3;k++){g.ring(e.x,e.y,5,75,{color:'magenta',shape:'petal'});yield* e.moveBy(k%2?140:-140,40,1.8/g.difficulty.aggression);}yield* leave(e,g);});
export const Drum=ordinary('drum','e_drum',65,function*(e,g){
 e.data.weakWeapon='purple';e.data.weakLabel='拆雷鼓，或靠近雷柱引雷';yield* enter(e,g);
 e.run(e.moveTo(e.x,270,.8));yield* g.wait(.4);
 for(let k=0;k<2;k++){
  e.data.bodyPhase='鼓胀';yield* charge(e,g,.6);e.charging=false;
  // 七等分留正下方空瓣，逐发调用保持六发实数。
  for(let i=1;i<=6;i++)g.shoot(e.x,e.y,PI/2+i*PI*2/7,100,{color:'magenta',shape:'petal'});
  e.data.bodyPhase='收鼓';if(k===0)yield* g.wait(2.4);
 }
 yield* leave(e,g);
});
export const Lancer=ordinary('lancer','e_lancer',20,function*(e,g){
 e.data.weakWeapon='red';yield* enter(e,g);e.run(e.moveTo(e.x,170,.6));
 const target={...g.aimTarget(e.x,e.y)};yield* lockLine(e,g,target,.9);
 e.vel(Math.atan2(target.y-e.y,target.x-e.x),480);
});
const Gun:EnemyDef={sprite:'c3_gun',hp:35,normalHp:[35,'M'],score:300,noCollide:true};
export const Wingfort=ordinary('wingfort','e_wingfort',200,function*(e,g){
 yield* enter(e,g);
 const guns=['gun3','gun4'].map(anchor=>g.attach(e,Gun,anchor));
 for(const n of guns){n.data.weakWeapon='red';n.data.contentRole='part';n.data.linkTo=e.id;}
 e.run(e.moveTo(e.x,230,.9));yield* g.wait(.2);
 for(let k=0;k<4;k++){
  const n=guns[k%2];if(!n.dead){g.laser(n.x,n.y,PI/2,{warn:1/g.difficulty.warn,duration:.5,width:7,color:'cyan',follow:n});}
  yield* g.wait(1.6);
 }
 yield* leave(e,g);
});
export function* strike(g:G,x:number,warn=1,width=18):Co{g.laser(x,0,PI/2,{warn,duration:.25,width,color:'cyan'});yield* g.wait(warn);g.bgFlash(.6);g.sfx('thunder');}
export function* thunderLoop(g:G,running:()=>boolean,gap=4):Co{while(running()){yield* g.wait(gap/g.difficulty.aggression);if(running())yield* strike(g,clamp(g.player.x+160));}}
