import type { Co, G } from '../game/api';
import type { Enemy } from '../game/enemy';
import type { World } from '../game/world';
export const normal = (g:G):boolean => (g as World).diffId === 'normal';
/** 传给既有弹幕入口；普通档数值表示最终屏幕速度和发数。 */
export const speed = (g:G, value:number):number => normal(g) ? value / .82 : value;
export const count = (g:G, value:number):number => normal(g) ? Math.round(value / (g.difficulty.count * g.difficulty.fire)) : value;
/** 可行动、炮口进入画面并远离自机后开始预告。 */
export function* visible(e:Enemy,g:G):Co {
 while(e.alpha<=0 || e.x<35 || e.x>865 || e.y<45 || e.y>1080 || Math.hypot(e.x-g.player.x,e.y-g.player.y)<180)yield;
}
export function* charge(e:Enemy,g:G,seconds:number):Co {
 e.charging=true;
 let t=0;
 while(t<seconds){e.glow=1.2+.8*Math.sin(t/seconds*Math.PI);t+=g.dt;yield;}
 e.glow=1;
}
