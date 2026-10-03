import type { SpriteDef } from './types';
type C=CanvasRenderingContext2D;
function path(c:C,p:number[][]){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.stroke();}
const names=['cloudsail','swordcrane','thunderray','magnetring','cloudspider','whalecalf','jadeshuttle','balance','lawblade','sunwheel'];
function draw(c:C,k:number){c.fillStyle='#173740';c.strokeStyle='#d6b779';c.lineWidth=2;
 if(k===0){path(c,[[-40,20],[40,20],[24,34],[-30,34]]);path(c,[[0,-40],[30,12],[-20,12]]);}
 if(k===1){path(c,[[0,-40],[9,-5],[45,-17],[12,18],[0,43],[-12,18],[-45,-17],[-9,-5]]);}
 if(k===2){path(c,[[0,-24],[48,-10],[38,18],[10,12],[0,40],[-10,12],[-38,18],[-48,-10]]);c.strokeStyle='#56e4e0';c.beginPath();c.moveTo(0,-20);c.lineTo(0,23);c.stroke();}
 if(k===3){c.beginPath();c.arc(0,0,31,0,Math.PI*2);c.arc(0,0,19,0,Math.PI*2,true);c.fill();c.stroke();for(let i=0;i<3;i++){c.save();c.rotate(i*Math.PI*2/3);path(c,[[-6,-31],[6,-31],[0,-43]]);c.restore();}}
 if(k===4){for(let i=0;i<4;i++)for(const s of [-1,1]){c.beginPath();c.moveTo(s*9,-14+i*8);c.lineTo(s*(30+i*3),-32+i*15);c.lineTo(s*48,-23+i*15);c.stroke();}path(c,[[0,-25],[12,0],[0,23],[-12,0]]);}
 if(k===5){c.beginPath();c.ellipse(0,0,35,25,0,0,Math.PI*2);c.fill();c.stroke();path(c,[[-30,3],[-48,19],[-25,16]]);path(c,[[30,3],[48,19],[25,16]]);c.fillStyle='#080e17';c.beginPath();c.ellipse(0,15,19,8,0,0,Math.PI*2);c.fill();}
 if(k===6){path(c,[[0,-44],[16,-4],[0,44],[-16,-4]]);path(c,[[-28,-7],[0,-17],[28,-7],[0,8]]);}
 if(k===7){path(c,[[-48,-15],[48,-15],[48,-7],[-48,-7]]);path(c,[[-9,-28],[9,-28],[9,28],[-9,28]]);for(const s of [-1,1]){c.beginPath();c.moveTo(s*40,-10);c.lineTo(s*40,18);c.stroke();path(c,[[s*40-10,18],[s*40+10,18],[s*40+8,38],[s*40-8,38]]);}}
 if(k===8){path(c,[[-23,-20],[0,-35],[23,-20]]);path(c,[[-9,-15],[9,-15],[13,22],[0,34],[-13,22]]);path(c,[[-13,0],[-35,25],[-27,29],[-5,7]]);path(c,[[13,0],[35,25],[27,29],[5,7]]);}
 if(k===9){c.beginPath();c.arc(0,0,32,0,Math.PI*2);c.arc(0,0,22,0,Math.PI*2,true);c.fill();c.stroke();path(c,[[-44,19],[44,19],[30,30],[-30,30]]);for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);path(c,[[-3,-27],[3,-27],[0,-40]]);c.restore();}}
 c.fillStyle='#50ddd4';c.fillRect(-3,-3,6,6);
}
export const stage3ExtraSprites:SpriteDef[]=names.map((n,k)=>({id:`e_${n}`,w:110,h:100,radius:k===7?32:22,draw:c=>draw(c,k),glow:c=>{c.fillStyle=k===8?'#fc608f':'#40d9d5';c.fillRect(-3,-3,6,6);}}));
stage3ExtraSprites.push({id:'s3_node',w:56,h:56,radius:17,anchors:{root:[0,0]},draw:c=>{c.strokeStyle='#e9bd64';c.fillStyle='#2b1836';c.lineWidth=3;path(c,[[0,-19],[19,0],[0,19],[-19,0]]);c.strokeRect(-7,-7,14,14);},glow:c=>{c.strokeStyle='#e7b862';c.lineWidth=2;c.strokeRect(-12,-12,24,24);}});
stage3ExtraSprites.push({id:'s3_pillar',w:70,h:140,radius:24,image:'art/props/ch3/lightning-pillar.png'});
