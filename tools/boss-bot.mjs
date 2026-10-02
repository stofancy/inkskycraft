// 共用自动驾驶只给输入，不直接结算破招或改 HP；笔画经过逐按钮鼠标事件/识别。
export function bossInput(g,s){
 const w=g.world,q=w.bossCombat.qte,inp=g.input,F=window.__forced;
 if(!q){const b=w.bossE;if(b?.data.copperSimple&&!b.data.sealWindow){
  const r=b.data.rig,t=b.data.phaseIndex===2?(b.data.paperSimple?r.claws.find(a=>!a.broken)?.part:r.wings.find(a=>!a.broken)?.lock):b.data.phaseIndex===3?r.controller:r.core;
  if(t){const y=b.data.paperSimple?Math.max(500,Math.min(850,t.y+330)):850;inp.axisX=Math.max(-1,Math.min(1,(t.x-w.player.x)/40));inp.axisY=Math.max(-1,Math.min(1,(y-w.player.y)/80));F.held.add('shoot');}
 }if(s.paint){const r=g.r.playCss;document.querySelector('#gl').dispatchEvent(new MouseEvent('mouseup',{clientX:r.x+r.w*.5,clientY:r.y+r.h*.5,button:2,buttons:0,bubbles:true}));s.paint=null;}s.id=null;return;}
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
