// P4-04b / P4-24 回归：真实键盘、60Hz World/Renderer；九组真言每50ms取帧，GPU与CPU更新绘制原始计时。
// node tools/validate-a-vfx.mjs [dev URL] [绝对证据目录]
// 已合入 P4-02 正式字图；MANTRA_CHECKS_ONLY=1 仅跑数值、输入与27张光环图。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const url=process.argv[2]??'http://127.0.0.1:5184/';
const out=process.argv[3]??'local-source/P4-04b-evidence';
mkdirSync(out,{recursive:true});
const report={errors:[],checks:[],auras:[],casts:[],performance:[]};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
try{
 const page=await browser.newPage();await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,2000));await page.goto(url);await page.waitForFunction(()=>window.__game?.state==='title',{timeout:60000});
 await page.evaluate(()=>{const g=window.__game;g.onStart();g.update=()=>{};window.drawA=g.render.bind(g);g.render=()=>{};window.requestAnimationFrame=()=>0;});await new Promise(r=>setTimeout(r,200));
 await page.evaluate(async()=>{
  await document.fonts.ready;const g=window.__game;await g.audio.init();window.soundA=[];
  const original=g.audio.sfx.bind(g.audio);g.audio.sfx=(...args)=>{
   const diag=g.audio.diagnostics(),before=diag.log.length,previous=diag.log.at(-1);original(...args);
   if(diag.log.at(-1)!==previous)for(const event of diag.log.slice(before===120?119:before))window.soundA.push({...event,castAge:g.world.mantra.cast?.age??null,worldReal:g.world.real});
  };
 });
 await page.waitForFunction(()=>window.__game.r.mantraGlyphs.source==='formal',{timeout:30000});
 report.device=await page.evaluate(()=>{const g=window.__game,gl=g.r.gl,x=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:gl.getParameter(x.UNMASKED_RENDERER_WEBGL),width:g.r.canvas.width,height:g.r.canvas.height,playPx:g.r.playPx,glyphSource:g.r.mantraGlyphs.source,glyphErrors:g.r.mantraGlyphs.errors};});
 const prep=async(scene='stage1',color='red',targets=false)=>page.evaluate(async({scene,color,targets})=>{
  const g=window.__game,w=g.world;w.resetStage();w.player.reset(false);w.progression.resetRun();w.inkScore.resetRun();w.combos.resetRun();w.companions.setRoster([]);w.companions.update=()=>{};w.companions.draw=()=>{};
  Object.assign(w.player,{x:450,y:1000,bank:0,entering:0,invuln:0,bombs:3,weapon:color,power:4});w.debugAuto=false;w.fx.density=1;w.diff={...w.diff,hp:1};w.timeScale=1;w.real=w.time=w.t=0;w.scroll=0;g.state='playing';g.ui.screen('none');g.r.setBackground(scene==='stage2'?'stage2':'stage1');w.stageIndex=scene==='stage2'?2:1;w.stageName=scene==='stage2'?'灯河还名':'晓山返笔';g.input.poll();
  let seed=417;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(scene==='boss'){
   const {Sparrow}=await import('/src/stages/stage1_boss.ts');w.root.run(w.boss(Sparrow,450,-220,{warning:false,music:false,startPhase:1}));for(let i=0;i<240;i++){g.input.poll();w.tick(1/60);window.drawA();}w.player.invuln=0;
  }else if(targets){for(const [i,x,y]of [[0,230,270],[1,650,410],[2,250,650],[3,640,790]])w.spawn({sprite:'e_hornet',hp:10000+i*300,noCollide:true,armor:1},x,y);}
  window.soundA=[];w.aura.clear();w.aura.update(1/60);window.drawA();
 },{scene,color,targets});
 const step=async n=>page.evaluate(n=>{const g=window.__game;for(let i=0;i<n;i++){g.input.poll();g.world.tick(1/60);window.drawA();}},n);
 const bomb=async()=>{await page.keyboard.down('KeyF');const r=await page.evaluate(()=>{const g=window.__game,w=g.world;g.input.poll();w.tick(0);window.drawA();return{bombs:w.player.bombs,bombT:w.player.bombT,invuln:w.player.invuln,bullets:w.bullets.list.filter(b=>!b.dead).length,hitstop:w.hitstopRemaining,lands:w.mantra.cast.stones.map(s=>s.land)};});await page.keyboard.up('KeyF');await page.evaluate(()=>window.__game.input.poll());return r;};
 // 机械验收隔离 V1 持续伤害，直接记录真言发出的伤害调用，使用同一个 World 实例。
 report.mechanics=await page.evaluate(()=>{
  const w=window.__game.world,p=w.player,original=w.damage;const logs=[];w.damage=(e,amount,x,y,quiet,source)=>{logs.push({target:e.data.testId,amount,source});};
  const target=(id,x,y,boss=false,phase=false)=>{const e=w.spawn({sprite:'e_hornet',hp:10000,noCollide:true,armor:1,boss:boss?{name:'验收',phases:1}:undefined},x,y);e.data.testId=id;e.phaseLock=phase;return e;};
  try{
   w.resetStage();p.reset(false);p.weapon='purple';w.aura.clear();w.aura.update(0);const near=target('near',p.x,p.y-100);w.aura.update(1.49);const before=logs.length;w.aura.update(.01);const jump=logs.splice(0);near.dead=true;const b=w.shoot(p.x,p.y-60,0,0);w.aura.update(1.5);const normalCleared=b.dead;const hard=w.shoot(p.x,p.y-60,0,0,{hard:true});w.aura.update(1.5);const hardKept=!hard.dead;
   w.resetStage();p.reset(false);p.bombT=2.6;target('wave-plain',150,150);target('wave-locked',750,150,false,true);
   for(let i=0;i<60;i++)w.mantra.update(1/60);
   const waveRows=logs.splice(0),wave={plain:waveRows.filter(d=>d.target==='wave-plain').reduce((n,d)=>n+d.amount,0),locked:waveRows.filter(d=>d.target==='wave-locked').reduce((n,d)=>n+d.amount,0),remaining:p.bombT};
   const casts=[];for(const color of ['red','purple','blue']){
    w.resetStage();p.reset(false);p.weapon=color;const big=target('boss',450,400,true),locked=target('locked',450,450,false,true),plain=target('plain',450,470);w.mantra.start();const c=w.mantra.cast;
    for(let i=0;i<c.stones.length;i++){const s=c.stones[i];s.x=450;s.y=400;s.selected=true;w.mantra.land(c,s,i);}
    const damage=logs.splice(0);casts.push({color,impacts:damage.filter(d=>[90,180,360].includes(d.amount)),lines:damage.filter(d=>d.amount===40).length,knives:damage.filter(d=>d.amount===60).length,lands:c.stones.map(s=>s.land)});
    w.mantra.finish();casts.at(-1).final=logs.splice(0).filter(d=>d.amount===300).length;
   }
   return{before,jump,normalCleared,hardKept,wave,casts};
  }finally{w.damage=original;}
 });
 assert.ok(Math.abs(report.mechanics.wave.plain-320)<1e-6);assert.ok(Math.abs(report.mechanics.wave.locked-160)<1e-6);assert.ok(Math.abs(report.mechanics.wave.remaining-1.6)<1e-6);assert.equal(report.mechanics.before,0);assert.equal(report.mechanics.jump[0].amount,8);assert.ok(report.mechanics.normalCleared&&report.mechanics.hardKept);
 for(const c of report.mechanics.casts){assert.equal(c.impacts.filter(d=>d.target==='boss').length,2);assert.equal(c.impacts.filter(d=>d.target==='locked').length,2);assert.deepEqual(c.impacts.filter(d=>d.target==='plain').map(d=>d.amount),[180,360]);assert.equal(c.lines,c.lands.length-1);assert.equal(c.knives,c.color==='purple'?17:0);assert.equal(c.final,3);assert.equal(c.lands.at(-1),2.2);for(let i=2;i<c.lands.length;i++)assert.ok(c.lands[i]-c.lands[i-1]<c.lands[i-1]-c.lands[i-2]);}
 report.checks.push('雷跳电1.5秒/8伤害/只消普通弹','重击一次上限与末字例外/Boss和阶段锁定半伤','逐连线40/横竖刀光60/收势300/末字2.2秒');
 // 挤成一团的高血量敌机、靠边目标与朱雀不同位置，核对真实落点选择。
 report.spacingStress=[];
 for(const color of ['red','purple','blue'])for(const [x,y]of [[450,1000],[50,100],[850,1100],[450,600]]){
  await prep('stage1',color);const result=await page.evaluate(({color,x,y})=>{
   const w=window.__game.world;Object.assign(w.player,{x,y});
   for(let i=0;i<12;i++)w.spawn({sprite:'e_hornet',hp:10000+i*100,noCollide:true,armor:1},450+i%3*8,400+Math.floor(i/3)*8);
   w.mantra.start();const c=w.mantra.cast;for(let i=0;i<c.stones.length;i++){const s=c.stones[i];w.mantra.select(c,s,i);s.selected=true;}
   const stones=c.stones.map(s=>({x:s.x,y:s.y})),distances=[];for(let i=0;i<stones.length-1;i++)for(let j=0;j<i;j++)distances.push(Math.hypot(stones[i].x-stones[j].x,stones[i].y-stones[j].y));
   return{color,player:{x,y},stones,minSpacing:Math.min(...distances),minPlayer:Math.min(...stones.map(s=>Math.hypot(s.x-x,s.y-y)))};
  },{color,x,y});assert.ok(result.minSpacing>=170-1e-6);assert.ok(result.minPlayer>=160-1e-6);result.stones.forEach((s,i)=>{const last=i===result.stones.length-1,mx=last?242:142,my=last?235:155;assert.ok(s.x>=mx&&s.x<=900-mx&&s.y>=my&&s.y<=1200-my);});report.spacingStress.push(result);
 }
 // 三色光环：静止、真实左右移动、真实射击，以及每50ms的换入六帧。
 for(const color of ['red','purple','blue']){
  const paths=[];await prep('stage1',color);await page.evaluate(()=>{const w=window.__game.world;for(const dx of [-28,28])w.shoot(w.player.x+dx,w.player.y-22,0,0);});await step(45);for(const state of ['idle','moving','firing']){
   if(state==='moving'){await page.keyboard.down('ArrowLeft');await step(12);await page.keyboard.up('ArrowLeft');}
   if(state==='firing'){await page.mouse.move(800,750);await page.mouse.down({button:'left'});await step(15);await page.mouse.up({button:'left'});}
   const file=`aura-${color}-${state}.png`;await page.screenshot({path:`${out}/${file}`});paths.push(file);
  }
  await prep('stage1',color==='red'?'purple':color==='purple'?'blue':'red');await page.mouse.move(800,750);await page.mouse.down({button:'middle'});await page.evaluate(()=>{window.__game.input.poll();window.__game.world.tick(0);window.drawA();});await page.mouse.up({button:'middle'});await page.evaluate(()=>window.__game.input.poll());
  assert.equal(await page.evaluate(()=>window.__game.world.aura.color),color);
  for(let i=0;i<6;i++){if(i)await step(3);const file=`aura-${color}-switch-${i}.png`;await page.screenshot({path:`${out}/${file}`});paths.push(file);}const sounds=await page.evaluate(()=>window.soundA.filter(s=>s.event.startsWith('swap_')));assert.deepEqual(sounds.map(s=>s.event),[`swap_${color}`]);assert.equal(sounds[0].material,`swap_${color}`);report.auras.push({color,paths,sounds});
 }
 // 真实 X 触发后保命时长按真实时间流逝，顿帧中仍清弹。
 await prep();await page.evaluate(()=>window.__game.world.shoot(450,990,0,0));report.protection={start:await bomb(),samples:[]};assert.equal(report.protection.start.bombT,2.6);assert.equal(report.protection.start.invuln,3.4);assert.equal(report.protection.start.bullets,0);assert.equal(report.protection.start.hitstop,.1);
 for(let i=0;i<216;i++){
  if(i%6===0)await page.evaluate(()=>window.__game.world.shoot(100,100,0,0));await step(1);
  if([5,59,155,203,215].includes(i))report.protection.samples.push(await page.evaluate(()=>{const w=window.__game.world;return{real:w.real,bombT:w.player.bombT,invuln:w.player.invuln,bullets:w.bullets.list.filter(b=>!b.dead).length,cast:!!w.mantra.cast};}));
 }
 assert.ok(report.protection.samples[0].bullets===0);assert.ok(Math.abs(report.protection.samples[1].bombT-1.6)<1e-6);assert.ok(report.protection.samples[2].bombT<1e-6);assert.ok(report.protection.samples[3].invuln<1e-6);assert.equal(report.protection.samples[4].cast,true);await step(160);assert.equal(await page.evaluate(()=>!!window.__game.world.mantra.cast),false);report.checks.push('V1立即清弹、3.4秒无敌、2.6秒墨浪、顿帧不延长保命');
 // 减少动态效果只取消震屏和推拉；正式 draw 调用处截取 Post 参数。
 await prep('stage1','purple');await bomb();await step(30);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);report.reduced=await page.evaluate(()=>{const r=window.__game.r,render=r.post.render;let params;r.post.render=function(...args){params={zoom:this.zoom,shake:this.shake,ink:this.mantraInk};return render.apply(this,args);};window.drawA();r.post.render=render;return{...params,cast:!!window.__game.world.mantra.cast,hud:document.querySelector('.hud')?.getBoundingClientRect().width};});assert.equal(report.reduced.zoom,1);assert.deepEqual(report.reduced.shake,[0,0]);assert.ok(report.reduced.cast);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 report.checks.push('减少动态效果取消震屏和镜头，其余演出保留');
 // 首章、次章、真实铜雀各三色，0..6.25秒共126帧；PNG关键帧、JPEG连续原帧。
 if(!process.env.MANTRA_CHECKS_ONLY)for(const scene of (process.env.MANTRA_SCENES??'stage1,stage2,boss').split(','))for(const color of ['red','purple','blue']){
  await prep(scene,color,scene!=='boss');const prefix=`${scene}-${color}`,dir=`${out}/${prefix}`;mkdirSync(dir,{recursive:true});const start=await bomb();if(scene==='boss')await page.evaluate(()=>window.__game.world.player.invuln=100);const samples=[];
  for(let i=0;i<126;i++){if(i)await step(3);samples.push(await page.evaluate(()=>{const w=window.__game.world,c=w.mantra.cast;if(c&&c.stones.every(s=>s.selected)){
   const stones=c.stones.map(s=>({key:s.key,x:s.x,y:s.y})),distances=[];for(let i=0;i<stones.length-1;i++)for(let j=0;j<i;j++)distances.push(Math.hypot(stones[i].x-stones[j].x,stones[i].y-stones[j].y));
   window.layoutA={stones,minSpacing:Math.min(...distances),minPlayer:Math.min(...stones.map(s=>Math.hypot(s.x-c.origin[0],s.y-c.origin[1])))};
  }return{age:w.mantra.cast?.age??null,impacts:w.mantra.stats.impacts,damage:{...w.mantra.stats},alive:w.player.alive,zoom:w.r.mantraZoom};}));await page.screenshot({path:`${dir}/${String(i).padStart(3,'0')}.jpg`,type:'jpeg',quality:85});if([0,8,44,52,62].includes(i))await page.screenshot({path:`${out}/${prefix}-${(i*.05).toFixed(2)}.png`});}
  const layout=await page.evaluate(()=>{const c=window.layoutA;return c;});
  const sounds=await page.evaluate(()=>window.soundA.filter(s=>s.event.startsWith('mantra_')||s.event==='bomb'||s.event==='explode_boss'));
  assert.equal(sounds.filter(s=>s.event==='mantra_start').length,1);assert.equal(sounds.find(s=>s.event==='mantra_start').castAge,0);
  assert.ok(Math.abs(sounds.find(s=>s.event==='mantra_roll').castAge-.2)<1e-6);
  const hits=sounds.filter(s=>s.event==='mantra_hit');assert.equal(hits.length,start.lands.length);
  hits.forEach((s,i)=>{assert.equal(s.event,'mantra_hit');assert.ok(s.castAge>=start.lands[i]-1e-6&&s.castAge-start.lands[i]<1/60+1e-6);});
  assert.ok(Math.abs(sounds.find(s=>s.event==='mantra_finale').castAge-2.2)<1e-6);assert.equal(sounds.filter(s=>s.event==='mantra_slash').length,color==='purple'?9:0);
  assert.ok(sounds.every(s=>s.material===s.event));assert.equal(sounds.filter(s=>s.event==='bomb'||s.event==='explode_boss').length,0);
  assert.ok(layout.minSpacing>=170-1e-6);assert.ok(layout.minPlayer>=160-1e-6);
  assert.ok(samples.every(s=>s.alive));assert.equal(samples.at(-1).impacts,color==='red'?5:color==='purple'?9:8);report.casts.push({scene,color,frameInterval:.05,frames:126,start,samples,prefix,layout,sounds});console.log(`截图完成 ${prefix}`);
  // 单独重放同一场景，以372帧覆盖完整演出，计时不混入截图RPC或文件写入。
  await prep(scene,color,scene!=='boss');await page.evaluate(()=>{const gl=window.__game.r.gl;for(let i=0;i<45;i++){window.drawA();gl.finish();}});await bomb();if(scene==='boss')await page.evaluate(()=>window.__game.world.player.invuln=100);
  const times=await page.evaluate(async()=>{
   const g=window.__game,gl=g.r.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),rows=[],queries=[];g.r.timer=null;
   for(let i=0;i<372;i++){
    const q=ext?gl.createQuery():null,t=performance.now();g.input.poll();g.world.tick(1/60);if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);window.drawA();if(q)gl.endQuery(ext.TIME_ELAPSED_EXT);const submitted=performance.now()-t;gl.finish();rows.push({age:(i+1)/60,cpuSubmit:submitted,completed:performance.now()-t});if(q)queries.push(q);
    if(i%12===11)await new Promise(r=>setTimeout(r,0));
   }
   await new Promise(r=>setTimeout(r,30));const gpu=[];for(const q of queries){if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}return{rows,gpu,glError:gl.getError()};
  });
  const summary={scene,color,samples:times.rows.length,cpuP95:percentile(times.rows.map(r=>r.cpuSubmit),.95),completedP95:percentile(times.rows.map(r=>r.completed),.95),gpuP95:percentile(times.gpu,.95),gpuSamples:times.gpu.length,max:Math.max(...times.rows.map(r=>r.completed))};report.performance.push({...summary,...times});console.log(`帧时间 ${prefix} ${JSON.stringify(summary)}`);assert.equal(times.glError,0);assert.equal(times.gpu.length,372);assert.ok(summary.gpuP95<=20,`GPU整帧p95超预算 ${JSON.stringify(summary)}`);assert.ok(summary.completedP95<=20,`整帧p95超预算 ${JSON.stringify(summary)}`);
 }
 assert.equal(report.errors.length,0);report.passed=true;
}finally{writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2));await browser.close();}
