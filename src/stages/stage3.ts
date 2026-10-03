import type { Co, G } from '../game/api';
import type { EnemyDef } from '../game/enemy';
import type { StageDef } from './types';
import { Drum,Hornet,Lancer,Wingfort } from './stage3_enemies';
import { ThunderRay,CloudSpider,WhaleCalf,JadeShuttle,LightningPillar } from './stage3_extra';
import { Kun,Peng } from './stage3_boss';
import { Leigong } from './stage3_leigong';
import type { World } from '../game/world';
import { ChapterDialogue,director } from './dialogue1';
import { CH3_LINES } from './dialogue3_data';
import { showTianmen,openTianmen } from './stage3_scene';
export { openTianmen } from './stage3_scene';
const TYPES=[Hornet,Lancer,Drum,Wingfort,ThunderRay,CloudSpider,WhaleCalf,JadeShuttle];
export const STAGE3_ENCOUNTERS=[
 {id:'C3.ENTRY',label:'雷场入口',seconds:45},
 {id:'C3.DRUMS',label:'雷鼓阵',seconds:45},
 {id:'LEIGONG',label:'雷公',seconds:75},
 {id:'C3.GATE',label:'云开见门',seconds:25},
 {id:'KUN',label:'巨鲲',seconds:60},
 {id:'PENG',label:'展鹏',seconds:50},
 {id:'C3.LETTERING',label:'题字开门',seconds:60},
];
type Cue=readonly [seconds:number,type:EnemyDef,x:number,y?:number];
// 每次只有一组占区和一组瞄准；组合首招相隔 0.6 秒，数量不乘旧刷怪倍率。
const ENTRY:Cue[]=[
 [0,Hornet,310],[3,Hornet,590],[6,Lancer,260],[9,Lancer,640],
 [12,LightningPillar,280,700],[13,Hornet,650],[16,Lancer,380],
 [20,Hornet,240],[20.15,Lancer,660],[24,Hornet,660],[24.15,Lancer,240],
 [28,Hornet,340],[28.15,Lancer,590],[32,Hornet,590],[32.15,Lancer,310],
 [36,Hornet,270],[36.15,Lancer,630],[40,Hornet,620],[40.15,Lancer,280],
];
const DRUMS:Cue[]=[
 [0,Drum,300],[0,LightningPillar,300,700],[1.15,Hornet,650],[4.15,Hornet,570],
 [8,ThunderRay,250],[13,CloudSpider,610],
 [18,Drum,600],[18,LightningPillar,600,700],[19.15,Hornet,250],[22.15,Hornet,350],
 [26,ThunderRay,240],[26.6,CloudSpider,630],
 [32,Wingfort,450],[40,Hornet,250],[40.15,Lancer,650],
];
const GATE:Cue[]=[[8,WhaleCalf,330],[14,JadeShuttle,640],[19,WhaleCalf,610],[19.7,JadeShuttle,260]];
function clearField(g:G):void{
 for(const e of g.liveEnemies())if(!e.def.boss)g.remove(e);
 g.clearBullets();
}
function* runCues(g:G,cues:readonly Cue[],seconds:number,start=g.t):Co{
 for(const [at,type,x,y=80] of cues){
  while(g.t-start<at)yield;
  if(type===LightningPillar)for(const e of g.liveEnemies())if(e.def===LightningPillar)g.remove(e);
  g.spawn(type,x,y,e=>{e.data.contentRole=type===LightningPillar?'prop':'normal';e.data.noSupplementFire=true;});
 }
 while(g.t-start<seconds)yield;
 clearField(g);
}
function init(g:G):void{const w=g as World;w.chapterDialogue=new ChapterDialogue(w,CH3_LINES);}
export const STAGE3:StageDef={index:3,title:'第三章 · 天门',subtitle:'闯过雷场，飞过天门',name:'雷场',bg:'stage3',music:'stage3',content:{baselineBodies:100,normalBodies:[...ENTRY,...DRUMS,...GATE].filter(c=>c[1]!==LightningPillar).length,baselineTypes:5,enemyTypes:TYPES.map(t=>t.name!),encounters:7,chapters:STAGE3_ENCOUNTERS.map(s=>s.label)},
 *script(g:G){
  init(g);
  if(!g.seekingCheckpoint){g.card(this.title,this.subtitle);yield* g.wait(3);while(g.cardActive)yield;yield* director(g).conversation('C3.open');}
  if(g.checkpoint('C3.ENTRY')){g.bg(2,0);g.scrollSpeed(80,1);yield* runCues(g,ENTRY,45);}
  if(g.checkpoint('C3.DRUMS')){g.bg(2,.28,4);g.scrollSpeed(65,1);yield* runCues(g,DRUMS,45);}
  if(g.checkpoint('LEIGONG')){
   g.bg(2,.5,3);g.scrollSpeed(25,2);
   yield* g.boss(Leigong,450,-180,{startPhase:g.testBossPhase('LEIGONG')});
   yield* director(g).conversation('C3.leigongDown');clearField(g);
  }
  if(g.checkpoint('C3.GATE')){
   g.music('stage4',1);g.bg(2,1,6);g.scrollSpeed(35,2);
   const start=g.t,gate=showTianmen(g);gate.alpha=0;gate.y=270;
   for(const x of [340,450,560]){const stone=(g as World).items.spawn('ink',x,520);stone.spriteOverride='c3_thunderstone';}
   // 前八秒留给拾取；两秒云开时对白冻结画面和攻击。
   while(g.t-start<2){const k=Math.min(1,(g.t-start)/2);gate.alpha=k;gate.y=270+k*40;yield;}
   gate.alpha=1;gate.y=310;yield* director(g).conversation('C3.gateSeen');
   yield* runCues(g,GATE,25,start);
  }
  if(g.checkpoint('KUN')){
   showTianmen(g);g.bg(2,1);g.scrollSpeed(25,2);g.caption('','',.01);
   yield* g.boss(Kun,450,-420,{subtitle:'鲲鹏 · 天门守卫',transition:true,startPhase:g.testBossPhase('KUN')});
  }
  if(g.checkpoint('PENG')){
   showTianmen(g);g.bg(2,1);
   // 展鹏与题字属于同一个 Boss 作用域，仍由鹏的击破/题字完成推进。
   yield* g.boss(Peng,450,250,{warning:false,startPhase:g.testBossPhase('PENG')});
   g.checkpoint('C3.LETTERING');openTianmen(g);yield* director(g).conversation('C3.gateOpen');
  }
  g.bg(0,0,4);g.bg(3,0,4);g.bg(4,.6,4);g.caption('','',.01);yield* g.wait(2);
 }};

/** 独立终战入口也复用同一座门与同一开门函数。 */
export const FINAL_TEST_STAGE: StageDef = { ...STAGE3, index:4, name:'鲲鹏终战', music:'stage4',
 *script(g:G){
  init(g);g.bg(0,1);g.bg(2,1);g.bg(4,1.6);showTianmen(g);
  if(g.checkpoint('KUN'))yield* g.boss(Kun,450,-420,{transition:true,startPhase:g.testBossPhase('KUN')});
  if(g.checkpoint('PENG')){yield* g.boss(Peng,450,250,{warning:false,startPhase:g.testBossPhase('PENG')});openTianmen(g);yield* director(g).conversation('C3.gateOpen');}
 }
};
