// P4-11：真实数字键、World.tick、固定时间的技能数值/解锁与 HUD 验收。
// node tools/validate-skills.mjs [dev URL] [证据目录]。五帧截图的战斗时间间隔为 1/30 秒。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5176/',out=process.argv[3]??'.shots/p4-11';mkdirSync(out,{recursive:true});
const report={checks:[],measurements:{},errors:[],frames:[]};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.evaluateOnNewDocument(()=>{window.requestAnimationFrame=()=>0;});
 await page.setViewport({width:1600,height:900});await page.goto(base,{waitUntil:'load'});await page.waitForFunction('window.__game',{timeout:60000,polling:100});
 const prep=()=>page.evaluate(()=>{const g=window.__game,w=g.world;g.debug.god=g.debug.bot=g.debug.autofire=false;g.testRun=null;w.newGame();w.resetStage();w.companions.setRoster([]);w.skills.setUnlocked(['chaifa','tishen','zhongpao','shenying','bilei']);preset();function preset(){w.player.x=320;w.player.y=900;w.player.invuln=0;w.player.entering=0;w.player.ink=1;g.state='playing';g.ui.screen('none');g.r.setBackground('stage1');g.ui.hud(w.hud(60),true);document.querySelector('.opening-controls').hidden=true;document.querySelectorAll('.presentation-dock .cardl,.presentation-dock .warnl,.presentation-dock .capl').forEach(e=>e.replaceChildren());}window.sample=(x=320,y=650,hp=10000)=>{const e=w.spawn({sprite:'e_swallow',hp,radius:10,noCollide:true,score:0},x,y,e=>{e.data.contentRole='prop';});e.hp=e.maxHp=hp;e.info={...e.info,maskR:0};return e;};});
 const step=n=>page.evaluate(n=>{const g=window.__game;for(let i=0;i<n;i++){g.input.poll();g.update(1/60);}},n);
 const tap=async key=>{await page.keyboard.down(key);await step(1);await page.keyboard.up(key);await step(1);};
 const snapshot=()=>page.evaluate(()=>{const w=window.__game.world,s=w.skills;return{uses:{...s.stats.uses},cooldowns:{...s.cooldowns},boost:s.boostLeft,mirror:s.mirrorLeft,shield:s.shieldLeft,charge:s.charge,level:s.cannonLevel,decoys:s.decoys.map(d=>({...d})),alive:w.player.alive};});
 const mouse=async down=>{const r=await page.evaluate(()=>window.__game.r.playCss);await page.mouse.move(r.x+r.w*.4,r.y+r.h*.7);if(down)await page.mouse.down({button:'left'});else await page.mouse.up({button:'left'});};
 const shot=async name=>{await page.evaluate(()=>{const g=window.__game;g.ui.hud(g.world.hud(60),true);g.render();});await new Promise(r=>setTimeout(r,80));await page.screenshot({path:`${out}/${name}.png`});};
 await prep();await page.evaluate(()=>window.__game.world.skills.setUnlocked([]));await tap('1');assert.equal((await snapshot()).uses.chaifa,0);
 await page.evaluate(()=>{const w=window.__game.world;w.newGame();});assert.deepEqual(await page.evaluate(()=>[...window.__game.world.skills.unlocked]),['chaifa']);report.checks.push('开局只解锁拆阀；未解锁按键不生效');
 // Numeric-key edges, cooldown expiry, actual duration, holding does not auto-recast.
 for(const [id,key,cooldown,duration,field] of [['chaifa','1',20,5,'boost'],['tishen','2',16,4,'decoys'],['shenying','4',22,6,'mirror'],['bilei','5',10,.6,'shield']]){
  await prep();await page.keyboard.down(key);await step(1);let s=await snapshot();assert.equal(s.uses[id],1);assert.equal(s.cooldowns[id],cooldown);if(field==='decoys')assert.equal(s.decoys.length,3);else assert.equal(s[field],duration);
  await step(Math.round(duration*60)-1);s=await snapshot();if(field==='decoys')assert.equal(s.decoys.length,1*3);else assert.ok(s[field]>0);
  await step(1);s=await snapshot();if(field==='decoys')assert.equal(s.decoys.length,0);else assert.equal(s[field],0);
  await step(Math.round((cooldown-duration)*60)+1);assert.equal((await snapshot()).cooldowns[id],0);assert.equal((await snapshot()).uses[id],1);
  await page.keyboard.up(key);await step(1);await tap(key);assert.equal((await snapshot()).uses[id],2);
  report.checks.push(`${id}: ${cooldown}s冷却/${duration}s持续/按一次/按住不重复触发`);
 }
 // Roll, brush slowmo and hitstop never change the real-second cooldown clock.
 await prep();await tap('1');const before=await snapshot();await page.evaluate(()=>window.__game.world.hitstop(.2));await step(12);assert.ok(Math.abs((await snapshot()).cooldowns.chaifa-before.cooldowns.chaifa+.2)<1e-8);
 await page.evaluate(()=>window.__game.state='paused');await step(60);const paused=await snapshot();assert.ok(Math.abs(paused.cooldowns.chaifa-(before.cooldowns.chaifa-.2))<1e-8);await page.evaluate(()=>window.__game.state='playing');report.checks.push('冷却在顿帧推进、菜单暂停冻结');
 // Speed, red shot count/spread/cadence/one additional penetration, blue width and DPS, purple +2 targets.
 for(const hot of [false,true]){
  await prep();if(hot)await tap('1');await page.keyboard.down('d');const x=await page.evaluate(()=>window.__game.world.player.x);await step(10);await page.keyboard.up('d');await step(1);const moved=await page.evaluate(()=>window.__game.world.player.x)-x;assert.ok(Math.abs(moved-(hot?77:70))<1e-7);
  await prep();if(hot)await tap('1');await mouse(true);await step(1);const red=await page.evaluate(()=>{const p=window.__game.world.player;return{count:p.shots.length,cooldown:p.fireCd,spread:Math.max(...p.shots.map(s=>Math.atan2(s.vy,s.vx)))-Math.min(...p.shots.map(s=>Math.atan2(s.vy,s.vx)))};});assert.equal(red.count,hot?5:3);assert.ok(Math.abs(red.cooldown-.105/(hot?1.6:1))<1e-8);assert.ok(Math.abs(red.spread-10*Math.PI/180*(hot?1.6:1))<1e-8);await mouse(false);await step(1);
  report.measurements[hot?'boostedRed':'baseRed']={moved,...red};
 }
 await prep();await tap('1');await page.evaluate(()=>{window.targets=[sample(320,760),sample(320,670),sample(320,580)];const p=window.__game.world.player;p.shots=[{x:320,y:820,vx:0,vy:-1500,dmg:1.25,kind:0,age:0,dead:false,target:null,pierce:1,hits:new Set()}];});await step(12);assert.deepEqual(await page.evaluate(()=>window.targets.map(e=>10000-e.hp)),[1.25,1.25,0]);
 for(const hot of [false,true]){await prep();await page.evaluate(()=>{const w=window.__game.world;w.player.weapon='blue';window.blueCenter=sample(320,600);window.blueSide=sample(344,500);});if(hot)await tap('1');await mouse(true);await step(30);await mouse(false);const blue=await page.evaluate(()=>({center:10000-window.blueCenter.hp,side:10000-window.blueSide.hp}));report.measurements[hot?'boostedBlue':'baseBlue']=blue;}
 assert.ok(Math.abs(report.measurements.boostedBlue.center/report.measurements.baseBlue.center-1.6)<1e-7);assert.equal(report.measurements.baseBlue.side,0);assert.ok(report.measurements.boostedBlue.side>0);
 for(const hot of [false,true]){await prep();await page.evaluate(()=>{const w=window.__game.world;w.player.weapon='purple';for(const x of [250,320,390])sample(x,650);});if(hot)await tap('1');await mouse(true);await step(1);assert.equal(await page.evaluate(()=>window.__game.world.player.thunderTargets.length),hot?3:1);await mouse(false);await step(1);}
 report.checks.push('拆阀：移速+10%、朱射速+60%/弹数+2/扇面变宽/穿透一层、青宽度×2/伤害频率×1.6、雷多2目标');
 // Decoy targeting, tracking and 8-hit destruction; hard bullets are not absorbed.
 await prep();await tap('2');assert.equal(await page.evaluate(()=>{const w=window.__game.world,d=w.skills.decoys;return w.aimTarget(600,200)===d.reduce((a,b)=>Math.hypot(a.x-600,a.y-200)<Math.hypot(b.x-600,b.y-200)?a:b);}),true);
 await page.evaluate(()=>{const w=window.__game.world,d=w.skills.decoys[0];window.decoy=d;for(let i=0;i<8;i++)w.bullets.spawn(d.x,d.y,Math.PI/2,0);window.hard=w.bullets.spawn(d.x,d.y,0,0,{hard:true});});await step(1);assert.equal(await page.evaluate(()=>window.decoy.hits),8);assert.equal(await page.evaluate(()=>window.hard.dead),false);await step(1);assert.equal((await snapshot()).decoys.length,2);
 await page.evaluate(()=>{const w=window.__game.world;window.tracking=w.bullets.spawn(700,300,0,80,{tracking:true});window.aimed=w.aimTarget(700,300,true);});await step(1);assert.ok(await page.evaluate(()=>Math.abs(window.tracking.angle-Math.atan2(window.aimed.y-300,window.aimed.x-700))<.01));report.checks.push('替身：最近目标、追踪弹改追、8弹烧毁、4秒结束；特殊弹保留');
 await prep();await page.evaluate(async()=>{const w=window.__game.world;const {InkOtter}=await import('/src/stages/stage1_extra.ts');window.rusher=w.spawn(InkOtter,100,200);});await step(143);await tap('2');const rushTarget=await page.evaluate(()=>{const w=window.__game.world;const target=w.aimTarget(window.rusher.x,window.rusher.y,true);return{x:target.x,y:target.y};});await step(100);const rushed=await page.evaluate(()=>({x:window.rusher.x,y:window.rusher.y}));assert.ok(Math.abs(rushed.x-rushTarget.x)<2&&Math.abs(rushed.y-rushTarget.y)<90);report.measurements.rusher={target:rushTarget,reached:rushed};report.checks.push('真实墨獭冲撞脚本锁定纸朱雀完整坐标');
 await prep();await tap('5');await page.evaluate(()=>{const w=window.__game.world;w.bullets.spawn(w.player.x,w.player.y-130,Math.PI/2,10000);});await step(1);assert.equal(await page.evaluate(()=>window.__game.world.skills.stats.reflected),1);assert.equal((await snapshot()).alive,true);assert.ok(await page.evaluate(()=>{const w=window.__game.world,s=w.skills.returns[0];return s.y<w.player.y&&Math.hypot(s.x-w.player.x,s.y-w.player.y)<=w.skills.shieldRadius+6;}));report.checks.push('高速敌弹扫掠被盾截获，反弹从盾面起飞，玩家存活');
 // Cannon only primary hits charge; thresholds and each level damage/explosion/interruption.
 await prep();await tap('3');assert.equal((await snapshot()).uses.zhongpao,0);
 for(const [charge,level] of [[39,0],[40,1],[99,1],[100,2],[179,2],[180,3],[200,3]]){await page.evaluate(charge=>{const s=window.__game.world.skills;s.charge=0;for(let i=0;i<charge;i++)s.primaryHit();},charge);assert.equal((await snapshot()).level,level);}
 await prep();await page.evaluate(()=>{const w=window.__game.world;window.target=sample(320,600);w.damage(window.target,10,320,600,true,'purple');});assert.equal((await snapshot()).charge,0);await mouse(true);await step(30);await mouse(false);assert.ok((await snapshot()).charge>0);report.checks.push('炮能只计主武器真实命中；40/100/180三级，上限180，低于40不发射');
 for(const [charge,level,damage] of [[40,1,150],[100,2,300],[180,3,500]]){
  await prep();await page.evaluate(charge=>{const w=window.__game.world;w.skills.charge=charge;window.cannonTargets=[sample(320,650),sample(380,650),sample(440,650),sample(320,400)];window.cannonTargets[0].charging=true;},charge);
  const y=await page.evaluate(()=>window.__game.world.player.y);await tap('3');assert.equal((await snapshot()).charge,0);assert.equal((await snapshot()).cooldowns.zhongpao,0);assert.equal(await page.evaluate(()=>window.__game.world.player.y),y+20);
  await step(35);const result=await page.evaluate(()=>({damage:window.cannonTargets.map(e=>10000-e.hp),armor:window.cannonTargets[0].armorLoose,charging:window.cannonTargets[0].charging,interrupt:window.cannonTargets[0].interruptSerial}));assert.equal(result.damage[0],damage);
  if(level===1){assert.equal(result.damage[1],0);assert.equal(result.damage[3],150);}else{assert.equal(result.damage[1],damage);assert.equal(result.damage[2],level===3?500:0);assert.equal(result.damage[3],0);}
  if(level===3){assert.ok(result.armor>3.4&&result.armor<=4);assert.equal(result.charging,false);assert.equal(result.interrupt,1);}report.measurements[`cannon${level}`]=result;
 }
 report.checks.push('重炮：150穿透/300半径90爆炸/500半径140爆炸，三级松甲4秒并打断蓄力，后坐力20px');
 // Mirror uses the same firing pipeline at .6 damage and tracks current weapon and position.
 await prep();await page.evaluate(()=>{const w=window.__game.world;w.player.weapon='blue';window.main=sample(320,600);window.mirror=sample(580,600);});await tap('4');await mouse(true);await step(30);await mouse(false);const mirror=await page.evaluate(()=>{const w=window.__game.world;return{main:10000-window.main.hp,echo:10000-window.mirror.hp,targets:Array.from({length:10},()=>w.aimTarget(450,100).x),x:w.skills.echo.x,y:w.skills.echo.y};});assert.ok(Math.abs(mirror.echo/mirror.main-.6)<1e-8);assert.equal(mirror.targets.filter(x=>x===580).length,5);
 await page.keyboard.down('d');await step(5);await page.keyboard.up('d');await step(1);assert.ok(await page.evaluate(()=>Math.abs(window.__game.world.skills.echo.x+window.__game.world.player.x-900)<1e-8));await page.evaluate(()=>{const w=window.__game.world;w.player.weapon='purple';w.bullets.spawn(900-w.player.x,w.player.y,0,0);});await step(1);assert.equal(await page.evaluate(()=>window.__game.world.skills.echo.weapon),'purple');assert.ok(await page.evaluate(()=>window.__game.world.skills.mirrorFlash)>0);assert.equal((await snapshot()).alive,true);report.measurements.mirror=mirror;report.checks.push('蜃影：镜像移动、同步青武器60%伤害、换色同步、50%瞄准分流、受击闪烁且不死');
 // Reflection sweeps high-speed bullets; ordinary return = 3x speed/30 damage, perfect chain uses distinct targets.
 for(const perfect of [false,true]){
  await prep();await page.evaluate(()=>{window.target=sample(320,700);window.other=sample(420,700);});await tap('5');if(!perfect)await step(10);
  await page.evaluate(()=>{const w=window.__game.world,r=w.skills.shieldRadius;window.b=w.bullets.spawn(w.player.x,w.player.y-r-8,Math.PI/2,300);window.hard=w.bullets.spawn(w.player.x,w.player.y-r/2,Math.PI/2,0,{hard:true});window.behind=w.bullets.spawn(w.player.x,w.player.y+60,-Math.PI/2,0);});await step(4);
  let s=await page.evaluate(()=>{const w=window.__game.world,r=w.skills.returns[0];return{reflected:w.skills.stats.reflected,perfect:w.skills.stats.perfect,speed:r?Math.hypot(r.vx,r.vy):0,hard:window.hard.dead,behind:window.behind.dead,radius:w.skills.shieldRadius};});assert.equal(s.reflected,1);assert.equal(s.perfect,perfect?1:0);assert.ok(Math.abs(s.speed-900)<1e-7);assert.equal(s.hard,false);assert.equal(s.behind,false);
  await step(70);assert.equal(await page.evaluate(()=>10000-window.target.hp),30);assert.equal(await page.evaluate(()=>10000-window.other.hp),perfect?30:0);report.measurements[perfect?'perfectReturn':'normalReturn']=s;
 }
 report.checks.push('避雷：0.6s/120°、普通弹沿原路3倍速/30伤害、0.15s内完美反弹追敌并连锁、后方/特殊弹保留');
 // P4-11b: continuous charge cadence and the three simultaneous target cap.
 for(const source of ['blue','purple']){
  await prep();const charged=await page.evaluate(source=>{const w=window.__game.world,s=w.skills;for(let i=0;i<60;i++){w.real+=1/60;s.beginFrame(1/60,false);for(let j=0;j<4;j++)for(let hit=0;hit<3;hit++)s.primaryHit(j,source);}return s.charge;},source);assert.equal(charged,30);
  await prep();const one=await page.evaluate(source=>{const w=window.__game.world,s=w.skills;for(let i=0;i<60;i++){w.real+=1/60;s.beginFrame(1/60,false);s.primaryHit(1,source);s.primaryHit(1,source);}return s.charge;},source);assert.equal(one,10);
 }
 await prep();assert.equal(await page.evaluate(()=>{const s=window.__game.world.skills;s.primaryHit(1,'blue');s.primaryHit(1,'purple');for(let i=0;i<5;i++)s.primaryHit(1,'red');return s.charge;}),6);
 report.checks.push('持续武器同目标0.1秒最多+1、同时最多3目标；青雷共享目标间隔，朱每颗命中独立+1');
 await prep();assert.equal(await page.evaluate(()=>{const w=window.__game.world,old=w.player.sprite.h;w.player.sprite.h=old*2;const radius=w.skills.shieldRadius;w.player.sprite.h=old;return radius;}),90);report.checks.push('避雷半径固定90，与机体图集尺寸无关');
 for(const gap of [250,251]){
  await prep();await page.evaluate(gap=>{window.chain=[sample(320,750),sample(320+gap,750),sample(320+gap,650),sample(320+gap,550)];},gap);await tap('5');await page.evaluate(()=>{const w=window.__game.world;w.bullets.spawn(320,800,Math.PI/2,300);});await step(100);
  const damage=await page.evaluate(()=>window.chain.map(e=>10000-e.hp));assert.deepEqual(damage,gap===250?[30,30,30,0]:[30,0,0,0]);assert.equal(await page.evaluate(()=>window.__game.world.skills.returns.length),0);report.measurements[`chain${gap}`]=damage;
 }
 report.checks.push('完美反弹最多命中3个不同目标；250像素可连、251像素终止；无目标结束');
 // Same fixed paper-dragon body, actual three-color player firing for 10 battle seconds.
 report.measurements.paperCharge=[];
 for(const weapon of ['red','blue','purple']){
  await prep();await page.evaluate(async weapon=>{const w=window.__game.world;const {Serpent}=await import('/src/stages/stage1_boss.ts');w.real=0;w.player.x=450;w.player.y=900;w.player.power=1;w.player.weapon=weapon;window.paper=w.spawn({...Serpent,ai:undefined,hp:100000,drops:undefined},450,400);window.paper.hp=window.paper.maxHp=100000;},weapon);
  await mouse(true);await step(600);await mouse(false);report.measurements.paperCharge.push(await page.evaluate(weapon=>{const w=window.__game.world;return{weapon,seconds:10,power:w.player.power,charge:w.skills.charge,hits:w.skills.stats.primaryHits,damage:100000-window.paper.hp};},weapon));await shot(`paper-charge-${weapon}`);
 }
 report.measurements.paperBattleCharge=[];
 for(const weapon of ['red','blue','purple']){
  await prep();await page.evaluate(async weapon=>{const g=window.__game,w=g.world;const {Serpent}=await import('/src/stages/stage1_boss.ts');w.real=0;w.player.x=340;w.player.y=900;w.player.power=1;w.player.weapon=weapon;w.player.invuln=1000;w.root.run((function*(){yield* w.boss(Serpent,450,240,{warning:false,startPhase:1,music:false});})());},weapon);
  for(let i=0;i<600&&!await page.evaluate(()=>window.__game.world.bossE?.data.phaseIndex===1);i++)await step(1);
  assert.equal(await page.evaluate(()=>window.__game.world.bossE?.data.phaseIndex),1);
  await mouse(true);await step(600);await mouse(false);report.measurements.paperBattleCharge.push(await page.evaluate(weapon=>{const w=window.__game.world;return{weapon,seconds:10,power:w.player.power,charge:w.skills.charge,hits:w.skills.stats.primaryHits,phase:w.bossE?.data.phaseIndex};},weapon));await shot(`paper-battle-${weapon}`);
 }
 // Real Boss scripts at final phases: preserve default end handling then unlock their part.
 for(const [file,exportName,id,phase] of [['stage1_boss','Serpent','tishen',3],['stage1_boss','Sparrow','zhongpao',3],['stage2_boss','Mirage','shenying',6],['stage3_leigong','Leigong','bilei',2]]){
  await prep();await page.evaluate(async({file,exportName,phase,id})=>{const g=window.__game,w=g.world;w.skills.setUnlocked(['chaifa']);window.bossDone=false;if(file==='stage1_boss'){const {defaultTestOptions}=await import('/src/game/test-options.ts');g.toTitle();g.onTestStart({...defaultTestOptions(),checkpoint:exportName==='Serpent'?'SERPENT':'SPARROW',bossPhase:phase,god:true,fullInk:true});while(g.state==='loading')await new Promise(r=>setTimeout(r,10));w.debugAuto=false;}else {w.debugAuto=true;const module=await import(`/src/stages/${file}.ts`);w.root.run((function*(){yield* w.boss(module[exportName],450,240,{warning:false,startPhase:phase,music:false});window.bossDone=true;})());}window.unlockId=id;}, {file,exportName,phase,id});
  for(let i=0;i<270&&!await page.evaluate(()=>window.bossDone);i++)await page.evaluate(()=>{const g=window.__game,w=g.world;for(let j=0;j<60;j++){
    w.player.invuln=1000;g.input.poll();const d=g.ui.dialogueState();if(d.active){if(!d.complete)g.ui.dialogueAdvance();else if(j%30===0)g.ui.dialogueAdvance();}if(g.state==='growth')document.querySelector('.scr:not([aria-hidden]) .choice-card:not(.unavailable)')?.click();g.update(1/60);
    const boss=w.bossE,target=boss?.data.sealWindow?w.enemies.find(e=>!e.dead&&!e.data.targetDisabled&&['pd-stamp','tq-controller'].includes(e.def.sprite)):null;
    if(target&&!target.data.lastSealedAt){const pts=[];for(let k=0;k<=96;k++){const a=k/96*Math.PI*2;pts.push(target.x+Math.cos(a)*72,target.y+Math.sin(a)*72);}w.brush.resolve(pts);}
    if(w.skills.unlocked.has(window.unlockId))window.bossDone=true;
    if(window.unlockId==='shenying')for(const e of [...w.enemies])if(w.targetable(e))w.damage(e,100000,e.x,e.y,true,'red');
   }});
  assert.equal(await page.evaluate(()=>window.bossDone),true,JSON.stringify(await page.evaluate(()=>{const w=window.__game.world;return{id:window.unlockId,state:window.__game.state,time:w.t,real:w.real,boss:w.bossE?.data,alive:w.player.alive};})));assert.ok(await page.evaluate(()=>window.__game.world.skills.unlocked.has(window.unlockId)));await shot(`${id}-unlock`);
 }
 report.checks.push('实际纸龙/铜雀/蜃/雷公末阶段退出后解锁；接口幂等，新游戏恢复开局名单');
 // Capture an actual public unlock call while the source Boss is still on screen.
 await prep();await page.evaluate(()=>{const w=window.__game.world;w.skills.setUnlocked(['chaifa']);w.bossE=w.spawn({sprite:'pd-head',hp:1,noCollide:true,invulnerable:true,boss:{name:'纸龙',phases:3}},450,350);w.unlockSkill('tishen');w.unlockSkill('tishen');});assert.equal(await page.evaluate(()=>window.__game.world.skills.unlocks.length),1);
 await step(20);for(let i=0;i<5;i++){await shot(`unlock-part-${i}`);if(i<4)await step(2);}await step(35);await shot('unlock-slot-lit');
 // Clear only transient effects on stage change; unlocks/charge/cooldown survive. New run resets all.
 await prep();await tap('1');await tap('2');await tap('4');await tap('5');await page.evaluate(()=>{const w=window.__game.world;w.skills.charge=100;w.resetStage();});let lifecycle=await snapshot();assert.equal(lifecycle.charge,100);assert.equal(lifecycle.boost+lifecycle.mirror+lifecycle.shield+lifecycle.decoys.length,0);assert.ok(lifecycle.cooldowns.chaifa>0);await page.evaluate(()=>window.__game.world.newGame());assert.deepEqual(await page.evaluate(()=>[...window.__game.world.skills.unlocked]),['chaifa']);assert.equal((await snapshot()).charge,0);report.checks.push('解锁幂等与部件飞入、技能格亮起；转章清效果并保留成长，新游戏清成长');
 // Five successive simulation frames for each skill. Enemy targets and bullets make the action visible.
 for(const [id,key] of [['chaifa','1'],['tishen','2'],['zhongpao','3'],['shenying','4'],['bilei','5']]){
  await prep();await page.evaluate(id=>{const w=window.__game.world;for(const x of [320,580])sample(x,450);w.skills.charge=180;if(id==='bilei')for(let i=0;i<5;i++)w.bullets.spawn(w.player.x+(i-2)*16,w.player.y-w.skills.shieldRadius-15,Math.PI/2,180);},id);await mouse(true);await tap(key);
  for(let i=0;i<5;i++){await shot(`${id}-${i}`);report.frames.push({id,index:i,time:await page.evaluate(()=>window.__game.world.real)});if(i<4)await step(2);}await mouse(false);await step(1);
 }
 await prep();await shot('skills-wide');await page.setViewport({width:900,height:1200});await shot('skills-portrait');
 const layout=await page.evaluate(()=>{const bar=document.querySelector('.skillbar'),r=bar.getBoundingClientRect();return{width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,images:[...bar.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0),rows:[...bar.querySelectorAll('.skill-row')].map(row=>[...row.querySelectorAll('.skill-key')].map(e=>e.textContent))};});assert.ok(layout.images);assert.ok(layout.bottom<1200&&layout.left>=0&&layout.right<=900);assert.deepEqual(layout.rows,[['Shift','1','2','3','4','5'],['F','右键/空格']]);report.measurements.portrait=layout;
 // Menu switches and production onTestStart.
 await page.evaluate(()=>window.__game.toTitle());await new Promise(r=>setTimeout(r,250));await page.evaluate(()=>document.querySelectorAll('.title-menu .mi')[1].click());await new Promise(r=>setTimeout(r,250));await page.evaluate(()=>[...document.querySelectorAll('.scr .mi')].find(e=>e.querySelector('.ml')?.textContent==='已解锁技能').click());assert.deepEqual(await page.$$eval('.scr .ml',els=>els.map(e=>e.textContent).filter(t=>/^[1-5] · /.test(t))),['1 · 拆阀','2 · 替身','3 · 重炮','4 · 蜃影','5 · 避雷']);await new Promise(r=>setTimeout(r,200));
 const menuStates=()=>page.$$eval('.scr .mi',els=>els.filter(e=>/^[1-5] · /.test(e.querySelector('.ml')?.textContent??'')).map(e=>e.querySelector('.ms').textContent));
 assert.deepEqual(await menuStates(),['开','关','关','关','关']);for(let i=0;i<5;i++)await page.evaluate(i=>[...document.querySelectorAll('.scr .mi')].filter(e=>/^[1-5] · /.test(e.querySelector('.ml')?.textContent??''))[i].click(),i);assert.deepEqual(await menuStates(),['关','开','开','开','开']);assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.skillbar')).visibility),'hidden');await shot('skills-test-menu');
 await page.evaluate(()=>[...document.querySelectorAll('.scr .mi')].find(e=>e.querySelector('.ml')?.textContent==='返回测试设置').click());await new Promise(r=>setTimeout(r,200));await page.evaluate(()=>document.querySelector('[data-test-action="start"]').click());await page.waitForFunction(()=>window.__game.state==='playing',{polling:50});assert.deepEqual(await page.evaluate(()=>[...window.__game.world.skills.unlocked]),['tishen','zhongpao','shenying','bilei']);assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.skillbar')).visibility),'visible');
 await page.evaluate(async()=>{const {defaultTestOptions}=await import('/src/game/test-options.ts');const g=window.__game;g.toTitle();g.onTestStart({...defaultTestOptions(),skills:['chaifa','tishen','zhongpao','shenying','bilei','unknown']});});await page.waitForFunction(()=>window.__game.state==='playing',{polling:50});assert.deepEqual(await page.evaluate(()=>[...window.__game.world.skills.unlocked]),['chaifa','tishen','zhongpao','shenying','bilei']);report.checks.push('技能栏宽/竖屏两行、所有图片加载、仅显示解锁格；测试菜单5开关及读取过滤通过');
 assert.deepEqual(report.errors,[]);for(const id of ['chaifa','tishen','zhongpao','shenying','bilei']){const frames=report.frames.filter(f=>f.id===id);assert.equal(frames.length,5);for(let i=1;i<5;i++)assert.ok(Math.abs(frames[i].time-frames[i-1].time-1/30)<1e-8);}report.complete=true;
}catch(e){report.complete=false;report.failure=e.stack;throw e;}finally{writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
