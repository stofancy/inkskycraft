import type { Co, G } from '../game/api';
import type { StageDef } from './types';
import { Drum,Hornet,Kite,Lancer,Wingfort } from './stage3_enemies';
import { STAGE3_EXTRA, LightningPillar } from './stage3_extra';
import { waveCheckpoint } from './checkpoints';
import { Kun,Peng } from './stage3_boss';
import { Leigong } from './stage3_leigong';
const TYPES=[Drum,Lancer,Wingfort,Hornet,Kite,...STAGE3_EXTRA];
const CHAPTERS=['上天阶','雷公审判','鲲吞天','鹏断律'];
// 原十二波各展开教学、交叉、场景互动、组合验收：四章各三组、每组四段。
export const STAGE3_ENCOUNTERS=Array.from({length:48},(_,i)=>({chapter:Math.floor(i/12),sourceWave:Math.floor(i/4),mode:i%4,bodies:i%12<4?9:8}));
function* encounter(g:G,index:number):Co{
 const q=STAGE3_ENCOUNTERS[index],base=(q.chapter*3+Math.floor(index%12/4))%15;
 const n=Math.max(1,Math.round(q.bodies*g.difficulty.quantity));
 const prop=q.mode===2?g.spawn(LightningPillar,index%2?180:720,410,e=>{e.data.contentRole='prop';}):null;
 for(let i=0;i<n;i++){
  const t=q.mode===0?base:q.mode===1?(base+i%2)%15:q.mode===2?(base+5+i%2)%15:(base+i%3+9)%15;
  const x=q.mode===0?160+(i%5)*145:q.mode===1?(i%2?700:200)+(Math.floor(i/2)%3-1)*45:q.mode===2?(prop&&!prop.dead?450:200)+(i%3-1)*100:130+(i%5)*160;
  g.spawn(TYPES[t],x,-45,e=>{e.data.contentRole='normal';e.data.encounter=index;e.data.oldX=g.player.x;e.data.weakLabel??='三垣 · 拆职责';});
  yield* g.wait(q.mode===0?.34:q.mode===1?.42:.5);
 }
 yield* g.wait(5.7);
 if(prop&&!prop.dead)g.remove(prop);
}
export const STAGE3:StageDef={index:3,title:'第三关 · 云垣断律',subtitle:'REVOKE THE LAW OF HEAVEN',name:'云垣断律',bg:'stage3',music:'stage3',content:{baselineBodies:100,normalBodies:400,baselineTypes:5,enemyTypes:TYPES.map(t=>t.name!),encounters:48,chapters:CHAPTERS},
 *script(g:G){if(!g.seekingCheckpoint){g.card(this.title,this.subtitle);yield* g.wait(3);}let growthSlot=0;for(let c=0;c<4;c++){g.bg(0,c/3,5);g.bg(2,c/3,8);g.bg(4,1+c*.2,4);if(!g.seekingCheckpoint){g.caption('',CHAPTERS[c],2);g.caption('朱雀',['三垣同声，旧誓可撤。','原签尚在，命令未改。','城骨归人，供墨重新相连。','今日之后，共担山河。'][c],3);}for(let i=0;i<12;i++){if(!g.checkpoint(waveCheckpoint(c*12+i)))continue;yield* encounter(g,c*12+i);if(growthSlot<3&&g.t>=[60,180,300][growthSlot])yield* g.growthChoice(++growthSlot);}if(!g.seekingCheckpoint)yield* g.waitClear(8);if(c===1 && g.checkpoint('LEIGONG')){yield* g.boss(Leigong,450,-180,{warning:false,music:false,startPhase:g.testBossPhase('LEIGONG')});}if(!g.seekingCheckpoint)yield* g.milestone(CHAPTERS[c]);}
 if(g.checkpoint('KUN')){g.caption('衡天','下城若存，天城将坠。',3);yield* g.boss(Kun,450,-420,{subtitle:'衡天 · 北冥负城',transition:true,startPhase:g.testBossPhase('KUN')});}if(g.checkpoint('PENG'))yield* g.boss(Peng,450,250,{warning:false,music:false,startPhase:g.testBossPhase('PENG')});g.bg(0,0,4);g.bg(3,0,4);g.bg(4,.6,4);g.caption('朱雀','未来由三垣共同承担。',3);yield* g.wait(2);
 }};

/** 独立第四章尚未重写；测试菜单复用现有鲲鹏终战，正式关卡注册不变。 */
export const FINAL_TEST_STAGE: StageDef = { ...STAGE3, index:4, name:'鲲鹏终战',
 *script(g:G){
  g.bg(0,1);g.bg(2,1);g.bg(4,1.6);
  if(g.checkpoint('KUN'))yield* g.boss(Kun,450,-420,{transition:true,startPhase:g.testBossPhase('KUN')});
  if(g.checkpoint('PENG'))yield* g.boss(Peng,450,250,{warning:false,music:false,startPhase:g.testBossPhase('PENG')});
 }
};
