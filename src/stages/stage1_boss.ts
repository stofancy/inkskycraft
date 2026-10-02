// 第一章独立首领：P3-04。正式关卡的护送、伙伴入队与通讯次序由P3-05接入。
// g.boss(...,{startPhase:1..3,warning:false})；data.bossResult/result事件供关卡读取。
import { director } from './dialogue1';
import { BOSS1_BALANCE } from './boss1_balance';
import { paperRegisterSvg } from '../art/paper-register';
import { burnEmit } from '../game/burn-fx';
import type { World } from '../game/world';
import type { Co, G } from '../game/api';
import { Scope } from '../core/tasks';
import { segDist2, pointInPoly } from '../core/math';
import type { Enemy, EnemyDef } from '../game/enemy';

const PI = Math.PI;
const COPPER_SCALE = 1.5, COPPER_Y = 230, COPPER_WEAK_HIT = 1.3;
const decorative = (sprite: string, order = 0): EnemyDef => ({ sprite, hp: 1, decorative: true, noCollide: true, drawOrder: order });
const hard = (g: G) => g.difficulty.intelligence === 1;
const easy = (g: G) => g.difficulty.intelligence === 0;
const count = (g: G, n: number, h: number) => hard(g) ? h : easy(g) ? Math.max(1, Math.round(n * .75)) : n;
const speed = (g: G, n: number) => n * (hard(g) ? 1.15 : easy(g) ? .85 : 1);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function* realWait(g: G, seconds: number, pose?: (t: number) => void): Co {
  const start = clock(g);
  while (clock(g) - start + 1e-8 < seconds) { pose?.(clamp((clock(g) - start) / seconds, 0, 1)); yield; }
  pose?.(1);
}
function* presentWait(g:G,seconds:number,pose:(t:number)=>void):Co {
  yield* g.present((function*():Co {const start=g.presentationTime;while(g.presentationTime-start+1e-8<seconds){pose(clamp((g.presentationTime-start)/seconds,0,1));yield;}pose(1);})());
}
function* move(g:G,e:Enemy,x:number,y:number,seconds:number):Co {
  const sx=e.x,sy=e.y;e.stop();
  yield* presentWait(g,seconds,t=>{const k=1-(1-t)**3;e.x=sx+(x-sx)*k;e.y=sy+(y-sy)*k;});
}
interface Fan { x: number; y: number; angle: number; n: number; spread: number }
// 按完整一轮核查池预算，显式射弹以免World.fan重复缩放难度。
function volley(g: G, fans: Fan[], cap: number, velocity: number, life: number, shape: 'rice' | 'orb' | 'petal', color: 'gold' | 'magenta'): void {
  const size=fans.reduce((sum,f)=>sum+f.n,0),existing=g.bulletCount(),attack=`volley(${shape},${color})`;
  if(existing+size>cap){g.recordAttackRejection(attack,size,existing,cap);return;}
  for (const f of fans) for (let i = 0; i < f.n; i++) {
    const a = f.angle + (f.n === 1 ? 0 : (i / (f.n - 1) - .5) * f.spread);
    g.shoot(f.x, f.y, a, velocity / g.difficulty.speed, { life, shape, color, attack });
  }
}
function event(e: Enemy, id: string, g: G): void {
  const events: { id: string; real: number }[] = e.data.events ??= [];
  if (!events.some(v => v.id === id)) events.push({ id, real: g.real });
}
interface Wing { beam: Enemy; shell: Enemy; lock: Enemy; gun: Enemy; broken: boolean; dropped: number; dropX:number; dropY:number }
interface CopperRig { wings:Wing[]; lids:Enemy[]; core:Enemy; tail:Enemy; leaves:Enemy[]; feet:Enemy[]; controller:Enemy; open:number }
function copperRig(e:Enemy,g:G):CopperRig {
 const surface=(sprite:string,order:number,priority=0):EnemyDef=>({sprite,hp:1e9,radius:0,noCollide:true,drawOrder:order,hitPriority:priority});
 const wings=['L','R'].map((side,i):Wing=>{
  const suffix=i===0?'-mirror':'';
  const beam=g.attach(e,surface(`tq-wing-beam${suffix}`,-2),`wing${side}`);
  const shell=g.attach(beam,surface(`tq-wing-shell${suffix}`,2),'shell');
  const lock=g.attach(beam,surface(`tq-wing-lock${suffix}`,4,20),'rootLock');
  const gun=g.attach(beam,surface(`tq-wing-gun${suffix}`,3,10),'gunSeat');
  // 炮管用两个相接的圆包住可见长条，沿长宽各放宽约三成。
  const [gx,gy]=gun.info.pivot;gun.def.hits=[[-gx,-gy-19,25*COPPER_WEAK_HIT],[-gx,-gy+19,25*COPPER_WEAK_HIT]];
  lock.radius=25*COPPER_WEAK_HIT;lock.data.wingHealth=true;
  return {beam,shell,lock,gun,broken:false,dropped:-1,dropX:0,dropY:0};
 });
 const core=g.attach(e,surface('tq-core',1,25),'core');core.radius=31*COPPER_WEAK_HIT;
 const lids=[g.attach(e,surface('tq-lid-half-mirror',5,30),'lidL'),g.attach(e,surface('tq-lid-half',5,30),'lidR')];
 const tail=g.attach(e,surface('tq-tail-base',-3),'tail');
 const leaves=['leafL','leafC','leafR'].map((a,i)=>g.attach(tail,surface('tq-tail-leaf',-4),a,{rot:(i-1)*.3}));
 const feet=[g.attach(e,surface('tq-foot-mirror',-1),'footL'),g.attach(e,surface('tq-foot',-1),'footR')];
 const controller=g.attach(e,surface('tq-controller',8,40),'core',{followRot:false});controller.def.hits=[[-controller.info.pivot[0],-controller.info.pivot[1],28*COPPER_WEAK_HIT]];controller.alpha=0;controller.data.targetDisabled=true;
 const all=[e,core,...lids,tail,...leaves,...feet,...wings.flatMap(a=>[a.beam,a.shell,a.lock,a.gun]),controller];
 // attach 只继承位置与旋转；每件统一缩放，再按父子次序对齐根轴。
 for(const p of all){p.scaleX=p.scaleY=COPPER_SCALE;p.syncToParent();p.phaseLock=true;p.data.contentRole='part';p.data.bossOwner=e;p.data.copperPart=true;p.data.damageTarget=e;p.data.hitArmor=true;p.data.damageBonus=1;}
 return {wings,core,lids,tail,leaves,feet,controller,open:0};
}
function* copperPose(e:Enemy,g:G,r:CopperRig):Co {
 for(;;){
  const age=g.presentationTime-(e.data.staggerAt??-100),impact=Math.max(0,1-age/.6);
  e.angle=Math.sin(age*35)*impact*.085;
  r.core.glow=r.open>.8?2.5:.15;
  // 胸甲打开时核心向玩家探出，迎弹面露在机身前缘。
  r.core.offY=r.open*68;
  r.controller.offY=68;
  r.lids.forEach((p,i)=>{if(p.data.falling)return;const sign=i?1:-1;p.offRot=sign*r.open*.9;p.offX=sign*(26.43+r.open*38);p.offY=-r.open*22;});
  for(const p of r.lids)if(p.data.falling){const t=g.presentationTime-p.data.falling.at;p.x=p.data.falling.x+p.data.falling.sign*t*130;p.y=p.data.falling.y+90*t+300*t*t;p.angle=p.data.falling.sign*t*2;p.alpha=Math.max(0,1-t/2);}
  for(const a of r.wings){a.lock.glow=e.data.phaseIndex===2&&!a.broken?2:.3;if(a.broken){const t=g.presentationTime-a.dropped;a.beam.x=a.dropX+(a.dropX<e.x?-1:1)*t*90;a.beam.y=a.dropY+100*t+330*t*t;a.beam.angle=(a.dropX<e.x?-1:1)*t*.8;if(t>2.2){a.beam.alpha=0;for(const p of [a.shell,a.gun,a.lock])p.alpha=0;}}}
  yield;
 }
}
function copperBreak(e:Enemy,g:G,p:Enemy):void {
 const w=world(g);e.data.staggerAt=g.presentationTime;e.angle=.085;w.hitstop(.12);g.fx.explosion(p.x,p.y,'m','fire');g.fx.shake(.12);w.r.debris.spawn(w.r.partHigh.time,p.x,p.y,1,12,.63,'fire');
}
function* copperRetreat(e:Enemy,g:G):Co {e.invulnerable=true;e.data.copperLaser?.kill();g.clearBullets(false);yield* move(g,e,450,e.y-38,.5);yield* move(g,e,450,COPPER_Y,.45);e.invulnerable=false;}
function presentationPose(e:Enemy,co:Co):void {const scope=new Scope(e.scope);scope.presentation=true;scope.run(co);}
function copperFans(r: CopperRig, g: G, n: number, h: number, spread: number, aimed = false): Fan[] {
  return r.wings.filter(w => !w.broken).map(w => { const p = w.gun.anchor('gun'); return { ...p, n: count(g, n, h), spread, angle: aimed ? g.aim(p.x, p.y) : PI / 2 }; });
}
function world(g:G):World{return g as World;}
function clock(g:G):number{return world(g).bossCombat.clock;}
function say(g:G,section:string,trigger:string,long=false){return director(g)?.event(`B-${section}-${trigger}`,long);}
function mode(g:G,name:string,kind:'对白演出'|'机制段'|'打血时间'):void{world(g).bossCombat.mode(name,kind);}
function* responseWatch(e:Enemy,g:G,sections:string[]):Co{let hitSeen=0,hitAt=-100,hitCount=0;const low=new Set<number>();for(;;){const p=e.data.phaseIndex,section=sections[p-1];if(section&&e.data.playerHits>hitSeen){hitSeen=e.data.playerHits;if(g.real-hitAt>=15&&hitCount<4){hitAt=g.real;hitCount++;say(g,section,p===1&&e.def.name==='铜雀'?'玩家首次中弹':'玩家中弹');}}
 if(section&&e.hp<=e.maxHp*.2&&!low.has(p)){low.add(p);say(g,section,e.def.name==='纸龙'?'P1 HP≤20%':p===3?'低血量':`T${p} HP≤20%`);}yield;}}
function* copper(e:Enemy,g:G):Co {
 const w=world(g),r=copperRig(e,g);e.data.rig=r;e.data.bossCombat=true;e.data.copperSimple=true;e.data.weakCustom=true;w.bossCombat.beginBattle(e);presentationPose(e,copperPose(e,g,r));e.run(responseWatch(e,g,['4.2','4.3','4.6']));
 const start=Math.min(3,e.data.startPhase??1);g.scrollSpeed(25,2);e.invulnerable=true;
 const parts=[e,r.core,...r.lids,r.tail,...r.leaves,...r.feet,...r.wings.flatMap(a=>[a.beam,a.shell,a.lock,a.gun]),r.controller];
 const route=(target:Enemy)=>{for(const p of parts){p.data.damageTarget=target;p.data.damageBonus=1;p.data.hitArmor=true;}};
 const begin=(index:number,name:string)=>{e.data.phaseIndex=index;e.data.phaseStartedClock=clock(g);e.data.phaseTitle=name;e.data.phaseTitleUntil=g.real+1.2;e.data.action=name;event(e,`phase-${index}`,g);mode(g,name,'打血时间');};
 const breakChest=()=>{for(const p of r.lids){if(p.data.falling)continue;copperBreak(e,g,p);p.data.targetDisabled=true;p.parent=null;p.data.falling={at:g.presentationTime,x:p.x,y:p.y,sign:p===r.lids[0]?-1:1};}event(e,'chest-shattered',g);};
 try {
  mode(g,'铜雀展翼','对白演出');const intro=start===1?say(g,'4.1','铜雀展翼挡口',true):undefined;yield* move(g,e,450,COPPER_Y,start===1?3:.5);if(intro)while(!intro.done)yield;e.invulnerable=false;
  if(start<=1){begin(1,'胸甲');route(e);yield* g.phase(e,{hp:BOSS1_BALANCE.copper[0].hp/.85,time:Infinity,clock:'boss',transitionTime:0,complete:()=>e.hp<=0},function*(){
   const at=clock(g);let shot=g.t,beam=clock(g)+5,weaks=0,hp0=e.hp,wasOpen=false,fired=false;
   for(;;){const t=(clock(g)-at)%6;r.open=t<3?Math.min(1,t/.2):Math.max(0,1-(t-3)/.2);r.core.data.targetDisabled=r.open<.85;r.core.data.damageBonus=2;r.core.data.hitArmor=false;
    if(r.open>.85&&!wasOpen){wasOpen=true;hp0=e.hp;fired=false;}else if(r.open<.3)wasOpen=false;
    if(wasOpen&&!fired&&weaks<2&&e.hp<=hp0-e.maxHp*.05){fired=true;weaks++;w.bossCaps.openWeak(e,'胸甲洞开');}
    if(g.t>=shot){volley(g,copperFans(r,g,4,5,.45),60,speed(g,150),4,'rice','gold');shot=g.t+1.1;}
    if(clock(g)>=beam){const x=g.player.x;e.data.copperLaser=g.laser(x,r.core.y,PI/2,{width:70,warn:1,duration:.8,clock:'real'});beam=clock(g)+6;}yield;
   }
   });breakChest();yield* copperRetreat(e,g);say(g,'4.2','转场');}else for(const p of r.lids){p.alpha=0;p.data.targetDisabled=true;}
  if(start<=2){begin(2,'双翼');r.open=1;route(e);g.unlockBrush('竖');
   yield* g.phase(e,{hp:BOSS1_BALANCE.copper[1].hp/.85,time:Infinity,clock:'boss',transitionTime:0,complete:()=>r.wings.every(a=>a.broken)},function*(){
    for(const a of r.wings){a.lock.hp=a.lock.maxHp=e.maxHp/2;for(const p of [a.beam,a.shell,a.lock,a.gun])p.data.damageTarget=a.lock;for(const p of [a.lock,a.gun]){p.data.damageBonus=2;p.data.hitArmor=false;}}
    let shot=g.t,stroke=w.brush.lastStroke?.id??0;
    for(;;){const drawn=w.brush.lastStroke;if(drawn&&drawn.id!==stroke){stroke=drawn.id;if(drawn.form==='竖')for(const a of r.wings)if(!a.broken&&drawn.pts.some((_,i)=>i%2===0&&i+3<drawn.pts.length&&segDist2(a.lock.x,a.lock.y,drawn.pts[i],drawn.pts[i+1],drawn.pts[i+2],drawn.pts[i+3])<=(a.lock.radius*COPPER_SCALE+18)**2))w.damage(a.lock,a.lock.hp,a.lock.x,a.lock.y,true,'qte');}
     for(const a of r.wings)if(!a.broken&&a.lock.hp<=0){a.broken=true;w.bossCaps.openWeak(e,'炮管折断');a.dropped=g.presentationTime;a.dropX=a.beam.x;a.dropY=a.beam.y;a.beam.parent=null;for(const p of [a.beam,a.shell,a.lock,a.gun])p.data.targetDisabled=true;copperBreak(e,g,a.lock);event(e,a===r.wings[0]?'left-gun-off':'right-gun-off',g);}
     const intact=r.wings.filter(a=>!a.broken);for(const p of [e,r.core,r.tail,...r.leaves,...r.feet])p.data.damageTarget=intact.reduce<Wing|undefined>((a,b)=>!a||Math.abs(p.x-b.lock.x)<Math.abs(p.x-a.lock.x)?b:a,undefined)?.lock??e;
     if(g.t>=shot){volley(g,copperFans(r,g,5,6,.5,true),60,speed(g,155),4,'petal','magenta');shot=g.t+.85;}yield;
    }
   });yield* copperRetreat(e,g);
  }else for(const a of r.wings){a.broken=true;for(const p of [a.beam,a.shell,a.lock,a.gun]){p.alpha=0;p.data.targetDisabled=true;}}
  begin(3,'控制器');r.open=1;r.core.alpha=0;r.core.data.targetDisabled=true;r.controller.alpha=1;r.controller.data.targetDisabled=false;route(r.controller);r.controller.data.damageBonus=2;r.controller.data.hitArmor=false;
  let sealed=false;
  yield* g.phase(e,{hp:BOSS1_BALANCE.copper[2].hp/.85,time:Infinity,clock:'boss',transitionTime:0,complete:()=>sealed},function*(){
   r.controller.hp=r.controller.maxHp=e.maxHp;let shot=g.t,sealAt=-1,weaks=0;
   for(;;){
    if(sealAt<0&&((weaks===0&&e.hp<=e.maxHp*.6)||(weaks===1&&e.hp<=e.maxHp*.3))){weaks++;w.bossCaps.openWeak(e,'控制器过热');}
    if(r.controller.hp<=0){if(sealAt<0){sealAt=g.real;e.data.sealWindow=true;r.controller.data.lastSealedAt=undefined;g.clearBullets(false);e.stop();r.controller.data.sealReadyAt=w.t;}
     if((r.controller.data.lastSealedAt??-1)>=r.controller.data.sealReadyAt){sealed=true;e.data.bossResult='sealed';e.data.controlStopped=true;event(e,'control-sealed',g);r.controller.data.targetDisabled=true;copperBreak(e,g,r.controller);say(g,'4.6','封成功');}
     else if(g.real-sealAt>=8){r.controller.hp=e.hp=e.maxHp*.2;sealAt=-1;e.data.sealWindow=false;event(e,'seal-recovered',g);}
    }else if(g.t>=shot){const p=r.controller.anchor('root');volley(g,[{...p,n:count(g,9,11),angle:PI/2,spread:1.1}],60,speed(g,150),4,'orb','gold');volley(g,[{...p,n:7,angle:g.aim(p.x,p.y),spread:.65}],60,speed(g,185),4,'petal','magenta');shot=g.t+.55;}yield;
   }
  });e.data.sealWindow=false;e.data.assisted=false;yield* realWait(g,1.2);
 }finally{w.bossCombat.endBattle(e);e.data.sealWindow=false;e.charging=false;}
}

export const Sparrow: EnemyDef = {
  name: '铜雀', sprite: 'tq-body', hp: 1, radius: 52, score: 100000, drops: ['p', 'p'],
  deform: { breath: .015, speed: 2, weight: [0, 1] }, boss: { name: '铜雀', music: 'boss', phases: 3, defeat: 'disable' },
  onLoosenArmor(e, g, seconds) {
    e.data.armorLoose = true;
    const r: CopperRig | undefined = e.data.rig;
    if (r) { r.open = 1; for (const w of r.wings) w.lock.armorLoose = Math.max(w.lock.armorLoose, seconds); }
    event(e, 'armor-loosened', g);
  },
  ai: copper,
};

// 纸龙沿用铜雀的受击、单血条、段名、顿帧和碎片通道。
const PAPER_SCALE = 2.18;/* 放大约 1.5 倍 */
const PAPER_SCAN = { swing: .30, halfWidth: .10, sweep: 2, warning: 1, firstWarning: 2, rest: 3, length: 1600 };
interface PaperClaw { part:Enemy; broken:boolean; at:number; x:number; y:number }
interface PaperRow { part:Enemy; name:string; burnedAt:number; ship:number }
interface PaperChain { claw:PaperClaw; nodes:Enemy[]; ship:number; warnUntil:number; cut:boolean; nextHit:number }
interface PaperBurn { part:Enemy; x:number; y:number; at:number; until:number; next:number }
interface PaperRig {
 bodies:Enemy[]; hinges:Enemy[]; lid:Enemy; eye:Enemy; tail:Enemy; stamp:Enemy;
 claws:PaperClaw[]; rows:PaperRow[]; burns:PaperBurn[]; chains:PaperChain[];
 // 共用表现读取 wings；纸爪小血条由纸龙自身绘制，沿用同样的宽度/颜色。
 wings:Wing[]; core:Enemy; readonly controller:Enemy;
 open:boolean; scanAngle:number; scanAge:number; scanWarning:number; scanDirection:number; bare:number; stampProgress:number;
 seal:{active:boolean;row:number;x:number;y:number;start:number;lit:number}; sealed:boolean[]; taught:boolean; stampHp:number; stampH:number; lockShip:{i:number;x:number;y:number}|null; struggleAt:number;
 shipOffsets:{x:number;y:number}[]; shipHp:number[];
 fly:{on:boolean;T:number;mode:number;off:{x:number;y:number};hist:{x:number;y:number}[];hd:number;mirror:boolean};
}
function paperRig(e:Enemy,g:G):PaperRig {
 const surface=(sprite:string,order=0,priority=0):EnemyDef=>({sprite,hp:1e9,radius:0,drawOrder:order,hitPriority:priority});
 const bodies=Array.from({length:5},()=>g.spawn(surface('pd-body',-3),450,300));
 const hinges=bodies.map(b=>g.attach(b,surface('pd-hinge',1),'jointIn'));
 const lid=g.attach(e,surface('pd-eye-lid',5,30),'eye');
 const eye=g.attach(e,surface('pd-hinge',4,25),'eye');eye.radius=17*1.3;
 const tail=g.attach(bodies[4],surface('pd-tail',-2),'tail');
 const stamp=g.spawn({...decorative('pd-stamp',7)},450,160);stamp.scaleX=stamp.scaleY=4.2;stamp.alpha=0;
 const claws=[0,1].map(i=>({part:g.attach(bodies[i?3:1],surface('pd-register',6,20),'register',{followRot:false}),broken:false,at:0,x:0,y:0}));
 const r:PaperRig={bodies,hinges,lid,eye,tail,stamp,claws,rows:[],burns:[],chains:[],wings:[],core:eye,get controller(){return this.rows.find(a=>a.part.hp>0)?.part??e;},open:false,scanAngle:PI/2,scanAge:0,scanWarning:2,scanDirection:1,bare:0,stampProgress:0,seal:{active:false,row:-1,x:450,y:900,start:0,lit:-1},sealed:[false,false,false,false],taught:false,stampHp:1,stampH:1,lockShip:null,struggleAt:-9,fly:{on:false,T:0,mode:0,off:{x:0,y:0},hist:[],hd:PI,mirror:false},shipOffsets:Array.from({length:3},()=>({x:0,y:0})),shipHp:[100,100,100]};
 for(const p of [e,...bodies,...hinges,lid,eye,tail,...claws.map(a=>a.part)]){
  p.scaleX=p.scaleY=PAPER_SCALE;
  p.phaseLock=true;p.data.contentRole='part';p.data.bossOwner=e;p.data.copperPart=true;p.data.damageTarget=e;p.data.damageBonus=1;p.data.hitArmor=true;p.data.noSupplementFire=true;
  p.def.onHit=(part,_g,x,y,source)=>{
   if(source!=='red'||part===eye||r.bare>=1||e.invulnerable)return;
   const dx=x-part.x,dy=y-part.y,c=Math.cos(part.angle),s=Math.sin(part.angle),local={x:(dx*c+dy*s)/(part.scaleX*(part.mirror?-1:1)),y:(-dx*s+dy*c)/part.scaleY},old=r.burns.find(b=>b.part===part&&Math.hypot(b.x-local.x,b.y-local.y)<24);
   if(old)old.until=clock(g)+3;else {r.burns.push({part,x:local.x,y:local.y,at:clock(g),until:clock(g)+3,next:clock(g)+.5});if(r.burns.length>24)r.burns.shift();}
  };
 }
 for(const a of claws){a.part.data.targetDisabled=true;a.part.alpha=0;}
 eye.data.hitArmor=false;eye.data.damageBonus=2;eye.data.targetDisabled=true;
 return r;
}
/** 宽弧回转容纳刚性龙节；最小转弯半径约 128，避免折返时相邻纸甲叠在一起。 */
function paperPath(mode:number,T:number):{x:number;y:number}{
 if(mode===3)return {x:450+200*Math.sin(.3*T),y:150+160*Math.cos(.3*T)};
 // 钩船段龙爪是要被打的目标，移动放缓、不俯冲，保证火力追得上。
 if(mode===2)return {x:450+170*Math.sin(.28*T),y:250+160*Math.cos(.28*T)};
 const a=.42*T-1.37;
 return {x:450+250*Math.sin(a),y:270+180*Math.cos(a)};
}
function* paperPose(e:Enemy,g:G,r:PaperRig):Co {
 let previous=g.presentationTime;
 for(;;){
  const dt=world(g).dialoguePaused?0:Math.min(.05,g.presentationTime-previous);previous=g.presentationTime;
  const f=r.fly,h=f.hist;
  // 入场先铺足整条龙的路径；睁眼期间保留姿态与路径时钟。
  if(!f.on){
   const mode=e.data.startPhase??1,rate=mode===3?.3:mode===2?.28:.42,base=paperPath(mode,0);
   h.length=0;for(let t=-2*PI/rate;t<0;t+=.08){const p=paperPath(mode,t);h.push({x:p.x+e.x-base.x,y:p.y+e.y-base.y});}
   h.push({x:e.x,y:e.y});
  }
  if(f.on&&!r.open&&dt>0){
   const mode=e.data.phaseIndex===3?3:e.data.phaseIndex===2?2:1,T=f.T+=dt;
   const tg=paperPath(mode,T);
   if(f.mode!==mode){f.off={x:e.x-tg.x,y:e.y-tg.y};f.mode=mode;}
   const k=Math.exp(-dt*1.4);f.off.x*=k;f.off.y*=k;
   e.x=tg.x+f.off.x;e.y=tg.y+f.off.y;
  }
  {const last=h[h.length-1];
   // 已采样点不覆盖，小位移持续累积到下一采样点；最新龙头单独参与求解。
   if(Math.hypot(e.x-last.x,e.y-last.y)>=3)h.push({x:e.x,y:e.y});
   let i=h.length-1,cursor={x:e.x,y:e.y};
   // 沿同一历史折线找定长弦的尾端，让刚性部件的两个挂点都落在路径上。
   const back=(from:{x:number;y:number},length:number)=>{
    while(i>=0){const end=h[i],dx=end.x-cursor.x,dy=end.y-cursor.y;
     if(Math.hypot(end.x-from.x,end.y-from.y)>=length){
      const ox=cursor.x-from.x,oy=cursor.y-from.y,A=dx*dx+dy*dy,B=ox*dx+oy*dy,C=ox*ox+oy*oy-length*length;
      const u=(-B+Math.sqrt(Math.max(0,B*B-A*C)))/A;
      cursor={x:cursor.x+dx*u,y:cursor.y+dy*u};return cursor;
     }
     cursor=end;i--;
    }
    // 阶段换路时沿最早一段延长，保持尾节分开。
    const a=h[0],b=h[1],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||1;
    cursor={x:from.x+dx/d*length,y:from.y+dy/d*length};return cursor;
   };
   let joint=back({x:e.x,y:e.y},-e.info.anchors.neck[1]*e.scaleY);
   f.hd=Math.atan2(e.y-joint.y,e.x-joint.x);
   const c=Math.cos(f.hd);if(c>.2)f.mirror=true;else if(c<-.2)f.mirror=false;
   // 龙头原图朝下；镜像只翻横轴，朝向连续，整条共用镜像状态。
   e.mirror=f.mirror;e.angle=f.hd-PI/2;
   r.bodies.forEach((b,n)=>{
    const top=b.info.anchors.jointIn,bottom=b.info.anchors.jointOut;
    const end=back(joint,(bottom[1]-top[1])*b.scaleY);
    b.mirror=f.mirror;b.angle=Math.atan2(end.y-joint.y,end.x-joint.x)-PI/2;
    b.x=joint.x;b.y=joint.y;const root=b.local(...top);b.x+=joint.x-root.x;b.y+=joint.y-root.y;
    // 铰节中心对齐共用挂点；独立龙身没有 parent，直接同步它的挂载件。
    r.hinges[n].mirror=f.mirror;r.hinges[n].syncToParent();joint=end;
   });
   // 保留实际尾端后方的余量，裁剪与本帧使用的路径位置一致。
   let margin=0;while(i>0&&margin<200){margin+=Math.hypot(h[i].x-h[i-1].x,h[i].y-h[i-1].y);i--;}
   if(i>1)h.splice(0,i-1);
   for(const p of [r.lid,r.eye,r.tail])p.mirror=f.mirror;
  }
  r.lid.offY=e.info.anchors.eye[1]-(r.open?22:0);r.lid.offRot=r.open?-.8:0;r.eye.alpha=r.open?1:0;r.eye.glow=r.open?2:0;
  for(const a of r.claws){if(!a.broken){a.part.offY=85;a.part.glow=e.data.phaseIndex===2?1.7:0;}else{const t=g.presentationTime-a.at;a.part.x=a.x+(a.x<450?-1:1)*100*t;a.part.y=a.y+90*t+300*t*t;a.part.angle=t*2;a.part.alpha=Math.max(0,1-t/2.2);}}
  const ships=world(g).escort?.vessels;
  if(e.data.phaseIndex===2)for(const c of r.chains)if(!c.cut){
   const ship=ships?.[c.ship];if(!ship)continue;
   if(clock(g)>=c.warnUntil){const dx=c.claw.part.x-ship.x,dy=c.claw.part.y-ship.y,d=Math.hypot(dx,dy)||1,step=Math.min(d,54*dt);const esc=world(g).escort;if(esc?.follow){const pl=esc.pull[c.ship];pl.x=Math.max(-220,Math.min(220,pl.x+dx/d*step));pl.y=Math.max(-220,Math.min(220,pl.y+dy/d*step));}else if(ship===world(g).escort?.scene){ship.x+=dx/d*step;ship.y+=dy/d*step;}else{r.shipOffsets[c.ship].x+=dx/d*step;r.shipOffsets[c.ship].y+=dy/d*step;}}
   c.nodes.forEach((p,i)=>{const t=(i+1)/(c.nodes.length+1);p.x=c.claw.part.x+(ship.x-c.claw.part.x)*t;p.y=c.claw.part.y+(ship.y-c.claw.part.y)*t;p.angle=Math.atan2(ship.y-c.claw.part.y,ship.x-c.claw.part.x)-PI/2;p.alpha=clock(g)>=c.warnUntil?1:0;});
  }
  {const esc=world(g).escort;if(esc?.follow)for(let i=0;i<3;i++)if(!(e.data.phaseIndex===2&&r.chains.some(c=>!c.cut&&c.ship===i&&clock(g)>=c.warnUntil))){const pl=esc.pull[i];const k=Math.max(0,1-3*dt);pl.x*=k;pl.y*=k;}}
  if(e.data.phaseIndex===3){const sl=r.seal;r.stamp.alpha=sl.active?1:0;const p=r.stampProgress;r.stamp.x=sl.x;r.stamp.y=sl.y-60;r.stamp.scaleX=r.stamp.scaleY=4.2*(1+.55*r.stampH);}
  yield;
 }
}
function paperCut(g:G,c:PaperChain):void {
 if(c.cut)return;c.cut=true;for(const p of c.nodes)g.remove(p);g.fx.burst(c.claw.part.x,c.claw.part.y+100,18,150,[1.5,.45,.1]);
}
function paperChain(e:Enemy,g:G,r:PaperRig,a:PaperClaw,index:number):void {
 const c:PaperChain={claw:a,nodes:[],ship:index%3,warnUntil:clock(g)+1,cut:false,nextHit:0};
 // 整条可见链均可射断；统一计数，朱色2发、其他主炮8发。
 for(let i=0;i<7;i++){
  const p=g.spawn({sprite:'pd-register',hp:1e6,radius:0,hitPriority:50,score:0,noCollide:true,onHit:(part,_g,_x,_y,source)=>{
   const now=clock(g);if(c.cut||now<c.nextHit)return;c.nextHit=now+.07;c.nodes[0].data.chainHits=(c.nodes[0].data.chainHits??0)+(source==='red'?4:1);if(c.nodes[0].data.chainHits>=24){paperCut(g,c);event(e,'chain-burned',g);}
  }},450,500);
  p.scaleX=.38;p.scaleY=1.6;p.phaseLock=true;p.data.contentRole='prop';p.data.targetDisabled=false;p.data.noSupplementFire=true;p.data.copperPart=true;p.data.hitArmor=true;c.nodes.push(p);
 }
 r.chains.push(c);event(e,'chain-cast',g);
}
const SCROLL_CX=430,SCROLL_TOP=370,STAMP_HP=2400;
function sealSvg(e:Enemy,g:G,r:PaperRig):string {
 let out='';const ships=world(g).escort?.vessels,sl=r.seal;
 // 已落印的船：金锁链交叉缠在船身上，直到对应的签被烧掉。
 r.sealed.forEach((on,i)=>{const s=i<3?ships?.[i]:undefined;if(on&&s)out+=`<g stroke="#e8c15a" stroke-width="5" stroke-dasharray="10 4" fill="none"><path d="M${s.x-40} ${s.y-45}L${s.x+40} ${s.y+45}M${s.x+40} ${s.y-45}L${s.x-40} ${s.y+45}"/><ellipse cx="${s.x}" cy="${s.y}" rx="52" ry="68"/></g>`;});
 if(sl.active){
  const p=r.stampProgress,H=r.stampH,t=g.presentationTime,locked=r.lockShip!==null||r.seal.lit===3,pulse=.5+.5*Math.sin(t*12),sx=sl.x,sy=sl.y-60;
  // 投影：大印越高影子越大越淡，砸下时收拢
  out+=`<ellipse cx="${sx}" cy="${sl.y+8}" rx="${58+60*H}" ry="${44+44*H}" fill="#000" opacity="${.38-.18*H}"/>`;
  if(locked){
   const R=95-58*p,flash=t-r.struggleAt<.18,col=flash?'#fff':'#d8402a',n=14;
   // 朱砂印环：收紧即倒计时；挣扎时闪白
   out+=`<g transform="rotate(${t*30} ${sl.x} ${sl.y})"><circle cx="${sl.x}" cy="${sl.y}" r="${R}" fill="#8f1f1428" stroke="${col}" stroke-width="${flash?8:5}" opacity="${.8+.2*pulse}"/><circle cx="${sl.x}" cy="${sl.y}" r="${R+14}" fill="none" stroke="#f0c76a" stroke-width="2" stroke-dasharray="6 6"/>`;
   for(let k=0;k<n;k++){const a=k/n*2*PI;out+=`<text x="${sl.x+Math.cos(a)*(R+26)}" y="${sl.y+Math.sin(a)*(R+26)+7}" font-size="20" text-anchor="middle" fill="${col}" transform="rotate(${a*180/PI+90} ${sl.x+Math.cos(a)*(R+26)} ${sl.y+Math.sin(a)*(R+26)})">${'封查令印'[k%4]}</text>`;}
   out+='</g>';
   // 锁链：从大印四角垂到印环
   for(const [dx,ang] of [[-46,PI*1.25],[46,PI*1.75],[-46,PI*.75],[46,PI*.25]]){out+=`<path d="M${sx+dx} ${sy+30}L${sl.x+Math.cos(ang)*R} ${sl.y+Math.sin(ang)*R}" stroke="#e8c15a" stroke-width="4" stroke-dasharray="9 5" opacity=".9"/>`;}
  }
  {const by=sy-9.7*4.2*(1+.55*H)-22;out+=`<rect x="${sx-62}" y="${by}" width="124" height="12" fill="#1a1210" stroke="#e8c15a" stroke-width="2"/><rect x="${sx-60}" y="${by+2}" width="${120*Math.max(0,r.stampHp)}" height="8" fill="#d03a24"/>`;}
  // 教学：第一次划成功之前，提示文字加一道反复播放的笔画虚影
  if(!r.taught){
   const row=0,rx=SCROLL_CX,ry=SCROLL_TOP+75+row*45,t=(g.presentationTime%1.8)/1.1,k=Math.min(1,t),x1=rx-70+140*k;
   out+=`<path d="M${rx-70} ${ry+2}L${x1} ${ry+2}" stroke="#fff" stroke-width="11" stroke-linecap="round" opacity="${t>1?Math.max(0,1-(t-1)/.6)*.6:.6}"/><circle cx="${x1}" cy="${ry+2}" r="9" fill="#ffe9a8" opacity="${t>1?0:.8}"/>`;
   out+=`<text x="${SCROLL_CX+150}" y="${ry-8}" font-size="34" fill="#fff" stroke="#201010" stroke-width="5" paint-order="stroke" font-weight="bold">执笔划掉</text><text x="${SCROLL_CX+150}" y="${ry+32}" font-size="34" fill="#fff" stroke="#201010" stroke-width="5" paint-order="stroke" font-weight="bold">条目</text><text x="${SCROLL_CX+150}" y="${ry+62}" font-size="20" fill="#f0d9a0" stroke="#201010" stroke-width="3" paint-order="stroke">按住右键横划。圈住大印可以封它</text>`;
  }
 }
 return out;
}
function paperSvg(e:Enemy,g:G,r:PaperRig):string {
 let out='';const ships=world(g).escort?.vessels;
 if(e.data.phaseIndex===1&&r.open){out+=`<circle cx="${r.eye.x}" cy="${r.eye.y}" r="24" fill="#cc6f3630" stroke="#ffe89c" stroke-width="3"/><circle cx="${r.eye.x}" cy="${r.eye.y}" r="8" fill="#341b15"/>`;
  const warning=r.scanAge<r.scanWarning,spread=warning?PAPER_SCAN.swing+PAPER_SCAN.halfWidth:PAPER_SCAN.halfWidth;
  const pts=paperScanFan(r,warning?PI/2:r.scanAngle,spread);
  const fan=`M${pts[0]} ${pts[1]}L${pts[2]} ${pts[3]}L${pts[4]} ${pts[5]}Z`;
  out+=`<path d="${fan}" fill="${warning?'#fff2be16':'#efba4850'}"/>`;
  if(warning){
   const x=r.eye.x,y=r.eye.y,len=300,start=PI/2-r.scanDirection*PAPER_SCAN.swing,end=PI/2+r.scanDirection*PAPER_SCAN.swing;
   const ex=x+Math.cos(end)*len,ey=y+Math.sin(end)*len,tangent=end+r.scanDirection*PI/2;
   out+=`<path d="${fan}" fill="none" stroke="#ffe5a060" stroke-width="1" stroke-dasharray="12 9"/><path d="M${x+Math.cos(start)*len} ${y+Math.sin(start)*len}A${len} ${len} 0 0 ${r.scanDirection>0?1:0} ${ex} ${ey}M${ex-20*Math.cos(tangent-.5)} ${ey-20*Math.sin(tangent-.5)}L${ex} ${ey}L${ex-20*Math.cos(tangent+.5)} ${ey-20*Math.sin(tangent+.5)}" fill="none" stroke="#ffe5a0" stroke-width="4"/>`;
  }
 }
 for(const c of r.chains)if(!c.cut){const s=ships?.[c.ship],warning=clock(g)<c.warnUntil;if(s)out+=`<path d="M${c.claw.part.x} ${c.claw.part.y}L${s.x} ${s.y}" stroke="${warning?'#f6bc63':'#e0c98a'}" stroke-width="${warning?4:9}" stroke-dasharray="${warning?'18 10':'14 5'}"/>`;}
 if(e.data.phaseIndex===2)for(const a of r.claws)if(!a.broken){const p=a.part;out+=`<rect x="${p.x-49}" y="${p.y-65}" width="98" height="6" fill="#20232a"/><rect x="${p.x-49}" y="${p.y-65}" width="${98*p.hpFrac}" height="6" fill="#de6049"/>`;}
 for(const a of r.claws)if(a.broken&&a.part.alpha>.01){const p=a.part;out+=`<path d="M${p.x-25} ${p.y}q-15 -35 5 -55q0 28 18 25q18 -18 10 -45q40 40 13 75Z" fill="#ff9e3b" opacity="${p.alpha}"/>`;}
 if(r.bare>0){
  out+=`<g opacity="${r.bare}" fill="none" stroke="#c8a565" stroke-width="6"><path d="M${e.x-34} ${e.y-45}L${e.x+34} ${e.y-45}L${e.x+28} ${e.y+42}L${e.x} ${e.y+70}L${e.x-28} ${e.y+42}Z M${e.x-28} ${e.y+20}H${e.x+28}M${e.x} ${e.y-45}V${e.y+70}"/></g>`;
  // 纸层从每节外缘向内卷，贴图退去后用现有挂载面画竹骨。
  for(const b of r.bodies){const x=b.x,y=b.y,k=r.bare;out+=`<g opacity="${k}" stroke="#c8a565" fill="none" stroke-width="6"><path d="M${x-56} ${y}H${x+56}M${x-40} ${y-42}V${y+42}M${x} ${y-48}V${y+48}M${x+40} ${y-42}V${y+42}"/></g>`;if(k<1)out+=`<ellipse cx="${x}" cy="${y}" rx="${60*(1-k)}" ry="${52*(1-k)}" fill="none" stroke="#ff9a37" stroke-width="10"/>`;}
 }
 if(e.data.phaseIndex===3){
  out+=paperRegisterSvg(r.rows.map(row=>{
   // 最后一签击破会直接进入收尾；单独记录画面时间，保留阶段完成时机。
   const burnedAt=row.burnedAt;
   return {x:row.part.x,y:row.part.y,name:row.name,hp:Number.isFinite(burnedAt)?0:1,hpFrac:1,burnedAt};
  }),g.presentationTime,{cx:SCROLL_CX,top:SCROLL_TOP,lit:-1});
  out+=sealSvg(e,g,r);
 }
 return out;
}
// 光束绘制和伤害共用同一个有限三角形。
function paperScanFan(r:PaperRig,angle:number,spread:number):number[]{
 const x=r.eye.x,y=r.eye.y,len=PAPER_SCAN.length;
 return [x,y,x+Math.cos(angle-spread)*len,y+Math.sin(angle-spread)*len,x+Math.cos(angle+spread)*len,y+Math.sin(angle+spread)*len];
}
function* paper(e:Enemy,g:G):Co {
 const w=world(g),r=paperRig(e,g);e.data.rig=r;e.data.bossCombat=true;e.data.copperSimple=true;e.data.paperSimple=true;e.data.weakCustom=true;
 e.data.paperEffects={svg:()=>paperSvg(e,g,r),stats:{rows:4,chainShipHits:0,stampHits:0}};
 w.bossCombat.beginBattle(e);presentationPose(e,paperPose(e,g,r));g.scrollSpeed(25,2);
 const escort=w.escort,updateShips=escort?.update;
 if(escort&&updateShips)escort.update=function(dt){updateShips.call(this,dt);if(r.lockShip){const s=this.vessels[r.lockShip.i];if(s){s.x=r.lockShip.x;s.y=r.lockShip.y;}}this.vessels.forEach((s,i)=>{if(s!==this.scene){s.x+=r.shipOffsets[i].x;s.y+=r.shipOffsets[i].y;}});};
 const start=Math.min(3,e.data.startPhase??1),surfaces=[e,...r.bodies,...r.hinges,r.lid,r.tail];
 const begin=(index:number,name:string)=>{e.data.phaseIndex=index;e.data.phaseStartedClock=clock(g);e.data.phaseTitle=name;e.data.phaseTitleUntil=g.real+1.2;e.data.action=name;event(e,`phase-${index}`,g);mode(g,name,'打血时间');};
 const route=(target:Enemy)=>{for(const p of surfaces)p.data.damageTarget=target;};
 let burnAt=clock(g);
 const burnTick=()=>{const now=clock(g),dt=Math.min(.05,now-burnAt);burnAt=now;
  for(const b of r.burns)if(now<b.until){const p=b.part.local(b.x,b.y);burnEmit(w,b.part,now-b.at,dt,p);
   if(now>=b.next){b.next=now+.5;w.damage(b.part,3,p.x,p.y,true,'neutral',{tag:'burn'});}
  }r.burns=r.burns.filter(b=>now<b.until);
 };
 const transition=function*(bare=false):Co{
  e.invulnerable=true;g.clearBullets(false);r.open=false;r.eye.data.targetDisabled=true;r.burns=[];
  for(const p of [e,...r.bodies])copperBreak(e,g,p);
  mode(g,'纸片烧落','对白演出');
  yield* presentWait(g,1.5,t=>{if(bare){r.bare=t;for(const p of [e,...r.bodies,r.lid,r.tail])p.alpha=Math.max(.02,1-t);}});
  e.invulnerable=false;
 };
 try{
  e.invulnerable=true;mode(g,'纸龙巡检','对白演出');yield* move(g,e,205,300,start===1?1:.3);r.fly.on=true;e.invulnerable=false;
  if(start<=1){begin(1,'巡检');route(e);
   yield* g.phase(e,{hp:BOSS1_BALANCE.paper[0].hp/.85,time:Infinity,clock:'boss',transitionTime:0,complete:()=>e.hp<=0},function*(){
    const at=clock(g);let next=g.t,weaks=0,weakAt=0,sprayNext=g.t;
    for(;;){const elapsed=clock(g)-at,firstCycle=PAPER_SCAN.firstWarning+PAPER_SCAN.sweep+PAPER_SCAN.rest,cycle=PAPER_SCAN.warning+PAPER_SCAN.sweep+PAPER_SCAN.rest;
     const round=elapsed<firstCycle?0:1+Math.floor((elapsed-firstCycle)/cycle),t=round===0?elapsed:(elapsed-firstCycle)%cycle;
     r.scanWarning=round===0?PAPER_SCAN.firstWarning:PAPER_SCAN.warning;r.scanDirection=round%2===0?1:-1;
     r.open=t<r.scanWarning+PAPER_SCAN.sweep;r.scanAge=t;r.eye.data.targetDisabled=!r.open;
     const progress=clamp((t-r.scanWarning)/PAPER_SCAN.sweep,0,1);
     r.scanAngle=PI/2+r.scanDirection*PAPER_SCAN.swing*(2*progress-1);
     if(r.open&&t>=r.scanWarning&&pointInPoly(g.player.x,g.player.y,paperScanFan(r,r.scanAngle,PAPER_SCAN.halfWidth))&&w.player.invuln<=0&&!w.brush.protected){w.player.die();event(e,'scanner-hit',g);}
     burnTick();if(r.burns.length>=5&&weaks<2&&clock(g)>=weakAt){weaks++;weakAt=clock(g)+12;w.bossCaps.openWeak(e,'纸甲烧透');}if(g.t>=next){volley(g,[{x:e.x,y:e.y+60,n:4,angle:PI/2,spread:.5}],40,speed(g,140),4,'rice','gold');next=g.t+1.8;}
     // 近身攻击：朱雀靠近龙头或龙尾，喷纸片
     if(g.t>=sprayNext){const hd={x:e.x,y:e.y},tl=r.bodies[4]?{x:r.bodies[4].x,y:r.bodies[4].y}:hd;const dh=Math.hypot(g.player.x-hd.x,g.player.y-hd.y),dt=Math.hypot(g.player.x-tl.x,g.player.y-tl.y);if(dh<220||dt<220){const src=dh<dt?hd:tl,ang=Math.atan2(g.player.y-src.y,g.player.x-src.x);volley(g,[{x:src.x,y:src.y,n:7,angle:ang,spread:1.1}],35,speed(g,190),3,'rice','gold');sprayNext=g.t+2.4;}}
     yield;
    }
   });(e.data.phaseResults??=[]).push({phase:1,broken:true,real:g.real});yield* transition();
  }
  if(start<=2){begin(2,'钩船');r.open=false;
   yield* g.phase(e,{hp:BOSS1_BALANCE.paper[1].hp/.85,time:Infinity,clock:'boss',transitionTime:0,complete:()=>r.claws.every(a=>a.broken)},function*(){
    for(const a of r.claws){a.part.hp=a.part.maxHp=e.maxHp/2;a.part.alpha=1;a.part.data.damageTarget=a.part;a.part.data.targetDisabled=false;}
    let next=clock(g)+.5,index=0,sprayNext=g.t;
    for(;;){for(const a of r.claws)if(!a.broken&&a.part.hp<=0){a.broken=true;w.bossCaps.openWeak(e,'龙爪被拆');a.at=g.presentationTime;a.x=a.part.x;a.y=a.part.y;a.part.parent=null;a.part.data.targetDisabled=true;copperBreak(e,g,a.part);for(const c of r.chains)if(c.claw===a)paperCut(g,c);event(e,a===r.claws[0]?'left-claw-off':'right-claw-off',g);}
     const intact=r.claws.filter(a=>!a.broken);for(const p of surfaces)p.data.damageTarget=intact.reduce<PaperClaw|undefined>((a,b)=>!a||Math.abs(p.x-b.part.x)<Math.abs(p.x-a.part.x)?b:a,undefined)?.part??e;
     if(clock(g)>=next&&intact.length){for(const c of r.chains)if(!c.cut)paperCut(g,c);paperChain(e,g,r,intact[index%intact.length],index++);next=clock(g)+5;}
     // 近身攻击：朱雀靠近龙头或龙尾，喷纸片
     if(g.t>=sprayNext){const hd={x:e.x,y:e.y},tl=r.bodies[4]?{x:r.bodies[4].x,y:r.bodies[4].y}:hd;const dh=Math.hypot(g.player.x-hd.x,g.player.y-hd.y),dt=Math.hypot(g.player.x-tl.x,g.player.y-tl.y);if(dh<220||dt<220){const src=dh<dt?hd:tl,ang=Math.atan2(g.player.y-src.y,g.player.x-src.x);volley(g,[{x:src.x,y:src.y,n:7,angle:ang,spread:1.1}],35,speed(g,190),3,'rice','gold');sprayNext=g.t+2.4;}}
     burnTick();yield;
    }
   });(e.data.phaseResults??=[]).push({phase:2,broken:true,real:g.real});yield* transition();
  }
  for(const a of r.claws){a.part.alpha=0;a.part.data.targetDisabled=true;}
  begin(3,'查封令');e.data.targetDisabled=false;
  e.data.targetDisabled=true;
  yield* g.phase(e,{hp:BOSS1_BALANCE.paper[2].hp/.85,time:Infinity,clock:'boss',transitionTime:0,complete:()=>r.rows.length===4&&r.rows.every(a=>a.burnedAt!==Infinity)},function*(){
   const sl=r.seal,esc=w.escort,pos=(i:number)=>i<3?(esc?.vessels[i]??w.player):w.player;
   const reorder=()=>{if(!esc)return;esc.order=[0,1,2].sort((a,b)=>Number(r.sealed[a])-Number(r.sealed[b])||a-b);for(let i=0;i<3;i++)esc.extraLag[i]=r.sealed[i]?.7:0;};
   r.rows=['一号云梭','二号云梭','三号云梭','朱雀'].map((name,i)=>{
    const k=.7,p=g.spawn({sprite:'pd-register',hp:1e6,radius:0,hits:[-70,-35,0,35,70].map(x=>[x*k,0,23*k] as [number,number,number]),hitPriority:60,score:0,onHit:(part,_g,x,y)=>{if(clock(g)>=(part.data.sparkAt??0)){part.data.sparkAt=clock(g)+.06;g.fx.burst(x,y,3,90,[1.6,1.1,.4]);}}},SCROLL_CX,SCROLL_TOP+75+i*45);
    p.phaseLock=true;p.alpha=.02;p.data.bossOwner=e;p.data.copperPart=true;p.data.noSupplementFire=true;p.data.damageBonus=1;p.data.hitArmor=true;p.data.name=name;return {part:p,name,burnedAt:Infinity,ship:i};
   });e.hp=e.maxHp;route(r.rows[0].part);
   const d=director(g);let nextAt=clock(g)+1.5,seen=w.brush.lastStroke?.id??0,hit:Enemy|null=null,tgt=3,st='fly',t0=0,told=false,fx0=0,fy0=0;const trail:{x:number;y:number;t:number}[]=[];
   const alive=()=>{const l=[3];for(let i=0;i<3;i++)if(esc?.vessels[i]&&r.shipHp[i]>0)l.push(i);return l;};
   const unlock=()=>{w.player.locked=false;r.lockShip=null;r.seal.lit=-1;};
   const pick=()=>{const l=alive();tgt=l[Math.floor(Math.random()*l.length)];};
   const lockOn=()=>{const at=pos(tgt);if(tgt===3){w.player.locked=true;r.seal.lit=3;if(!told){told=true;w.caption('','被大印锁住了 · 打碎它',3);}}else{r.lockShip={i:tgt,x:at.x,y:at.y};r.seal.lit=tgt;}w.audio.sfx('warning');g.fx.burst(at.x,at.y,14,150,[1.6,.5,.2]);};
   // 大印碎裂：碎片、震屏、音效；还有条目没划就 2 秒后在随机位置再落一枚
   const shatter=(again:boolean)=>{const x=sl.x,y=sl.y-60;g.fx.explosion(x,y,'m','fire');g.fx.burst(x,y,40,260,[1.6,.9,.3]);g.fx.shake(.3);w.audio.sfx('explode_m');w.hitstop(.06);
    if(hit){g.remove(hit);hit=null;e.data.stampHit=null;}unlock();sl.active=false;r.stampProgress=0;r.stampH=1;if(again)nextAt=clock(g)+2;};
   for(;;){
    w.brush.free=sl.active||r.rows.some(a=>a.burnedAt===Infinity);
    if(!sl.active){
     if(clock(g)>=nextAt&&r.rows.some(a=>a.burnedAt===Infinity)){
      sl.active=true;r.stampProgress=0;r.stampH=1;r.stampHp=1;pick();st='fly';t0=clock(g);
      sl.x=fx0=clamp(Math.random()*780+60,60,840);sl.y=fy0=Math.random()*200+520;
      hit=g.spawn({sprite:'pd-register',hp:STAMP_HP,radius:70,hitPriority:70,score:0,noCollide:true},sl.x,sl.y-60);hit.alpha=.02;hit.data.contentRole='prop';hit.data.copperPart=true;hit.data.noSupplementFire=true;e.data.stampHit=hit;
      d?.short('PD.seal.start','纸龙','大印落下。划掉清单上的条目，或者用执笔圈住大印把它封碎。');
     }
    }else{
     const ts=clock(g)-t0,at=pos(tgt);
     if(st==='fly'){const k=clamp(ts/.6,0,1),e2=k*k*(3-2*k);sl.x=fx0+(at.x-fx0)*e2;sl.y=fy0+(at.y-fy0)*e2;if(k>=1){st='lock';t0=clock(g);lockOn();}}
     else if(st==='lock'){
      sl.x=at.x;sl.y=at.y;r.stampProgress=clamp(ts/3,0,1);
      const pl=w.player;if(tgt===3&&(w.input.axisX||w.input.axisY||w.input.pressed('roll'))){r.struggleAt=g.presentationTime;pl.x+=Math.sin(g.presentationTime*90)*2;}
      if(ts>=3){st='slam';t0=clock(g);}
     }else if(st==='slam'){
      sl.x=at.x;sl.y=at.y;r.stampH=1-clamp(ts/.18,0,1);
      if(ts>=.18){
       g.fx.burst(sl.x,sl.y,22,200,[1.6,.5,.2]);g.fx.shake(.25);w.hitstop(.04);
       if(tgt<3){if(esc)esc.durability=Math.max(1,esc.durability-25);r.shipHp[tgt]=Math.max(0,r.shipHp[tgt]-25);g.fx.explosion(at.x,at.y,'m','fire');}
       else if(w.player.invuln<=0&&!w.brush.protected)w.player.die();
       e.data.paperEffects.stats.stampHits++;event(e,'stamp-landed',g);
       unlock();st='rest';t0=clock(g);r.stampProgress=0;
      }
     }else{ // 抬起 1 秒后换目标
      r.stampH=clamp(ts/.6,0,1);
      if(ts>=1){fx0=sl.x;fy0=sl.y;pick();st='fly';t0=clock(g);}
     }
     if(hit){trail.push({x:sl.x,y:sl.y-60,t:clock(g)});while(trail.length&&clock(g)-trail[0].t>.8)trail.shift();hit.x=sl.x;hit.y=sl.y-60;r.stampHp=Math.max(0,hit.hp/hit.maxHp);}
     if(hit&&(hit.hp<=0||hit.dead)){hit=null;shatter(true);}
    }
    // 执笔：圈住大印是封，横划过条目是划掉
    const ls=w.brush.lastStroke;
    if(ls&&ls.id!==seen){seen=ls.id;
     if(sl.active&&hit&&ls.form==='封'&&(pointInPoly(hit.x,hit.y,ls.pts)||trail.some(q=>pointInPoly(q.x,q.y,ls.pts)))){w.damage(hit,hit.maxHp*.34,hit.x,hit.y,true,'ink');g.fx.burst(hit.x,hit.y,16,200,[1.6,1,.4]);g.fx.shake(.2);w.audio.sfx('seal');}
     else{
      let best=-1,bc=.6;
      r.rows.forEach((row,i)=>{if(row.burnedAt!==Infinity)return;let lo=Infinity,hi=-Infinity;const rx=row.part.x,ry=row.part.y,half=65;
       for(let k=0;k<ls.pts.length;k+=2)if(Math.abs(ls.pts[k+1]-ry)<=26){lo=Math.min(lo,ls.pts[k]);hi=Math.max(hi,ls.pts[k]);}
       const cover=hi>lo?(Math.min(hi,rx+half)-Math.max(lo,rx-half))/(2*half):0;if(cover>=bc){bc=cover;best=i;}});
      if(best>=0){const row=r.rows[best];
       row.burnedAt=g.presentationTime;r.taught=true;copperBreak(e,g,row.part);event(e,`row-${row.ship+1}-burned`,g);
       g.fx.burst(row.part.x,row.part.y,26,160,[1.6,.7,.2]);g.fx.shake(.2);
       w.bossCaps.chunk(e,.2,`查封令·${row.name} 已划掉`);
       if(r.rows.every(a=>a.burnedAt!==Infinity)&&sl.active)shatter(false);
      }
     }
    }
    yield;
   }
  });(e.data.phaseResults??=[]).push({phase:3,broken:true,real:g.real});e.data.bossResult='sealed';e.data.assisted=false;event(e,'paper-dismantled',g);
  yield* transition();for(const p of [e,...r.bodies,...r.hinges,r.lid,r.eye,r.tail,r.stamp]){p.data.targetDisabled=true;}
  yield* presentWait(g,1,t=>{e.alpha=1-t;r.stamp.alpha=0;});
 }finally{w.brush.free=false;w.player.locked=false;r.lockShip=null;if(e.data.stampHit)g.remove(e.data.stampHit);for(const c of r.chains)paperCut(g,c);for(const p of [...r.bodies,...r.rows.map(a=>a.part),r.stamp])g.remove(p);if(escort&&updateShips)escort.update=updateShips;if(escort){escort.order=[0,1,2];for(let i=0;i<3;i++){escort.extraLag[i]=0;escort.pull[i].x=escort.pull[i].y=0;}}w.bossCombat.endBattle(e);}
}

export const Serpent: EnemyDef = {
 name:'纸龙',sprite:'pd-head',hp:1,radius:0,score:30000,drops:['p','bomb'],
 deform:{breath:.018,speed:3,weight:[0,1]},boss:{name:'纸龙',music:'boss-zhilong',phases:3,defeat:'disable'},ai:paper,
};
