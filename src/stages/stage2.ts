import type { Co, G } from '../game/api';
import type { EnemyDef } from '../game/enemy';
import type { StageDef } from './types';
import { STAGE2_ENEMIES } from './stage2_enemies';
import { waveCheckpoint } from './checkpoints';
import { Mirage, Pagoda } from './stage2_boss';
const chapters=['渡灯','拆税舟','宝塔记忆','蜃还名'];
const pools: (keyof typeof STAGE2_ENEMIES)[][] = [
 ['paperray','taxcrab','rotor','lantern'],['junk','lampboat','belleel','netspider'],
 ['mirrorfish','umbrellaguest','moth','netspider'],['tideshuttle','paperray','lampboat','belleel']];
/** 旧16波各映射四段：示范→交叉→场景互动→组合验收。每章4旧波。 */
export const STAGE2_ENCOUNTERS=chapters.flatMap((chapter,c)=>Array.from({length:16},(_,i)=>({
 chapter,oldWave:c*4+Math.floor(i/4)+1,variation:['教学','交叉','场景互动','组合验收'][i%4],bodies:i<12?24:23,
 primary:pools[c][Math.floor(i/4)],secondary:pools[c][(Math.floor(i/4)+1)%4],
})));
const Rescue:EnemyDef={sprite:'s2_rescueboat',hp:1,invulnerable:true,noCollide:true,
 *ai(e,g):Co {e.vy=95;for(;;){g.fx.ink(e.x,e.y+70,45,0.3,[0.1,0.4,0.4]);yield* g.wait(1);}}};
const Mooring:EnemyDef={sprite:'s2_node',hp:28,score:150,noCollide:true,
 *ai(e):Co {e.vy=90;e.data.weakWeapon='purple';},onDeath(e,g){g.clearBullets();g.drop('ink',e.x,e.y);}};
function* encounter(g:G,index:number):Co {
 const a=STAGE2_ENCOUNTERS[index],variant=index%4,start=g.t;
 const n=Math.round(a.bodies*(g.difficulty.quantity??g.difficulty.enemyCount));
 const side=(Math.floor(index/4)%2?1:-1);
 if(variant===2){g.spawn(Rescue,side<0?225:675,-50,e=>{e.data.contentRole='prop';});g.spawn(Mooring,side<0?650:250,100,e=>{e.data.contentRole='prop';});}
 for(let j=0;j<n;j++){
  const primary=variant===0 || (variant===1 ? j%2===0 : variant===2 ? j%3!==0 : j%3===0);
  let type=primary?a.primary:a.secondary;
  if(type==='lantern'&&j>=3)type='paperray';
  let x:number,y=-70;
  if(variant===0)x=180+(j%6)*108;
  else if(variant===1){x=j%2?760:140;y=-60-(j%3)*35;}
  else if(variant===2)x=(side<0?500:130)+(j%4)*75;
  else{x=120+(j%7)*105;y=-70-Math.abs(3-j%7)*30;}
  g.spawn(STAGE2_ENEMIES[type],x,y,e=>{e.data.contentRole='normal';e.data.enemyType=type;e.data.entryX=x;e.data.flank=j%2?1:-1;e.data.amp=variant===1?130:65;e.data.oldX=g.player.x;});
  yield* g.wait(variant===0?0.23:variant===1?0.25:variant===2?0.22:0.24);
 }
 yield* g.until(()=>g.t>=start+7,8);
}
export const STAGE2:StageDef={index:2,title:'第二幕 · 灯河还名',subtitle:'THE RIVER OF RETURNED NAMES',name:'灯河还名',bg:'stage2',music:'stage2',
 content:{baselineBodies:380,normalBodies:1520,baselineTypes:4,enemyTypes:Object.keys(STAGE2_ENEMIES),encounters:64,chapters},
 *script(g:G):Co {if(!g.seekingCheckpoint){g.card(this.title,this.subtitle);yield* g.wait(3);}let growthSlot=0;
 for(let c=0;c<4;c++){
  if(!g.seekingCheckpoint)g.card(`灯河 · ${chapters[c]}`,`CHAPTER ${c+1}`);g.bg(0,0.25+c*0.2,4);g.bg(1,c*0.22,4);g.bg(2,0.18+c*0.05,4);g.scrollSpeed(65+c*5,3);
  if(!g.seekingCheckpoint)g.caption('老盾',['旧路尚在，名字已空。','他们的名字，仍在供电。','原契从未许诺永囚。','把归处交还他们。'][c],2.5);
  for(let i=0;i<16;i++){if(!g.checkpoint(waveCheckpoint(c*16+i)))continue;yield* encounter(g,c*16+i);if(growthSlot<3&&g.t>=[60,180,300][growthSlot])yield* g.growthChoice(++growthSlot);if(i===4||i===10||i===14)g.drop('p',240+(i%3)*180,210);if(i===7)g.drop('weapon',450,210);}
  if(!g.seekingCheckpoint)yield* g.waitClear(7);
  if(c===2 && g.checkpoint('PAGODA')){g.caption('老盾','拆掉锁链，原契才可读。',2.5);yield* g.boss(Pagoda,450,-180,{warning:false,music:false,startPhase:g.testBossPhase('PAGODA')});g.drop('1up',450,380);yield* g.milestone('宝塔断链 · 航图归还');}
  else if(!g.seekingCheckpoint)yield* g.milestone(`灯河 · ${chapters[c]}回墨`);
 }
 if(g.checkpoint('MIRAGE'))yield* g.boss(Mirage,450,-240,{subtitle:'藏灯 · 闭壳藏人',startPhase:g.testBossPhase('MIRAGE')});g.bg(1,0,4);g.caption('藏灯','让他们自己选归处。',2.8);yield* g.wait(3);
 }};
