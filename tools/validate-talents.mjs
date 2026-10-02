// P4-14：真实 World/Player 结算、正式成长入口与 12×5 连续战斗截图。
// node tools/validate-talents.mjs [dev URL] [绝对证据目录]
// 数值隔离场景仅设定敌人与武器状态；伤害、碰撞、资源和成长均调用游戏原实现。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const url=process.argv[2]??'http://127.0.0.1:5184/';
const out=process.argv[3]??'local-source/P4-14-evidence';
mkdirSync(out,{recursive:true});
const report={url,errors:[],numbers:[],screens:[],ui:{}};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
try{
 const page=await browser.newPage();await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/CONTEXT_LOST|INVALID_OPERATION|INVALID_FRAMEBUFFER/.test(m.text()))report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,1500));await page.goto(url);await page.waitForFunction(()=>window.__game?.state==='title',{timeout:60000});
 await page.evaluate(async()=>{
  const g=window.__game;g.onStart();while(g.state==='loading')await new Promise(r=>setTimeout(r,10));window.updateTalents=g.update.bind(g);g.update=()=>{};window.drawTalents=g.render.bind(g);g.render=()=>{};window.requestAnimationFrame=()=>0;
  window.TALENTS=(await import('/src/game/progression.ts')).TALENTS;window.talentPopups=[];
  const popup=g.ui.popup;g.ui.popup=(...args)=>{if(args[4]?.startsWith('passive:'))window.talentPopups.push({x:args[0],y:args[1],name:args[2],key:args[4]});return popup(...args);};
  window.prepTalent=()=>{
   const w=g.world,p=w.player;g.state='playing';g.ui.screen('none');w.progression.resetRun();w.brushPower=1;w.resetStage();p.reset(true);w.companions.setRoster([]);w.companions.update=()=>{};w.companions.draw=()=>{};
   w.diff={...w.diff,hp:1};w.debugAuto=false;g.debug.god=g.debug.autofire=g.debug.bot=false;w.timeScale=1;w.real=w.time=w.t=0;w.scroll=0;w.fx.trauma=w.fx.flashAmt=w.fx.caAmt=0;w.fx.update(0,0,0);g.r.partLow.reset();g.r.partHigh.reset();g.r.fluid.clear();w.stageIndex=1;w.stageName='晓山返笔';
   Object.assign(p,{x:450,y:1000,bank:0,entering:0,invuln:0,bombs:3,power:1,weapon:'red',firing:false,thunderRetarget:0});
   window.talentPopups=[];document.querySelectorAll('.pop').forEach(e=>e.style.display='none');g.input.poll();
  };
  window.selectTalent=id=>{const p=g.world.progression;p.pendingChoices=1;p.offers=[window.TALENTS.find(t=>t.id===id)];if(!p.choose(id))throw Error(`选择失败 ${id}`);};
  window.enemyTalent=(x=450,y=600,hp=1000,boss=false)=>g.world.spawn({sprite:'e_hornet',hp,noCollide:true,armor:1,boss:boss?{name:'验收首领',phases:1}:undefined},x,y);
  await document.fonts.ready;
 });await new Promise(r=>setTimeout(r,200));
 report.numbers=await page.evaluate(async()=>{
  const g=window.__game,w=g.world,p=w.player,prep=window.prepTalent,select=window.selectTalent,enemy=window.enemyTalent,rows=[];
  const near=(a,b,label)=>{if(Math.abs(a-b)>1e-6)throw Error(`${label}: ${a} != ${b}`);};
  const ok=(v,label)=>{if(!v)throw Error(label);};
  const shots=()=>{p.shots=[{x:450,y:700,vx:0,vy:-1000,dmg:1.25,kind:0,age:0,dead:false,target:null}];p.updateShots(.1);};
  prep();select('huoyu');let e=enemy();shots();near(e.hp,998.75,'火羽直击');w.progression.update(1);shots();w.progression.update(2.5);near(e.hp,993.75,'火羽刷新不叠加');ok(window.talentPopups.length===1,'火羽首次提示一次');rows.push({id:'huoyu',direct:1.25,burnDps:1.25,refreshFinalHp:e.hp,duration:2});
  prep();select('huoyu');e=enemy();e.invulnerable=true;shots();ok(w.progression.burns.size===0&&window.talentPopups.length===0,'无敌目标不燃烧');
  prep();select('liaoyuan');const a=enemy(200,500,300),b=enemy(260,500,100),c=enemy(320,500,100),d=enemy(380,500,100),far=enemy(451,500,100),boss=enemy(100,200,400,true),part=enemy(170,200,30);part.parent=boss;b.hp=c.hp=20;
  w.damage(a,300,a.x,a.y,true,'ink');near(d.hp,70,'连爆伤害30');ok(b.dead&&c.dead&&!far.dead,'连爆与70范围');const after=d.hp;w.progression.recordAction({kind:'kill',enemy:c});near(d.hp,after,'每架只爆一次');w.kill(part);ok(w.progression.visuals.filter(f=>f.id==='liaoyuan').length===4,'Boss部件不爆火');p.weapon='blue';w.kill(d);ok(window.talentPopups.length===1,'燎原首次一次');rows.push({id:'liaoyuan',radius:70,cap:60,chainedKills:3,survivorDamage:30,bossPartExcluded:true});
  prep();select('liaoyuan');const capSource=enemy(200,500,300),edge=enemy(270,500,500),offEdge=enemy(271,500,500);w.damage(capSource,300,capSource.x,capSource.y,true,'companion');near(edge.hp,440,'燎原60上限与70边界');near(offEdge.hp,500,'燎原71像素外不受伤');
  prep();select('niepan');p.power=4;let normal=w.shoot(100,100,0,0),hard=w.shoot(200,100,0,0,{hard:true});p.die();near(p.power,4,'涅槃保火力');ok(normal.dead&&!hard.dead,'涅槃普通清弹硬弹保留');p.respawn();p.invuln=0;p.die();near(p.power,2,'本章第二死正常掉火力');w.resetStage();p.reset(false);p.invuln=0;p.power=4;p.die();near(p.power,4,'下一章恢复涅槃');ok(window.talentPopups.length===1,'跨章不重复首次提示');rows.push({id:'niepan',firstPower:4,secondPower:2,nextChapterPower:4,hardKept:true});
  prep();select('fenguang');p.weapon='blue';p.firing=true;p.laserOn=1;const large=enemy(450,700,300),large2=enemy(450,400,500);const hw=9.2;let widths=[],splits=[];const hit=w.hitSegment.bind(w),damage=w.damage.bind(w);w.hitSegment=(...args)=>{widths.push(args.at(-1));return hit(...args);};w.damage=(target,amount,...rest)=>{splits.push({target:target.id,amount});damage(target,amount,...rest);};
  try{p.updateShots(.1);}finally{w.hitSegment=hit;w.damage=damage;}
  ok(w.progression.splits.length===2,'一次主束只分两道');const beams=w.progression.splits;near(beams[0].width,hw*.5,'分光半宽');near(Math.atan2(Math.abs(beams[0].ex-beams[0].x),beams[0].y-beams[0].ey)*180/Math.PI,25,'分光25度');ok(beams.every(s=>Math.min(s.ex,s.ey,900-s.ex)<1e-6),'分光到屏幕边缘');
  const branch=enemy(beams[0].x+(beams[0].ex-beams[0].x)*.35,beams[0].y+(beams[0].ey-beams[0].y)*.35);const before=branch.hp;p.updateShots(.1);near(before-branch.hp,24*.82*.1*.4,'斜光40%伤害');ok(w.progression.isLarge(large)&&w.progression.isLarge(large2),'大型HP300');const low=enemy(150,300,299);ok(!w.progression.isLarge(low),'299非大型');const owner=enemy(150,100,5,true);low.parent=owner;ok(w.progression.isLarge(low),'Boss部件也是大型');rows.push({id:'fenguang',branches:2,angle:25,width:hw*.5,damage:before-branch.hp,edge:true,firstLargeY:beams[0].y});
  prep();select('hujian');p.weapon='blue';normal=w.shoot(p.x,p.y,0,0);w.collide();ok(p.alive&&normal.dead,'护剑实际挡弹');const swordFlash=w.progression.swordFlash;normal=w.shoot(p.x,p.y,0,0);w.progression.update(2.99);ok(!w.progression.blockBullet(),'护剑未满3秒');w.progression.update(.01);w.collide();ok(p.alive&&normal.dead&&swordFlash>0,'护剑3秒恢复并闪剑');w.progression.update(3);p.weapon='red';ok(!w.progression.blockBullet(),'仅青色护剑');p.weapon='blue';hard=w.shoot(p.x,p.y,0,0,{hard:true});w.collide();ok(!p.alive,'护剑不挡硬弹');rows.push({id:'hujian',cooldown:3,swordFlash,blocks:2,hardExcluded:true});
  prep();select('guanri');p.weapon='blue';p.firing=true;p.laserOn=1;const one=enemy(450,700),two=enemy(450,500),shield=enemy(450,350),behind=enemy(450,180);shield.invulnerable=true;widths=[];w.hitSegment=(...args)=>{widths.push(args.at(-1));return hit(...args);};try{p.updateShots(.1);}finally{w.hitSegment=hit;}
  near(1000-one.hp,24*.82*.1,'贯日首敌伤害');near(one.hp,two.hp,'贯日贯穿不衰减');near(behind.hp,1000,'无敌目标截断');near(widths[0],9.2*1.5,'贯日宽度1.5');ok(p.beamEndY>180,'贯日画面截断');rows.push({id:'guanri',width:widths[0],eachDamage:1000-one.hp,behindShieldDamage:0});
  prep();select('liansuo');p.weapon='purple';for(let i=0;i<5;i++)enemy(350+i*50,550+i*20);p.firing=true;p.fire(.01);ok(p.thunderTargets.length===p.baseThunderTargets+2,'连锁多2目标');rows.push({id:'liansuo',baseline:p.baseThunderTargets,targets:p.thunderTargets.length});
  prep();select('tianlei');p.weapon='purple';const auraTarget=enemy(450,900);w.aura.clear();w.aura.update(1.5);near(w.progression.thunderTime,0,'光环不计天雷时间');auraTarget.dead=true;const main=enemy(450,600),adjacent=enemy(500,600),outside=enemy(511,600);p.firing=true;p.thunderTargets=[main];p.updateShots(1);p.updateShots(1);near(w.progression.thunderTime,2,'天雷累计2秒');p.firing=false;p.updateShots(7);near(w.progression.thunderTime,2,'停火暂停');p.firing=true;p.thunderTargets=[];p.updateShots(2);near(w.progression.thunderTime,2,'没打中暂停');p.thunderTargets=[main];const mh=main.hp,ah=adjacent.hp;p.updateShots(1);near(mh-main.hp,20+40,'天雷主目标DPS2倍');near(ah-adjacent.hp,20,'天雷周边半伤');near(outside.hp,1000,'天雷60半径');near(w.progression.thunderTime,0,'天雷剩余计时');rows.push({id:'tianlei',pauseTime:2,threshold:3,mainLightningDamage:40,nearDamage:20,radius:60});
  prep();select('dianci');p.weapon='purple';const target=enemy(450,600);normal=w.shoot(480,800,0,0);const n2=w.shoot(450,790,0,0),n3=w.shoot(450,780,0,0),beyond=w.shoot(491,800,0,0);hard=w.shoot(450,770,0,0,{hard:true});p.firing=true;p.thunderRetarget=0;p.fire(.01);ok(normal.dead&&n2.dead&&!n3.dead&&!hard.dead&&!beyond.dead,'电磁40范围/限2/不消硬弹');p.fire(.1);ok(!n3.dead,'0.12秒内不重放电');p.fire(.02);ok(n3.dead&&!beyond.dead&&!hard.dead,'再次放电');rows.push({id:'dianci',range:40,perDischarge:2,interval:.12,hardKept:true});
  prep();select('jifeng');near(w.roll.maxCharges,3,'疾风上限3');near(w.roll.charges,3,'疾风补新增格');w.roll.charges=2;w.roll.recharge=1.5;window.updateTalents(1/60);near(w.roll.charges,2,'正常Game更新保留已消耗充能');w.roll.charges=0;w.roll.recharge=1.5;w.roll.update(4.5);near(w.roll.charges,3,'疾风3格恢复');rows.push({id:'jifeng',capacity:w.roll.maxCharges,recharge:w.roll.charges});
  prep();const savedTest=g.testRun;g.testRun={fullBombs:true};p.bombs=0;g.applyDebug();near(p.bombs,6,'测试满泼墨基础容量');g.testRun=savedTest;p.bombs=6;select('monang');near(p.bombs,7,'墨囊立即补1');near(w.progression.bombMax,7,'墨囊上限7');g.testRun={fullBombs:true};p.bombs=0;g.applyDebug();near(p.bombs,7,'测试满泼墨含墨囊容量');g.testRun=savedTest;p.bombs=3;await g.startStage(1);near(p.bombs,4,'墨囊下一章额外1');p.bombs=3;await g.startStage(2);near(p.bombs,4,'墨囊每章额外1');p.respawn();near(p.bombs,4,'重生不补墨囊');p.bombs=7;w.progression.beginChapter();near(p.bombs,7,'满库存不超上限');ok(window.talentPopups.length===1,'墨囊首次只一次');rows.push({id:'monang',capacity:7,selectionGrant:1,chapterGrant:1,respawnGrant:0});
  prep();w.brushPower=1;select('bili');near(w.brushPower,2,'笔力升一级');near(w.brush.power.maxLength,1600,'二级长度');near(w.brush.power.slow,.5,'二级子弹速度');w.brush.origin='player';w.brush.resolve([450,1000,450,850]);near(w.brush.paths.flights.length,8,'二级8支墨矢');prep();w.brushPower=2;select('bili');near(w.brush.power.level,3,'笔力升三级');near(w.brush.power.maxLength,2000,'三级长度');near(w.brush.power.slow,.4,'三级速度');w.brush.origin='player';w.brush.resolve([450,1000,450,850]);near(w.brush.paths.flights.length,10,'三级10支墨矢');rows.push({id:'bili',level2:{length:1600,slow:.5,arrows:8},level3:{length:2000,slow:.4,arrows:10}});
  prep();w.brushPower=3;ok(w.progression.offerTalents().every(t=>t.id!=='bili'),'满级不提供无收益笔力卡');prep();const chosen=[];for(let i=0;i<9;i++){ok(w.progression.claimChoice(1+Math.floor(i/3),i%3+1),'关内三次入口');const offers=w.progression.offerTalents();ok(offers.length===3&&new Set(offers.map(t=>t.id)).size===3,'随机三选一不重复');ok(offers.every(t=>!chosen.includes(t.id)),'排除已拥有');const id=offers[0].id;ok(w.progression.choose(id),'合法选择');chosen.push(id);ok(!w.progression.choose(id),'不能重复选择');}ok(!w.progression.claimChoice(1,1),'同一成长时机只一次');rows.push({id:'selection',chosen,unique:chosen.length,unownedOnly:true});
  return rows;
 });
 assert.equal(report.numbers.length,13);
 // 保留真实成长 UI 的三个随机卡，正式64图与32图均解码。
 report.ui=await page.evaluate(async()=>{
  const g=window.__game,w=g.world;window.prepTalent();w.progression.claimChoice(1,1);g.openMilestone('成长 1/3');await Promise.all([...document.querySelectorAll('.choice-card img')].map(i=>i.decode()));
  const cards=[...document.querySelectorAll('.choice-card')].map(c=>({name:c.querySelector('strong').textContent,src:c.querySelector('img').getAttribute('src'),width:c.querySelector('img').naturalWidth}));
  const assets=[];for(const t of window.TALENTS)for(const suffix of ['','-32']){const img=new Image();img.src=t.icon.replace('.png',`${suffix}.png`);await img.decode();assets.push({src:img.src,width:img.naturalWidth});}
  return{cards,assets};
 });assert.equal(report.ui.cards.length,3);assert.ok(report.ui.cards.every(c=>c.width===64));assert.equal(report.ui.assets.length,24);
 await page.screenshot({path:`${out}/growth-new-talents.png`});
 await page.click('.choice-card');report.ui.actualChoice=await page.evaluate(()=>({state:window.__game.state,pending:window.__game.world.progression.pendingChoices,owned:window.__game.world.progression.passiveHud().map(p=>p.name)}));assert.equal(report.ui.actualChoice.state,'playing');assert.equal(report.ui.actualChoice.pending,0);assert.ok(report.ui.actualChoice.owned.includes(report.ui.cards[0].name));
 const ids=await page.evaluate(()=>window.TALENTS.map(t=>t.id));
 for(const id of ids){
  await page.mouse.up({button:'left'}).catch(()=>{});await page.keyboard.up('ShiftLeft').catch(()=>{});await page.mouse.up({button:'right'}).catch(()=>{});
  await page.evaluate(id=>{
   window.prepTalent();const g=window.__game,w=g.world,p=w.player,enemy=window.enemyTalent;window.selectTalent(id);
   if(id==='huoyu')enemy(450,780,300);
   if(id==='liaoyuan'){const first=enemy(370,650,120),next=enemy(420,650,200);next.hp=25;w.damage(first,120,first.x,first.y,true,'ink');}
   if(id==='niepan'){p.power=4;for(let i=0;i<15;i++)w.shoot(100+i*45,500+i%3*35,Math.PI/2,60);w.shoot(250,400,Math.PI/2,60,{hard:true});w.shoot(p.x,p.y,0,0);w.collide();}
   if(['fenguang','guanri'].includes(id)){p.weapon='blue';enemy(450,620,1200);enemy(350,400,500);enemy(550,400,500);enemy(450,300,500);}
   if(id==='hujian'){p.weapon='blue';w.shoot(p.x,p.y,0,0);w.collide();}
   if(['liansuo','tianlei','dianci'].includes(id)){p.weapon='purple';for(const [x,y]of [[450,580],[490,590],[370,510],[580,460]])enemy(x,y,2000);if(id==='tianlei')w.progression.thunderTime=2.98;if(id==='dianci'){for(let i=0;i<7;i++)w.shoot(450+(i%3-1)*20,720+i*20,Math.PI/2,40);w.shoot(455,700,Math.PI/2,40,{hard:true});}}
   g.r.setBackground('stage1');window.drawTalents();
  },id);
  if(['huoyu','fenguang','guanri','liansuo','tianlei','dianci'].includes(id)){const pos=await page.evaluate(()=>{const r=window.__game.r.playCss;return{x:r.x+450*r.w/900,y:r.y+1000*r.h/1200};});await page.mouse.move(pos.x,pos.y);await page.mouse.down({button:'left'});}
  if(id==='jifeng')await page.keyboard.down('ShiftLeft');
  if(id==='bili')await page.evaluate(()=>{const g=window.__game,r=g.r.playCss,c=document.querySelector('#gl');c.dispatchEvent(new MouseEvent('mousedown',{clientX:r.x+450*r.w/900,clientY:r.y+1000*r.h/1200,button:2,buttons:2,bubbles:true}));});
  let triggered=false;for(let tick=0;tick<60;tick++){triggered=await page.evaluate(id=>{const g=window.__game;g.input.poll();g.world.tick(1/60);window.drawTalents();return window.talentPopups.some(p=>p.key===`passive:${id}`);},id);if(triggered)break;}
  assert.ok(triggered,`${id} 战斗未生效`);await new Promise(r=>setTimeout(r,70));
  const samples=[];
  for(let frame=0;frame<5;frame++){
   if(frame)await page.evaluate(()=>{const g=window.__game;for(let i=0;i<2;i++){g.input.poll();g.world.tick(1/60);window.drawTalents();}});
   const visiblePopup=await page.evaluate(id=>{const name=window.TALENTS.find(t=>t.id===id).name;return[...document.querySelectorAll('.pop')].some(e=>e.style.display!=='none'&&e.textContent===name);},id);const path=`talent-${id}-${frame}.png`;await page.screenshot({path:`${out}/${path}`});samples.push({path,simulationOffset:frame/30,visiblePopup});
  }
  const evidence=await page.evaluate(id=>{const w=window.__game.world,s=w.progression.passiveHud().find(t=>t.id===id);return{popup:window.talentPopups.filter(p=>p.key===`passive:${id}`),triggers:s.triggers,visuals:w.progression.visuals.length,visible:[...document.querySelectorAll('.pop')].filter(e=>e.style.display!=='none'&&e.textContent===s.name).length,roll:w.roll.charges};},id);
  assert.equal(evidence.popup.length,1,`${id} 首次提示重复`);assert.equal(evidence.triggers,1);assert.ok(samples.some(s=>s.visiblePopup),`${id} 首次弹字不在截图时段`);
  report.screens.push({id,samples,...evidence});
 }
 assert.equal(report.screens.length,12);assert.deepEqual(report.errors,[]);report.passed=true;
 console.log(JSON.stringify({passed:true,checks:report.numbers.length,assets:report.ui.assets.length,talents:report.screens.length,frames:report.screens.reduce((n,t)=>n+t.samples.length,0),errors:report.errors},null,2));
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;}finally{writeFileSync(`${out}/talents.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
