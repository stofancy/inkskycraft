// P3-12c：正式菜单进入剧情与首领，实际解锁和画横；终版32帧中30帧由本脚本采集。
// node tools/capture-final-ch1.mjs [URL] [主工作区绝对证据目录]
// 无敌仅用于观察，闭环与搭桥仍通过实际Brush采样；固定60Hz推进。
import {paintStroke,releaseStroke,mouseLine} from './mouse-paint.mjs';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const url=process.argv[2]??'http://127.0.0.1:5177/',out=process.argv[3];
if(!out?.startsWith('/'))throw Error('需要绝对证据目录');mkdirSync(out,{recursive:true});
const report={url,size:[1600,900],entries:[],checks:[],samples:[],errors:[]};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
try{
 const page=await browser.newPage();await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('console',m=>{if(m.type()==='error'||/缺少精灵|INVALID_OPERATION/.test(m.text()))report.errors.push(m.text());});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,1500));await page.goto(url);await page.waitForFunction(()=>window.__game?.state==='title',{timeout:60000});
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;const w=window.__game.world,original=w.say.bind(w);window.sliceLines=[];w.say=(actor,expression,text,duration)=>{window.sliceLines.push({name:typeof actor==='string'?actor:actor.name,expression,text,t:w.t,real:w.real});original(actor,expression,text,duration);};window.sliceDraw=[];for(const name of ['ground','air','player']){const layer=w.r[name],add=layer.add.bind(layer);layer.add=(id,d)=>{window.sliceDraw.push({layer:name,id:typeof id==='string'?id:id.id,...d});return add(id,d);};}});
 await new Promise(r=>setTimeout(r,100));
 const click=label=>page.evaluate(label=>{const el=[...document.querySelectorAll('.scr:not([aria-hidden]) .mi')].find(r=>r.querySelector('.ml')?.textContent===label);if(!el)throw Error(label);el.click();},label);
 const value=label=>page.evaluate(label=>[...document.querySelectorAll('.scr:not([aria-hidden]) .mi')].find(r=>r.querySelector('.ml')?.textContent===label)?.querySelector('.ms')?.textContent,label);
 const ticks=seconds=>page.evaluate(seconds=>{const g=window.__game;for(let i=0;i<Math.round(seconds*60);i++){if(g.state==='growth')document.querySelector('.scr:not([aria-hidden]) .choice-card:not(.unavailable)')?.click();g.input.poll();g.update(1/60);}window.sliceDraw=[];g.render();},seconds);
 const state=()=>page.evaluate(()=>{const g=window.__game,w=g.world,e=w.bossE,s=w.sceneState;return{checkpoint:w.currentCheckpoint,state:g.state,t:w.t,phase:e?.data.phaseIndex,result:e?.data.bossResult,action:e?.data.action,boss:e?{x:e.x,y:e.y,retreat:e.data.retreat,controllerAlpha:e.data.rig?.controller?.alpha}:null,route:s?{events:s.events,bossResults:s.bossResults,lastStrikeBlocked:s.lastStrikeBlocked,cart:{x:s.cart.x,y:s.cart.y},formed:s.formed}:null,team:w.companions.team.map(s=>s.kind),lines:window.sliceLines,bombT:w.player.bombT,protection:w.brush.protectionRemaining,draw:window.sliceDraw.filter(c=>/^ink_|^player$/.test(c.id))};});
 const shot=async name=>{await new Promise(r=>setTimeout(r,650));await page.screenshot({path:`${out}/${name}.png`});report.samples.push({name,...await state()});};
 const start=async(id,phase=1)=>{await page.evaluate(()=>{window.__game.toTitle();window.sliceLines=[];});await click('测 试');if(await value('无敌')==='关')await click('无敌');if(await value('满墨')==='关')await click('满墨');if(await value('满泼墨')==='关')await click('满泼墨');if(await value('伙伴 · 赤燕')==='关')await click('伙伴 · 赤燕');for(const k of ['老盾','墨鸢','算盘'])if(await value(`伙伴 · ${k}`)==='开')await click(`伙伴 · ${k}`);
  for(let i=0;i<15;i++){if((await value('起点'))?.startsWith(id))break;await click('起点');}assert((await value('起点'))?.startsWith(id));
  if(['纸龙','铜雀'].includes(id)){for(let i=0;i<5;i++){if((await value('Boss阶段'))?.startsWith(`${phase} /`))break;await click('Boss阶段');}assert((await value('Boss阶段'))?.startsWith(`${phase} /`));}
  const text=await page.evaluate(()=>document.querySelector('.scr:not([aria-hidden])').textContent);assert(text.includes('把一横写成桥'));assert(!text.includes('暂映射旧段'));await click('进入测试');
 };
 await shot('title');
 await page.evaluate(()=>{const g=window.__game;g.debug.god=true;g.onStart();g.input.poll();g.update(1/60);g.render();});
 await shot('chapter-title');
 assert(await page.evaluate(()=>[...document.querySelectorAll('.hero-letter img')].some(i=>i.alt==='下山修桥'&&i.complete&&i.naturalWidth>0)));
 for(const [id,sec]of [['E01',12],['E02',3],['E03',11],['E04',4],['E05',.6],['E06',13],['E07',19],['E08',11],['E09',.5],['E10',19]]){await start(id);await ticks(sec);const s=await state();assert.equal(s.checkpoint,id);report.entries.push({id,phase:0});await shot(id);}
 for(const [kind,count]of [['纸龙',3],['铜雀',3]]){
  await new Promise(r=>setTimeout(r,5000));await start(kind);await ticks(.1);await shot(kind==='纸龙'?'paper-warning':'copper-warning');
  const warning=await page.evaluate(()=>[...document.querySelectorAll('.hero-warning-paper img')].map(i=>({alt:i.alt,loaded:i.complete&&i.naturalWidth>0})));assert(warning.some(i=>i.alt==='强敌接近'&&i.loaded));assert(warning.some(i=>i.alt===kind&&i.loaded));
  for(let phase=1;phase<=count;phase++){await start(kind,phase);await ticks(3.2);await new Promise(r=>setTimeout(r,4400));await ticks(kind==='纸龙'?(phase===3?5.5:4):[4.8,5.5,5.5][phase-1]);assert.equal((await state()).phase,phase);const id=`${kind==='纸龙'?'PD-P':'TQ-T'}${phase}`;report.entries.push({id,phase});await shot(id);}
 }
 await start('铜雀',2);await ticks(3.2);await new Promise(r=>setTimeout(r,4400));
 assert(await page.evaluate(()=>{const g=window.__game;for(let i=0;i<120;i++){g.input.poll();g.update(1/60);if(g.world.brushForms.has('竖')){g.render();return true;}}return false;}));await shot('copper-vertical-unlock');assert(await page.evaluate(()=>[...document.querySelectorAll('.brush-letter-unlock img')].some(i=>i.alt==='竖'&&i.complete&&i.naturalWidth>0)));
 await start('E09');
 assert(await page.evaluate(()=>{const g=window.__game;for(let i=0;i<60*60;i++){if(g.state==='growth')document.querySelector('.scr:not([aria-hidden]) .choice-card:not(.unavailable)')?.click();g.input.poll();g.update(1/60);if(g.world.sceneState.events.includes('E09.BRIDGE.horizontalUnlocked')){g.render();return true;}}return false;}));
 await shot('bridge-horizontal-unlock');assert(await page.evaluate(()=>[...document.querySelectorAll('.brush-letter-unlock img')].some(i=>i.alt==='横'&&i.complete&&i.naturalWidth>0)));
 // 留给新字自然退场，再右键绘制真实横线，记录收笔前与通车中。
 await new Promise(r=>setTimeout(r,1600));await page.evaluate(()=>{const w=window.__game.world;w.player.entering=0;w.player.x=450;w.player.y=1050;w.player.ink=1;});await paintStroke(page,mouseLine([340,720],[560,720]),{hold:true});await shot('bridge-drawing');assert(await page.evaluate(()=>window.__game.world.brush.active));await releaseStroke(page);await ticks(1.3);assert.equal((await state()).route.formed,true);
 await page.waitForFunction(()=>{const d=document.querySelector('.communication[data-actor="工头"]'),i=d?.querySelector('.portrait img');return i?.complete&&i.naturalWidth>0;},{polling:100,timeout:5000});await shot('gongtou');await ticks(2.2);await shot('bridge-crossing');assert((await state()).route.cart.x>390&&(await state()).route.cart.x<590);report.checks.push('实际横与竖解锁字图、右键画横、通车与工头得意立绘');
 for(const [color,name,seconds]of [['blue','blue',.7],['red','red',.7],['purple','purple',.7]]){await start('E07');await ticks(5);await page.evaluate(color=>{const w=window.__game.world;w.player.entering=0;w.player.x=450;w.player.y=850;w.player.weapon=color;w.player.bomb();},color);await ticks(seconds);const s=await state();assert(s.bombT>0);await shot(`splash-${name}`);}report.checks.push('三种主射颜色下墨浪正常运行');
 report.cpuFrameTimes=await page.evaluate(()=>{const times=[];for(let i=0;i<60;i++){const t=performance.now();window.__game.render();times.push(performance.now()-t);}return times;});assert.deepEqual(report.errors,[]);assert.equal(report.entries.length,16);assert.equal(report.samples.length,28);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e);throw e;}finally{writeFileSync(`${out}/final-screens.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({status:report.status,entries:report.entries.length,screens:report.samples.length,checks:report.checks,errors:report.errors}));
