// P6-12：无头 GPU Chrome，五个真实战斗时刻和概念图拼成六格，三色主炮并排。
// node tools/capture-p6-12.mjs [URL] [输出目录] [概念图目录]
// 通过真实敌机伤害、死亡触发爆发，保留 V1 墨浪；完成后核对四张图。
// P6_CAPTURE_BOMBS=red 只补拍朱色真言；三色主炮对照始终更新。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const [url='http://127.0.0.1:5185/',out='local-source/P6-12',conceptDir='local-source/P6-12']=process.argv.slice(2);const mode='after';
mkdirSync(out,{recursive:true});const result={mode,baselineCommit:'7207219',seed:607,errors:[],performance:[]};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
try{
 const page=await browser.newPage();await page.setViewport({width:1600,height:900,deviceScaleFactor:1});page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/INVALID_OPERATION|INVALID_FRAMEBUFFER/.test(m.text()))result.errors.push(m.text());});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,1500));await page.goto(url);await page.waitForFunction(()=>window.__game?.state==='title',{timeout:60000});
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;window.__game.state='paused';});await new Promise(r=>setTimeout(r,100));
 await page.evaluate(async()=>{
  const g=window.__game;g.update=()=>{};await document.fonts.ready;
  window.prepDense=async(checkpoint='W01')=>{let seed=607;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
   g.toTitle();g.onTestStart({chapter:3,checkpoint,bossPhase:1,god:true,fullInk:true,fullBombs:true,brushPower:1,brushMethods:[],skills:[],companions:[],passives:[],bombColor:'red',inkScore:{red:0,blue:0,purple:0}});
   while(g.state==='loading')await new Promise(r=>setTimeout(r,10));const w=g.world;w.rng.s=607;g.debug.god=true;g.ui.screen('none');w.debugAuto=false;g.input.down=()=>false;g.input.pressed=()=>false;g.input.consume=()=>{};g.input.axisX=g.input.axisY=0;
   Object.assign(w.player,{x:450,y:1000,entering:0,invuln:99999,power:4});};
  window.stepFx=(n,draw=true)=>{for(let i=0;i<n;i++){if(g.state==='growth')g.onChoice(g.world.progression.offerTalents()[0]?.id);if(g.ui.dialogueState().active){g.ui.dialogueAdvance();g.ui.dialogueAdvance();}g.world.tick(1/60);if(draw)g.render();}};
  window.freezeDense=()=>{const w=g.world;w.root.paused=true;for(const e of w.enemies){e.hp=e.maxHp=1000000;e.def={...e.def,noCollide:true};e.vx=e.vy=0;}for(const b of w.bullets.list){b.speed=b.accel=b.angVel=0;b.life=Infinity;b.hard=true;b.update=()=>{};}w.chapter2=null;g.input.down=a=>a==='shoot';};
  window.prepPicture=color=>{const w=g.world;w.resetStage();w.newGame();g.state='playing';g.ui.screen('none');document.querySelectorAll('[aria-hidden=true].scr').forEach(e=>e.remove());w.debugAuto=false;w.stageIndex=1;g.r.setBackground('stage1');w.scroll=3000;w.companions.setRoster([]);w.companions.update=()=>{};w.companions.draw=()=>{};
   Object.assign(w.player,{x:450,y:970,entering:0,invuln:0,power:4,weapon:color,bombs:6});w.inkScore.levels[color]=0;w.aura.clear();g.input.down=a=>a==='shoot';g.input.axisX=g.input.axisY=0;
   for(const [x,y]of [[350,350],[650,600]]){const e=w.spawn({sprite:'air_bomber',hp:290,radius:50,noCollide:true,explosion:'s'},x,y);e.hp=e.maxHp=290;e.scaleX=e.scaleY=.72;}
   };
 });


 await page.waitForFunction(()=>window.__game.r.mantraGlyphs.source==='formal'&&window.__game.r.mantraGlyphs.volumes.smokeReady,{polling:100,timeout:60000});
 result.timeline={};
 for(const color of process.env.P6_CAPTURE_BOMBS?.split(',')??['red','blue','purple']){
  await page.evaluate(color=>{window.prepPicture(color);window.__game.input.down=()=>false;window.stepFx(1);},color);await page.evaluate(()=>window.__game.world.player.bomb());
  const frames=[],states=[];let last=0;
  for(const n of [9,24,32,45,60]){await page.evaluate(n=>window.stepFx(n),n-last);last=n;frames.push(await page.screenshot());states.push(await page.evaluate(()=>{const w=window.__game.world;return{age:w.mantra.cast.age,enemies:w.enemies.filter(e=>!e.dead).length,damage:w.mantra.cast.damage,marks:w.mantra.marks.marks.length,bursts:w.mantra.marks.bursts.length,volumes:w.r.mantraGlyphs.volumes.peak,particles:w.mantra.cast.particles};}));}
  result.timeline[color]=states;assert.ok(states[0].enemies>states[2].enemies);assert.ok(states[2].bursts>0);
  const png=await page.evaluate(async({frames,concept,color})=>{const r=window.__game.r.playCss,c=document.createElement('canvas');c.width=1800;c.height=1680;const ctx=c.getContext('2d');ctx.fillStyle='#171e1e';ctx.fillRect(0,0,c.width,c.height);
   const labels=['0.15秒 · 沿笔画写出','0.40秒 · 停留','0.53秒 · 字形炸散、命中','0.75秒 · 敌机击破爆发','1.00秒 · 消散','概念图 · '+({red:'朱：火舌与墨烟',blue:'青：水雾螺旋',purple:'紫：雷芯与辉光'})[color]];
   for(let i=0;i<6;i++){const im=new Image();im.src='data:image/png;base64,'+(i===5?concept:frames[i]);await im.decode();const x=i%3*600,y=Math.floor(i/3)*840;
    if(i<5)ctx.drawImage(im,r.x,r.y,r.w,r.h,x,y+40,600,800);else ctx.drawImage(im,x+(600-800*im.width/im.height)/2,y+40,800*im.width/im.height,800);
    ctx.fillStyle='#e9e3d3';ctx.font='21px InkskyFangsong';ctx.fillText(labels[i],x+16,y+28);}
   return c.toDataURL('image/png').split(',')[1];},{frames:frames.map(b=>b.toString('base64')),concept:readFileSync(`${conceptDir}/${color}.png`).toString('base64'),color});writeFileSync(`${out}/${color}-bomb.png`,Buffer.from(png,'base64'));
 }
 const shots=[];result.bullets={};
 for(const color of ['red','blue','purple']){
  await page.evaluate(color=>{window.prepPicture(color);const w=window.__game.world;w.enemies=[];w.root.paused=true;w.scrollV=0;w.time=w.real=0;window.stepFx(72);},color);
  shots.push(await page.screenshot());result.bullets[color]=await page.evaluate(()=>window.__game.world.player.shots.length);assert.ok(result.bullets[color]>0);
 }
 const png=await page.evaluate(async shots=>{const r=window.__game.r.playCss,c=document.createElement('canvas');c.width=1800;c.height=940;const ctx=c.getContext('2d');ctx.fillStyle='#171e1e';ctx.fillRect(0,0,1800,940);for(let i=0;i<3;i++){const im=new Image();im.src='data:image/png;base64,'+shots[i];await im.decode();ctx.drawImage(im,r.x+r.w*260/900,r.y+r.h*550/1200,r.w*380/900,r.h*570/1200,i*600,40,600,900);ctx.fillStyle='#e9e3d3';ctx.font='25px InkskyFangsong';ctx.fillText(['朱 · 正常射击','青 · 正常射击','紫 · 正常射击'][i],i*600+16,28);}return c.toDataURL('image/png').split(',')[1];},shots.map(b=>b.toString('base64')));writeFileSync(`${out}/bullets.png`,Buffer.from(png,'base64'));
 result.checks=await page.evaluate(()=>{
  const g=window.__game,w=g.world;window.prepPicture('red');w.player.bomb();w.player.bombT=0;w.mantra.spirits=null;
  const e=w.enemies[0];w.mantra.damage(e,1);const mark=w.mantra.marks.marks[0];w.mantra.marks.update(.99);const before=w.mantra.marks.marks.includes(mark);w.mantra.marks.update(.02);const expired=!w.mantra.marks.marks.includes(mark);
  const time=w.mantra.marks.time;g.state='paused';g.render();const pause=time===w.mantra.marks.time;w.resetStage();return{before,expired,pause,reset:w.mantra.marks.marks.length+w.mantra.marks.bursts.length,glError:g.r.gl.getError(),glyphSource:g.r.mantraGlyphs.source};
 });assert.ok(result.checks.before&&result.checks.expired&&result.checks.pause);assert.equal(result.checks.reset,0);assert.equal(result.checks.glError,0);assert.deepEqual(result.errors,[]);
 result.motion=await page.evaluate(()=>{
  const w=window.__game.world,m=w.mantra.marks,v=w.r.mantraGlyphs.volumes,rb=w.r.ribbonTop,add=v.add,strip=rb.strip,rows=[];
  let volumes=[],bolts=[];
  v.add=function(...args){volumes.push(args);};rb.strip=function(...args){bolts.push({pts:[...args[0]],widths:[...args[1]]});};
  try{
   for(const color of ['red','blue','purple']){
    m.clear();m.burst(450,350,color,110);m.marks=[];const b=m.bursts[0];
    const sample=t=>{b.age=t;volumes=[];bolts=[];m.draw();return{t,smoke:volumes.filter(x=>x[0]===1).map(x=>({x:x[1],y:x[2],rx:x[3],ry:x[4],alpha:x[6]})),arms:volumes.filter(x=>x[0]===7).map(x=>x[9]),flash:volumes.some(x=>x[0]===8),bolts};};
    rows.push({color,samples:[.04,.075,.084,.3,.34,.7,.9].map(sample)});
   }
  }finally{v.add=add;rb.strip=strip;m.clear();}
  return rows;
 });
 for(const row of result.motion){
  const at=t=>row.samples.find(s=>s.t===t);
  assert.equal(at(.3).smoke.length,7);assert.ok(at(.7).smoke.every(s=>s.alpha>.6));assert.ok(new Set(at(.3).smoke.map(s=>s.rx)).size>=4);
  assert.notDeepEqual(at(.3).smoke,at(.34).smoke);
  if(row.color==='blue'){assert.equal(at(.3).arms.length,3);assert.ok(at(.9).arms[0]-at(.04).arms[0]>Math.PI);}
  if(row.color==='purple'){assert.ok(at(.04).flash&&at(.075).flash&&!at(.084).flash);assert.ok(at(.3).bolts.length>=6&&at(.3).bolts.length<=10);assert.notDeepEqual(at(.3).bolts,at(.34).bolts);assert.ok(at(.3).bolts.every(b=>new Set(b.widths).size>1));}
 }
 result.passed=true;
}finally{writeFileSync(`${out}/visual-checks.json`,JSON.stringify(result,null,2));await browser.close();}
