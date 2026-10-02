// P0-05 / P2-06 招式验收：真实键盘、模拟标准 Gamepad、五招作用与连续帧截图。
// 用法：node tools/validate-moves.mjs [服务 URL] [输出目录]
// 手柄使用 navigator.getGamepads 的标准形状；硬件手感仍需人工验收。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {validateExpandedMoves} from './validate-moves-expanded.mjs';
const base=process.argv[2]??'http://127.0.0.1:5177/';
const out=process.argv[3]??'.shots/p2-06';mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
const errors=[],checks=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
 const page=await browser.newPage();await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('about:blank');await delay(2000);
 await page.goto(`${base}?stage=1&god=1`,{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>window.__game?.state==='playing');
 await delay(3500); // 章节卡退场后记录招式，避免遮住效果。
 // 纯识别边界通过同一源模块验证，覆盖实际误触与容错路径。
 const matcher=await page.evaluate(async()=>{
  const {DirectionBuffer,directionFromAxes}=await import('/src/core/commands.ts');
  const test=(events,seq,now,window=1.4)=>{const b=new DirectionBuffer();events.forEach(([d,t])=>b.sample(d,t));return b.matches({sequence:seq,window},now);};
  const normal=[[2,0],[5,.1],[2,.15],[8,.3],[5,.4],[8,.45]];
  return {
   repeated:test(normal,[2,2,8,8],.5),holdRejected:!test([[2,0],[2,.1],[8,.3],[8,.4]],[2,2,8,8],.45),
   diagonalTolerance:test([[1,0],[5,.1],[3,.15],[7,.3],[5,.4],[9,.45]],[2,2,8,8],.5),
   quarter:test([[2,0],[3,.1],[6,.2]],[2,3,6],.25),diagonalRequired:!test([[2,0],[6,.2]],[2,3,6],.25),
   lateKeyRejected:!test(normal,[2,2,8,8],.8),staleRejected:!test([[2,0],[5,.1],[2,.2],[8,1.3],[5,1.4],[8,1.45]],[2,2,8,8],1.5),
   extraDirectionRejected:!test([[2,0],[4,.08],[3,.1],[6,.2]],[2,3,6],.25),
   jitterRejected:!test([[2,0],[5,.01],[2,.02],[8,.1],[5,.11],[8,.12]],[2,2,8,8],.2),
   axes:directionFromAxes(0,-1)===8&&directionFromAxes(0,1)===2&&directionFromAxes(.7,.7)===3&&directionFromAxes(.1,.1)===5,
   bounded:(()=>{const b=new DirectionBuffer();for(let i=0;i<100;i++)b.sample(i%2?2:5,i);return b.history.length===32;})(),
  };
 });Object.entries(matcher).forEach(([k,v])=>{assert.equal(v,true,k);checks.push(k);});
 const state=()=>page.evaluate(()=>{const w=window.__game.world;return {total:w.moves.total,id:w.moves.lastId,feedback:w.moves.feedback,ink:w.player.ink,x:w.player.x,y:w.player.y,hits:w.moves.lastHits,cleared:w.moves.lastCleared,passive:w.combos.total,bombs:w.player.bombs,brush:w.brush.active,firing:w.player.firing,ordinary:w.bullets.list.filter(b=>!b.dead&&!b.hard).length,hard:w.bullets.list.filter(b=>!b.dead&&b.hard).length};});
 const tap=async(key,ms=65)=>{await page.keyboard.down(key);await delay(ms);await page.keyboard.up(key);await delay(55);};
 const guard=async()=>{for(const k of ['ArrowDown','ArrowDown','ArrowUp','ArrowUp'])await tap(k);};
 const quarter=async()=>{await page.keyboard.down('ArrowDown');await delay(70);await page.keyboard.down('ArrowRight');await delay(70);await page.keyboard.up('ArrowDown');await delay(70);await page.keyboard.up('ArrowRight');};
 const prepare=()=>page.evaluate(()=>{const w=window.__game.world;w.moves.resetStage();w.player.ink=1;w.player.x=450;w.player.y=850;w.root.cancel();w.enemies=[];w.bullets.clear();});
 await prepare();const before=await state();await page.keyboard.down('KeyZ');await guard();
 await page.evaluate(()=>{const w=window.__game.world;for(const dx of [-60,0,60])w.shoot(w.player.x+dx,w.player.y-100,0,0);w.shoot(w.player.x,w.player.y-100,0,0,{hard:true});});
 await tap('KeyF',30);const g=await state();assert.equal(g.id,'guard');assert.equal(g.total,before.total+1);assert.equal(g.cleared,3);assert.equal(g.passive,before.passive);assert.equal(g.bombs,before.bombs);assert.equal(g.firing,true);assert.equal(g.ordinary,0);assert.equal(g.hard,1);assert.ok(g.ink>=.82&&g.ink<.85);await page.keyboard.up('KeyZ');checks.push('keyboard guard / clear ordinary bullets / preserve hard bullet and passive history');
 await page.screenshot({path:`${out}/01-guard.png`});await delay(130);await page.screenshot({path:`${out}/02-guard-ring.png`});
 const layout=await page.evaluate(()=>{const p=document.querySelector('.active-moves'),r=p.getBoundingClientRect(),k=p.closest('.moves-dock');return {display:getComputedStyle(k).display,rect:{x:r.x,y:r.y,w:r.width,h:r.height},text:p.textContent};});assert.notEqual(layout.display,'none');assert.ok(layout.rect.h>0);checks.push('wide sidebar visible');
 await page.evaluate(()=>window.__game.world.say('曜雀','坚定','演出期间仍可出招。',5));
 assert.equal(await page.$eval('.moves-dock',e=>getComputedStyle(e).visibility),'visible');
 assert.equal(await page.$$('.active-move').then(x=>x.length),5);checks.push('five commands persist during dialogue');
 await guard();await tap('KeyF');assert.match((await state()).feedback,/冷却/);assert.equal((await state()).total,g.total);checks.push('cooldown rejects repeat');
 await prepare();await quarter();await page.evaluate(()=>{const w=window.__game.world;w.spawn({sprite:'e_hornet',hp:200,score:0},w.player.x,w.player.y-220);w.shoot(w.player.x,w.player.y-120,0,0);});
 await tap('KeyU',30);const cut=await state();assert.equal(cut.id,'cut');assert.equal(cut.hits,1);assert.equal(cut.cleared,1);assert.equal(cut.total,g.total+1);checks.push('keyboard diagonal + U / cut hits target and clears corridor');await page.screenshot({path:`${out}/03-cut.png`});
 await prepare();await page.evaluate(()=>window.__game.world.player.ink=0);await quarter();await tap('KeyF');assert.match((await state()).feedback,/墨不足/);assert.equal((await state()).total,cut.total);checks.push('insufficient ink');
 await prepare();await guard();await tap('Escape');await delay(100);await tap('Escape');await delay(100); // 暂停恢复由 UI 处理
 if(await page.evaluate(()=>window.__game.state!=='playing'))await page.evaluate(()=>window.__game.onResume());
 await tap('KeyF');assert.equal((await state()).total,cut.total);checks.push('pause clears direction history');
 await prepare();await guard();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await delay(60);await tap('KeyF');assert.equal((await state()).total,cut.total);checks.push('blur clears direction history');
 await prepare();await guard();await page.evaluate(()=>{window.__game.world.challengeState={action:'focus',title:'验收窗口',hint:'集中',duration:5,remaining:5,result:null,elapsed:0};});await tap('KeyF');assert.equal((await state()).total,cut.total);assert.match((await state()).feedback,/暂不可用/);await page.evaluate(()=>window.__game.world.challengeState=null);checks.push('Boss challenge blocks active move');
 // 模拟标准手柄；保持由 Input.poll 读取，避免直接喂给匹配器。
 await prepare();await page.evaluate(()=>{window.testPad={id:'P0-05 standard pad',index:0,connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.testPad]});});
 const pad=async(x,y,key=false)=>{await page.evaluate(([x,y,key])=>{window.testPad.axes=[x,y];window.testPad.buttons[11]={pressed:key,value:key?1:0};},[x,y,key]);await delay(75);};
 await pad(0,1);await pad(0,0);await pad(0,1);await pad(0,-1);await pad(0,0);await pad(0,-1);await pad(0,-1,true);const pg=await state();assert.equal(pg.total,cut.total+1);assert.equal(pg.id,'guard');checks.push('standard gamepad stick + R3');await page.screenshot({path:`${out}/04-gamepad.png`});await pad(0,0);
 await prepare();const moveStart=await state();await page.evaluate(()=>{window.testPad.buttons[13]={pressed:true,value:1};});await delay(75);await page.evaluate(()=>{window.testPad.buttons[15]={pressed:true,value:1};});await delay(75);await page.evaluate(()=>{window.testPad.buttons[13]={pressed:false,value:0};});await delay(75);await pad(0,0,true);const pc=await state();assert.equal(pc.id,'cut');assert.equal(pc.total,pg.total+1);assert.ok(pc.x>moveStart.x);checks.push('standard gamepad D-pad diagonal + R3 / movement preserved');
 await page.setViewport({width:900,height:1200});await delay(200);await page.screenshot({path:`${out}/06-narrow-feedback.png`});assert.equal(await page.$eval('.move-feedback-card',e=>getComputedStyle(e).display),'block');checks.push('narrow feedback visible');assert.equal(await page.$$('.active-move').then(x=>x.length),5);assert.equal(await page.$eval('.moves-dock',e=>getComputedStyle(e).visibility),'visible');checks.push('narrow persistent commands');await page.evaluate(()=>{window.testPad.buttons=window.testPad.buttons.map(()=>({pressed:false,value:0}));});await tap('Escape');await page.evaluate(()=>{const e=[...document.querySelectorAll('.mi')].find(e=>e.textContent.includes('出招表'));e?.click();});await delay(100);assert.ok(await page.$eval('.move-book',e=>!e.hidden));await page.screenshot({path:`${out}/05-narrow-move-book.png`});checks.push('narrow pause move book');
 const expanded=await validateExpandedMoves(page,out,checks);
 assert.deepEqual(errors,[],'page errors');
 writeFileSync(`${out}/validation.json`,JSON.stringify({checks,matcher,expanded,keyboard:{guard:g,cut},gamepad:{guard:pg,cut:pc},layout,errors,hardware:'standard Gamepad API simulated; physical device not tested'},null,2));console.log(JSON.stringify({checks:checks.length,errors,out}));
} finally {await browser.close();}
