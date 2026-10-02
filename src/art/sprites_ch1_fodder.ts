// P4-22 可替换的装饰占位。均无碰撞、血量和计分。
import type { SpriteDef } from './types';
import { CH1_DECOR_ART,CH1_FODDER_ART } from './ch1_air_assets';
export const CH1_FODDER_SPRITES:SpriteDef[]=Object.entries(CH1_DECOR_ART).map(([kind,a])=>({id:a.sprite,w:a.w,h:a.h,image:a.image,frames:4,
 draw(c,f){c.lineWidth=3;c.strokeStyle='#3d3831';c.fillStyle='#b6a783';const person=(x:number,y:number)=>{c.fillStyle='#bdab86';c.beginPath();c.arc(x,y-15,7,0,7);c.fill();c.fillStyle='#68767a';c.fillRect(x-8,y-7,16,27);c.strokeRect(x-8,y-7,16,27);};
 switch(kind){
 case 'clothes':c.beginPath();c.moveTo(-75,-30);c.lineTo(75,-30);c.stroke();for(let x=-55;x<60;x+=35){c.fillStyle=x<0?'#777f8a':'#bda472';c.fillRect(x,-28,22,40);c.fillRect(x-5,-23,32,12);}break;
 case 'sign':c.fillStyle='#92734e';c.fillRect(-44,-24,88,48);c.strokeRect(-44,-24,88,48);c.beginPath();c.moveTo(-35,-24);c.lineTo(-25,-34);c.lineTo(25,-34);c.lineTo(35,-24);c.stroke();break;
 case 'egret':c.strokeStyle='#fff8db';c.lineWidth=6;c.beginPath();c.moveTo(-30,f%2?0:-10);c.quadraticCurveTo(-8,-18,0,0);c.quadraticCurveTo(8,-18,30,f%2?0:-10);c.stroke();c.beginPath();c.moveTo(0,0);c.lineTo(9,12);c.lineTo(18,12);c.stroke();break;
 case 'walkers':case 'workers':for(let i=0;i<3;i++){person(-45+i*45,10);if(kind==='walkers'){c.fillStyle='#84684b';c.fillRect(-65+i*45,-9,17,26);}c.beginPath();c.moveTo(-45+i*45,6);c.lineTo(-58+i*45,-10-(f%2)*10);c.stroke();}break;
 case 'waterfall':c.fillStyle='#dae4d9aa';c.fillRect(-48,-150,96,300);for(let x=-38;x<45;x+=20){c.strokeStyle='#91a99aaa';c.beginPath();c.moveTo(x,-150);c.lineTo(x+Math.sin(f+x)*4,150);c.stroke();}break;
 case 'fisher':c.fillStyle='#856646';c.beginPath();c.moveTo(-66,16);c.lineTo(66,16);c.lineTo(42,35);c.lineTo(-40,35);c.closePath();c.fill();person(0,3);c.beginPath();c.moveTo(-9,7);c.lineTo(-15,-15);c.lineTo(-5,-20);c.moveTo(9,7);c.lineTo(15,-15);c.lineTo(5,-20);c.stroke();c.strokeStyle='#473b2f';c.beginPath();c.moveTo(-12,-13);c.lineTo(0,-20);c.lineTo(12,-13);c.stroke();break;
 case 'leaves':for(let i=0;i<16;i++){const a=i*Math.PI/8+f*.12;c.fillStyle=i%2?'#bb864c':'#d1b064';c.beginPath();c.ellipse(Math.cos(a)*70,Math.sin(a)*48,8,3,a,0,7);c.fill();}break;
 case 'flag':person(0,10);case 'whiteFlag':c.strokeStyle='#534936';c.beginPath();c.moveTo(10,25);c.lineTo(10,-24);c.stroke();c.fillStyle=kind==='flag'?'#ce5840':'#fff7e5';c.beginPath();c.moveTo(10,-24);c.lineTo(-19,-20+f*2);c.lineTo(-19,-5+f*2);c.lineTo(10,-9);c.fill();break;
 case 'lamp':c.fillStyle='#453f38';c.fillRect(-4,-10,8,64);c.strokeRect(-16,-40,32,30);c.fillStyle='#615a43';c.fillRect(-12,-36,24,22);break;
 case 'bell':c.fillStyle='#88704b';c.beginPath();c.moveTo(-9,-20);c.quadraticCurveTo(-20,-6,-21,12);c.lineTo(21,12);c.quadraticCurveTo(20,-6,9,-20);c.fill();c.beginPath();c.moveTo(0,-30);c.lineTo(0,-20);c.moveTo(-23,16);c.lineTo(23,16);c.stroke();break;
 case 'parachute':c.fillStyle='#ded0a8';c.beginPath();c.arc(0,-8,30,Math.PI,Math.PI*2);c.fill();for(let x=-28;x<=28;x+=14){c.beginPath();c.moveTo(x,-8);c.lineTo(0,20);c.stroke();}person(0,26);break;
 case 'signal':c.fillStyle='#c2524290';for(let i=0;i<5;i++){c.beginPath();c.arc(Math.sin(i+f)*10,30-i*14,10+i*2,0,7);c.fill();}break;
 case 'letter':c.fillStyle='#e3d2aa';c.fillRect(-15,-11,30,22);c.strokeRect(-15,-11,30,22);c.beginPath();c.moveTo(-15,-11);c.lineTo(0,3);c.lineTo(15,-11);c.stroke();break;
 }
 },...a.asset}));
for(const a of Object.values(CH1_FODDER_ART))if(a.asset)CH1_FODDER_SPRITES.push({id:a.sprite,...a.asset});
