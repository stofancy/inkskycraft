// P6-02：无头游戏内 1600×900 截图，核对普通库存与满泼墨入口的图标数。
// node tools/capture-p6-sky.mjs [URL] [绝对截图目录]
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const [url='http://127.0.0.1:5177/',out='local-source/P6-02']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
const errors=[],samples=[];
try {
 const page=await browser.newPage();await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/图片加载失败|缺少精灵|INVALID_OPERATION/.test(m.text()))errors.push(m.text());});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,1500));await page.goto(url);await page.waitForFunction(()=>window.__game?.state==='title',{timeout:60000});
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await new Promise(r=>setTimeout(r,100));
 const start=async(checkpoint,fullBombs=false)=>{
  await page.evaluate(async({checkpoint,fullBombs})=>{
   const g=window.__game;g.toTitle();const {defaultTestOptions}=await import('/src/game/test-options.ts');
   g.onTestStart({...defaultTestOptions(),chapter:1,checkpoint,god:true,fullInk:true,fullBombs});
  },{checkpoint,fullBombs});
  await page.waitForFunction(()=>window.__game.state!=='loading',{timeout:60000,polling:50});
 };
 const advance=async seconds=>page.evaluate(async seconds=>{
  const g=window.__game;
  let frames=0;
  for(let i=0;frames<seconds*60&&i<12000;i++){
   while(g.world.cardActive)await new Promise(r=>setTimeout(r,20));
   if(g.world.dialoguePaused){g.ui.dialogueAdvance();g.ui.dialogueAdvance();}else frames++;
   if(g.state==='growth')document.querySelector('.choice-card:not(.unavailable)')?.click();
   g.input.poll();g.update(1/60);
   if(i%128===0)await new Promise(r=>setTimeout(r,0));
  }
  g.render();
 },seconds);
 const state=()=>page.evaluate(()=>{
  const g=window.__game,w=g.world;
  return {checkpoint:w.currentCheckpoint,t:w.t,real:w.real,bombs:w.player.bombs,icons:document.querySelectorAll('[data-k="bombs"] img').length,
   vessels:w.scenery.filter(s=>s.sprite==='sky_migration-ship'&&!s.dead).length,boss:w.bossE?.def.sprite,gate:w.sceneState?.bridge.filter(s=>!s.dead).map(s=>s.sprite)};
 });
 await start('E07');await advance(6);await new Promise(r=>setTimeout(r,5500));await advance(.2);
 const normal=await state();if(normal.bombs!==normal.icons||normal.bombs!==3)throw Error('普通库存显示异常 '+JSON.stringify(normal));
 await page.screenshot({path:out+'/02-fleet.png'});samples.push({file:'02-fleet.png',...normal});
 for(const [checkpoint,file,seconds]of [['SERPENT','03-paper-dragon.png',18],['SPARROW','04-copper-gate.png',8]]){
  await start(checkpoint);await advance(seconds);await new Promise(r=>setTimeout(r,5500));await advance(.2);
  if(!await page.evaluate(()=>!!window.__game.world.bossE))throw Error('首领尚未登场 '+checkpoint);
  await page.screenshot({path:out+'/'+file});samples.push({file,...await state()});
 }
 await start('E07',true);await advance(.2);const full=await state();if(full.bombs!==full.icons||full.bombs!==6)throw Error('满泼墨库存显示异常 '+JSON.stringify(full));
 if(errors.length)throw Error(errors.join('\n'));
 writeFileSync(out+'/capture-checks.json',JSON.stringify({size:[1600,900],samples,normalBombs:normal,fullBombs:full,errors},null,2)+'\n');
 console.log(JSON.stringify({samples,fullBombs:full,errors}));
}finally{await browser.close();}
