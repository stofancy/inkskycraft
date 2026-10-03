import type { G, Co } from '../game/api';
import type { Enemy } from '../game/enemy';
import type { Scenery } from '../game/scenery';
import type { World } from '../game/world';
import { STAGE3_SCENERY } from '../bg/stage3-scroll';

// 随第三章模块在启动时注册；两张门图只烘焙一次，开门只换精灵名。
STAGE3_SCENERY.push(
  ...['closed', 'open'].map(state => ({id:`sky_ch3-tianmen-${state}`,w:840,h:560,image:`art/sky/ch3/tianmen-${state}.png`})),
  {id:'c3_lock-line',w:8,h:128,draw(c){c.strokeStyle='#609da9';c.lineWidth=2;c.setLineDash([10,10]);c.beginPath();c.moveTo(0,-64);c.lineTo(0,64);c.stroke();}},
  {id:'c3_gun',w:38,h:48,radius:15,draw(c){c.fillStyle='#325b65';c.strokeStyle='#e5d5a2';c.lineWidth=3;c.beginPath();c.roundRect(-13,-19,26,31,7);c.fill();c.stroke();c.fillStyle='#46636b';c.fillRect(-8,4,16,17);c.strokeRect(-8,4,16,17);c.fillStyle='#c4edf0';c.fillRect(-6,16,12,4);}},
  {id:'c3_web-end',w:34,h:40,radius:13,draw(c){c.fillStyle='#294e5b';c.strokeStyle='#9bced6';c.lineWidth=3;c.fillRect(-9,-18,18,36);for(const y of [-11,11]){c.beginPath();c.ellipse(0,y,12,5,0,0,Math.PI*2);c.fill();c.stroke();}c.lineWidth=2;for(const y of [-5,0,5]){c.beginPath();c.moveTo(-8,y);c.lineTo(8,y+3);c.stroke();}}},
  {id:'c3_thunderstone',w:44,h:48,draw(c){c.fillStyle='#5c7582';c.strokeStyle='#c5dce3';c.lineWidth=2;c.beginPath();c.moveTo(-17,-9);c.lineTo(-7,-19);c.lineTo(12,-15);c.lineTo(18,7);c.lineTo(6,19);c.lineTo(-14,14);c.closePath();c.fill();c.stroke();c.strokeStyle='#c5fcff';c.lineWidth=3;c.beginPath();c.moveTo(3,-12);c.lineTo(-4,1);c.lineTo(4,0);c.lineTo(-2,12);c.stroke();}},
);

export function showTianmen(g:G):Scenery {
  const w=g as World;
  const existing=w.scenery.find(s=>!s.dead&&s.sprite.startsWith('sky_ch3-tianmen-'));
  if(existing)return existing;
  const gate=g.scene('sky_ch3-tianmen-closed',450,310);
  gate.layer='ground';gate.glow=0;
  return gate;
}
/** 鲲鹏完成题字时调用；不会重新加载图片或创建纹理。 */
export function openTianmen(g:G):void {showTianmen(g).sprite='sky_ch3-tianmen-open';}

/** 目标点从预告开始固定；线头随进场机体移动，收招或抢杀即消失。 */
export function* lockLine(e:Enemy,g:G,target:{x:number;y:number},seconds:number):Co {
  const line=g.scene('c3_lock-line',e.x,e.y);line.layer='front';line.owner=e;
  e.data.guides=[target];e.charging=true;
  try {
    for(let t=0;t<seconds;t+=g.dt){
      const dx=target.x-e.x,dy=target.y-e.y;
      line.x=(target.x+e.x)/2;line.y=(target.y+e.y)/2;
      line.rot=Math.atan2(dy,dx)-Math.PI/2;line.sy=Math.hypot(dx,dy)/128;
      yield;
    }
  } finally {line.dead=true;e.charging=false;e.data.guides=[];}
}
