// 第一章出场组合与两类攻击节拍；复用既有敌机、弹体和协程。
import type { Co,G } from '../game/api';
import type { Enemy } from '../game/enemy';
import type { World } from '../game/world';
import { normal } from './ordinary';
type Lane='area'|'aim';
type Slot={group:string;until:number;fires:number[]};
const runs=new WeakMap<object,{serial:number;families:Map<string,number>;slots:Partial<Record<Lane,Slot>>}>();
function run(g:G){const key=(g as World).root;let r=runs.get(key);if(!r){r={serial:0,families:new Map(),slots:{}};runs.set(key,r);}return r;}
/** 四种走位×招式组合交错，每家族下次出场切换组合。 */
export function formation(g:G,family:string){const r=run(g),n=r.families.get(family)??0;r.families.set(family,n+1);return {variant:[0,3,1,2][n%4],volleyGroup:`${family}:${++r.serial}`};}
/** 一组占区、一组瞄准；占用时间覆盖预告及弹体寿命，异类首发至少错开 0.6 秒。 */
export function volley(e:Enemy,g:G,lane:Lane,life:number,warn=0):boolean{
 if(!normal(g)&&(g as World).stageIndex!==3)return true;
 const r=run(g),group=String(e.data.volleyGroup??e.id),slot=r.slots[lane],other=r.slots[lane==='area'?'aim':'area'];
 if(slot&&slot.until>g.t&&slot.group!==group)return false;
 const fire=g.t+warn;
 if(other&&other.until>g.t&&other.fires.some(t=>Math.abs(fire-t)<.6))return false;
 const fires=slot?.group===group?slot.fires.filter(t=>t>g.t-.6):[];fires.push(fire);
 r.slots[lane]={group,until:Math.max(slot?.group===group?slot.until:0,fire+life+.1),fires};return true;
}
export function* attackTurn(e:Enemy,g:G,lane:Lane,life:number,warn=0):Co{while(!volley(e,g,lane,life,warn))yield;}
/** 中机斜切／贴边折返，随后留在上半屏展示招式。 */
export function* approach(e:Enemy,g:G,x:number,y:number,seconds:number):Co{
 if((e.data.variant??0)%2){const side=x<450?-1:1;yield* e.moveTo(450+side*310,y+180,seconds*.55,'inOutQuad');yield* e.moveTo(x,y,seconds*.45,'inOutQuad');}
 else yield* e.moveTo(x,y,seconds);
}
