// P4-05：复用P4-M1确定性机器人，冻结峰值后等待DOM演出自然退场。
import puppeteer from 'puppeteer-core';
import {readFileSync,writeFileSync} from 'node:fs';
import {setup} from 'local-source/setup.mjs';
const out=process.argv[3]??'local-source/round1',url=process.argv[2]??'http://127.0.0.1:5181/',tops=JSON.parse(readFileSync(out+'/top5.json','utf8')),runs=JSON.parse(readFileSync(out+'/runs.json','utf8'));
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
const checks=[];
try{
 for(const key of [...new Set(tops.map(r=>`${r.chapter}:${r.run}`))]){const [chapter,run]=key.split(':').map(Number);
  const page=await browser.newPage();await page.setViewport({width:1200,height:1000});await page.evaluateOnNewDocument(()=>{window.requestAnimationFrame=()=>0;});await page.goto(url+'?diff=normal',{waitUntil:'load'});await page.waitForFunction('window.__game',{timeout:60000,polling:100});await page.evaluate(setup,{chapter,run,seed:runs.find(r=>r.chapter===chapter&&r.run===run).seed});
  for(const row of tops.filter(r=>r.run===run&&r.chapter===chapter).sort((a,b)=>a.elapsed_s-b.elapsed_s)){
   const actual=await page.evaluate(async target=>{const g=window.__game,w=g.world,m=window.measure;while(m.frames<target*60){if(g.state==='growth')g.onChoice(w.progression.offerTalents()[0]?.id);if(g.state!=='playing')throw Error(g.state);g.input.poll();g.update(1/60);m.frames++;if(m.frames%30===0){m.sample();g.render();await new Promise(r=>setTimeout(r,0));}}return{...m.sample(),rect:g.r.playCss};},row.elapsed_s);
   if(actual.enemy_count!==row.enemy_count||Math.abs(actual.enemy_area_pct-row.enemy_area_pct)>1e-7||actual.bullet_count!==row.bullet_count)throw Error('replay mismatch '+JSON.stringify({actual,row}));
   // 保持世界冻结，等待真实 DOM 标题的生命周期结束；未删除界面或改动游戏状态。
   await new Promise(r=>setTimeout(r,5200));await page.evaluate(()=>window.__game.render());const r=actual.rect;await page.screenshot({path:out+'/'+row.screenshot,clip:{x:r.x,y:r.y,width:r.w,height:r.h}});
   checks.push({chapter,run,time:row.elapsed_s,enemy_count:actual.enemy_count,bullet_count:actual.bullet_count,enemy_area_pct:actual.enemy_area_pct,screenshot:row.screenshot,matched:true});console.log(JSON.stringify(checks.at(-1)));
  }await page.close();
 }
 writeFileSync(out+'/capture-checks.json',JSON.stringify(checks,null,2));
}finally{await browser.close();}
