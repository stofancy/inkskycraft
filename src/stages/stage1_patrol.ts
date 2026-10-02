// 第一章杂鱼出场表：按事件和秒数出，每种杂鱼第一次出现时单独亮相（见 studio/specs/fodder-patterns.md）。
import type { Co,G } from '../game/api';
import { RouteHornet,RouteCrane,RouteKite,RouteScout,RouteShield,RouteInspector } from './stage1_enemies';
import type { RouteState } from './stage1_events';
type Go=(g:G)=>void;
/** 按难度的 quantity 放缩只数（至少 1）。 */
export const cnt=(g:G,n:number)=>Math.max(1,Math.round(n*g.difficulty.quantity));
const mk=(g:G,def:Parameters<G['spawn']>[0],x:number,y:number,data:Record<string,unknown>)=>g.spawn(def,x,y,e=>{e.data.contentRole='normal';e.data.patrol=true;Object.assign(e.data,data);});
/** 蜂机一窝，两侧交替斜插，每架错开 0.4 秒后俯冲。 */
export const beeSwarm=(n0:number):Go=>g=>{const n=cnt(g,n0);for(let i=0;i<n;i++)mk(g,RouteHornet,i%2?960:-60,60+(i%8)*40,{tx:120+i*(660/Math.max(1,n-1)),ty:190+(i%2)*60,delay:i*.4});};
/** 蜂机单发点射（亮相）：从一侧斜插。 */
export const beeShot=(side:-1|1,delay=0):Go=>g=>{for(let i=0;i<cnt(g,1);i++)mk(g,RouteHornet,side<0?-60:960,150+i*60,{shot:true,tx:(side<0?250:650)+i*side*90,delay:delay+i*.8});};
/** 纸鹤整排 5 只压下。 */
export const craneRow:Go=g=>{const n=cnt(g,5);for(let i=0;i<n;i++){const x=n===1?450:130+i*(640/(n-1));mk(g,RouteCrane,x,-65,{row:true,slot:i,tx:x});}};
export const kiteGlide=(hook:boolean,side:-1|1=-1,extra:Record<string,unknown>={}):Go=>g=>{mk(g,RouteKite,side<0?-60:960,280,{hook,...extra});};
/** 云哨：浮石后露头（亮相只瞄玩家）。 */
export const scout=(x:number,y:number,atShip=false,delay=0):Go=>g=>{mk(g,RouteScout,x,y,{atShip,delay});if(g.difficulty.quantity>=1.5)mk(g,RouteScout,900-x,y,{atShip:!atShip,delay:delay+.8});};
/** 盾筝带 n 架蜂机：盾筝在前（下），蜂机在后。 */
export const shieldSquad=(n:number,cx=450):Go=>g=>{mk(g,RouteShield,cx,-80,{tx:cx,ty:330});for(let i=0;i<cnt(g,n);i++)mk(g,RouteHornet,i%2?960:-60,60+(i%8)*40,{tx:cx-120+i*(240/Math.max(1,cnt(g,n)-1)),ty:190+(i%2)*40,delay:1.5+i*.5});};
export const inspector:Go=g=>{mk(g,RouteInspector,-60,420,{});};
export const seq=(...gs:Go[]):Go=>g=>gs.forEach(f=>f(g));
/** 蜂机扫过：n 架按间隔 gap 秒依次入场，沿 ang 方向直线飞过，转弯角速度 turn；入场点由 from(i) 给出。 */
export const sweep=(n0:number,from:(i:number,n:number)=>[number,number],ang:number,turn=0,gap=.35,spd=230):Go=>g=>{const n=cnt(g,n0);g.fork((function*():Co{for(let i=0;i<n;i++){const [x,y]=from(i,n);mk(g,RouteHornet,x,y,{sweep:true,ang,turn,spd,fireAt:1+(i%3)*.4});yield* g.wait(gap);}})());};
/** 自上而下一列：n 架在 x0 附近散开。 */
export const sweepTop=(n:number,x0=450,spread=500,gap=.3):Go=>sweep(n,(i,m)=>[x0-spread/2+spread*(m<2?.5:i/(m-1)),-60],Math.PI/2,0,gap);
/** 自左（side=-1）或右（side=1）侧斜插，一路弧线下掠。 */
export const sweepSide=(side:-1|1,n:number,y0=80,gap=.3):Go=>sweep(n,i=>[side<0?-60:960,y0+(i%4)*30],side<0?.55:Math.PI-.55,side<0?.18:-.18,gap);
/** 从屏幕下方向上追：n 架，从后方扇形涌入。 */
export const chaseBehind=(n:number,gap=.35):Go=>sweep(n,(i,m)=>[120+(m<2?.5:i/(m-1))*660,1300],-Math.PI/2,0,gap,260);
/** 横扫激光：从左或右屏边出发，预警后转过半屏。 */
export const sweepLaser=(side:-1|1,y=250):Go=>g=>{g.laser(side<0?-20:920,y,side<0?.05:Math.PI-.05,{warn:1.2,duration:2.6,width:12,color:'amber',sweep:side<0?.33:-.33,length:1300});};
