import type { Enemy, EnemyDef } from '../game/enemy';
import type { Co, G, Laser } from '../game/api';
import type { World } from '../game/world';
import { Scope } from '../core/tasks';
import { LightningPillar } from './stage3_extra';
import { director } from './dialogue1';

const PI=Math.PI;
// 普通档实血：双链 1800、四鼓 600、雷芯 450。25 秒为输出目标，击破才转段。
const HP={hammer:900,drum:150,core:450};
const decorative=(sprite:string,drawOrder=0):EnemyDef=>({sprite,hp:1,decorative:true,noCollide:true,drawOrder});
interface Hammer { part:Enemy; chain:Enemy; side:number; broken:boolean; fall:number; x:number; y:number; bolt?:Laser }
interface Rig { hammers:Hammer[]; drums:Enemy[]; core:Enemy; wings:Enemy[]; threads:Enemy[]; spread:number; tilt:number; stopped:boolean }
function* wait(g:G,sec:number,pose?:(t:number)=>void):Co {
  const at=g.t;while(g.t-at<sec){pose?.(Math.min(1,(g.t-at)/sec));yield;}pose?.(1);
}
function line(p:Enemy,x:number,y:number,tx:number,ty:number):void {
  p.x=(x+tx)/2;p.y=(y+ty)/2;p.angle=Math.atan2(ty-y,tx-x)-PI/2;p.scaleY=Math.hypot(tx-x,ty-y)/120;
}
function part(e:Enemy,g:G,sprite:string,x:number,y:number,hp:number,radius:number):Enemy {
  const p=g.attach(e,{sprite,hp,radius,noCollide:true,score:1500,hitPriority:30,drawOrder:5},[x,y]);
  p.hp=p.maxHp=hp;p.phaseLock=true;p.data.bossOwner=e;p.data.contentRole='part';p.data.damageTarget=p;p.data.hitArmor=false;
  p.data.targetDisabled=true;return p;
}
function rig(e:Enemy,g:G):Rig {
  const hammers=[-1,1].map(side=>{
    const p=part(e,g,'lg-hammer',side*126,160,HP.hammer,44);p.mirror=side<0;
    p.def.hits=[[0,0,28],[0,65,40],[0,112,44]];p.data.weakLabel='打断锤链，停住这侧';p.data.weakWeapon='red';
    const chain=part(e,g,'lg-chain',0,0,HP.hammer,10);chain.parent=null;chain.data.damageTarget=p;chain.def.hits=[[0,-40,12],[0,0,12],[0,40,12]];chain.data.weakLabel='断锤链';
    return {part:p,chain,side,broken:false,fall:0,x:0,y:0};
  });
  const drums=Array.from({length:8},(_,i)=>{
    const a=i*PI/4-PI/2,p=part(e,g,'lg-drum',Math.cos(a)*79,Math.sin(a)*86,HP.drum,30);
    p.data.bodyPhase='fin';p.data.weakLabel='亮鼓可拆，引雷也能打';p.data.weakWeapon='purple';return p;
  });
  const core=part(e,g,'lg-core',0,0,HP.core,43);core.alpha=0;core.data.weakLabel='开芯了，集中火力';
  const wings=[-1,1,-1,1].map((side,i)=>g.attach(e,{...decorative('lg-wing',-1),deform:{bend:7,sway:5,speed:2.8,weight:[0,1]}},[150,i<2?-92:65],{rot:side*(i<2?-.38:.32),mirror:side<0}));
  const threads=[-1,1].map(()=>{const p=g.attach(e,decorative('lg-thread',-3),[0,0]);p.parent=null;return p;});
  return {hammers,drums,core,wings,threads,spread:0,tilt:0,stopped:false};
}
function breakHammer(e:Enemy,g:G,h:Hammer):void {
  h.broken=true;h.bolt?.kill();h.fall=g.presentationTime;h.x=h.part.x;h.y=h.part.y;
  h.part.parent=null;h.part.data.targetDisabled=h.chain.data.targetDisabled=true;g.fx.explosion(h.x,h.y,'m','fire');g.fx.shake(.16);
}
function* pose(e:Enemy,g:G,r:Rig):Co {
  for(;;){
    const t=g.presentationTime;e.data.phaseIndex=e.data.phase;e.data.phaseTitle=['双锤','雷鼓','雷石'][e.data.phase-1];e.angle=r.tilt+Math.sin(t*1.7)*.035;
    for(const [i,p] of r.drums.entries()){
      if(p.hp<=0&&!p.data.broken){p.data.broken=true;p.data.targetDisabled=true;p.alpha=0;g.fx.explosion(p.x,p.y,'s','fire');}
      const a=i*PI/4-PI/2;p.offX=Math.cos(a)*(79+r.spread*65);p.offY=Math.sin(a)*(86+r.spread*60);
      p.offRot=Math.sin(t*2+i)*.05;
    }
    for(const h of r.hammers){
      h.chain.data.targetDisabled=h.part.data.targetDisabled;
      if(h.part.hp<=0&&!h.broken)breakHammer(e,g,h);
      if(h.broken){const f=t-h.fall;h.part.x=h.x+h.side*f*95;h.part.y=h.y+80*f+190*f*f;h.part.angle=h.side*f*3;
        h.part.alpha=h.chain.alpha=Math.max(0,1-f/2.5);const tip=h.part.local(0,-100);line(h.chain,tip.x,tip.y,h.part.x,h.part.y);
      }else {h.part.syncToParent();const root=e.local(h.side*110,94);line(h.chain,root.x,root.y,h.part.x,h.part.y);}
    }
    for(const [i,p] of r.wings.entries()){
      if(p.data.fall!==undefined){const f=t-p.data.fall;p.x=p.data.x+(i%2?1:-1)*f*100;p.y=p.data.y+80*f+180*f*f;p.angle+=(i%2?1:-1)*.035;p.alpha=Math.max(0,1-f/3);}
      else p.offRot=(i%2?1:-1)*((i<2?-.38:.32)+Math.sin(t*2.6+i)*.12);
    }
    for(const [i,p] of r.threads.entries()){const a=e.local(i?95:-95,-130);line(p,a.x,a.y,i?790:110,-80);p.alpha=r.stopped?0:.65;}
    if(e.data.phase===1)e.hp=r.hammers.reduce((s,h)=>s+Math.max(0,h.part.hp),0);
    if(e.data.phase===2)e.hp=r.drums.map(p=>Math.max(0,p.hp)).sort((a,b)=>a-b).slice(0,4).reduce((a,b)=>a+b,0);
    if(e.data.phase===3)e.hp=r.core.hp;
    yield;
  }
}
// 按完整弹组计数，普通档峰值上限 112；扇间保留通路。
function volley(g:G,origins:Enemy[],n:number,angle:number,spread:number,speed=145):void {
  if(g.bulletCount()+origins.length*n>112)return;
  for(const p of origins)for(let i=0;i<n;i++)g.shoot(p.x,p.y,angle+(i/(n-1)-.5)*spread,speed/(g.difficulty.speed*(1+((g as World).player.power-1)*.05)),{color:'gold',shape:'rice',life:5});
}
function thunderRing(g:G,sources:Enemy[]):void {
  const rays:{p:Enemy;a:number}[]=[];
  for(const p of sources)for(let j=0;j<14;j++){
    const a=j*PI/7,gap=Math.atan2(1050-p.y,450-p.x);
    if(Math.abs(Math.atan2(Math.sin(a-gap),Math.cos(a-gap)))>.32)rays.push({p,a});
  }
  if(g.bulletCount()+rays.length>112)return;
  for(const {p,a} of rays)g.shoot(p.x,p.y,a,125/(g.difficulty.speed*(1+((g as World).player.power-1)*.05)),{color:'violet',shape:'orb',life:5});
}
function* roam(e:Enemy,g:G,k:number):Co {
  e.data.action='乘风绕场';
  const points=[[240,440],[650,650],[270,760],[670,370]];
  const [x,y]=points[k%points.length];yield* e.moveTo(x,y,1.8,'inOutQuad');yield* e.moveTo(k%2?540:360,250,1.2,'inOutQuad');
}
function* hammerAttack(e:Enemy,g:G,h:Hammer):Co {
  if(h.broken)return;
  const p=h.part,x=Math.max(80,Math.min(820,g.player.x)),y=Math.max(600,Math.min(960,g.player.y));
  e.data.action='双锤锁线';p.offRot=-h.side*.4;
  h.bolt=g.laser(x,0,PI/2,{warn:1.05/g.difficulty.warn,duration:.1,width:18,color:'amber'});
  try {
    yield* wait(g,1);h.bolt.kill();if(h.broken)return;
    p.def.noCollide=false;e.data.action='双锤下砸';const sx=p.x,sy=p.y;
    p.parent=null;yield* wait(g,.28,t=>{if(!h.broken){p.x=sx+(x-sx)*t*t;p.y=sy+(y-sy)*t*t-90;p.angle=h.side*.2;}});
    if(h.broken)return;g.fx.shockwave(x,y,110,.3,.4);g.fx.shake(.2);
    volley(g,[p],16,PI/2,PI*1.7,170);
    p.def.noCollide=true;e.data.action='双锤回收';const px=p.x,py=p.y;
    yield* wait(g,2,t=>{if(!h.broken){const target=e.local(h.side*126,160),s=t*t*(3-2*t);p.x=px+(target.x-px)*s;p.y=py+(target.y-py)*s;p.angle=h.side*.25*Math.sin(t*PI);}});
    if(!h.broken){p.parent=e;p.offRot=0;}
  }finally{h.bolt.kill();p.def.noCollide=true;}
}
export const Leigong:EnemyDef={
  name:'雷公',sprite:'lg-body',hp:1,radius:0,score:30000,noCollide:true,drops:['ink'],
  deform:{bend:5,sway:3,breath:.012,speed:2.1,weight:[0,1]},
  boss:{name:'雷公 · 风筝堡垒',music:'boss-leigong',phases:3,defeat:'disable'},
  *ai(e,g):Co {
    const r=rig(e,g),start=e.data.startPhase??1;e.data.leigongRig=r;e.data.copperSimple=true;e.data.weakCustom=true;e.invulnerable=true;e.data.targetDisabled=true;
    const animation=new Scope(e.scope);animation.presentation=true;animation.run(pose(e,g,r));
    const cloud=g.attach(e,decorative('lg-cloud',8),[0,0]);
    e.x=740;e.y=-360;e.alpha=.25;
    yield* g.present((function*():Co{const at=g.presentationTime;while(g.presentationTime-at<2.6){const t=Math.min(1,(g.presentationTime-at)/2.6),s=1-(1-t)**3;e.x=740-290*s+Math.sin(t*PI)*70;e.y=-360+610*s;e.alpha=.25+.75*t;cloud.alpha=1-t;yield;}e.alpha=1;cloud.alpha=0;})());
    if(start<=1)yield* director(g).conversation('C3.leigongArrive');
    if(start<=1){
      g.caption('','双锤 · 断链停砸',2.5);e.invulnerable=false;r.hammers.forEach(h=>h.part.data.targetDisabled=false);
      yield* g.phase(e,{hp:HP.hammer*2/g.difficulty.hp,time:Infinity,name:'双锤 · 断链停砸',transitionTime:0,complete:()=>r.hammers.every(h=>h.broken)},function*(){
        for(let k=0;;k++){yield* roam(e,g,k);yield* hammerAttack(e,g,r.hammers[k%2]);}
      });
    }else for(const h of r.hammers){h.part.hp=0;breakHammer(e,g,h);h.part.alpha=h.chain.alpha=0;h.fall=-100;}
    e.invulnerable=true;yield* e.moveTo(450,290,1,'inOutQuad');
    const speech=director(g).event('C3.leigongPhase2');
    yield* wait(g,1.2,t=>r.spread=t);while(speech&&!speech.done)yield;
    if(start<=2){
      g.caption('','雷鼓 · 拆四面亮鼓',2.5);e.invulnerable=false;
      yield* g.phase(e,{hp:HP.drum*4/g.difficulty.hp,time:Infinity,name:'雷鼓 · 拆四面亮鼓',transitionTime:0,complete:()=>r.drums.filter(p=>p.hp<=0).length>=4},function*(){
        let cursor=0;
        for(let k=0;;k++){
          yield* roam(e,g,k+1);
          const live=r.drums.filter(p=>p.hp>0);const lit=live[cursor++%live.length];
          for(const p of r.drums){p.frame=p===lit?1:0;p.data.targetDisabled=p!==lit;p.glow=p===lit?2:0.3;}
          e.data.action=k%2?'雷鼓引雷柱':'雷鼓亮鼓';
          e.data.weak={until:g.real+6.3,claimed:false};
          g.fx.charge(lit.x,lit.y,45,1,[.8,.3,1.4]);
          let pillar:Enemy|undefined;
          if(k%2)pillar=g.spawn(LightningPillar,lit.x,Math.max(650,lit.y+300));
          try {
            yield* wait(g,1);
            if(k%2===0){
              // 每面存活鼓发缺口环，朝下方中央留出可钻的扇口。
              thunderRing(g,r.drums.filter(p=>p.hp>0));yield* wait(g,1.3);
            }else yield* wait(g,2);
            e.data.action='雷鼓收招';yield* wait(g,2);
          }finally{if(pillar&&!pillar.dead)g.remove(pillar);}
          for(const p of r.drums){p.data.targetDisabled=true;p.frame=0;}
        }
      });
    }else for(const p of r.drums.slice(0,4)){p.hp=0;p.alpha=0;}
    for(const p of r.drums){p.data.targetDisabled=true;p.frame=0;}
    g.caption('','雷石 · 避侧雷，趁开芯',2.5);e.invulnerable=false;e.frame=1;r.core.alpha=1;r.spread=.7;g.clearBullets(false);
    yield* g.phase(e,{hp:HP.core/g.difficulty.hp,time:Infinity,name:'雷石 · 避侧雷，趁开芯',transitionTime:0,complete:()=>r.core.hp<=0},function*(){
      for(let k=0;;k++){
        e.frame=0;r.core.data.targetDisabled=true;r.core.alpha=0;yield* roam(e,g,k+2);
        e.data.action='雷石侧雷';r.tilt=(k%2?1:-1)*.22;
        const beams=[-1,1].map(side=>g.laser(e.x+side*160,e.y+55,PI/2+side*.1,{warn:1.2/g.difficulty.warn,duration:.65,width:54,color:'violet'}));
        try{yield* wait(g,1.85);}finally{for(const beam of beams)beam.kill();}
        e.frame=1;r.tilt=0;r.core.alpha=1;r.core.glow=2;r.core.data.targetDisabled=false;e.data.action='雷石开芯';e.data.weak={until:g.real+3,claimed:false};
        yield* wait(g,3);r.core.data.targetDisabled=true;
      }
    });
    r.stopped=true;r.core.data.targetDisabled=true;r.core.frame=1;r.core.glow=.2;e.data.action='雷石停机';g.clearBullets(false);
    for(const p of r.wings){p.parent=null;p.data.fall=g.presentationTime;p.data.x=p.x;p.data.y=p.y;g.fx.explosion(p.x,p.y,'s','fire');yield* wait(g,.35);}
    yield* wait(g,1.6);g.caption('','',.01);
  },
};
