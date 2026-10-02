import type { SpriteDef } from './types';
function sprite(kind:'chiyan'|'laodun'|'moyuan'|'suanpan',color:string):SpriteDef {
 return {id:`companion_${kind}`,w:96,h:96,frames:3,image:`art/companions/${({chiyan:"yaoque",laodun:"qingli",moyuan:"moyuan",suanpan:"qingli"})[kind]}.png`,imageScale:[76/96,80/96,84/96],radius:10,anchors:{core:[0,0],muzzle:[0,-30]},draw(ctx,frame){
  ctx.save();ctx.strokeStyle='#ba9a55';ctx.lineWidth=1.4;
  for(const side of [-1,1])for(let i=0;i<3+frame;i++){
   ctx.beginPath();ctx.moveTo(side*4,-6+i*3);ctx.lineTo(side*(24+frame*6-i*3),-20+i*11);ctx.lineTo(side*(19+frame*4-i*2),17+i*3);ctx.lineTo(side*5,14);ctx.closePath();ctx.fillStyle=i%2?color:'#1d272d';ctx.fill();ctx.stroke();
  }
  ctx.beginPath();ctx.moveTo(0,-27-frame*2);ctx.lineTo(10,-6);ctx.lineTo(7,20);ctx.lineTo(0,33+frame*4);ctx.lineTo(-7,20);ctx.lineTo(-10,-6);ctx.closePath();ctx.fillStyle='#171d25';ctx.fill();ctx.stroke();
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,-5,4+frame,11,0,0,Math.PI*2);ctx.fill();
  if(frame>0){ctx.beginPath();ctx.arc(0,0,27+frame*5,Math.PI*.05,Math.PI*.95);ctx.stroke();}
  if(frame===2){ctx.fillStyle='#f4dfaa';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*12,-18);ctx.lineTo(side*17,-31);ctx.lineTo(side*19,-13);ctx.closePath();ctx.fill();}}
  ctx.restore();
 },glow(ctx,frame){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-5,4+frame,11,0,0,Math.PI*2);ctx.stroke();if(frame===2){ctx.beginPath();ctx.arc(0,0,33,0,Math.PI*2);ctx.stroke();}}};
}
export const companionSprites:SpriteDef[]=[sprite('chiyan','#e05d28'),sprite('laodun','#59dcc6'),sprite('moyuan','#a786e2'),sprite('suanpan','#d8ba69')];

// 老盾的回锋呈叶形，与朱色主弹和赤燕火羽分辨。
companionSprites.push({id:'companion_reply',w:16,h:34,radius:4,draw(ctx){ctx.fillStyle='#70e4d1';ctx.strokeStyle='#dce8bd';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-15);ctx.quadraticCurveTo(9,-2,0,14);ctx.quadraticCurveTo(-9,-2,0,-15);ctx.fill();ctx.stroke();},glow(ctx){ctx.fillStyle='#35c5bf';ctx.beginPath();ctx.ellipse(0,0,3,12,0,0,Math.PI*2);ctx.fill();}});

// 制作资产到位后自动采用约定目录；缺件继续使用既有占位图。
const sheets = import.meta.glob('/public/art/companions/*/sheet.json', { eager:true, import:'default' });
for (const def of companionSprites) {
 const kind=def.id.replace('companion_','');
 const meta=sheets[`/public/art/companions/${kind}/sheet.json`] as {columns:number;rows:number;count:number;fps:number;mode:'loop'|'once'|'pingpong';frameSize:number[];anchorPixel:number[]} | undefined;
 if (!meta) continue;
 def.sheet={image:`art/companions/${kind}/sheet.png`,columns:meta.columns,rows:meta.rows,count:meta.count,fps:meta.fps,mode:meta.mode};
 def.frames=meta.count;delete def.image;delete def.imageScale;
 def.pivot=[(meta.anchorPixel[0]/meta.frameSize[0]-.5)*def.w,(meta.anchorPixel[1]/meta.frameSize[1]-.5)*def.h];
}
