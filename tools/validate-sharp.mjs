// 无头1080p采样/原图审计与同场景GPU计时。用法: node tools/validate-sharp.mjs before|after [URL]
// 原比例近景通过正式World和Renderer绘制；性能为固定10架敌机+60发敌弹的密集段，预热60帧采样120帧。
import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
const label=process.argv[2]??'after', base=process.argv[3]??'http://127.0.0.1:5194/',out='studio/jobs/P6-20';mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
const errors=[];
try{
 const page=await browser.newPage();await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'||/INVALID_OPERATION|INVALID_FRAMEBUFFER|上下文丢失/.test(m.text()))errors.push(m.text())});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,2000));await page.goto(base+'?stage=1&god=1&power=4');await page.waitForFunction('window.__game && window.__game.state !== "loading"',{timeout:60000});
 const audit=await page.evaluate(async()=>{
  const g=window.__game;g.update=()=>{};g.render=()=>{};window.requestAnimationFrame=()=>0;g.state='paused';await document.fonts.ready;
  const {ALL_SPRITES}=await import('/src/art/index.ts'),{loadSpriteImages}=await import('/src/art/images.ts');const images=await loadSpriteImages(ALL_SPRITES);
  const scale=g.r.playPx.h/1200,rows=ALL_SPRITES.filter(d=>d.image||d.sheet).map(d=>{const path=d.sheet?.image??(Array.isArray(d.image)?d.image[0]:d.image),im=images.get(path);return{id:d.id,path,source:im?[im.width/(d.sheet?.columns??1),im.height/(d.sheet?.rows??1)]:null,display:[g.r.atlas.get(d.id).w*scale,g.r.atlas.get(d.id).h*scale]}});
  const gl=g.r.gl;gl.bindTexture(gl.TEXTURE_2D_ARRAY,g.r.atlas.albedo);
  return{canvas:[g.r.canvas.width,g.r.canvas.height],play:g.r.playPx,dpr:devicePixelRatio,renderScale:g.r.renderScale,gpu:g.r.gpuName(),sampling:{min:gl.getTexParameter(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER),mag:gl.getTexParameter(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER),levels:gl.getTexParameter(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_IMMUTABLE_LEVELS)},rows,undersized:rows.filter(d=>d.source&&(d.source[0]<d.display[0]||d.source[1]<d.display[1]))};
 });
 await page.evaluate(async()=>{
  const g=window.__game,w=g.world,r=g.r;w.resetStage();g.state='paused';w.player.entering=0;w.player.x=250;w.player.y=970;w.player.power=4;w.player.invuln=0;
  w.scene('air_ship',650,870);w.spawn({sprite:'e_hornet',hp:100},250,580);w.spawn({sprite:'e_moth',hp:100},650,580);
  r.setBackground('stage1');r.post.shake=[0,0];r.post.flash=0;r.post.zoom=1;
  window.drawSharp=()=>{w.draw();r.render(w.time,w.real,w.scroll,0,0,0,w.visualTime)};window.drawSharp();
 });
 await page.screenshot({path:`${out}/${label}-1080p.png`});
 // Boss实际部件与三色主角均走正式图集；保持逻辑尺寸与挂点。
 await page.evaluate(()=>{const w=window.__game.world;w.resetStage();w.player.entering=0;w.player.x=450;w.player.y=1050;for(const [id,x,y] of [['tq-body',450,420],['tq-wing-shell',275,420],['tq-wing-shell-mirror',625,420],['pd-head',450,720]])if(w.r.atlas.has(id))w.scene(id,x,y);window.drawSharp()});
 await page.screenshot({path:`${out}/${label}-boss.png`});
 if(label==='after'){
  for(const chapter of [1,2]){
   await page.evaluate(ch=>{const w=window.__game.world;w.resetStage();w.player.entering=0;w.player.x=450;w.player.y=1100;w.r.setBackground(`stage${ch}`);const ids=ch===1?['e_hornet','e_crane','e_turtle','e_turret','e_kite','e_chariot','e_mountainape','air_bomber','air_net-post']:['e_belleel','e_junk','e_lampboat','e_lantern','e_mirrorfish','e_moth','e_netspider','e_paperray','e_rotor','e_taxcrab','e_tideshuttle','e_umbrellaguest'];ids.forEach((sprite,i)=>w.spawn({sprite,hp:100},170+(i%3)*280,170+Math.floor(i/3)*225));window.drawSharp()},chapter);
   await page.screenshot({path:`${out}/after-ch${chapter}-enemies.png`});
  }
  await page.evaluate(()=>{const g=window.__game;g.ui.chapterSay({name:'小满',portrait:'/art/portraits/xiaoman/calm.png'},'平静','清晰度检查','P6-20',false,{pause:true,onDone:()=>{},onSkip:()=>{}});window.drawSharp()});
  await page.waitForFunction('[...document.querySelectorAll(".story-portrait img")].every(i=>i.complete&&i.naturalWidth>0)');await new Promise(r=>setTimeout(r,350));
  const portraits=await page.evaluate(()=>[...document.querySelectorAll('.story-portrait img')].map(i=>({path:i.src,source:[i.naturalWidth,i.naturalHeight],box:[i.getBoundingClientRect().width,i.getBoundingClientRect().height]})));writeFileSync(`${out}/portrait.json`,JSON.stringify(portraits,null,2));
  await page.screenshot({path:`${out}/after-portrait.png`});await page.evaluate(()=>window.__game.ui.dialogueSkip());
 }
 const performanceReport=await page.evaluate(async()=>{
  const g=window.__game,w=g.world,r=g.r,gl=r.gl;r.setBackground('stage1');w.resetStage();w.player.entering=0;w.player.invuln=0;w.player.x=450;w.player.y=1050;
  for(let i=0;i<10;i++)w.spawn({sprite:['e_hornet','e_crane','e_turtle','e_moth','e_junk'][i%5],hp:100},100+(i%5)*170,180+Math.floor(i/5)*200);
  for(let i=0;i<60;i++)w.bullets.spawn(80+(i%10)*82,550+Math.floor(i/10)*70,Math.PI/2,180,{shape:'rice',color:'cyan'});
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)throw new Error('GPU timer unavailable');
  const queries=[],cpu=[],completed=[];for(let i=0;i<180;i++){await new Promise(r=>setTimeout(r,0));w.time=i/60;w.visualTime=i/60;w.real=i/60;const q=gl.createQuery(),start=performance.now();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);window.drawSharp();gl.endQuery(ext.TIME_ELAPSED_EXT);cpu.push(performance.now()-start);gl.finish();completed.push(performance.now()-start);queries.push(q)}
  await new Promise(r=>setTimeout(r,40));const gpu=queries.map(q=>gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&!gl.getParameter(ext.GPU_DISJOINT_EXT)?gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6:null);queries.forEach(q=>gl.deleteQuery(q));
  const stats=values=>{values=values.slice(60).filter(v=>v!==null).sort((a,b)=>a-b);return{n:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:values[Math.floor(values.length*.95)]}};
  return{scenario:'10架敌机+60发敌弹固定密集段',gpu:stats(gpu),cpuSubmit:stats(cpu),completed:stats(completed),glError:gl.getError(),enemyCount:w.enemies.length,bulletCount:w.bullets.list.length};
 });
 await page.screenshot({path:`${out}/${label}-dense.png`});
 // DPR及历史低渲染精度配置核查。
 await page.setViewport({width:1920,height:1080,deviceScaleFactor:2});
 const dpr=await page.evaluate(()=>{const r=window.__game.r;r.setRenderScale(.5);return{dpr:devicePixelRatio,canvas:[r.canvas.width,r.canvas.height],play:r.playPx,renderScale:r.renderScale}});
 const report={label,audit,performance:performanceReport,dpr,errors};writeFileSync(`${out}/${label}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({label,undersized:audit.undersized,performance:performanceReport,dpr,errors},null,2));if(errors.length||performanceReport.glError)throw new Error('渲染检查失败');
}finally{await browser.close()}
