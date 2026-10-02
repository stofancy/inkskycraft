// 第一章友方飞舟：场景身份，不参与敌人选取、碰撞、密度与击杀奖励。
import type { World } from './world';
import type { Scenery } from './scenery';
import { PK } from '../gl/particles';
import { RS } from '../gl/ribbons';

import { CH1_AIR_ART } from '../art/ch1_air_assets';
export { CH1_AIR_ART };
export class EscortShip {
 readonly scene:Scenery;
 durability=100;
 protected=false;
 sinking=false;
 rescuing=false;
 guideUntil=0;
 supportTarget:number|null=null;
 chiyanPad:Scenery|null=null;chiyanEngine=false;
 readonly vessels:Scenery[]=[];
 hooks:import('./enemy').Enemy[]=[];
 // 跟随模式：三船按主角约 0.35 秒一档的轨迹排成尾队；order 为尾队顺序，pull 为额外位移（纸龙锁链），lag 为额外滞后。
 follow=false;order=[0,1,2];readonly pull=[{x:0,y:0},{x:0,y:0},{x:0,y:0}];readonly extraLag=[0,0,0];shipScale=.33;
 protected trail:{t:number;x:number;y:number}[]=[];protected clock=0;protected placed=false;
 protected trailAt(t:number){const a=this.trail;if(!a.length)return {x:this.w.player.x,y:this.w.player.y};if(t<=a[0].t)return a[0];for(let i=a.length-1;i>0;i--)if(a[i-1].t<=t){const k=(t-a[i-1].t)/Math.max(1e-6,a[i].t-a[i-1].t);return {x:a[i-1].x+(a[i].x-a[i-1].x)*k,y:a[i-1].y+(a[i].y-a[i-1].y)*k};}return a[a.length-1];}
 protected followUpdate(dt:number):void{
  const p=this.w.player;this.clock+=dt;this.trail.push({t:this.clock,x:p.x,y:p.y});while(this.trail.length>2&&this.trail[1].t<this.clock-4)this.trail.shift();
  for(let i=0;i<this.vessels.length;i++){
   const s=this.vessels[i],slot=this.order.indexOf(i),q=this.trailAt(this.clock-.35*(slot+1)-this.extraLag[i]),side=slot%2===0?-1:1;
   let x=q.x+side*40+this.pull[i].x,y=q.y+70*(slot+1)*this.shipScale/.38*.6+60+this.pull[i].y;
   const over=Math.max(0,y-1130);y=Math.min(y,1130);x+=side*over*1.4;x=Math.max(60,Math.min(840,x));
   if(!this.placed){s.x=x;s.y=y;}else{const dx=x-s.x,dy=y-s.y,d=Math.hypot(dx,dy),step=Math.min(d,Math.max(d*8,0)*dt+0,700*dt);if(d>0){s.x+=dx/d*step;s.y+=dy/d*step;}}
   s.sx=s.sy=this.shipScale;s.rot=Math.sin(this.w.real*.35+i)*.018;
  }
  this.placed=true;
 }
 warnings:{x:number;y:number;started:number;dead:boolean}[]=[];
 bombLog:{warnAt:number;explodeAt?:number;destroyed?:boolean;x:number;y:number}[]=[];
 bomberReleases:{frame:number;opened:number;at:number}[]=[];
 readonly born:number;
 constructor(readonly w:World,migration=true){
  this.born=w.real;this.scene=w.scene(migration?'sky_migration-ship':CH1_AIR_ART.ship.atlas,450,860);this.scene.layer='ground';
  if(migration){this.vessels.push(w.scene('sky_migration-ship',270,720),this.scene,w.scene('sky_migration-ship',630,1000));this.vessels.forEach(s=>{s.layer="ground";s.sx=s.sy=.33;});}
  // 第一章三船使用同一精灵；第二章沿用自己的三船状态图集。
 }
 get bottom(){return this.scene.y+80;}
 get state(){return this.sinking?'sinking':this.durability<30?'leak':this.durability<60?'smoke':'healthy';}

 hit(amount:number):void{if(this.protected)return;this.durability=Math.max(1,this.durability-amount);this.w.audio.sfx('workship_hit',{vol:.6});this.w.fx.burst(this.scene.x,this.scene.y,8,60,[1,.6,.2]);}
 validStroke(stroke:{form:string;pts:readonly number[]}):boolean{
  const xs=stroke.pts.filter((_,i)=>i%2===0),ys=stroke.pts.filter((_,i)=>i%2===1);
  return stroke.form==='横'&&xs.length>=2&&Math.min(...xs)<=this.scene.x-120&&Math.max(...xs)>=this.scene.x+120&&ys.every(y=>y>=this.bottom+20&&y<=this.bottom+140);
 }
 protected absorbBullets(width:number,height:number,damage=2,field?:string):void{
  for(const b of this.w.bullets.list)if(!b.dead&&b.delay<=0&&this.vessels.some(s=>Math.abs(b.x-s.x)<width+b.radius&&Math.abs(b.y-s.y)<height+b.radius)){b.dead=true;this.hit(field?b.data[field]??damage:damage);}
 }
 update(dt:number):void{
  if(this.scene.dead){this.vessels.forEach(s=>s.dead=true);return;}
  if(this.follow&&this.vessels.length){this.followUpdate(dt);if(!this.protected)this.absorbBullets(85*this.shipScale/.85,115*this.shipScale/.85);this.finishUpdate(dt);return;}
  for(let i=0;i<this.vessels.length;i++){const s=this.vessels[i];s.sx=s.sy=this.shipScale;if(s!==this.scene){s.x=Math.max(105,Math.min(795,this.scene.x+(i-1)*180+Math.sin(this.w.real*.5+i)*8));s.y=this.scene.y+(i-1)*140+Math.cos(this.w.real*.4+i)*6;if(this.scene.y<=1000)s.y=Math.min(1060,s.y);}s.rot=Math.sin(this.w.real*.35+i)*.018;}
  if(!this.protected)this.absorbBullets(85,115);
  this.warnings=this.warnings.filter(v=>!v.dead);
  if(this.warnings.length&&!this.rescuing){const nearby=this.warnings.find(v=>Math.hypot(v.x-this.scene.x,v.y-this.scene.y)<180);if(nearby)this.scene.x=Math.max(140,Math.min(760,this.scene.x+(nearby.x>=this.scene.x?-1:1)*60*dt));}
  this.finishUpdate(dt);
 }
 private finishUpdate(dt:number):void{
  if(this.state!=='healthy'&&Math.floor(this.w.presentationTime*12)!==Math.floor((this.w.presentationTime-dt)*12))this.w.fx.emit({x:this.scene.x+(this.state==='leak'?75:0),y:this.scene.y-30,vx:12,vy:-30,life:1.8,size:24,kind:PK.Smoke,r:.3,g:.3,b:.28,a:.5});
  this.updatePresentation(dt);
 }
 updatePresentation(dt:number):void {
  if(this.chiyanEngine&&this.chiyanPad&&!this.chiyanPad.dead&&Math.floor(this.w.presentationTime*12)!==Math.floor((this.w.presentationTime-dt)*12))this.w.fx.emit({x:this.chiyanPad.x,y:this.chiyanPad.y+25,vx:-15,vy:20,life:1,size:18,kind:PK.Smoke,r:.3,g:.3,b:.28,a:.6});
  const target=this.w.enemies.find(e=>e.id===this.supportTarget&&!e.dead),chiyan=this.w.companions.team.find(c=>c.kind==='chiyan');
  if(chiyan?.penFlight){const tx=target?target.x-65:this.w.player.x,ty=target?target.y+80:this.w.player.y-88,dx=tx-chiyan.x,dy=ty-chiyan.y,d=Math.hypot(dx,dy),step=Math.min(d,420*dt);if(d){chiyan.x+=dx/d*step;chiyan.y+=dy/d*step;}chiyan.cooldown=999;}
 }
 explode(x:number,y:number):void{
  const w=this.w;w.audio.sfx('bomb_land');w.fx.explosion(x,y,'s','fire');
  if(this.vessels.some(s=>Math.hypot(x-s.x,y-s.y)<=95))this.hit(8);
  if(Math.hypot(x-w.player.x,y-w.player.y)<=60&&w.player.alive&&w.player.invuln<=0&&!w.brush.protected)w.player.hit();
 }
 draw():void{
  const w=this.w,r=w.r,s=this.scene;
  for(const ship of this.vessels)r.shadows.add(ship.sprite,{x:ship.x,y:ship.y,rot:ship.rot,sx:ship.sx,sy:ship.sy,alpha:.25});
  if(this.supportTarget!==null&&w.real% .6<.12){const target=w.enemies.find(e=>e.id===this.supportTarget&&!e.dead);const chiyan=w.companions.team.find(c=>c.kind==='chiyan');if(target&&chiyan)r.ribbonMid.line(chiyan.x,chiyan.y,target.x,target.y,2,RS.Brush,1.8,.3,.1,.7);}
  this.hooks=this.hooks.filter(h=>!h.dead);for(const h of this.hooks)r.ribbonTop.line(h.x,h.y+20,s.x,s.y-70,3,RS.Brush,.3,.25,.2,.9);
  const y=s.y+(this.follow?55:165);r.ribbonTop.line(s.x-60,y,s.x+60,y,3,RS.Brush,.1,.1,.1,.9);
  r.ribbonTop.line(s.x-60,y,s.x-60+120*this.durability/100,y,3,RS.Brush,.8,.7,.35,1);
  if(this.chiyanEngine&&this.chiyanPad&&!this.chiyanPad.dead){const s=this.chiyanPad,a=w.presentationTime*45;r.ribbonTop.line(s.x-16*Math.cos(a),s.y-20-16*Math.sin(a),s.x+16*Math.cos(a),s.y-20+16*Math.sin(a),2,RS.Brush,.3,.15,.08,.9);}
  for(const warning of this.warnings){const pts:number[]=[];for(let j=0;j<=40;j++){const a=j/40*Math.PI*2;pts.push(warning.x+Math.cos(a)*40,warning.y+Math.sin(a)*40);}r.ribbonTop.strip(pts,3,RS.Brush,.8,.035,.025,.25+.75*Math.min(1,(w.real-warning.started)/1.2));}
  if(this.rescuing&&w.real<this.guideUntil){const q=(w.real%2)/2,x0=s.x-120,end=x0+240*q;r.ribbonTop.line(x0,this.bottom+70,end,this.bottom+70,5,RS.Brush,.6,.9,.7,.5);r.ribbonTop.line(x0,this.bottom+70,s.x+120,this.bottom+70,1,RS.Warn,.8,1,.8,.5);}
 }
}
