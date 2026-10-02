// 测试入口验收：正式构建里的DOM菜单启动、命名检查点、Boss阶段、开关与普通开局隔离。
// node tools/validate-test-menu.mjs <url> <证据目录>；使用独立无头Chrome，未使用?stage/skip。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {paintStroke,mouseLine} from './mouse-paint.mjs';
const url=process.argv[2]??'http://127.0.0.1:5181/';
const out=resolve(process.argv[3]??'.shots/p3-01');mkdirSync(out,{recursive:true});
const errors=[];const report={url,build:'production preview',cases:[],checks:[],errors};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:120000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run']});
try{
 const page=await browser.newPage();await page.setViewport({width:1600,height:900});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'||/INVALID_OPERATION|INVALID_FRAMEBUFFER/.test(m.text()))errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('about:blank');await new Promise(r=>setTimeout(r,1800));
 await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>window.__game?.state==='title',{timeout:60000});
 await new Promise(r=>setTimeout(r,700));
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await new Promise(r=>setTimeout(r,100));
 report.bundle=await page.evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean));
 assert(report.bundle.some(s=>/\/assets\//.test(s)),'需验收正式构建');
 const click=async label=>page.evaluate(label=>{
  const row=[...document.querySelectorAll('.scr:not([aria-hidden]) .mi')].find(e=>e.querySelector('.ml')?.textContent===label);
  if(!row)throw Error(`缺少菜单项 ${label}`);row.click();
 },label);
 const text=async label=>page.evaluate(label=>[...document.querySelectorAll('.scr:not([aria-hidden]) .mi')].find(e=>e.querySelector('.ml')?.textContent===label)?.querySelector('.ms')?.textContent,label);
 const cycle=async(label,wanted)=>{for(let i=0;i<100;i++){if((await text(label))?.startsWith(wanted))return;await click(label);}throw Error(`未找到 ${label}/${wanted}`);};
 const ticks=async seconds=>page.evaluate(seconds=>{const g=window.__game;for(let i=0;i<seconds*60;i++){g.input.poll();const d=g.ui.dialogueState();if(d.active){if(!d.complete)g.ui.dialogueAdvance();else if(i%30===0)g.ui.dialogueAdvance();}g.update(1/60);}g.render();},seconds);
 const state=async()=>page.evaluate(()=>{const g=window.__game,w=g.world,b=w.enemies.find(e=>e.def.boss&&!e.dead);return {state:g.state,chapter:w.stageIndex,checkpoint:w.currentCheckpoint,time:w.t,bodyCount:w.contentStats.bodies,patrolBodies:w.density.patrolBodies,events:w.sceneState?.events,score:w.score,boss:b?{name:b.def.boss.name,phase:b.data.phase,start:b.data.startPhase,parts:w.enemies.filter(e=>!e.dead&&e!==b).map(e=>e.data.weakLabel)}:null,options:g.testRun,ink:w.player.ink,bombs:w.player.bombs,invuln:w.player.invuln,brushPower:w.brushPower,brushForms:[...w.brushForms],companions:w.hud(60).companions.map(c=>c.kind),passives:[...w.progression.talents.keys()]};});
 const waitBoss=async phase=>{for(let i=0;i<7200;i++){const b=(await state()).boss;if(b?.phase===phase)return;await ticks(1/60);}throw Error('Boss入口等待超过120游戏秒');};
 await click('测 试');
 assert.equal(await text('执笔笔力'),'1 级');await click('执笔笔力');await click('执笔笔力');assert.equal(await text('执笔笔力'),'3 级');
 await click('已解锁笔法');for(const f of ['横','竖'])await click(`笔法 · ${f}`);
 await page.screenshot({path:`${out}/brush-methods-menu.png`});await click('返回测试设置');
 await click('伙伴 · 赤燕');await click('伙伴 · 老盾');await click('伙伴 · 墨鸢');
 assert.equal(await text('伙伴 · 墨鸢'),'关','最多两名');
 await click('被动技能');await click('火羽');await click('天雷');await click('返回测试设置');
 await click('无敌');await click('满墨');await click('满泼墨');
 await cycle('起点','S6');
 await new Promise(r=>setTimeout(r,600));await page.screenshot({path:`${out}/test-menu.png`});
 await click('进入测试');await page.waitForFunction(()=>window.__game.state==='playing',{polling:50});await ticks(2);
 await page.evaluate(()=>window.growthOptions=structuredClone(window.__game.testRun));
 let s=await state();assert.equal(s.brushPower,3);assert.deepEqual(s.brushForms,['横','竖']);assert.equal(s.chapter,1);assert.equal(s.checkpoint,'S6');assert.equal(s.score,0,'跳过前段不产生击杀分');
 assert.deepEqual(s.companions,['chiyan','laodun']);assert.deepEqual(s.passives,['huoyu','tianlei']);
 await page.evaluate(()=>{const p=window.__game.world.player;p.ink=.1;p.bombs=0;p.invuln=0;});await ticks(1/60);
 s=await state();assert(s.ink>.99&&s.bombs===6&&s.invuln>.9);report.checks.push('资源/无敌开关生效；伙伴最多2名，任选被动技能生效');
 await new Promise(r=>setTimeout(r,800));
 await page.screenshot({path:`${out}/ch1-s6.png`});report.cases.push({name:'第一章S6（大场面）',...s});
 for(const c of [{chapter:1,entry:'纸龙',phase:1,seconds:6,file:'ch1-serpent'},{chapter:1,entry:'铜雀',phase:3,seconds:11,file:'ch1-sparrow-p3'},{chapter:2,entry:'蜃',phase:1,seconds:6,file:'ch2-mirage'}]){
  await page.evaluate(()=>window.__game.toTitle());await click('测 试');
  await cycle('章节',c.chapter===1?'第一章':'第二章');await cycle('起点',c.entry);
  for(let i=1;i<c.phase;i++)await click('Boss阶段');
  await click('进入测试');await page.waitForFunction(()=>window.__game.state==='playing',{polling:50});await waitBoss(c.phase);s=await state();
  assert.equal(s.chapter,c.chapter);assert(s.boss,c.entry);assert.equal(s.boss.phase,c.phase);assert.equal(s.boss.start,c.phase);assert.equal(s.bodyCount,0,'直接Boss入口不得生成杂兵');assert.equal(s.score,0,'阶段跳过不得结算前段击杀分');
  await new Promise(r=>setTimeout(r,800));
  await page.screenshot({path:`${out}/${c.file}.png`});report.cases.push({name:c.file,...s});
 }
 // 各Boss末段不经过此前攻击/无限等待；第四章使用现有终战独立测试脚本。
 for(const c of [{chapter:1,entry:'纸龙',phase:2},{chapter:1,entry:'铜雀',phase:3},{chapter:2,entry:'蜃',phase:4},{chapter:3,entry:'雷公',phase:2},{chapter:4,entry:'鲲',phase:4},{chapter:4,entry:'鹏',phase:3}]){
  await page.evaluate(()=>window.__game.toTitle());await click('测 试');
  await cycle('章节',['第一章','第二章','第三章','第四章'][c.chapter-1]);await cycle('起点',c.entry);
  c.phase=Number((await text('Boss阶段')).split('/')[1].trim());
  for(let i=1;i<c.phase;i++)await click('Boss阶段');await click('进入测试');await page.waitForFunction(()=>window.__game.state==='playing',{polling:50});await waitBoss(c.phase);
  s=await state();assert(s.boss,c.entry);assert.equal(s.boss.start,c.phase);assert.equal(s.boss.phase,c.phase);report.checks.push({entry:c.entry,chapter:c.chapter,phase:c.phase,passed:true});
 }
 // 普通开始必须清掉测试开关、伙伴限制和强制技能。
 await page.evaluate(()=>window.__game.toTitle());await click('开 始');await page.waitForFunction(()=>window.__game.state==='playing',{polling:50});await ticks(.5);s=await state();
 assert.equal(s.options,null);assert.equal(s.chapter,1);assert.equal(s.companions.length,0);assert.equal(s.passives.length,0);assert(s.ink<1&&s.bombs<6);assert.equal(s.brushPower,1);assert.equal(s.brushForms.length,0);report.checks.push('普通开始清除测试状态与技能，恢复第一章空名单并等待剧情加入');
 // 检查菜单在窄屏可滚动，且菜单操作可由键盘导航。
 await page.evaluate(()=>{window.__game.toTitle();window.__game.render();});await page.setViewport({width:900,height:1200});await click('测 试');await new Promise(r=>setTimeout(r,500));
 await page.screenshot({path:`${out}/test-menu-portrait.png`});
 await page.keyboard.down('ArrowDown');await page.evaluate(()=>{const g=window.__game;g.input.poll();g.update(1/60);});await page.keyboard.up('ArrowDown');
 const focus=await page.evaluate(()=>document.querySelector('.scr:not([aria-hidden]) .mi.on .ml')?.textContent);assert.equal(focus,'起点');report.checks.push('竖屏菜单与真实键盘导航通过');
 // 当前可解锁笔法为横、竖；封默认可用，用真实鼠标轨迹验证三种规则。
 await page.setViewport({width:1600,height:900});
 const prepStroke=()=>page.evaluate(()=>{const g=window.__game,w=g.world;g.testRun=null;g.state='playing';g.ui.screen('none');w.resetStage();w.stageIndex=1;w.diff={...w.diff,hp:1};w.player.reset(false);w.player.weapon='blue';w.player.entering=w.player.invuln=0;w.player.x=450;w.player.y=1050;w.player.ink=1;w.brushForms=new Set(['横','竖']);w.brushPower=3;g.render();});
 await prepStroke();await paintStroke(page,mouseLine([200,700],[600,700],24));assert.equal(await page.evaluate(()=>window.__game.world.brush.lastForm),'横');assert.equal(await page.evaluate(()=>window.__game.world.brush.walls.length),1);await page.screenshot({path:`${out}/horizontal.png`});
 await prepStroke();await paintStroke(page,mouseLine([250,300],[250,700],24));assert.equal(await page.evaluate(()=>window.__game.world.brush.lastForm),'竖');await page.screenshot({path:`${out}/vertical.png`});
 await prepStroke();await page.evaluate(()=>window.__game.world.spawn({sprite:'e_hornet',hp:1000,noCollide:true},450,600));await paintStroke(page,Array.from({length:49},(_,i)=>[450+Math.cos(i/48*Math.PI*2)*100,600+Math.sin(i/48*Math.PI*2)*100]));assert.equal(await page.evaluate(()=>window.__game.world.brush.lastForm),'封');assert.ok(await page.evaluate(()=>window.__game.world.enemies[0].sealed)>0);await page.screenshot({path:`${out}/seal.png`});report.checks.push('横、竖解锁及默认画圈封：真实鼠标轨迹生效');
 await prepStroke();await paintStroke(page,mouseLine([200,400],[400,600],24));assert.equal(await page.evaluate(()=>window.__game.world.brush.lastForm),'斩');report.checks.push('斜笔归墨刃，已删除手势不在菜单中');
 await prepStroke();await page.evaluate(()=>{const w=window.__game.world;w.stageIndex=4;w.brush.yongJudge=(pts,unlocked)=>{window.yongSeen={pts:pts.length,unlocked:unlocked.size};return true;};});await paintStroke(page,mouseLine([200,400],[600,400],24));const yong=await page.evaluate(()=>({result:window.__game.world.brush.lastYongResult,seen:window.yongSeen,form:window.__game.world.brush.lastForm}));assert.equal(yong.result,true);assert.equal(yong.seen.unlocked,2);assert.ok(yong.seen.pts>=4);assert.equal(yong.form,'横');report.checks.push({yong});

 assert.deepEqual(errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e);throw e;}
finally{writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,checks:report.checks.length,errors:errors.length}));
