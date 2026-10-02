// P4-13b：同一射击夹具对比当前四级与 p4-a-int 的旧八级参数，采集真实弹体/命中伤害。
// node tools/balance/compare-power.mjs [当前dev URL] [基线dev URL] [证据目录]
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const [current='http://127.0.0.1:5178/',baseline='http://127.0.0.1:5199/',out='.shots/p4-13b-power']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const errors=[],report={mapping:[1,3,6,8],checks:[],errors};
try {
 for(const [name,url,levels] of [['baseline',baseline,[1,3,6,8]],['current',current,[1,2,3,4]]]){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.evaluateOnNewDocument(()=>{window.requestAnimationFrame=()=>0;});
  await page.setViewport({width:1600,height:900});await page.goto(url,{waitUntil:'load'});await page.waitForFunction('window.__game',{timeout:60000,polling:100});
  report[name]=[];
  for(const weapon of ['red','blue','purple'])for(const power of levels){
   const row=await page.evaluate(({weapon,power})=>{
    const g=window.__game,w=g.world,p=w.player;w.newGame();w.resetStage();w.companions.setRoster([]);p.power=power;p.weapon=weapon;p.x=450;p.y=1000;p.entering=p.invuln=0;p.firing=true;p.focus=true;p.thunderRetarget=0;
    g.state='playing';g.ui.screen('none');g.r.setBackground('stage1');document.querySelector('.opening-controls').hidden=true;
    for(let i=0;i<(weapon==='purple'?5:1);i++)w.spawn({sprite:'e_hornet',hp:10000,radius:10},450+(i*40),500);
    p.fire(1/60);const shots=p.shots.map(s=>({vx:s.vx,vy:s.vy,dmg:s.dmg}));
    p.laserOn=weapon==='blue'?1:0;p.focusCharge=1;const hp=w.enemies.map(e=>e.hp),widths=[],hitSegment=w.hitSegment.bind(w);
    w.hitSegment=(e,x1,y1,x2,y2,hw)=>{widths.push(hw);return hitSegment(e,x1,y1,x2,y2,hw);};p.updateShots(1/60);w.hitSegment=hitSegment;
    const damage=w.enemies.map((e,i)=>hp[i]-e.hp);w.real+=.1;g.render();
    return{power,weapon,shots,targets:p.thunderTargets.length,damage,widths};
   },{weapon,power});report[name].push(row);
   if(name==='current'&&power===4){await new Promise(r=>setTimeout(r,350));await page.screenshot({path:`${out}/power4-${weapon}.png`});}
  }await page.close();
 }
 for(let i=0;i<report.current.length;i++){
  const a=report.current[i],b=report.baseline[i];
  const normalized=r=>({...r,power:0});assert.deepEqual(normalized(a),normalized(b));
  if(a.weapon==='red')assert.ok(a.shots.length>=3);else assert.ok(a.damage.some(v=>v>0),'连续武器必须实际命中');
  if(a.weapon==='purple')assert.equal(a.targets,[1,2,3,5][a.power-1]);
  report.checks.push({weapon:a.weapon,power:a.power,oldPower:b.power,redCount:a.shots.length,targets:a.targets,damagePerFrame:a.damage,widths:a.widths});
 }
 assert.equal(errors.length,0);report.complete=true;
}finally{writeFileSync(`${out}/comparison.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({complete:report.complete,checks:report.checks.length,errors}));
