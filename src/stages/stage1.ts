// 晓山返笔：旧12波各扩成教学/交叉/互动/组合，四章各12段。
import type { Co, G } from '../game/api';
import type { EnemyDef } from '../game/enemy';
import type { StageDef } from './types';
import { Chariot, Crane, Hornet, Kite, Turret, Turtle } from './stage1_enemies';
import { ArrayDisc, BellBoat, BridgeBreaker, DartSkater, InkOtter, InkSnail, LanternFox, MountainApe, SealBee, ShieldKite, Swallow, SwordShuttle } from './stage1_extra';
import { Serpent, Sparrow } from './stage1_boss';
import { stage1Checkpoint } from './checkpoints';
import { resetDialogue, sayEncounter, sayLine } from './dialogue1';

const CHAPTERS=['归笔','铜道断供','纸龙证词','铜雀返光'];
const ROSTERS: EnemyDef[][]=[
  [Crane,Hornet,Swallow,ShieldKite,SealBee,Kite],
  [InkSnail,Turtle,MountainApe,DartSkater,InkOtter,Turret],
  [SwordShuttle,ArrayDisc,Swallow,LanternFox,Crane,SealBee],
  [Chariot,BellBoat,BridgeBreaker,ShieldKite,DartSkater,Hornet],
];
const OLD_WAVES=['纸鹤五机','纸鹤七机','蜂群横排','山径护送','风筝横穿','镜像蜂群','铜龟夹击','双侧蜂流','山炮运输','双战车','风筝掩护','三排蜂阵'];
// 48 handwritten route/role combinations. Rows map old wave i to four successive exercises.
const EXERCISES=[
  ['散鹤标色','两翼追位','慢阵回墨','盾鹤护送'],['燕尾追踪','蜂燕交叉','印记清路','绕盾点睛'],['风筝横穿','斜蜂换侧','双波回墨','盾印合围'],
  ['采墨示范','龟猿交叉','救池断供','山径护运'],['斗笠回镖','獭客抢池','供墨桩断线','螺龟合围'],['炮线预警','猿炮换路','桩边回墨','重甲验收'],
  ['剑梭示线','燕剑夹击','断阵开隙','剑阵交叉'],['狐机报时','鹤狐护送','清点停线','阵印合围'],['慢鹤留白','剑燕换位','断链证词','纸阵验收'],
  ['战车腹舱','铃舟移阵','断桥开边','车桥护运'],['盾翼示范','铃镖交叉','输墨核卸甲','双侧运输'],['蜂群留隙','桥车换边','断供回墨','返光验收'],
];
const Supply:EnemyDef={sprite:'e_arraydisc',hp:55,score:500,noCollide:true,drops:'ink'};
function* encounter(g:G,chapter:number,round:number):Co {
  const kind=round%4, old=chapter*3+Math.floor(round/4), roster=ROSTERS[chapter];
  const budget=chapter<2||round<10?11:10;
  const n=Math.max(1,Math.round(budget*g.difficulty.enemyCount));
  sayEncounter(g,chapter,round);
  // Interaction rounds have a visible supply node; deleting it stops linked side artillery.
  let supply:ReturnType<G['spawn']>|undefined;
  if(kind===2&&chapter>0){supply=g.spawn(Supply,round%2?220:680,240,e=>{e.data.contentRole='prop';e.data.weakWeapon='purple';e.data.weakLabel='印 · 断供停火';e.data.bodyPhase='supply';});}
  const start=g.t;
  for(let i=0;i<n;i++){
    // Heavy hulls are escorts at the end; teaching rounds stay on one independent mechanic.
    let def=roster[(Math.floor(round/4)*2+(kind===0?0:i%3))%roster.length];
    if(def.hp>=200&&i<n-1)def=roster[(roster.indexOf(def)+1)%roster.length];
    const lane=kind===0?150+(i%5)*150:kind===1?(i%2?760:140)+(i%3-1)*30:kind===2?220+(i%4)*150:110+(i%6)*136;
    const side=i%2===0?1:-1;
    const entry=def===Kite?(side===1?-60:960):kind===1?(side===1?-40:940):lane;
    const enemy=g.spawn(def,entry,def===Kite?220+(i%3)*80:-70-(i%2)*25,e=>{
      e.data.contentRole='normal';e.data.slot=[lane,170+(i%3)*65];e.data.dir=side;e.data.angle=Math.PI/2-side*(kind===1?.42:.12);
      e.data.turn=side;e.data.fireAt=.85;e.data.volleys=1;e.data.hold=6;e.data.ty=210;
      e.data.weakWeapon=def===Crane?'purple':def===Turtle||def===Chariot?'red':'blue';
      e.data.weakLabel=def===Chariot?'刃 · 腹舱':def===Crane?'印 · 团阵':'流 · 导流';
      if(supply)e.data.linkTo=supply.id;
    });
    if(supply&&def===Turret){const node=supply;enemy.run((function*():Co{yield* g.until(()=>node.dead,10);if(node.dead){enemy.data.disabled=true;g.fx.burst(enemy.x,enemy.y,8,70,[.2,1,1]);}})());}
    yield* g.wait(kind===0?.3:kind===1?.36:kind===2?.42:.28);
  }
  if(kind===2)g.drop('ink',round%2?350:550,500);
  yield* g.wait(Math.max(.5,8.2-(g.t-start)));
  if(supply&&!supply.dead)g.remove(supply);
}
export const STAGE1:StageDef={
  index:1,title:'第一幕 · 晓山返笔',subtitle:'RETURN TO DAWN',name:'晓山返笔',bg:'stage1',music:'stage1',
  content:{baselineBodies:131,normalBodies:524,baselineTypes:6,enemyTypes:['hornet','crane','kite','turtle','turret','chariot','swallow','swordshuttle','shieldkite','sealbee','inksnail','arraydisc','dartskater','bellboat','mountainape','inkotter','lanternfox','bridgebreaker'],encounters:48,chapters:CHAPTERS},
  *script(g:G){
    if(!g.seekingCheckpoint){g.card(this.title,this.subtitle);g.bg(2,.45,3);yield* g.wait(3);}
    let growthSlot=0;
    resetDialogue();
    for(let chapter=0;chapter<4;chapter++){
      g.bg(0,[.08,.28,.52,.8][chapter],5);g.bg(1,[.8,.6,.42,.2][chapter],5);g.bg(2,[.45,.55,.65,.95][chapter],5);
      for(let round=0;round<12;round++){
        // Old wave i maps to exercises i×4..i×4+3 in EXERCISES.
        if(!g.checkpoint(stage1Checkpoint(chapter*12+round)))continue;
        yield* encounter(g,chapter,round);
        if(growthSlot<3&&g.t>=[60,180,300][growthSlot])yield* g.growthChoice(++growthSlot);
        if(round===3||round===7||round===11)g.drop('missile',round===7?600:300,500);
        if(round===5)g.drop('weapon',450,520);
      }
      if(!g.seekingCheckpoint){yield* g.waitClear(4);g.clearBullets();g.drop('p',450,480);g.player.ink=Math.max(g.player.ink,.75);}
      if(chapter===2 && g.checkpoint('SERPENT')){yield* g.boss(Serpent,450,-100,{warning:false,music:false,startPhase: g.testBossPhase('SERPENT')});}
      if(!g.seekingCheckpoint)yield* g.milestone(chapter===2?'纸龙证词':CHAPTERS[chapter]);
    }
    if(g.checkpoint('SPARROW')){g.scrollSpeed(30,3);if(!g.testBossPhase('SPARROW'))yield* g.wait(7);yield* g.boss(Sparrow,450,-230,{subtitle:'守晨 · 解甲返光',startPhase: g.testBossPhase('SPARROW')});}
    sayLine(g,'M1-END');g.bg(0,0,3);g.bg(2,1,3);g.scrollSpeed(60,3);yield* g.wait(3);
  },
};
