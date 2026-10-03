// 自动巡游：真实输入反制、闭环笔画、章节范围与单 Boss 入口。
// 仅使用独立临时Chrome，不更改用户浏览器或主工作区。
import {bossInput} from './boss-bot.mjs';
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
// 章节范围连续推进；单 Boss 使用现有测试入口，在该 Boss 正常退出时停止。
const bosses = { paper:[1,'SERPENT'], copper:[1,'SPARROW'], mirage:[2,'MIRAGE'], leigong:[3,'LEIGONG'], kun:[3,'KUN'], peng:[3,'PENG'] };
export function flowRange(from='ch1',to=from) {
 const chapter = value => /^ch[1-3]$/.test(value) ? Number(value.slice(2)) : null;
 const first=chapter(from),last=chapter(to);
 if(first&&last&&first<=last)return {first,last};
 const key=Object.keys(bosses).find(k=>k===from.toLowerCase()||bosses[k][1].toLowerCase()===from.toLowerCase());
 if(key&&from===to)return {first:bosses[key][0],last:bosses[key][0],checkpoint:bosses[key][1],name:key};
 throw Error('范围使用 ch1..ch3，或同一个 Boss：paper / copper / mirage / leigong / kun / peng（也支持检查点 ID）');
}
export async function runValidation(extra = '', base = 'http://127.0.0.1:5177/', out = '.shots/expansion', capture = true, maxPower = 4, range = flowRange('ch1','ch3')) {
 const url = new URL(base);
 const defaults = { god:'1', autofire:'1', bot:'1', power:'4', weapon:'purple', diff:'normal', flowspeed:'16' };
 for (const [key,value] of Object.entries(defaults)) if (!url.searchParams.has(key)) url.searchParams.set(key,value);
 for (const [key,value] of new URLSearchParams(extra)) url.searchParams.set(key,value);
 const parameters = Object.fromEntries(url.searchParams);
 const speed=Number(parameters.flowspeed);
 if(!Number.isFinite(speed)||speed<1||speed>32)throw Error('flowspeed 必须在 1 至 32 之间');
 const totalStart=performance.now();
 if (!['easy','normal','hard'].includes(parameters.diff)) throw new Error(`不支持难度 ${parameters.diff}`);
 if (!['red','blue','purple'].includes(parameters.weapon)) throw new Error(`不支持武器 ${parameters.weapon}`);
 if (!Number.isInteger(Number(parameters.power)) || Number(parameters.power)<1 || Number(parameters.power)>maxPower) throw new Error(`power 必须为1至${maxPower}，收到 ${parameters.power}`);
 for (const key of ['god','autofire','bot']) if (parameters[key] !== '1') throw new Error(`完整自动验收要求 ${key}=1；不覆盖手工/有损通关参数`);
 for (const key of ['stage','skip']) if (url.searchParams.has(key)) throw new Error(`请用 --from / --to 选择入口，巡游不支持 ${key} 参数`);
const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
mkdirSync(out,{recursive:true});
const errors=[], report={url:url.href,parameters,range,input:[],stages:[],errors};
let page,activeSegment='启动',segmentStart=totalStart;
try {
 page=await browser.newPage();await page.setViewport({width:1600,height:900});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 page.on('console',m=>{if(m.type()==='error'||/CONTEXT_LOST|INVALID_OPERATION|INVALID_FRAMEBUFFER|上下文丢失/.test(m.text()))errors.push(m.text());});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,1500));
 await page.goto(url.href,{waitUntil:'load'});
 report.bundle=await page.evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean));
 await page.waitForFunction('window.__game?.state === "title"',{timeout:60000,polling:50});
 report.runtime=await page.evaluate(()=>({difficulty:window.__game.world.diffId,quantity:window.__game.world.diff.quantity,enemyCount:window.__game.world.diff.enemyCount,bulletCap:window.__game.world.diff.bulletCap}));
 if(report.runtime.difficulty!==parameters.diff)throw Error('构建难度与巡游参数不匹配');
 // 保留固定步长批量驱动，让无头巡游免受显示帧率限制；URL 倍速决定每批步数。
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;window.__game.state='paused';});
 await new Promise(r=>setTimeout(r,100));
 report.bundle=await page.evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean));
 if(range.first===1&&!range.checkpoint){
 // 隔离反制：实际键盘按下，确认爆发反制不会扣炸弹库存。
 for(const [action,key] of [['bomb','KeyF']]) {
  await page.evaluate(action=>{
   const g=window.__game,w=g.world;g.state='paused';w.resetStage();w.player.reset(false);w.player.entering=0;w.player.bombs=3;w.debugAuto=false;
   window.__qteResult=null;w.root.run((function*(){window.__qteResult=yield* w.challenge({action,title:'验收反制',hint:'新按应对',duration:2.4});})());w.tick(1/60);
  },action);
  await page.keyboard.down(key);
  const r=await page.evaluate(()=>{const g=window.__game,w=g.world;g.input.poll();w.tick(1/60);return {result:window.__qteResult,bombs:w.player.bombs,bombT:w.player.bombT,brush:w.brush.active};});
  await page.keyboard.up(key);await page.evaluate(()=>window.__game.input.poll());
  if(r.result!==true||r.bombs!==3||r.bombT!==0)throw new Error(`反制库存/新按失败 ${action} ${JSON.stringify(r)}`);
  report.input.push({action,...r});
 }
 const failed=await page.evaluate(()=>{const g=window.__game,w=g.world;w.resetStage();w.debugAuto=false;let result=null;w.root.run((function*(){result=yield* w.challenge({action:'focus',title:'失败恢复',hint:'不按',duration:.3});})());for(let i=0;i<30;i++){g.input.poll();w.tick(1/60);}return{result,state:w.challengeState,ink:w.player.ink};});
 if(failed.result!==false||failed.state!==null||failed.ink<.5)throw new Error('反制失败恢复未完成');report.input.push({action:'timeout',...failed});
 // 使用实际Brush结算：实际鼠标输入与轨迹，经游戏反制/落笔契约完成闭环。
 await page.evaluate(()=>{const g=window.__game,w=g.world;g.state='playing';g.debug.autofire=false;w.resetStage();w.player.entering=0;w.player.ink=1;w.player.x=520;w.player.y=620;w.spawn({sprite:'e_arraydisc',hp:150,noCollide:true},450,620,e=>{e.data.contentRole='prop';});window.__qteResult=null;w.root.run((function*(){window.__qteResult=yield* w.challenge({action:'brush',title:'闭环验收',hint:'圈住目标',duration:3});})());w.tick(1/60);});
 const pointer=async(type,x,y)=>page.evaluate(({type,x,y})=>{const g=window.__game,r=g.r.playCss,c=document.querySelector('#gl');c.dispatchEvent(new MouseEvent(type,{clientX:r.x+x*r.w/900,clientY:r.y+y*r.h/1200,button:2,buttons:type==='mouseup'?0:2,bubbles:true}));g.input.poll();g.world.tick(1/60);},{type,x,y});
 await page.evaluate(()=>{const p=window.__game.world.player;p.x=450;p.y=1050;});
 await pointer('mousedown',520,620);
 for(let i=1;i<=96;i++){const a=i/96*Math.PI*2;await pointer('pointermove',450+Math.cos(a)*70,620+Math.sin(a)*70);}
 await pointer('mouseup',520,620);
 const sealed=await page.evaluate(()=>{const w=window.__game.world;return{sealed:w.brush.sealed,form:w.brush.lastForm,enemies:w.enemies.filter(e=>!e.dead).map(e=>({sealed:e.sealed,hp:e.hp}))};});
 if(sealed.form!=='封'||sealed.sealed<1||!sealed.enemies.some(e=>e.sealed>0))throw new Error(`真实鼠标闭环失败 ${JSON.stringify(sealed)}`);report.input.push({action:'brush',...sealed});
 }
 await page.evaluate(({seed,range,parameters})=>{const g=window.__game;g.debug.autofire=true;g.toTitle();
  if(seed!==null){let state=seed;Math.random=()=>{state=(state+0x6d2b79f5)|0;let t=Math.imul(state^(state>>>15),1|state);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};g.world.rng.s=seed;}
  if(range.first===1&&!range.checkpoint)g.onStart();
  else g.onTestStart({chapter:range.first,checkpoint:range.checkpoint??'start',bossPhase:1,god:true,
   bombColor:parameters.weapon,inkScore:{red:1,blue:1,purple:1},brushPower:3,brushMethods:['横','竖'],
   skills:[],passives:[],companions:range.first===1?['chiyan']:range.first===2?['chiyan','laodun']:['laodun','moyuan'],fullInk:false,fullBombs:false});
  g.world.debugAuto=false;
  // 只观察真实奖命结算，保存分数入账时所属章节（含章末结算）。
  window.__extendEvents=[];
  const w=g.world,addScore=w.addScore.bind(w);
  w.addScore=n=>{const before=w.extendIdx;addScore(n);for(let i=before;i<w.extendIdx;i++)window.__extendEvents.push({line:i+1,stage:w.stageIndex,real:w.real,t:w.t,score:w.score});};
  const inp=g.input,origPressed=inp.pressed.bind(inp),origDown=inp.down.bind(inp),origConsume=inp.consume.bind(inp);
  window.__forced={pressed:new Set(),held:new Set(),paint:null};
  inp.pressed=a=>window.__forced.pressed.has(a)||origPressed(a);
  inp.down=a=>a==='shoot'&&g.world.bossCombat.qte?inp.cur.has('shoot'):window.__forced.held.has(a)||origDown(a);
  inp.consume=a=>{window.__forced.pressed.delete(a);origConsume(a);};
 },{seed:parameters.seed===undefined?null:Number(parameters.seed),range,parameters});
 await page.waitForFunction('window.__game.state === "playing"',{timeout:60000,polling:50});
 await page.evaluate(()=>window.__game.audio.diagnostics().musicReady());
 await page.evaluate(()=>{window.__game.world.debugAuto=false;});
 await page.evaluate(`window.bossInput=${bossInput.toString()};window.__bossBot={delay:.7};`);
 for(let stage=range.first;stage<=range.last;stage++) {
  activeSegment=range.name??`ch${stage}`;segmentStart=performance.now();
  const r=await page.evaluate(async ({useSkills,speed,checkpoint})=>{
   const g=window.__game,w=g.world,F=window.__forced,start=performance.now();
   const pointer=(type,x,y)=>{const r=g.r.playCss;document.querySelector('#gl').dispatchEvent(new MouseEvent(type,{clientX:r.x+x*r.w/900,clientY:r.y+y*r.h/1200,button:2,buttons:type==='mouseup'?0:2,bubbles:true}));if(type==='mouseup')g.input.poll();};let dialoguePage=null;let startLoadout=null;let frames=0,lastChallenge=null,paint=null,seenBoss=null,bossComplete=false,bossFailure=null;const events=[],bossLoadouts=[],bossPhases=new Set();
   while(g.state==='playing'&&!bossComplete&&!bossFailure&&performance.now()-start<240000&&frames<90000){
    for(let k=0;k<Math.ceil(32*speed)&&g.state==='playing'&&!bossComplete;k++){
     while(w.cardActive&&performance.now()-start<240000)await new Promise(r=>setTimeout(r,20));
     g.input.poll();F.pressed.clear();F.held.clear();
     if(w.dialoguePaused){const state=g.ui.dialogueState(),key=state.id+':'+state.page;if(state.active){if(!dialoguePage||dialoguePage.key!==key){dialoguePage={key,frames:0};if(!state.complete)g.ui.dialogueAdvance();}if(++dialoguePage.frames>=30){g.ui.dialogueAdvance();dialoguePage=null;}}g.update(1/60);frames++;continue;}
     window.bossInput(g,window.__bossBot);
     const q=w.challengeState;
     if(useSkills&&w.stageIndex===1&&!q&&!paint)for(const slot of w.skills.slots())if(slot.visible&&slot.ready)F.pressed.add(`skill${slot.key}`);
     if(q&&q!==lastChallenge){lastChallenge=q;if(q.action!=='brush')F.pressed.add(q.action);events.push({title:q.title,action:q.action,t:w.t});if(q.action==='brush'){
       const n=w.enemies.find(e=>!e.dead&&/闭环|圈住|姓名珠|封天/.test(e.data.weakLabel??'')&&e!==w.bossE);
       const cx=n?.x??450,cy=n?.y??460;
       paint={cx,cy,frame:0};pointer('mousedown',cx+72,cy);
      }}
     const boss=w.bossE;
     if(boss?.data.globalTimeout){bossFailure=`${boss.def.boss?.name} / ${boss.data.phaseTitle??boss.data.phase} 超时退场`;break;}
     if(checkpoint&&boss&&!seenBoss)seenBoss=boss;
     if(seenBoss&&(seenBoss.dead||w.bossE!==seenBoss)){if(seenBoss.data.globalTimeout)bossFailure=`${seenBoss.def.boss?.name} 超时退场`;else bossComplete=true;break;}
     if(boss?.data.phaseIndex){const key=String(boss.id)+':'+boss.data.phaseIndex;if(!bossPhases.has(key)){bossPhases.add(key);bossLoadouts.push({boss:boss.def.boss?.name,phase:boss.data.phaseIndex,real:w.real,power:w.player.power,weapon:w.player.weapon,missile:w.player.missile??null});}}
     const sealTarget=boss?.data.sealWindow?w.enemies.find(e=>w.targetable(e)&&e.data.bossOwner===boss&&e.data.sealReadyAt!==undefined):null;
     if(!w.bossCombat.qte&&!paint&&sealTarget&&!sealTarget.data.lastSealedAt){paint={cx:sealTarget.x,cy:sealTarget.y,frame:0};pointer('mousedown',sealTarget.x+72,sealTarget.y);}
     const mirageSeal=boss?.data.c2Mirage&&boss.data.phaseIndex===2?w.enemies.find(e=>!e.dead&&e.data.c2True&&!e.data.pinned):null;
     if(!w.bossCombat.qte&&!paint&&mirageSeal&&w.real-(window.__mirageSealAt??-9)>2){window.__mirageSealAt=w.real;paint={cx:mirageSeal.x,cy:mirageSeal.y,frame:0};pointer('mousedown',mirageSeal.x+72,mirageSeal.y);}
     if(!paint&&boss&&!w.bossCombat.qte){
      const rows=(boss.data.rig?.rows??[]).filter(row=>row.burnedAt===Infinity).map(row=>row.part).filter(e=>w.targetable(e));
      const target=rows[0]??window.__bossBot.target;
      if(target&&w.targetable(target)&&w.real-(window.__lastLine??0)>.2&&(rows.length||w.player.ink>=.15)){paint={line:true,target,cx:target.x,cy:target.y,frame:0};pointer('mousedown',target.x-95,target.y);}
     }
     if(paint?.line){paint.cx=paint.target.x;paint.cy=paint.target.y;pointer('pointermove',paint.cx-95+Math.min(30,paint.frame)/30*190,paint.cy);if(paint.frame++>=30){pointer('mouseup',paint.cx+95,paint.cy);window.__lastLine=w.real;paint=null;}}
     else if(paint){const a=paint.frame/96*Math.PI*2;pointer('pointermove',paint.cx+Math.cos(a)*72,paint.cy+Math.sin(a)*72);if(paint.frame++>=96){pointer('mouseup',paint.cx+72,paint.cy);paint=null;}}
     g.update(1/60);if(frames===0)startLoadout={difficulty:w.diffId,power:w.player.power,weapon:w.player.weapon};frames++;
    }
    g.render();
    await new Promise(r=>setTimeout(r,0));
   }
   return {bossComplete,bossFailure,checkpoint:w.currentCheckpoint,stuck: w.bossE?`${w.bossE.def.boss?.name} / ${w.bossE.data.phaseTitle??w.bossE.data.phaseIndex??w.bossE.data.phase??''}`:w.currentCheckpoint,chapter2:w.chapter2?{segments:w.chapter2.segments,flights:w.chapter2.flights,events:w.chapter2.events,times:w.chapter2.times,maxEnemies:w.chapter2.maxEnemies,maxBullets:w.chapter2.maxBullets,roster:w.companions.team.map(s=>s.kind),bossResults:w.chapter2.bossResults}:null,inkScore:{...w.inkScore.levels},inkPages:[...w.inkScore.awarded],skills:{arrivals:{...w.skills.arrivalTimes},unlocked:[...w.skills.unlocked],...structuredClone(w.skills.stats)},stage:w.stageIndex,state:g.state,startLoadout,weapon:w.player.weapon,difficulty:w.diffId,t:w.t,frames,simulatedSeconds:frames/60,playSeconds:frames/60-w.dialoguePauseSeconds,dialoguePauseSeconds:w.dialoguePauseSeconds,routeTimes:w.sceneState?.times,routeEvents:w.sceneState?.events,dialogue:w.chapterDialogue?{played:w.chapterDialogue.history.map(l=>l.id),dropped:w.chapterDialogue.dropped,triggered:[...w.chapterDialogue.triggered],briefs:w.chapterDialogue.briefIds,groups:w.chapterDialogue.groupTimings,lineStarts:w.chapterDialogue.lineStarts,lineEnds:w.chapterDialogue.lineEnds}:null,fodder:w.fodder?{spawns:w.fodder.spawns,cancelled:w.fodder.cancelled,reinforcements:w.fodder.reinforcements,repairBodies:w.fodder.repairBodies,maxEnemies:w.fodder.maxEnemies,maxBullets:w.fodder.maxBullets,maxBubbles:w.fodder.maxBubbles,log:w.fodder.log}:null,shipDurability:w.escort?.durability,bossQte:w.bossCombat.history,bossLedgers:w.bossCombat.recent,bossTiming:w.bossCombat.battles,bossResults:w.sceneState?.bossResults,bossLoadouts,lastStrikeBlocked:w.sceneState?.lastStrikeBlocked,wall:(performance.now()-start)/1000,score:w.score,power:w.player.power,bodies:w.contentStats.bodies,patrolBodies:w.density.patrolBodies,types:[...w.contentStats.types],milestones:w.contentStats.milestones,challengeSuccess:w.contentStats.successes,challengeFail:w.contentStats.failures,events,talents:[...w.progression.talents.keys()],companionChargeTiming:{...w.companions.stageChargeTiming,secondsToFull:w.companions.stageChargeTiming.fullAt===null||w.companions.stageChargeTiming.pairAt===null?null:w.companions.stageChargeTiming.fullAt-w.companions.stageChargeTiming.pairAt},companionEffects:structuredClone(w.companions.stats),companions:w.companions.team.map(s=>({name:s.name,level:s.level})),live:w.enemies.filter(e=>!e.dead).map(e=>({sprite:e.def.sprite,hp:e.hp,label:e.data.weakLabel,phase:e.data.bodyPhase})),challenge:w.challengeState};
  },{useSkills:parameters.skillcheck==='1',speed,checkpoint:range.checkpoint});
  report.stages.push(r);
  if(r.bossFailure)throw Error(`卡在 ${r.bossFailure}`);
  if(errors.length)throw Error(errors.join('；'));
  if(range.checkpoint?!r.bossComplete:r.state!=='results'||r.stage!==stage)throw Error(`卡在 ${r.stuck||r.state}`);
  for(const [name,b] of Object.entries(r.bossResults??{}))if(b.result==='timeout'||b.assisted)throw Error(`卡在 ${name}：超时辅助退场`);
  if(!range.checkpoint&&stage===1){
   if(r.startLoadout?.power!==Number(parameters.power)||r.startLoadout?.weapon!==parameters.weapon)throw Error('URL 初始装备未应用');
   if(!['tishen','zhongpao'].every(id=>r.skills.unlocked.includes(id)))throw Error('第一章事件技能解锁遗漏');
   if(r.fodder.maxEnemies>Math.round(10*report.runtime.enemyCount)||r.fodder.maxBullets>report.runtime.bulletCap||r.fodder.maxBubbles>2)throw Error('第一章炮灰预算越界');
  }
  if(!range.checkpoint){
   if(stage<3&&r.milestones!==[1,1][stage-1])throw Error(`第${stage}章里程碑遗漏`);
   if(range.first===1&&(r.inkPages.length!==stage+1||Object.values(r.inkScore).reduce((a,b)=>a+b,0)!==stage+1))throw Error(`第${stage}章墨谱未保留`);
   if(stage===2){const c=r.chapter2;
    if(c.segments.length!==10||!c.events.includes('beacon.cleared'))throw Error('第二章剧情机制未完成');
    if(c.maxBullets>report.runtime.bulletCap||c.maxEnemies>Math.round(14*report.runtime.enemyCount))throw Error('第二章密度越界');
    if(c.roster.join(',')!=='laodun,moyuan')throw Error('第二章终点伙伴错误');
    if(!String(c.bossResults.mirage?.finalSource).startsWith('朱雀'))throw Error('蜃终击归属缺失');
   }
  }
  // 保留流程和运行错误门禁；旧版部件、数量、对白时长断言已移除。
  if(capture&&stage===range.last){
   if(r.state==='results'){
    await page.keyboard.down('Enter');await page.evaluate(()=>{const g=window.__game;g.input.poll();g.update(1/60);g.render();});await page.keyboard.up('Enter');
    await new Promise(r=>setTimeout(r,1100));
   }
   report.screenshot=resolve(out,`${activeSegment}-passed.png`);await page.screenshot({path:report.screenshot});}
  r.wall=(performance.now()-segmentStart)/1000;
  console.log(`通过 ${activeSegment} · ${r.wall.toFixed(1)}秒（游戏 ${r.simulatedSeconds.toFixed(1)}秒）`);
  if(stage<range.last){
   await page.evaluate(()=>{const g=window.__game;g.testRun=null;g.onResultsDone();g.world.debugAuto=false;});
   await page.waitForFunction('window.__game.state !== "loading"',{timeout:60000,polling:50});
   await page.evaluate(()=>window.__game.audio.diagnostics().musicReady());
  }
 }
 report.finalScore=await page.evaluate(()=>window.__game.world.score);
 report.extends=await page.evaluate(()=>window.__extendEvents);
 if(range.last===3&&!range.checkpoint){
  await page.evaluate(()=>{const g=window.__game;g.testRun=null;g.onResultsDone();});
  const end=await page.evaluate(()=>window.__game.state);if(end!=='ending')throw Error(`终章未到达 ${end}`);
 }
 report.playSeconds=report.stages.reduce((sum,s)=>sum+s.playSeconds,0);
 report.dialoguePauseSeconds=report.stages.reduce((sum,s)=>sum+s.dialoguePauseSeconds,0);
 report.flowComplete=true;report.complete=true;
} catch (error) {
 report.complete=false;report.failure=error.stack??String(error);
 const location=page?await page.evaluate(()=>{const w=window.__game?.world;return w?.bossE?`${w.bossE.def.boss?.name} / ${w.bossE.data.phaseTitle??w.bossE.data.phase??''}`:w?.currentCheckpoint;}).catch(()=>null):null;
 report.screenshot=resolve(out,`${activeSegment}-failed.png`);
 if(page){await page.evaluate(()=>window.__game?.render()).catch(()=>{});await page.screenshot({path:report.screenshot}).catch(()=>{report.screenshot=null;});}
 console.log(`没通过 ${activeSegment} · ${((performance.now()-segmentStart)/1000).toFixed(1)}秒 · ${location?`卡在 ${location}：`:''}${error.message}${report.screenshot?` · ${report.screenshot}`:''}`);
 error.flowReported=true;throw error;
} finally {
 report.wall=(performance.now()-totalStart)/1000;
 console.log(`总用时 ${report.wall.toFixed(1)}秒`);
 writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2));await browser.close();
}
 return report;

}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 await runValidation(process.argv[3] ?? '', process.argv[2] ?? 'http://127.0.0.1:5177/');
}
