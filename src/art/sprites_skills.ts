import type { SpriteDef } from './types';

/** 纸替身的每帧保留已烧穿的洞；展开由战斗逻辑缩放完成。 */
export const PAPER_DECOY:SpriteDef={id:'paper_decoy',w:96,h:112,frames:9,draw(ctx,hits){
 const paper=new Path2D('M0 -48 L14 -19 L43 8 L18 5 L25 44 L0 30 L-25 44 L-18 5 L-43 8 L-14 -19 Z');
 ctx.fillStyle='#fff0c8';ctx.fill(paper);ctx.strokeStyle='#21190e';ctx.lineWidth=3;ctx.stroke(paper);
 ctx.strokeStyle='#bda77d';ctx.lineWidth=1.5;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(0,-46);ctx.lineTo(side*14,-17);ctx.lineTo(0,30);ctx.lineTo(side*25,43);ctx.stroke();}
 ctx.strokeStyle='#9d3e27';ctx.lineWidth=2;ctx.strokeRect(-7,-16,14,30);ctx.beginPath();ctx.moveTo(-5,-8);ctx.lineTo(5,-8);ctx.moveTo(0,-13);ctx.lineTo(0,9);ctx.moveTo(-5,3);ctx.lineTo(5,3);ctx.stroke();
 for(let i=0;i<hits;i++){const a=i*2.4,x=Math.cos(a)*(9+i)*1.35,y=Math.sin(a)*(9+i)*1.35;ctx.beginPath();for(let j=0;j<=10;j++){const t=j/10*Math.PI*2,r=4.5+Math.sin(j*3+i)*1.5;ctx.lineTo(x+Math.cos(t)*r,y+Math.sin(t)*r);}ctx.closePath();ctx.strokeStyle='#592b0f';ctx.lineWidth=2;ctx.stroke();ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fill();ctx.restore();}
}};
