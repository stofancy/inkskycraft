// P4-13：真实 World.tick 拾取/碰撞，固定敌机与敌弹样本，冻结 RAF 后手动推进。
// node tools/validate-items.mjs [dev URL] [证据目录]
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5178/';
const out = process.argv[3] ?? '.shots/p4-13';
mkdirSync(out, { recursive: true });
const report = { checks: [], layouts: [], errors: [] };
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
 args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
 const page = await browser.newPage();
 page.on('pageerror', e => report.errors.push(e.message));
 page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
 await page.evaluateOnNewDocument(() => { window.requestAnimationFrame = () => 0; });
 await page.setViewport({ width: 1600, height: 900 });
 await page.goto(base + '?diff=normal', { waitUntil: 'load' });
 await page.waitForFunction('window.__game', { timeout: 60000, polling: 100 });
 const checks = await page.evaluate(async () => {
  const g = window.__game, w = g.world, p = w.player;
  const result = [];
  const check = (ok, label, data = {}) => { if (!ok) throw Error(label + ': ' + JSON.stringify(data)); result.push({ label, ...data }); };
  const close = (a, b) => Math.abs(a - b) < 1e-7;
  const prep = () => {
   g.debug.god = g.debug.bot = g.debug.autofire = false; g.testRun = null;
   w.newGame(); w.resetStage(); w.companions.setRoster([]); w.setDifficulty('normal'); w.stageIndex = 1;
   p.x = 450; p.y = 1000; p.entering = p.invuln = 0; p.ink = .4;
   g.state = 'playing'; g.ui.screen('none'); g.r.setBackground('stage1');
   document.querySelector('.opening-controls').hidden = true;
  };
  const pick = (kind, elapsed = 0) => { const it = w.items.spawn(kind, p.x, p.y); it.elapsed = elapsed; it.vx = it.vy = 0; w.tick(0); return it; };
  prep();
  for (const level of [2, 3, 4]) { pick('p'); check(p.power === level && w.score === 0, '火力 P 升级到 ' + level); }
  pick('p'); pick('p'); check(p.power === 4 && w.score === 10000, '满级每枚 P 转5000分', { score: w.score });
  p.power = 8; check(p.power === 4, '旧调试等级收敛到4级'); p.power = 0; check(p.power === 1, '最低1级');
  prep(); p.bombs = 5; pick('bomb'); check(p.bombs === 6 && w.score === 0, '泼墨 B 加1，上限6');
  pick('bomb'); pick('bomb'); check(p.bombs === 6 && w.score === 20000, '溢出每枚 B 转10000分', { score: w.score });
  prep(); p.ink = .4; pick('ink'); check(close(p.ink, .65), '墨锭补墨25%'); p.ink = .9; pick('ink'); check(p.ink === 1 && w.score === 0, '墨量封顶100%');
  for (const [seconds, score] of [[0,2000],[1,2000],[1.001,1000],[2,1000],[2.001,500],[3,500],[3.001,200],[10,200]]) {
   prep(); pick('medal', seconds); check(w.score === score, '金印时间档 ' + seconds + ' 秒', { seconds, score });
  }
  prep();
  const missed = w.items.spawn('medal', 450, 1241); missed.vy = 0; w.tick(0); pick('medal', .5);
  check(w.score === 2000, '漏接金印不影响下一枚面值');
  prep(); const slow = w.items.spawn('medal', 100, 400); slow.vx = slow.vy = 0;
  const rect=g.r.playCss, canvas=document.querySelector('#gl');
  canvas.dispatchEvent(new MouseEvent('mousedown',{clientX:rect.x+100*rect.w/900,clientY:rect.y+600*rect.h/1200,button:2,buttons:2,bubbles:true}));g.input.poll(); for (let i = 0; i < 121; i++) w.tick(1/60);
  check(slow.age < 2 && slow.elapsed > 2, '执笔减速只影响移动，计分仍按真实秒', { gameAge: slow.age, realAge: slow.elapsed });
  canvas.dispatchEvent(new MouseEvent('mouseup',{button:2,buttons:0,bubbles:true}));g.input.poll();w.brush.cancel(); p.x = slow.x; p.y = slow.y; slow.vx = slow.vy = 0; w.tick(0); check(w.score === 500, '减速2秒后的金印为500分');
  prep(); const paused = w.items.spawn('medal', 100, 400); g.state = 'paused'; g.update(5);
  check(paused.elapsed === 0, '暂停菜单不计入金印出现时间');
  prep(); p.x = 26; pick('gold'); check(w.score === 100, '清弹金保留独立100分');
  prep(); const initial = p.lives;
  w.addScore(999999); check(p.lives === initial, '100万前不奖命');
  w.addScore(1); check(p.lives === initial+1, '100万奖命');
  w.resetStage(); w.addScore(799999); check(p.lives === initial+1, '换章保留奖命记录');
  w.addScore(1); w.addScore(7000000); check(p.lives === initial+2, '180万奖命，整局总共2次');
  w.newGame(); const newLives = p.lives; w.addScore(1800000); check(p.lives === newLives+2, '新局重置奖命，跨两线都补发');
  for (const level of [1, 2, 4]) {
   prep(); p.power = level;
   const enemy = w.spawn({ sprite: 'e_hornet', hp: 200, radius: 40 }, p.x, p.y);
   const hp = enemy.hp, lives = p.lives; w.tick(0);
   check(p.alive && p.lives === lives && p.power === Math.max(1,level-1) && close(p.invuln,1) && close(Math.hypot(p.x-450,p.y-1000),60) && close(hp-enemy.hp,50), '普通撞机规则，火力' + level, { hpLoss: hp-enemy.hp, x: p.x, y: p.y });
   const after = enemy.hp; enemy.x=p.x; enemy.y=p.y; w.shoot(p.x,p.y,0,0); w.tick(0);
   check(p.alive && enemy.hp === after, '1秒无敌挡住重复撞机与敌弹，火力' + level);
  }
  prep(); p.power=4; const boss = w.spawn({ sprite:'e_hornet', hp:500, radius:40, boss:{name:'碰撞样本',phases:1} },p.x,p.y);
  const bossHp=boss.hp; w.tick(0); check(p.alive && p.power===3 && boss.hp===bossHp, 'Boss撞机掉1级并弹开，Boss不受普通撞机伤害');
  const {Serpent,Sparrow}=await import('/src/stages/stage1_boss.ts');
  const {Mirage}=await import('/src/stages/stage2_boss.ts');
  const {Leigong}=await import('/src/stages/stage3_leigong.ts');
  const {Kun,Peng}=await import('/src/stages/stage3_boss.ts');
  for(const def of [Serpent,Sparrow,Mirage,Leigong,Kun,Peng]) {
   prep();p.power=4;
   const e=w.spawn({...def,ai:undefined},p.x,p.y);e.invulnerable=true;
   const hp=e.hp;w.tick(0);
   check(p.alive&&p.power===3&&close(p.invuln,1)&&hp===e.hp,'真实Boss本体接触：'+def.boss.name,{sprite:def.sprite,noCollide:!!def.noCollide});
  }
  prep(); p.power=3; p.x=26; p.y=1164; w.spawn({sprite:'e_hornet',hp:200,radius:40},26,1164);w.tick(0);
  check(p.x>=26&&p.x<=874&&p.y>=50&&p.y<=1164&&p.alive,'贴边弹开保持在战场内');
  prep(); p.power=4; window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft',key:'Shift',bubbles:true}));g.input.poll(); w.spawn({sprite:'e_hornet',hp:200,radius:40},p.x,p.y);w.tick(0);check(p.alive&&p.power===4,'翻滚保护期间撞机不掉火力');window.dispatchEvent(new KeyboardEvent('keyup',{code:'ShiftLeft',key:'Shift',bubbles:true}));g.input.poll();
  for (const level of [1,2,3,4]) {
   prep(); p.power=level; p.x=26; const lives=p.lives;
   w.shoot(p.x,p.y,0,0); w.tick(0);
   const drops=w.items.list.filter(i=>i.kind==='p');
   check(!p.alive&&p.lives===lives-1&&p.power===Math.max(1,level-2)&&drops.length===1&&drops[0].x===26&&drops[0].y===1000,'中弹死亡掉2级并原地掉1枚 P，火力'+level,{power:p.power,drops:drops.map(i=>({kind:i.kind,x:i.x,y:i.y}))});
   p.die();check(w.items.list.length===1,'死亡结算只执行一次');
   w.tick(1.5); check(p.alive&&p.invuln>0,'死亡后可重生');
  }
  prep();p.lives=0;w.shoot(p.x,p.y,0,0);w.tick(0);check(g.state==='continue','最后一架中弹进入续关');
  for (const difficulty of ['easy','normal','hard']) for (const level of [1,2,3,4]) {
   prep();w.setDifficulty(difficulty);p.power=level;
   const expected=200*w.diff.speed*(1+(level-1)*.05);
   const shots=[w.shoot(450,200,0,200),...w.fan(450,200,0,5,1,200),...w.ring(450,200,5,200)];
   check(shots.length>1&&shots.every(b=>close(b.speed,expected)),difficulty+' 火力'+level+'的单发/扇射/环射提速',{speed:expected});
   const existing=shots[0].speed;p.power=1;check(shots[0].speed===existing,'已发射弹体保留原速度');
  }
  prep();const {MINIMUM_FIRE}=await import('/src/game/density.ts');
  for (const level of [1,4]) {
   w.bullets.clear();p.power=level;
   w.enemies=[];const e=w.spawn({sprite:'e_hornet',hp:200},450,200);e.data.contentRole='normal';e.data.densityLastFire=-100;w.t=100;
   w.tick(0);const b=w.bullets.list.find(b=>!b.dead);
   check(b&&close(b.speed,MINIMUM_FIRE[1].speed*w.diff.speed*(1+(level-1)*.05)),'密度补弹同样随火力提速，火力'+level,{speed:b?.speed});
  }
  prep();g.openMilestone('休整样本');check(g.state==='playing'&&w.restLabel===''&&w.shop===undefined,'休整点直接继续，无补给商店');
  w.progression.claimChoice(1,1);g.openMilestone('成长 1/3');check(g.state==='growth','天赋三选一继续可用');
  g.onChoice(w.progression.offerTalents()[0].id);check(g.state==='playing','天赋选择后继续战斗');
  prep();check(!('missile' in p),'已删除导弹库存');
  return result;
 });
 report.checks.push(...checks);
 for (const [width,height] of [[1600,900],[900,1200]]) {
  await page.setViewport({width,height});
  const layout = await page.evaluate(async () => {
   const g=window.__game,w=g.world,p=w.player;w.resetStage();p.reset(true);p.x=450;p.y=1000;p.power=4;p.invuln=0;g.state='playing';g.ui.screen('none');g.r.setBackground('stage1');
   w.fx.update(0,1,w.real);document.querySelectorAll('.fx .pop').forEach(e=>e.remove());document.querySelectorAll('.presentation-dock .cardl,.presentation-dock .warnl,.presentation-dock .capl').forEach(e=>e.replaceChildren());
   for(const [i,kind] of ['p','bomb','ink','medal'].entries())w.items.spawn(kind,300+i*100,800);
   w.spawn({sprite:'e_hornet',hp:200},450,350);
   g.render();
   const {COMMON_SPRITES}=await import('/src/art/sprites_common.ts');
   const icons=COMMON_SPRITES.filter(s=>['item_p','item_bomb','item_ink','item_medal'].includes(s.id));
   const imgs=await Promise.all(icons.map(async s=>{const image=new Image();image.src=s.image;await image.decode();return{sprite:s.id,path:s.image,w:s.w,h:s.h,loaded:image.naturalWidth};}));
   return {powerDots:document.querySelector('[data-k=lat]').children.length,hasMissile:document.querySelector('.host.r').textContent.includes('追踪弹'),icons:imgs};
  });
  assert.equal(layout.powerDots,4);assert.equal(layout.hasMissile,false);assert.ok(layout.icons.length===4&&layout.icons.every(i=>i.w===36&&i.h===36&&i.loaded>0));
  await new Promise(r=>setTimeout(r,450));await page.screenshot({path:`${out}/${width}-items.png`});
  await page.evaluate(()=>{const g=window.__game,w=g.world,p=w.player;w.items.clear();w.enemies=[];w.spawn({sprite:'e_hornet',hp:200,radius:40},p.x,p.y);w.tick(0);g.render();});
  await new Promise(r=>setTimeout(r,100));await page.screenshot({path:`${out}/${width}-collision.png`});
  report.layouts.push({width,height,...layout});
 }
 assert.equal(report.errors.length,0,report.errors.join('\n')); report.complete=true;
} catch(e) { report.failure=e.stack;throw e; }
finally {writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({complete:report.complete,checks:report.checks.length,layouts:report.layouts.length,errors:report.errors}));
