import { attackTurn } from './stage1_rhythm';
// 第一章实体攻击：沿用敌人生命周期、受击和图集；所有玩家伤害统一进入 hit。
import type { Enemy, EnemyDef } from '../game/enemy';
import type { G, Co } from '../game/api';
import type { World } from '../game/world';
import type { Renderer } from '../gl/renderer';
import { segDist2 } from '../core/math';
import { RS } from '../gl/ribbons';
import { PK } from '../gl/particles';
import { EV } from '../gl/elemental-vfx';

const PI=Math.PI;
type Point={x:number;y:number};
type Attack={kind:string;warn:boolean;angle?:number;target?:Point;partner?:Enemy;owner?:Enemy;radius?:number;trail?:number[];phase?:number};
const state=(e:Enemy)=>e.data.ch1Attack as Attack|undefined;
function hurt(g:G):boolean{const p=(g as World).player;if(p.entering>0)return false;const seq=p.hurtSeq;p.hit();return p.hurtSeq!==seq;}
function touch(e:Point,g:G,r:number):boolean{return Math.hypot(e.x-g.player.x,e.y-g.player.y)<r+(g as World).player.hitR;}
function projectile(g:G,kind:string,x:number,y:number,hp:number,ai:(e:Enemy,g:G)=>Co):Enemy{
 return g.spawn({name:{hook:'铁钩',blade:'回旋纸刃',mine:'符雷',oil:'火油罐',rocket:'追踪火箭'}[kind],sprite:`ch1_attack_${kind}`,hp,score:0,radius:kind==='blade'?22:14,noCollide:true,invulnerable:hp===0,explosion:'s',ai},x,y,e=>{e.data.contentRole='hazard';e.data.noSupplementFire=true;e.glow=0;});
}
/** 预警状态存在机体上，中断、死亡时一起撤销。 */
function* telegraph(e:Enemy,g:G,a:Attack,seconds:number):Generator<unknown,boolean,unknown>{
 const life:Record<string,number>={hook:2,blade:3,mine:10,oil:3.5,rocket:5,line:5,slash:.3};
 yield* attackTurn(e,g,a.kind==='hook'||a.kind==='slash'?'aim':'area',life[a.kind]??5,seconds);
 const serial=e.interruptSerial;e.data.ch1Attack=a;e.charging=true;
 yield* g.wait(seconds);const ok=e.charging&&serial===e.interruptSerial&&!e.dead;
 e.charging=false;delete e.data.ch1Attack;return ok;
}
export function* hookAttack(e:Enemy,g:G):Co{
 const a=g.aim(e.x,e.y),target={x:e.x+Math.cos(a)*850,y:e.y+Math.sin(a)*850};
 if(!(yield* telegraph(e,g,{kind:'hook',warn:true,target},.5)))return;
 projectile(g,'hook',e.x,e.y+26,5,function*(h,g){
  h.data.ch1Attack={kind:'hook',warn:false,owner:e};h.angle=a-PI/2;let t=0;
  try{while(t<1.65&&!e.dead){t+=g.dt;h.x+=Math.cos(a)*520*g.dt;h.y+=Math.sin(a)*520*g.dt;
   if(touch(h,g,16)){if(hurt(g)){const p=(g as World).player,dx=e.x-p.x,dy=e.y-p.y,d=Math.max(1,Math.hypot(dx,dy));let pulled=0;
    while(pulled<80&&!e.dead&&p.alive){const step=Math.min(80-pulled,320*g.dt,Math.max(0,d-80));p.x=Math.max(24,Math.min(876,p.x+dx/d*step));p.y=Math.max(24,Math.min(1176,p.y+dy/d*step));h.x=p.x;h.y=p.y;pulled+=step;if(step===0)break;yield;}
   }break;}yield;}
  }finally{g.remove(h);}
 });
}
export function* bladeAttack(e:Enemy,g:G):Co{
 const a=g.aim(e.x,e.y),sx=e.x,sy=e.y,reach=Math.min(520,Math.max(280,Math.hypot(g.player.x-sx,g.player.y-sy)));
 const target={x:sx+Math.cos(a)*reach,y:sy+Math.sin(a)*reach};
 if(!(yield* telegraph(e,g,{kind:'blade',warn:true,target},.6)))return;
 projectile(g,'blade',sx,sy,0,function*(b,g){const trail:number[]=[];b.data.ch1Attack={kind:'blade',warn:false,trail};
  let t=0;while(t<3){t+=g.dt;const u=Math.min(1,t/3),out=Math.sin(PI*u),curve=Math.sin(2*PI*u)*90,px=b.x,py=b.y;
   b.x=sx+Math.cos(a)*reach*out-Math.sin(a)*curve;b.y=sy+Math.sin(a)*reach*out+Math.cos(a)*curve;b.angle+=g.dt*9;
   trail.push(b.x,b.y);if(trail.length>24)trail.splice(0,2);
   if(segDist2(g.player.x,g.player.y,px,py,b.x,b.y)<(22+(g as World).player.hitR)**2)hurt(g);yield;
  }g.remove(b);
 });
}
export function* mineAttack(e:Enemy,g:G):Co{
 if(!(yield* telegraph(e,g,{kind:'mine',warn:true,radius:42},.6)))return;
 projectile(g,'mine',e.x,e.y+35,5,function*(m,g){
  const a:Attack={kind:'mine',warn:false,radius:120};m.data.ch1Attack=a;
  let t=0;while(t<9&&!touch(m,g,120)){t+=g.dt;m.y+=72*g.dt;m.angle=Math.sin(t*3)*.16;yield;}
  if(t>=9){g.remove(m);return;}a.warn=true;yield* g.wait(.4);
  g.fx.explosion(m.x,m.y,'s','fire');
  // 八枚短程碎纸，固定数量，不受普通弹补偿倍率影响。
  for(let i=0;i<8;i++)g.shoot(m.x,m.y,i*PI/4,210,{shape:'rice',color:'amber',life:.55/g.difficulty.speed});
  g.remove(m);
 });
}
export function* oilAttack(e:Enemy,g:G):Co{
 const target={x:Math.max(95,Math.min(805,g.player.x)),y:Math.max(e.y+140,Math.min(1060,g.player.y))};
 if(!(yield* telegraph(e,g,{kind:'oil',warn:true,target,radius:76},.65)))return;
 projectile(g,'oil',e.x,e.y+35,6,function*(b,g){const a:Attack={kind:'oil',warn:true,target,radius:76};b.data.ch1Attack=a;
  yield* b.moveTo(target.x,target.y,1,'inQuad');b.alpha=0;b.invulnerable=true;a.warn=false;g.fx.explosion(b.x,b.y,'s','fire');
  let t=0,flame=0;while(t<2.5){t+=g.dt;a.phase=t;flame+=g.dt;
   while(flame>=.055){flame-=.055;
    for(let i=0;i<3;i++){const q=t*6+i*2.4,rad=15+((t*31+i*19)%42),x=b.x+Math.cos(q)*rad,y=b.y+Math.sin(q)*rad*.62;
     (g as World).r.partLow.emit({x,y:y-10,vx:Math.sin(q)*9,vy:-22,life:.45,size:4,sizeEnd:1,r:1.6,g:.65,b:.09,r1:.6,g1:.08,b1:.01,a:.85,kind:PK.SparkTex});
    }
   }if(touch(b,g,66))hurt(g);yield;
  }g.remove(b);
 });
}
export function* rocketAttack(e:Enemy,g:G):Co{
 if(!(yield* telegraph(e,g,{kind:'rocket',warn:true,radius:65},.7)))return;
 for(let i=0;i<2;i++)projectile(g,'rocket',e.x+(i?32:-32),e.y+25,4,function*(r,g){
  let a=PI/2+(i?-.35:.35),t=0;const trail:number[]=[];r.data.ch1Attack={kind:'rocket',warn:false,trail};
  while(t<5){t+=g.dt;const aim=g.aim(r.x,r.y),delta=Math.atan2(Math.sin(aim-a),Math.cos(aim-a));a+=Math.max(-.48*g.dt,Math.min(.48*g.dt,delta));
   r.x+=Math.cos(a)*205*g.dt;r.y+=Math.sin(a)*205*g.dt;r.angle=a+PI/2;trail.push(r.x,r.y);if(trail.length>48)trail.splice(0,2);
   if(touch(r,g,13)){hurt(g);break;}yield;
  }g.remove(r);
 });
}
export function closeSlash(e:Enemy,g:G):void{e.run((function*():Co{
 for(;;){while(!touch(e,g,160))yield;const a=g.aim(e.x,e.y);
  if(yield* telegraph(e,g,{kind:'slash',warn:true,angle:a,radius:160},.35)){
   const attack:Attack={kind:'slash',warn:false,angle:a,radius:160,phase:0};e.data.ch1Attack=attack;g.sfx('warning',{vol:.3,pitch:1.6});let t=0;
   while(t<.3){t+=g.dt;attack.phase=t/.3;const d=Math.atan2(g.player.y-e.y,g.player.x-e.x)-a;
    if(touch(e,g,154)&&Math.abs(Math.atan2(Math.sin(d),Math.cos(d)))<=PI/3)hurt(g);yield;}
   delete e.data.ch1Attack;
  }yield* g.wait(4);
 }
})());}
export function* kiteLine(e:Enemy,g:G):Co{
 const other=e.data.linePartner as Enemy;yield* e.moveTo(e.data.lineX,300,1.5);while(!other.dead&&other.y<290)yield;
 if(other.dead)return;const a:Attack={kind:'line',warn:true,partner:other};
 if(!(yield* telegraph(e,g,a,.8)))return;a.warn=false;e.data.ch1Attack=a;let t=0;
 while(t<5&&!other.dead){t+=g.dt;e.y=300+t*105;e.x=e.data.lineX+Math.sin(t*.8)*60;other.x=e.x+360;other.y=e.y;
  if(segDist2(g.player.x,g.player.y,e.x,e.y,other.x,other.y)<(6+(g as World).player.hitR)**2)hurt(g);yield;
 }delete e.data.ch1Attack;other.data.lineDone=true;
}
export function mountShield(e:Enemy,g:G):Enemy{
 const shield=g.attach(e,{name:'铜盾',sprite:'ch1_attack_shield',hp:34,score:0,radius:0,hits:[[-48,0,25],[0,0,30],[48,0,25]],noCollide:true,hitPriority:20,drawOrder:20,explosion:'s',
  onDeath(_s,g){e.data.broken=true;g.fx.shake(.12);},
  *ai(s,g){s.data.targetDisabled=true;s.data.ch1Attack={kind:'shield',warn:true,radius:82};s.alpha=.55;yield* g.wait(.6);s.alpha=1;s.data.targetDisabled=false;delete s.data.ch1Attack;},
 },[0,55],{followRot:false});shield.glow=0;shield.data.ch1Shield=true;shield.data.noSupplementFire=true;
 return shield;
}
/** 点到链条判定：钩头与链条共享 5 HP。 */
export function chainHit(e:Enemy,x:number,y:number,r:number):boolean{
 const a=state(e);return a?.kind==='hook'&&!a.warn&&!!a.owner&&!a.owner.dead&&segDist2(x,y,e.x,e.y,a.owner.x,a.owner.y)<(r+7)**2;
}
export function chainExtent(e:Enemy):number{const a=state(e);return a?.kind==='hook'&&a.owner?Math.hypot(e.x-a.owner.x,e.y-a.owner.y):0;}
/** 铜盾只截住射线的前半段，侧面保持可通行。 */
export function shieldBlocks(shield:Enemy,ax:number,ay:number,bx:number,by:number,r:number):boolean{
 if(shield.dead||shield.data.targetDisabled||!shield.data.ch1Shield||Math.abs(by-ay)<.001)return false;
 const t=(shield.y-ay)/(by-ay);return t>0&&t<1&&Math.abs(ax+(bx-ax)*t-shield.x)<72+r;
}

// 使用实色混合光带，深边和亮芯同时保留；无运行时图片/纹理分配。
export function drawCh1Attack(e:Enemy,r:Renderer,time:number):void{
 const a=state(e);if(!a)return;const R=r.ribbonTop;
 const line=(x:number,y:number,xx:number,yy:number,w=4,alpha=1)=>{R.line(x,y,xx,yy,w+3,RS.Brush,.045,.025,.018,alpha);R.line(x,y,xx,yy,w,RS.Brush,1,.52,.1,alpha);R.line(x,y,xx,yy,Math.max(1,w*.28),RS.Brush,1,.92,.65,alpha);};
 const arc=(x:number,y:number,rad:number,start=0,end=2*PI,w=3,alpha=1)=>{for(let i=0;i<32;i++){const p=start+(end-start)*i/32,q=start+(end-start)*(i+1)/32;line(x+Math.cos(p)*rad,y+Math.sin(p)*rad,x+Math.cos(q)*rad,y+Math.sin(q)*rad,w,alpha);}};
 const flash=.5+.5*Math.abs(Math.sin(time*17));
 if(a.warn&&['hook','blade','mine','oil','rocket'].includes(a.kind)&&e.def.sprite!==`ch1_attack_${a.kind}`)r.air.add(`ch1_attack_${a.kind}`,{x:e.x,y:e.y+55,alpha:.65+.35*flash,glow:0});
 if(a.kind==='line'&&a.partner&&!a.partner.dead){line(e.x,e.y,a.partner.x,a.partner.y,a.warn?2:6,a.warn?flash:1);return;}
 if(a.kind==='hook'){
  const p=a.warn?a.target:a.owner;if(!p||('dead' in p&&p.dead))return;
  if(a.warn){const n=16;for(let i=0;i<n;i+=2)line(e.x+(p.x-e.x)*i/n,e.y+(p.y-e.y)*i/n,e.x+(p.x-e.x)*(i+1)/n,e.y+(p.y-e.y)*(i+1)/n,2,flash);}
  else{line(e.x,e.y,p.x,p.y,3);const d=Math.hypot(p.x-e.x,p.y-e.y);for(let t=10;t<d;t+=22)arc(e.x+(p.x-e.x)*t/d,e.y+(p.y-e.y)*t/d,5,0,2*PI,1);}
 }else if(a.kind==='slash'){
  const start=a.angle!-PI/3,end=a.angle!+PI/3;arc(e.x,e.y,160,start,end,a.warn?2:10,a.warn?flash:1);
  if(a.warn){line(e.x,e.y,e.x+Math.cos(start)*160,e.y+Math.sin(start)*160,2,flash);line(e.x,e.y,e.x+Math.cos(end)*160,e.y+Math.sin(end)*160,2,flash);}
  else{const q=start+(end-start)*(a.phase??0);line(e.x+Math.cos(q)*40,e.y+Math.sin(q)*40,e.x+Math.cos(q)*160,e.y+Math.sin(q)*160,12);}
 }else if(a.kind==='oil'&&a.target){
  if(!a.warn){
   // 66 半径伤害区由连续燃烧面标明，向上的火舌复用重炮体积火。
   const t=a.phase??0;
   r.elemental.add(EV.Fire,e.x,e.y-10,190,200,t,1,1.25,11,0,true);
   for(let i=0;i<5;i++){const q=i*2.4,x=e.x+Math.cos(q)*43,y=e.y+Math.sin(q)*38;
    r.elemental.add(EV.Fire,x,y-18,73,116,t+i*.27,.9,1.05,i*3,0,true);
   }
  }else{arc(a.target.x,a.target.y,76,0,2*PI,3,flash);line(a.target.x-16,a.target.y,a.target.x+16,a.target.y,2,flash);line(a.target.x,a.target.y-16,a.target.x,a.target.y+16,2,flash);}
 }else if(a.kind==='mine'){arc(e.x,e.y,a.radius??42,0,2*PI,a.warn?3:1,a.warn?flash:.4);}
 else if(a.warn){arc(e.x,e.y,a.radius??40,0,2*PI,2,flash);if(a.target)line(e.x,e.y,a.target.x,a.target.y,2,flash);}
 if(a.trail&&a.trail.length>=4){const t=a.trail,n=t.length/2,width=new Float32Array(n);for(let i=0;i<n;i++)width[i]=a.kind==='rocket'?Math.sin(PI*i/(n-1))*12+1:13*i/(n-1);if(a.kind==='rocket'){r.ribbonMid.strip(t,width,RS.InkTrail,.12,.1,.085,.65);}else{r.ribbonMid.strip(t,width,RS.Brush,.12,.035,.025,.6);r.ribbonMid.strip(t,width.map(v=>v*.35),RS.Brush,1,.75,.3,.8);}}
}
