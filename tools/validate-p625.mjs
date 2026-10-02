// 真实 Playwright 键鼠回归与清晰度截图。每个输入经 Input.poll / Game.update。
// PLAYWRIGHT_MODULE=/绝对路径/playwright/index.mjs node tools/validate-p625.mjs controls|sharp [URL] [证据目录]
// sharp 固定朱雀待机帧0，保留游戏背景、机体效果与原图，记录CSS/物理像素尺寸。
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const [mode='controls',base='http://127.0.0.1:5177/',out='.shots/p625']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:[...(process.env.P625_GL?['--use-angle=gl']:['--use-angle=vulkan','--enable-features=Vulkan']),'--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const report={mode,errors:[],groups:[],cases:[],layouts:[]};
async function open(width,height,dpr=1){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(/INVALID_|CONTEXT_LOST|上下文丢失/.test(m.text()))report.errors.push(m.text());});
 await page.routeWebSocket('**',ws=>ws.close());
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('about:blank');await page.waitForTimeout(1500);await page.goto(base);
 await page.waitForFunction(()=>window.__game,null,{timeout:60000,polling:100});
 return page;
}
async function prep(page){await page.evaluate(()=>{const g=window.__game,w=g.world;g.debug.god=true;g.debug.bot=g.debug.autofire=false;g.testRun=null;w.testOptions=null;w.newGame();w.resetStage();w.companions.setRoster([]);w.brushForms=new Set(['横','竖']);w.player.ink=1;w.player.entering=w.player.invuln=0;w.player.x=450;w.player.y=1000;g.state='playing';g.ui.screen('none');g.r.setBackground('stage1');g.ui.hud(w.hud(60),false);document.querySelector('.opening-controls').hidden=true;});}
async function step(page,n=1){await page.evaluate(n=>{const g=window.__game;for(let i=0;i<n;i++){g.input.poll();g.update(1/60);}},n);}
async function move(page,x,y){const p=await page.evaluate(({x,y})=>{const r=window.__game.r.playCss;return{x:r.x+x*r.w/900,y:r.y+y*r.h/1200};},{x,y});await page.mouse.move(p.x,p.y);}
async function down(page,method,reverse=false){if(method==='space')await page.keyboard.down('Space');else {if(method==='both')await page.mouse.down({button:reverse?'right':'left'});await page.mouse.down({button:reverse&&method==='both'?'left':'right'});}}
async function up(page,method,reverse=false){if(method==='space')await page.keyboard.up('Space');else{await page.mouse.up({button:reverse&&method==='both'?'left':'right'});if(method==='both')await page.mouse.up({button:reverse?'right':'left'});}}
let seed=625;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
try{
 if(mode==='controls'){
  const page=await open(1600,900);
  for(const method of ['right','both','space'])for(const form of ['横','竖']){
   let success=0;
   for(let trial=0;trial<10;trial++){
    await prep(page);const reverse=trial%2===1,angle=(trial-4.5)*3.4*Math.PI/180+(form==='竖'?Math.PI/2:0),length=220+trial*12;
    const pts=Array.from({length:49},(_,i)=>{const t=reverse?1-i/48:i/48;return [300+Math.cos(angle)*length*t+(rand()-.5)*14,350+Math.sin(angle)*length*t+(rand()-.5)*14];});
    await move(page,...pts[0]);await down(page,method,reverse);await step(page);
    const started=await page.evaluate(()=>window.__game.world.brush.active);
    for(const p of pts.slice(1)){await move(page,...p);await step(page);}
    await up(page,method,reverse);await step(page);
    const actual=await page.evaluate(()=>window.__game.world.brush.lastForm),pass=started&&actual===form;
    report.cases.push({method,form,trial,started,actual,pass});if(pass)success++;
   }
   report.groups.push({method,form,success,total:10});
  }
  for(const method of ['space','both']){
   await prep(page);await page.mouse.move(20,20);await down(page,method);await step(page,3);
   await move(page,250,450);await step(page);const started=await page.evaluate(()=>window.__game.world.brush.active);
   for(let i=1;i<=12;i++){await move(page,250+i*24,450);await step(page);}
   await up(page,method);await step(page);report.cases.push({method,scenario:'按住后移入战场',started,actual:await page.evaluate(()=>window.__game.world.brush.lastForm)});
  }
  // 斜线、明显折线不能误判为横竖。
  for(const pts of [[[200,300],[500,600]],[[200,400],[350,480],[500,400]]]){
   await prep(page);await move(page,...pts[0]);await down(page,'right');await step(page);for(const p of pts.slice(1)){await move(page,...p);await step(page);}await up(page,'right');await step(page);
   const actual=await page.evaluate(()=>window.__game.world.brush.lastForm);report.cases.push({scenario:'斜线/折线',actual});assert.ok(!['横','竖'].includes(actual));
  }
  await page.evaluate(()=>window.__game.render());await page.screenshot({path:`${out}/controls.png`});
  if(!process.env.P625_BASELINE){assert.ok(report.groups.every(g=>g.success>=9),JSON.stringify(report.groups));assert.ok(report.cases.filter(c=>c.scenario==='按住后移入战场').every(c=>c.started));}
 } else if(mode==='charge'){
  const page=await open(1600,900);await prep(page);
  for(let level=0;level<=3;level++){
   const result=await page.evaluate(level=>{
    const g=window.__game,w=g.world,r=g.r;w.skills.unlocked.add('zhongpao');w.skills.charge=level*60;
    r.ribbonTop.clear();r.bullets.clear();w.skills.draw();
    const lightCount=r.bullets.count,lines=r.ribbonTop.count;
    g.ui.hud(w.hud(60),false);g.render();
    const el=document.querySelector('[data-skill="zhongpao"]');return{level,lightCount,lines,icon:el.querySelector('.skill-icon .skill-value').textContent,fill:getComputedStyle(el.querySelector('.skill-fill')).display};
   },level);
   assert.equal(result.lines,0);assert.equal(result.lightCount,level?1:0);assert.equal(result.icon,'■'.repeat(level)+'□'.repeat(3-level));assert.equal(result.fill,'none');
   report.cases.push(result);await page.screenshot({path:`${out}/charge-${level}.png`});
  }
 } else if(mode==='sharp'){
  for(const [width,height] of (process.env.P625_ONE?[[3840,2160]]:[[2560,1440],[3840,2160]]))for(const dpr of (process.env.P625_ONE?[2]:[1,2])){
   const page=await open(width,height,dpr);await prep(page);await step(page,30);
   if(process.env.P625_TEXTURE_BASELINE)await page.evaluate(async()=>{const r=window.__game.r,{ALL_SPRITES}=await import('/src/art/index.ts');r.gl.deleteTexture(r.atlas.albedo);r.gl.deleteTexture(r.atlas.glow);r.atlas.map.clear();await r.atlas.build(ALL_SPRITES.map(d=>({...d,textureScale:undefined})),Math.min(3,Math.max(2,Math.ceil(innerHeight*devicePixelRatio*r.renderScale/1200*4)/4)));});
   const data=await page.evaluate(()=>{const g=window.__game,w=g.world,r=g.r,p=w.player,s=p.sprite,f=s.frames[0];w.real=0;p.invuln=0;p.bank=0;p.colorChangedAt=-1;p.weapon='red';p.previousColor='red';w.skills.unlocked.add('zhongpao');w.skills.charge=180;g.ui.hud(w.hud(60),false);g.render();return{css:r.playCss,canvas:[r.canvas.width,r.canvas.height],scene:[r.scene.w,r.scene.h],texture:[(f.u1-f.u0)*4096,(f.v1-f.v0)*4096],sprite:[s.w,s.h],player:[p.x,p.y],frame:0};});
   const name=`${width}x${height}-dpr${dpr}`;await page.screenshot({path:`${out}/${name}.png`});
   const box={x:data.css.x+(data.player[0]-70)*data.css.w/900,y:data.css.y+(data.player[1]-85)*data.css.h/1200,width:140*data.css.w/900,height:160*data.css.h/1200};
   await page.screenshot({path:`${out}/${name}-close.png`,clip:box});
   report.layouts.push({width,height,dpr,...data,crop:box});await page.close();
  }
 }else throw new Error(`未知模式 ${mode}`);
 assert.deepEqual(report.errors,[]);
}finally{writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report.groups.length?report.groups:report.layouts,null,2));
