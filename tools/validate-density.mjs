// P4-05：生产构建中的排队、释放、整组开火门禁、可见计数、补弹与首领整组预算。
import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const url=process.argv[2]??'http://127.0.0.1:5181/',out=process.argv[3]??'local-source/P4-05';mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist']});
try{const page=await browser.newPage();await page.goto(url);await page.waitForFunction(()=>window.__game);const result=await page.evaluate(()=>{
 const w=window.__game.world;window.requestAnimationFrame=()=>0;w.resetStage();w.stageIndex=1;w.setDifficulty('normal');
 const normal=()=>({sprite:'e_hornet',hp:20,noCollide:true,*ai(e,g){e.data.started=true;g.fan(e.x,e.y,0,8,.2,0);yield;}});
 for(let i=0;i<12;i++)w.spawn(normal(),300,300,e=>e.data.contentRole='normal');
 const queued=w.enemies.filter(e=>e.data.densityQueued),a={live:w.density.count(w.enemies),queued:queued.length,targetable:queued.some(e=>w.targetable(e))};
 a.queuedHpBefore=queued[0].hp;w.damage(queued[0],999);a.queuedHp=queued[0].hp;w.root.tick();a.queuedStarted=queued.some(e=>e.data.started);a.bullets=w.bullets.list.filter(b=>!b.dead).length;
 w.remove(w.enemies.find(e=>!e.data.densityQueued));w.density.release(1,w.enemies);w.root.tick();a.released=queued[0].data.started===true;a.after=w.density.count(w.enemies);
 w.spawn({sprite:'e_hornet',hp:20,*ai(e,g){g.ring(300,300,100,0);}},300,300,e=>e.data.contentRole='prop');w.root.tick();a.exemptBullets=w.bullets.list.filter(b=>!b.dead).length;
 w.resetStage();w.stageIndex=2;for(let i=0;i<17;i++)w.spawn(normal(),300,300,e=>e.data.contentRole='normal');w.root.tick();const b={live:w.density.count(w.enemies),queued:w.enemies.filter(e=>e.data.densityQueued).length,bullets:w.bullets.list.filter(b=>!b.dead).length};
 w.resetStage();w.stageIndex=3;for(let i=0;i<17;i++)w.spawn(normal(),300,300,e=>e.data.contentRole='normal');w.root.tick();const c={live:w.density.count(w.enemies),queued:w.enemies.filter(e=>e.data.densityQueued).length};
 const bosses=[];
 for(const stage of [1,2]){
  w.resetStage();w.stageIndex=stage;const cap=60;
  const boss=w.spawn({sprite:'e_hornet',hp:999,boss:{name:'预算测试',phases:1},*ai(e,g){for(let i=0;i<8;i++)g.shoot(400,300,0,0);yield;g.fan(400,300,0,Math.round(5/g.difficulty.count),.3,0);yield;}},400,300);w.bossE=boss;
  for(let i=0;i<cap-5;i++)w.bullets.spawn(100,100,0,0);
  w.density.beginBossBatch();w.root.tick();w.density.finishBossBatch(stage,w.bullets.list);const rejected=w.bullets.list.filter(b=>!b.dead).length;
  w.density.beginBossBatch();w.root.tick();w.density.finishBossBatch(stage,w.bullets.list);bosses.push({stage,rejected,accepted:w.bullets.list.filter(b=>!b.dead).length,log:[...w.density.attackLog]});
 }
 w.resetStage();w.stageIndex=1;const idle=w.spawn({sprite:'e_hornet',hp:999,noCollide:true},300,300,e=>e.data.contentRole='normal');const off=w.spawn({sprite:'e_hornet',hp:999,noCollide:true},-1000,300,e=>e.data.contentRole='normal');
 const cadence={visible:w.density.visibleCount(w.enemies)};w.supplementOrdinaryFire();w.t+=2.21;w.supplementOrdinaryFire();cadence.first=w.bullets.list.filter(b=>!b.dead).length;cadence.speed=Math.hypot(w.bullets.list[0].vx,w.bullets.list[0].vy);w.t+=1;w.supplementOrdinaryFire();cadence.beforeRepeat=w.bullets.list.filter(b=>!b.dead).length;w.t+=1.21;w.supplementOrdinaryFire();cadence.repeat=w.bullets.list.filter(b=>!b.dead).length;
 idle.scope.run((function*(){w.shoot(300,300,0,0);yield;})());w.root.tick();const fired=idle.data.densityLastFire;w.t+=2;w.supplementOrdinaryFire();cadence.ownReset=idle.data.densityLastFire===fired;cadence.offscreen=off.data.densityLastFire===undefined;

 while(w.bullets.list.filter(b=>!b.dead).length<60)w.bullets.spawn(100,100,0,0);w.t+=2.3;w.supplementOrdinaryFire();cadence.capped=w.bullets.list.filter(b=>!b.dead).length;
 w.resetStage();w.stageIndex=2;w.spawn({sprite:'e_hornet',hp:999,noCollide:true},300,300,e=>e.data.contentRole='normal');w.supplementOrdinaryFire();w.t+=1.59;w.supplementOrdinaryFire();cadence.secondBefore=w.bullets.list.filter(b=>!b.dead).length;w.t+=.02;w.supplementOrdinaryFire();cadence.secondAfter=w.bullets.list.filter(b=>!b.dead).length;
 return{first:a,second:b,third:c,bosses,cadence};
 });assert.equal(result.first.live,10);assert.equal(result.first.queued,2);assert.equal(result.first.targetable,false);assert.equal(result.first.queuedHp,result.first.queuedHpBefore);assert.equal(result.first.queuedStarted,false);assert.equal(result.first.released,true);assert.equal(result.first.after,10);assert(result.first.bullets<=60);assert(result.first.exemptBullets>60);assert.equal(result.second.live,14);assert.equal(result.second.queued,3);assert(result.second.bullets<=60);assert.equal(result.third.live,17);assert.equal(result.third.queued,0);assert.deepEqual(result.bosses.map(b=>[b.rejected,b.accepted]),[[55,60],[55,60]]);assert(result.bosses.every(b=>b.log.some(a=>a.rejected&&a.attack==='shoot'&&a.size===8&&a.groupSize===8&&a.existing===55&&a.cap===60)&&b.log.some(a=>!a.rejected&&a.attack==='fan'&&a.size===5)));assert.equal(result.cadence.visible,1);assert.equal(result.cadence.first,1);assert.equal(result.cadence.beforeRepeat,1);assert.equal(result.cadence.repeat,2);assert(Math.abs(result.cadence.speed-190*.82)<1e-8);assert(result.cadence.ownReset);assert(result.cadence.offscreen);assert.equal(result.cadence.capped,60);assert.equal(result.cadence.secondBefore,0);assert.equal(result.cadence.secondAfter,1);writeFileSync(out+'/gate-validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
