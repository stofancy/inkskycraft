// 三色重炮：同一施放对象贯穿本体、主炮联动与 Boss 限额。
import { clamp } from '../core/math';
import { PLAY_W, PLAY_H, type WeaponColor } from '../types';
import { RS, type RibbonBatch } from '../gl/ribbons';
import { PK } from '../gl/particles';
import { EV } from '../gl/elemental-vfx';
import type { World } from './world';
import type { Enemy } from './enemy';
import type { CannonCast } from './boss-caps';
import atlas from '../../public/art/skills/heavy-cannon/cannon.json';

export const CANNON_NAMES={red:'南明离火',blue:'诛仙剑阵',purple:'五雷正法'};
const COLORS:Record<WeaponColor,[number,number,number]>={red:[2.5,.48,.08],blue:[.25,1.7,1.8],purple:[1.35,.55,2.8]};
const ease=(t:number)=>1-(1-clamp(t,0,1))**3;
interface Bolt {x:number;y:number;at:number;warn:number;final:boolean}
interface Cast {key:CannonCast;t:number;x:number;y:number;fromX:number;fromY:number;target:Enemy|null;swords:number;hits:Set<number>[];loosened:Set<number>;named:Set<number>;bolts:Bolt[];end:number}
const PARTS=Object.entries(atlas.parts).sort((a,b)=>a[1].layer-b[1].layer);

export class HeavyCannon {
 private cast:Cast|null=null;
 constructor(readonly w:World){}
 get active(){return !!this.cast;}
 get recoil(){const c=this.cast;return c&&c.t>=.24&&c.t<.49?(c.key.level*2+2)*(1-ease((c.t-.24)/.25)):0;}
 get color(){return this.cast?.key.color;}
 clear():void{this.cast=null;}
 private targets():Enemy[]{return this.w.enemies.filter(e=>this.w.targetable(e)&&!e.invulnerable&&e.x>=0&&e.x<=PLAY_W&&e.y>=0&&e.y<=PLAY_H);}
 start(color:WeaponColor,level:1|2|3):void {
  if(this.cast)return;
  const w=this.w,g=w.player.gun('gun');
  const target=this.targets().sort((a,b)=>{
   const ba=w.bossCaps.bossOf(a),bb=w.bossCaps.bossOf(b);
   return Number(!!bb)-Number(!!ba)||(bb?.maxHp??b.maxHp)-(ba?.maxHp??a.maxHp)||Math.hypot(a.x-g.x,a.y-g.y)-Math.hypot(b.x-g.x,b.y-g.y);
  })[0]??null;
  const x=color==='purple'?PLAY_W/2:clamp(target?.x??g.x,25,PLAY_W-25),y=color==='purple'?100:clamp(target?.y??g.y-320,60,PLAY_H-60);
  this.cast={key:w.bossCaps.createCannon(color,level),t:0,x,y,fromX:g.x,fromY:g.y,target,swords:color==='blue'?w.aura.gun.takeCannonSwords():0,hits:Array.from({length:4},()=>new Set()),loosened:new Set(),named:new Set(),bolts:[],end:color==='red'?[2.68,3.08,3.48][level-1]:color==='blue'?(level===3?2.67:2.27):[2.74,3.26,3.78][level-1]};
  w.audio.sfx('laser_charge',{vol:.55,pitch:.65});
 }
 private deal(c:Cast,e:Enemy,amount:number):void {
  if(!this.w.bossCaps.cannonValid(e,c.key))return;
  this.w.skills.stats.damage+=this.w.damage(e,amount,e.x,e.y,true,'neutral',{castKey:c.key});
 }
 private area(c:Cast,x:number,y:number,r:number,amount:number,control=0):void {
  for(const e of this.targets())if(Math.hypot(e.x-x,e.y-y)<=r+e.radius*.6){this.deal(c,e,amount);if(control)this.w.aura.gun.cannonControl(e,c.key,control);}
 }
 private impact(c:Cast,x:number,y:number,r:number,stop:number,strength:number):void {
  const w=this.w,col=COLORS[c.key.color];w.hitstop(stop);w.fx.trauma=Math.max(w.fx.trauma,strength);
  w.fx.shockwave(x,y,r,7,.32);w.r.lights.pulse(x,y,r*2,...col,.3);
  // 短时局部高亮，粒子总量固定；与泼墨重叠时减去装饰。
  const n=w.player.bombT>0?18:40;
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,sp=180+(i%7)*45;w.fx.emit({x:x+Math.cos(a)*r*.8,y:y+Math.sin(a)*r*.6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,drag:3,life:.25+(i%3)*.07,size:i%3===0?24:9,sizeEnd:1,rot:a,spin:.7,r:col[0]*.65,g:col[1]*.65,b:col[2]*.65,r1:col[0]*.15,g1:col[1]*.15,b1:col[2]*.15,a:.8,kind:i%3===0?PK.TraceTex:PK.SparkTex});}
 }
 private lotus(c:Cast,second=false):void {
  const l=c.key.level-1,r=second?240:[140,180,220][l];
  if(!second)this.w.aura.gun.igniteCannon(c.key);
  this.area(c,c.x,c.y,r,second?260:[220,360,380][l]);
  for(const b of this.w.bullets.list)if(!b.dead&&!b.hard&&b.age>=b.delay&&Math.hypot(b.x-c.x,b.y-c.y)<=r)b.dead=true;
  this.impact(c,c.x,c.y,r,second?.04:.025,second?.64:.5);
  this.w.audio.sfx('explode_l',{vol:.75,pitch:second?.7:.9});
 }
 private swordEnds(c:Cast,i:number):[number,number,number,number] {
  const r=[150,190,220][c.key.level-1]/Math.SQRT2;
  const sx=i%2?1:-1,sy=i<2?-1:1;
  return [c.x+sx*r,c.y+sy*r,c.x-sx*r,c.y-sy*r];
 }
 private slash(c:Cast,old:number):void {
  const n=c.key.level===1?2:4;
  for(let i=0;i<n;i++){
   const at=i%2?1.1:.94;if(c.t<at||old>=at+.12)continue;
   const [ax,ay,bx,by]=this.swordEnds(c,i),u=clamp((old-at)/.12,0,1),v=clamp((c.t-at)/.12,0,1);
   for(const e of this.targets())if(!c.hits[i].has(e.id)&&this.w.hitSegment(e,ax+(bx-ax)*u,ay+(by-ay)*u,ax+(bx-ax)*v,ay+(by-ay)*v,[18,22,26][c.key.level-1])){
    c.hits[i].add(e.id);this.deal(c,e,[120,130,150][c.key.level-1]);
    if(!c.loosened.has(e.id)&&this.w.bossCaps.cannonValid(e,c.key)){c.loosened.add(e.id);this.w.loosenArmor(e,4);}
   }
  }
 }
 private smallSwords(c:Cast):void {
  const target=c.target&&!c.target.dead?c.target:null,tx=target?.x??c.x,ty=target?.y??c.y;
  for(let i=0;i<c.swords;i++){
   const [ax,ay]=this.swordEnds(c,i),dx=tx-ax,dy=ty-ay;
   for(const e of this.targets())if(this.w.hitSegment(e,ax,ay,tx+dx*.2,ty+dy*.2,10)){
    const damage=this.w.aura.gun.cannonSwordDamage(e);
    if(this.w.bossCaps.cannonValid(e,c.key))this.w.damage(e,damage,e.x,e.y,true,'blue',{castKey:c.key});
   }
  }
 }
 private warnBolt(c:Cast,i:number):void {
  const prev=c.bolts.at(-1)??c;
  const target=this.targets().sort((a,b)=>Number(b.charging)-Number(a.charging)||Number(c.named.has(a.id))-Number(c.named.has(b.id))||b.hp-a.hp||Math.hypot(a.x-prev.x,a.y-prev.y)-Math.hypot(b.x-prev.x,b.y-prev.y))[0];
  if(target)c.named.add(target.id);
  const fallback=[[.26,.3],[.7,.38],[.45,.24],[.3,.49],[.73,.51]][i%5],final=i===8;
  c.bolts.push({x:target?.x??PLAY_W*fallback[0],y:target?.y??PLAY_H*fallback[1],at:1+i*.26,warn:final?.26:.12,final});
 }
 update(dt:number):void {
  const c=this.cast;if(!c||dt<=0)return;
  const old=c.t;c.t+=dt;const crossed=(at:number)=>old+1e-8<at&&c.t+1e-8>=at,l=c.key.level-1,w=this.w;
  if(crossed(.24)){const g=w.player.gun('gun');c.fromX=g.x;c.fromY=g.y;w.hitstop([.03,.04,.05][l]);w.fx.trauma=Math.max(w.fx.trauma,[.29,.35,.41][l]);w.audio.sfx('missile',{vol:.7,pitch:.7});}
  if(c.key.color==='red'){
   if(crossed(.78))this.lotus(c);
   if(c.key.level===3&&crossed(1.28))this.lotus(c,true);
   for(let i=1;i<=[4,5,6][l];i++)if(crossed(.78+i*.4))this.area(c,c.x,c.y,[90,120,145][l],[15,20,25][l]);
  }else if(c.key.color==='blue'){
   if(crossed(.6))w.audio.sfx('seal',{vol:.55,pitch:.8});
   this.slash(c,old);
   if(crossed(.94))w.audio.sfx('slash',{vol:.7,pitch:.85});
   if(crossed(1.1)){this.smallSwords(c);this.impact(c,c.x,c.y,180,.03,.5);w.audio.sfx('slash',{vol:.8,pitch:.6});}
   if(c.key.level===3&&crossed(1.54)){this.area(c,c.x,c.y,85,280);this.impact(c,c.x,c.y,220,.04,.65);w.audio.sfx('seal',{vol:.8,pitch:.6});}
  }else{
   if(crossed(.84))w.aura.gun.fillCannonThunder(c.key);
   for(let i=0;i<[5,7,9][l];i++){
    const at=1+i*.26;if(crossed(at-(i===8?.26:.12)))this.warnBolt(c,i);
    if(crossed(at)){const b=c.bolts[i];if(!b)continue;this.area(c,b.x,b.y,b.final?120:[50,60,70][l],b.final?240:[60,70,75][l],b.final?.5:[.25,.3,.35][l]);
     this.impact(c,b.x,b.y,b.final?220:80,b.final?.04:0,b.final?.7:.2);w.audio.sfx('thunder',{vol:b.final?.85:.4,pitch:b.final?.6:1.2});}
   }
  }
  this.particles(c,old);
  if(c.t>=c.end)this.cast=null;
 }
 /** 固定发射节拍，复用粒子系统初始化时加载的 Kenney 图集。 */
 private particles(c:Cast,old:number):void {
  if(c.t<.78)return;
  const w=this.w,col=COLORS[c.key.color],red=c.key.color==='red',blue=c.key.color==='blue';
  for(let tick=Math.floor(old*24)+1;tick<=Math.floor(c.t*24);tick++){
   const radius=red?[90,120,145][c.key.level-1]:blue?95:170;
   const a=tick*2.399,rr=radius*(.5+(tick%5)*.12);
   const bolt=c.bolts.at(-1),cx=red||blue?c.x:bolt?.x??c.x,cy=red||blue?c.y:bolt?.y??c.y;
   const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr*.65;
   w.fx.emit({x,y,vx:Math.cos(a)*(red?110:65),vy:Math.sin(a)*60-(red?90:35),life:.55,size:red?25:18,sizeEnd:2,rot:a,spin:red?1.3:2,drag:1.4,r:col[0]*.55,g:col[1]*.55,b:col[2]*.55,r1:col[0]*.15,g1:col[1]*.15,b1:col[2]*.15,a:.65,kind:tick%3===0?(red?PK.FireShape:blue?PK.TwirlTex:PK.SparkTex):tick%3===1?PK.TraceTex:PK.SparkTex});
   if(tick%3===0)w.fx.emit({x,y:y-25,vx:Math.cos(a)*18,vy:-24,life:.85,size:blue?34:23,sizeEnd:blue?58:40,rot:a,spin:.3,r:blue?.50:.10,g:blue?.80:.065,b:blue?.90:.12,a:blue?.14:.20,kind:blue?PK.Dot:PK.SmokeShape});
  }
 }
 /** 所有远端装饰都给判定点附近留白。 */
 private alpha(x:number,y:number,a:number):number {const p=this.w.player;return a*(Math.hypot(x-p.x,y-p.y)<70?.25:1);}
 private ring(b:RibbonBatch,x:number,y:number,r:number,ry:number,col:[number,number,number],a:number,width=2):void {
  // 逐段衰减，法阵覆盖到玩家时仍能辨别安全空隙。
  for(let i=0;i<48;i++){const t=i/48*Math.PI*2,q=(i+1)/48*Math.PI*2,ax=x+Math.cos(t)*r,ay=y+Math.sin(t)*ry,bx=x+Math.cos(q)*r,by=y+Math.sin(q)*ry;b.line(ax,ay,bx,by,width,RS.Glow,...col,this.alpha((ax+bx)/2,(ay+by)/2,a));}
 }
 private sword(x:number,y:number,a:number,len:number,width:number,alpha:number):void {
  this.w.r.elemental.add(EV.Sword,x-Math.cos(a)*len*.175,y-Math.sin(a)*len*.175,width*5,len*1.35,this.cast?.t??0,this.alpha(x,y,alpha),1,3,a+Math.PI/2);
 }
 private drawMount(c:Cast):void {
  const t=c.t;if(t>.49)return;
  const r=this.w.r,p=this.w.player,info=r.atlas.get('heavy_cannon'),fr=info.frames[0],open=t<.24?ease(t/.1):1-ease((t-.24)/.25),recoil=t>=.24?(12+c.key.level*6)*(1-ease((t-.24)/.25)):0;
  for(const [name,part] of PARTS){const [rx,ry,rw,rh]=part.rect,[ax,ay]=part.anchor,[px,py]=part.assemblyPosition,side=name==='featherLeft'?-1:name==='featherRight'?1:0;
   const x=p.x+px/2+side*12*open,y=p.y+10+py/2+(name==='barrel'?recoil:0),rot=side*open*.25;
   r.player.raw(x,y,rot,rw/2,rh/2,fr.layer,fr.u0+(fr.u1-fr.u0)*rx/512,fr.v0+(fr.v1-fr.v0)*ry/384,fr.u0+(fr.u1-fr.u0)*(rx+rw)/512,fr.v0+(fr.v1-fr.v0)*(ry+rh)/384,0,1,1,1,1,Math.min(1,(.49-t)/.08),undefined,(ax-rw/2)/2,(ay-rh/2)/2);
  }
  const col=COLORS[c.key.color],b=r.ribbonPlayer;
  for(let i=0;i<c.key.level;i++)b.line(p.x-5,p.y-15-i*13+recoil,p.x+5,p.y-15-i*13+recoil,2,RS.Beam,...col,.9);
  if(t>=.24&&t<.28)b.line(c.fromX,c.fromY,c.fromX,c.fromY-45,20,RS.Glow,...col,1-(t-.24)/.04);
 }
 draw():void {
  const c=this.cast;if(!c)return;
  this.drawMount(c);
  const p=this.w.player,top=this.w.r.ribbonTop;top.line(p.x,p.y-1,p.x,p.y+1,4.5,RS.Brush,.025,.025,.035,1);top.line(p.x,p.y-1,p.x,p.y+1,2,RS.Beam,2.2,2.4,2.6,1);
  const r=this.w.r,t=c.t,col=COLORS[c.key.color];
  if(t<.6){
   if(t>=.1&&c.key.color!=='purple')this.ring(r.ribbonGround,c.x,c.y,55,40,col,.3,1.5);
   const u=clamp((t-.24)/.36,0,1),g=this.w.player.gun('gun'),x=t<.24?g.x:c.fromX+(c.x-c.fromX)*u,y=t<.24?g.y:c.fromY+(c.y-c.fromY)*u;
   r.elemental.add(c.key.color==='red'?EV.Fire:c.key.color==='blue'?EV.Sword:EV.Bolt,x,y,34,90,t,1,.9,2);
   return;
  }
  if(c.key.color==='red')this.drawRed(c);else if(c.key.color==='blue')this.drawBlue(c);else this.drawPurple(c);
 }
 private drawRed(c:Cast):void {
  const r=this.w.r,t=c.t,l=c.key.level-1,fade=clamp((c.end-t)/.3,0,1),second=c.key.level===3&&t>=1.28;
  const age=t-(second?1.28:.78),burst=age>=0?clamp(1-age/.6,0,1):0;
  const radius=[90,120,145][l],spread=ease((t-.6)/.25),R=(second?240:[140,180,220][l])*spread;
  if(t<.78){this.ring(r.ribbonGround,c.x,c.y,R*.65,R*.5,COLORS.red,.3,1.2);return;}
  r.elemental.add(EV.Fire,c.x,c.y-20,radius*2.9,radius*2.5,t,fade*.85,.65,4,0,true);
  if(burst>0){
   for(let i=0;i<5;i++){
    const a=-Math.PI+i*Math.PI/4,reach=R*(.32+(1-burst)*.55);
    r.elemental.add(EV.Fire,c.x+Math.cos(a)*reach,c.y+Math.sin(a)*reach*.75-25,R*1.35,R*1.65,t+i*.19,burst*fade*.86,1.1,i*7,a+Math.PI/2);
   }
  }
  if(c.key.level===3&&t>=1.28&&t<2.04){
   const u=(t-1.28)/.76,scale=1.45+.35*ease(u);
   r.shotArt.add('heavy_phoenix',{x:c.x,y:c.y-65-u*95,sx:scale,sy:scale,alpha:this.alpha(c.x,c.y,Math.min(1,u*12)*clamp((1-u)*3,0,1)),glow:.55});
  }
 }
 private drawBlue(c:Cast):void {
  const r=this.w.r,t=c.t,R=[150,190,220][c.key.level-1],fade=clamp((c.end-t)/.35,0,1);
  const rise=ease((t-.6)/.28),peak=c.key.level===3&&t>=1.46?1.35:1;
  if(t<.94)this.ring(r.ribbonGround,c.x,c.y,R,R*.65,COLORS.blue,.2*fade,1);
  r.elemental.add(EV.Water,c.x,c.y-75,R*1.9*rise,R*2.35*rise,t,fade*.92,peak,5);
  for(let i=0;i<(c.key.level===1?2:4);i++){
   const [ax,ay,bx,by]=this.swordEnds(c,i),at=i%2?1.1:.94,u=clamp((t-at)/.12,0,1),a=Math.atan2(by-ay,bx-ax);
   if(t>=.82&&t<at)r.ribbonGround.line(ax,ay,bx,by,1.5,RS.Trail,...COLORS.blue,.3);
   this.sword(ax+(bx-ax)*u,ay+(by-ay)*u,t<.82?-Math.PI/2:a,[200,230,260][c.key.level-1]*rise,15+4*c.key.level,(t>1.22?.35:.95)*fade);
  }
  for(let i=0;i<c.swords;i++){const [ax,ay]=this.swordEnds(c,i),u=ease((t-1.1)/.12),target=c.target&&!c.target.dead?c.target:c;this.sword(ax+(target.x-ax)*u,ay+(target.y-ay)*u,Math.atan2(target.y-ay,target.x-ax),75,7,clamp((1.42-t)/.2,0,1));}
  // 沿既有落剑时刻绽开水花，只参与绘制。
  for(const at of [.94,1.1,...(c.key.level===3?[1.54]:[])]){
   const age=t-at;if(age<0||age>.28)continue;
   const u=age/.28,reach=(at===1.54?190:115)*ease(u),a=(1-u)*fade;
   for(let i=0;i<16;i++){
    const angle=i*Math.PI/8+.18+Math.sin(i*7)*.08,dx=Math.cos(angle),dy=Math.sin(angle)*.48;
    const spread=reach*(.78+.22*Math.sin(i*13));
    const x=c.x+dx*spread,y=c.y+dy*spread-38*Math.sin(u*Math.PI);
    const tail=12+26*(1-u),tx=x-dx*tail,ty=y-dy*tail+8;
    r.ribbonTop.strip([tx,ty,(tx+x)*.5,(ty+y)*.5-5,x,y],[0,6*(1-u)+2,0],RS.WaterBody,.1,.6,.8,a);
   }
  }
  if(c.key.level===3&&t>=1.22&&t<1.88){const u=clamp((t-1.46)/.08,0,1),after=clamp((t-1.54)/.34,0,1);this.sword(c.x,c.y-55,-Math.PI/2,t<1.46?210:520-220*ease(u),22+26*(1-u),t<1.46?.25:1-after);}
 }
 private drawPurple(c:Cast):void {
  const r=this.w.r,t=c.t,col=COLORS.purple;
  for(const bolt of c.bolts){
   const age=t-bolt.at;
   if(age<0){const u=1+age/bolt.warn;this.ring(r.ribbonGround,bolt.x,bolt.y,(bolt.final?100:55)*(1-u*.55),25+10*(1-u),col,.4+u*.4,1.5);continue;}
   if(age>.58)continue;
   const al=clamp(1-age/.22,0,1),top=Math.min(45,bolt.y-180);
   if(al>0)r.elemental.add(EV.Bolt,bolt.x,(top+bolt.y)/2,bolt.final?380:230,bolt.y-top+30,age,al,bolt.final?1.3:.95,bolt.at*13);
   r.elemental.add(EV.Arc,bolt.x,bolt.y,bolt.final?380:190,bolt.final?245:125,age,clamp(1-age/.58,0,1),bolt.final?1.2:.8,bolt.at,0,true);
  }
 }
}
