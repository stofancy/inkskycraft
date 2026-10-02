// P4-22 第一章炮灰：复用普通敌机预算，短气泡独立于通讯队列。
import type { World } from '../game/world';
import type { Enemy,EnemyDef,ItemKind } from '../game/enemy';
import type { Scenery } from '../game/scenery';
import type { Item } from '../game/items';
import type { RouteState } from './stage1_events';
import { CH1_FODDER_ART,CH1_DECOR_ART } from '../art/ch1_air_assets';
import { FODDER_TEXT,FODDER_NAME,type FodderName } from './fodder1_text';
import { AirBomb,Bomber,NetPost,BridgeTurret } from './stage1_air_enemies';
import { RouteHornet } from './stage1_enemies';
import { RS } from '../gl/ribbons';
import type { DamageSource,DialogueVoiceState } from '../types';
import type { Co } from '../core/tasks';

interface Bubble {name:FodderName;trigger:string;text:string;owner?:Enemy;x:number;y:number;at:number;duration:number;voice:DialogueVoiceState|null}
interface Actor {name:FodderName;e:Enemy;state:string;at:number;next:number;count:number;stolen?:Item;target?:Enemy;startHp?:number;exposedUntil?:number;rage?:number;warnings?:{x:number;y:number;started:number;dead:boolean}[]}
export class FodderChapter {
 readonly actors:Actor[]=[];bubbles:Bubble[]=[];labels:{text:string;owner:Enemy;until:number}[]=[];
 /** 在敌机头上标一行大字（首次出现的目标提示），敌机死亡或到时即消。 */
 mark(text:string,owner:Enemy,seconds:number){this.labels.push({text,owner,until:this.w.real+seconds});}
 readonly log:{name:string;event:string;at:number;detail?:unknown}[]=[];
 readonly spawns:{name:string;event:string;at:number}[]=[];
 readonly cancelled:{name:string;event:string;at:number;reason:string}[]=[];
 maxBubbles=0;maxEnemies=0;maxBullets=0;reinforcements=0;repairBodies=0;
 private lastBubble=new Map<string,number>();private serial=0;event='';private born=0;
 private decor:Scenery[]=[];private canvas:HTMLCanvasElement;private c:CanvasRenderingContext2D;
 private stroke=0;private leafPause=0;private leafAngle=0;
 constructor(readonly w:World,readonly route:RouteState){
  this.canvas=document.createElement('canvas');this.canvas.className='fodder-bubbles';this.canvas.width=900;this.canvas.height=1200;
  Object.assign(this.canvas.style,{position:'fixed',pointerEvents:'none',zIndex:'12'});document.body.append(this.canvas);this.c=this.canvas.getContext('2d')!;
 }
 dispose(){this.canvas.remove();}
 record(name:string,event:string,detail?:unknown){this.log.push({name,event,at:this.w.real,detail});}
 get longDialogue(){return !!this.w.chapterDialogue?.current?.long;}
 private retainBubble(b:Bubble){
  if(this.longDialogue||b.owner?.dead){if(b.voice?.state==='playing'||b.voice?.state==='loading')this.w.audio.stopDialogue();return false;}
  if(b.voice?.state==='playing'||b.voice?.state==='loading')return true;
  if(b.voice?.state==='ended'){b.duration=this.w.real-b.at+.3;b.voice=null;}
  return this.w.real-b.at<b.duration;
 }
 bubble(name:FodderName,trigger:string,e:Enemy,ending=false):boolean{
  if(this.longDialogue)return false;
  const text=(FODDER_TEXT[name] as Record<string,unknown>)[trigger];if(typeof text!=='string')return false;
  this.bubbles=this.bubbles.filter(b=>this.retainBubble(b));
  if(ending)this.bubbles=this.bubbles.filter(b=>b.owner!==e);
  else if(this.w.real-(this.lastBubble.get(name)??-Infinity)<1.5)return false;
  this.bubbles=this.bubbles.filter(b=>b.owner!==e);
  if(this.bubbles.length>=2)return false;
  this.bubbles.push({name,trigger,text,owner:ending?undefined:e,x:e.x,y:e.y,at:this.w.real,duration:Math.max(2.5,Array.from(text).length*.18),voice:this.w.audio.playDialogue(`CH1.FODDER.${name}.${trigger}`,text)});this.lastBubble.set(name,this.w.real);
  this.record(name,'bubble',trigger);return true;
 }
 reaction(name:FodderName){const r=(FODDER_TEXT[name] as {R?:readonly string[]}).R;if(r)this.w.chapterDialogue?.short(`CH1.FODDER.${name}.R`,r[0],r[1]);}
 hit(e:Enemy){const a=this.actors.find(a=>a.e===e);if(!a)return;e.data.fodderHit=true;
  const hit:Partial<Record<FodderName,string>>={周网:'02',钱耗:'03',老鸹:'03',小铃:'02',麻三:'03',阿豆:'02',老耿:'03'};
  if(a.name==='周网'&&a.state==='repair'){a.state='interrupted';e.data.repairProgress=0;this.record(a.name,'repairInterrupted');}
  if(hit[a.name])this.bubble(a.name,hit[a.name]!,e);
 }
 death(e:Enemy){const a=this.actors.find(a=>a.e===e);if(!a)return;
  const trigger:Record<FodderName,string>={周网:'04',钱耗:'05',老鸹:'04',小铃:'04',大牛:'05',二牛:'05',赵怂:a.state==='flag'?'04':'05',吴领队:'04',麻三:'04',阿豆:'04',老耿:'03'};
  this.bubbles=this.bubbles.filter(b=>b.owner!==e);this.bubble(a.name,trigger[a.name],e,true);this.record(a.name,'down',a.state);
  const p=this.scene('parachute',e.x,e.y);p.layer='front';const at=this.w.real,w=this.w;
  // 跳伞与本机作用域无关；被击落时本机的任务已经取消。
  w.root.run((function*():Co{while(w.real-at<1.5){p.y+=70*w.lastRealDt;p.alpha=Math.min(1,(1.5-(w.real-at))/.4);p.frame=Math.floor((w.real-at)*8)%4;yield;}p.dead=true;})());
  a.warnings?.forEach(v=>v.dead=true);
  if(a.name==='钱耗'){if(a.stolen){const item=w.items.spawn(a.stolen.kind,e.x,e.y);item.scoreValue=a.stolen.scoreValue;item.spriteOverride=a.stolen.spriteOverride;this.record(a.name,'returned',a.stolen.kind);a.stolen=undefined;}w.drop('ink',e.x+18,e.y);}
  if(a.name==='赵怂'&&a.state==='flag')w.drop('ink',e.x,e.y);
  if(a.name==='小铃'){const item=w.items.spawn('medal',e.x,e.y);item.scoreValue=1000;item.spriteOverride=CH1_DECOR_ART.letter.sprite;}
  if(a.name==='麻三')this.route.times['fodder.mas3Ink']=1;
  if(!['老鸹','老耿','阿豆'].includes(a.name)&&(a.name!=='钱耗'||this.event==='S2')&&(a.name!=='大牛'&&a.name!=='二牛'||!this.log.some(l=>l.event==='reaction'&&['大牛','二牛'].includes(l.name)))){this.reaction(a.name);this.record(a.name,'reaction');}
  if(a.name==='大牛'||a.name==='二牛'){const other=this.actors.find(b=>b.e!==e&&['大牛','二牛'].includes(b.name)&&!b.e.dead);if(other){other.e.data.angry=true;this.bubble(other.name,'04',other.e);this.record(other.name,'angry');}}
 }
 canDamage(e:Enemy,source:DamageSource):boolean{
  const a=this.actors.find(a=>a.e===e);if(a?.name!=='麻三'||!e.data.covered)return true;
  return source==='purple'||source==='neutral'||source==='ink'||source==='companion';
 }
 def(name:FodderName):EnemyDef{
  const hp:Record<FodderName,number>={周网:70,钱耗:40,老鸹:50,小铃:24,大牛:65,二牛:65,赵怂:45,吴领队:210,麻三:60,阿豆:40,老耿:140};
  const mult:Record<FodderName,number>={周网:1.5,钱耗:1.5,老鸹:2,小铃:1.5,大牛:1.5,二牛:1.5,赵怂:2,吴领队:3,麻三:2,阿豆:1,老耿:1};
  const base=name==='吴领队'?900:['大牛','二牛'].includes(name)?700:name==='老鸹'?500:200;
  const drops:Partial<Record<FodderName,ItemKind>>={周网:'p',老鸹:'medal',大牛:'ink',二牛:'ink',吴领队:'medal',麻三:'ink'};
  return {name,sprite:CH1_FODDER_ART[name].sprite,hp:hp[name],score:base*mult[name],anim:CH1_FODDER_ART[name].asset?.sheet?.fps,noCollide:['老鸹','大牛','二牛'].includes(name),drops:drops[name],
   ai:name==='吴领队'?Bomber.ai:undefined,onHit:(e,g,x,y,source)=>{this.hit(e);if(name==='大牛'||name==='二牛')BridgeTurret.onHit?.(e,g,x,y,source);},onDeath:e=>this.death(e)};
 }
 spawn(name:FodderName,x:number,y:number,data:Record<string,unknown>={}):Enemy|null{
  if(this.w.chapterDialogue?.spawnPaused||this.w.density.count(this.w.enemies)>=this.w.density.limit(this.w.stageIndex))return null;
  const e=this.w.spawn(this.def(name),x,y,e=>{e.hp=e.maxHp=e.def.hp/this.w.difficulty.hp;e.data.contentRole='normal';e.data.noSupplementFire=true;e.data.fodder=name;Object.assign(e.data,data);e.tint=CH1_FODDER_ART[name].tint;});
  const a:Actor={name,e,state:'enter',at:this.w.real,next:this.w.real+.8,count:0,target:data.target as Enemy|undefined};if(name==='吴领队')e.scaleX=e.scaleY=1.2;this.actors.push(a);this.spawns.push({name,event:this.event,at:this.w.real});this.bubble(name,name==='大牛'&&this.w.player.x>=450?'06':'01',e);
  return e;
 }
 schedule(name:FodderName,delay:number,x:number,y:number,data:Record<string,unknown>|(()=>Record<string,unknown>)={}):void{
  const serial=this.serial,w=this.w,event=this.event,self=this;
  w.fork((function*():Co{const at=w.t;while(w.t-at<delay&&self.serial===serial)yield;let blocked=0;
   while(self.serial===serial){if(w.chapterDialogue?.spawnPaused){yield;continue;}const e=self.spawn(name,x,y,typeof data==='function'?data():data);if(e)return;blocked+=w.lastRealDt;if(blocked>=3){self.cancelled.push({name,event,at:w.real,reason:'普通敌机上限延后3秒'});return;}yield;}
   self.cancelled.push({name,event,at:w.real,reason:'遭遇已结束'});
  })());
 }
 begin(event:string){this.end();this.event=event;this.born=this.w.real;this.leafPause=0;
  const add=(key:string,x:number,y:number)=>this.scene(key,x,y);
  // 命名炮灰按 S1-S8 出场；schedule 的第二个参数是本段开始后的秒数。
  switch(event){
   case 'S2':for(let i=0;i<4;i++)add('egret',300+i*65,620+i*15).alpha=.5;this.schedule('钱耗',5,260,180);this.schedule('老鸹',18,810,620);this.schedule('小铃',24,100,160);break;
   case 'S3':this.schedule('周网',10,150,40);break;
   case 'S4':add('leaves',420,580);this.schedule('赵怂',6,720,320);this.schedule('大牛',13,200,430);this.schedule('二牛',15,700,430);break;
   case 'S6':add('flag',450,860).layer='front';for(let i=0;i<4;i++)add('lamp',90+i*225,650);this.schedule('阿豆',24,650,280);this.schedule('麻三',26,450,200,()=>({target:this.w.liveEnemies().find(e=>e.def.name==='堡垒钳臂')}));this.schedule('吴领队',30,450,-80);break;
   case 'S7':this.schedule('小铃',10,100,160);break;
  }
 }
 end(){this.serial++;for(const a of this.actors)a.warnings?.forEach(v=>v.dead=true);for(const s of this.decor)s.dead=true;this.decor=[];for(const a of this.actors)if(!a.e.dead)this.w.remove(a.e);if(this.bubbles.some(b=>b.voice?.state==='playing'||b.voice?.state==='loading'))this.w.audio.stopDialogue();this.bubbles=[];this.labels=[];this.event='';}
 scene(key:string,x:number,y:number){const s=this.w.scene(CH1_DECOR_ART[key].sprite,x,y);s.layer='ground';s.fps=CH1_DECOR_ART[key].asset?.sheet?.fps??0;this.decor.push(s);return s;}
 splash(x:number,y:number){this.w.fx.burst(x,y,14,100,[.6,.85,.9],.6);this.record('环境','splash',{x,y});}
 update(){const w=this.w,dt=w.dt,now=w.real;
  this.bubbles=this.bubbles.filter(b=>this.retainBubble(b));this.maxBubbles=Math.max(this.maxBubbles,this.bubbles.length);this.maxEnemies=Math.max(this.maxEnemies,w.density.count(w.enemies));this.maxBullets=Math.max(this.maxBullets,w.bulletCount());
  for(const a of this.actors){const e=a.e;if(e.dead||e.data.densityQueued||e.sealed>0||e.stunned>0)continue;
   const move=(x:number,y:number,speed:number)=>{const dx=x-e.x,dy=y-e.y,d=Math.hypot(dx,dy),step=Math.min(d,speed*dt);if(d){e.x+=dx/d*step;e.y+=dy/d*step;}return d<=step+1;};
   if(a.name==='周网'){
    if(a.state==='enter'){a.target=this.route.gatePosts?.find(p=>p.dead);if(a.target&&this.route.gatePosts?.some(p=>!p.dead)&&move(a.target.x+(a.target.x>450?-65:65),a.target.y-70,180)){a.state='repair';a.at=now;a.startHp=e.hp;e.data.repairProgress=0;this.record(a.name,'repairStart');}}
    if(a.state==='repair'){const ended=w.chapterDialogue?.lineEnds['031'];if(this.route.events.includes('E01.gateOpened')||(ended!==undefined&&now-ended>=25)){a.state='cancelled';e.data.repairProgress=0;this.record(a.name,'repairCancelled');}
     else {e.data.repairProgress=Math.min(1,(now-a.at)/3);if(now-a.at>=3&&a.target){if(w.density.count(w.enemies)>=w.density.limit(w.stageIndex)){a.state='cancelled';e.data.repairProgress=0;this.record(a.name,'repairCancelled','修复网桩会超出同屏预算');continue;}const posts=this.route.gatePosts!,idx=posts.indexOf(a.target);const p=w.spawn(NetPost,a.target.x,a.target.y,n=>{n.data.contentRole='normal';n.data.noSupplementFire=true;n.hp=n.maxHp=300/w.difficulty.hp;});p.hp=p.maxHp*.5;if(a.target.data.remains)a.target.data.remains.dead=true;posts[idx]=p;this.repairBodies++;this.bubble(a.name,'03',e);this.record(a.name,'repaired',{hp:p.hp});a.state='done';e.data.repairProgress=0;}}
    }
    if(['done','interrupted','cancelled'].includes(a.state)){move(e.x,0,180);if(e.y<=2)w.remove(e);}
   }else if(a.name==='钱耗'){
    if(a.state==='enter'&&now>=a.next){const targets=w.items.list.filter(i=>!i.dead&&!i.tutorial&&['p','bomb','ink','medal'].includes(i.kind));const it=targets.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];if(it&&move(it.x,it.y,180)){it.dead=true;a.stolen=it;a.state='escape';this.bubble(a.name,'02',e);this.record(a.name,'stole',it.kind);}}
    if(a.state==='escape'){const edges=[{x:0,y:e.y},{x:900,y:e.y},{x:e.x,y:0},{x:e.x,y:1200}].sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y));if(move(edges[0].x,edges[0].y,200)){this.bubble(a.name,'04',e,true);this.record(a.name,'escaped',a.stolen?.kind);a.stolen=undefined;w.remove(e);}}
   }else if(a.name==='老鸹'){
    const phase=(now-a.at)%5;e.data.peek=phase<1.8;e.invulnerable=!e.data.peek;e.alpha=e.data.peek?1:.3;e.data.glint=phase<.8;
    if(a.count<3&&phase>=.8&&phase<1.8&&a.next<=now){a.count++;a.next=a.at+a.count*5+.8;const self=this,ship=this.route.ship,p=ship.scene;if(w.bulletCount()<60){const shot=w.shoot(e.x,e.y,Math.atan2(p.y-e.y,p.x-e.x),300,{shape:'needle',color:'white',update(b){if(!ship.protected&&Math.abs(b.x-p.x)<=100+b.radius&&Math.abs(b.y-p.y)<=135+b.radius){ship.hit(4);self.bubble(a.name,'02',e);self.record(a.name,'shipShot',{damage:4,count:a.count});if(!e.data.shipHitSaid){e.data.shipHitSaid=true;self.reaction(a.name);}return false;}}});shot.data.fodder=1;}else w.density.skippedShots++;w.fx.burst(e.x,e.y,5,40,[2,2,2]);this.record(a.name,'coldShot');}
    if(a.count>=3&&phase>=1.8){w.remove(e);this.record(a.name,'left');}
   }else if(a.name==='小铃'){
    const x=940,y=1080;e.data.smoke=true;
    if(move(x,y,260)){this.bubble(a.name,'03',e,true);const signal=this.scene('signal',x-30,y-40);this.record(a.name,'signal');const serial=this.serial,self=this,event=this.event;w.remove(e);
     w.root.run((function*():Co{const at=w.real;while(w.real-at<2&&serial===self.serial)yield;if(serial!==self.serial)return;signal.dead=true;const n=event==='E04'?2:1;for(let i=0;i<n;i++){let delay=0;while(w.density.count(w.enemies)>=w.density.limit(w.stageIndex)||w.chapterDialogue?.spawnPaused){if(!w.chapterDialogue?.spawnPaused)delay+=w.lastRealDt;if(delay>=3||self.serial!==serial)break;yield;}if(self.serial!==serial)return;if(delay<3){w.spawn(RouteHornet,i?650:250,-60,e=>{e.data.contentRole='normal';e.data.tx=i?600:300;});self.reinforcements++;self.record('小铃','reinforcement');}else self.cancelled.push({name:'小铃援兵',event,at:w.real,reason:'普通敌机上限延后3秒'});}})());}
   }else if(a.name==='大牛'||a.name==='二牛'){
    e.data.x0??=e.x;e.x=e.data.x0+Math.sin((now-a.at)*.9+(a.name==='二牛'?Math.PI:0))*70;
    if(a.state==='enter'&&now>=a.next){const p=w.player;a.count++;e.data.target='player';e.data.lockedX=p.x;e.data.lockedY=p.y;e.data.lockedAngle=Math.atan2(p.y-e.y,p.x-e.x);e.data.lockAt=now;e.charging=true;a.state='aim';a.next=now+.6;
     this.bubble(a.name,e.data.angry?'04':a.name==='大牛'&&p.x>=450?'06':'01',e);this.record(a.name,'aimLock',{target:e.data.target,x:p.x});}
    else if(a.state==='aim'&&now>=a.next){if(e.charging&&w.bulletCount()+Math.max(1,Math.round(Math.round(2/w.difficulty.count)*w.difficulty.count))<=60){const self=this;const shots=w.fan(e.x,e.y+20,e.data.lockedAngle,Math.round(2/w.difficulty.count),.12,190,{shape:'rice',color:'amber',update(b){if(b.y>=e.data.lockedY){if(Math.abs(b.x-e.data.lockedX)>20||Math.hypot(w.player.x-e.data.lockedX,w.player.y-e.data.lockedY)>45){self.splash(b.x,b.y);self.bubble(a.name,'02',e);const other=self.actors.find(n=>n.e!==e&&!n.e.dead&&['大牛','二牛'].includes(n.name));if(other&&a.name==='大牛'){self.bubble(other.name,'03',other.e);}return false;}}}});e.data.firedAt=now;e.data.shots=shots.length;this.record(a.name,'fire');}e.charging=false;a.state='enter';a.next=now+(e.data.angry?2.5:3)-.6;}
   }else if(a.name==='赵怂'){
    if(a.state==='enter'){e.data.x0??=e.x;e.x=e.data.x0+Math.sin((now-a.at)*1.1)*90;if(now>=(e.data.nextShot??=now+1.5)){e.data.nextShot=now+2.6;if(w.bulletCount()<60)w.fan(e.x,e.y,w.aim(e.x,e.y),Math.round(3/.7),.4,170,{shape:'rice',color:'cyan'});}}
    if(a.state==='enter'&&e.hp/e.maxHp<=.6){a.state='flag';a.at=now;this.bubble(a.name,'02',e);this.record(a.name,'whiteFlag');}
    if(a.state==='flag'){if(Math.hypot(w.player.x-e.x,w.player.y-e.y)<250&&e.data.trickAt===undefined)e.data.trickAt=now+1;
     if(e.data.trickAt!==undefined&&now>=e.data.trickAt){if(w.bulletCount()<60)w.shoot(e.x,e.y,w.aim(e.x,e.y),200/w.difficulty.speed,{shape:'rice',color:'cyan'});else w.density.skippedShots++;this.bubble(a.name,'03',e);a.state='tricked';this.record(a.name,'trickShot');}
     else if(now-a.at>=3){a.state='leave';this.record(a.name,'peacefulExit');}}
    if(a.state==='tricked'||a.state==='leave'){move(e.x,0,200);if(e.y<=1)w.remove(e);}
   }else if(a.name==='吴领队'){
    if(e.data.releaseAt&&!e.data.fodderReleaseSaid){this.bubble(a.name,'02',e);e.data.fodderReleaseSaid=true;}
    if(e.hpFrac<=.3&&a.rage===undefined){a.rage=now;e.data.rage=true;this.bubble(a.name,'03',e);const s=this.route.ship.scene;a.warnings=[-45,0,45].map(d=>({x:s.x+d,y:s.y,started:now,dead:false}));this.route.ship.warnings.push(...a.warnings);this.record(a.name,'rageWarn');}
    if(a.rage!==undefined&&now-a.rage>=1.2&&a.state!=='rageDone'){a.state='rageDone';a.warnings!.forEach(v=>{v.dead=true;w.spawn(AirBomb,e.x,e.y,b=>{b.data.contentRole='hazard';b.data.noSupplementFire=true;b.data.landX=v.x;b.data.landY=v.y;});});this.record(a.name,'rageBombs',{count:3,warning:now-a.rage});}
   }else if(a.name==='麻三'){
    const t=a.target;if(t&&!t.dead&&!t.data.cargoOpen){const side=w.player.x-t.x;if(Math.abs(side)>70&&a.state!=='exposed'&&now>=(e.data.nextExposure??0)){a.state='exposed';a.exposedUntil=now+2;this.record(a.name,'exposed');}
     if(a.state==='exposed'&&now>=(a.exposedUntil??0)){a.state='cover';e.data.nextExposure=now+.8;}move(t.x+(a.state==='exposed'?Math.sign(side||1)*105:0),t.y-90,120);e.data.covered=a.state!=='exposed';
    }else {e.data.covered=false;move(e.x,320,120);}
    if(now>=a.next){if(w.bulletCount()<60)w.shoot(e.x,e.y,w.aim(e.x,e.y),190,{shape:'rice',color:'cyan'});else w.density.skippedShots++;if(e.data.covered)this.bubble(a.name,'02',e);a.next=now+3;}
   }else if(a.name==='阿豆'){
    if(a.state==='enter'&&e.data.fodderHit){a.state='flee';a.at=now;}
    if(a.state==='enter'&&now>=a.next){if(w.bulletCount()<60)w.shoot(e.x,e.y,w.aim(e.x,e.y),180,{shape:'rice',color:'cyan'});else w.density.skippedShots++;a.next=now+3;}
    if(a.state==='flee'||now-a.at>=3){a.state='flee';if(move(e.x,20,200)){this.bubble(a.name,'03',e,true);this.reaction(a.name);this.record(a.name,'escaped');w.remove(e);}}
   }
  }
  this.environment();
 }
 environment(){const w=this.w,now=w.real,ship=this.route.ship,by=(key:string)=>this.decor.filter(s=>s.sprite===CH1_DECOR_ART[key].sprite&&!s.dead),stroke=w.brush.lastStroke;
  if(this.event==='S2'){for(const s of by('egret'))s.frame=Math.floor(now*8)%4;}
  else if(this.event==='S4'){if(stroke&&stroke.id!==this.stroke){this.stroke=stroke.id;if(stroke.form==='圈'||stroke.form==='封'){this.leafPause=now+1;this.record('环境','leavesStopped');}}if(now>this.leafPause)this.leafAngle+=w.dt*.5;for(const s of by('leaves'))s.rot=this.leafAngle;}
  else if(this.event==='S6'){for(const s of by('flag')){s.x=ship.scene.x;s.y=ship.scene.y-85;s.sx=ship.warnings.some(v=>v.x>=ship.scene.x)?1:-1;s.frame=Math.floor(now*8)%4;}}
  for(const b of ship.bombLog)if(b.explodeAt!==undefined&&!(b as typeof b & {splash?:boolean}).splash){(b as typeof b & {splash?:boolean}).splash=true;this.splash(b.x,b.y);}
 }
 draw(){const w=this.w,r=w.r,rect=r.playCss,c=this.c;Object.assign(this.canvas.style,{left:`${rect.x}px`,top:`${rect.y}px`,width:`${rect.w}px`,height:`${rect.h}px`});c.clearRect(0,0,900,1200);
  if(this.event==='S3'&&this.route.gatePosts?.some(p=>!p.dead)){const a=.4+.4*Math.sin(w.real*14);r.ribbonTop.line(149,300,750,300,1.5,RS.Warn,.45,.9,1,a);}
  c.font='23px InkskyFangsong, serif';c.textBaseline='middle';
  this.labels=this.labels.filter(l=>!l.owner.dead&&w.real<l.until);
  for(const l of this.labels){c.save();c.font='bold 46px InkskyFangsong, serif';c.textAlign='center';c.lineWidth=7;c.strokeStyle='#201010';c.fillStyle='#ffe9a8';const y=l.owner.y-l.owner.info.h*Math.abs(l.owner.scaleY)/2-44;c.strokeText(l.text,l.owner.x,y);c.fillText(l.text,l.owner.x,y);c.restore();}
  for(const a of this.actors){const e=a.e;if(e.dead||e.data.densityQueued)continue;
   if(a.name==='周网'&&a.state==='repair'){if(a.target)r.ribbonMid.line(e.x,e.y,a.target.x,a.target.y,2,RS.Brush,.8,.65,.25,.8);c.strokeStyle='#dbc579';c.lineWidth=5;c.beginPath();c.arc(e.x,e.y-52,24,-Math.PI/2,-Math.PI/2+(e.data.repairProgress??0)*Math.PI*2);c.stroke();c.font='18px InkskyFangsong';c.fillStyle='#f6e6b5';c.fillText('补网',e.x-18,e.y-52);c.font='23px InkskyFangsong';}
   if(a.name==='钱耗'&&a.stolen)r.items.add(a.stolen.spriteOverride??({'p':'item_p','bomb':'item_bomb','ink':'item_ink','medal':'item_medal'} as Record<string,string>)[a.stolen.kind],{x:e.x,y:e.y-55,sx:.8,sy:.8});
   if(a.name==='老鸹'&&e.data.glint){c.fillStyle='#fffae2';c.beginPath();c.arc(e.x,e.y,9+Math.sin(w.real*35)*4,0,7);c.fill();}
   if(a.name==='小铃')r.items.add(CH1_DECOR_ART.signal.sprite,{x:e.x-20,y:e.y-40,sx:.35,sy:.6,frame:Math.floor(w.real*8)%4,alpha:.5});
   if(a.name==='赵怂'&&a.state==='flag')r.items.add(CH1_DECOR_ART.whiteFlag.sprite,{x:e.x+20,y:e.y-25,frame:Math.floor(w.real*8)%4});
  }
  for(const b of this.bubbles){const x=b.owner?.x??b.x,y=(b.owner?.y??b.y)-(b.owner?b.owner.info.h*Math.abs(b.owner.scaleY)/2:20)-28,label=FODDER_NAME[b.name],text=`${label}：${b.text}`,width=Math.min(430,c.measureText(text).width+24),bx=Math.max(8,Math.min(892-width,x-width/2)),by=Math.max(6,y-44);
   if(Math.abs(w.player.x-(bx+width/2))<width/2+32&&Math.abs(w.player.y-(by+22))<52)continue;
   // 真实敌弹进入气泡矩形时暂时隐去背景与文字，保持弹体可见。
   if(w.bullets.list.some(v=>!v.dead&&v.x>bx-12&&v.x<bx+width+12&&v.y>by-12&&v.y<by+56))continue;
   c.globalAlpha=Math.min(1,(w.real-b.at)/.15);c.fillStyle='rgba(24,24,22,.76)';c.fillRect(bx,by,width,44);c.strokeStyle='#bb6558';c.lineWidth=1.5;c.strokeRect(bx,by,width,44);
   c.fillStyle='#ddc58b';c.fillText(`${label}：`,bx+12,by+22);c.fillStyle='#ece3c9';c.fillText(b.text,bx+12+c.measureText(`${label}：`).width,by+22,width-24-c.measureText(`${label}：`).width);c.globalAlpha=1;
  }
 }
}
