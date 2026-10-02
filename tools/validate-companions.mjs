// P2-02：实际 World 结算、获取界面与自然关卡 60 秒；固定样本验证不替代有损试玩。
// node tools/validate-companions.mjs [URL] [证据目录]
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5176/';
const out=process.argv[3]??'.shots/p2-02';mkdirSync(out,{recursive:true});
const errors=[],checks=[],shots=[];
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:120000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const page=await browser.newPage();await page.setViewport({width:1600,height:900});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('about:blank');await sleep(2000);
 await page.goto(`${base}?stage=1&god=1&diff=normal`,{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>window.__game?.state==='playing',{timeout:60000});
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await sleep(100);
 await page.evaluate(()=>{
  const g=window.__game,w=g.world;
  window.__reset=()=>{w.resetStage();w.progression.resetRun();w.player.reset(true);w.companions.resetRun();w.scrollV=0;w.player.entering=0;w.player.x=450;w.player.y=850;w.player.ink=.8;w.player.invuln=999;w.debugAuto=false;g.state='playing';g.ui.screen('none');g.input.down=()=>false;g.input.pressed=()=>false;g.input.axisX=g.input.axisY=0;for(const s of w.companions.team)s.cooldown=99;g.render();};
  window.__step=n=>{for(let i=0;i<n;i++){w.tick(1/60);g.render();}};
  window.__enemy=(x=450,y=620)=>w.spawn({sprite:'e_hornet',hp:1000,noCollide:true},x,y);
 });
 async function shot(name){await page.evaluate(()=>window.__game.render());await sleep(230);await page.screenshot({path:`${out}/${name}.png`});shots.push(name);}
 // 赤燕：45帧前起势，命中一次，归位。
 await page.evaluate(()=>{window.__reset();const w=window.__game.world;window.__target=window.__enemy();});await shot('chiyan-before');
 await page.evaluate(()=>window.__game.world.companions.burst('chiyan'));await shot('chiyan-preview');
 await page.evaluate(()=>window.__step(40));await shot('chiyan-active');
 const attack=await page.evaluate(()=>{window.__step(80);const w=window.__game.world;return{hp:window.__target.hp,damage:window.__target.maxHp-window.__target.hp,stats:w.companions.stats,active:w.companions.team[0].active};});
 assert.equal(attack.damage,18);assert.equal(attack.active,0);checks.push({kind:'chiyan',...attack});await shot('chiyan-after');
 // 老盾：盾面内普通弹吸收；硬弹与侧外弹保留；容量最多六发。
 await page.evaluate(()=>{window.__reset();const w=window.__game.world;for(let i=0;i<8;i++)w.bullets.spawn(410+i*12,725+i*3,Math.PI/2,200);window.__hard=w.bullets.spawn(450,730,Math.PI/2,180,{hard:true});window.__outside=w.bullets.spawn(650,730,Math.PI/2,180);});await shot('laodun-before');
 await page.evaluate(()=>{window.__game.world.companions.burst('laodun');window.__step(15);});await shot('laodun-active');
 const shield=await page.evaluate(()=>{window.__step(40);const w=window.__game.world;return{blocked:w.companions.stats.blocked,count:w.companions.team[1].count,hard:window.__hard.dead,outside:window.__outside.dead};});
 assert.equal(shield.blocked,6);assert.equal(shield.hard,false);assert.equal(shield.outside,false);checks.push({kind:'laodun',...shield});await shot('laodun-after');
 // 墨鸢：50px/s样本，以55%移动，主射18%增伤；到期和死亡恢复。
 await page.evaluate(()=>{window.__reset();window.__target=window.__enemy(450,620);window.__target.vx=50;});await shot('moyuan-before');
 await page.evaluate(()=>window.__game.world.companions.burst('moyuan'));
 const debuff=await page.evaluate(()=>{window.__step(60);const w=window.__game.world,e=window.__target;const hp=e.hp;w.damage(e,10,e.x,e.y,true,'red');return{x:e.x,delta:hp-e.hp,speed:e.companionSpeed};});
 assert.ok(Math.abs(debuff.x-477.5)<.01);assert.ok(Math.abs(debuff.delta-11.8)<.001);await shot('moyuan-active');
 const restore=await page.evaluate(()=>{window.__step(130);return{speed:window.__target.companionSpeed,marked:window.__game.world.companions.isMarked(window.__target)};});assert.equal(restore.speed,1);assert.equal(restore.marked,false);checks.push({kind:'moyuan',...debuff,...restore});await shot('moyuan-after');
 // 算盘：600ms算珠飞行只结算一次；资源已高时不会减少墨。
 await page.evaluate(()=>{window.__reset();window.__game.world.player.ink=.3;});await shot('suanpan-before');
 await page.evaluate(()=>{window.__game.world.companions.burst('suanpan');window.__step(18);});await shot('suanpan-active');
 const support=await page.evaluate(()=>{window.__step(30);const w=window.__game.world;const once=w.companions.stats.ink;window.__step(160);return{once,after:w.companions.stats.ink,active:w.companions.team[3].active};});assert.ok(Math.abs(support.once-.08)<.00001);assert.equal(support.once,support.after);checks.push({kind:'suanpan',...support});await shot('suanpan-after');
 const rising=await page.evaluate(()=>{window.__reset();const w=window.__game.world;w.player.ink=.3;w.companions.burst('suanpan');w.player.ink=.8;window.__step(50);return w.player.ink;});assert.ok(rising>=.8);
 const lifecycle=await page.evaluate(()=>{window.__reset();const w=window.__game.world;const e=window.__enemy();w.companions.burst('moyuan');const bound=e.companionSpeed;w.player.alive=false;w.companions.update(1/60);return{bound,after:e.companionSpeed,active:w.companions.team.map(s=>s.active)};});assert.equal(lifecycle.bound,.55);assert.equal(lifecycle.after,1);assert.ok(lifecycle.active.every(t=>t===0));checks.push({kind:'death-clears-effects',...lifecycle});
 // 用正式milestone打开三选一，再用真实鼠标选卡；重复里程碑与XP不能额外发点。
 await page.evaluate(()=>{window.__reset();const g=window.__game,w=g.world;w.root.run(w.growthChoice(1));w.tick(1/60);g.render();});
 assert.equal(await page.$eval('.choice-grid',e=>e.children.length),3);assert.equal(await page.$$eval('.passive-preview',e=>e.length),3);await shot('three-choice');
 await sleep(400);await page.click('.choice-card');
 const acquired=await page.evaluate(()=>{const g=window.__game,w=g.world;const selected=[...w.progression.talents.keys()];w.progression.grant('combat',9999);const duplicate=w.progression.claimChoice(1,1);g.input.down=a=>a==='shoot';window.__step(3);g.render();return{selected,pending:w.progression.pendingChoices,duplicate,state:g.state,passives:w.progression.passiveHud()};});assert.equal(acquired.state,'playing');assert.equal(acquired.pending,0);assert.equal(acquired.duplicate,false);assert.equal(acquired.passives.length,1);checks.push({kind:'acquire',...acquired});await shot('passive-trigger');
 // 九个入口行为走正式更新与伤害管线，检查形态、互斥、资源隔离。
 const behaviors=await page.evaluate(()=>{
  const g=window.__game,w=g.world,results=[];
  const setup=id=>{window.__reset();w.progression.talents.set(id,1);};
  window.__reset();g.input.down=a=>a==='shoot';window.__step(1);const baseShots=w.player.shots.filter(s=>s.kind===0);const baseline={count:baseShots.length,damage:baseShots.reduce((n,s)=>n+s.dmg,0)};
  setup('R1');g.input.down=a=>a==='shoot';window.__step(1);
  const red=w.player.shots.filter(s=>s.kind===0);results.push({id:'R1',baseline,count:red.length,damage:red.reduce((n,s)=>n+s.dmg,0),left:red.filter(s=>s.vx<0).length,right:red.filter(s=>s.vx>0).length});
  setup('B1');w.player.weapon='blue';g.input.down=a=>a==='shoot'||a==='focus';g.input.axisX=1;window.__step(1);const tilt=w.player.beamTilt;g.input.axisX=0;window.__step(2);const hold=w.player.beamTilt;g.input.down=a=>a==='shoot';window.__step(1);results.push({id:'B1',tilt,hold,released:w.player.beamTilt});
  setup('T1');w.player.weapon='purple';const near=window.__enemy(450,730),marked=window.__enemy(500,610);w.companions.marked.set(marked,3);g.input.down=a=>a==='shoot';window.__step(1);results.push({id:'T1',first:w.player.thunderTargets[0]?.id,marked:marked.id,near:near.id});
  setup('W1');const echo=window.__enemy(450,620);const hp=echo.hp;w.progression.onBrushRelease([300,600,450,620,600,600],1,0,0);window.__step(70);results.push({id:'W1',damage:hp-echo.hp,trigger:w.progression.passiveHud()[0].triggers});
  setup('W2');const circle=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI*2;circle.push(450+Math.cos(a)*75,620+Math.sin(a)*75);}const bound=window.__enemy(250,620);w.progression.onBrushRelease(circle,0,0,0);window.__step(1);bound.x=450;window.__step(1);const sealed=bound.sealed;bound.sealed=0;bound.x=250;window.__step(1);bound.x=450;window.__step(1);results.push({id:'W2',sealed,repeat:bound.sealed});
  for(const id of ['I1','I2']){setup(id);w.progression.onBomb();const before=w.progression.fields[0].x;w.player.x+=80;window.__step(1);results.push({id,move:w.progression.fields[0].x-before,radius:w.progression.fields[0].r});}
  for(const id of ['Q1','Q2']){setup(id);window.__step(120);results.push({id,offsets:w.companions.team.map(c=>[Math.round(c.x-w.player.x),Math.round(c.y-w.player.y)])});}
  setup('W1');w.progression.claimChoice(1,1);const offers=w.progression.offerTalents().map(t=>t.id);results.push({id:'eligibility',offers,excluded:!offers.includes('W2'),numericRequires:!offers.includes('B4')});
  return results;
 });
 assert.equal(behaviors[0].count,behaviors[0].baseline.count*2);assert.equal(behaviors[0].damage,behaviors[0].baseline.damage);assert.equal(behaviors[0].left,behaviors[0].count/2);assert.equal(behaviors[0].right,behaviors[0].count/2);
 assert.equal(behaviors[1].tilt,.16);assert.equal(behaviors[1].hold,.16);assert.equal(behaviors[1].released,0);
 assert.equal(behaviors[2].first,behaviors[2].marked);assert.equal(behaviors[3].damage,24);assert.ok(behaviors[4].sealed>0);assert.equal(behaviors[4].repeat,0);
 assert.equal(behaviors[5].move,80);assert.equal(behaviors[6].move,0);assert.deepEqual(behaviors[7].offsets,[[0,-130],[-90,10],[90,-110],[0,90]]);assert.deepEqual(behaviors[8].offsets,[[0,-80],[-110,-35],[0,-145],[110,-35]]);assert.ok(behaviors[9].excluded&&behaviors[9].numericRequires);checks.push({kind:'entry-behaviors',results:behaviors});
 // 实际关卡脚本、普通难度、60秒：新页面隔离固定样本的通讯与演出，只设无敌保证证据连续。
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__game?.state==='playing');
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await sleep(100);
 await page.evaluate(()=>{const g=window.__game;g.toTitle();g.onStart();g.debug.bot=false;g.input.down=a=>a==='shoot';g.input.pressed=()=>false;g.input.axisX=g.input.axisY=0;});
 const natural=[];
 for(const target of [0,5,10,20,30,40,50,60]){
  const state=await page.evaluate(target=>{const g=window.__game,w=g.world;let frames=0;while(w.t<target&&g.state==='playing'&&frames++<6000){w.player.invuln=999;g.update(1/60);g.render();}return{t:w.t,state:g.state,difficulty:w.diffId,team:w.companions.team.map(s=>({kind:s.kind,effective:s.effective})),stats:{...w.companions.stats},talents:[...w.progression.talents.keys()]};},target);
  natural.push(state);await shot(`normal-${String(target).padStart(2,'0')}`);
 }
 assert.ok(natural.at(-1).t>=60);assert.equal(natural.at(-1).difficulty,'normal');checks.push({kind:'normal-60s',samples:natural});
 const firstChoice=await page.evaluate(()=>{const g=window.__game,w=g.world;while(w.t<90&&g.state==='playing'){w.player.invuln=999;g.update(1/60);g.render();}return{t:w.t,state:g.state,pending:w.progression.pendingChoices};});
 assert.equal(firstChoice.state,'growth');assert.ok(firstChoice.t>=60&&firstChoice.t<=90);checks.push({kind:'natural-first-choice',...firstChoice});await shot('natural-first-choice');
 await page.setViewport({width:900,height:1200});await sleep(200);await shot('three-choice-portrait');

 assert.deepEqual(errors,[]);
 writeFileSync(`${out}/validation.json`,JSON.stringify({checks,shots,errors,naturalGodMode:true},null,2));
 console.log(JSON.stringify({checks:checks.length,shots:shots.length,errors}));
}finally{await browser.close();}
