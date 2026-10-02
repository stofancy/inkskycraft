// P4-20：隔离数值样本走真实 Brush/World；键鼠样本走真实事件。关闭无敌、自动射击与自动控制。
// node tools/validate-brush-colors.mjs [URL=http://127.0.0.1:5182/] [证据目录=.shots/p4-20]
// 定格截图为游戏渲染器中的固定敌机样本。真人识别率与战斗平衡另由试玩验收。
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5182/',out=process.argv[3]??'.shots/p4-20';mkdirSync(out,{recursive:true});
const report={checks:[],matrix:[],screenshots:[],errors:[]};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
try {
  const page=await browser.newPage();await page.setViewport({width:1600,height:900});page.on('pageerror',e=>report.errors.push(e.message));
  await page.evaluateOnNewDocument(()=>{window.requestAnimationFrame=()=>0;});await page.goto(base,{waitUntil:'load'});await page.waitForFunction('window.__game',{timeout:60000,polling:100});
  await page.evaluate(()=>{
    const g=window.__game,w=g.world;window.__events=[];window.__popups=[];
    const damage=w.damage.bind(w),popup=w.ui.popup.bind(w.ui);
    w.damage=(e,amount,x,y,quiet,source,options)=>{const actual=damage(e,amount,x,y,quiet,source,options);window.__events.push({enemy:e.id,amount,actual,source,color:options?.inkColor});return actual;};
    w.ui.popup=(x,y,text,kind,key)=>{window.__popups.push({x,y,text,kind,key});popup(x,y,text,kind,key);};
    window.__prep=(color='red',power=1)=>{
      g.debug.god=false;g.debug.bot=false;g.debug.autofire=false;g.testRun=null;w.testOptions=null;
      w.newGame();w.resetStage();w.companions.setRoster([]);w.brushPower=power;w.brushForms=new Set(['横','竖']);
      w.player.entering=0;w.player.invuln=0;w.player.ink=1;w.player.weapon=color;w.player.x=450;w.player.y=1050;
      g.state='playing';g.ui.screen('none');g.r.setBackground('stage1');g.ui.hud(w.hud(60),false);
      document.querySelector('.opening-controls').hidden=true;document.querySelectorAll('.presentation-dock .cardl,.presentation-dock .warnl,.presentation-dock .capl').forEach(e=>e.replaceChildren());
      document.querySelectorAll('.fx .pop').forEach(e=>{e.getAnimations().forEach(a=>a.cancel());e.style.display='none';});
      window.__events=[];window.__popups=[];
    };
    window.__step=(seconds)=>{for(let left=seconds;left>1e-9;){const dt=Math.min(1/120,left);g.input.poll();w.tick(dt);left-=dt;}};
    window.__spawn=(x=450,y=600,hp=10000,armor=1,sprite='e_hornet',radius=1)=>{const e=w.spawn({sprite,hp,armor,noCollide:true,radius},x,y);e.hp=hp;e.maxHp=190;return e;};
    window.__line=(a,b,n=40)=>Array.from({length:n+1},(_,i)=>[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]).flat();
    window.__circle=(x=450,y=600,r=100,n=72)=>Array.from({length:n+1},(_,i)=>[x+Math.cos(i/n*Math.PI*2)*r,y+Math.sin(i/n*Math.PI*2)*r]).flat();
    window.__resolve=(pts,origin=null)=>{w.brush.origin=origin;w.brush.resolve(pts);};
    window.__release=(pts,origin=null)=>{const b=w.brush;b.active=true;b.pts=pts;b.origin=origin;b.length=0;for(let i=2;i<pts.length;i+=2)b.length+=Math.hypot(pts[i]-pts[i-2],pts[i+1]-pts[i-1]);b.release();};
  });
  const result=await page.evaluate(()=>{
    const w=window.__game.world,checks=[],matrix=[];
    const check=(name,condition,data)=>{if(!condition)throw Error(`${name}: ${JSON.stringify(data??window.__events)}`);checks.push(name);};
    const near=(a,b)=>Math.abs(a-b)<1e-6,events=()=>window.__events.filter(e=>e.actual>0);
    __prep();let e=__spawn(450,600,14);e.maxHp=14;__resolve(__circle());check('蜂机当场封杀，封爆45',e.dead&&events()[0].actual===45);
    check('封殺提示与4500封分',__popups.some(p=>p.text==='封杀')&&w.score>=4640);
    check('普通封顿帧80ms，下压震屏',near(w.hitstopRemaining,.08)&&w.fx.trauma>=.7);
    check('数字45小号朱色',__popups.some(p=>p.text==='45'&&p.kind==='damage-red-small'));
    __prep('blue');e=__spawn(450,600,85,.6);e.maxHp=85;__resolve(__circle());check('护甲封爆半补偿36',near(e.hp,49));__step(.01);check('青剑阵35无视护甲',events().some(e=>e.amount===35&&e.actual===35));
    __prep('red');e=__spawn();const nested=[...__circle(450,600,95),...__circle(450,600,80),...__circle(450,600,65)];__resolve(nested);check('嵌套三圈封爆只一次',events().filter(e=>e.amount===45).length===1);
    const before=e.hp,numberCount=__popups.filter(p=>p.kind.startsWith('damage-')).length;__resolve(__circle());check('六秒内重复封无新伤害与数字',near(e.hp,before)&&__popups.filter(p=>p.kind.startsWith('damage-')).length===numberCount);
    __step(1);__resolve(__circle());check('重复封刷新两秒控制',near(e.sealed,2));
    __prep('purple');e=__spawn();const side=Math.sqrt(5999),square=__line([350,500],[350+side,500]).concat(__line([350+side,500],[350+side,500+side]).slice(2),__line([350+side,500+side],[350,500+side]).slice(2),__line([350,500+side],[350,500]).slice(2));e.x=350+side/2;e.y=500+side/2;__resolve(square);check('面积5999不封',w.brush.lastForm==='斩'&&e.sealed===0);
    __prep('purple');e=__spawn();e.phaseLock=true;e.maxHp=700;e.charging=true;__resolve(__circle());check('首领阶段封爆245与打断1.5',near(e.hp,9755)&&near(e.stunned,1.5)&&!e.charging&&e.sealed===0);
    check('首领顿帧120ms、大字号245',near(w.hitstopRemaining,.12)&&__popups.some(p=>p.text==='245'&&p.kind==='damage-purple-large'));
    __resolve(__circle());check('首领重复封61.25且不重开打断',near(e.hp,9693.75)&&e.interruptSerial===1);
    __prep('blue');e=__spawn();e.phaseLock=true;e.maxHp=200;__resolve(__circle());check('首领下限120、青打断2秒',near(e.hp,9880)&&near(e.stunned,2));const hp=e.hp;w.damage(e,20,e.x,e.y,true,'neutral');check('首领印记易伤25%',near(hp-e.hp,25));
    __prep('purple');const root=__spawn(850,200);root.phaseLock=true;const mid=__spawn(850,250);mid.parent=root;e=__spawn();e.parent=mid;e.maxHp=400;__resolve(__circle());check('多层首领部件封爆140、无定身',near(e.hp,9860)&&e.sealed===0&&e.stunned===1.5&&root.interruptSerial===1);
    __prep('red');e=__spawn();w.damage(e,10,e.x,e.y,true,'red');check('主武器不产生执笔数字',!__popups.some(p=>p.kind.startsWith('damage-')));window.__events=[];const sizeCast=w.brush.colors.cast([450,600]);w.brush.colors.damage(e,10,sizeCast);w.brush.colors.damage(e,50,sizeCast);w.brush.colors.damage(e,80,sizeCast);const sizePops=__popups.filter(p=>p.kind.startsWith('damage-'));check('0.3秒同敌数字合并、三档字号',new Set(sizePops.map(p=>p.key)).size===1&&sizePops.map(p=>p.kind).join(',')==='damage-red-small,damage-red-medium,damage-red-large'&&sizePops.at(-1).text==='140');
    __prep('red');e=__spawn();e.maxHp=1000;__resolve(__circle());check('大型机封爆120、控制1秒',near(e.hp,9880)&&near(e.sealed,1));
    __prep('purple');e=__spawn();__resolve(__circle());__step(.1);check('封慢放从0.25开始',near(w.brush.colors.slow,.25));__step(.175);check('封慢放中段0.625',near(w.brush.colors.slow,.625));__step(.175);check('封慢放0.45秒恢复',near(w.brush.colors.slow,1));
    w.brush.active=true;w.brush.pts=[100,400];w.brush.length=0;w.brush.origin=null;const down=w.input.down.bind(w.input);w.input.down=a=>a==='brush'||down(a);w.input.pointer.x=100;w.input.pointer.y=400;__step(1.55);check('持续执笔时封也在真实两秒碎裂',w.brush.colors.marks.size===0&&e.sealed===0);w.input.down=down;w.brush.cancel();
    for(const color of ['red','blue','purple'])for(const power of [1,2,3])for(const form of ['横','竖','墨矢','封']){
      __prep(color,power);const scale=[1,1.25,1.5][power-1];let chainTarget=null;
      if(form==='横'){__spawn(450,600);__spawn(540,600);__resolve(__line([200,600],[700,600]));__step(1.1);}
      if(form==='竖'){__spawn(450,600);__spawn(410,600);__spawn(490,600);__spawn(535,450);__resolve(__line([450,850],[450,450]));__step(1.4);}
      if(form==='墨矢'){__spawn(450,700);chainTarget=__spawn(540,700);__spawn(530,500);__spawn(450,300);__resolve(__line([450,1050],[450,500]),'player');__step(1.6);}
      if(form==='封'){__spawn(400,600);__spawn(500,600);__resolve(__circle(450,600,125));__step(2.01);}
      const expected={横:{red:[10,12],blue:[80],purple:[30,20]},竖:{red:[60,12],blue:[45],purple:[45]},墨矢:{red:[90,12],blue:[80],purple:[25,20]},封:{red:[12,40],blue:[35],purple:[15]}}[form][color];
      const ev=events();if(form==='墨矢'&&color==='purple')check(`雷矢笔力${power}链到轨迹外目标`,ev.some(e=>e.enemy===chainTarget.id&&near(e.amount,25*scale)));
      if(form==='竖'&&color==='blue')check(`青三剑笔力${power}两侧各45并松甲6秒`,ev.filter(e=>near(e.amount,45*scale)).length>=2&&w.enemies.filter(e=>e.armorLoose>4).length>=3);
      check(`${color}/${form}/笔力${power}附加数值`,expected.every(n=>ev.some(e=>near(e.amount,n*scale))),ev);
      check(`${color}/${form}/笔力${power}来源ink`,ev.every(e=>e.source==='ink'&&e.color===color),ev);
      const keys=new Set(__popups.filter(p=>p.kind.startsWith('damage-')).map(p=>p.key));check(`${color}/${form}/笔力${power}数字≤8`,keys.size<=8,[...keys]);
      matrix.push({color,form,power,scale,expected:expected.map(n=>n*scale),rawAmounts:[...new Set(ev.map(e=>e.amount))],numbers:keys.size});
    }
    __prep('purple');e=__spawn();__resolve(__circle());__step(6.01);window.__events=[];__resolve(__circle());check('普通抗性6秒后恢复封爆',events().some(e=>e.amount===45));
    __prep('purple');e=__spawn();e.phaseLock=true;e.maxHp=700;__resolve(__circle());__step(8.01);window.__events=[];__resolve(__circle());check('首领抗性8秒后恢复全额245与打断',events().some(e=>near(e.amount,245))&&e.interruptSerial===2);
    __prep('blue');w.shoot(450,660,0,0);__resolve(__line([200,700],[700,700]));__step(.04);check('青剑光扫弹转墨滴',w.bullets.list.filter(b=>!b.dead).length===0&&w.brush.paths.drops.length===1);
    __prep('red');const first=w.brush.colors.cast([200,600,700,600]);w.brush.colors.wall([200,600,700,600],first);w.brush.colors.wall([200,620,700,620],first);w.brush.colors.wall([200,640,700,640],first);check('第三墙移除最早墨堤',w.brush.walls.length===2&&w.brush.walls[0].pts[1]===620);
    __prep('red');__resolve(__line([450,1050],[450,500]),'player');w.player.weapon='blue';__resolve(__line([200,700],[700,700]));check('上一笔航迹捕获朱色，下一笔即时青色',w.brush.paths.flights.every(f=>f.color==='red')&&w.brush.walls[0].cast.color==='blue');
    __prep();e=__spawn();const c=w.brush.colors.cast([450,600]);w.brush.colors.burn(e,c);__step(.5);w.brush.colors.burn(e,c);__step(.5);check('灼烧刷新不叠层',events().filter(e=>e.amount===12).length===1&&w.brush.colors.burns.size===1);
    __prep('red');e=__spawn();const wall=__line([200,600],[700,600]);__resolve(wall);__resolve(wall);__resolve(wall);__step(.01);check('最多两墙且接触伤害不叠',w.brush.walls.length===2&&events().filter(e=>e.amount===10).length===1);
    __prep('purple');e=__spawn();__spawn(530,600);__spawn(450,690);__resolve(wall);__resolve(wall);__step(.01);const wallHits=events().filter(ev=>ev.amount===30||ev.amount===20);check('电墙与连锁共享每敌0.25秒去重',new Set(wallHits.map(ev=>ev.enemy)).size===wallHits.length);
    __prep('purple');e=__spawn();__spawn(530,600);__spawn(450,690);__resolve(__circle());__resolve(__circle());__step(.41);check('多电网每敌0.4秒一次',events().filter(ev=>ev.enemy===e.id&&ev.amount===15).length===1);
    __prep('purple');e=__spawn();__resolve(__circle());__step(.41);check('单敌电网10',events().some(ev=>ev.amount===10));
    __prep();for(let i=0;i<12;i++)__spawn(300+i%4*80,520+Math.floor(i/4)*80);__resolve(__circle(420,600,210));__step(2.01);const numbers=__popups.filter(p=>p.kind.startsWith('damage-'));check('12机含延迟伤害共用8数字预算与中心总数',new Set(numbers.map(p=>p.key)).size===8&&numbers.some(p=>p.key.endsWith(':total')));
    __prep('purple');for(let i=0;i<12;i++)__spawn(300+i%4*80,520+Math.floor(i/4)*80);const castA=w.brush.colors.cast([450,600]),castB=w.brush.colors.cast([450,600]);for(const enemy of w.enemies.slice(0,5))w.brush.colors.damage(enemy,10,castA);window.__popups=[];for(const enemy of w.enemies)w.brush.colors.damage(enemy,10,castB);check('跨笔0.3秒合并仍计入新笔8数字预算',new Set(__popups.filter(p=>p.kind.startsWith('damage-')).map(p=>p.key)).size<=8);
    __prep('blue');e=__spawn();__resolve(__circle());__step(.15);w.brush.active=true;w.brush.pts=[100,400];w.brush.length=0;w.input.down=a=>a==='brush'||down(a);w.input.pointer.x=100;w.input.pointer.y=400;__step(1/120);check('执笔与封慢放取最小',near(w.timeScale,Math.min(.6,w.brush.colors.slow-.75/ .35/120)));w.input.down=down;w.brush.cancel();
    for(const color of ['red','blue','purple']){__prep(color);__spawn(400,650);__resolve(__line([200,500],[600,800]));__step(1);check(`墨刃${color}只有70`,events().length===1&&events()[0].amount===70);}
    return {checks,matrix};
  });report.checks.push(...result.checks);report.matrix=result.matrix;
  const step=seconds=>page.evaluate(s=>__step(s),seconds);
  const point=async(x,y)=>page.evaluate(({x,y})=>{const r=__game.r.playCss;return{x:r.x+x*r.w/900,y:r.y+y*r.h/1200};},{x,y});
  const move=async(x,y)=>{const p=await point(x,y);await page.mouse.move(p.x,p.y);};
  const draw=async points=>{await move(...points[0]);await page.mouse.down({button:'right'});await step(1/120);for(const p of points.slice(1)){await move(...p);await step(1/120);}await page.mouse.up({button:'right'});await step(1/120);};
  for(const distance of [39,40,119,120,121]){await page.evaluate(()=>__prep());await draw([[200,400],[200+distance,400]]);const protection=await page.evaluate(()=>__game.world.brush.protectionRemaining);assert.equal(protection>0,distance>=120);report.checks.push(`真实右键${distance}px保护=${protection>0}`);}
  await page.evaluate(()=>{__prep();const w=__game.world;w.companions.setRoster(['chiyan']);const s=w.companions.team[0];s.x=475;s.y=1050;s.cooldown=99;});await draw([[474,1050],[650,850]]);assert.equal(await page.evaluate(()=>__game.world.brush.lastForm),'赤燕航迹');report.checks.push('起笔重叠50px内取最近伙伴');
  await page.evaluate(()=>{__prep();__resolve(__circle());});await move(200,400);await page.mouse.down({button:'middle'});await step(1/120);await page.mouse.up({button:'middle'});await draw([[200,400],[650,450]]);assert.equal(await page.evaluate(()=>__game.world.brush.strokes.at(-1).color),'blue');assert.equal(await page.evaluate(()=>__game.world.brush.active),false);report.checks.push('顿帧期间中键换色、右键开始/移动/松手均接收');
  const shot=async(name,advance=.01)=>{await step(advance);await page.evaluate(()=>__game.render());await new Promise(r=>setTimeout(r,260));const path=`${out}/${name}.png`;await page.screenshot({path});report.screenshots.push(path);};
  for(const color of ['red','blue','purple']){
    await page.evaluate(color=>{__prep(color);__spawn(395,600,190,.65);__spawn(500,610,190,.65);__release(__circle(450,600,125));},color);
    await shot(`seal-${color}-impact`,0);await shot(`seal-${color}-slow`,.2);await shot(`seal-${color}-shatter`,1.8);
    await page.evaluate(color=>{__prep(color);__spawn(420,550);__spawn(510,560);__spawn(390,700);__spawn(510,700);__release(__line([200,700],[700,700]));},color);await shot(`wall-${color}`,color==='blue'?.1:.04);
    await page.evaluate(color=>{__prep(color);__spawn(450,580);__spawn(410,580);__spawn(490,580);__spawn(535,460);__release(__line([450,850],[450,450]));},color);await shot(`spear-${color}`,color==='red'?.26:.16);
    await page.evaluate(color=>{__prep(color);__spawn(450,700);__spawn(530,700);__spawn(530,500);__spawn(450,300);__release(__line([450,1050],[450,500]),'player');},color);await shot(`arrows-${color}`,color==='purple'?.9:.5);
  }
  await page.evaluate(()=>{__prep('red');const e=__spawn(450,600,14);e.maxHp=14;__release(__circle());});await shot('bee-seal-kill',.02);
  await page.evaluate(()=>{__prep('blue');for(const x of [390,510]){const e=__spawn(x,600,85,.7,'e_turtle',22);e.maxHp=85;}__release(__circle(450,600,135));});await shot('armored-seal-85',.25);
  await page.evaluate(()=>{__prep('blue');const w=__game.world,body=w.spawn({sprite:'tq-body',hp:700,noCollide:true,invulnerable:true},450,380);body.phaseLock=true;const e=w.spawn({sprite:'tq-controller',hp:700,noCollide:true,radius:28},450,500);e.hp=e.maxHp=700;e.data.bossOwner=body;e.charging=true;__release(__circle(450,500,115));});await shot('boss-seal',.2);
  await page.evaluate(()=>{__prep();for(const [i,color] of ['red','blue','purple'].entries()){__game.world.player.weapon=color;__spawn(400,350+i*240);__release(__line([200,200+i*240],[650,530+i*240]));}});await shot('blade-three-colors',.04);
  await page.evaluate(()=>{__prep('purple');__spawn();});await shot('nested-before',0);await page.evaluate(()=>__release([...__circle(450,600,95),...__circle(450,600,80),...__circle(450,600,65)]));await shot('nested-after',.05);
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.complete=true;
}catch(e){report.failure=e.stack;throw e;}finally{writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({checks:report.checks.length,matrix:report.matrix.length,screenshots:report.screenshots.length,complete:report.complete,errors:report.errors}));
