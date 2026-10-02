// P6-07：无头 GPU Chrome；真实第三章弹幕峰值冻结后，三色开火/泼墨帧预算及六帧拼图。
// node tools/validate-p6-07.mjs [URL] [证据目录] [baseline|after]
// 固定1600×900、种子、60Hz；峰值扫描只在baseline执行，after重放同一时刻。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const [url='http://127.0.0.1:5177/',out='local-source/P6-07',mode='after']=process.argv.slice(2);
mkdirSync(out,{recursive:true});const result={mode,baselineCommit:'82b49ab',seed:607,errors:[],performance:[]};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
try{
 const page=await browser.newPage();await page.setViewport({width:1600,height:900,deviceScaleFactor:1});page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/INVALID_OPERATION|INVALID_FRAMEBUFFER/.test(m.text()))result.errors.push(m.text());});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,1500));await page.goto(url);await page.waitForFunction(()=>window.__game?.state==='title',{timeout:60000});
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;window.__game.state='paused';});await new Promise(r=>setTimeout(r,100));
 await page.evaluate(async()=>{
  const g=window.__game;g.onStart();g.update=()=>{};await document.fonts.ready;
  window.prepDense=async(checkpoint='W01')=>{let seed=607;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
   g.toTitle();g.onTestStart({chapter:3,checkpoint,bossPhase:1,god:true,fullInk:true,fullBombs:true,brushPower:1,brushMethods:[],skills:[],companions:[],passives:[],bombColor:'red',inkScore:{red:0,blue:0,purple:0}});
   while(g.state==='loading')await new Promise(r=>setTimeout(r,10));const w=g.world;w.rng.s=607;g.debug.god=true;g.ui.screen('none');w.debugAuto=false;g.input.down=()=>false;g.input.pressed=()=>false;g.input.consume=()=>{};g.input.axisX=g.input.axisY=0;
   Object.assign(w.player,{x:450,y:1000,entering:0,invuln:99999,power:4});};
  window.stepFx=(n,draw=true)=>{for(let i=0;i<n;i++){if(g.state==='growth')g.onChoice(g.world.progression.offerTalents()[0]?.id);if(g.ui.dialogueState().active){g.ui.dialogueAdvance();g.ui.dialogueAdvance();}g.world.tick(1/60);if(draw)g.render();}};
  window.freezeDense=()=>{const w=g.world;w.root.paused=true;for(const e of w.enemies){e.hp=e.maxHp=1000000;e.def={...e.def,noCollide:true};e.vx=e.vy=0;}for(const b of w.bullets.list){b.speed=b.accel=b.angVel=0;b.life=Infinity;b.hard=true;b.update=()=>{};}w.chapter2=null;g.input.down=a=>a==='shoot';};
  window.prepPicture=color=>{const w=g.world;w.resetStage();w.newGame();g.state='playing';g.ui.screen('none');w.debugAuto=false;w.stageIndex=1;g.r.setBackground('stage1');w.scroll=3000;w.companions.setRoster([]);w.companions.update=()=>{};w.companions.draw=()=>{};
   Object.assign(w.player,{x:450,y:970,entering:0,invuln:0,power:4,weapon:color,bombs:6});w.inkScore.levels[color]=0;w.aura.clear();g.input.down=a=>a==='shoot';g.input.axisX=g.input.axisY=0;
   for(const [x,y]of [[250,300],[650,390],[450,510]])w.spawn({sprite:'e_hornet',hp:1000000,noCollide:true},x,y);
   for(let i=0;i<36;i++)w.shoot(180+i%9*65,220+Math.floor(i/9)*100,0,0,{hard:true});};
 });
 result.device=await page.evaluate(()=>{const r=window.__game.r,gl=r.gl,e=gl.getExtension('WEBGL_debug_renderer_info');return{gpu:gl.getParameter(e.UNMASKED_RENDERER_WEBGL),canvas:[r.canvas.width,r.canvas.height],quality:window.__game.settings.quality};});
 if(mode==='baseline')result.peak=await page.evaluate(async()=>{
  let peak={frame:0,bullets:0};window.denseScan=[];
  for(let wave=0;wave<48;wave++){
   const checkpoint='W'+String(wave+1).padStart(2,'0');await window.prepDense(checkpoint);let row={checkpoint,frame:0,bullets:0};
   for(let i=1;i<=720;i++){window.stepFx(1,false);const w=window.__game.world,count=w.bullets.list.filter(b=>!b.dead&&b.x>=0&&b.x<=900&&b.y>=0&&b.y<=1200).length;
    if(count>row.bullets)row={frame:i,bullets:count,checkpoint};if(count>peak.bullets)peak={frame:i,bullets:count,checkpoint};
    if(i%120===0){window.__game.render();await new Promise(r=>setTimeout(r,0));}
   }window.denseScan.push(row);
  }return{...peak,scan:window.denseScan};
 });
 else result.peak=JSON.parse(readFileSync(`${out}/baseline-metrics.json`)).peak;
 assert.ok(result.peak.bullets>0);console.log('peak', {...result.peak,scan:undefined});
 for(const color of ['red','blue','purple'])for(const bomb of [false,true]){
  await page.evaluate(async({color,frame,checkpoint})=>{await window.prepDense(checkpoint);window.stepFx(frame,false);window.freezeDense();const w=window.__game.world;Object.assign(w.player,{weapon:color,entering:0,alive:true,bombs:6});window.stepFx(90);}, {color,frame:result.peak.frame,checkpoint:result.peak.checkpoint});
  if(bomb)assert.ok(await page.evaluate(()=>{const w=window.__game.world;w.player.bomb();return !!w.mantra.cast;}));
  await page.evaluate(()=>window.__game.r.startTimer('frame'));
  const samples=await page.evaluate(async()=>{const g=window.__game,gl=g.r.gl,rows=[];for(let i=0;i<180;i++){const t=performance.now();window.stepFx(1);const submitted=performance.now()-t;gl.finish();g.r.timer.poll();if(i>=30)rows.push({submitted,completed:performance.now()-t,gpu:g.r.timer.ms.frame,particles:g.world.aura.active,bombParticles:g.world.mantra.cast?.particles??0,bullets:g.world.bullets.list.filter(b=>!b.dead).length});if(i%12===11)await new Promise(r=>setTimeout(r,0));}g.r.timer=null;return rows;});
  const mean=k=>samples.reduce((s,v)=>s+v[k],0)/samples.length,p95=k=>samples.map(v=>v[k]).sort((a,b)=>a-b)[Math.floor(samples.length*.95)];
  const row={color,bomb,gpuMean:mean('gpu'),completedMean:mean('completed'),completedP95:p95('completed'),submittedMean:mean('submitted'),particles:Math.max(...samples.map(v=>v.particles)),bombParticles:Math.max(...samples.map(v=>v.bombParticles)),bullets:Math.max(...samples.map(v=>v.bullets)),samples};result.performance.push(row);console.log(JSON.stringify({...row,samples:undefined}));
 }
 if(mode==='after'){
  const old=JSON.parse(readFileSync(`${out}/baseline-metrics.json`));result.comparison=result.performance.map((r,i)=>({color:r.color,bomb:r.bomb,oldGpu:old.performance[i].gpuMean,newGpu:r.gpuMean,oldCompleted:old.performance[i].completedMean,newCompleted:r.completedMean}));
  for(const color of ['red','blue','purple']){
   await page.evaluate(color=>{window.prepPicture(color);window.stepFx(90);},color);
   const frames=[];for(const [i,n]of [0,6,18,20,30,45].entries()){
    if(i===2){await page.keyboard.down('KeyF');await page.evaluate(()=>{const g=window.__game;g.input.poll();g.world.player.bomb();});await page.keyboard.up('KeyF');}
    await page.evaluate(n=>window.stepFx(n),n);const path=`${out}/${color}-${i+1}.png`;await page.screenshot({path});frames.push(readFileSync(path).toString('base64'));
   }
   const png=await page.evaluate(async frames=>{const r=window.__game.r.playCss,c=document.createElement('canvas');c.width=540*6;c.height=720;const ctx=c.getContext('2d');for(let i=0;i<6;i++){const im=new Image();im.src='data:image/png;base64,'+frames[i];await im.decode();if(i<2)ctx.drawImage(im,r.x+r.w*300/900,r.y+r.h*680/1200,r.w*300/900,r.h*400/1200,i*540,0,540,720);else ctx.drawImage(im,r.x,r.y,r.w,r.h,i*540,0,540,720);}return c.toDataURL('image/png').split(',')[1];},frames);writeFileSync(`${out}/${color}-six.png`,Buffer.from(png,'base64'));
  }
  for(const row of result.comparison)assert.ok(row.newGpu<=row.oldGpu+.15,`${row.color} GPU增加超过0.15ms`);
  result.checks=await page.evaluate(()=>{const g=window.__game,w=g.world;window.prepPicture('red');window.stepFx(60);const before=w.aura.time;g.state='paused';g.render();const paused=before===w.aura.time;w.player.alive=false;window.stepFx(1);const death=w.aura.active;w.resetStage();return{paused,death,reset:w.aura.active,cap:w.r.playerFx.capacity,glError:w.r.gl.getError()};});
  assert.ok(result.checks.paused);assert.equal(result.checks.death,0);assert.equal(result.checks.reset,0);assert.equal(result.checks.glError,0);for(const r of result.performance){assert.ok(r.particles<=800);assert.ok(r.bombParticles<=1500);assert.ok(r.completedP95<20);}
 }
 assert.deepEqual(result.errors,[]);result.passed=true;
}finally{writeFileSync(`${out}/${mode}-metrics.json`,JSON.stringify(result,null,2));await browser.close();}
