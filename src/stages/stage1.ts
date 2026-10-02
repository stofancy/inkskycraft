import { FodderChapter } from './fodder1';
import type { World } from '../game/world';
import { storyBoss,paperTimeoutFollowup } from './stage1_boss_events';
// 第一章：出镖。十个独立剧情事件，中间接纸龙，末尾接铜雀。
import type { Co,G } from '../game/api';
import type { StageDef } from './types';
import { Serpent,Sparrow } from './stage1_boss';
import { director,resetDialogue } from './dialogue1';
import { CH1_SEGMENTS,conversation,escortEnd,routeState } from './stage1_events';
export const STAGE1:StageDef={
 index:1,title:'第一章 · 出镖',subtitle:'护送青石屿的三架云梭',name:'出镖',bg:'stage1',music:'stage1',
 content:{baselineBodies:131,normalBodies:40,baselineTypes:6,enemyTypes:['巡山蜂机','巡路纸鹤','浮石林铜龟','两岸山炮','横越风筝','电池搬运机','浮石林网桩','浮石炮塔','浮石林轰炸机','盾筝','云哨'],encounters:8,chapters:['出港与第一波','屏障与劫机','拦截雷石','急行与铜雀关']},
 *script(g:G):Co{
  const s=routeState(g);resetDialogue(g);(g as World).fodder=new FodderChapter(g as World,s);const w=g as G & {testOptions:unknown;scroll:number;density:{normalLimitOverride:number|null}};
  if(!g.seekingCheckpoint){w.scroll=4300;g.card(this.title,this.subtitle);yield* g.wait(3);while(g.cardActive)yield;director(g).brief(1);yield* conversation(g,s,'CH1.dispatch');s.times['air.start']=g.t;}
  else if(!w.testOptions)g.joinCompanion('chiyan');
  for(let i=0;i<CH1_SEGMENTS.length;i++){
   const seg=CH1_SEGMENTS[i];
   if(g.checkpoint(seg.id)){
    g.bg(0,seg.corrosion,3);g.bg(1,seg.flow,3);g.bg(2,seg.fog,3);g.bg(3,seg.bg,3);if(i>0)g.scrollSpeed(seg.speed,1.8);
    s.ship.follow=true;w.density.normalLimitOverride=null;s.times[`${seg.id}.start`]=g.t;s.times[`${seg.id}.realStart`]=g.real;(g as World).fodder!.begin(seg.id);yield* seg.run(g,s);(g as World).fodder!.end();s.times[`${seg.id}.end`]=g.t;s.times[`${seg.id}.realEnd`]=g.real;
   }
   if(seg.id==='S5'&&g.checkpoint('SERPENT')){director(g).brief(2);s.ship.protected=true;s.ship.follow=false;yield* moveShip(g,s.cart,200,1000);yield* conversation(g,s,'PD.arrival');s.times['paper.start']=g.t;s.ship.follow=true;g.scrollSpeed(25,2);yield* g.boss(storyBoss(Serpent,'paper',s),450,-100,{resumeMusic:'stage1b',startPhase:g.testBossPhase('SERPENT')});s.times['paper.end']=g.t;yield* paperTimeoutFollowup(g,s);s.ship.follow=false;yield* moveShip(g,s.cart,450,860);s.ship.protected=false;yield* g.growthChoice(1);yield* g.wait(4);}
   if(seg.id==='S6'&&!g.seekingCheckpoint){yield* g.growthChoice(2);yield* g.wait(4);}
  }
  if(g.checkpoint('SPARROW')){
   director(g).brief(4);s.ship.protected=true;s.ship.follow=false;yield* moveShip(g,s.cart,450,1000);yield* conversation(g,s,'TQ.T1.returnOrderShown');s.times['copper.start']=g.t;g.scrollSpeed(25,2);yield* g.boss(storyBoss(Sparrow,'copper',s),450,-230,{subtitle:'铜雀 · 守关机器',startPhase:g.testBossPhase('SPARROW')});
   s.times['copper.end']=g.t;yield* conversation(g,s,s.bossResults?.copper?.result==='sealed'?'TQ.controlStopped':'TQ.sealTimeout');yield* escortEnd(g,s);s.times['escort.end']=g.t;
  }
  yield* g.milestone('云梭队已过关');g.scrollSpeed(60,3);
 },
};

function* moveShip(g:G,ship:{x:number;y:number},x:number,y:number):Co{while(Math.hypot(x-ship.x,y-ship.y)>.5){const d=Math.hypot(x-ship.x,y-ship.y),step=Math.min(d,60*(g as G & {lastRealDt:number}).lastRealDt);ship.x+=(x-ship.x)/d*step;ship.y+=(y-ship.y)/d*step;yield;}ship.x=x;ship.y=y;}
