// P2-06：先用真实键盘验证三招入口，再以固定 60Hz 世界时钟核对作用和连续帧。
// 由 validate-moves.mjs 调用。截图使用正常 Game.render，场景停止刷怪；手感与审图留给制作人。
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export async function validateExpandedMoves(page,out,checks){
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 await page.evaluate(()=>{window.__game.onResume();window.testPad.buttons.forEach(b=>{b.pressed=false;b.value=0;});window.testPad.axes=[0,0];});
 await page.setViewport({width:1600,height:900});await wait(100);
 const prep=()=>page.evaluate(()=>{
  const g=window.__game,w=g.world,p=w.player;g.debug.god=false;w.root.cancel();w.enemies=[];w.bullets.clear();w.lasers=[];
  w.challengeState=null;w.lastWeaponTarget=null;w.moves.resetStage();w.fx.clear();w.fx.trauma=w.fx.flashAmt=w.fx.caAmt=0;w.r.partLow.reset();w.r.partHigh.reset();w.r.fluid.clear();w.r.impact.clear();w.items.clear();p.reset(false);p.x=450;p.y=900;p.ink=1;p.invuln=0;p.weapon='red';
  w.companions.resetStage();w.combos.resetStage();w.progression.resetStage();for(const s of w.companions.team){s.level=1;s.cooldown=99;}w.timeScale=1;
 });
 const tap=async key=>{await page.keyboard.down(key);await wait(65);await page.keyboard.up(key);await wait(55);};
 const state=()=>page.evaluate(()=>({id:window.__game.world.moves.lastId,total:window.__game.world.moves.total}));
 const keyboard=[];
 for(const [id,keys]of [['dash',['ArrowUp','ArrowRight']],['assist',['ArrowLeft','ArrowDown','ArrowRight']],['counter',['ArrowDown','ArrowLeft']]]){
  await prep();const before=await state();for(const key of keys)await tap(key);await tap('KeyF');const after=await state();
  assert.equal(after.id,id);assert.equal(after.total,before.total+1);keyboard.push(id);checks.push(`keyboard ${id}`);
 }
 // 冻结 RAF 更新并替换输入源，避免截图耗时影响帧间隔；固定输入仍走方向识别和 World.tick。
 await page.evaluate(()=>{
  const g=window.__game,w=g.world;window.p206={update:g.update.bind(g),render:g.render.bind(g),input:w.input,events:[],damage:[]};
  g.update=()=>{};g.render=()=>{};
  const oldSfx=w.audio.sfx.bind(w.audio);w.audio.sfx=(id,opt)=>{window.p206.events.push(id);oldSfx(id,opt);};
  const oldDamage=w.damage.bind(w);w.damage=(e,n,x,y,quiet,source)=>{const hp=e.hp;oldDamage(e,n,x,y,quiet,source);window.p206.damage.push({target:e.id,source,dealt:hp-e.hp});};
  w.input={axisX:0,axisY:0,resetSerial:0,edges:new Set(),held:new Set(),pressed(a){return this.edges.has(a);},down(a){return this.held.has(a);}};
  window.p206.advance=(n=1)=>{for(let i=0;i<n;i++){w.tick(1/60);w.input.edges.clear();}};
 });
 const trigger=id=>page.evaluate(async id=>{
  const w=window.__game.world,{ACTIVE_MOVES}=await import('/src/game/moves.ts');
  const axes={2:[0,1],8:[0,-1],4:[-1,0],6:[1,0],3:[.7,.7]};
  // 只推进识别时钟，指令输入不改变作用场景。入口的移动已由真实键盘单独验证。
  for(const d of ACTIVE_MOVES.find(m=>m.id===id).sequence){[w.input.axisX,w.input.axisY]=axes[d];w.moves.update(.07,0);w.input.axisX=w.input.axisY=0;w.moves.update(.055,0);}
  w.input.edges.add('move');w.moves.update(.016,0);w.input.edges.clear();
 },id);
 const advance=n=>page.evaluate(n=>window.p206.advance(n),n);
 const result=()=>page.evaluate(()=>{
  const w=window.__game.world,p=w.player,m=w.moves;
  return {id:m.lastId,total:m.total,ink:p.ink,x:p.x,y:p.y,alive:p.alive,weapon:p.weapon,damage:m.lastDamage,hits:m.lastHits,cleared:m.lastCleared,distance:m.lastDistance,stop:m.hitstopRemaining,counter:m.counterRemaining,time:w.time,real:w.real,title:w.r.moveTitles.active,events:window.p206.events.filter(e=>e.startsWith('move:')),targets:w.enemies.map(e=>({id:e.id,hp:e.hp,sealed:e.sealed,speed:e.companionSpeed,marked:w.companions.isMarked(e),source:e.lastDamageSource})),ordinary:w.bullets.list.filter(b=>!b.dead&&!b.hard).length,hard:w.bullets.list.filter(b=>!b.dead&&b.hard).length,companionStats:{...w.companions.stats},companions:w.companions.team.map(s=>({kind:s.kind,cooldown:s.cooldown,active:s.active,count:s.count}))};
 });
 const fixture=async (id,ink=1,phaseLock=false)=>{
  await prep();await page.evaluate(({id,ink,phaseLock})=>{
   const w=window.__game.world,p=w.player;p.ink=ink;window.p206.events=[];window.p206.damage=[];w.input.edges.clear();w.input.held.clear();w.input.axisX=w.input.axisY=0;
   const a=w.spawn({sprite:'e_hornet',hp:500,score:0,noCollide:true},450,650);a.hp=a.maxHp=500;a.phaseLock=phaseLock;
   const b=w.spawn({sprite:'e_hornet',hp:500,score:0,noCollide:true},680,660);b.hp=b.maxHp=500;
   if(id==='guard')for(const x of [390,450,510])w.shoot(x,800,0,0);
   if(id==='cut')w.shoot(450,760,0,0);
   if(id==='assist')for(const x of [430,450])w.shoot(x,850,0,0);
   w.shoot(490,820,0,0,{hard:true});
  },{id,ink,phaseLock});await trigger(id);
 };
 const numeric={};
 await fixture('guard');numeric.guard=await result();assert.equal(numeric.guard.cleared,3);assert.equal(numeric.guard.damage,0);assert.equal(numeric.guard.hard,1);
 await fixture('cut');numeric.cut=await result();assert.equal(numeric.cut.cleared,1);assert.equal(numeric.cut.damage,55);assert.equal(numeric.cut.hits,1);assert.equal(numeric.cut.targets[1].hp,500);
 const stopped=await result();await page.evaluate(()=>{const w=window.__game.world;w.input.edges.add('weapon');});await advance(1);const held=await result();
 assert.equal(held.time,stopped.time);assert.equal(held.y,stopped.y);assert.ok(held.real>stopped.real);assert.equal(held.weapon,'blue');assert.equal(held.title,'cut');checks.push('hitstop freezes combat and movement, preserves weapon input and real clock');
 await fixture('dash');await advance(18);numeric.dash=await result();assert.ok(Math.abs(numeric.dash.distance-160)<1e-5);assert.equal(numeric.dash.y,740);assert.equal(numeric.dash.damage,0);assert.equal(numeric.dash.cleared,0);
 await fixture('dash');await page.evaluate(()=>{const w=window.__game.world;w.player.x=873;w.player.y=90;w.input.axisX=1;w.input.edges.add('weapon');});await advance(18);const bounded=await result();assert.equal(bounded.y,50);assert.equal(bounded.x,874);assert.equal(bounded.weapon,'blue');checks.push('dash 160 / movement and switch / screen bounds');
 await fixture('assist');await advance(35);numeric.assist=await result();
 assert.equal(numeric.assist.targets[0].hp,500);assert.equal(numeric.assist.targets[1].hp,500);
 assert.equal(numeric.assist.ordinary,0);assert.equal(numeric.assist.hard,1);
 assert.equal(numeric.assist.targets[0].marked,true);assert.equal(numeric.assist.targets[0].speed,.55);
 assert.equal(numeric.assist.companions.find(s=>s.kind==='laodun').count,2);
 assert.ok(numeric.assist.companions.filter(s=>s.kind!=='suanpan').every(s=>s.active>0&&s.cooldown<99));
 assert.equal(numeric.assist.companions.find(s=>s.kind==='suanpan').active,0);
 await advance(30);numeric.assist.strike=await result();
 assert.equal(numeric.assist.strike.targets[0].hp,478);
 assert.equal(numeric.assist.strike.targets[1].hp,500);
 numeric.assist.actions=await page.evaluate(()=>window.p206.damage.filter(x=>x.dealt>0));
 assert.equal(numeric.assist.actions.length,1);assert.equal(numeric.assist.actions[0].source,'companion');
 checks.push('joint actual chase after preview / marked target / shield blocks ordinary bullets / normal cooldowns');
 await fixture('assist',.4);const inkBeforeDelivery=await result();await advance(45);numeric.assist.support=await result();
 assert.ok(numeric.assist.support.companions.find(s=>s.kind==='suanpan').active>0);
 assert.ok(numeric.assist.support.ink>=inkBeforeDelivery.ink+.08);
 assert.ok(Math.abs(numeric.assist.support.companionStats.ink-.08)<1e-6);
 checks.push('joint low-ink support delivers ink / sufficient ink skips support');
 await fixture('counter');await advance(5);await page.evaluate(()=>{const w=window.__game.world;w.shoot(450,835,0,0);w.shoot(450,833,0,0);});await advance(1);numeric.counter=await result();assert.equal(numeric.counter.cleared,1);assert.equal(numeric.counter.damage,45);assert.equal(numeric.counter.ordinary,1);assert.equal(numeric.counter.hard,1);assert.equal(numeric.counter.counter,0);checks.push('counter first ordinary bullet only / 45 ink damage');
 await fixture('counter');await advance(31);const expired=await result();assert.equal(expired.counter,0);assert.equal(expired.damage,0);assert.ok(Math.abs(expired.ink-(.9+28/60*.012))<.001);checks.push('counter expires / preparation cost only');
 for(const hazard of ['hard','laser']){
  await fixture('counter');await advance(5);await page.evaluate(hazard=>{const w=window.__game.world,p=w.player;if(hazard==='hard')w.shoot(p.x,p.y,0,0,{hard:true});else w.laser(p.x,p.y-120,Math.PI/2,{warn:0,duration:1,width:20,length:220});},hazard);await advance(12);assert.equal((await result()).alive,false);checks.push(`counter does not protect from ${hazard}`);
 }
 await fixture('cut');await page.evaluate(()=>window.__game.world.enemies[0].def.armor=.5);await trigger('counter');await advance(8);await page.evaluate(()=>{const w=window.__game.world;w.shoot(w.player.x,w.player.y-60,0,0);});await advance(1);assert.equal((await result()).damage,22.5);checks.push('counter respects armor');
 await fixture('counter');await page.evaluate(()=>{const w=window.__game.world;w.lastWeaponTarget=w.enemies[1];w.shoot(w.player.x,w.player.y-60,0,0);});await advance(5);const nearest=await result();assert.equal(nearest.targets[0].hp,455);assert.equal(nearest.targets[1].hp,500);checks.push('counter returns to nearest target');
 await fixture('assist',1,true);await advance(35);const locked=await result();assert.equal(locked.targets[0].sealed,0);assert.equal(locked.targets[0].speed,1);assert.equal(locked.targets[0].marked,true);checks.push('joint control marks Boss without slowing phase lock');
 await prep();await page.evaluate(()=>{const w=window.__game.world;const e=w.spawn({sprite:'e_hornet',hp:500,armor:.5,score:0,noCollide:true},450,650);e.hp=e.maxHp=500;});await trigger('cut');assert.equal((await result()).damage,27.5);checks.push('cut respects armor');
 await fixture('dash');await advance(4);await page.evaluate(()=>{const w=window.__game.world;w.shoot(w.player.x,w.player.y,0,0,{hard:true,size:100});});await advance(1);assert.equal((await result()).alive,true);assert.ok((await result()).hard>0);await page.evaluate(()=>{const w=window.__game.world;w.moves.resetStage();w.player.invuln=0;});await advance(1);assert.equal((await result()).alive,false);checks.push('dash brief contact protection / same overlapping hard bullet kills after protection');
 // 空伙伴不扣墨、不触发事件；随后恢复队伍，覆盖实际队伍子集路径。
 await prep();await page.evaluate(()=>{const w=window.__game.world;window.p206.team=w.companions.team.splice(0);window.p206.events=[];});const emptyBefore=await result();await trigger('assist');const empty=await result();assert.equal(empty.ink,emptyBefore.ink);assert.equal(empty.total,emptyBefore.total);assert.deepEqual(empty.events,[]);await page.evaluate(()=>window.__game.world.companions.team.push(...window.p206.team));checks.push('empty team rejects joint without ink or event');
 for(const [id,cost]of [['guard',.18],['cut',.12],['dash',.15],['assist',.25],['counter',.1]]){
  await fixture(id);const once=await result();assert.ok(Math.abs(once.ink-(1-cost))<1e-6);assert.deepEqual(once.events,[`move:${id}`]);await trigger(id);assert.equal((await result()).total,once.total);assert.deepEqual((await result()).events,[`move:${id}`]);
 }checks.push('five costs / cooldown rejection / one move audio event per accepted move');
 // 连续 60Hz 帧 + 合击收尾帧；每张都来自游戏世界正常渲染。
 const strips=[];const names={guard:'回墨护身',cut:'一笔破阵',dash:'飞身追击',assist:'伙伴合击',counter:'回身反击'};
 mkdirSync(`${out}/frames`,{recursive:true});
 for(const id of Object.keys(names)){
  await fixture(id);const frames=[];
  for(let frame=0;frame<=64;frame++){
   if(id==='counter'&&frame===10)await page.evaluate(()=>{const w=window.__game.world;w.shoot(w.player.x,w.player.y-65,0,0);});
   if(frame>0)await advance(1);
   if(frame<=23||[35,47,63].includes(frame)){
    await page.evaluate(()=>window.p206.render());const file=`frames/${id}-${String(frame).padStart(2,'0')}.png`;
    await page.screenshot({path:`${out}/${file}`});frames.push({frame,file,...await result()});
   }
  }
  strips.push({id,name:names[id],frames});
 }
 await fixture('counter');await page.evaluate(()=>window.__game.world.moves.resetStage());assert.equal((await result()).counter,0);assert.equal((await result()).title,null);assert.equal((await result()).stop,0);checks.push('stage reset clears stance, hitstop and title');
 const html=`<!doctype html><meta charset="utf-8"><title>P2-06 连续帧</title><style>body{background:#171a1c;color:#eee;font:16px sans-serif;margin:20px}section{margin-bottom:40px}.strip{display:grid;grid-template-columns:repeat(6,180px);gap:6px}.crop{width:180px;height:240px;overflow:hidden}.crop img{width:426.667px;height:240px;transform:translateX(-123.333px)}small{display:block}a{color:#d6bb7f}</style><p>固定 60Hz：帧 0–23 连续，另附 35/47/63 收尾。点击查看完整游戏截图。</p>${strips.map(s=>`<section id="${s.id}"><h2>${s.name}</h2><div class="strip">${s.frames.map(f=>`<div><small>帧 ${f.frame} · 停顿 ${f.stop.toFixed(3)}s</small><a href="${f.file}"><div class="crop"><img src="${f.file}"></div></a></div>`).join('')}</div></section>`).join('')}`;
 writeFileSync(`${out}/frames.html`,html);
 const proof=await page.browser().newPage();await proof.setViewport({width:1140,height:1600,deviceScaleFactor:1});await proof.goto(`file://${resolve(out,'frames.html')}`);await proof.waitForFunction(()=>[...document.images].every(i=>i.complete));
 for(const s of strips)await(await proof.$(`#${s.id}`)).screenshot({path:`${out}/${s.id}-strip.png`});await proof.close();
 const performance=await page.evaluate(async()=>{
  const g=window.__game,r=g.r,cpu=[],interval=[],gpu=[];let previous=0;
  if(r.gl.getExtension('EXT_disjoint_timer_query_webgl2'))r.startTimer('frame');
  for(let i=0;i<90;i++){const t=await new Promise(requestAnimationFrame);window.p206.advance(1);const start=window.performance.now();window.p206.render();const end=window.performance.now();if(i>=30){cpu.push(end-start);if(previous)interval.push(t-previous);if(r.timer?.ms.frame)gpu.push(r.timer.ms.frame);}previous=t;}
  const stats=a=>{a.sort((x,y)=>x-y);return a.length?{samples:a.length,mean:a.reduce((x,y)=>x+y,0)/a.length,p95:a[Math.floor(a.length*.95)]}:null;};
  return {gpuName:r.gpuName(),viewport:r.playPx,quality:r.quality,cpuSubmissionMs:stats(cpu),frameIntervalMs:stats(interval),gpuSmoothedMs:stats(gpu),glError:r.gl.getError(),scope:'ordinary two-target scene, 60 frames after warm-up; no stress or performance gate'};
 });assert.equal(performance.glError,0);
 writeFileSync(`${out}/expanded.json`,JSON.stringify({keyboard,numeric,bounded,expired,strips,performance,notes:'four integrated companions; chase after preview, shield, control mark and conditional low-ink support'},null,2));
 return {keyboard,numeric,consecutiveFrames:24,totalScreenshots:135,frameRate:60,performance};
}
