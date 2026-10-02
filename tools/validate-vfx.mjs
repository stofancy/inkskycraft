// P1-05：固定世界时钟的游戏内前后对照、帧序列及 30 爆炸压测。
// 用法：node tools/validate-vfx.mjs <dev URL> <输出目录> [before|after]
// 固定场景走 World.damage / World.kill；键鼠输入另跑 validate-controls。
// VFX_SKIP_BENCH=1 仅重采视觉与预览页，保留已验证的性能记录。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const [url='http://127.0.0.1:5177/',out='.shots/p1-05',version='after']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
const errors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
 const page=await browser.newPage();await page.setViewport({width:1600,height:1000,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('CONTEXT_LOST_WEBGL'))errors.push(m.text());});
 await page.goto('about:blank');await delay(2000);
 await page.goto(`${url}?stage=1&god=1`,{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>window.__game?.state==='playing');await delay(3500);
 await page.evaluate(async()=>{
  const g=window.__game,w=g.world,r=g.r;

  g.update=()=>{};
  const add=r.inkBursts.layer.add.bind(r.inkBursts.layer);window.vfxDraw=[];r.inkBursts.layer.add=(id,params)=>{window.vfxDraw.push({id,...params});return add(id,params);};
  window.vfxReset=()=>{
   w.resetStage();
   w.fx.clear();r.partLow.reset();r.partHigh.reset();r.fluid.clear();r.lights.clear();
   w.player.x=450;w.player.y=1000;w.player.entering=0;w.player.ink=1;
   w.time+=5;w.real=w.time;r.partLow.time=r.partHigh.time=w.visualTime;w.dt=0;
   w.fx.shakeEnabled=false;w.bgFlashValue=0;
  };
  window.vfxStep=dt=>{
   w.time+=dt;w.real=w.time;r.partLow.time=r.partHigh.time=w.visualTime;
   w.fx.update(dt,dt,w.time);window.vfxDraw=[];g.render();
  };
  window.vfxSetup=mode=>{
   window.vfxReset();
   if(mode==='moves'){
    w.player.x=240;w.brush.paths.spear([240,850,240,580]);
    w.player.x=660;w.roll.update(0);
   }else if(mode==='hits'){
    const boss=w.spawn({sprite:'b_sparrow_body',hp:10000,noCollide:true,boss:{name:'同一机体三色命中',phases:1,music:'boss1'}},450,310);
    boss.scaleX=2.7;boss.scaleY=1.4;window.vfxBoss=boss;
    for(const [i,source]of ['blue','red','purple'].entries()){
     const x=220+i*230;w.damage(boss,2,310+i*140,300,true,source);
     const e=w.spawn({sprite:'e_hornet',hp:1000,noCollide:true},x,660);w.damage(e,2,x,680,true,source);
     w.shoot(340+i*140,300,0,0,{color:'magenta'});w.shoot(x+30,680,0,0,{color:'magenta'});
    }
    boss.invulnerable=true;w.damage(boss,2,450,235,true,'neutral');boss.invulnerable=false;
   }else{
    for(const [i,size]of ['s','m','l'].entries()){
     const e=w.spawn({sprite:'e_hornet',hp:10,score:0,explosion:size},170+i*280,540);
     e.lastDamageSource='red';w.kill(e);
    }
   }
   window.vfxStep(0);
  };
 });
 for(const mode of ['moves','hits','explosion']){
  await page.evaluate(m=>window.vfxSetup(m),mode);
  let last=0;
  const times=mode==='hits'?[.02,.07,.14,.25]:mode==='moves'?[.03,.10,.22,.48,.64,.70]:[.03,.12,.24,.45,.75,1.2,1.6];
  for(const time of times){
   await page.evaluate(dt=>window.vfxStep(dt),time-last);last=time;await delay(35);
   await page.screenshot({path:`${out}/${version}-${mode}-${time.toFixed(2)}.png`});
  }
 }
 const checks=version==='after'?await page.evaluate(async()=>{
  const g=window.__game,w=g.world,r=g.r,checks={};
  window.vfxSetup('hits');const boss=window.vfxBoss,hp=boss.hp;
  boss.invulnerable=true;w.damage(boss,10,450,235,true,'purple');checks.blockedHpUnchanged=boss.hp===hp;
  boss.invulnerable=false;w.damage(boss,10,450,400,true,'purple');checks.successHpDecreased=boss.hp===hp-10;
  window.vfxSetup('explosion');checks.threeBurstSizes=r.inkBursts.count===3&&JSON.stringify(window.vfxDraw.map(d=>d.sx*256))===JSON.stringify([125,225,355]);
  window.vfxStep(1.6);checks.expiredBurstsRemoved=r.inkBursts.count===0;
  window.vfxSetup('explosion');const frames=()=>window.vfxDraw.map(d=>({frame:d.frame,sx:d.sx,sy:d.sy}));
  window.vfxStep(.2);const a=frames();window.vfxStep(0);checks.pausedFrameStable=JSON.stringify(a)===JSON.stringify(frames());
  w.fx.clear();checks.stageResetClearsBursts=r.inkBursts.count===0;
  r.setBackground('stage2');window.vfxSetup('explosion');checks.otherChapterKeepsVolumetric=r.inkBursts.count===0;
  r.setBackground('stage1');window.vfxReset();w.fx.explosion(450,500,'m','fire');checks.playerExplosionKeepsVolumetric=r.inkBursts.count===0;
  return checks;
 }):{};
 for(const [k,v]of Object.entries(checks))assert.equal(v,true,k);
 const result=await page.evaluate(()=>({gpu:window.__game.r.gpuName(),viewport:window.__game.r.playPx,quality:window.__game.r.quality,glError:window.__game.r.gl.getError()}));
 assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 writeFileSync(`${out}/${version}-validation.json`,JSON.stringify({...result,checks,errors},null,2));
 if(version==='after'){
  if(!process.env.VFX_SKIP_BENCH){
  const benchmark=await page.evaluate(async()=>{
   const g=window.__game,w=g.world,r=g.r,gl=r.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   const originalRender=g.render;g.render=()=>{};
   const stats=values=>{const a=[...values].sort((a,b)=>a-b);return {samples:a.length,mean:a.reduce((x,y)=>x+y,0)/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
   const run=async(stress)=>{
    window.vfxReset();
    const boss=w.spawn({sprite:'b_sparrow_body',hp:1e8,noCollide:true},450,290);
    const enemies=[220,450,680].map(x=>w.spawn({sprite:'e_hornet',hp:1e8,noCollide:true},x,800));
    for(let i=0;i<120;i++)w.shoot(80+i%12*67,160+Math.floor(i/12)*85,0,0,{color:'magenta'});
    const pending=[],gpu=[],cpu=[],raf=[],counts=[];let previous=0;
    for(let frame=0;frame<420;frame++){
     const stamp=await new Promise(requestAnimationFrame);
     if(frame>=60&&previous)raf.push(stamp-previous);previous=stamp;
     const begin=performance.now();
     w.time+=1/60;w.real=w.time;r.partLow.time=r.partHigh.time=w.visualTime;
     if(stress){
      // 每半秒重播一批，保持 30 个在播；旧碎甲、粒子、墨与受光自然衰减。
      if(frame%30===0){r.inkBursts.clear();for(let i=0;i<30;i++){
       const e=w.spawn({sprite:'e_hornet',hp:1,score:0,explosion:['s','m','l'][i%3]},90+i%6*145,190+Math.floor(i/6)*155);e.lastDamageSource='red';w.kill(e);
      }w.enemies=w.enemies.filter(e=>!e.dead);}
      for(const [i,source]of ['blue','red','purple'].entries()){
       w.damage(boss,.1,220+i*230,360,true,source);w.damage(enemies[i],.1,enemies[i].x,820,true,source);
      }
     }
     w.fx.update(1/60,1/60,w.time);w.draw();
     const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
     r.render(w.time,w.real,w.scroll,0,0,1/60);gl.endQuery(ext.TIME_ELAPSED_EXT);
     pending.push({q,measured:frame>=60});
     if(frame>=60){cpu.push(performance.now()-begin);counts.push(r.inkBursts.count);}
     while(pending.length&&gl.getQueryParameter(pending[0].q,gl.QUERY_RESULT_AVAILABLE)){
      const p=pending.shift();if(p.measured&&!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(p.q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(p.q);
     }
    }
    while(pending.length){await new Promise(requestAnimationFrame);const p=pending[0];if(!gl.getQueryParameter(p.q,gl.QUERY_RESULT_AVAILABLE))continue;pending.shift();if(p.measured&&!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(p.q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(p.q);}
    return {gpuFrameMs:stats(gpu),cpuUpdateDrawSubmitMs:stats(cpu),rafIntervalMs:stats(raf),bursts:{min:Math.min(...counts),max:Math.max(...counts)},submittedParticles:{low:r.partLow.used,high:r.partHigh.used},glError:gl.getError()};
   };
   const baseline=await run(false),stress=await run(true);
   g.render=originalRender;
   return {baseline,stress,method:'60 warmup + 360 measured frames per scenario; 30 mixed s/m/l World.kill every 0.5 game seconds; 6 World.damage calls every frame; 120 static enemy bullets; effect events + FX.update + World.draw + full renderer GPU query; AI, movement and collision simulation bypassed; fixed dt 1/60; no concurrent browser benchmarks',viewport:{width:1600,height:1000,dpr:1},play:r.playPx,quality:r.quality,gpu:r.gpuName(),hitRateRequestedPerGameSecond:360,burstBatchesPerGameSecond:2};
  });
  assert.equal(benchmark.stress.bursts.min,30);assert.equal(benchmark.stress.bursts.max,30);
  assert.equal(benchmark.stress.glError,0);assert.equal(benchmark.baseline.glError,0);
  await page.screenshot({path:`${out}/stress-30.png`});
  writeFileSync(`${out}/performance.json`,JSON.stringify(benchmark,null,2));console.log(JSON.stringify(benchmark));
  }
  await page.goto(`${url}tools/fx.html`,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('#status').hidden);
  for(const id of ['commands','hits','chapterInk']){
   await page.click(`#${id}`);await page.waitForFunction(()=>document.querySelector('#status').hidden);
   if(id!=='hits')await page.click(`#${id}`);await delay(id==='hits'?400:180);
   const scene=await page.evaluate(()=>{const w=document.querySelector('#scene').contentWindow.__game.world;return {enemies:w.enemies.filter(e=>!e.dead).length,bursts:w.r.inkBursts.count};});
   if(id==='hits')assert.equal(scene.enemies,4,'new preview world contains Boss + three targets');
   if(id==='chapterInk')assert.equal(scene.bursts,3,'new preview world contains three bursts');
   await page.screenshot({path:`${out}/preview-${id}.png`});
   assert.ok(await page.$eval('#caption',e=>e.textContent.trim().length>0));
  }
  assert.deepEqual(errors,[],'preview errors');
  writeFileSync(`${out}/preview-validation.json`,JSON.stringify({modes:['commands','hits','chapterInk'],errors},null,2));
 }
 console.log(JSON.stringify({out,version,...result,checks,errors}));
}finally{await browser.close();}
