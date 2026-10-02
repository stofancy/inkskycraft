// 三色贴身、环绕与尾迹；全部为实时几何和粒子，敌弹由 Renderer 在其上层绘制。
import type { World } from './world';
import { PK, type ParticleSpec } from '../gl/particles';
import { RS, type RibbonBatch } from '../gl/ribbons';
import type { WeaponColor } from '../types';
export const AURA_COLORS:Record<WeaponColor,[number,number,number]>={red:[1.8,.32,.045],purple:[.75,.26,1.7],blue:[.08,1.05,.92]};
export function auraLine(batch:RibbonBatch,points:number[],width:number,color:readonly number[],alpha=.55,style=RS.Glow):void{
 for(let i=2;i<points.length;i+=2){batch.line(points[i-2],points[i-1],points[i],points[i+1],width,style,color[0],color[1],color[2],alpha);if(style===RS.Glow||style===RS.Trail)batch.line(points[i-2],points[i-1],points[i],points[i+1],Math.max(.7,width*.22),RS.AuraArc,color[0],color[1],color[2],alpha*.72);}
}
export function auraRing(batch:RibbonBatch,x:number,y:number,rx:number,ry:number,color:readonly number[],alpha=.5,phase=0,width=2):void{
 const pts:number[]=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push(x+Math.cos(a+phase)*rx,y+Math.sin(a+phase)*ry);}auraLine(batch,pts,width,color,alpha);
}
// 机身效果只写入专用 GPU 环形缓冲。发射后保留世界坐标，横移自然留下尾迹。
export class Aura {
 color:WeaponColor='red';time=0;burst=0;
 /** 含延迟墨烟的占用数，供同场景性能验收。 */
 active=0;peak=0;
 private ready=false;private jump=0;private emitCarry=0;private spark=0;private muzzle=0;private arcCd=0;
 private lives:{end:number;born:number}[]=[];
 private bolts:{pts:number[];left:number}[]=[];
 constructor(readonly w:World){}
 clear():void{
  this.w.r.playerFx.reset();this.w.r.playerFx.retireBefore=-1;
  this.ready=false;this.time=this.burst=this.jump=this.emitCarry=this.spark=this.muzzle=this.arcCd=0;
  this.active=this.peak=0;this.lives=[];this.bolts=[];
 }
 private emit(spec:ParticleSpec):void{
  const fx=this.w.r.playerFx;
  if(this.lives.length>=fx.capacity)return;
  fx.emit(spec);this.lives.push({born:this.time+(spec.delay??0),end:this.time+spec.life+(spec.delay??0)});
  this.active=this.lives.length;this.peak=Math.max(this.peak,this.active);
 }
 update(dt:number):void{
  const w=this.w,p=w.player,fx=w.r.playerFx;
  if(!p.alive){if(this.ready||this.active)this.clear();return;}
  this.time+=dt;fx.time=this.time;fx.clearZone=[p.x,p.y,12];
  this.lives=this.lives.filter(v=>v.end>this.time);this.active=this.lives.length;
  if(!this.ready){this.color=p.weapon;this.ready=true;}
  if(this.color!==p.weapon){
   this.color=p.weapon;this.burst=.15;this.jump=0;fx.retireBefore=this.time;
   for(const v of this.lives)if(v.born<this.time)v.end=Math.min(v.end,this.time+.15);
   this.switchIn();
  }
  this.burst=Math.max(0,this.burst-dt);if(dt<=0)return;
  this.bolts=this.bolts.filter(b=>(b.left-=dt)>0);this.jump+=dt;
  // 保留紫色原有的近身跳雷伤害与普通敌弹清除规则。
  if(this.color==='purple'&&this.jump>=1.5){
   this.jump%=1.5;
   const candidates=[...w.enemies.filter(e=>w.targetable(e)&&Math.hypot(e.x-p.x,e.y-p.y)<=150),...w.bullets.list.filter(b=>!b.dead&&!b.hard&&b.delay<=0&&Math.hypot(b.x-p.x,b.y-p.y)<=150)];
   const target=candidates[Math.floor(Math.random()*candidates.length)];
   if(target){this.bolt(p.x,p.y,target.x,target.y,.18);if('hp'in target)w.damage(target,8,target.x,target.y,true,'purple');else{target.dead=true;w.fx.gold(target.x,target.y);}w.audio.sfx('thunder',{vol:.2});}
  }
  // 低画质按已有密度下降；长帧只补最多 50ms 的发射量，避免恢复时堆满粒子。
  const span=Math.min(dt,.05),level=.55+.45*(p.power-1)/3,density=Math.min(1,w.fx.density);
  this.emitCarry+=span*(this.color==='red'?480:320)*level*density;
  const count=Math.floor(this.emitCarry);this.emitCarry-=count;
  for(let i=0;i<count;i++)this.wing(i%2?-1:1);
  this.engine(span);
  this.muzzle-=dt;
  if(p.firing&&this.muzzle<=0){this.muzzle=(this.color==='red'?.105:.075)/(w.skills.boosted?1.6:1);this.gunSpark();}
  this.arcCd-=dt;
  if(this.color==='purple'&&this.arcCd<=0){
   this.arcCd=.16+Math.random()*.28;
   const side=Math.random()<.5?-1:1,tip=this.edge(side,.95);
   this.bolt(p.x+side*10,p.y+3,tip.x,tip.y,.055+Math.random()*.045);
   this.emit({x:tip.x,y:tip.y,life:.065,size:10,sizeEnd:0,r:1.6,g:.9,b:2.6,a:.5,kind:PK.Dot});
  }
 }
 private edge(side:number,u:number):{x:number;y:number}{
  // 正式81.1px机体：后缘由翼根(14,12)到翼尖(31,8)。倾斜帧收窄远翼。
  const p=this.w.player,bank=p.bank,scale=this.w.roll.scaleX;
  return{x:p.x+side*(14+u*17)*(1-Math.abs(bank)*.13+side*bank*.04)*scale,
   y:p.y+12-u*4+side*bank*u*2};
 }
 private wing(side:number):void{
  const u=Math.random(),e=this.edge(side,u),j=()=>Math.random()-.5;
  if(this.color==='red'){
   const vx=side*(2+u*9)+j()*12,vy=40+u*25+j()*15,life=.13+Math.random()*.16;
   this.emit({x:e.x+j()*2,y:e.y+j()*2,vx,vy,life,drag:.7,size:1.6+Math.random()*2.4,sizeEnd:.8,
    r:2.8,g:2+Math.random()*.6,b:1.1,a:.38+Math.random()*.2,r1:.8,g1:.045,b1:.012,kind:PK.Flame,rot:Math.random()*6,spin:j()*3});
   if(u>.35&&Math.random()<.13){
    // 火尾延迟接出慢速、普通混合的墨烟；烟团沿热流后方生长。
    this.emit({x:e.x+vx*.23,y:e.y+vy*.27+6,vx:vx*.4,vy:22+Math.random()*18,life:.2+Math.random()*.15,delay:.12,
     size:2+Math.random()*2,sizeEnd:5+Math.random()*3,r:.075,g:.065,b:.06,r1:.025,g1:.03,b1:.035,a:.38,kind:PK.Smoke,spin:j()*2});
   }
  }else if(this.color==='blue'){
   const phase=this.time*7+u*7+side*1.8,vx=side*(3+Math.cos(phase)*10),vy=48+Math.sin(phase)*18;
   const mist=Math.random()<.65;
   this.emit({x:e.x+j()*2,y:e.y+j()*2,vx,vy,drag:.9,grav:25,life:.2+Math.random()*.12,
    size:mist?2+Math.random()*1.8:1.1,sizeEnd:.2,r:1.1,g:1.8,b:1.85,r1:.025,g1:.3,b1:.4,a:mist?.5:.32,kind:mist?PK.Dot:PK.Spark});
  }else{
   this.emit({x:e.x+j()*2,y:e.y+j()*3,vx:side*(2+Math.random()*9),vy:15+Math.random()*35,life:.07+Math.random()*.1,
    size:1+Math.random()*1.8,sizeEnd:0,r:1.6,g:.65,b:2.5,r1:.35,g1:.015,b1:1.2,a:.52,kind:PK.Spark});
  }
 }
 private engine(dt:number):void{
  const p=this.w.player,c=this.color==='red'?[2.6,1.4,.32]:this.color==='blue'?[.4,1.5,1.6]:[1.5,.6,2.6];
  for(const side of[-1,1])this.emit({x:p.x+side*4,y:p.y+32,vx:(Math.random()-.5)*10,vy:60+Math.random()*80,
   life:.065+Math.random()*.07,size:2.5+Math.random()*2,sizeEnd:.2,r:c[0],g:c[1],b:c[2],a:.55,kind:PK.Dot});
  this.spark+=dt;
  if(this.spark>=.09){this.spark%=.09;for(let i=0;i<3;i++)this.emit({x:p.x,y:p.y+35,vx:(Math.random()-.5)*85,vy:60+Math.random()*100,life:.22+Math.random()*.15,
   size:.7+Math.random(),sizeEnd:0,r:c[0],g:c[1]*.6,b:c[2]*.5,a:.7,kind:PK.Spark});}
 }
 private gunSpark():void{
  const p=this.w.player,g=p.gun('gun'),c=AURA_COLORS[this.color];
  for(let i=0;i<7;i++){const angle=-Math.PI/2+(Math.random()-.5)*2;
   this.emit({x:g.x+(Math.random()-.5)*6,y:g.y,vx:Math.cos(angle)*90,vy:Math.sin(angle)*90,life:.07+Math.random()*.07,size:1+Math.random()*1.3,sizeEnd:0,r:c[0]*1.5,g:c[1]+.65,b:c[2]+.2,a:.7,kind:PK.Spark});}
 }
 private bolt(ax:number,ay:number,bx:number,by:number,life:number):void{
  const pts:number[]=[];for(let i=0;i<=8;i++){const t=i/8,j=i&&i<8?(Math.random()-.5)*9:0;pts.push(ax+(bx-ax)*t+j,ay+(by-ay)*t+j);}
  if(this.bolts.length>=12)this.bolts.shift();this.bolts.push({pts,left:life});
 }
 private switchIn():void{
  const p=this.w.player,c=AURA_COLORS[this.color];
  for(let i=0;i<72;i++){const a=i*Math.PI*2/72,r=15+Math.random()*6,speed=180+Math.random()*130;
   this.emit({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.15,size:2+Math.random()*2,sizeEnd:0,r:c[0]*1.5,g:c[1]*1.5,b:c[2]*1.5,a:.55,kind:PK.Dot});}
  this.w.audio.sfx(this.color==='red'?'swap_red':this.color==='blue'?'swap_blue':'swap_purple');
 }
 draw():void{
  const w=this.w,p=w.player,b=w.r.ribbonPlayer;if(!p.alive)return;
  for(const bolt of this.bolts)auraLine(b,bolt.pts,1.1,[1.15,.52,2.2],Math.min(1,bolt.left/.055)*.7,RS.Lightning);
  const col=AURA_COLORS[this.color],breath=.045+.03*(1+Math.sin(this.time*4));
  for(const side of[-1,1]){
   const root=this.edge(side,0),tip=this.edge(side,1);
   // 表面辉光与细亮后缘同用真实机翼坐标，叠在精灵上。
   b.line(root.x,root.y-5,tip.x,tip.y-5,4.5,RS.Glow,...col,breath);
   b.line(root.x,root.y,tip.x,tip.y,1,RS.Glow,...col,.2);
   if(this.color==='purple'){
    const pts:number[]=[];for(let i=0;i<=6;i++){const e=this.edge(side,i/6);pts.push(e.x,e.y+Math.sin(i*9+Math.floor(this.time*24))*1.8);}
    auraLine(b,pts,.7,[1.1,.45,2],.35,RS.Lightning);
   }else if(this.color==='red'){
    for(let k=0;k<3;k++){const e=this.edge(side,.2+k*.35),v=3+Math.sin(this.time*19+k*2)*2;
     auraLine(b,[e.x,e.y,e.x+side*v,e.y+5,e.x+side*v*.5,e.y+9],1.5,col,.32,RS.Fire);}
   }else{
    for(let k=0;k<2;k++){
     const e=this.edge(side,.45+k*.5),pts:number[]=[];
     for(let i=0;i<=8;i++){const u=i/8;pts.push(e.x+side*Math.sin(u*5+this.time*5+k)*u*4,e.y+u*21);}
     auraLine(b,pts,.6,[.4,1.4,1.5],.3,RS.Trail);
    }
    const e=this.edge(side,1),pts:number[]=[];
    for(let i=0;i<=12;i++){const u=i/12,ang=u*5+this.time*5;pts.push(e.x+Math.cos(ang)*u*3,e.y+4+u*7+Math.sin(ang)*u*3);}
    auraLine(b,pts,.55,col,.35,RS.Trail);
   }
  }
  if(this.color==='blue'){
   // 护剑天赋触发时保留其闪光反馈。
   if(w.progression.swordFlash>0){const a=this.time*2+w.progression.swordIndex*Math.PI/2;
    const x=p.x+Math.cos(a)*55,y=p.y+Math.sin(a)*55;
    b.line(x,y+12,x,y-20,3,RS.Sword,.4,1.5,1.4,w.progression.swordFlash/.3);}
  }
 }
}
