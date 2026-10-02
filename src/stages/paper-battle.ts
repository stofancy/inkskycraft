import type { World } from '../game/world';
import type { Enemy } from '../game/enemy';
import { segDist2 } from '../core/math';

type Point={x:number;y:number};
type Move='bite'|'claw'|'tail'|'fire'|'cloud'|'wall'|'coil';
interface Rig {bodies:Enemy[];tail:Enemy;claws:{part:Enemy;broken:boolean;side:number}[];open:boolean}
interface Cover {part:Enemy;rx:number;ry:number;broken:boolean}
const PI=Math.PI,clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const mix=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
const names:Record<Move,string>={bite:'龙口吞噬',claw:'龙爪拍山',tail:'龙尾横扫',fire:'灯节吐火',cloud:'潜云扑食',wall:'游龙断路',coil:'盘身收圈'};

/** 纸龙的身体招式与战场掩体；绘制只复用图集与 SVG。 */
export class PaperBattle {
 move:Move='claw';age=0;round=0;phase=0;enabled=false;shadow=false;
 target:Point={x:450,y:760};from:Point={x:450,y:250};launch:Point={x:450,y:250};
 gap=450;warn=1.15;wind=1.5;strike=1.4;rest=2.2;fired=false;slammed=false;shot=0;
 claw:Enemy|null=null;covers:Cover[]=[];rubble:{part:Enemy;at:number;x:number;y:number;vx:number}[]=[];
 release:Enemy[]=[];releaseT=0;
 impacts:{x:number;y:number;at:number}[]=[];blocked=0;destroyed=0;clock=0;
 constructor(readonly w:World,readonly head:Enemy,readonly rig:Rig){
  for(const [sprite,x,y,scale,rx,ry] of [
   ['sky_rock-large-pine',205,520,1.1,86,100],['sky_rock-large-root',720,680,1.15,82,95],
   ['sky_rock-medium-vine',210,925,1.5,75,95],['sky_low-bridge',610,420,.48,190,42],
  ] as [string,number,number,number,number,number][]){
   const p=w.spawn({sprite,hp:1,decorative:true,noCollide:true,drawOrder:-40},x,y);
   p.scaleX=p.scaleY=scale;p.glow=0;p.data.contentRole='prop';this.covers.push({part:p,rx,ry,broken:false});
  }
  this.release=[-1,1].map(side=>{const p=w.spawn({sprite:'e_kite',hp:1,decorative:true,noCollide:true,drawOrder:8},30,320+side*170);p.scaleX=p.scaleY=.7;p.glow=0;return p;});
  head.data.paperBattle=this;
 }
 entrance(t:number){this.releaseT=t;this.release.forEach((p,i)=>{p.x=this.head.x+220;p.y=this.head.y+(i?170:-170);p.angle=PI/2;p.alpha=1-smooth((t-.78)/.22);});}
 get active(){return this.enabled&&this.age>=this.wind+this.warn&&this.age<this.wind+this.warn+this.strike;}
 get warning(){return this.enabled&&this.age>=this.wind&&this.age<this.wind+this.warn;}
 get progress(){return clamp((this.age-this.wind-this.warn)/this.strike);}
 start(phase:number){
  this.phase=phase;this.age=0;this.fired=false;this.slammed=false;this.shot=0;this.shadow=false;
  const sequence:Move[]=phase===1?['claw','fire','bite','tail','cloud']:phase===2?['claw','wall','tail','coil','cloud','fire','bite']:['coil','wall','cloud','fire','bite','tail'];
  this.move=sequence[this.round++%sequence.length];
  this.from={x:this.head.x,y:this.head.y};this.gap=this.round%2?330:590;
  const ship=this.w.escort?.vessels[0],p=this.round%2===0&&ship?ship:this.w.player;
  this.target={x:clamp(p.x,120,780),y:clamp(p.y,580,1040)};
  // 首次拍击明确展示掩体碎裂，其后可以引诱纸龙攻击剩下的掩体。
  if(this.move==='claw'){
   const cover=this.covers.find(c=>!c.broken);
   if(cover)this.target={x:cover.part.x,y:cover.part.y};
  }
  this.launch=this.move==='cloud'?{x:this.round%2?50:850,y:1280}:
   this.move==='wall'?{x:-130,y:230}:this.move==='tail'?{x:780,y:490}:
   this.move==='coil'?{x:760,y:650}:{x:clamp(this.target.x+(this.round%2?-180:180),160,740),y:240};
  this.claw=this.rig.claws.find(c=>!c.broken)?.part??null;
  this.strike=this.move==='wall'?2.7:this.move==='coil'?3.5:this.move==='tail'?2:1.4;
  this.head.data.action=names[this.move];
 }
 tick(dt:number){
  this.clock=this.w.bossCombat.clock;
  this.updateTerrain();
  if(!this.enabled||dt<=0)return;
  const phase=this.head.data.phaseIndex??1;
  if(this.phase!==phase||this.age>=this.wind+this.warn+this.strike+this.rest)this.start(phase);
  this.age+=dt;
  const h=this.head,old={x:h.x,y:h.y},mouthBefore=h.anchor('mouth'),t=this.age,p=this.progress;
  let pos:Point;
  if(t<this.wind){
   const k=smooth(t/this.wind),control={x:clamp((this.from.x+this.launch.x)/2+(this.round%2?210:-210),30,870),y:Math.min(1080,Math.max(this.from.y,this.launch.y)+230)};
   pos=mix(mix(this.from,control,k),mix(control,this.launch,k),k);
  }
  else if(t<this.wind+this.warn)pos=this.launch;
  else if(this.active){
   if(this.move==='bite'||this.move==='cloud')pos=mix(this.launch,this.target,smooth(p));
   else if(this.move==='wall')pos={x:-130+1160*p,y:230+620*p};
   else if(this.move==='coil'){const a=p*PI*1.8,r=310-105*p;pos={x:450+Math.cos(a)*r,y:650+Math.sin(a)*r};}
   else if(this.move==='tail')pos={x:780-600*p,y:490-170*Math.sin(p*PI)};
   else pos=this.launch;
  }else{
   const k=smooth((t-this.wind-this.warn-this.strike)/this.rest);
   const dest={x:this.round%2?230:670,y:260},end=this.finish();
   const control={x:this.round%2?40:860,y:Math.max(480,end.y+180)};
   pos=mix(mix(end,control,k),mix(control,dest,k),k);
  }
  h.x=pos.x;h.y=pos.y;
  const d=Math.hypot(h.x-old.x,h.y-old.y);
  if(d>.3){const angle=Math.atan2(h.y-old.y,h.x-old.x)-PI/2;h.angle+=Math.atan2(Math.sin(angle-h.angle),Math.cos(angle-h.angle))*Math.min(1,dt*9);}
  if(this.warning&&(this.move==='bite'||this.move==='cloud'))h.angle=Math.atan2(this.target.y-h.y,this.target.x-h.x)-PI/2;
  this.rig.open=(this.move==='bite'||this.move==='cloud')&&(this.warning||this.active);
  h.frame=this.rig.open?2:0;h.mirror=false;
  this.shadow=this.move==='cloud'&&t<this.wind+this.warn-.35;
  const alpha=this.shadow?.19:1;
  for(const part of [h,...this.rig.bodies,this.rig.tail]){part.alpha=alpha;part.tint=this.shadow?[.24,.35,.38]:[1,1,1];part.data.paperSubmerged=this.shadow;}
  if(this.active&&!this.fired){
   this.fired=true;this.w.audio.sfx('warning');
   if(this.move==='fire')this.w.fx.shockwave(h.x,h.y,130,.3,.5);
  }
  if(this.active&&(this.move==='bite'||this.move==='cloud')){
   const mouth=h.anchor('mouth');this.crash(mouth.x,mouth.y,65);this.hitSegment(mouthBefore,mouth,58);
  }else if(this.active&&this.move==='wall'){this.crash(h.x,h.y,80);this.hitSegment(old,h,64);}
  if(this.active&&this.move==='fire'&&this.clock>=this.shot){
   this.shot=this.clock+.38;
   for(const b of this.rig.bodies.filter(b=>b.data.paperOpen)){
    const a=Math.atan2(this.target.y-b.y,this.target.x-b.x);
    for(const offset of [-.3,0,.3])this.w.shoot(b.x,b.y,a+offset,180,{shape:'flame',color:'amber',size:14,life:4,attack:'纸龙灯火',update:bullet=>this.block(bullet)});
   }
  }
 }
 finish():Point {
  if(this.move==='bite'||this.move==='cloud')return this.target;
  if(this.move==='wall')return {x:1030,y:850};
  if(this.move==='coil')return {x:450+Math.cos(PI*1.8)*205,y:650+Math.sin(PI*1.8)*205};
  if(this.move==='tail')return {x:180,y:490};
  return this.launch;
 }
 /** 骨架同步后调用，让爪、尾和长身的危险范围与画面一致。 */
 pose(){
  if(!this.enabled)return;
  const t=this.age,begin=this.wind+this.warn,p=this.progress;
  if(this.move==='claw'&&this.claw?.parent&&!this.rig.claws.find(c=>c.part===this.claw)?.broken){
   const c=this.claw,k=t<this.wind?smooth(t/this.wind):t<begin?1:t<begin+.24?1-smooth((t-begin)/.24):0;
   const grow=t<begin?clamp(t/this.wind):1-clamp((t-begin-.7)/.7);
   c.scaleX=c.scaleY=1.35*(1+1.5*grow);
   const parent=c.parent!;
   c.angle=-.18;
   const tip=c.local(0,40),root=c.local(...c.jointRoot);
   const aim={x:this.target.x-(tip.x-root.x),y:this.target.y-160*k-(tip.y-root.y)};
   if(t<begin+1.4){
    // 把世界落点转回父体局部挂点，正常骨架更新仍可重现此姿态。
    const dx=aim.x-parent.x,dy=aim.y-parent.y,co=Math.cos(parent.angle),si=Math.sin(parent.angle);
    c.offX=(dx*co+dy*si)/parent.scaleX;c.offY=(-dx*si+dy*co)/parent.scaleY;
    c.followRot=false;c.angle=-.18;c.syncToParent();
   }
   if(this.active&&p>.18&&!this.slammed){
    this.slammed=true;const {x,y}=this.target;this.impacts.push({x,y,at:this.clock});this.crash(x,y,155);
    this.w.fx.shockwave(x,y,260,.8,.7);this.w.fx.burst(x,y,40,260,[1.5,1.25,.8]);this.w.fx.shake(.22);this.w.hitstop(.09);
    this.hitCircle(x,y,112);
   }
  }
  if(this.move==='tail'&&t>=this.wind){
   // 连续关节链甩向落点；定长约束保持铜套管衔接。
   const recovering=clamp((t-begin-this.strike)/this.rest),natural=this.rig.tail.anchor('root');
   const end=mix({x:this.warning?80:80+740*p,y:820},natural,smooth(recovering)),neck=this.head.anchor('neck');
   const lengths=this.rig.bodies.map(b=>(b.info.anchors.jointOut[1]-b.info.anchors.jointIn[1])*b.scaleY);
   const joints:Point[]=[neck];
   for(let i=1;i<=10;i++){const k=i/10,u=1-k;joints.push({x:u*u*u*neck.x+3*u*u*k*860+3*u*k*k*860+k*k*k*end.x,y:u*u*u*neck.y+3*u*u*k*300+3*u*k*k*940+k*k*k*end.y});}
   const lengthen=(origin:Point,to:Point,len:number)=>{const d=Math.hypot(to.x-origin.x,to.y-origin.y)||1;return{x:origin.x+(to.x-origin.x)*len/d,y:origin.y+(to.y-origin.y)*len/d};};
   for(let pass=0;pass<12;pass++){
    joints[10]=end;
    for(let i=9;i>=0;i--)joints[i]=lengthen(joints[i+1],joints[i],lengths[i]);
    joints[0]=neck;
    for(let i=0;i<10;i++)joints[i+1]=lengthen(joints[i],joints[i+1],lengths[i]);
   }
   this.rig.bodies.forEach((b,i)=>{const a=joints[i],z=joints[i+1];b.angle=Math.atan2(z.y-a.y,z.x-a.x)-PI/2;b.x=a.x;b.y=a.y;const root=b.local(...b.info.anchors.jointIn);b.x+=a.x-root.x;b.y+=a.y-root.y;});
   this.rig.tail.syncToParent();this.rig.tail.scaleX=this.rig.tail.scaleY=2;
   for(const b of [...this.rig.bodies.slice(6),this.rig.tail]){
    const safe=Math.abs(b.x-this.gap)<85;b.alpha=safe?.18:1;
    if(this.active&&!safe&&Math.abs(this.w.player.x-this.gap)>75)this.hitCircle(b.x,b.y,46);
   }
   if(this.active)this.crash(this.rig.tail.x,this.rig.tail.y,70);
  }else this.rig.tail.scaleX=this.rig.tail.scaleY=1.5;
  if((this.move==='wall'||this.move==='coil')&&this.active){
   this.rig.bodies.forEach((b,i)=>{
    const gap=i===4||i===5;b.alpha=gap?.15:1;
    if(!gap){this.hitCircle(b.x,b.y,43*b.scaleX);this.crash(b.x,b.y,45);}
   });
  }
  for(const part of [this.head,...this.rig.bodies,this.rig.tail,...(this.phase<3?this.rig.claws.filter(c=>!c.broken).map(c=>c.part):[])]){
   part.data.paperSubmerged=this.shadow;
   if(this.shadow){part.alpha=.19;part.tint=[.24,.35,.38];part.glow=0;}
   else if(part.def.sprite==='pd-claw'){part.alpha=1;part.tint=[1,1,1];}
  }
  for(const wave of this.impacts){
   const age=this.clock-wave.at,radius=age*260;
   if(age>0&&age<.9&&Math.abs(Math.hypot(this.w.player.x-wave.x,this.w.player.y-wave.y)-radius)<14)this.hitCircle(this.w.player.x,this.w.player.y,1);
  }
 }
 hitCircle(x:number,y:number,r:number){this.hitSegment({x,y},{x,y},r);}
 hitSegment(a:Point,b:Point,r:number){
  const p=this.w.player;
  if(p.locked||this.w.bossCombat.freeze||this.w.dialoguePaused)return;
  if(segDist2(p.x,p.y,a.x,a.y,b.x,b.y)<r*r&&p.invuln<=0&&!this.w.brush.protected)p.hit();
  if(this.move==='bite'||this.move==='cloud'){
   const ship=this.w.escort?.vessels[0];
   if(ship&&segDist2(ship.x,ship.y,a.x,a.y,b.x,b.y)<(r+30)**2&&this.clock>=(this.head.data.nextBiteShip??0)){
    this.head.data.nextBiteShip=this.clock+3;this.w.escort!.durability=Math.max(1,this.w.escort!.durability-8);this.w.fx.burst(ship.x,ship.y,16,130,[1.5,.7,.25]);
   }
  }
 }
 block(b:{x:number;y:number;prevX:number;prevY:number;dead:boolean;radius:number}){
  for(const c of this.covers)if(!c.broken){
   // 椭圆归一化后的线段检测，低帧率下也挡住穿过掩体的子弹。
   if(segDist2(0,0,(b.prevX-c.part.x)/c.rx,(b.prevY-c.part.y)/c.ry,(b.x-c.part.x)/c.rx,(b.y-c.part.y)/c.ry)<1){b.dead=true;this.blocked++;return false;}
  }
 }
 crash(x:number,y:number,r:number){
  for(const c of this.covers)if(!c.broken&&((x-c.part.x)/(c.rx+r))**2+((y-c.part.y)/(c.ry+r))**2<1)this.breakCover(c);
 }
 breakCover(c:Cover){
  c.broken=true;c.part.alpha=0;this.destroyed++;
  const {x,y}=c.part;this.w.fx.burst(x,y,38,270,[.85,.79,.6]);this.w.fx.shockwave(x,y,200,.5,.7);this.w.fx.shake(.15);
  for(let i=0;i<7;i++){
   const p=this.w.spawn({sprite:'sky_rock-small-shard',hp:1,decorative:true,noCollide:true,drawOrder:10},x+(i-3)*18,y);
   p.scaleX=p.scaleY=.32+(i%3)*.12;p.glow=0;p.data.contentRole='prop';this.rubble.push({part:p,at:this.clock,x:p.x,y:p.y,vx:(i-3)*48});
  }
 }
 updateTerrain(){
  // 已飞出的敌弹也受掩体保护；新灯火在子弹移动回调里检查。
  for(const b of this.w.bullets.list)if(!b.dead)this.block(b);
  this.rubble=this.rubble.filter(r=>{
   const t=this.clock-r.at,p=r.part;if(t>4||p.dead){if(!p.dead)this.w.remove(p);return false;}
   p.x=r.x+r.vx*t;p.y=r.y-100*t+135*t*t;p.angle=t*r.vx*.025;
   if(t>.55)this.hitCircle(p.x,p.y,19);return true;
  });
  this.impacts=this.impacts.filter(i=>this.clock-i.at<1.1);
 }
 svg():string {
  let s='';
  const text=(x:number,y:number,v:string,col='#ffdf9b')=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="23" font-weight="bold" fill="${col}" stroke="#272326" stroke-width="5" paint-order="stroke">${v}</text>`;
  if(this.releaseT<1)for(const p of this.release){s+=`<path d="M${this.head.x} ${this.head.y}Q${(this.head.x+p.x)/2} ${p.y+50} ${p.x} ${p.y}" fill="none" stroke="#dfbf83" stroke-width="2" opacity="${p.alpha*.8}"/>`;}
  if(this.warning){
   const {x,y}=this.target;
   if(this.move==='claw')s+=`<ellipse cx="${x}" cy="${y}" rx="118" ry="90" fill="#b746252a" stroke="#ffe0a0" stroke-width="4" stroke-dasharray="13 8"/><ellipse cx="${x}" cy="${y}" rx="${118*(1-(this.age-this.wind)/this.warn)}" ry="${90*(1-(this.age-this.wind)/this.warn)}" fill="none" stroke="#ee6a36" stroke-width="5"/>`+text(x,y+128,'龙爪将落 · 离开石台');
   else if(this.move==='bite'||this.move==='cloud')s+=`<path d="M${this.head.x} ${this.head.y}L${x} ${y}" stroke="#eb8359" stroke-width="100" opacity=".17"/><path d="M${this.head.x} ${this.head.y}L${x} ${y}" stroke="#ffce94" stroke-width="3" stroke-dasharray="15 13"/><circle cx="${x}" cy="${y}" r="64" fill="none" stroke="#ffbd72" stroke-width="3"/>`+text(x,y+100,'龙口锁定 · 横移躲开');
   else if(this.move==='fire'){
    for(const b of this.rig.bodies.filter(b=>b.data.paperOpen))s+=`<circle cx="${b.x}" cy="${b.y}" r="62" fill="#f3923520" stroke="#ffc578" stroke-width="3"/>`;
    s+=text(450,570,'灯火将喷 · 借浮石遮挡');
   }else if(this.move==='wall'||this.move==='coil')s+=`<path d="${this.move==='wall'?'M0 230L900 850':'M760 650A310 310 0 1 1 450 340'}" fill="none" stroke="#dd9a61" stroke-width="90" opacity=".2"/>`+text(450,570,'龙身将合 · 看准云中缺口');
  }
  if(this.move==='tail'&&(this.warning||this.active)){
   s+=`<path d="M0 860H${this.gap-75}M${this.gap+75} 860H900" stroke="#ee9c65" stroke-width="92" opacity=".16"/><path d="M${this.gap-75} 740V1000M${this.gap+75} 740V1000" stroke="#a8e6d6" stroke-width="3" stroke-dasharray="12 9"/>`+text(this.gap,1025,'从云隙穿过','#bdebdc');
   if(this.active)s+=`<path d="M${Math.max(0,80+740*this.progress-190)} 870Q${80+740*this.progress-80} 900 ${80+740*this.progress} 860" fill="none" stroke="#ffe5b4" stroke-width="12" opacity=".65"/>`;
  }
  if((this.move==='wall'||this.move==='coil')&&this.active){const b=this.rig.bodies[4];s+=`<circle cx="${b.x}" cy="${b.y}" r="74" fill="#a5dace15" stroke="#bdebdc" stroke-width="3" stroke-dasharray="9 9"/>`+text(b.x,b.y,'云隙','#bdebdc');}
  for(const i of this.impacts){const age=this.clock-i.at;s+=`<ellipse cx="${i.x}" cy="${i.y}" rx="${Math.max(1,age*260)}" ry="${Math.max(1,age*260)}" fill="none" stroke="#ffe1a1" stroke-width="${8*(1-clamp(age))}" opacity="${1-clamp(age)}"/>`;}
  if(this.warning&&this.move==='fire')for(const c of this.covers)if(!c.broken)s+=text(c.part.x,c.part.y+c.ry+35,c.part.def.sprite==='sky_low-bridge'?'石桥挡弹':'浮石挡弹','#c5d2c2');
  return s;
 }
 dispose(){for(const p of this.release)if(!p.dead)this.w.remove(p);for(const c of this.covers)this.w.remove(c.part);for(const r of this.rubble)this.w.remove(r.part);}
}
