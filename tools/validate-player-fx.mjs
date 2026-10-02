// 朱雀机身粒子验收：同一 1600×900 场景、180 敌弹、三色 GPU/整帧时间，静飞及横移射击连拍。
// node tools/validate-player-fx.mjs [URL] [证据目录] [baseline|after]
// baseline 在修改前采集；after 与同一目录的旧数据对照。
// 无头 GPU Chrome；固定种子和 60Hz 世界更新；不启动正式巡游或修改 play 目录。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const [url='http://127.0.0.1:5184/',out='local-source/P6-06',mode='after']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
const result={mode,errors:[],performance:[],checks:{}};
try{
 const page=await browser.newPage();await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
 page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/INVALID_OPERATION|INVALID_FRAMEBUFFER/.test(m.text()))result.errors.push(m.text());});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,1500));await page.goto(url);await page.waitForFunction(()=>window.__game?.state==='title',{timeout:60000});
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;window.__game.state='paused';});await new Promise(r=>setTimeout(r,100));
 await page.evaluate(mode=>{
  if(mode!=='baseline')return;
  const w=window.__game.world,update=w.aura.update.bind(w.aura),emit=w.fx.emitHigh.bind(w.fx);let inside=false;window.oldFxLives=[];
  w.fx.emitHigh=spec=>{if(inside)window.oldFxLives.push(w.aura.time+spec.life+(spec.delay??0));emit(spec);};
  w.aura.update=dt=>{inside=true;try{update(dt);}finally{inside=false;}window.oldFxLives=window.oldFxLives.filter(t=>t>w.aura.time);};
 },mode);
 await page.evaluate(async()=>{
  const g=window.__game;g.onStart();window.updatePlayerGame=g.update.bind(g);g.update=()=>{};await document.fonts.ready;
  window.prepPlayer=(color,stress=false)=>{
   const w=g.world,p=w.player;w.resetStage();w.newGame();g.state='playing';g.ui.screen('none');w.debugAuto=false;w.stageIndex=1;w.stageName='出镖';g.r.setBackground('stage1');w.scroll=3000;
   w.companions.setRoster([]);w.companions.update=()=>{};w.companions.draw=()=>{};w.real=w.time=w.t=w.presentationTime=0;
   let seed=61006;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
   Object.assign(p,{x:450,y:850,bank:0,entering:0,invuln:0,power:4,weapon:color,firing:false});w.aura.clear();
   g.input.down=a=>a==='focus'||(a==='shoot'&&window.fxFiring);g.input.pressed=()=>false;g.input.consume=()=>{};g.input.axisX=g.input.axisY=0;window.fxFiring=false;
   if(stress){for(const [x,y]of[[240,250],[660,350],[450,450]])w.spawn({sprite:'e_hornet',hp:100000,noCollide:true},x,y);for(let i=0;i<180;i++)w.shoot(160+i%15*40,110+Math.floor(i/15)*50,0,0);}
   window.stepPlayer=(n,draw=true)=>{for(let i=0;i<n;i++){w.tick(1/60);if(draw)g.render();}};
  };
 });
 result.device=await page.evaluate(()=>{const r=window.__game.r,gl=r.gl,e=gl.getExtension('WEBGL_debug_renderer_info');return{gpu:gl.getParameter(e.UNMASKED_RENDERER_WEBGL),canvas:[r.canvas.width,r.canvas.height],quality:window.__game.settings.quality};});
 for(const color of ['red','blue','purple']){
  await page.evaluate(color=>{window.prepPlayer(color,true);window.fxFiring=true;window.stepPlayer(90);window.__game.r.startTimer('frame');},color);
  const samples=await page.evaluate(async()=>{
   const g=window.__game,gl=g.r.gl,rows=[];for(let i=0;i<180;i++){const t=performance.now();window.stepPlayer(1);const submitted=performance.now()-t;gl.finish();g.r.timer.poll();if(i>=60)rows.push({submitted,completed:performance.now()-t,gpu:g.r.timer.ms.frame,particles:g.world.aura.active??window.oldFxLives?.length??null,bullets:g.world.bullets.list.length});if(i%12===11)await new Promise(r=>setTimeout(r,0));}g.r.timer=null;return rows;
  });
  const mean=k=>samples.reduce((s,v)=>s+(v[k]??0),0)/samples.length,p95=k=>samples.map(v=>v[k]).sort((a,b)=>a-b)[Math.floor(samples.length*.95)];
  result.performance.push({color,gpuMean:mean('gpu'),completedMean:mean('completed'),completedP95:p95('completed'),submittedMean:mean('submitted'),particles:Math.max(...samples.map(v=>v.particles??0)),samples});
  console.log(JSON.stringify({...result.performance.at(-1),samples:undefined}));
  await page.evaluate(color=>{window.prepPlayer(color);window.stepPlayer(100);},color);
  if(mode==='after'&&color==='purple')await page.evaluate(()=>{for(let i=0;i<40&&!window.__game.world.aura.bolts.length;i++)window.stepPlayer(1);});
  await page.screenshot({path:`${out}/${mode}-${color}-idle.png`});
 }
 if(mode==='after'){
  const baseline=JSON.parse(readFileSync(`${out}/baseline-metrics.json`,'utf8'));
  result.comparison=result.performance.map((row,i)=>({color:row.color,oldParticles:baseline.performance[i].particles,newParticles:row.particles,oldGpuMean:baseline.performance[i].gpuMean,newGpuMean:row.gpuMean,oldCompletedMean:baseline.performance[i].completedMean,newCompletedMean:row.completedMean}));
  result.checks=await page.evaluate(()=>{
   const g=window.__game,w=g.world,p=w.player;window.prepPlayer('red');let peak=0;
   for(let i=0;i<180;i++){if(i%9===0)p.weapon=['red','blue','purple'][Math.floor(i/9)%3];window.stepPlayer(1);peak=Math.max(peak,w.aura.active);}
   const cap=w.r.playerFx.capacity,clearZone=w.r.playerFx.clearZone.slice();
   const before=w.aura.time;g.state='paused';window.updatePlayerGame(1/60);g.render();const paused=w.aura.time===before;g.state='playing';
   p.alive=false;window.stepPlayer(1);const death=w.aura.active;p.reset(false);window.stepPlayer(30);w.resetStage();const reset=w.aura.active;
   window.prepPlayer('red');window.stepPlayer(60);p.weapon='blue';window.stepPlayer(1);const switchBurst=w.aura.burst;window.stepPlayer(10);const switchDone=w.aura.burst===0;
   return{peak,cap,clearZone,paused,death,reset,switchBurst,switchDone,glError:w.r.gl.getError()};
  });
  assert.ok(result.checks.peak>0&&result.checks.peak<=800);assert.equal(result.checks.cap,800);assert.ok(result.checks.paused&&result.checks.switchDone);assert.equal(result.checks.death,0);assert.equal(result.checks.reset,0);assert.equal(result.checks.glError,0);
  for(const row of result.comparison)assert.ok(row.newGpuMean<=row.oldGpuMean+.1,`${row.color} GPU 增量超过 0.1ms`);
  for(const row of result.performance)assert.ok(row.completedP95<20,`${row.color} 整帧超过 20ms`);
  await page.evaluate(()=>{window.prepPlayer('red');window.stepPlayer(90);window.fxFiring=true;window.__game.input.axisX=1;});
  for(let i=0;i<6;i++){await page.evaluate(()=>window.stepPlayer(3));await page.screenshot({path:`${out}/red-move-fire-${i+1}.png`});}
  // 在浏览器 Canvas 中拼接游戏画面的同一区域，六帧保持固定镜头，间隔 50ms。
  const frames=[];for(let i=0;i<6;i++)frames.push(readFileSync(`${out}/red-move-fire-${i+1}.png`).toString('base64'));
  const rect=await page.evaluate(()=>{const r=window.__game.r.canvas.getBoundingClientRect();return{x:r.x+r.width*.5-160,y:r.y+r.height*850/1200-110};});
  const png=await page.evaluate(async({frames,rect})=>{const c=document.createElement('canvas');c.width=320*6;c.height=270;const ctx=c.getContext('2d');for(let i=0;i<6;i++){const img=new Image();img.src='data:image/png;base64,'+frames[i];await img.decode();ctx.drawImage(img,rect.x,rect.y,320,270,i*320,0,320,270);}return c.toDataURL('image/png').split(',')[1];},{frames,rect});
  writeFileSync(`${out}/red-move-fire-six.png`,Buffer.from(png,'base64'));
 }
 assert.deepEqual(result.errors,[]);result.passed=true;
}finally{writeFileSync(`${out}/${mode}-metrics.json`,JSON.stringify(result,null,2));await browser.close();}
