// P3-13：真实游戏页面的矩形导出、两种视口截图及 UI 状态组合检查。
// 用法：node tools/p3-13-layout.mjs [当前URL] [V1 URL]；V1 没有测试入口，以标题作对照。
// 组合状态通过现有 World / UI 接口注入，仅用于布局验证；自然流程截图单独保存。
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const out='local-source/P3-13-evidence';
const [base='http://127.0.0.1:5179/',v1='http://127.0.0.1:5182/']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const records=[],checks=[],errors=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function record(page,version,size,scene) {
 const data=await page.evaluate(()=>{
  const visible=e=>{for(let p=e;p;p=p.parentElement){const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden'||+c.opacity===0)return false;}return !!e.getClientRects().length;};
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const nodes=[...document.querySelectorAll('.ik *')].map((e,i)=>({index:i,tag:e.tagName,classes:e.getAttribute('class'),key:e.getAttribute('data-k'),text:e.children.length?null:e.textContent,fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,visible:visible(e),...rect(e)}));
  const get=s=>[...document.querySelectorAll(s)].filter(visible).map(e=>({selector:e.tagName.toLowerCase()+'.'+e.className,text:e.textContent,fontSize:parseFloat(getComputedStyle(e).fontSize),...rect(e)}));
  const menu=get('.scr.on .menu .mi'), labels=get('.scr.on .menu .mi .ml');
  const l=get('.host.l .hud > .blk,.host.l .combat-status,.presentation-dock,.keyhost .keys');
  const r=get('.host.r .hud > *,.moves-dock');
  const regions=get('.host.l .hud,.host.r .hud,.moves-dock,.presentation-dock,.keyhost .keys,.move-unlock').filter(r=>r.text.trim());
  const modal=get('.scr.on .panel,.scr.on .title-menu,.scr.on .menu .mi');
  const blocks=['l','r'].flatMap(side=>get(`.host.${side} .hud > *`).filter(b=>b.text.trim()).map(b=>({...b,side})));
  return {viewport:{width:innerWidth,height:innerHeight},compact:document.querySelector('.ik').classList.contains('compact'),nodes,l,r,regions,modal,blocks,menu,labels,movesVisible:get('.moves-dock').length};
 });
 records.push({version,size,scene,...data});
 if(version==='current'){
  const add=(name,pass,details)=>checks.push({size,scene,name,pass,details});
  if(scene==='battle'||scene==='states'){
   if(data.compact)add('竖屏出招表及底纹隐藏',data.movesVisible===0,data.movesVisible);
   else for(const [side,rs] of [['左',data.l],['右',data.r]]){
    const xs=rs.map(r=>r.x),ws=rs.map(r=>r.width);
    add(`${side}列左边差≤1px`,Math.max(...xs)-Math.min(...xs)<=1,{xs});
    add(`${side}列宽差≤1px`,Math.max(...ws)-Math.min(...ws)<=1,{ws});
   }
   const overlap=[];
   if(!data.compact)for(let i=0;i<data.regions.length;i++)for(let j=i+1;j<data.regions.length;j++){
    const a=data.regions[i],b=data.regions[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)overlap.push([a.selector,b.selector]);
   }
   add('独立 HUD 区域无重叠',overlap.length===0,overlap);
   const spills=data.regions.filter(r=>r.x<-.5||r.y<-.5||r.right>data.viewport.width+.5||r.bottom>data.viewport.height+.5);
   add('HUD 不溢出视口',spills.length===0,spills);
   for(const side of ['l','r']){const blocks=data.blocks.filter(b=>b.side===side),hits=[];for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){const a=blocks[i],b=blocks[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)hits.push([a.selector,b.selector]);}add(`${side}栏内容块无重叠`,hits.length===0,hits);}
   if(scene==='states'){add('新招提示实际出现',data.nodes.some(n=>n.classes==='move-unlock'&&n.visible&&n.text?.includes('伙伴合击')),null);}
  }else{
   const xs=data.labels.map(r=>r.x),gaps=data.menu.slice(1).map((r,i)=>r.y-data.menu[i].bottom);
   add('菜单字号一致',new Set(data.labels.map(r=>r.fontSize)).size===1,data.labels.map(r=>r.fontSize));
   add('菜单文字左边差≤1px',Math.max(...xs)-Math.min(...xs)<=1,{xs});
   add('菜单行间距差≤1px',Math.max(...gaps)-Math.min(...gaps)<=1,{gaps});
   add('菜单行无重叠',gaps.every(g=>g>=-.5),{gaps});
   const spills=data.modal.filter(r=>r.x<-.5||r.y<-.5||r.right>data.viewport.width+.5||r.bottom>data.viewport.height+.5);
   add('菜单不溢出视口',spills.length===0,spills);
  }
 }
 await page.screenshot({path:`${out}/${version}-${size}-${scene}.png`});
}
try{
 for(const [version,url] of [['current',base],['v1',v1]])for(const [w,h] of [[900,1200],[1600,900]]){
  const size=`${w}x${h}`,page=await browser.newPage();await page.setViewport({width:w,height:h});
  page.on('pageerror',e=>errors.push({version,size,message:e.message}));
  await page.goto(url+'?god=1',{waitUntil:'load'});await page.waitForFunction('window.__game?.state === "title"',{timeout:60000});await wait(version==='v1'?3500:1600);await record(page,version,size,'title');
  await page.evaluate(()=>window.__game.onStart());await wait(2500);await record(page,version,size,'battle');
  await page.keyboard.press('Escape');await wait(600);await record(page,version,size,'pause');
  if(version==='current'){
   await page.evaluate(()=>{window.requestAnimationFrame=()=>0;window.__game.state='paused';});await wait(100);
   await page.evaluate(()=>{const g=window.__game;g.ui.screen('none');const w=g.world;w.companions.setRoster([]);g.ui.hud(w.hud(60),true);w.companions.setRoster(['chiyan','laodun']);w.unlockBrush('横');w.unlockBrush('竖');const s=w.hud(60);s.brushMethods=['横','竖','点','折','钩','撇捺'];s.companions.forEach(p=>{p.active=3;p.count=2;});s.passives=[{id:'T1',name:'贯穿',icon:'贯',timer:0,triggers:0},{id:'W2',name:'连击',icon:'连',timer:0,triggers:0},{id:'I2',name:'余墨',icon:'墨',timer:0,triggers:0}];s.brushActive=true;s.brushProtection=2.8;g.ui.hud(s,true);g.ui.popup(450,600,'外甲松动','chain','armor:fixture');});
   await wait(430);await record(page,version,size,'states');
   await wait(2750);const expired=await page.evaluate(()=>document.querySelector('.move-unlock').hidden);checks.push({size,scene:'states',name:'解锁提示3秒后移除',pass:expired,details:expired});
   await page.evaluate(()=>{const g=window.__game;g.ui.hud(g.world.hud(60),false);g.ui.screen('pause',{});});await wait(500);
   await page.evaluate(()=>[...document.querySelectorAll('.mi')].find(e=>e.textContent.includes('出招表')).click());await wait(400);await page.screenshot({path:`${out}/current-${size}-book.png`});
   await page.evaluate(()=>{const g=window.__game;g.toTitle();g.ui.hud(g.world.hud(60),false);g.ui.screen('test');});await wait(500);await record(page,version,size,'test');
  }else{await page.evaluate(()=>window.__game.toTitle());await wait(3500);await record(page,version,size,'test');}
  await page.close();
 }
 writeFileSync(`${out}/rects.json`,JSON.stringify({checks,errors,records},null,2));
 writeFileSync(`${out}/checks.json`,JSON.stringify({total:checks.length,passed:checks.filter(c=>c.pass).length,errors,checks},null,2));
 // 两版原始截图并排呈现；V1 缺少测试入口，保留标题作功能基准。
 const page=await browser.newPage();
 for(const [w,h] of [[900,1200],[1600,900]])for(const scene of ['title','battle','pause','test']){
  const size=`${w}x${h}`,images=['v1','current'].map(v=>`data:image/png;base64,${readFileSync(`${out}/${v}-${size}-${scene}.png`).toString('base64')}`);
  await page.setViewport({width:w*2,height:h+44});await page.setContent(`<style>body{margin:0;background:#17120f;color:#efe6d2;font:20px sans-serif}.labels{display:flex;height:44px;align-items:center}.labels div{width:50%;padding-left:20px}img{width:${w}px;height:${h}px;vertical-align:top}</style><div class="labels"><div>V1${scene==='test'?'（无测试入口）':''}</div><div>P3-13 · ${scene} · ${size}</div></div><img src="${images[0]}"><img src="${images[1]}">`);await page.screenshot({path:`${out}/compare-${size}-${scene}.png`});
 }
 await page.close();
 console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),errors},null,2));
 if(checks.some(c=>!c.pass)||errors.length)process.exitCode=1;
}finally{await browser.close();}
