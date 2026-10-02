import type { Co,G } from '../game/api';
import type { Enemy,EnemyDef } from '../game/enemy';
import { PI,clamp } from './stage3_enemies';
import { LightningPillar } from './stage3_extra';
const Node:EnemyDef={sprite:'s3_node',hp:80,score:1000,noCollide:true,drops:'ink'};
const Eye:EnemyDef={sprite:'b_kun_eye',hp:140,score:2500,noCollide:true,drops:'ink'};
const Fin:EnemyDef={sprite:'b_kun_fin',hp:180,score:3000,noCollide:true,drops:'ink'};
function mark(n:Enemy,root:Enemy,weapon:string,label:string,phase:string){n.data.contentRole='part';n.data.weakWeapon=weapon;n.data.weakLabel=label;n.data.bodyPhase=phase;n.data.linkTo=root.id;}
export const Kun:EnemyDef={sprite:'b_kun_body',hp:1,score:60000,noCollide:true,boss:{name:'鲲鹏 · 鲲',phases:4,music:'boss-kun'},hits:[[0,250,65]],*ai(e,g){
 const start=e.data.startPhase??1;
 e.invulnerable=true;yield* g.present(e.moveTo(450,80,2));e.data.weakWeapon='blue';e.data.bodyPhase='负城';
    if(start <= 1){
 const eyes=[g.attach(e,Eye,'eyeL'),g.attach(e,Eye,'eyeL',{mirror:true})];eyes.forEach(n=>mark(n,e,'red','刃 · 独立眼裂','eye'));
 yield* g.phase(e,{hp:1000,time:32,name:'鲲张口 · 破眼改变吸口'},function*(){e.invulnerable=false;for(let k=0;;k++){const side=eyes[0].dead?-1:eyes[1].dead?1:k%2?1:-1;e.data.mouthSide=-side;if(eyes.every(n=>n.dead)){e.hp=0;return;}for(let i=0;i<2;i++)if(!eyes[i].dead)g.shoot(eyes[i].x,eyes[i].y,g.aim(eyes[i].x,eyes[i].y),170,{color:'cyan',shape:'rice'});g.fx.charge(450+e.data.mouthSide*160,440,65,1,[.2,1,1]);yield* g.wait(1);g.force({x:450+e.data.mouthSide*160,y:440,radius:540,strength:85,duration:1.4,mode:'attract'});g.laser(450+e.data.mouthSide*160,430,PI/2,{warn:1,duration:.4,width:10,color:'cyan'});yield* g.wait(1.4/g.difficulty.aggression);}});
 e.data.eyeBreaks=eyes.map(n=>n.dead);if(eyes.every(n=>n.dead))e.data.mouthSide=0;for(const n of eyes)if(!n.dead)g.remove(n);
    }
    if(start <= 2){
 const fins=[g.attach(e,Fin,'finL'),g.attach(e,Fin,'finL',{mirror:true})];fins.forEach(n=>mark(n,e,'blue','流 · 射鳍或引雷','fin'));
 yield* g.phase(e,{hp:1000,time:32,name:'引雷卸鳍 · 靠柱再撤离'},function*(){e.invulnerable=true;for(let k=0;;k++){if(fins.every(n=>n.dead)){e.hp=0;return;}const p=g.spawn(LightningPillar,k%2?205:695,520,n=>{n.data.contentRole='prop';n.data.linkTo=e.id;});for(const n of fins.filter(n=>!n.dead))g.shoot(n.x,n.y,PI/2,100,{color:'cyan',shape:'big'});const x=450+(e.data.mouthSide??0)*140;g.fx.charge(x,440,80,1,[.2,1,1]);yield* g.wait(1);g.force({x,y:440,radius:520,strength:95-fins.filter(n=>n.dead).length*20,duration:1.5,mode:'attract'});yield* g.wait(4/g.difficulty.aggression);if(!p.dead)g.remove(p);}});
 e.data.finBreaks=fins.filter(n=>n.dead).length;for(const n of fins)if(!n.dead)g.remove(n);
    }
    if(start <= 3){
 const sigs=[220,450,680].map(x=>g.attach(e,Node,[x-e.x,415]));const labels=['曜雀 · 先拆甲','青璃 · 先回墨','墨鸢 · 先压阵'];sigs.forEach((n,i)=>mark(n,e,'purple',labels[i],'revoke'));let first=-1;
 yield* g.phase(e,{hp:900,time:35,name:'三处节点 · 顺序决定资源'},function*(){e.invulnerable=true;const rewarded=new Set<number>();for(;;){for(let i=0;i<3;i++)if(sigs[i].dead&&!rewarded.has(i)){rewarded.add(i);if(first<0){first=i;e.data.firstNode=i;}if(i===0){e.data.armorBroken=true;}if(i===1){g.player.ink=1;g.drop('ink',450,620);}if(i===2){e.data.suppressed=true;g.clearBullets(true);g.drop('ink',680,620);}g.caption('','',.01);}if(rewarded.size===3){e.hp=0;return;}for(const n of sigs.filter(n=>!n.dead))g.shoot(n.x,n.y,PI/2,85,{color:'magenta',shape:'orb'});yield* g.wait(e.data.suppressed?3:2);}});for(const n of sigs)if(!n.dead)g.remove(n);
    }
 g.caption('','',.01);g.clearBullets();const focus=yield* g.challenge({action:'focus',title:'顶住吸口',hint:'顶住吸口；失手后从两侧离开',duration:2.6});
 yield* g.phase(e,{hp:focus?650:900,time:28,name:focus?'反制成功 · 口心开放':'反制恢复 · 两侧出口'},function*(){e.invulnerable=false;e.data.weakWeapon='blue';e.data.bodyPhase='mouth';for(;;){const x=450+(e.data.mouthSide??0)*120;g.fx.charge(x,430,80,1,[.2,1,1]);yield* g.wait(1);g.force({x,y:430,radius:480,strength:(90-(e.data.finBreaks??0)*20)*(focus?.3:1),duration:1.5,mode:'attract'});if(!focus)g.laser(x,440,PI/2,{warn:1,duration:.4,width:e.data.finBreaks?8:15,color:'cyan'});g.fan(x,440,PI/2,3,.65,110,{color:'cyan',shape:'orb'});yield* g.wait(3/g.difficulty.aggression);}});
 // 三拍轮廓解构合计2.1秒；阶段外停火，部件已撤。
 g.clearBullets();e.invulnerable=true;e.data.bodyPhase='transform';g.caption('','',.01);yield* g.present((function*():Co{g.fx.charge(e.x,400,180,.7,[.3,1,1]);yield* g.wait(.7);e.scaleX=.65;e.scaleY=.6;g.fx.burst(450,360,18,90,[.3,1,1]);yield* g.wait(.7);e.alpha=.15;yield* g.wait(.7);})());
}};
/** 多边形面积（点列 [x0,y0,...]）。 */
function polyArea(p: number[]): number {
  let a = 0;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) a += p[j * 2] * p[i * 2 + 1] - p[i * 2] * p[j * 2 + 1];
  return Math.abs(a) / 2;
}
function pointInPoly(x: number, y: number, p: number[]): boolean {
  let c = false;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2], yi = p[i * 2 + 1], xj = p[j * 2], yj = p[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function segX(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den, u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}
/** 一笔（点列）是否围成面积 ≥1500 的闭环且圈住 (px,py)。判定规则与引擎封印一致（自交闭环，或首尾相距 <55）。 */
export function strokeEncloses(pts: readonly number[], px: number, py: number): boolean {
  const n = pts.length / 2;
  for (let i = 0; i < n - 3; i++) {
    for (let j = n - 2; j >= i + 2; j--) {
      const t = segX(pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], pts[j * 2], pts[j * 2 + 1], pts[j * 2 + 2], pts[j * 2 + 3]);
      if (t < 0) continue;
      const poly = [pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * t, pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * t];
      for (let k = i + 1; k <= j; k++) poly.push(pts[k * 2], pts[k * 2 + 1]);
      if (polyArea(poly) >= 1500 && pointInPoly(px, py, poly)) return true;
    }
  }
  if (n > 12 && Math.hypot(pts[0] - pts[(n - 1) * 2], pts[1] - pts[(n - 1) * 2 + 1]) < 55) {
    const p = pts.slice();
    if (polyArea(p) >= 1500 && pointInPoly(px, py, p)) return true;
  }
  return false;
}

const Wing:EnemyDef={sprite:'b_peng_wing',hp:220,score:5000,noCollide:true,drops:'ink'};
export const Peng:EnemyDef={sprite:'b_peng_body',hp:1,score:200000,noCollide:true,hits:[[0,20,55]],boss:{name:'鲲鹏 · 鹏',phases:3,music:'boss-peng'},*ai(e,g){
 const start=e.data.startPhase??1;
 e.invulnerable=true;e.x=450;e.y=250;const wings=[g.attach(e,Wing,'wingL'),g.attach(e,Wing,'wingL',{mirror:true})];wings.forEach(n=>mark(n,e,'red','刃 · 断翼永久削风','wing'));g.caption('','',.01);
 if(start<=1)yield* g.phase(e,{hp:1700,time:38,name:'鹏展翼 · 断翼选择风路'},function*(){e.invulnerable=false;e.data.weakWeapon='red';for(let k=0;;k++){const n=wings[k%2];if(!n.dead){g.fx.charge(n.x,n.y,60,1,[1,.4,.2]);yield* g.wait(1);g.force({x:n.x,y:660,radius:300,strength:60,duration:1.2,mode:'wind',vx:k%2?-1:1,vy:0});g.laser(n.x,n.y,PI/2+(k%2?.2:-.2),{warn:1,duration:.7,width:14,color:'amber',follow:n});}else{g.fx.burst(n.x,n.y,4,30,[.2,1,1]);yield* g.wait(1);}if(wings.every(n=>n.dead)){e.hp=0;return;}yield* g.wait(1.4/g.difficulty.aggression);}});
 const broken=wings.map(n=>n.dead);for(let i=0;i<2;i++)if(!wings[i].dead)wings[i].invulnerable=true;e.data.brokenWings=broken;
    if(start <= 2){
 g.clearBullets();const blast=yield* g.challenge({action:'bomb',title:'同舟九万里',hint:'爆发卸去审判甲；失手可射协同点',duration:2.4});
 const ns=[220,680,450].map(x=>g.attach(e,Node,[x-e.x,245]));ns.forEach((n,i)=>{mark(n,e,['red','blue','purple'][i],['曜雀 · 近点拆甲','青璃 · 守回墨区','墨鸢 · 定阵眼'][i],'ally');if(blast)n.hp*=.5;});
 yield* g.phase(e,{hp:900,time:38,name:'同舟协同 · 近发光节点射击'},function*(){e.invulnerable=true;let next=0;for(;;){for(let i=0;i<3;i++)ns[i].invulnerable=i!==next||Math.hypot(g.player.x-ns[i].x,g.player.y-ns[i].y)>360;if(ns[next]?.dead){g.player.ink=Math.min(1,g.player.ink+.35);g.drop('ink',ns[next].x,660);next++;g.clearBullets();if(next===3){e.hp=0;return;}g.caption('','',.01);}const side=next===1?0:1;if(!broken[side]){const x=side?730:170;g.fx.charge(x,530,55,1,[1,.4,.2]);yield* g.wait(1);g.force({x,y:660,radius:300,strength:50,duration:1.2,mode:'wind',vx:side?-1:1,vy:0});g.laser(x,440,PI/2,{warn:1,duration:.4,width:8,color:'amber'});}yield* g.wait(2.5/g.difficulty.aggression);}});
 for(const n of [...ns,...wings])if(!n.dead)g.remove(n);
    }
 for(const wing of wings)if(!wing.dead)g.remove(wing);
 // 终局在无时限的Boss作用域：输入及圈住可见核心共同完成才结束。
 e.data.phase=3;e.invulnerable=true;e.data.bodyPhase='seal';e.data.weakWeapon='purple';e.y=210;const core=g.attach(e,{...Node,sprite:'b_peng_core',hp:1,invulnerable:true},'core');mark(core,e,'purple','印 · 一笔封天闭环','final');
 for(;;){g.clearBullets();g.player.ink=1;let last:number[]=[];let was=false,enclosed=false,watching=true;
 g.fork((function*():Co{while(watching){if(g.brush.active){last=g.brush.pts.slice();was=true;}else if(was){enclosed ||=strokeEncloses(last,core.x,core.y);was=false;}yield;}})());
 const pressed=yield* g.challenge({action:'brush',title:'一笔封天',hint:'落笔圈住墨金核心；失手后射三阵眼再试',duration:3});
 if(pressed&&g.brush.active){yield* g.until(()=>!g.brush.active,5);yield;}watching=false;
 if(pressed&&enclosed){g.remove(core);e.sealed=3;g.fx.shockwave(450,460,650,15,.8);g.caption('','',.01);g.bg(3,0,3);return;}
 const retry=[210,450,690].map(x=>g.attach(e,Node,[x-e.x,340]));retry.forEach(n=>mark(n,e,'purple','印 · 射或圈封后重试','retry'));g.player.ink=1;let k=0;while(retry.some(n=>!n.dead)){if(k++%120===0)for(const n of retry.filter(n=>!n.dead))g.shoot(n.x,n.y,PI/2,65,{color:'magenta',shape:'orb'});yield;}g.player.ink=1;
 }
}};
