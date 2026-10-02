// 纸龙新能力的程序占位与真实碰撞；墙结/字形弹属于机关，不记 Boss 的来源账。
import { clamp,angleDiff } from '../core/math';
import type { Enemy } from './enemy';
import type { World } from './world';
export class PaperEffects {
 walls:{y:number;speed:number;nodes:Enemy[];holes:number[];shipHit:boolean;index:number;oldY:number}[]=[];
 rows:{text:string;glyphs:Enemy[];self:boolean;left:number}[]=[];
 chain:{node:Enemy;shipY:number;cut:boolean;clip:Enemy;since:number}|null=null;
 shipTag=false;introScan=false;tag=false;burn=0;tagHint=0;station=false;stationY=100;gather=0;bare=false;
 stats={walls:0,holes:0,wallShipHits:0,tags:0,tagRolls:0,tagBurns:0,chainCasts:0,chainShotCuts:0,chainQteCuts:0,chainShipHits:0,rows:0,glyphBreaks:0,selfRows:0};
 constructor(readonly w:World,readonly boss:Enemy){boss.data.paperEffects=this;}
 private node(x:number,y:number,hitsRed:number,hitsOther:number,onBreak:()=>void):Enemy {
  const e=this.w.spawn({sprite:'pd-register',hp:1e6,radius:20,noCollide:true,score:0,onHit:(e,_g,_x,_y,source)=>{
   const gap=source==='red'?0:.1;if(this.w.real<(e.data.nextHit??0))return;e.data.nextHit=this.w.real+gap;e.data.hits=(e.data.hits??0)+1;if(e.data.hits>=(source==='red'?hitsRed:hitsOther)){this.w.remove(e);onBreak();}
  }},x,y,e=>{e.data.contentRole='prop';e.data.paperProp=true;});return e;
 }
 wall(index:number):void {const wall={y:100,speed:index>=5?150:120,nodes:[] as Enemy[],holes:[] as number[],shipHit:false,index,oldY:100};
  wall.nodes=[260,640].map(x=>this.node(x,wall.y,3,8,()=>{wall.holes.push(x);this.stats.holes++;}));this.walls.push(wall);this.stats.walls++;
 }
 row(text:string,self=false):void {const y=self?500:170,glyphs:Enemy[]=[];let x=100;for(let i=0;i<text.length;i++){if(!self&&(i===3||i===6&&text.length>8))x+=120;const e=this.node(x,y,1,2,()=>{this.stats.glyphBreaks++;});e.alpha=0;e.data.glyph=text[i];glyphs.push(e);x+=42;}
  this.rows.push({text,glyphs,self,left:self?5:12});this.stats.rows++;if(self)this.stats.selfRows++;
 }
 attachTag():void {if(this.tag)return;this.tag=true;this.burn=0;this.tagHint=4;this.stats.tags++;}
 chainShip(clip:Enemy):Enemy {this.stats.chainCasts++;const ship=this.w.escort?.scene,sy=ship?.y??1000;
  const node=this.w.spawn({sprite:'pd-register',hp:60,radius:24,hitPriority:40,noCollide:true,score:0,onHit:(e)=>{if(e.hp<=0)this.cutChain(false);}},450,(clip.y+sy)/2,e=>{e.data.contentRole='prop';e.data.paperProp=true;e.data.weakWeapon='red';});
  // 特定结朱色倍率是2，不与通常弱点1.35叠加。
  node.data.paperKnot=true;node.phaseLock=true;this.chain={node,shipY:sy,cut:false,clip,since:this.w.real};return node;
 }
 cutChain(qte:boolean):void {if(!this.chain||this.chain.cut)return;this.chain.cut=true;this.w.remove(this.chain.node);if(qte)this.stats.chainQteCuts++;else this.stats.chainShotCuts++;this.w.fx.burst(450,this.chain.node.y,20,140,[1.5,.45,.1]);}
 update(dt:number):void {const w=this.w,p=w.player;if(w.bossCombat.freeze)return;this.tagHint=Math.max(0,this.tagHint-dt);
  if(this.tag){if(w.roll.frameActive){this.tag=false;this.stats.tagRolls++;}else {this.burn=p.weapon==='red'&&p.firing?this.burn+dt:0;if(this.burn>=1.5){this.tag=false;this.stats.tagBurns++;}}}
  for(const wall of this.walls){wall.oldY=wall.y;wall.y+=wall.speed*dt;for(const e of wall.nodes)if(!e.dead)e.y=wall.y;
   const open=(x:number)=>wall.holes.some(h=>Math.abs(x-h)<=70);if(!open(p.x)&&p.y>=wall.oldY-18&&p.y<=wall.y+18&&p.invuln<=0)p.die();
   const ship=w.escort?.scene;if(ship&&!wall.shipHit&&wall.y>=ship.y-135){wall.shipHit=true;if(!open(ship.x)){w.escort!.durability=Math.max(1,w.escort!.durability-2);this.stats.wallShipHits++;}}
  }for(const wall of this.walls.filter(v=>v.y>1300))for(const e of wall.nodes)if(!e.dead)w.remove(e);this.walls=this.walls.filter(v=>v.y<=1300);
  const c=this.chain;if(c&&!c.cut){if(c.node.hp<=0||c.node.dead)this.cutChain(false);else{const ship=w.escort?.scene;if(ship){ship.y-=30*dt;c.node.x=(ship.x+c.clip.x)/2;c.node.y=(ship.y+c.clip.y)/2;if(ship.y<=this.stationY+260){w.escort!.durability=Math.max(1,w.escort!.durability-8);this.stats.chainShipHits++;this.cutChain(false);}}}}
  for(const row of this.rows){row.left-=dt;for(const e of row.glyphs)if(!e.dead){if(!row.self){e.y+=90*dt;if(Math.hypot(e.x-p.x,e.y-p.y)<=21&&p.invuln<=0)p.die();}if(row.left<=0){if(row.self&&!e.dead)w.fx.burst(e.x,e.y,6,90,[.9,.75,.5]);w.remove(e);}}}
  this.rows=this.rows.filter(v=>v.left>0);
 }
 page(x:number,y:number,angle:number,split=false):void {const tag=this.tag,w=this.w;let divided=false;w.shoot(x,y,angle,110/w.difficulty.speed,{shape:'rice',color:'gold',life:9,homing:tag,update:(b,dt)=>{
   if(tag){b.angle+=clamp(angleDiff(Math.atan2(w.player.y-b.y,w.player.x-b.x),b.angle),-Math.PI/3*dt,Math.PI/3*dt);}
   if(split&&!divided&&b.y>=580){divided=true;w.fan(b.x,b.y,Math.PI/2,3,.45,140,{shape:'rice',color:'gold',life:3});return false;}
  }});}
 clear():void {for(const wall of this.walls)for(const e of wall.nodes)this.w.remove(e);for(const row of this.rows)for(const e of row.glyphs)this.w.remove(e);if(this.chain)this.w.remove(this.chain.node);this.walls=[];this.rows=[];this.chain=null;this.tag=false;}
 svg():string {let out='';if(this.gather<1)for(let i=0;i<24;i++){const a=i*2.4,d=(1-this.gather)*(200+i*10);out+=`<rect x="${450+Math.cos(a)*d}" y="${270+Math.sin(a)*d}" width="30" height="20" fill="#d7c99d" transform="rotate(${i*17} ${450+Math.cos(a)*d} ${270+Math.sin(a)*d})"/>`;}if(this.shipTag){const s=this.w.escort?.scene;if(s)out+=`<rect x="${s.x-28}" y="${s.y-130}" width="56" height="90" fill="#e9d48e"/><text x="${s.x-22}" y="${s.y-100}" font-size="24" fill="#30251b">钩</text>`;}if(this.introScan){const s=this.w.escort?.scene;if(s)out+=`<path d="M${this.boss.x} ${this.boss.y}L${s.x-120} ${s.y}L${s.x+120} ${s.y}Z" fill="#ffffff20"/>`;}for(const wall of this.walls){let x=0;for(const h of [...wall.holes].sort((a,b)=>a-b)){out+=`<path d="M${x} ${wall.y}H${h-70}" stroke="#d4bd77" stroke-width="28"/>`;x=h+70;}out+=`<path d="M${x} ${wall.y}H900" stroke="#d4bd77" stroke-width="28"/><text x="450" y="${wall.y+9}" fill="#402c20" font-size="26">封</text>`;for(const n of wall.nodes)if(!n.dead)out+=`<circle cx="${n.x}" cy="${n.y}" r="18" stroke="white" fill="#f0b55b"/>`;}
  for(const row of this.rows)for(const e of row.glyphs)if(!e.dead)out+=`<text x="${e.x}" y="${e.y}" text-anchor="middle" font-size="34" fill="${row.self?'#e7d6a9':'#171614'}" stroke="#d8c393" stroke-width=".4">${e.data.glyph}</text>`;
  if(this.chain&&!this.chain.cut){const c=this.chain;out+=`<path d="M${c.clip.x} ${c.clip.y}L${this.w.escort?.scene.x??450} ${this.w.escort?.scene.y??1000}" stroke="#e0c98a" stroke-width="9" stroke-dasharray="14 5"/><circle cx="${c.node.x}" cy="${c.node.y}" r="24" fill="#ca6025" stroke="white" stroke-width="4"/>`;}
  if(this.tag)out+=`<g transform="translate(${this.w.player.x+25} ${this.w.player.y+40}) rotate(12)"><rect width="35" height="85" fill="#e8cc7c"/><text x="4" y="30" fill="#30271c" font-size="24">钩</text><text x="4" y="60" fill="#30271c" font-size="24">网</text></g>`;
  if(this.tagHint)out+=`<text x="${this.w.player.x-140}" y="${this.w.player.y+145}" fill="white" font-size="24">翻滚甩掉 / 换朱烧掉</text>`;
  return out;
 }
}
