// 第一章典型火力的真实射击流水；先运行旧节奏基线，再用 E 批阶段节奏复测。
// node tools/measure-boss-dps.mjs [URL] [输出 JSON]；无天赋、无墨矢、无伙伴输出，纸龙 Lv2、铜雀 Lv3。
import {bossInput,installBossInput} from './boss-bot.mjs';
import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
const url=process.argv[2]??'http://127.0.0.1:5184/',out=process.argv[3]??'.shots/boss-qte/dps-baseline.json';
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist']});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('about:blank');await new Promise(r=>setTimeout(r,1500));await page.goto(url);await page.waitForFunction(()=>window.__game?.state==='title');await page.evaluate(()=>window.requestAnimationFrame=()=>0);await new Promise(r=>setTimeout(r,100));
 await page.evaluate(`window.bossInput=${bossInput.toString()};window.installBossInput=${installBossInput.toString()};window.installBossInput(window.__game);`);
 const rows=await page.evaluate(()=>{const g=window.__game,w=g.world,rows=[],original=w.phase.bind(w),damage=w.damage.bind(w),down=g.input.down.bind(g.input);let measuring=false,amount=0,phaseStart=0;
 g.input.down=a=>(a==='shoot'&&!w.bossCombat.qte)||down(a);g.debug.autofire=false;g.debug.bot=false;
 for(const checkpoint of ['SERPENT','SPARROW'])for(const weapon of ['red','blue','purple'])for(let phase=1;phase<=3;phase++){
  const duration=(checkpoint==='SERPENT'?[19,17,14]:[17,15,17])[phase-1];if(!duration)continue;
  measuring=false;amount=0;let blood=0;const bot={delay:.7};
  w.phase=function*(e,opts,body){measuring=true;phaseStart=w.real;return yield* original(e,{...opts,hp:1e7,time:1000,complete:()=>false},body);};
  w.damage=(e,n,x,y,q,source)=>{const target=e.data.damageTarget??e,owner=w.bossCombat.owner(e),before=target.hp,ownerBefore=owner?.hp,actual=damage(e,n,x,y,q,source);if(measuring&&!w.bossCombat.qte&&w.bossCombat.modeKind==='打血时间'&&['red','blue','purple'].includes(source)&&((e.def.boss||e.data.bossOwner||e.parent?.def.boss)))amount+=actual;if(measuring&&(e.def.boss||e.data.bossOwner||e.parent?.def.boss)){target.hp=before;if(owner)owner.hp=ownerBefore;}return actual;};
  g.toTitle();g.onTestStart({chapter:1,checkpoint,bossPhase:phase,god:true,fullInk:true,fullBombs:false,brushPower:1,brushMethods:['横','竖'],companions:[],passives:[]});w.setDifficulty('normal');w.player.power=checkpoint==='SERPENT'?2:3;w.player.weapon=weapon;w.player.missile=0;
  for(let i=0;i<20000;i++){g.input.poll();window.__forced.pressed.clear();window.bossInput(g,bot);w.player.invuln=999;const targets=w.enemies.filter(e=>w.targetable(e,true));const t=targets.filter(e=>e.data.bossOwner&&!e.data.targetDisabled)[0]??w.bossE;if(t&&!w.bossCombat.qte){w.player.x=t.x;w.player.y=Math.min(1100,Math.max(800,t.y+500));}g.update(1/60);if(measuring&&!w.bossCombat.qte&&w.bossCombat.modeKind==='打血时间'){blood+=1/60;if(blood>=duration)break;}if(measuring&&w.real-phaseStart>100)break;}
  rows.push({checkpoint,phase,weapon,level:w.player.power,seconds:blood,damage:amount,dps:amount/Math.max(.01,blood),qte:w.bossCombat.history.map(q=>({command:q.command,result:q.result,wrong:q.wrong}))});
 }
 w.phase=original;w.damage=damage;return rows;});
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({rows,errors},null,2)+'\n');console.log(JSON.stringify({rows,errors}));if(errors.length)process.exitCode=1;
}finally{await browser.close();}
