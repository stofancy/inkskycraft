import { segDist2 } from '../core/math';
import { RS } from '../gl/ribbons';
import { PK } from '../gl/particles';
import type { Enemy } from './enemy';
import type { World } from './world';
import type { CompanionState } from './companion';
import type { WeaponColor } from '../types';
import { BRUSH_COLORS, type BrushCast } from './brush-colors';
interface Flight {angle?:number;pts:number[];index:number;x:number;y:number;speed:number;damage:number;seen:Set<Enemy>;color:WeaponColor;delay:number;kind:'arrow'|'chiyan'|'spear';companion?:CompanionState;done?:boolean;cast:BrushCast;side?:boolean}
export class BrushPaths {
  flights:Flight[]=[];
  drops:{x:number;y:number}[]=[];
  private finishes:{x:number;y:number;t:number}[]=[];
  private tails:{x:number;y:number;angle:number;t:number}[]=[];
  private color(c:WeaponColor):[number,number,number]{return BRUSH_COLORS[c];}
  private fieldCasts=new Set<number>();
  private arrowHit(x:number,y:number,color:WeaponColor){const c=this.color(color);this.w.fx.emitHigh({x,y,life:.15,size:20,sizeEnd:20,r:.015,g:.012,b:.012,a:.95,kind:PK.Ink});for(let i=0;i<7;i++){const a=i*Math.PI*2/7;this.w.fx.emitHigh({x,y,vx:Math.cos(a)*180,vy:Math.sin(a)*180,life:.16,size:3,r:c[0],g:c[1],b:c[2],kind:PK.Spark});}}
  verticalSerial=0;
  verticalHits=new Set<number>();
  constructor(readonly w:World){}
  arrows(pts:number[],count:number,cast:BrushCast=this.w.brush.colors.cast(pts)){const p=this.w.player;for(let i=0;i<count;i++)this.flights.push({pts:[p.x,p.y,...pts],index:2,x:p.x,y:p.y,speed:1600,damage:25,seen:new Set(),color:cast.color,cast,delay:i*.04,kind:'arrow'});}
  chiyan(pts:number[],cast:BrushCast=this.w.brush.colors.cast(pts)){const s=this.w.companions.team.find(s=>s.kind==='chiyan');if(!s)return;this.w.companions.beginPenFlight();s.penFlight=true;this.flights.push({pts:pts.slice(),index:2,x:pts[0],y:pts[1],speed:1400,damage:60,seen:new Set(),color:cast.color,cast,delay:0,kind:'chiyan',companion:s});}
  spear(pts:number[],cast:BrushCast=this.w.brush.colors.cast(pts)){
    const n=pts.length,lower=pts[1]>pts[n-1]?[pts[0],pts[1]]:[pts[n-2],pts[n-1]],upper=pts[1]>pts[n-1]?[pts[n-2],pts[n-1]]:[pts[0],pts[1]],dx=upper[0]-lower[0],dy=upper[1]-lower[1],k=(-80-lower[1])/dy;
    this.verticalSerial++;this.verticalHits.clear();
    this.flights.push({pts:[...lower,...upper,lower[0]+dx*k,-80],index:2,x:lower[0],y:lower[1],speed:1600,damage:90,seen:new Set(),color:cast.color,cast,delay:0,kind:'spear'});
    if(cast.color==='blue')for(const offset of [-40,40])this.flights.push({pts:[lower[0]+offset,lower[1],upper[0]+offset,upper[1],lower[0]+dx*k+offset,-80],index:2,x:lower[0]+offset,y:lower[1],speed:1600,damage:45*cast.scale,seen:new Set(),color:cast.color,cast,delay:0,kind:'spear',side:true});
  }
  update(dt:number){
    const w=this.w;if(w.bossCombat.freeze)return;
    this.finishes.forEach(v=>{v.t+=dt;if(v.t>=.15)for(let i=0;i<12;i++){const a=i*Math.PI*2/12;w.fx.emitHigh({x:v.x,y:v.y,vx:Math.cos(a)*260,vy:Math.sin(a)*260,life:.3,size:4,sizeEnd:2,r:.015,g:.012,b:.012,a:.9,kind:PK.Ink});}});this.finishes=this.finishes.filter(v=>v.t<.15);
    this.tails.forEach(v=>v.t+=dt);this.tails=this.tails.filter(v=>v.t<.15);
    for(const f of this.flights){
      if(f.companion&&!w.companions.team.includes(f.companion)){f.done=true;f.companion.penFlight=false;continue;}
      const before=f.delay;f.delay=Math.max(0,f.delay-dt);let remaining=f.speed*Math.max(0,dt-before);if(f.delay>0)continue;
      while(f.index<f.pts.length&&remaining>0){const tx=f.pts[f.index],ty=f.pts[f.index+1],dx=tx-f.x,dy=ty-f.y,d=Math.hypot(dx,dy),step=Math.min(d,remaining),x=f.x,y=f.y;if(d>0)f.angle=Math.atan2(dy,dx);f.x+=dx/(d||1)*step;f.y+=dy/(d||1)*step;remaining-=step;
        for(const e of w.enemies)if(!f.seen.has(e)&&w.targetable(e,true)&&segDist2(e.x,e.y,x,y,f.x,f.y)<=(26+e.radius)**2){
          f.seen.add(e);const armor=(e.def.armor??1)<1||!!e.onArmorLoosened,amount=f.damage*(f.kind==='spear'&&armor?2:1);
          if(f.kind==='chiyan')w.damage(e,amount,e.x,e.y,true,'companion');else w.brush.colors.damage(e,amount,f.cast,f.side?{ignoreLoosen:true}:{});
          if(f.kind==='spear'){this.verticalHits.add(e.id);w.loosenArmor(e,f.color==='blue'?6:4);if(!f.side&&f.color==='purple')w.brush.colors.chain(e,amount*.5,160,2,f.cast);}
          if(f.kind==='arrow'&&f.color==='purple')w.brush.colors.chain(e,25,160,1,f.cast);
          w.fx.hit(e.x,e.y,this.color(f.color),5);if(f.kind==='arrow')this.arrowHit(e.x,e.y,f.color);
        }
        if(f.kind==='arrow')for(const b of w.bullets.list)if(!b.dead&&!b.hard&&segDist2(b.x,b.y,x,y,f.x,f.y)<=(26+b.radius)**2)b.dead=true;
        if(d<=step+1e-7){f.index+=2;if(f.kind==='spear'&&!f.side&&f.color==='red'&&f.index===4){w.brush.colors.burst(f.x,f.y,110,f.cast,60);w.brush.colors.field(f.pts.slice(0,4),'fire',f.cast);}}

      }
      if(f.companion){f.companion.x=f.x;f.companion.y=f.y;}
      if(f.index>=f.pts.length){f.done=true;if(f.companion)f.companion.penFlight=false;
        if(f.kind==='arrow'){
          if(f.color==='blue')w.brush.colors.beam(f.x,f.y,f.angle??-Math.PI/2,400,80,f.cast);
          else {w.brush.colors.burst(f.x,f.y,f.color==='red'?130:80,f.cast,f.color==='red'?90:60,f.color==='red');this.finishes.push({x:f.x,y:f.y,t:0});}
          if(!this.fieldCasts.has(f.cast.id)){this.fieldCasts.add(f.cast.id);if(f.color==='red')w.brush.colors.field([f.x,f.y,130],'fire',f.cast);if(f.color==='purple')w.brush.colors.field([f.x,f.y],'orb',f.cast);}
          this.tails.push({x:f.x,y:f.y,angle:f.angle??-Math.PI/2,t:0});w.fx.emitHigh({x:f.x,y:f.y,life:.15,size:14,sizeEnd:4,r:2,g:2,b:2,a:1,kind:PK.Dot});
        }

      }
    }this.flights=this.flights.filter(f=>!f.done);
    for(const id of this.fieldCasts)if(!this.flights.some(f=>f.cast.id===id))this.fieldCasts.delete(id);
    for(const d of this.drops){const dx=w.player.x-d.x,dy=w.player.y-d.y,dist=Math.hypot(dx,dy),step=700*dt;d.x+=dx/(dist||1)*Math.min(dist,step);d.y+=dy/(dist||1)*Math.min(dist,step);if(dist<=step+10){w.player.ink=Math.min(1,w.player.ink+.005);d.x=NaN;}}
    this.drops=this.drops.filter(d=>Number.isFinite(d.x));
  }
  private tail(x:number,y:number,angle:number,alpha:number){const dx=Math.cos(angle),dy=Math.sin(angle);this.w.r.ribbonTop.line(x-dx*96,y-dy*96,x-dx*36,y-dy*36,2.5,RS.InkTrail,.015,.012,.012,alpha);}
  draw(){const r=this.w.r;
    for(const v of this.finishes){const radius=80*v.t/.15,pts:number[]=[];for(let i=0;i<=40;i++){const a=i*Math.PI*2/40;pts.push(v.x+Math.cos(a)*radius,v.y+Math.sin(a)*radius);}r.ribbonTop.strip(pts,3,RS.InkHalo,.015,.012,.012,1-v.t/.15);}
    for(const t of this.tails)this.tail(t.x,t.y,t.angle,.7*(1-t.t/.15));
    for(const f of this.flights){if(f.delay>0)continue;const c=this.color(f.color),angle=f.angle??-Math.PI/2,dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
      if(f.kind==='arrow'){this.tail(f.x,f.y,angle,.7);r.ribbonTop.line(f.x-dx*36,f.y-dy*36,f.x,f.y,4,RS.Glow,...c as [number,number,number],.9);r.ribbonTop.line(f.x-dx*36,f.y-dy*36,f.x,f.y,2.5,RS.InkArrow,.015,.012,.012,1);const head=[f.x-dx*10+nx*5,f.y-dy*10+ny*5,f.x,f.y,f.x-dx*10-nx*5,f.y-dy*10-ny*5];r.ribbonTop.strip(head,3,RS.Glow,...c as [number,number,number],1);r.ribbonTop.strip(head,1.5,RS.InkArrow,.015,.012,.012,1);continue;}
      r.ribbonTop.line(f.x-dx*38,f.y-dy*38,f.x+dx*12,f.y+dy*12,f.kind==='spear'?12:5,RS.InkTrail,.06,.07,.07,.95);
      r.ribbonTop.line(f.x-dx*23,f.y-dy*23,f.x+dx*15,f.y+dy*15,2,RS.Glow,c[0],c[1],c[2],.8);
      r.ribbonTop.strip([f.x+nx*8-dx*3,f.y+ny*8-dy*3,f.x+dx*15,f.y+dy*15,f.x-nx*8-dx*3,f.y-ny*8-dy*3],3,RS.InkTrail,.06,.07,.07,.95);
      if(f.kind==='spear')r.ribbonTop.line(f.x-dx*75,f.y-dy*75,f.x+dx*42,f.y+dy*42,f.color==='blue'?14:4,f.color==='blue'?RS.Sword:RS.Calligraphy,...c as [number,number,number],1);}
    for(const d of this.drops)r.bullets.add(d.x,d.y,0,5,0,.15,.3,.3,1,.5,.1);
  }
  clear(){for(const f of this.flights)if(f.companion)f.companion.penFlight=false;this.flights=[];this.drops=[];this.finishes=[];this.tails=[];this.verticalSerial=0;this.verticalHits.clear();this.fieldCasts.clear();}
}
