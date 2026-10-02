import type { SpriteDef } from './types';
import {body,poly,ell,TONE,seamLine,rivetRing,orb,neon} from './b2_helpers';
type C = CanvasRenderingContext2D;
const plate=(c:C,p:[number,number][],paper=false)=>body(c,poly(p,true),paper?TONE.paper:TONE.bronze,{line:2,bev:2,blots:2,seed:67});
const core=(c:C,x=0,y=0)=>{body(c,ell(x,y,9),TONE.verd,{line:2,bev:2});rivetRing(c,x,y,12,6,1,'#d8b879');};
const sprites: [string,number,number,(c:C)=>void][] = [
 ['e_lampboat',90,130,c=>{plate(c,[[-35,-42],[-27,40],[0,60],[27,40],[35,-42]]);plate(c,[[-7,-53],[7,-53],[7,15],[-7,15]]);for(const x of[-25,25]){plate(c,[[x-5,-27],[x+5,-27],[x+5,10],[x-5,10]],true);seamLine(c,[[x,-36],[x,28]],2);}core(c,0,25);}],
 ['e_paperray',118,92,c=>{plate(c,[[0,-34],[-52,0],[-34,25],[0,16],[34,25],[52,0]],true);seamLine(c,[[-48,0],[0,-24],[48,0]],2);plate(c,[[-4,8],[4,8],[0,43]]);core(c);}],
 ['e_taxcrab',116,76,c=>{body(c,ell(0,0,30,21),TONE.bronze,{line:2,bev:3});for(const s of[-1,1]){plate(c,[[s*22,-12],[s*46,-29],[s*53,-7],[s*44,7],[s*30,5]]);for(let i=0;i<3;i++)seamLine(c,[[s*24,i*9],[s*48,16+i*7]],3);}core(c);}],
 ['e_mirrorfish',94,108,c=>{for(const s of[-1,1])plate(c,[[s*9,-22],[s*41,-42],[s*34,15],[s*7,29]],true);plate(c,[[0,-47],[-14,-15],[-10,28],[0,47],[10,28],[14,-15]]);neon(c,[[-27,-23],[-19,7]],'#72dcd1',2);neon(c,[[27,-23],[19,7]],'#72dcd1',2);core(c);}],
 ['e_netspider',116,94,c=>{for(const s of[-1,1])for(let i=0;i<4;i++)seamLine(c,[[s*7,-18+i*12],[s*(30+i*5),-37+i*20],[s*52,-28+i*19]],3);body(c,ell(0,0,16,24),TONE.verd,{line:2,bev:3});core(c);}],
 ['e_tideshuttle',58,110,c=>{plate(c,[[0,-50],[-20,-8],[-12,30],[-23,42],[0,29],[23,42],[12,30],[20,-8]]);seamLine(c,[[0,-42],[0,27]],2);core(c,0,-3);}],
 ['e_belleel',66,154,c=>{plate(c,[[0,-64],[-19,-46],[-23,-15],[-9,5],[-15,34],[-5,68],[8,42],[5,8],[21,-15],[16,-46]]);for(let y=0;y<50;y+=12)seamLine(c,[[-8,y],[8,y+4]],2);plate(c,[[-26,-55],[26,-55],[20,-22],[-20,-22]]);core(c,0,-39);}],
 ['e_umbrellaguest',100,120,c=>{plate(c,[[-8,2],[8,2],[15,42],[6,52],[0,28],[-6,52],[-15,42]]);body(c,ell(0,-20,43,32),TONE.paper,{line:2,bev:3});for(let i=0;i<8;i++){const a=i*Math.PI/4;seamLine(c,[[0,-20],[Math.cos(a)*42,-20+Math.sin(a)*31]],1.5);}core(c,0,-20);}],
 ['s2_node',68,68,c=>{plate(c,[[0,-29],[-26,-14],[-26,14],[0,29],[26,14],[26,-14]]);core(c);}],
 ['s2_rescueboat',90,120,c=>{plate(c,[[-33,-45],[-25,35],[0,52],[25,35],[33,-45]],true);plate(c,[[-6,-32],[6,-32],[6,21],[-6,21]]);core(c,0,26);}],
];
export const stage2ExtraSprites: SpriteDef[] = sprites.map(([id,w,h,draw])=>id==='s2_rescueboat'?{id,w,h,radius:18,image:'art/enemies/ch2/story/rescue-boat.png'}:({id,w,h,radius:id==='e_paperray'?25:18,draw,glow(c){orb(c,0,id==='e_belleel'?-39:0,8,'#69ded6',0.7);}}));
