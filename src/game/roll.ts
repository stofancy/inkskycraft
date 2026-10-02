import { clamp, segDist2 } from '../core/math';
import { RS } from '../gl/ribbons';
import { PK } from '../gl/particles';
import type { World } from './world';
/** 翻滚使用未缩放时钟，充能逐次恢复；普通擦弹与翻滚回墨分开记账。 */
export class Roll {
  charges=2;
  recharge=0;
  left=0;
  frameActive=false;
  gained=0;
  totalInkGained=0;
  private protectionUntil=0;
  get protectionRemaining(){return Math.max(0,this.protectionUntil-this.w.real);}
  private traveled=0;
  private dx=0;
  private dy=0;
  private seen=new Set<object>();
  private trails:{x:number;y:number;t:number;alpha:number}[]=[];
  private trailCount=0;
  private trailClock=0;
  private oldX=0;
  private oldY=0;
  constructor(readonly w:World){}
  get maxCharges(){return this.w.progression?.has('jifeng')?3:2;}
  get active(){return this.left>0;}
  get scaleX(){return this.active?1-.85*Math.sin((1-this.left/.35)*Math.PI):1;}
  get flash(){return this.active?.4*Math.max(0,1-Math.abs(this.left-.175)/.05):0;}
  reset(){this.protectionUntil=0;this.frameActive=false;this.charges=this.maxCharges;this.recharge=this.left=this.gained=this.totalInkGained=0;this.trails=[];this.seen.clear();}
  cancel(){this.protectionUntil=0;this.frameActive=false;this.left=0;this.trails=[];}
  update(dt:number):void {
    if(this.charges<this.maxCharges){this.recharge-=dt;while(this.recharge<=1e-8&&this.charges<this.maxCharges){this.charges++;this.recharge+=1.5;}if(this.charges===this.maxCharges)this.recharge=0;}
    this.trails.forEach(t=>t.t+=dt);this.trails=this.trails.filter(t=>t.t<.25);
    this.frameActive=false;const p=this.w.player;this.oldX=p.x;this.oldY=p.y;
    if(!p.alive){this.cancel();return;}
    if(this.w.input.pressed('roll')&&!p.locked&&!this.active&&p.entering<=0&&this.charges>0){
      this.protectionUntil=this.w.real+.5;p.invuln=Math.max(p.invuln,.5);
      this.w.audio.sfx('roll');
      this.w.progression.trigger('jifeng');
      this.charges--;if(!this.recharge)this.recharge=1.5;this.left=.35;this.traveled=this.gained=this.trailClock=this.trailCount=0;
      this.w.fx.emitHigh({x:p.x,y:p.y,life:.1,size:50,sizeEnd:50,r:1,g:1,b:1,a:.8,kind:PK.Ring});this.seen.clear();
      const x=this.w.input.axisX,y=this.w.input.axisY,m=Math.hypot(x,y);this.dx=m?x/m:0;this.dy=m?y/m:0;
    }
    if(!this.active)return;this.frameActive=true;
    const next=Math.max(0,this.left-dt),travel=120*(1-(next/.35)**3),delta=travel-this.traveled;
    p.x=clamp(p.x+this.dx*delta,26,874);p.y=clamp(p.y+this.dy*delta,50,1164);this.traveled=travel;
    this.trailClock+=dt;if(this.trailClock+1e-8>=.05&&this.trailCount<4){this.trailClock-=.05;this.trails.push({x:p.x,y:p.y,t:0,alpha:[.7,.5,.35,.2][this.trailCount++]});}
    this.collect();this.left=next;
  }
  collect():void {
    if(!this.frameActive)return;const p=this.w.player;
    for(const b of this.w.bullets.list){
      if(b.dead||this.seen.has(b)||segDist2(b.x,b.y,this.oldX,this.oldY,p.x,p.y)>28**2)continue;
      this.seen.add(b);b.grazed=true;
      const amount=Math.max(0,Math.min(.01,.1-this.gained,1-p.ink));p.ink+=amount;this.gained+=amount;this.totalInkGained+=amount;
      this.w.fx.emitHigh({x:b.x,y:b.y,life:.16,size:4,r:2,g:2,b:2,kind:PK.Spark});
      if(this.seen.size===1)this.w.audio.sfx('graze',{vol:.5});
    }
  }
  draw():void {
    const p=this.w.player,r=this.w.r;
    const c=p.weapon==='red'?[1,.3,.08]:p.weapon==='purple'?[.75,.3,1]:[.15,1,.7];
    if(this.protectionRemaining>0)for(const side of [-1,1])r.player.add(p.sprite,{x:p.x+side*4,y:p.y+3,sx:this.scaleX*1.08,sy:1.05,alpha:.16*Math.min(1,this.protectionRemaining/.1),r:.15,g:.12,b:.1,glow:.1});
    for(const t of this.trails)r.player.add(p.sprite,{x:t.x,y:t.y,sx:.85,sy:1,alpha:t.alpha*(1-t.t/.25),r:c[0],g:c[1],b:c[2],glow:.6});
    const age=.35-this.left,alpha=this.active?.8*Math.max(0,1-age/.2):0;
    if(alpha>0)for(const side of [-1,1])r.ribbonTop.line(p.x+side*45,p.y+45,p.x+side*45,p.y-45,1.5,RS.Glow,1,1,1,alpha);
  }
}
