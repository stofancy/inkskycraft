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

// 鲲鹏七件原图在图集初始化时一次加载；战斗、变形及题字只调整骨架。
const kp='art/bosses/ch3/kunpeng/';
CH3_BOSS_SPRITES.push(
 {id:'kp-sign',w:90,h:36,radius:0,draw(c){c.fillStyle='#665023';c.font='19px InkskyFangsong,serif';c.textAlign='center';c.textBaseline='middle';c.fillText('朱雀镖局',0,0);}},
 {id:'kp-body',w:252,h:532,radius:0,image:kp+'body.png'},
 {id:'kp-head',w:210,h:238,radius:0,image:['head-closed','head-open'].map(n=>kp+n+'.png')},
 {id:'kp-fin',w:126,h:252,radius:0,image:kp+'fin.png',pivot:[0,-90]},
 {id:'kp-wing-root',w:392/3,h:294,radius:0,sheet:{image:kp+'wing.png',columns:3,rows:1,count:3,fps:1,mode:'once'},pivot:[34.7,-21]},
 {id:'kp-wing-tip',w:392/3,h:294,radius:0,sheet:{image:kp+'wing.png',columns:3,rows:1,count:3,fps:1,mode:'once'},pivot:[-392/6,-21]},
 {id:'kp-core',w:76,h:76,radius:32,image:['core','core-cracked'].map(n=>kp+n+'.png')},
 {id:'kp-joint',w:62,h:62,radius:27,draw(c){c.fillStyle='#244953';c.strokeStyle='#c9a268';c.lineWidth=3;c.beginPath();c.arc(0,0,16,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='#84ddd8';c.lineWidth=2;c.beginPath();c.ellipse(0,0,10,6,0,0,Math.PI*2);c.stroke();}},
);
