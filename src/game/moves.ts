import { DirectionBuffer, directionFromAxes, type Command } from '../core/commands';
import { clamp, segDist2 } from '../core/math';
import { RS } from '../gl/ribbons';
import { PLAY_H, PLAY_W, type MoveId, type WeaponColor } from '../types';
import type { Enemy } from './enemy';
import type { World } from './world';
export interface ActiveMove extends Command { id: MoveId; name: string; input: string; effect: string; cost: number; cooldown: number }
export const ACTIVE_MOVES: readonly ActiveMove[] = [
  {id:'guard',name:'回墨护身',sequence:[2,2,8,8],input:'↓ ↓ ↑ ↑',window:1.4,cost:.18,cooldown:6,effect:'立即清掉身边普通敌弹，硬弹与激光仍需躲避'},
  {id:'cut',name:'一笔破阵',sequence:[2,3,6],input:'↓ ↘ →',window:1.2,cost:.12,cooldown:4,effect:'前方笔锋造成 55 点墨伤害，清开一条弹路'},
  {id:'dash',name:'飞身追击',sequence:[8,6],input:'↑ →',window:1.2,cost:.15,cooldown:5,effect:'向前突进 160，短暂接触保护，保持移动与切色'},
  {id:'assist',name:'伙伴合击',sequence:[4,2,6],input:'← ↓ →',window:1.2,cost:.25,cooldown:10,effect:'伙伴锁定同一目标，各执行一次追击、护送或牵制'},
  {id:'counter',name:'回身反击',sequence:[2,4],input:'↓ ←',window:1.2,cost:.10,cooldown:5,effect:'0.4 秒内拦一发普通敌弹，返出 45 点墨锋；硬弹与激光穿过'},
];
interface Visual { id: MoveId; x:number; y:number; age:number; duration:number; color:WeaponColor; target:Enemy|null; endX:number; endY:number; angle:number; origins:{x:number;y:number}[] }
interface Dash { left:number; traveled:number }
interface Counter { left:number; angle:number }
export class MoveSystem {
  readonly buffer = new DirectionBuffer();
  private time = 0;
  private readonly readyAt = new Map<string, number>();
  private visuals: Visual[] = [];
  private dash: Dash | null = null;
  private counter: Counter | null = null;
  private stopLeft = 0;
  private resetSerial = -1;
  feedback = '';
  private feedbackLeft = 0;
  total = 0;
  lastId = '';
  lastCleared = 0;
  lastHits = 0;
  lastDamage = 0;
  lastDistance = 0;
  constructor(readonly w: World) {}
  resetInput(): void { this.buffer.clear(); }
  resetStage(): void {
    this.resetInput();this.readyAt.clear();this.visuals=[];this.dash=this.counter=null;this.stopLeft=0;
    this.feedback='';this.feedbackLeft=0;this.w.r.moveTitles.clear();
  }
  resetRun(): void { this.resetStage();this.total=0;this.lastId=''; }
  /** 世界整帧停顿 3–4 帧；输入窗口与题字使用真实时间，暂停不消费停顿。 */
  consumeHitstop(dt:number):boolean {
    if(this.stopLeft<=0)return false;
    this.stopLeft=Math.max(0,this.stopLeft-dt);if(this.stopLeft<1e-6)this.stopLeft=0;
    return true;
  }
  get hitstopRemaining():number { return this.stopLeft; }
  get counterRemaining():number { return this.counter?.left??0; }
  update(realDt:number,dt=realDt): void {
    const {input,player:p}=this.w;
    this.time+=realDt;this.feedbackLeft=Math.max(0,this.feedbackLeft-realDt);if(!this.feedbackLeft)this.feedback='';
    if(!p.alive||p.entering>0){this.dash=this.counter=null;this.visuals=[];this.stopLeft=0;}
    for(const v of this.visuals)v.age+=dt;
    this.visuals=this.visuals.filter(v=>v.age<v.duration);
    if(this.dash){
      const d=this.dash;d.left=Math.max(0,d.left-dt);
      const travel=160*(1-Math.pow(d.left/.18,3)),delta=travel-d.traveled,old=p.y;
      p.y=clamp(p.y-delta,50,PLAY_H-36);this.lastDistance+=old-p.y;d.traveled=travel;
      p.invuln=Math.max(p.invuln,d.left+.025);if(!d.left)this.dash=null;
    }
    if(this.counter){this.counter.left-=dt;if(this.counter.left<=0)this.counter=null;}
    if(this.resetSerial!==input.resetSerial){this.resetInput();this.resetSerial=input.resetSerial;}
    if(!p.alive||p.entering>0||this.w.brush.active||this.w.challengeState){
      this.resetInput();this.counter=null;
      if(input.pressed('move'))this.say('出招暂不可用');return;
    }
    this.buffer.sample(directionFromAxes(input.axisX,input.axisY),this.time);
    if(!input.pressed('move'))return;
    const move=[...ACTIVE_MOVES].sort((a,b)=>b.sequence.length-a.sequence.length).find(m=>this.buffer.matches(m,this.time));
    this.resetInput();
    if(!move){this.say('指令未完成 · 按箭头再试');return;}
    const cd=this.remaining(move);
    if(cd>0){this.say(`${move.name} · 冷却 ${cd.toFixed(1)} 秒`);return;}
    if(move.id==='assist'&&!this.w.companions.team.length){this.say('没有出战伙伴');return;}
    if(p.ink<move.cost){this.say(`墨不足 · 需要 ${Math.round(move.cost*100)}%`);return;}
    p.ink-=move.cost;this.readyAt.set(move.id,this.time+move.cooldown);
    this.execute(move);this.total++;this.lastId=move.id;this.say(`${move.name}！`,true);
  }
  private say(text:string,success=false):void {
    this.feedback=text;this.feedbackLeft=1.8;if(!success)this.w.audio.sfx('menu_back');
  }
  private remaining(m:ActiveMove):number {return Math.max(0,(this.readyAt.get(m.id)??0)-this.time);}
  private target():Enemy|null {
    const w=this.w,last=w.lastWeaponTarget;
    return last&&w.targetable(last)?last:w.enemies.find(e=>w.targetable(e)&&w.companions.isMarked(e))??w.nearestEnemy(w.player.x,w.player.y,PLAY_H);
  }
  get hud() {
    return {feedback:this.feedback,history:this.buffer.icons,moves:ACTIVE_MOVES.map(m=>({id:m.id,name:m.name,input:m.input,cost:m.cost,cooldown:this.remaining(m),available:this.w.player.alive&&this.w.player.entering<=0&&!this.w.brush.active&&!this.w.challengeState&&(m.id!=='assist'||this.w.companions.team.length>0)}))};
  }
  private addVisual(id:MoveId,duration:number,target:Enemy|null=null,endX=this.w.player.x,endY=this.w.player.y,angle=-Math.PI/2):void {
    const p=this.w.player;
    this.visuals.push({id,x:p.x,y:p.y,age:0,duration,color:p.weapon,target,endX,endY,angle,origins:this.w.companions.team.map(s=>({x:s.x,y:s.y}))});
  }
  private hurt(e:Enemy,amount:number,x=e.x,y=e.y):void {
    const hp=e.hp;this.w.damage(e,amount,x,y,true,'ink');const dealt=Math.max(0,hp-e.hp);
    if(dealt>0){this.lastHits++;this.lastDamage+=dealt;}
  }
  private execute(move:ActiveMove):void {
    const w=this.w,p=w.player,x=p.x,y=p.y;
    this.lastCleared=this.lastHits=this.lastDamage=this.lastDistance=0;
    if(move.id==='guard'||move.id==='cut'){
      const area=(px:number,py:number,r=0)=>move.id==='guard'?Math.hypot(px-x,py-y)<155+r:segDist2(px,py,x,y-25,x,y-430)<(34+r)**2;
      for(const b of w.bullets.list)if(!b.dead&&!b.hard&&area(b.x,b.y,b.radius)){b.dead=true;this.lastCleared++;w.fx.gold(b.x,b.y);}
      if(move.id==='cut')for(const e of [...w.enemies])if(w.targetable(e)&&area(e.x,e.y,e.radius))this.hurt(e,55);
      this.addVisual(move.id,.65);w.fx.ink(x,y-35,move.id==='guard'?100:45,.8);
    }
    if(move.id==='dash'){this.dash={left:.18,traveled:0};p.invuln=Math.max(p.invuln,.22);this.addVisual('dash',.55);}
    if(move.id==='assist'){const target=this.target();w.companions.supply(1);this.addVisual('assist',1.05,target);}
    if(move.id==='counter'){this.counter={left:.4,angle:-Math.PI/2};}
    this.stopLeft=Math.max(this.stopLeft,move.id==='cut'?.065:.045);
    w.fx.shake(move.id==='cut'?.13:.075);
    w.r.moveTitles.spawn(move.id,w.real);w.audio.sfx(`move:${move.id}`);
  }
  /** 敌弹推进之后、碰撞之前调用：只拦首次普通弹，不改硬弹与激光判定。 */
  interceptCounter():void {
    const w=this.w,p=w.player,c=this.counter;if(!c||!p.alive)return;
    let nearest=null,best=Infinity;
    for(const b of w.bullets.list)if(!b.dead&&!b.hard){const d=Math.hypot(b.x-p.x,b.y-p.y);if(d<best){best=d;nearest=b;}}
    if(!nearest)return;c.angle=Math.atan2(nearest.y-p.y,nearest.x-p.x);
    if(best>72+nearest.radius)return;
    nearest.dead=true;this.lastCleared++;w.fx.gold(nearest.x,nearest.y);
    const target=w.nearestEnemy(p.x,p.y,PLAY_H);this.addVisual('counter',.38,target,target?.x??p.x,target?.y??Math.max(50,p.y-340),c.angle);
    if(target)this.hurt(target,45);
    this.counter=null;this.stopLeft=Math.max(this.stopLeft,.035);w.fx.shake(.07);
  }
  draw():void {
    const r=this.w.r,p=this.w.player;
    for(const v of this.visuals){
      if(v.id==='cut'||v.id==='guard'){r.ribbonMid.move(v.id,v.x,v.y,v.age);continue;}
      const alpha=Math.min(1,(v.duration-v.age)/.18);
      if(v.id==='dash'){
        const endX=p.x,endY=p.y;
        r.ribbonMid.strip([v.x,v.y+12,(v.x+endX)/2,(v.y+endY)/2+20,endX,endY+25],[2,13,4],RS.Trail,1.8,1.05,.2,alpha*.55);
        for(const side of [-1,1]){
          r.air.add(p.sprite,{x:endX+side*(22+v.age*12),y:endY+48+v.age*48,rot:side*.25,sx:.72,sy:.65,r:1.4,g:1.1,b:.45,alpha:alpha*.22,glow:.3});
        }
      }else if(v.id==='assist'){
        const target=v.target&&!v.target.dead?v.target:null,tx=target?.x??v.x,ty=target?.y??v.y-110;
        const u=clamp((v.age-.12)/.45,0,1),color=v.color==='blue'?[.12,1.25,.9]:v.color==='purple'?[1.1,.3,1.7]:[1.8,.35,.1];
        for(const [i,o]of v.origins.entries()){
          const pts:number[]=[],width:number[]=[];
          for(let j=0;j<=20;j++){const t=j/20*u,a=(i-1)*1.4,ox=Math.sin(t*Math.PI)*Math.cos(a)*90,oy=Math.sin(t*Math.PI)*Math.sin(a)*50;
            pts.push(o.x+(tx-o.x)*t+ox,o.y+(ty-o.y)*t+oy);width.push(4*Math.sin(j/20*Math.PI)+1);}
          r.ribbonMid.strip(pts,width,RS.InkTrail,...color as [number,number,number],alpha*.65);
        }
      }else{
        const target=v.target&&!v.target.dead?v.target:null,tx=target?.x??v.endX,ty=target?.y??v.endY;
        const c:[number,number,number]=v.color==='blue'?[.1,1.1,.85]:v.color==='purple'?[1,.25,1.5]:[1.4,.18,.035];
        const fold=1-Math.pow(1-Math.min(1,v.age/.08),3),pts:number[]=[],width:number[]=[];
        for(let j=0;j<=28;j++){
          const t=j/28,a=v.angle-1.3+t*2.6,ax=v.x+Math.cos(a)*72,ay=v.y+Math.sin(a)*72;
          pts.push(ax+(v.x+(tx-v.x)*t-ax)*fold,ay+(v.y+(ty-v.y)*t-ay)*fold);
          width.push((5*(1-fold)+9*fold*(1-t))*(1-v.age/v.duration));
        }
        r.ribbonMid.strip(pts,width,RS.Calligraphy,...c,alpha);
      }
    }
    if(this.counter){
      const pts:number[]=[];for(let i=0;i<=32;i++){const a=this.counter.angle-1.3+i/32*2.6;pts.push(p.x+Math.cos(a)*72,p.y+Math.sin(a)*72);}
      r.ribbonMid.strip(pts,5,RS.InkHalo,.10,.32,.30,Math.min(1,this.counter.left/.1));
    }
  }
}
