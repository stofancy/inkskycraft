import type { Co, G } from '../game/api';
import type { Enemy, EnemyDef } from '../game/enemy';
export const PI = Math.PI;
const cadence = (g: G, seconds: number) => seconds / g.difficulty.aggression;
/** 简单追旧位，困难预测并按编队左右分摊夹击点。 */
function target(e: Enemy, g: G): number {
  const target=g.aimTarget(e.x,e.y);if(target.x!==g.player.x||target.y!==g.player.y)return Math.atan2(target.y-e.y,target.x-e.x);
  const old = e.data.oldX ?? g.player.x;
  const vx = (g.player.x - old) / Math.max(0.1, e.data.sampleTime ?? 1);
  const x = old + (g.player.x - old) * g.difficulty.intelligence + vx * 0.3 * g.difficulty.intelligence + (e.data.flank ?? 0) * 85 * g.difficulty.intelligence;
  e.data.oldX = g.player.x;
  return Math.atan2(g.player.y - e.y, Math.max(60, Math.min(840, x)) - e.x);
}
function artAttack(e:Enemy,delay=0):void {e.data.artAttackAt=e.age-(delay?0:.4);e.data.artAttackDelay=delay||.4;}
function shot(e: Enemy, g: G, shape: 'rice'|'orb'|'needle'|'crystal' = 'rice'): void {
  if (e.y > 60 && e.y < 780) {artAttack(e);g.shoot(e.x, e.y, target(e, g), 210, { shape, color: 'cyan' });}
}
export const Lantern: EnemyDef = { sprite:'e_lantern', hp:16, score:180,
  *ai(e,g): Co { e.vy=100; for (;;) { e.vx=Math.sin(e.age)*20; yield* g.wait(cadence(g,3)); if(e.y<800) {artAttack(e);g.ring(e.x,e.y,5,90,{shape:'orb',color:'amber'});} } } };
export const Junk: EnemyDef = { sprite:'e_junk', hp:84, ground:true, score:1000, drops:'ink',
  *ai(e,g): Co { e.vy=58; e.data.weakWeapon='red'; for (;;) { artAttack(e,1);g.laser(e.x,e.y,PI/2,{warn:1,duration:0.5,width:7,color:'cyan',follow:e}); yield* g.wait(cadence(g,3.6)); } } };
export const Rotor: EnemyDef = { sprite:'e_rotor', hp:18, score:200, anim:16,
  *ai(e,g): Co { const x=e.x; e.vy=185; let next=1.2; for (;;) { e.x=x+Math.sin(e.age*1.6)*(e.data.amp??85); if(e.age>next){shot(e,g);next+=cadence(g,2.5);} yield; } } };
export const Moth: EnemyDef = {sprite:'e_moth',hp:18,score:220,anim:9,
  *ai(e,g): Co {e.vy=145;let cd=2;for(;;){const p=g.brush.pts; const tx=g.brush.active&&p.length>1?p[p.length-2]:e.data.entryX; e.vx=Math.max(-85,Math.min(85,(tx-e.x)*0.7));cd-=g.dt;if(cd<0){shot(e,g,'needle');cd=cadence(g,3);}yield;}}};
export const LampBoat: EnemyDef = {sprite:'e_lampboat',hp:72,score:900,drops:'ink',
  *ai(e,g): Co {e.vy=120;e.data.weakWeapon='purple';for(;;){yield* g.wait(cadence(g,2.9));if(e.y<750){artAttack(e);g.fan(e.x,e.y,PI/2,3,0.8,135,{shape:'orb',color:'amber'});}}},
  onDeath(e,g){g.clearBullets();g.fx.shockwave(e.x,e.y,100,2,0.4);}};
export const PaperRay: EnemyDef = {sprite:'e_paperray',hp:16,score:210,
  *ai(e,g): Co {e.vy=175;e.vx=(e.data.flank??1)*40;for(;;){yield* g.wait(cadence(g,2.1));if(e.y<800){artAttack(e);g.fan(e.x,e.y,PI/2,3,1.15,160,{shape:'rice',color:'cyan'});}}}};
export const TaxCrab: EnemyDef = {sprite:'e_taxcrab',hp:78,score:950,ground:true,
  *ai(e,g): Co {e.vy=70;e.data.weakWeapon='red';for(;;){e.vx=(e.x<450?1:-1)*60;yield* g.wait(1.1);e.vx=0;artAttack(e,1);g.laser(e.x,e.y,PI/2+(e.x<450?-0.23:0.23),{warn:1,duration:0.5,width:8,color:'red',follow:e});yield* g.wait(cadence(g,2.5));}}};
export const MirrorFish: EnemyDef = {sprite:'e_mirrorfish',hp:22,score:300,
  *ai(e,g): Co {e.vy=135;e.data.weakWeapon='blue';for(;;){const a=target(e,g);artAttack(e,1.1);g.laser(e.x,e.y,a,{warn:1.1,duration:0.35,width:6,color:'cyan',follow:e});yield* g.wait(cadence(g,3.5));e.vx=-e.vx+(e.x<450?35:-35);}}};
export const NetSpider: EnemyDef = {sprite:'e_netspider',hp:20,score:350,
  *ai(e,g): Co {e.vy=125;e.data.weakWeapon='purple';for(;;){yield* g.wait(cadence(g,2.5));const side=e.x<450?1:-1;artAttack(e,1.1);g.laser(e.x,e.y,side>0?0:PI,{warn:1.1,duration:0.45,length:210,width:6,color:'violet',follow:e});}}};
export const TideShuttle: EnemyDef = {sprite:'e_tideshuttle',hp:14,score:240,
  *ai(e,g): Co {e.vy=135;yield* g.wait(1.1);const a=target(e,g);artAttack(e,.9);g.laser(e.x,e.y,a,{warn:0.9,duration:0.05,width:4,color:'cyan',follow:e});e.stop();yield* g.wait(0.95);e.vel(a,330);yield* g.wait(1.4);e.vy=-140;e.vx*=0.4;yield* g.wait(0.8);e.vy=230;}};
export const BellEel: EnemyDef = {sprite:'e_belleel',hp:20,score:320,
  *ai(e,g): Co {e.vy=165;for(;;){yield* g.wait(cadence(g,3));artAttack(e,1);g.fx.charge(e.x,e.y,48,1,[0.3,1.3,1.6]);yield* g.wait(1);shot(e,g,'crystal');if(g.difficulty.intelligence>0.3){for(const ally of g.liveEnemies().filter(a=>a!==e&&a.data.contentRole==='normal'&&Math.abs(a.y-e.y)<90).slice(0,2))shot(ally,g);}}}};
export const Umbrella: EnemyDef = {sprite:'e_umbrellaguest',hp:76,score:850,
  *ai(e,g): Co {e.vy=100;for(;;){e.data.bodyPhase='伞开';if(e.data.artClosedAt!==undefined)e.data.artOpenedAt=e.age;e.data.weakWeapon='blue';g.fan(e.x,e.y,PI/2,3,1.1,95,{shape:'orb',color:'violet'});yield* g.wait(cadence(g,2.5));e.scaleX=0.55;e.data.bodyPhase='伞合';e.data.artClosedAt=e.age;shot(e,g,'needle');yield* g.wait(2);e.scaleX=1;}}};
export const STAGE2_ENEMIES = {lantern:Lantern,junk:Junk,rotor:Rotor,moth:Moth,lampboat:LampBoat,paperray:PaperRay,taxcrab:TaxCrab,mirrorfish:MirrorFish,netspider:NetSpider,tideshuttle:TideShuttle,belleel:BellEel,umbrellaguest:Umbrella};
