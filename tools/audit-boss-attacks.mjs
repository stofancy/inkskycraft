// P4-05c：每阶段入口单独测试，60Hz，关闭射击以保留全部攻击/部件。
// 诊断开启无敌；每次预算结果保留攻击名、组大小、场上弹数与局部/公共预算来源。
import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
const url=process.argv[2]??'http://127.0.0.1:5181/',out=process.argv[3]??'local-source/attacks';mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});const results=[],tail=process.argv.includes('--tail');
try{for(const [chapter,checkpoint,phases] of [[1,'SPARROW',3],[1,'SERPENT',3],[2,'MIRAGE',4]])for(let phase=1;phase<=phases;phase++){
 if(tail&&(checkpoint!=='MIRAGE'||phase!==4))continue;
 const page=await browser.newPage();await page.setViewport({width:1200,height:1000});await page.evaluateOnNewDocument(()=>{window.requestAnimationFrame=()=>0;});await page.goto(url+'?diff=normal');await page.waitForFunction('window.__game',{timeout:60000,polling:100});
 const result=await page.evaluate(async ({chapter,checkpoint,phase,tail})=>{
  const g=window.__game,w=g.world;g.toTitle();w.setDifficulty('normal');g.onTestStart({chapter,checkpoint,bossPhase:phase,god:true,fullInk:false,fullBombs:false,brushPower:1,brushMethods:[],companions:[],passives:[]});g.input.down=()=>false;g.input.pressed=a=>!!(tail&&a==='bomb'&&w.challengeState?.action==='bomb'&&w.challengeState.elapsed>.2);g.input.consume=()=>{};g.input.poll=()=>{g.input.axisX=g.input.axisY=0;};
  let started=false,frames=0,peak=0;const visited=new Set();
  while(frames<7200&&g.state==='playing'){
   g.input.poll();g.update(1/60);frames++;
   if(w.bossE){started=true;visited.add(w.bossE.data.phaseIndex??w.bossE.data.phase);peak=Math.max(peak,w.bullets.list.filter(b=>!b.dead).length);if(peak>60)throw Error('cap '+peak);if(!tail&&(w.bossE.data.phaseIndex??w.bossE.data.phase)>phase)break;}else if(started)break;
   if(frames%30===0)await new Promise(r=>setTimeout(r,0));
  }
  return {chapter,checkpoint,phase,god:true,frames,peak,visited:[...visited],log:w.density.attackLog.filter(a=>tail||a.phase===phase)};
 },{chapter,checkpoint,phase,tail});
 result.summary=[];for(const name of [...new Set(result.log.map(a=>a.attack))]){const rows=result.log.filter(a=>a.attack===name);result.summary.push({attack:name,attempts:rows.length,success:rows.filter(a=>!a.rejected).length,rejected:rows.filter(a=>a.rejected).length,maxSize:Math.max(...rows.map(a=>a.size)),maxGroupSize:Math.max(...rows.map(a=>a.groupSize)),rejectRate:rows.filter(a=>a.rejected).length/rows.length,kind:rows[0].reason==='laser'?'laser':'bullets'});}
 results.push(result);writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({checkpoint,phase,peak:result.peak,summary:result.summary}));await page.close();
}}finally{await browser.close();}
