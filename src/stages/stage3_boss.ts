import type { Co,G } from '../game/api';
import type { Enemy,EnemyDef } from '../game/enemy';
import type { World } from '../game/world';
import { director } from './dialogue1';
import { openTianmen } from './stage3';
import { KunpengLettering } from './stage3_lettering';

const PI=Math.PI,clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
// 30 / 30 / 50 秒为普通火力的调参目标；全部阶段必须击破，题字不限时。
const HP={eye:4600,fin:1656,wing:1188,core:2970};
interface Rig {head:Enemy;fins:Enemy[];wings:Enemy[];eyes:Enemy[];roots:Enemy[];core:Enemy;spread:number;roll:number;fold:number;board:KunpengLettering;peng:boolean}
const boards=new WeakMap<G,KunpengLettering>();
function* wait(g:G,seconds:number,pose?:(t:number)=>void):Co{const at=g.t;while(g.t-at<seconds){pose?.(clamp((g.t-at)/seconds));yield;}pose?.(1);}
function deco(e:Enemy,g:G,sprite:string,x:number,y:number,order=0):Enemy{return g.attach(e,{sprite,hp:1,decorative:true,noCollide:true,drawOrder:order},[x,y]);}
function target(e:Enemy,g:G,x:number,y:number,hp:number,label:string,sprite='kp-joint'):Enemy {
 const p=g.attach(e,{sprite,hp,noCollide:true,radius:27,score:1200,drawOrder:6,hitPriority:30},[x,y]);
 p.hp=p.maxHp=hp;p.phaseLock=true;p.data.bossOwner=e;p.data.contentRole='part';p.data.damageTarget=p;p.data.hitArmor=false;p.data.weakLabel=label;p.data.targetDisabled=true;return p;
}
function rig(e:Enemy,g:G,peng=false):Rig {
 const board=boards.get(g)??new KunpengLettering(g);if(peng)boards.delete(g);else boards.set(g,board);
 const r:Rig={head:deco(e,g,'kp-head',0,203,3),fins:[],wings:[],eyes:[],roots:[],core:target(e,g,0,104,HP.core,'回升露胸时，集中火力','kp-core'),spread:0,roll:0,fold:0,board,peng};
 for(const side of [-1,1]){
  const f=target(e,g,side*79,138,HP.fin,'打亮起的鳍根');f.data.side=side;r.fins.push(f);
  const fin=deco(f,g,'kp-fin',side*12,0,-1);fin.mirror=side>0;f.data.fin=fin;
  const wing=deco(e,g,'kp-wing-root',side*82,95,-2);wing.mirror=side<0;
  const middle=deco(wing,g,'kp-wing-tip',392/6-34.7,0,-2);middle.mirror=side<0;middle.frame=1;
  const tip=deco(middle,g,'kp-wing-tip',392/3,0,-2);tip.mirror=side<0;tip.frame=2;
  wing.data.segments=[middle,tip];r.wings.push(wing);
  r.roots.push(target(e,g,side*112,95,HP.wing,'拆翼根，停这侧风'));
  r.eyes.push(target(e,g,side*43,190,HP.eye,'破眼减吸力'));
 }
 r.core.alpha=0;e.data.kunpengRig=r;e.data.paperEffects=board;e.data.copperSimple=true;e.data.weakCustom=true;e.data.targetDisabled=true;
 g.fork((function*():Co{for(;;){
  e.angle=r.roll;const t=g.t;
  r.head.frame=(r.peng&&r.spread>.4)||e.data.action==='偏侧吸流'||e.data.action==='吐三颗慢弹'?1:0;
  r.head.offY=203+Math.sin(t*1.7)*3;
  for(let i=0;i<2;i++){
   const side=i?1:-1,f=r.fins[i],fin=f.data.fin as Enemy,wing=r.wings[i];
   f.scaleX=f.scaleY=1-r.fold*.93;f.offX=side*(79-r.fold*40);if(!f.data.sweeping)fin.offRot=side*(.2+Math.sin(t*1.8+i)*.1)+r.roll*.5;
   f.alpha=!r.peng&&e.data.phaseIndex===2&&!f.data.targetDisabled&&f.hp>0?1:0;fin.alpha=1-r.fold;
   // 根部先抬起，中段铺开，再伸展翼尖；左右错半拍，始终连着同一副躯体。
   const u=clamp((r.spread-i*.12)/.88),root=clamp(u*3),mid=clamp(u*3-1),tip=clamp(u*3-2);
   wing.alpha=root;wing.scaleX=.15+.85*root;wing.scaleY=.5+.5*root;wing.offRot=side*(-1.05*(1-root)+Math.sin(t*2)*.045);
   const segments=wing.data.segments as Enemy[];for(let j=0;j<2;j++){const v=j?tip:mid,p=segments[j];p.alpha=v;p.scaleX=.1+.9*v;p.scaleY=wing.scaleY;p.offRot=side*-.6*(1-v);}
   r.roots[i].alpha=r.peng&&r.spread>.4?1:0;r.roots[i].offX=side*82;
   if(r.roots[i].hp<=0){r.roots[i].alpha*=.25;wing.tint=[.6,.7,.7];for(const p of wing.data.segments as Enemy[])p.tint=wing.tint;}
   const eye=r.eyes[i];eye.alpha=r.peng?0:eye.hp<=0?.2:1;
   for(const p of [eye,f,r.roots[i]])if(p.hp<=0){p.data.targetDisabled=true;p.glow=.1;}
  }
  if(e.data.phaseIndex===1&&!r.peng)e.hp=r.eyes.reduce((s,p)=>s+p.hp,0);
  if(e.data.phaseIndex===2&&!r.peng)e.hp=r.fins.reduce((s,p)=>s+p.hp,0);
  if(r.peng)e.hp=r.core.hp;
  yield;
 }} )());return r;
}
function enable(parts:Enemy[],on:boolean):void{for(const p of parts){p.data.targetDisabled=!on||p.hp<=0;p.glow=on?1.7:.25;}}
function volley(g:G,x:number,y:number,n:number,angle:number,spread:number,speed:number,big=false):void {
 if(g.bulletCount()+n>112)return;
 const scale=g.difficulty.speed*(1+((g as World).player.power-1)*.05);
 for(let i=0;i<n;i++)g.shoot(x,y,angle+(n===1?0:i/(n-1)-.5)*spread,speed/scale,{color:big?'cyan':'gold',shape:big?'big':'rice',life:6});
}
// 部件拆掉当帧停止施力；作用域取消后没有残留风场。
function flow(g:G,x:number,y:number,radius:number,strength:number,wind?:number):void {
 const p=(g as World).player,dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);if(!p.alive||d>=radius)return;
 const k=clamp((radius-d)/(radius*.25))*strength*g.dt;
 p.x=clamp(p.x+(wind??dx/Math.max(1,d))*k,26,874);
 p.y=clamp(p.y+(wind===undefined?dy/Math.max(1,d):0)*k,50,1164);
}
function* roam(e:Enemy,g:G,k:number):Co {
 const pts=[[245,340],[650,560],[270,660],[640,300]];e.data.action='游弋';const [x,y]=pts[k%4];yield* e.moveTo(x,y,1.6,'inOutQuad');
}
function phase(e:Enemy,index:number,title:string):void{e.data.phaseIndex=index;e.data.phaseTitle=title;e.invulnerable=false;}
function* mouth(e:Enemy,g:G,r:Rig):Co {
 for(let k=0;;k++){
  yield* roam(e,g,k);enable(r.eyes,true);
  const side=k%2?1:-1,x=clamp(e.x+side*100,180,720),y=e.y+255;
  e.data.action='抬头';g.fx.charge(x,y,75,1.2,[.3,1,1]);yield* wait(g,1.2,t=>r.head.offRot=-side*.15*t);
  e.data.action='偏侧吸流';yield* wait(g,1.35,()=>flow(g,x,y,370,r.eyes.filter(p=>p.hp>0).length*38));
  e.data.action='吐三颗慢弹';volley(g,x,y,3,PI/2,.68,105,true);
  // 薄疏云滴铺在两侧，正下方留 160 像素通路。
  for(const s of [-1,1])volley(g,x+s*100,y-30,28,PI/2+s*.85,.62,135);
  e.data.action='吐息收招';yield* wait(g,2,t=>r.head.offRot=-side*.15*(1-t));
 }
}
function* fins(e:Enemy,g:G,r:Rig):Co {
 for(let k=0;;k++){
  yield* roam(e,g,k+1);yield* e.moveTo(450,e.y,.6,'inOutQuad');const i=k%2,p=r.fins[i],side=i?1:-1;if(p.hp<=0)continue;
  enable(r.fins,false);e.data.action='侧翻预告';g.fx.charge(p.x,p.y,85,1.2,[.4,1,1]);yield* wait(g,1.2,t=>r.roll=side*.45*t);
  e.data.action='摆鳍扫过';
  // 鳍始终挂在根部摆动；居中侧翻时，计入鳍尖与碰撞半径仍留 150 像素。
  const fin=p.data.fin as Enemy;p.data.sweeping=true;
  try {yield* wait(g,.75,t=>{
   if(p.hp<=0)return;
   fin.offRot=side*(-.9+1.8*t);r.roll=side*(.45-.9*t);
   const w=g as World,tip=fin.local(0,110);if(Math.hypot(w.player.x-tip.x,w.player.y-tip.y)<55)w.player.hit();
  });}finally{p.data.sweeping=false;fin.offRot=0;}
  if(p.hp>0)volley(g,p.x,p.y,36,PI/2,PI*1.35,140);
  e.data.action='收鳍露根';enable([p],true);yield* wait(g,2,t=>r.roll=-side*.45*(1-t));
 }
}
export const Kun:EnemyDef={sprite:'kp-body',hp:1,radius:0,noCollide:true,score:60000,boss:{name:'鲲鹏 · 鲲',phases:2,music:'boss-kun',defeat:'disable'},*ai(e,g):Co{
 boards.delete(g);const r=rig(e,g),start=e.data.startPhase??1;e.invulnerable=true;e.x=450;e.y=1060;e.data.action='云海升鲲';
 yield* g.present(e.moveTo(450,350,3,'outCubic'));
 if(start<=1)yield* director(g).conversation('C3.kunArrive');
 if(start<=1){phase(e,1,'鲲 · 张口');yield* g.phase(e,{hp:HP.eye*2/g.difficulty.hp,time:Infinity,transitionTime:0,complete:()=>r.eyes.every(p=>p.hp<=0)},()=>mouth(e,g,r));yield* r.board.award(0);}
 else{r.board.count=1;for(const p of r.eyes)p.hp=0;}
 enable(r.eyes,false);phase(e,2,'鲲 · 翻身');
 yield* g.phase(e,{hp:HP.fin*2/g.difficulty.hp,time:Infinity,transitionTime:0,complete:()=>r.fins.every(p=>p.hp<=0)},()=>fins(e,g,r));
 yield* r.board.award(1);e.invulnerable=true;r.roll=0;yield* e.moveTo(450,350,1.4,'inOutQuad');
}};
function* pengAttack(e:Enemy,g:G,r:Rig):Co {
 for(let k=0;;k++){
  enable([r.core],false);r.core.alpha=.2;yield* roam(e,g,k);yield* e.moveTo(450,Math.min(e.y,440),.8,'inOutQuad');enable(r.roots,true);
  e.data.action='拍翼预告';g.fx.charge(e.x,e.y+100,170,1.2,[.5,1,1]);yield* wait(g,1.2);
  e.data.action='拍翼侧风';
  for(let i=0;i<2;i++)if(r.roots[i].hp>0){const p=r.roots[i],side=i?1:-1;volley(g,p.x,p.y,42,PI/2+side*.55,1.1,155);}
  yield* wait(g,1.4,()=>{for(let i=0;i<2;i++)if(r.roots[i].hp>0)flow(g,r.roots[i].x,e.y+320,300,65,i?1:-1);});e.data.action='拍翼收招';yield* wait(g,2);
  // 固定旧位，窄身俯冲；最靠边时仍留下 150 像素通路。
  const x=clamp(g.player.x,250,650),y=clamp(g.player.y,650,940),sx=e.x,sy=e.y;
  e.data.action='锁线俯冲';const line=g.laser(sx,sy,Math.atan2(y-sy,x-sx),{warn:1.25/g.difficulty.warn,duration:.01,width:25,color:'gold'});
  try{yield* wait(g,1.2);line.kill();e.data.action='俯冲';
   e.def.noCollide=false;e.radius=85;
   yield* wait(g,.8,t=>{const u=t*t;e.x=sx+(x-sx)*u;e.y=sy+(y-sy)*u;r.spread=1-.7*Math.sin(t*PI);const w=g as World;if(Math.hypot(w.player.x-e.x,w.player.y-e.y-180)<85)w.player.hit();});
  }finally{line.kill();e.def.noCollide=true;e.radius=0;}
  e.data.action='回升露胸';r.spread=1;r.core.alpha=1;enable([r.core],true);e.data.weak={until:g.real+3,claimed:false};
  yield* e.moveTo(450,340,2,'inOutQuad');yield* wait(g,1);enable([r.core],false);
 }
}
export const Peng:EnemyDef={sprite:'kp-body',hp:1,radius:0,noCollide:true,score:200000,boss:{name:'鲲鹏 · 鹏',phases:2,music:'boss-peng',defeat:'disable'},*ai(e,g):Co{
 const r=rig(e,g,true),start=e.data.startPhase??1;r.board.count=2;e.x=450;e.y=350;e.invulnerable=true;
 for(const p of [...r.eyes,...r.fins])p.hp=0;
 if(start<=1){
  e.data.action='鲲化鹏';yield* director(g).conversation('C3.pengTransform');
  yield* wait(g,3.6,t=>{r.fold=clamp(t*2);r.spread=clamp((t-.22)/.78);e.y=350-35*Math.sin(t*PI);});
  r.fold=1;r.spread=1;phase(e,1,'鹏 · 展翼');
  yield* g.phase(e,{hp:HP.core/g.difficulty.hp,time:Infinity,transitionTime:0,complete:()=>r.core.hp<=0},()=>pengAttack(e,g,r));
 }
 r.core.frame=1;r.core.data.targetDisabled=true;enable(r.roots,false);enable(r.eyes,false);enable(r.fins,false);e.invulnerable=true;
 g.clearBullets();yield* r.board.award(2);e.data.action='收翼停火';
 yield* wait(g,2,t=>{r.spread=1-.85*t;e.x+=(450-e.x)*.08;e.y+=(270-e.y)*.08;});
 phase(e,2,'执笔 · 题局开门');e.invulnerable=true;e.data.action='写局';
 yield* r.board.write(e);
 openTianmen(g);g.bgFlash(.4);yield* director(g).conversation('C3.gateOpen');
 const sign=g.scene('kp-sign',450,134);sign.layer='front';
}};
