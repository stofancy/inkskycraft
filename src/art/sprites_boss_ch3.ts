import type { SpriteDef } from './types';

const art = 'art/bosses/ch3/leigong/';
// 分件在图集初始化时加载；开鼓、开芯仅切帧。
export const CH3_BOSS_SPRITES: SpriteDef[] = [
  { id:'lg-cloud', w:620, h:580, radius:0, draw(ctx) {
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7,x=Math.cos(a)*120,y=Math.sin(a)*110;
      const haze=ctx.createRadialGradient(x,y,15,x,y,190);haze.addColorStop(0,'rgba(33,24,61,.9)');haze.addColorStop(.5,'rgba(68,48,90,.65)');haze.addColorStop(1,'rgba(68,48,90,0)');ctx.fillStyle=haze;ctx.fillRect(-310,-290,620,580);}
  } },
  { id:'lg-body', w:440, h:500, textureScale:2, radius:0,
    image:['body-closed','body-open'].map(n=>`${art}${n}.png`) },
  { id:'lg-drum', w:65, h:65, textureScale:2, radius:30,
    image:['drum','drum-lit'].map(n=>`${art}${n}.png`) },
  { id:'lg-core', w:96, h:96, textureScale:2, radius:43,
    image:['core','core-cracked'].map(n=>`${art}${n}.png`) },
  { id:'lg-hammer', w:110, h:192, textureScale:2, radius:42,
    image:`${art}hammer.png`, pivot:[0,-65] },
  { id:'lg-wing', w:98, h:235, textureScale:2, radius:0,
    image:`${art}wing.png`, pivot:[0,-65] },
  { id:'lg-chain', w:14, h:120, radius:0, draw(ctx) {
    ctx.strokeStyle='#5a3820';ctx.lineWidth=5;
    for(let y=-54;y<60;y+=12){ctx.beginPath();ctx.ellipse(0,y,4,8,0,0,Math.PI*2);ctx.stroke();}
    ctx.strokeStyle='#e7b966';ctx.lineWidth=1.6;
    for(let y=-54;y<60;y+=12){ctx.beginPath();ctx.ellipse(-1,y,3,7,0,0,Math.PI*2);ctx.stroke();}
  } },
  { id:'lg-thread', w:4, h:120, radius:0, draw(ctx) {
    ctx.strokeStyle='rgba(239,216,168,.65)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,-60);ctx.lineTo(0,60);ctx.stroke();
  } },
];
