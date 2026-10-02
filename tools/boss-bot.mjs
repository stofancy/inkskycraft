// 共用自动驾驶只给输入，不直接结算破招或改 HP；笔画经过逐按钮鼠标事件/识别。
export function bossInput(g,s){
 const w=g.world,q=w.bossCombat.qte,inp=g.input,F=window.__forced;
 if(!q){
  const owner=e=>e.data.bossOwner??w.bossCombat.owner(e);
  const candidates=w.enemies.filter(e=>{
   const target=e.data.damageTarget??e,b=owner(e);
   if(!w.targetable(e)||target.hp<=0||target.invulnerable||b?.invulnerable)return false;
   // 纸甲转伤由当前开合状态控制；独立血量的部件仍可直接受击。
   if(b?.data.paperSimple){
    if(e.data.paperSubmerged||e.x<35||e.x>865||e.y<60||e.y>1090)return false;
    if((e===b||target!==e)&&!e.data.paperOpen)return false;
   }
   return w.fodder?.canDamage(e,w.player.weapon)!==false&&w.chapter2?.damageAllowed(e,w.player.weapon)!==false;
  });
  // 优先独立受击部件与开放弱点，距离打破同级平局；图片名和挂点名不参与。
  const rank=e=>(owner(e)?1000:0)+(e.data.paperOpen?300:0)+(e.data.damageTarget===e?400:0)+(e.data.hitArmor===false?100:0)+(e.def.hitPriority??0)-Math.abs(e.x-w.player.x)*.05-(owner(e)?.data.paperSimple?Math.hypot(e.x-w.player.x,e.y+140-w.player.y)*.1:0);
  candidates.sort((a,b)=>rank(b)-rank(a));
  const t=candidates[0];s.target=t??null;
  if(t){
   const paper=owner(t)?.data.paperSimple,old=s.aim,dt=old&&old.id===t.id?w.real-old.time:0;
   const lead=paper&&dt>0&&dt<.1?.06:0;
   const x=t.x+(lead?Math.max(-180,Math.min(180,(t.x-old.x)/dt))*lead:0);
   const y=Math.max(paper?90:180,Math.min(paper?1170:1050,t.y+(paper&&w.player.weapon==='purple'?35:140)));
   // 紫雷自动选最近目标：贴近开放灯芯，避免先锁住相邻闭合纸甲。
   // 执笔只交付稳定落点；追赶中的横划会白耗墨并中断主炮。
   if(paper){
    const vy=old&&dt>0?(t.y-old.y)/dt:0,vx=old&&dt>0?(t.x-old.x)/dt:0;
    const exposure=owner(t).data.rig?.exposure,left=exposure?3.5-(w.bossCombat.clock-exposure.at):0;
    if(!dt||Math.hypot(vx,vy)>75||t.data.paperOpen&&left<.8)s.target=null;
   }
   inp.axisX=Math.max(-1,Math.min(1,(x-w.player.x)/35));inp.axisY=Math.max(-1,Math.min(1,(y-w.player.y)/60));F.held.add('shoot');
   s.aim={id:t.id,x:t.x,y:t.y,time:w.real};
  }
 if(s.paint){const r=g.r.playCss;document.querySelector('#gl').dispatchEvent(new MouseEvent('mouseup',{clientX:r.x+r.w*.5,clientY:r.y+r.h*.5,button:2,buttons:0,bubbles:true}));s.paint=null;}s.id=null;return;}
 const pointer=(type,x,y,button=2)=>{const r=g.r.playCss;document.querySelector('#gl').dispatchEvent(new MouseEvent(type,{clientX:r.x+x*r.w/900,clientY:r.y+y*r.h/1200,button,buttons:type==='mouseup'?0:button===0?1:2,bubbles:true}));};
 if(q.state!=='window')return;if(s.id!==q.id){s.id=q.id;s.paint=null;s.started=false;s.completed=false;s.wait=s.delay??.7;}
 if(q.age<s.wait||s.completed)return;
 if(q.command==='色击'){
  if(w.player.weapon!==q.color)F.pressed.add('weapon');else if(!s.started){s.started=true;pointer('mousedown',q.target.x,q.target.y,0);}else pointer('mouseup',q.target.x,q.target.y,0);
 }else if(q.command==='翻滚'){
  inp.axisX=q.band.x>=450?-1:1;inp.axisY=0;if(!s.started){F.pressed.add('roll');s.started=true;}
 }else {
  const x=q.target.x,y=q.target.y,rad=q.target.radius*1.45;
  if(!s.paint){s.paint={frame:0,x,y,rad};pointer('mousedown',q.command==='封'?x+rad:q.command==='竖'?x:x-160,q.command==='封'?y:q.command==='竖'?y+160:y);}
  const f=s.paint.frame++,t=Math.min(1,f/45);
  if(q.command==='封')pointer('pointermove',x+Math.cos(t*Math.PI*2)*rad,y+Math.sin(t*Math.PI*2)*rad);
  else if(q.command==='竖')pointer('pointermove',x,y+160-320*t);
  else pointer('pointermove',x-160+320*t,y);
  if(f>=45){pointer('mouseup',q.command==='封'?x+rad:q.command==='竖'?x:x+160,q.command==='封'?y:q.command==='竖'?y-160:y);s.paint=null;s.completed=true;}
 }
}
export function installBossInput(g){const inp=g.input,pressed=inp.pressed.bind(inp),down=inp.down.bind(inp),consume=inp.consume.bind(inp);
 window.__forced={pressed:new Set(),held:new Set()};inp.pressed=a=>window.__forced.pressed.has(a)||pressed(a);inp.down=a=>window.__forced.held.has(a)||down(a);inp.consume=a=>{window.__forced.pressed.delete(a);consume(a);};
}
