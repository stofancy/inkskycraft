// P4-M1：仅输入移动与射击；60Hz逻辑、0.5秒采样，截图时冻结状态。
import puppeteer from 'puppeteer-core';
import {writeFileSync,mkdirSync,readFileSync,existsSync} from 'node:fs';
const out=process.argv[3]??'local-source/round1';const url=process.argv[2]??'http://127.0.0.1:5181/';
mkdirSync(out+'/candidates',{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
const only2=false,segment=process.argv.includes('--e10');
const runs=existsSync(out+'/runs.json')?JSON.parse(readFileSync(out+'/runs.json','utf8')):[],tops=existsSync(out+'/top5.json')?JSON.parse(readFileSync(out+'/top5.json','utf8')):[];
const compare=(a,b)=>b.enemy_count-a.enemy_count||b.enemy_area_pct-a.enemy_area_pct||a.run-b.run||a.elapsed_s-b.elapsed_s;
try{
for(let chapter=only2?2:1;chapter<=(segment?1:2);chapter++)for(let run=1;run<=3;run++){
 if(runs.some(r=>r.chapter===chapter&&r.run===run))continue;
 const page=await browser.newPage();await page.setViewport({width:1200,height:1000});
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await page.evaluateOnNewDocument(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto(url+'?diff=normal',{waitUntil:'load'});
 await page.waitForFunction('window.__game',{timeout:60000,polling:100});
 const seed=202610050+chapter*10+run;await page.evaluate(v=>window.segment=v,segment);
 await page.evaluate(async({chapter,run,seed})=>{
  const g=window.__game,w=g.world,p=w.player;let rand=seed;
  Math.random=()=>{rand=(rand+0x6d2b79f5)|0;let t=Math.imul(rand^(rand>>>15),1|rand);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
  w.rng.s=seed;g.debug.god=false;g.debug.bot=false;g.testRun=null;w.testOptions=null;w.debugAuto=false;w.setDifficulty('normal');w.newGame();
  const m=window.measure={chapter,run,seed,frames:0,rows:[],deaths:[],choices:[],origins:new WeakMap(),top:[],ended:false};
  const spawn=w.spawn.bind(w);w.spawn=(...args)=>{const e=spawn(...args);m.origins.set(e,{checkpoint:w.currentCheckpoint,spawn_game_s:w.t,stack:new Error().stack});return e;};
  const die=p.die.bind(p);p.die=(...args)=>{const was=p.alive;const ans=die(...args);if(was&&!p.alive)m.deaths.push({elapsed_s:(m.frames+1)/60,game_s:w.t,lives:p.lives,checkpoint:w.currentCheckpoint});return ans;};
  g.input.down=a=>a==='shoot';g.input.pressed=()=>false;g.input.consume=()=>{};
  g.input.poll=()=>{
   if(!p.alive){g.input.axisX=0;g.input.axisY=0;return;}
   let best=Infinity,bx=0,by=0;const dirs=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[.707,-.707],[-.707,.707],[-.707,-.707]];
   for(const [dx,dy] of dirs){let cost=0;
    for(const h of [.12,.3,.55]){const x=Math.max(26,Math.min(874,p.x+dx*420*h)),y=Math.max(50,Math.min(1164,p.y+dy*420*h));
     cost+=((x-450)/450)**2*.3+((y-1000)/400)**2*.7;
     if(x<55||x>845||y<700||y>1130)cost+=2;
     for(const b of w.bullets.list){if(b.dead)continue;const t=Math.max(0,h-Math.max(0,b.delay-b.age)),d=Math.hypot(x-b.x-b.vx*t,y-b.y-b.vy*t)-(b.radius+5);if(d<80)cost+= d<0?1000+(-d)*20:120/(d+3);}
     for(const e of w.enemies){if(e.dead||e.def.noCollide||e.def.ground||e.def.decorative)continue;const d=Math.hypot(x-e.x-e.vx*h,y-e.y-e.vy*h)-(e.radius+5);if(d<90)cost+=d<0?1200+(-d)*20:100/(d+3);}
     for(const l of w.lasers){if(l.dead||l.t+h<l.o.warn||l.t>l.o.warn+l.o.duration)continue;const vx=Math.cos(l.angle),vy=Math.sin(l.angle),t=Math.max(0,Math.min(l.o.length,(x-l.x)*vx+(y-l.y)*vy));const d=Math.hypot(x-l.x-vx*t,y-l.y-vy*t)-l.o.width/2-5;if(d<70)cost+=d<0?1400:160/(d+3);}
    }
    cost+=Math.hypot(dx,dy)*.05;if(cost<best){best=cost;bx=dx;by=dy;}
   }g.input.axisX=bx;g.input.axisY=by;
  };
  m.sample=()=>{
   const boxes=[],roots=new Set(),detail=[];
   for(const e of w.enemies){if(e.dead||e.alpha<=0)continue;let root=e;while(root.parent)root=root.parent;root=root.data.bossOwner??root;if(root.def.decorative||root.data.contentRole==='prop')continue;
    const {w:sw,h:sh,pivot}=e.info,sx=e.scaleX*(e.mirror?-1:1),sy=e.scaleY,c=Math.cos(e.angle),s=Math.sin(e.angle),pts=[];
    for(const u of [-.5,.5])for(const v of [-.5,.5]){const xx=(u*sw-pivot[0])*sx,yy=(v*sh-pivot[1])*sy;pts.push([e.x+xx*c-yy*s,e.y+xx*s+yy*c]);}
    const box=[Math.max(0,Math.min(...pts.map(q=>q[0]))),Math.max(0,Math.min(...pts.map(q=>q[1]))),Math.min(900,Math.max(...pts.map(q=>q[0]))),Math.min(1200,Math.max(...pts.map(q=>q[1])))];if(box[2]<=box[0]||box[3]<=box[1])continue;
    boxes.push(box);roots.add(root.id);detail.push({id:e.id,root_id:root.id,sprite:e.info.id,type:root.data.enemyType??null,box,origin:m.origins.get(root)??m.origins.get(e)});
   }
   const xs=[...new Set(boxes.flatMap(b=>[b[0],b[2]]))].sort((a,b)=>a-b);let area=0;
   for(let i=1;i<xs.length;i++){const ys=boxes.filter(b=>b[0]<xs[i]&&b[2]>xs[i-1]).map(b=>[b[1],b[3]]).sort((a,b)=>a[0]-b[0]);let len=0,lo=0,hi=0;for(const [a,b] of ys){if(a>hi){len+=hi-lo;lo=a;hi=b;}else hi=Math.max(hi,b);}len+=hi-lo;area+=(xs[i]-xs[i-1])*len;}
   const row={chapter,run,normal_count:w.density.count(w.enemies),queued:w.enemies.filter(e=>!e.dead&&e.data.densityQueued).length,boss:!!w.bossE,elapsed_s:m.frames/60,game_s:w.t,enemy_count:roots.size,bullet_count:w.bullets.list.filter(b=>!b.dead&&b.x+b.size>=0&&b.x-b.size<=900&&b.y+b.size>=0&&b.y-b.size<=1200).length,enemy_area_pct:area/1080000*100,enemy_area_sum_pct:boxes.reduce((a,b)=>a+(b[2]-b[0])*(b[3]-b[1]),0)/1080000*100,alive:p.alive?1:0,lives:p.lives,checkpoint:w.currentCheckpoint,state:g.state,x:p.x,y:p.y,power:p.power,bombs_used:w.bombsUsed,brush_stroke_id:w.brush.lastStroke?.id??0};m.rows.push(row);return {...row,detail};
  };
  await g.startStage(chapter-1);m.initial={power:p.power,weapon:p.weapon,lives:p.lives,bombs:p.bombs,invuln:p.invuln,companions:w.companions.team.map(q=>q.kind)};m.sample();g.render();
 },{chapter,run,seed});
 if(segment){
  await page.evaluate(()=>{const g=window.__game;g.toTitle();const click=label=>{const el=[...document.querySelectorAll('.mi')].find(e=>e.querySelector('.ml')?.textContent===label);if(!el)throw Error(label);el.click();};click('测 试');for(let i=0;i<16;i++){const row=[...document.querySelectorAll('.mi')].find(e=>e.querySelector('.ml')?.textContent==='起点');if(row?.querySelector('.ms')?.textContent?.startsWith('E10'))break;click('起点');}click('进入测试');const w=g.world;window.measure.initial={power:w.player.power,weapon:w.player.weapon,lives:w.player.lives,bombs:w.player.bombs,invuln:w.player.invuln,companions:w.companions.team.map(q=>q.kind)};});
 }
 let done=false,shots=0;
 while(!done){
  const res=await page.evaluate(async top=>{
   const g=window.__game,w=g.world,m=window.measure;
   for(let i=0;i<600;i++){
    if(g.state==='growth'){const id=w.progression.offerTalents()[0]?.id;m.choices.push({game_s:w.t,id,mode:'talent'});g.onChoice(id);}
    if(g.state!=='playing'||m.frames>=(m.chapter===1?(window.segment?7200:28800):72000)){m.ended=true;break;}
    g.input.poll();g.update(1/60);m.frames++;
    if(m.frames%30===0){const row=m.sample();g.render();
     if(m.chapter<=2){const cmp=(a,b)=>b.enemy_count-a.enemy_count||b.enemy_area_pct-a.enemy_area_pct||a.run-b.run||a.elapsed_s-b.elapsed_s;const rank=[...top,row].sort(cmp).slice(0,1);if(rank.includes(row)){return {candidate:row,done:false,rect:g.r.playCss};}}
     await new Promise(r=>setTimeout(r,0));
    }
   }
   return {done:m.ended,rect:g.r.playCss};
  },tops.filter(r=>r.chapter===chapter&&r.run===run));
  if(res.candidate){const r=res.rect,filename=`candidates/ch${chapter}-run${run}-t${res.candidate.elapsed_s.toFixed(1)}.png`;await page.screenshot({path:out+'/'+filename,clip:{x:r.x,y:r.y,width:r.w,height:r.h}});res.candidate.screenshot=filename;tops.push(res.candidate);tops.sort(compare);for(const ch of [1,2]){const extra=tops.filter(r=>r.chapter===ch&&r.run===run).slice(1);for(const q of extra)tops.splice(tops.indexOf(q),1);}shots++;}
  done=res.done;
 }
 const result=await page.evaluate(()=>{const m=window.measure,w=window.__game.world;return{chapter:m.chapter,run:m.run,seed:m.seed,initial:m.initial,rows:m.rows,deaths:m.deaths,choices:m.choices,end:{elapsed_s:m.frames/60,game_s:w.t,state:window.__game.state,checkpoint:w.currentCheckpoint,lives:w.player.lives,formed:w.sceneState?.formed,times:w.sceneState?.times,events:w.sceneState?.events,bombs_used:w.bombsUsed,brush_stroke_id:w.brush.lastStroke?.id??0,kills:w.kills}};});
 const headers=Object.keys(result.rows[0]);writeFileSync(`${out}/ch${chapter}-run${run}.csv`,headers.join(',')+'\n'+result.rows.map(r=>headers.map(h=>r[h]).join(',')).join('\n')+'\n');writeFileSync(`${out}/ch${chapter}-run${run}.json`,JSON.stringify(result,null,2));runs.push(result);writeFileSync(out+'/runs.json',JSON.stringify(runs,null,2));writeFileSync(out+'/top5.json',JSON.stringify(tops,null,2));
 const r=resrect=>page.screenshot({path:`${out}/ch${chapter}-run${run}-end.png`,clip:{x:resrect.x,y:resrect.y,width:resrect.w,height:resrect.h}});const rect=await page.evaluate(()=>window.__game.r.playCss);await r(rect);
 console.log(JSON.stringify({chapter,run,end:result.end,deaths:result.deaths,choices:result.choices,peak:Math.max(...result.rows.map(r=>r.enemy_count)),samples:result.rows.length,shots}));await page.close();
}
}finally{await browser.close();}
