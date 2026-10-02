// P4-05b：真实测试入口逐阶段取样；普通难度、无无敌，机器人只移动/射击。
// 每帧核查总弹池峰值，每0.5秒取屏内峰值；每名首领取一张峰值图。
import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {setup} from 'local-source/setup.mjs';
const url=process.argv[2]??'http://127.0.0.1:5181/',out=process.argv[3]??'local-source/bosses';mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const results=[];
try{for(const [chapter,checkpoint,phases] of [[1,'SPARROW',3],[1,'SERPENT',3],[2,'MIRAGE',4]]){
 let best=null;const checks=[];
 for(let phase=1;phase<=phases;phase++){
  const page=await browser.newPage();await page.setViewport({width:1200,height:1000});await page.evaluateOnNewDocument(()=>{window.requestAnimationFrame=()=>0;});await page.goto(url+'?diff=normal');await page.waitForFunction('window.__game',{timeout:60000,polling:100});
  await page.evaluate(setup,{chapter,run:phase,seed:202610900+chapter*10+phase});
  await page.evaluate(({chapter,checkpoint,phase})=>{const g=window.__game;g.toTitle();g.onTestStart({chapter,checkpoint,bossPhase:phase,god:false,fullInk:false,fullBombs:false,brushPower:1,brushMethods:[],companions:[],passives:[]});window.measure.poolPeak=0;window.measure.startedBoss=false;window.measure.bossFrames=0;}, {chapter,checkpoint,phase});
  let done=false;
  while(!done){const res=await page.evaluate(async best=>{const g=window.__game,w=g.world,m=window.measure;for(let i=0;i<300;i++){
   if(g.state!=='playing'||m.frames>=7200||(m.startedBoss&&!w.bossE))return{done:true};
   g.input.poll();g.update(1/60);m.frames++;
   if(w.bossE){m.startedBoss=true;m.bossFrames++;const count=w.bullets.list.filter(b=>!b.dead).length;m.poolPeak=Math.max(count,m.poolPeak);if(count>60)throw Error('Boss cap exceeded '+count);}
   if(m.frames%30===0){const row=m.sample();g.render();if(w.bossE&&(!best||row.bullet_count>best.bullet_count)){return{candidate:row,rect:g.r.playCss,done:false};}await new Promise(r=>setTimeout(r,0));}
  }return{done:false};},best);
   if(res.candidate){best={...res.candidate,phase,screenshot:checkpoint+'.png'};await new Promise(r=>setTimeout(r,5200));await page.evaluate(()=>window.__game.render());const r=res.rect;await page.screenshot({path:out+'/'+checkpoint+'.png',clip:{x:r.x,y:r.y,width:r.w,height:r.h}});}
   done=res.done;
  }
  const check=await page.evaluate(()=>{const m=window.measure,g=window.__game;return{poolPeak:m.poolPeak,frames:m.frames,bossFrames:m.bossFrames,deaths:m.deaths,state:g.state,checkpoint:g.world.currentCheckpoint};});checks.push({phase,...check});await page.close();
 }
 assert(best);assert(checks.every(c=>c.bossFrames>0));const result={chapter,checkpoint,cap:60,peak:best,checks};results.push(result);writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({chapter,checkpoint,poolPeak:Math.max(...checks.map(c=>c.poolPeak)),visiblePeak:best.bullet_count,phase:best.phase,checks:checks.map(c=>({phase:c.phase,deaths:c.deaths.length,bossFrames:c.bossFrames}))}));
}}finally{await browser.close();}
