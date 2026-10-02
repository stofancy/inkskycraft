import type { Co, G } from '../game/api';
import type { Enemy, EnemyDef } from '../game/enemy';
export const PI=Math.PI;
export const clamp=(v:number)=>Math.max(80,Math.min(820,v));
export function aim(e:Enemy,g:G):number{const old=e.data.oldX??g.player.x;const x=old+(g.player.x-old)*(1+g.difficulty.intelligence);e.data.oldX=g.player.x;return Math.atan2(g.player.y-e.y,clamp(x)-e.x);}
export function* leave(e:Enemy,g:G):Co{yield* g.wait(.7);e.vel(-PI/2,180);}
export function ordinary(name:string,sprite:string,hp:number,ai:(e:Enemy,g:G)=>Co):EnemyDef{return{name,sprite,hp,score:hp*25,drops:hp>=60?'ink':undefined,ai};}
export const Hornet=ordinary('hornet','e_hornet',16,function*(e,g){e.data.weakWeapon='red';e.vel(PI/2,220);yield* g.wait(.9);g.shoot(e.x,e.y,aim(e,g),180,{color:'cyan',shape:'rice'});yield* g.wait(1/g.difficulty.aggression);e.vel(PI/2+(e.x<450?-.6:.6),280);});
export const Kite=ordinary('kite','e_kite',70,function*(e,g){e.data.weakWeapon='purple';yield* e.moveTo(e.x,260,1.2);for(let k=0;k<3;k++){g.ring(e.x,e.y,5,75,{color:'magenta',shape:'petal'});yield* e.moveBy(k%2?140:-140,40,1.8/g.difficulty.aggression);}yield* leave(e,g);});
export const Drum=ordinary('drum','e_drum',65,function*(e,g){e.data.weakWeapon='purple';yield* e.moveTo(e.x,220,1.2);for(let k=0;k<3;k++){g.fx.charge(e.x,e.y,35,.9,[1,.5,1]);yield* g.wait(.9);for(const n of g.liveEnemies().filter(n=>n.data.contentRole==='normal'&&n!==e).slice(0,Math.round(g.difficulty.intelligence*4)))g.shoot(n.x,n.y,aim(n,g),150,{color:'cyan',shape:'rice'});g.ring(e.x,e.y,6,100,{color:'magenta',shape:'orb'});yield* g.wait(1.4/g.difficulty.aggression);}yield* leave(e,g);});
export const Lancer=ordinary('lancer','e_lancer',20,function*(e,g){e.data.weakWeapon='red';yield* e.moveTo(e.x,190,1);const a=aim(e,g);g.fx.charge(e.x,e.y,24,1,[.2,1,1]);yield* g.wait(1);e.vel(a,480);});
const Gun:EnemyDef={sprite:'s3_node',hp:35,score:300,noCollide:true};
export const Wingfort=ordinary('wingfort','e_wingfort',200,function*(e,g){yield* e.moveTo(e.x,210,2);const guns=[-65,65].map(x=>g.attach(e,Gun,[x,65]));for(const n of guns){n.data.weakWeapon='red';n.data.contentRole='part';n.data.linkTo=e.id;}for(let k=0;k<4;k++){for(const n of guns.filter(n=>!n.dead))g.laser(n.x,n.y,PI/2,{warn:1,duration:.5,width:7,color:'amber',follow:n});yield* g.wait(2/g.difficulty.aggression);}yield* leave(e,g);});
export function* strike(g:G,x:number,warn=1,width=18):Co{g.laser(x,0,PI/2,{warn,duration:.25,width,color:'cyan'});yield* g.wait(warn);g.bgFlash(.6);g.sfx('thunder');}
export function* thunderLoop(g:G,running:()=>boolean,gap=4):Co{while(running()){yield* g.wait(gap/g.difficulty.aggression);if(running())yield* strike(g,clamp(g.player.x+160));}}
