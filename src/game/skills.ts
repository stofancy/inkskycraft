// P4 B 批：数字键主动技能。持续时间与冷却使用真实战斗秒，菜单暂停不推进。
import { angleDiff, clamp, segDist2 } from '../core/math';
import { CURVES } from '../ui/motion';
import { PK } from '../gl/particles';
import { RS } from '../gl/ribbons';
import { PLAY_W, PLAY_H, type SkillSlot, type WeaponColor } from '../types';
import { Player } from './player';
import type { Enemy } from './enemy';
import type { World } from './world';
import { auraLine, auraRing } from './aura';
export const SKILL_IDS=['chaifa','tishen','zhongpao','shenying','bilei'] as const;
export type SkillId=typeof SKILL_IDS[number];
export const SKILL_RULES={
 chaifa:{name:'拆阀',key:'1',cooldown:20,duration:5},
 tishen:{name:'替身',key:'2',cooldown:16,duration:4},
 zhongpao:{name:'重炮',key:'3',cooldown:0,duration:0},
 shenying:{name:'蜃影',key:'4',cooldown:22,duration:6},
 bilei:{name:'避雷',key:'5',cooldown:10,duration:.6},
} as const;
export function filterSkills(value:unknown):SkillId[]{return Array.isArray(value)?[...new Set(value.filter((id):id is SkillId=>SKILL_IDS.includes(id)))]:[];}
interface Decoy {x:number;y:number;vx:number;hits:number;left:number;expires:number;age:number;fromX:number;fromY:number;openX:number;openY:number;rushing:boolean}
interface Cannon {x:number;y:number;level:1|2|3;hits:Set<number>;smoke:number}
interface ReturnShot {x:number;y:number;vx:number;vy:number;target:Enemy|null;damage:number;homing:boolean}
interface Unlock {id:SkillId;x:number;y:number;age:number}
export class Skills {
 readonly arrivalTimes:Partial<Record<SkillId,number>>={};
 readonly unlocked=new Set<SkillId>(['chaifa']);
 readonly cooldowns:Record<SkillId,number>={chaifa:0,tishen:0,zhongpao:0,shenying:0,bilei:0};
 readonly stats={uses:{chaifa:0,tishen:0,zhongpao:0,shenying:0,bilei:0},primaryHits:0,decoyHits:0,reflected:0,perfect:0,damage:0};
 boostLeft=0;mirrorLeft=0;shieldLeft=0;charge=0;mirrorFlash=0;
 decoys:Decoy[]=[];cannons:Cannon[]=[];returns:ReturnShot[]=[];
 readonly echo:Player;
 unlocks:Unlock[]=[];
 private arcs:{pts:number[];left:number}[]=[];
 private heatClock=0;private mirrorAim=0;
 private mirrorAge=0;private pearls=0;
 private windup:{left:number;level:1|2|3}|null=null;
 private blasts:{x:number;y:number;left:number;target:Enemy}[]=[];
 private scars:{x:number;from:number;to:number;left:number}[]=[];
 private valveLeft=0;private rodAfter=0;private cannonGlow=0;
 private readiness=new Map<SkillId,boolean>();
 get mirrorPosition(){const p=this.w.player;let x=PLAY_W-p.x;if(Math.abs(x-p.x)<240)x=p.x<=PLAY_W/2?p.x+240:p.x-240;return{x:clamp(x,26,874),y:p.y};}
 private continuousNext=new Map<number,number>();
 private continuousTargets=new Set<number>();
 constructor(readonly w:World){this.echo=new Player(w,true);}
 get boosted(){return this.boostLeft>0;}
 get cannonLevel():0|1|2|3{return this.charge>=180?3:this.charge>=100?2:this.charge>=40?1:0;}
 get shieldRadius(){return 90;}
 resetRun():void{for(const id of SKILL_IDS)delete this.arrivalTimes[id];this.unlocked.clear();this.unlocked.add('chaifa');this.charge=0;for(const id of SKILL_IDS){this.cooldowns[id]=0;this.stats.uses[id]=0;}this.stats.primaryHits=this.stats.decoyHits=this.stats.reflected=this.stats.perfect=this.stats.damage=0;this.clearEffects();}
 clearEffects():void{this.boostLeft=this.mirrorLeft=this.shieldLeft=this.mirrorFlash=0;this.decoys=[];this.cannons=[];this.returns=[];this.arcs=[];this.unlocks=[];this.echo.reset(false);this.heatClock=this.mirrorAim=0;this.continuousNext.clear();this.continuousTargets.clear();this.windup=null;this.blasts=[];this.scars=[];this.pearls=this.mirrorAge=this.valveLeft=this.rodAfter=this.cannonGlow=0;this.readiness.clear();}
 setUnlocked(ids:unknown):void{this.unlocked.clear();for(const id of filterSkills(ids))this.unlocked.add(id);}
 unlock(id:SkillId,x=this.w.player.x,y=this.w.player.y):void{
  if(this.unlocked.has(id))return;
  this.unlocked.add(id);this.unlocks.push({id,x,y,age:0});
  this.w.audio.sfx('skill_unlock');
 }
 primaryHit(targetId?:number,source:WeaponColor='red'):void{
  if(!this.unlocked.has('zhongpao'))return;
  if(source!=='red'){
   if(targetId===undefined)return;
   if(!this.continuousTargets.has(targetId)&&this.continuousTargets.size>=3)return;
   this.continuousTargets.add(targetId);
   if(this.w.real+1e-9<(this.continuousNext.get(targetId)??0))return;
   this.continuousNext.set(targetId,this.w.real+.1);
  }
  const before=this.cannonLevel;this.stats.primaryHits++;this.charge=Math.min(180,this.charge+1);
  if(this.cannonLevel>before){this.cannonGlow=.35;this.w.audio.sfx('hit_armor');this.w.fx.burst(this.w.player.x,this.w.player.y-35,12,110,[1.8,1.1,.35],.25);}
 }
 freezeTime(dt:number):void {for(const d of this.decoys)d.expires+=dt;}
 beginFrame(dt:number,readInput=true):void{
  this.continuousTargets.clear();
  for(const id of SKILL_IDS)this.cooldowns[id]=this.cooldowns[id]<=dt+1e-9?0:this.cooldowns[id]-dt;
  const hot=this.boostLeft>0;this.boostLeft=this.boostLeft<=dt+1e-9?0:this.boostLeft-dt;
  if(hot&&!this.boostLeft){this.valveLeft=.3;const p=this.w.player;this.w.audio.sfx('hit_armor');for(let i=0;i<24;i++)this.w.fx.emitHigh({x:p.x,y:p.y+25,vx:(Math.random()-.5)*180,vy:60+Math.random()*100,life:.55,size:10,sizeEnd:35,r:.9,g:.95,b:1,a:.8,kind:PK.Smoke});}
  const mirrored=this.mirrorLeft>0,rod=this.shieldLeft>0;
  this.mirrorLeft=this.mirrorLeft<=dt+1e-9?0:this.mirrorLeft-dt;this.shieldLeft=this.shieldLeft<=dt+1e-9?0:this.shieldLeft-dt;this.mirrorFlash=Math.max(0,this.mirrorFlash-dt);
  if(mirrored&&!this.mirrorLeft)this.endMirror();if(rod&&!this.shieldLeft)this.rodAfter=.3;
  this.valveLeft=Math.max(0,this.valveLeft-dt);this.rodAfter=Math.max(0,this.rodAfter-dt);this.cannonGlow=Math.max(0,this.cannonGlow-dt);
  if(readInput&&this.w.player.alive&&this.w.player.entering<=0)for(const id of SKILL_IDS)if(this.w.input.pressed(`skill${SKILL_RULES[id].key}` as 'skill1'))this.use(id);
  for(const slot of this.slots()){if(this.w.player.alive&&this.w.player.entering<=0&&slot.visible&&slot.ready&&!this.readiness.get(slot.id as SkillId)&&['zhongpao','shenying','bilei'].includes(slot.id))this.w.audio.sfx('skill_unlock',{vol:.45});this.readiness.set(slot.id as SkillId,slot.ready);}
 }
 use(id:SkillId):boolean{
  const p=this.w.player,w=this.w,rules=SKILL_RULES[id];
  if(w.bossCombat.inputLocked||!p.alive||p.entering>0||!this.unlocked.has(id)||this.unlocks.some(u=>u.id===id&&u.age<1)||this.cooldowns[id]>0)return false;
  if(id==='zhongpao'&&(!this.cannonLevel||this.windup))return false;
  this.cooldowns[id]=rules.cooldown*w.skillCooldownScale;this.stats.uses[id]++;
  if(id==='chaifa')this.boostLeft=rules.duration;
  if(id==='tishen')this.decoys=[[-95,-20],[95,-20],[0,-120]].map(([dx,dy],i)=>({x:p.x,y:p.y,vx:i,hits:0,left:rules.duration,expires:w.real+rules.duration,age:0,fromX:p.x,fromY:p.y,openX:clamp(p.x+dx,26,874),openY:Math.max(30,p.y+dy),rushing:false}));
  if(id==='shenying'){this.mirrorLeft=rules.duration;this.mirrorAge=0;this.pearls=0;this.echo.syncEcho(p,true);this.echo.x=p.x;w.fx.shockwave(p.x,p.y,100,3,.3);}
  if(id==='bilei')this.shieldLeft=rules.duration;
  if(id==='zhongpao'){
   const level=this.cannonLevel as 1|2|3,g=p.gun('gun');this.windup={left:.1,level};this.charge=0;
   w.fx.charge(g.x,g.y,42,.1,[2.2,1.15,.25]);w.audio.sfx('laser_charge',{vol:.5});
  }else w.audio.sfx(id==='bilei'?'thunder':'powerup');
  w.ui.popup(p.x,p.y-65,rules.name,'info',`skill:${id}`);return true;
 }
 /** 瞄准与追踪共用：替身优先；蜃影交替接走半数瞄准。 */
 aimTarget(x:number,y:number,tracking=false):{x:number;y:number}{
  const available=this.decoys.filter(d=>d.left>0&&d.hits<8);
  if(available.length)return available.reduce((a,b)=>Math.hypot(a.x-x,a.y-y)<Math.hypot(b.x-x,b.y-y)?a:b);
  if(this.mirrorLeft>0&&!tracking&&this.mirrorAim++%2===0)return this.echo;
  return this.w.player;
 }
 update(realDt:number,dt:number):void{
  const w=this.w,p=w.player;
  if(!p.alive){this.clearEffects();return;}
  if(this.boosted){this.heatClock+=realDt;if(this.heatClock>=.08){this.heatClock%=.08;w.fx.shockwave(p.x,p.y,Math.max(p.sprite.w,p.sprite.h),1.6,.16);}for(const side of [-1,1])w.fx.emitHigh({x:p.x+side*13,y:p.y+45,vy:180,life:.18,size:7,sizeEnd:0,r:2.5,g:2.3,b:1.9,a:.8,kind:PK.Ember});}
  this.updateDecoys(realDt);
  if(this.mirrorLeft>0){this.mirrorAge+=realDt;this.echo.syncEcho(p);const pos=this.mirrorPosition,k=CURVES.cubic(clamp(this.mirrorAge/.3,0,1));this.echo.x=p.x+(pos.x-p.x)*k;this.echo.y=p.y;this.echo.updateEcho(dt);}
  if(this.windup){this.windup.left-=realDt;if(this.windup.left<=1e-9){const g=p.gun('gun'),level=this.windup.level;this.cannons.push({x:g.x,y:g.y,level,hits:new Set(),smoke:0});this.windup=null;p.y=Math.min(PLAY_H-36,p.y+20);w.fx.burst(g.x,g.y,20+level*10,420,[2.2,1.15,.25]);w.fx.shake(.12+level*.13);w.audio.sfx('missile');}}
  this.scars=this.scars.filter(a=>(a.left-=realDt)>0);
  for(const blast of this.blasts)if((blast.left-=realDt)<=1e-9)this.cannonBlast(blast.x,blast.y,3,blast.target);
  this.blasts=this.blasts.filter(b=>b.left>1e-9);
  for(const shot of this.cannons){
   const oldY=shot.y;shot.y-=900*dt;shot.smoke+=dt;
   if(shot.level===1&&dt>0)this.scars.push({x:shot.x,from:oldY,to:shot.y,left:.4});
   if(shot.smoke>=.025){shot.smoke%=.025;w.fx.emit({x:shot.x,y:shot.y+25,vy:80,life:.4,size:9+shot.level*3,sizeEnd:25,r:.035,g:.03,b:.025,a:.65,kind:PK.Smoke});}
   const radius=shot.level===3?22:shot.level===2?14:9;
   const candidates=w.enemies.filter(e=>!shot.hits.has(e.id)&&w.targetable(e,true)&&w.hitSegment(e,shot.x,oldY,shot.x,shot.y,radius)).sort((a,b)=>b.y-a.y);
   for(const e of candidates){shot.hits.add(e.id);if(shot.level===1){this.deal(e,150);continue;}
    const x=shot.x,y=Math.max(shot.y,e.y);
    if(shot.level===3){w.hitstop(.08);w.fx.flash(.18,[1.4,.85,.35]);this.blasts.push({x,y,left:.08,target:e});}
    else this.cannonBlast(x,y,2,e);
    shot.y=-100;break;
   }
  }
  this.cannons=this.cannons.filter(s=>s.y>-60);
  for(const shot of this.returns){
   const x=shot.x,y=shot.y;
   if(shot.homing){if(!shot.target||!w.targetable(shot.target))shot.target=this.nearest(shot.x,shot.y,new Set());if(!shot.target){shot.y=-500;continue;}const angle=Math.atan2(shot.target.y-shot.y,shot.target.x-shot.x),speed=Math.hypot(shot.vx,shot.vy);shot.vx=Math.cos(angle)*speed;shot.vy=Math.sin(angle)*speed;}
   shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;
   const e=w.shotHit(shot.x,shot.y,5,x,y);
   if(e){this.deal(e,shot.damage);shot.y=-500;}
  }
  this.returns=this.returns.filter(s=>s.x>-80&&s.x<980&&s.y>-80&&s.y<1280);
  this.arcs=this.arcs.filter(a=>(a.left-=realDt)>0);

 }
 updateUnlocks(realDt:number):void {const w=this.w,p=w.player;
  for(const u of this.unlocks){const old=u.age;u.age+=realDt;if(old<1&&u.age>=1){this.arrivalTimes[u.id]=w.presentationTime;w.ui.popup(p.x,p.y-60,`${SKILL_RULES[u.id].name} 已解锁`,'info',`skill:unlock:${u.id}`);}}
  this.unlocks=this.unlocks.filter(u=>u.age<1.8);
 }
 private updateDecoys(dt:number):void {
  const w=this.w;
  for(const d of this.decoys){const oldX=d.x,oldY=d.y;d.age+=dt;d.left=Math.max(0,d.expires-w.real);if(d.left<=1e-9||d.hits>=8)d.rushing=true;
   if(d.age<.25){const k=CURVES.cubic(d.age/.25);d.x=d.fromX+(d.openX-d.fromX)*k;d.y=d.fromY+(d.openY-d.fromY)*k;continue;}
   const target=this.nearest(d.x,d.y,new Set());
   if(target){const dx=target.x-d.x,dy=target.y-d.y,dist=Math.hypot(dx,dy),k=Math.min(1,(d.rushing?1200:420)*dt/Math.max(.001,dist));d.x+=dx*k;d.y+=dy*k;
    if(w.hitSegment(target,oldX,oldY,d.x,d.y,24)||dist<=target.radius+24){this.explodeDecoy(d);d.left=-1;}}
   else if(d.rushing){this.explodeDecoy(d);d.left=-1;}
  }
  this.decoys=this.decoys.filter(d=>d.left>=0);
 }
 private explodeDecoy(d:Decoy):void {const w=this.w;w.fx.explosion(d.x,d.y,'m','fire');w.fx.shockwave(d.x,d.y,85,3,.25);w.audio.sfx('explode_m');for(let i=0;i<20;i++)w.fx.emit({x:d.x,y:d.y,vx:(Math.random()-.5)*240,vy:(Math.random()-.5)*240,life:.6,size:5,sizeEnd:0,r:.8,g:.65,b:.35,kind:PK.Shard});for(const e of w.enemies)if(w.targetable(e,true)&&Math.hypot(e.x-d.x,e.y-d.y)<=85+e.radius)this.deal(e,100);}
 private endMirror():void {const w=this.w,e=this.echo;for(let i=0;i<20;i++)w.fx.emitHigh({x:e.x,y:e.y,vx:(Math.random()-.5)*180,vy:(Math.random()-.5)*130,life:.65,size:15,sizeEnd:48,r:.55,g:.75,b:.85,a:.65,kind:PK.Smoke});
  for(let i=0;i<this.pearls;i++){const a=i*Math.PI*2/Math.max(1,this.pearls),target=this.nearest(e.x,e.y,new Set());if(target)this.returns.push({x:e.x+Math.cos(a)*72,y:e.y+Math.sin(a)*72,vx:Math.cos(a)*700,vy:Math.sin(a)*700,homing:true,target,damage:20});}this.pearls=0;
 }
 private cannonBlast(x:number,y:number,level:2|3,hit:Enemy):void {const w=this.w,radius=level===3?140:90;w.fx.explosion(x,y,level===3?'l':'m','fire');w.fx.ink(x,y,radius,.75);w.fx.shockwave(x,y,radius,level===3?7:4,.35);w.audio.sfx(level===3?'explode_l':'explode_m');
  if(level===3){w.fx.flash(.35,[1.5,.85,.4]);w.fx.shake(.55);w.fx.burst(x,y,55,420,[2.1,.6,.12],.5);for(let i=0;i<24;i++)w.fx.emit({x,y,vx:(Math.random()-.5)*500,vy:(Math.random()-.5)*500,life:.65,size:5,sizeEnd:0,r:.4,g:.25,b:.1,kind:PK.Shard});}
  for(const e of w.enemies)if(w.targetable(e,true)&&(e===hit||Math.hypot(e.x-x,e.y-y)<=radius)){if(level===3)e.interrupt(.01);this.deal(e,level===3?500:300);if(level===3)w.loosenArmor(e,4);}
 }
 private nearest(x:number,y:number,seen:ReadonlySet<number>):Enemy|null{return this.w.enemies.filter(e=>!seen.has(e.id)&&this.w.targetable(e)&&e.x>=0&&e.x<=PLAY_W&&e.y>=0&&e.y<=PLAY_H).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]??null;}
 private deal(e:Enemy,amount:number):void{const before=e.hp;this.w.damage(e,amount,e.x,e.y,true,'neutral');this.stats.damage+=Math.max(0,before-e.hp);}
 /** 子弹移动后、玩家碰撞前做扫掠拦截，高速弹也会命中替身与盾。 */
 intercept():void{
  const w=this.w,p=w.player;
  for(const b of w.bullets.list){
   if(b.dead||b.hard||b.age<b.delay)continue;
   const ax=b.prevX,ay=b.prevY,bx=b.x,by=b.y;
   if(this.shieldLeft>0){
    const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/4));let point:{x:number;y:number}|null=null;
    for(let i=0;i<=steps;i++){const x=ax+(bx-ax)*i/steps,y=ay+(by-ay)*i/steps;if(Math.hypot(x-p.x,y-p.y)<=this.shieldRadius+b.radius&&y<=p.y&&Math.abs(angleDiff(Math.atan2(y-p.y,x-p.x),-Math.PI/2))<=Math.PI/3){point={x,y};break;}}
    if(point){
     const {x,y}=point;
     const perfect=SKILL_RULES.bilei.duration-this.shieldLeft<=.15+1e-9;
     const tip={x:p.x,y:p.gun('gun').y-55};this.arcs.push({pts:[x,y,(x+tip.x)/2+12,(y+tip.y)/2,tip.x,tip.y],left:.16});
     b.dead=true;this.stats.reflected++;
     if(perfect){this.stats.perfect++;const seen=new Set<number>();let ox=tip.x,oy=tip.y;for(let i=0;i<3;i++){const e=this.nearest(ox,oy,seen);if(!e)break;seen.add(e.id);this.arcs.push({pts:[ox,oy,(ox+e.x)/2+18,(oy+e.y)/2,e.x,e.y],left:.16});this.deal(e,30);w.fx.hit(e.x,e.y,[.6,1.2,1.8],4);ox=e.x;oy=e.y;}w.hitstop(.06);w.audio.sfx('thunder',{vol:1.2});}
     else this.returns.push({x:tip.x,y:tip.y,vx:-b.vx*3,vy:-b.vy*3,homing:false,target:null,damage:30});
     w.fx.burst(tip.x,tip.y,8,100,[.6,1.2,1.8],.2);continue;
    }
   }
   for(const d of this.decoys)if(d.hits<8&&segDist2(d.x,d.y,ax,ay,bx,by)<(p.sprite.w*.22+b.radius)**2){b.dead=true;d.hits++;this.stats.decoyHits++;w.fx.burst(b.x,b.y,5,70,[1.5,.6,.12],.15);if(d.hits===8)d.rushing=true;break;}
   if(!b.dead&&this.mirrorLeft>0&&segDist2(this.echo.x,this.echo.y,ax,ay,bx,by)<(p.sprite.w*.22+b.radius)**2){b.dead=true;this.mirrorFlash=.12;this.pearls=Math.min(20,this.pearls+1);w.fx.shockwave(this.echo.x,this.echo.y,75,1.5,.25);}

  }
 }
 slots():SkillSlot[]{return SKILL_IDS.map(id=>({id,name:SKILL_RULES[id].name,key:SKILL_RULES[id].key,icon:`/art/icons/skills/${id}.png`,cooldown:this.cooldowns[id],cooldownMax:SKILL_RULES[id].cooldown*this.w.skillCooldownScale,ready:this.cooldowns[id]===0&&(id!=='zhongpao'||this.cannonLevel>0&&!this.windup),visible:this.unlocked.has(id)&&!this.unlocks.some(u=>u.id===id&&u.age<1),active:id==='chaifa'?this.boostLeft:id==='shenying'?this.mirrorLeft:id==='bilei'?this.shieldLeft:0,value:id==='zhongpao'?`${'■'.repeat(this.cannonLevel)}${'□'.repeat(3-this.cannonLevel)}`:undefined,unlocking:this.unlocks.some(u=>u.id===id&&u.age>=1)}));}
 draw():void{
  const w=this.w,p=w.player,r=w.r;
  for(const d of this.decoys){const k=clamp(d.age/.25,0,1),sx=.7*Math.max(.06,Math.abs(Math.cos((1-k)*Math.PI*2))),rot=Math.sin(w.real*2+d.vx)*.12;
   r.air.add('paper_decoy',{x:d.x,y:d.y,frame:d.hits,sx,sy:.7,alpha:1,rot,glow:.1});

  }
  if(this.mirrorLeft>0){this.echo.draw(r,w.real);const e=this.echo,shimmer=Math.sin(w.real*9)*3;auraRing(r.ribbonTop,e.x,e.y,54+shimmer,68,[.65,1,1.2],.75,0,2.5);if(this.mirrorAge<.3)r.ribbonMid.line(p.x,p.y,e.x,e.y,26,RS.InkHalo,.55,.85,1,.5);
   for(let i=0;i<this.pearls;i++){const a=w.real*2+i*Math.PI*2/Math.max(1,this.pearls);r.bullets.add(e.x+Math.cos(a)*72,e.y+Math.sin(a)*72,0,5,0,1.1,1.4,1.8,1,.6,.25);}
   if(this.mirrorFlash>0)auraRing(r.ribbonTop,e.x,e.y,90*(1-this.mirrorFlash/.12)+20,70,[.6,1.2,1.5],this.mirrorFlash/.12);
  }
  const gun=p.gun('gun'),level=this.windup?.level??this.cannonLevel;
  if(this.unlocked.has('zhongpao')&&level>0)r.bullets.add(gun.x,gun.y,0,5+level,0,1.4,.75,.25,w.real,.16+level*.16,.15+level*.12);
  if(this.windup)r.bullets.add(gun.x,gun.y,0,12+28*(1-this.windup.left/.1),0,2.2,1.6,.5,1,1,.6);
  for(const s of this.scars)r.ribbonMid.line(s.x,s.from,s.x,s.to,6,RS.InkTrail,.045,.025,.015,s.left/.4*.7);
  for(const s of this.cannons){r.bullets.add(s.x,s.y,0,10+s.level*7,6,2.2,1.3,.4,w.real,1,.4);r.ribbonMid.line(s.x,s.y+55+s.level*20,s.x,s.y,8+s.level*3,RS.FireShot,2.1,.5,.08,.95);}
  for(const s of this.returns){r.bullets.add(s.x,s.y,Math.atan2(s.vy,s.vx),7,1,.45,.9,1.8,w.real,1,.2);r.ribbonMid.line(s.x-s.vx*.025,s.y-s.vy*.025,s.x,s.y,2,s.homing?RS.Trail:RS.Lightning,.6,1.1,1.9,.9);}
  for(const a of this.arcs)auraLine(r.ribbonMid,a.pts,3,[.6,1.1,1.8],a.left/.16,RS.Lightning);
  if(this.shieldLeft>0||this.rodAfter>0){const tipY=gun.y-55,k=this.shieldLeft>0?Math.min(1,(.6-this.shieldLeft)/.06):this.rodAfter/.3,white=this.shieldLeft>=.45;
   r.ribbonTop.line(p.x,gun.y+5,p.x,gun.y-55*k,5,RS.Brush,.25,.3,.36,1);r.ribbonTop.line(p.x-1,gun.y,p.x-1,gun.y-55*k,2,RS.Glow,.7,1.2,1.8,.9);
   r.bullets.add(p.x,tipY,0,white?13:8,0,white?2.5:.5,white?2.5:1.2,2.5,1,1,.5);
   const pts:number[]=[];for(let i=0;i<=24;i++){const a=-Math.PI/2-Math.PI/3+i/24*Math.PI*2/3;pts.push(p.x+Math.cos(a)*this.shieldRadius,p.y+Math.sin(a)*this.shieldRadius);}auraLine(r.ribbonTop,pts,2,[.3,.9,1.8],.4,RS.Lightning);
   for(let i=0;i<3;i++){const x=p.x+Math.sin(w.real*35+i*2)*28,y=tipY+15+i*12;r.ribbonTop.line(p.x,tipY,x,y,2,RS.Lightning,.6,1.2,2,.8*k);}
  }
  if(this.boosted){for(const side of [-1,1]){const pts:number[]=[];for(let i=0;i<=8;i++)pts.push(p.x+side*(38+Math.sin(w.real*25+i)*5),p.y-45+i*15);auraLine(r.ribbonTop,pts,2,[2,.45,.08],.65);}r.ribbonMid.line(p.x,p.y+35,p.x,p.y+130,17,RS.FireShot,2.4,.65,.12,.85);}
  if(this.valveLeft>0)for(const side of [-1,1])r.ribbonTop.line(p.x+side*22*this.valveLeft/.3,p.y+14,p.x+side*4,p.y+14,5,RS.Brush,.45,.3,.12,.9);
  for(const u of this.unlocks){const t=CURVES.cubic(clamp((u.age-.25)/.75,0,1)),x=u.x+(p.x-u.x)*t,y=u.y+(p.y-u.y)*t-Math.sin(t*Math.PI)*100;r.items.add(`skill_part_${u.id}`,{x,y,sx:1.2-t*.5,sy:1.2-t*.5,alpha:1-clamp((u.age-1)/.3,0,1),glow:1.5});auraRing(r.ribbonTop,x,y,30,30,[1.5,1.1,.35],Math.max(0,1-u.age/1.3),u.age*3,2);}
 }
}
