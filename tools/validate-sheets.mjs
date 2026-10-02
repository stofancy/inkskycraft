// 真实 GPU 分镜画廊：独立播放/关键帧、图集、暂停、挂接、5 秒关键帧与帧时间。
// node tools/validate-sheets.mjs [http://127.0.0.1:5177/] [证据目录=.shots/p0-09]
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:5177/';
const out = process.argv[3] ?? '.shots/p0-09';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-first-run'] });
const report = { base, errors: [], warnings: [], frames: [] };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('pageerror', e => report.errors.push(e.stack ?? e.message));
  page.on('console', m => { if (['error','warn'].includes(m.type()) && !/GPU stall|CONTEXT_LOST/.test(m.text())) report.warnings.push(m.text()); });
  await page.goto('about:blank'); await new Promise(r => setTimeout(r, 2000));
  await page.goto(new URL('tools/anim.html?gallery=1', base).href);
  await page.waitForFunction('document.querySelector("#scene").contentWindow?.__sheets && document.querySelector("#status").hidden', { timeout: 60000 });
  const scene = page.frames().find(f => f.url().includes('pipeline=1')); assert.ok(scene);
  report.playback = await scene.evaluate(() => {
    const Playback = window.__sheets.entries[0].playback.constructor;
    const events = []; const p = new Playback({ count: 4, fps: 10, mode: 'loop', events: [{ frame: 1, name: 'hit' },{ frame: 0, name: 'start' }] }, e => events.push(e));
    p.update(.55); if (p.frame !== 1 || events.map(e=>e.name).join(',') !== 'hit,start,hit') throw new Error('跨帧事件丢失');
    const q = new Playback({ count: 4, fps: 10, mode: 'loop' });
    if (q.frame !== 0 || p.frame !== 1) throw new Error('独立实例互相污染');
    p.paused = true; p.update(1); if (p.frame !== 1 || events.length !== 3) throw new Error('暂停仍推进');
    p.seek(.2); if (p.frame !== 2 || events.length !== 3) throw new Error('seek 触发事件');
    const once = new Playback({ count: 3, fps: 10, mode: 'once', events: [{ frame: 2, name: 'last' }] }, e => events.push(e));
    once.update(.3); once.update(1); if (!once.finished || once.frame !== 2 || events.length !== 4) throw new Error('单次末帧或事件错误');
    once.restart(); if (once.finished || once.frame !== 0) throw new Error('无法重播');
    const directions=[];const ping = new Playback({ count: 3, fps: 10, mode: 'pingpong', events: [{ frame: 1, name: 'mid' }] }, e=>directions.push(e.direction));
    const frames=[ping.frame]; for (let i=0;i<6;i++){ping.update(.1);frames.push(ping.frame);}
    if (frames.join(',') !== '0,1,2,1,0,1,2' || directions.join(',') !== '1,-1,1') throw new Error('往返端点或事件方向错误');
    let rejected=0;for (const s of [{count:0,fps:10,mode:'loop'},{count:4,fps:0,mode:'loop'},{count:4,fps:10,mode:'bad'},{count:4,fps:10,mode:'loop',events:[{frame:4,name:'bad'}]}]){try{new Playback(s)}catch{rejected++}}
    if (rejected!==4) throw new Error('错误元数据未拒绝');
    return { loopFrame: p.frame, onceFinished: true, pingpongFrames: frames, eventDirections: directions, rejectedSpecs: rejected, events };
  });
  report.live = await scene.evaluate(async () => {
    const g=window.__game,a=window.__sheets; const start={time:g.world.time,frames:a.entries.map(e=>e.entity.frame),events:a.events.length};
    await new Promise(r=>setTimeout(r,5200));const end={time:g.world.time,frames:a.entries.map(e=>e.entity.frame),events:a.events.length};
    if(end.time-start.time<3 || end.events <= start.events)throw new Error('实时播放或命中回调没有推进');
    if(a.entries[1].playback === a.entries[8].playback)throw new Error('伙伴共用播放状态');
    return {start,end};
  });
  await page.click('#pause');
  report.pause = await scene.evaluate(async () => {
    const g=window.__game, start=g.world.time,frames=window.__sheets.entries.map(e=>e.entity.frame);
    await new Promise(r=>setTimeout(r,350));
    if(g.world.time!==start || frames.join(',')!==window.__sheets.entries.map(e=>e.entity.frame).join(','))throw new Error('游戏暂停未停动画');
    return {time:start,frames};
  });
  await page.click('#replay');
  report.manualReplay = await scene.evaluate(() => {
    const entry=window.__sheets.entries.find(e=>e.id==='explosion');
    if(entry.entity.frame!==0 || entry.playback.frame!==0 || entry.playback.finished)throw new Error('暂停时重播没有显示首帧');
    return {frame:entry.entity.frame,finished:entry.playback.finished};
  });
  report.atlas = await scene.evaluate(() => window.__sheets.entries.slice(0,8).map(e => {
    const s=window.__game.r.atlas.get(e.def.id);
    if(s.frames.length!==e.def.sheet.count || !s.mask.some(v=>v))throw new Error('图集帧数或透明遮罩错误');
    return {id:e.id,frames:s.frames.length,pivot:s.pivot,maskCells:s.mask.reduce((n,v)=>n+v,0),size:[s.w,s.h]};
  }));
  for (const t of [0,.0625,.1875,.3125,.5,.75,1,1.25,1.5,2,3,4,5]) {
    const data = await scene.evaluate(time => {
      const g=window.__game,a=window.__sheets;a.seek(time);g.render();
      const part=a.entries.find(e=>e.id==='boss').entity;const root=part.anchor('root'); const joint=part.parent.local(part.offX,part.offY);
      const error=Math.hypot(root.x-joint.x,root.y-joint.y);
      if(error>1e-7)throw new Error('分镜与骨骼挂点失去对齐');
      const glError=g.r.gl.getError();if(glError!==0)throw new Error('WebGL 错误 '+glError);
      return {time,frames:a.entries.map(e=>e.entity.frame),jointError:error,glError,playCss:g.r.playCss};
    },t);
    report.frames.push(data);await page.screenshot({path:`${out}/gallery-${t.toFixed(4)}.png`});
  }
  // 同一时间对照 shader 形变开关，另留夜景/云海透明边缘证据。
  await scene.evaluate(()=>{window.__sheets.seek(.3125);window.__sheets.setDeform(false);window.__game.render()});
  await page.screenshot({path:`${out}/deform-off.png`});
  for(const stage of [2,3]){
    await scene.evaluate(s=>{window.__game.r.setBackground(`stage${s}`);window.__game.render();if(window.__game.r.gl.getError()!==0)throw new Error('背景切换 WebGL 错误')},stage);
    await page.screenshot({path:`${out}/gallery-stage${stage}.png`});
  }
  await page.setViewport({width:900,height:1200});
  await scene.evaluate(()=>{window.__game.r.setBackground('stage1');window.__sheets.setDeform(true);window.__sheets.seek(.3125);window.__game.render()});
  await page.screenshot({path:`${out}/gallery-900x1200.png`});
  await page.setViewport({width:1600,height:1000});
  report.performance=await scene.evaluate(async()=>{
    const g=window.__game,r=g.r,a=window.__sheets;
    const debug=r.gl.getExtension('WEBGL_debug_renderer_info');
    const hardware=debug?r.gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown';
    r.startTimer('frame');
    const render=g.render.bind(g);g.render=()=>{};
    async function sample(active){
      const cpu=[],gpu=[],interval=[];let previous=performance.now();
      for(let i=0;i<180;i++){
        await new Promise(requestAnimationFrame);const now=performance.now();
        if(active)a.seek(i/60);
        const start=performance.now();render();const ms=performance.now()-start;
        if(i>=60){cpu.push(ms);interval.push(now-previous);if(r.timer.ms.frame>0)gpu.push(r.timer.ms.frame)}previous=now;
      }
      const stats=values=>{const sorted=values.slice().sort((x,y)=>x-y);return {n:values.length,mean:values.reduce((x,y)=>x+y,0)/values.length,p95:sorted[Math.floor(sorted.length*.95)]??null}};
      return {cpuRenderMs:stats(cpu),gpuFrameMs:stats(gpu),rafIntervalMs:stats(interval)};
    }
    const frozen=await sample(false),animated=await sample(true);
    g.render=render;
    return {hardware,renderScale:r.renderScale,quality:r.quality,viewport:[innerWidth,innerHeight],frozen,animated};
  });
  assert.equal(report.errors.length,0);
  assert.equal(report.warnings.length,0,JSON.stringify(report.warnings));
  writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({pass:true,classes:report.atlas.length,frames:report.frames.length,events:report.live.end.events,errors:report.errors.length,performance:report.performance},null,2));
} finally { await browser.close(); writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2)); }
