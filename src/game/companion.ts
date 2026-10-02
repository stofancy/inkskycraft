import { companionSprites } from '../art/sprites_companions';
import { SpritePlayback } from '../art/playback';
import type { Renderer } from '../gl/renderer';
import { RS } from '../gl/ribbons';
import { approach, clamp } from '../core/math';
import { CURVES } from '../ui/motion';
import type { Enemy } from './enemy';
import { type CombatWorld, Progression } from './progression';

export type CompanionKind = 'chiyan' | 'laodun' | 'moyuan' | 'suanpan';
export interface CompanionState {
 kind: CompanionKind; name: string; role: string; level: number; xp: number;
 x: number; y: number; cooldown: number; active: number; effective: number; count: number;
}
/** 第一阶段的实际玩法参数，全部使用 900×1200 逻辑像素与游戏秒。 */
export const COMPANION_RULES = {
 chiyan: { range: 520, preview: .45, strike: .55, return: .4, cooldown: 3.5, damage: 18 },
 laodun: { range: 190, halfWidth: 84, thickness: 12, duration: 2.8, cooldown: 6, capacity: 6 },
 moyuan: { range: 520, duration: 3, cooldown: 6, speedScale: .55, damageScale: 1.18 },
 suanpan: { startInk: .4, stopInk: .5, travel: .6, duration: 3, cooldown: 8, ink: .08 },
} as const;
const OFFSETS = [[0,-88],[-82,-15],[82,-45],[0,82]];
const COLORS: [number,number,number][] = [[1.8,.55,.15],[.2,1.3,.85],[.65,.5,1.3],[1.1,.8,.25]];
interface Dash { target: Enemy; t: number; startX: number; startY: number; endX: number; endY: number; hit: boolean; power: number }
interface Absorb { x:number; y:number; t:number }

export class CompanionSystem {
 testSelection: Set<CompanionKind> | null = null;
 setTestSelection(kinds: readonly CompanionKind[] | null):void {
  this.testSelection = kinds === null ? null : new Set(kinds.slice(0,2));
  this.resetStage();
 }
 readonly team: CompanionState[] = [
  {kind:'chiyan',name:'赤燕',role:'追击',level:1,xp:0,x:0,y:0,cooldown:.8,active:0,effective:0,count:0},
  {kind:'laodun',name:'老盾',role:'挡弹',level:1,xp:0,x:0,y:0,cooldown:0,active:0,effective:0,count:0},
  {kind:'moyuan',name:'墨鸢',role:'缚敌',level:1,xp:0,x:0,y:0,cooldown:2,active:0,effective:0,count:0},
  {kind:'suanpan',name:'算盘',role:'回墨',level:1,xp:0,x:0,y:0,cooldown:3,active:0,effective:0,count:0},
 ];
 private dash: Dash|null = null;
 private marked = new Map<Enemy,number>();
 private absorptions: Absorb[] = [];
 private beads: {t:number; delivered:boolean} | null = null;
 private time = 0;
 private formation='';
 private animations=new Map<CompanionKind,SpritePlayback>();
 private taught = new Set<CompanionKind>();
 private lessons:string[]=[];
 private nextLesson=0;
 readonly stats = { damage:0, blocked:0, bound:0, ink:0 };
 constructor(readonly w:CombatWorld,readonly progression:Progression){this.resetStage();}
 resetRun():void {this.testSelection=null;this.taught.clear();this.lessons=[];this.nextLesson=0;for(const s of this.team){s.level=1;s.xp=s.effective=0;}Object.assign(this.stats,{damage:0,blocked:0,bound:0,ink:0});this.resetStage();}
 resetStage():void {
  this.clearEffects();this.formation='';this.animations.clear();
  for(const s of this.team){const def=companionSprites.find(d=>d.id===`companion_${s.kind}`)!;this.animations.set(s.kind,new SpritePlayback(def.sheet??{count:def.frames??1,fps:12,mode:'loop'}));}
  for(const [i,s] of this.team.entries()){
   if(this.testSelection !== null && !this.testSelection.has(s.kind))continue;s.x=this.w.player.x+OFFSETS[i][0];s.y=this.w.player.y+OFFSETS[i][1];s.active=0;s.count=0;s.cooldown=[.8,0,2,3][i];}
 }
 private clearEffects():void {for(const e of this.marked.keys())e.companionSpeed=1;this.marked.clear();this.dash=null;this.beads=null;this.absorptions=[];for(const s of this.team)s.active=0;}
 reset(full=false):void {if(full)this.resetRun();else this.resetStage();}
 gain(kind:CompanionKind,amount:number):void {const s=this.team.find(c=>c.kind===kind)!;s.effective+=amount;}
 supply(power=1):void {for(const s of this.team)this.burst(s.kind,power);}
 isMarked(e:Enemy):boolean {return this.marked.has(e);}
 weaknessBonus(e:Enemy):number {return this.isMarked(e)?COMPANION_RULES.moyuan.damageScale:1;}
 private target(s:CompanionState):Enemy|undefined {
  const candidates=this.w.enemies.filter(e=>this.w.targetable(e)&&e.x>=0&&e.x<=900&&e.y>=0&&e.y<=1200&&Math.hypot(e.x-s.x,e.y-s.y)<=520);
  return candidates.sort((a,b)=>Number(this.isMarked(b))-Number(this.isMarked(a))||Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
 }
 private tell(s:CompanionState,text:string):void {
  this.w.ui.popup(s.x,s.y-36,`${s.name} ${text}`,'chain',`companion:${s.kind}`);
  if(!this.taught.has(s.kind)){
   this.taught.add(s.kind);
   const lesson:Record<CompanionKind,string>={chiyan:'赤燕沿红线追击，直接打伤敌人。',laodun:'老盾挡住盾线上的普通弹，最多六发。',moyuan:'墨鸢牵住敌人，让它变慢、更怕打。',suanpan:'墨少了，我送算珠补墨，接到才到账。'};
   this.lessons.push(lesson[s.kind]);
  }
 }
 burst(kind:CompanionKind,power=0):boolean {
  if(this.testSelection !== null && !this.testSelection.has(kind))return false;
  const p=this.w.player,s=this.team.find(c=>c.kind===kind)!;
  if(!p.alive||p.entering>0||s.active>0)return false;
  if(kind==='chiyan'){
   const target=this.target(s);if(!target)return false;
   const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy),travel=Math.min(220,d);
   this.dash={target,t:0,startX:s.x,startY:s.y,endX:clamp(s.x+dx/Math.max(1,d)*travel,30,870),endY:clamp(s.y+dy/Math.max(1,d)*travel,30,1170),hit:false,power};
   s.active=1.4;s.cooldown=COMPANION_RULES.chiyan.cooldown;this.tell(s,'追击');
  }else if(kind==='laodun'){
   s.active=COMPANION_RULES.laodun.duration;s.count=0;s.cooldown=COMPANION_RULES.laodun.cooldown;this.tell(s,'护盾展开');
  }else if(kind==='moyuan'){
   const target=this.target(s);if(!target)return false;
   // Boss 保持阶段和护甲，只获得支持标记。
   this.marked.set(target,COMPANION_RULES.moyuan.duration);
   if(!target.phaseLock&&!target.def.boss&&!target.parent?.phaseLock)target.companionSpeed=COMPANION_RULES.moyuan.speedScale;
   s.active=COMPANION_RULES.moyuan.duration;s.cooldown=COMPANION_RULES.moyuan.cooldown;s.count=1;this.stats.bound++;this.tell(s,target.companionSpeed<1?'缚住':'标记');
  }else{
   if(p.ink>=COMPANION_RULES.suanpan.stopInk)return false;
   this.beads={t:0,delivered:false};s.active=COMPANION_RULES.suanpan.duration;s.cooldown=COMPANION_RULES.suanpan.cooldown;this.tell(s,'送墨');
  }
  return true;
 }
 update(dt:number):void {
  this.time+=dt;const p=this.w.player;for(const animation of this.animations.values())animation.update(dt);
  if(p.alive&&p.entering<=0&&this.lessons.length&&this.time>=this.nextLesson&&!this.w.challengeState){this.w.say('算盘','平静',this.lessons.shift()!,3);this.nextLesson=this.time+4;}
  if(!p.alive){this.clearEffects();return;}
  const front=this.progression.has('Q1'),wings=this.progression.has('Q2');
  const formation=front?'Q1':wings?'Q2':'';
  if(formation!==this.formation){this.formation=formation;if(formation)this.progression.trigger(formation);}
  const offsets=front?[[0,-130],[-90,10],[90,-110],[0,90]]:wings?[[0,-80],[-110,-35],[0,-145],[110,-35]]:OFFSETS;
  for(const [i,s] of this.team.entries()){
   if(this.testSelection !== null && !this.testSelection.has(s.kind))continue;
   s.cooldown=Math.max(0,s.cooldown-dt);s.active=Math.max(0,s.active-dt);
   if(s.kind==='chiyan'&&this.dash)continue;
   const ox=s.kind==='laodun'&&s.active>0?0:offsets[i][0],oy=s.kind==='laodun'&&s.active>0?-62:offsets[i][1];
   s.x=approach(s.x,clamp(p.x+ox,30,870),10,dt);s.y=approach(s.y,clamp(p.y+oy,30,1170),10,dt);
  }
  if(p.entering<=0&&!this.w.challengeState){
   for(const s of this.team)if(s.cooldown<=0&&s.active<=0){
    if(s.kind==='chiyan'&&p.firing)this.burst(s.kind);
    if(s.kind==='moyuan'&&p.firing)this.burst(s.kind);
    if(s.kind==='laodun'&&this.w.bullets.list.some(b=>!b.dead&&!b.hard&&b.vy>0&&b.y<p.y&&Math.hypot(b.x-p.x,b.y-p.y)<190))this.burst(s.kind);
    if(s.kind==='suanpan'&&p.ink<COMPANION_RULES.suanpan.startInk)this.burst(s.kind);
   }
  }
  if(this.dash){
   const d=this.dash,s=this.team[0];d.t+=dt;
   if(d.target.dead||!this.w.targetable(d.target)){this.dash=null;s.active=0;}
   else{
    const strike=clamp((d.t-.45)/.55,0,1),back=clamp((d.t-1)/.4,0,1);
    const k=CURVES.cubic(strike),bk=CURVES.cubic(back);
    s.x=(d.startX+(d.endX-d.startX)*k)*(1-bk)+(p.x+offsets[0][0])*bk;
    s.y=(d.startY+(d.endY-d.startY)*k)*(1-bk)+(p.y+offsets[0][1])*bk;
    if(d.t>=.9&&!d.hit){d.hit=true;const damage=(18+d.power*4)*(this.progression.has('Q4')?1.15:1);const hp=d.target.hp;this.w.damage(d.target,damage,d.target.x,d.target.y,true,'companion');this.stats.damage+=Math.max(0,hp-d.target.hp);this.gain('chiyan',1);if(this.progression.has('Q4'))this.progression.trigger('Q4');this.w.fx.hit(d.target.x,d.target.y,[1.8,.6,.2],5);this.tell(s,'命中');}
    if(d.t>=1.4){this.dash=null;s.active=0;}
   }
  }
  for(const [e,t] of this.marked){if(t<=dt||e.dead||!this.w.targetable(e)){e.companionSpeed=1;this.marked.delete(e);}else this.marked.set(e,t-dt);}
  if(!this.marked.size)this.team[2].active=0;
  const shield=this.team[1];
  if(shield.active>0&&shield.count<6){
   for(const b of this.w.bullets.list){
    if(b.dead||b.hard||b.delay>0)continue;
    const nextY=b.y+b.vy*dt,near=Math.abs(b.y-shield.y)<=12+b.radius||((b.y-shield.y)*(nextY-shield.y)<=0);
    const hitX=b.x+b.vx*dt;
    if(!near||Math.abs(hitX-shield.x)>84+b.radius)continue;
    b.dead=true;shield.count++;this.stats.blocked++;this.absorptions.push({x:b.x,y:b.y,t:0});this.tell(shield,`挡弹 ×${shield.count}`);this.gain('laodun',1);
    if(shield.count>=6){shield.active=0;break;}
   }
  }
  for(const a of this.absorptions)a.t+=dt;this.absorptions=this.absorptions.filter(a=>a.t<.45);
  if(this.beads){const b=this.beads;b.t+=dt;if(b.t>=.6&&!b.delivered){b.delivered=true;const before=p.ink;p.ink+=Math.max(0,Math.min(.08,.5-p.ink));this.stats.ink+=Math.max(0,p.ink-before);this.tell(this.team[3],`回墨 +${Math.round(Math.max(0,p.ink-before)*100)}%`);this.gain('suanpan',1);}if(b.t>=3)this.beads=null;}
 }
 draw(r:Renderer,time:number):void {
  if(!this.w.player.alive)return;
  for(const [i,s] of this.team.entries()){
   if(this.testSelection !== null && !this.testSelection.has(s.kind))continue;
   r.air.add(`companion_${s.kind}`,{x:s.x,y:s.y,frame:this.animations.get(s.kind)?.frame??0,sx:.85,sy:.85,rot:Math.sin(time*2+i)*.06,glow:s.active>0?1.1:.7});
  }
  if(this.dash){const d=this.dash;const s=this.team[0];r.ribbonMid.line(d.startX,d.startY,d.target.x,d.target.y,d.t<.45?3:6,d.t<.45?RS.Warn:RS.Calligraphy,1.5,.45,.15,.75);if(d.t>.45)r.ribbonMid.line(s.x,s.y,d.target.x,d.target.y,3,RS.Trail,1.8,.55,.2,.7);}
  const shield=this.team[1];
  if(shield.active>0){r.ribbonMid.line(shield.x-84,shield.y,shield.x+84,shield.y,12,RS.InkHalo,.25,1.2,.8,.8);for(let i=shield.count;i<6;i++)r.bullets.add(shield.x-70+i*28,shield.y,0,5,3,.35,1.4,1,.85,1,.1);}
  for(const a of this.absorptions){const k=CURVES.cubic(a.t/.45);r.bullets.add(a.x+(shield.x-a.x)*k,a.y+(shield.y-a.y)*k,0,6*(1-k)+2,3,.4,1.4,.9,1-k,1,.1);}
  const control=this.team[2];
  for(const [e] of this.marked){r.ribbonMid.line(control.x,control.y,e.x,e.y,3,RS.InkTrail,.6,.45,1.1,.85);const size=e.radius+12;for(const x of [-1,1])for(const y of [-1,1]){r.ribbonMid.line(e.x+x*size,e.y+y*size,e.x+x*(size-12),e.y+y*size,3,RS.Glow,.7,.55,1.3,.8);r.ribbonMid.line(e.x+x*size,e.y+y*size,e.x+x*size,e.y+y*(size-12),3,RS.Glow,.7,.55,1.3,.8);}}
  if(this.beads){const b=this.beads,p=this.w.player,s=this.team[3];if(!b.delivered)for(let i=0;i<3;i++){const k=clamp(b.t/.6-i*.12,0,1);r.bullets.add(s.x+(p.x-s.x)*CURVES.cubic(k)+(i-1)*8,s.y+(p.y-s.y)*CURVES.cubic(k),0,7,3,1.3,1,.35,.95,1,.1);}else r.bullets.add(p.x,p.y,time*.4,28,4,.8,.7,.25,.22,1,.1);}
 }
}
