// 自动试玩与浏览器实录；所有产物写到当前副本，运行不修改游戏源码。
// node tools/showcase.mjs [URL] [输出目录]，需 Chrome 与 FFmpeg。
import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const base=process.argv[2]??'http://127.0.0.1:5189/';
const out=resolve(process.argv[3]??'docs/showcase');
mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];const scenes=[];let recorder;
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:960,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.evaluateOnNewDocument(()=>{
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(dest,...args){
   if(dest instanceof AudioDestinationNode){
    window.__recordContext=this.context;window.__recordBus??=this.context.createMediaStreamDestination();
    connect.call(this,window.__recordBus);
   }
   return connect.call(this,dest,...args);
  };
 });
 await page.goto('about:blank');await sleep(2000);
 await page.goto(base,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__game?.state==='title',{timeout:60000});
 await sleep(1200);await page.screenshot({path:join(out,'title.png')});
 await page.keyboard.press('Shift');
 await page.evaluate(async()=>{
  await window.__game.audio.init();await window.__recordContext.resume();
  window.__soundChunks=[];window.__soundRecorder=new MediaRecorder(window.__recordBus.stream,{mimeType:'audio/webm'});
  window.__soundRecorder.ondataavailable=e=>{if(e.data.size)window.__soundChunks.push(e.data);};
  window.__soundRecorder.start(1000);
 });
 recorder=await page.screencast({path:join(out,'gameplay-silent.mp4'),format:'mp4',fps:30,ffmpegPath:process.env.FFMPEG_PATH??'/usr/bin/ffmpeg'});
 for(const [idx,entry] of [{chapter:1,checkpoint:'W12',name:'chapter1',weapon:'red'},{chapter:2,checkpoint:'W12',name:'chapter2',weapon:'blue'},{chapter:3,checkpoint:'W12',name:'chapter3',weapon:'purple'}].entries()){
  await page.evaluate(async entry=>{
   const g=window.__game;g.toTitle();const {defaultTestOptions}=await import('/src/game/test-options.ts');
   const options={...defaultTestOptions(),chapter:entry.chapter,checkpoint:entry.checkpoint,god:true,fullInk:true,fullBombs:true};
   const {TEST_CHECKPOINTS}=await import('/src/stages/checkpoints.ts');if(!TEST_CHECKPOINTS[entry.chapter].some(c=>c.id===entry.checkpoint))throw Error('未知起点 '+entry.checkpoint);g.onTestStart(options);g.world.player.weapon=entry.weapon;
   const original=g.input.down.bind(g.input);g.input.down=a=>a==='shoot'||original(a);
   g.world.debugAuto=true;
   window.__advance=setInterval(()=>{const ui=g.ui;if(ui.dialogueState?.().active)ui.dialogueAdvance?.();if(g.state==='growth'){const buttons=[...document.querySelectorAll('[role=button]')];buttons.find(b=>b.getAttribute('aria-disabled')!=='true')?.click();}},400);
  },entry);
  await page.waitForFunction(()=>window.__game.state==='playing',{timeout:30000});
  await sleep(4500);
  for(let step=0;step<5;step++){
   await page.keyboard.down(step%2?'ArrowLeft':'ArrowRight');await sleep(650);await page.keyboard.up(step%2?'ArrowLeft':'ArrowRight');await sleep(850);
   if(step===1){await page.keyboard.press('x');}
   if(step===3){await page.waitForFunction(()=>window.__game.state==='playing',{timeout:10000});await page.screenshot({path:join(out,entry.name+'.png')});}
  }
  const state=await page.evaluate(()=>{clearInterval(window.__advance);const g=window.__game;return {state:g.state,chapter:g.world.stageIndex,time:g.world.real,score:g.world.score,fps:g.fps};});
  scenes.push({chapter:entry.chapter,checkpoint:entry.checkpoint,...state});
  console.log(JSON.stringify(scenes.at(-1)));
 }
 await recorder.stop();recorder=null;
 const sound=await page.evaluate(async()=>{
  await new Promise(r=>{window.__soundRecorder.onstop=r;window.__soundRecorder.stop();});
  const data=new Uint8Array(await new Blob(window.__soundChunks,{type:'audio/webm'}).arrayBuffer());
  let binary='';for(let i=0;i<data.length;i+=65536)binary+=String.fromCharCode(...data.subarray(i,i+65536));return btoa(binary);
 });
 writeFileSync(join(out,'gameplay-audio.webm'),Buffer.from(sound,'base64'));
 const ff=spawnSync(process.env.FFMPEG_PATH??'/usr/bin/ffmpeg',['-y','-i',join(out,'gameplay-silent.mp4'),'-i',join(out,'gameplay-audio.webm'),'-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',join(out,'gameplay.mp4')],{encoding:'utf8'});
 if(ff.status!==0)throw Error(ff.stderr);
 writeFileSync(join(out,'recording.json'),JSON.stringify({source:JSON.parse((await import('node:fs')).readFileSync('SOURCE.json','utf8')),recordedAt:new Date().toISOString(),mode:'automated gameplay, invulnerable test options; live browser video and game audio',scenes,errors},null,2)+'\n');
 if(errors.length)throw Error('自动试玩记录到浏览器错误，请查看 recording.json');
}finally{if(recorder)await recorder.stop();await browser.close();}
