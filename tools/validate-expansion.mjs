// 新机制端到端验收：真实输入反制、真实闭环笔画、三关逐章流程。
// 仅使用独立临时Chrome，不更改用户浏览器或主工作区。
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
// CLI: node tools/validate-expansion.mjs [服务URL] [额外URL参数: diff=normal&weapon=purple&power=8]
export async function runValidation(extra = '', base = 'http://127.0.0.1:5180/') {
 const url = new URL(base);
 const defaults = { god:'1', autofire:'1', bot:'1', power:'8', weapon:'purple', diff:'normal' };
 for (const [key,value] of Object.entries(defaults)) if (!url.searchParams.has(key)) url.searchParams.set(key,value);
 for (const [key,value] of new URLSearchParams(extra)) url.searchParams.set(key,value);
 const parameters = Object.fromEntries(url.searchParams);
 if (!['easy','normal','hard'].includes(parameters.diff)) throw new Error(`不支持难度 ${parameters.diff}`);
 if (!['red','blue','purple'].includes(parameters.weapon)) throw new Error(`不支持武器 ${parameters.weapon}`);
 if (!/^[1-8]$/.test(parameters.power)) throw new Error(`power 必须为1至8，收到 ${parameters.power}`);
 for (const key of ['god','autofire','bot']) if (parameters[key] !== '1') throw new Error(`完整自动验收要求 ${key}=1；不覆盖手工/有损通关参数`);
 for (const key of ['stage','skip']) if (url.searchParams.has(key)) throw new Error(`完整三关验收不支持 ${key} 参数`);
 // Mirror per-encounter Math.round in the current stage scripts, including uneven budgets.
 const quantity = { easy:.65, normal:1, hard:1.25 }[parameters.diff];
 const expectedBodies = [44*Math.max(1,Math.round(11*quantity))+4*Math.max(1,Math.round(10*quantity)), 48*Math.round(24*quantity)+16*Math.round(23*quantity), 16*Math.max(1,Math.round(9*quantity))+32*Math.max(1,Math.round(8*quantity))];
 const expectedTypes = [18,12,15];
const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
mkdirSync('.shots/expansion',{recursive:true});
const errors=[], report={url:url.href,parameters,bundle:[],expected:{bodies:expectedBodies,types:expectedTypes,milestones:4},input:[],stages:[],errors};
try {
 const page=await browser.newPage();await page.setViewport({width:1152,height:960});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 page.on('console',m=>{if(m.type()==='error'||/CONTEXT_LOST|INVALID_OPERATION|INVALID_FRAMEBUFFER|上下文丢失/.test(m.text()))errors.push(m.text());});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,1500));
 await page.goto(url.href,{waitUntil:'load'});
 report.bundle=await page.evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean));
 await page.waitForFunction('window.__game?.state === "title"',{timeout:60000});
 report.runtime=await page.evaluate(()=>({difficulty:window.__game.world.diffId,quantity:window.__game.world.diff.quantity,enemyCount:window.__game.world.diff.enemyCount}));
 if(report.runtime.difficulty!==parameters.diff || report.runtime.quantity!==quantity || report.runtime.enemyCount!==quantity) throw new Error(`构建难度与验收参数不匹配 ${JSON.stringify(report.runtime)}`);
 await new Promise(r=>setTimeout(r,3500));
 await page.screenshot({path:'.shots/expansion/title.png'});
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;window.__game.state='paused';});
 await new Promise(r=>setTimeout(r,100));
 report.bundle=await page.evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean));
 // 隔离反制：实际键盘按下，确认爆发反制不会扣炸弹库存。
 for(const [action,key] of [['bomb','x'],['focus','Shift']]) {
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
 // 使用实际Brush结算：实际C输入与移动轨迹，经游戏反制/落笔契约完成闭环。
 await page.evaluate(()=>{const g=window.__game,w=g.world;w.resetStage();w.player.entering=0;w.player.ink=1;w.player.x=520;w.player.y=620;w.spawn({sprite:'e_arraydisc',hp:45,noCollide:true},450,620,e=>{e.data.contentRole='prop';});window.__qteResult=null;w.root.run((function*(){window.__qteResult=yield* w.challenge({action:'brush',title:'闭环验收',hint:'圈住目标',duration:3});})());w.tick(1/60);});
 await page.keyboard.down('c');
 const drawing=await page.evaluate(()=>{const g=window.__game,w=g.world;g.input.poll();w.tick(1/60);for(let i=1;i<=96;i++){const a=i/96*Math.PI*2;w.player.x=450+Math.cos(a)*70;w.player.y=620+Math.sin(a)*70;g.input.axisX=g.input.axisY=0;w.tick(1/60);}return{started:w.brush.active,result:window.__qteResult,points:w.brush.pts.length};});
 await page.keyboard.up('c');
 const sealed=await page.evaluate(()=>{const g=window.__game,w=g.world;g.input.poll();w.tick(1/60);return{enemies:w.enemies.filter(e=>!e.dead).length,sealed:w.brush.sealed,level:w.progression.brushLevel};});
 if(!drawing.started||drawing.result!==true||sealed.enemies!==0||sealed.sealed<1)throw new Error(`真实闭环失败 ${JSON.stringify({drawing,sealed})}`);report.input.push({action:'brush',...drawing,...sealed});
 await page.evaluate(()=>{const g=window.__game;g.toTitle();g.onStart();g.world.debugAuto=false;
  const inp=g.input,origPressed=inp.pressed.bind(inp),origDown=inp.down.bind(inp),origConsume=inp.consume.bind(inp);
  window.__forced={pressed:new Set(),held:new Set(),paint:null};
  inp.pressed=a=>window.__forced.pressed.has(a)||origPressed(a);
  inp.down=a=>window.__forced.held.has(a)||origDown(a);
  inp.consume=a=>{window.__forced.pressed.delete(a);origConsume(a);};
 });
 for(let stage=1;stage<=3;stage++) {
  const r=await page.evaluate(async()=>{
   const g=window.__game,w=g.world,F=window.__forced,start=performance.now();let startLoadout=null;let frames=0,lastChallenge=null,paint=null;const events=[];
   while(g.state==='playing'&&performance.now()-start<480000&&frames<90000){
    for(let k=0;k<128&&g.state==='playing';k++){
     g.input.poll();F.pressed.clear();F.held.clear();
     const q=w.challengeState;
     if(q&&q!==lastChallenge){lastChallenge=q;F.pressed.add(q.action);events.push({title:q.title,action:q.action,t:w.t});if(q.action==='brush'){
       const n=w.enemies.find(e=>!e.dead&&/闭环|圈住|姓名珠|封天/.test(e.data.weakLabel??'')&&e!==w.bossE);
       const cx=n?.x??450,cy=n?.y??460;
       paint={cx,cy,frame:0};w.player.x=cx+72;w.player.y=cy;
      }}
     if(paint){F.held.add('brush');const a=paint.frame/96*Math.PI*2;w.player.x=paint.cx+Math.cos(a)*72;w.player.y=paint.cy+Math.sin(a)*72;g.input.axisX=g.input.axisY=0;if(paint.frame++>=96){paint=null;F.held.delete('brush');}}
     g.update(1/60);if(frames===0)startLoadout={difficulty:w.diffId,power:w.player.power,weapon:w.player.weapon};frames++;
    }
    g.render();await new Promise(r=>setTimeout(r,0));
   }
   return {stage:w.stageIndex,state:g.state,startLoadout,weapon:w.player.weapon,difficulty:w.diffId,t:w.t,frames,wall:(performance.now()-start)/1000,score:w.score,power:w.player.power,missile:w.player.missile,bodies:w.contentStats.bodies,types:[...w.contentStats.types],milestones:w.contentStats.milestones,challengeSuccess:w.contentStats.successes,challengeFail:w.contentStats.failures,events,talents:[...w.progression.talents.keys()],companions:w.companions.team.map(s=>({name:s.name,level:s.level})),live:w.enemies.filter(e=>!e.dead).map(e=>({sprite:e.def.sprite,hp:e.hp,label:e.data.weakLabel,phase:e.data.bodyPhase})),challenge:w.challengeState};
  });
  report.stages.push(r);console.log(JSON.stringify({...r,live:r.live.slice(0,6)}));
  if(stage===1 && (r.startLoadout?.power!==Number(parameters.power) || r.startLoadout?.weapon!==parameters.weapon)) throw new Error(`URL初始装备未应用：预期 power=${parameters.power}, weapon=${parameters.weapon}；实际 ${JSON.stringify(r.startLoadout)}`);
  await page.screenshot({path:`.shots/expansion/stage${stage}-results.png`});
  if(r.state!=='results'||r.stage!==stage||r.bodies!==expectedBodies[stage-1]||r.types.length!==expectedTypes[stage-1]||r.milestones!==4)throw new Error(`第${stage}关流程/内容未达标`);
  await page.evaluate(()=>{window.__game.onResultsDone();window.__game.world.debugAuto=false;});
 }
 const end=await page.evaluate(()=>window.__game.state);if(end!=='ending')throw new Error(`终章未到达 ${end}`);
 await page.screenshot({path:'.shots/expansion/ending.png'});
 if(errors.length)throw new Error(errors.join('\n'));
 report.complete=true;console.log('真实反制/闭环、三关内容与终章通过');
} catch (error) {
 report.complete=false; report.failure=error.stack ?? String(error); throw error;
} finally {writeFileSync('.shots/expansion/validation.json',JSON.stringify(report,null,2));await browser.close();}

}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 await runValidation(process.argv[3] ?? '', process.argv[2] ?? 'http://127.0.0.1:5180/');
}
