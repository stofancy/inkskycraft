import type { SpriteDef } from './types';

// Each hull has its own outline; copper ribs and luminous seams share the city's material language.
const hulls: [string, number[][], number, number][] = [
  ['swallow', [[0,28],[-8,6],[-37,-12],[-12,-6],[-17,-31],[0,-15],[17,-31],[12,-6],[37,-12],[8,6]],80,70],
  ['swordshuttle', [[0,42],[-7,12],[-10,-32],[0,-20],[10,-32],[7,12]],30,90],
  ['shieldkite', [[-42,8],[-38,-20],[-22,-35],[0,-40],[22,-35],[38,-20],[42,8],[12,5],[0,26],[-12,5]],90,85],
  ['sealbee', [[-18,-18],[-24,-30],[-29,-28],[-22,-8],[-30,0],[-19,7],[-19,25],[19,25],[19,7],[30,0],[22,-8],[29,-28],[24,-30],[18,-18]],65,65],
  ['inksnail', [[-27,18],[-32,4],[-26,-23],[-8,-32],[17,-25],[26,-9],[23,13],[33,20],[35,35],[27,35],[24,24],[-25,25]],80,80],
  ['arraydisc', [[-30,-8],[-24,-24],[0,-32],[24,-24],[30,-8],[20,16],[29,34],[18,36],[8,24],[-8,24],[-18,36],[-29,34],[-20,16]],75,80],
  ['dartskater', [[0,-35],[-27,-14],[-10,-13],[-10,8],[-23,25],[-38,28],[-37,35],[36,35],[38,28],[17,23],[10,8],[10,-13],[27,-14]],85,80],
  ['bellboat', [[-38,16],[-29,30],[29,30],[38,16],[9,10],[9,-29],[24,-10],[18,-35],[-18,-35],[-24,-10],[-9,-29],[-9,10]],85,80],
  ['mountainape', [[-18,-28],[-38,-22],[-46,22],[-32,25],[-24,-2],[-15,10],[-18,34],[-5,34],[0,16],[5,34],[18,34],[15,10],[24,-2],[32,25],[46,22],[38,-22],[18,-28],[12,-40],[-12,-40]],105,90],
  ['inkotter', [[0,34],[-10,19],[-29,21],[-24,10],[-18,2],[-25,-10],[-12,-7],[-8,-22],[-23,-38],[-14,-41],[4,-24],[12,-12],[26,-10],[18,2],[24,10],[29,21],[10,19]],70,90],
  ['lanternfox', [[0,29],[-16,12],[-29,-4],[-31,-31],[-15,-17],[-9,-26],[-3,-12],[3,-12],[9,-26],[15,-17],[31,-31],[29,-4],[16,12]],75,75],
  ['bridgebreaker', [[-42,38],[-42,-30],[42,-30],[42,38],[25,38],[25,-10],[-25,-10],[-25,38]],100,85],
];
export const stage1ExtraSprites: SpriteDef[] = hulls.map(([name, points, w, h], i) => ({
  id: `e_${name}`, w, h, radius: name === 'swordshuttle' ? 11 : Math.min(w,h)*0.28,
  anchors: { muzzle: [0,20], core: [0,0], root: [0,0] },
  draw(c) {
    c.beginPath(); points.forEach(([x,y],j)=>j ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
    const grad=c.createLinearGradient(-w/2,-h/2,w/2,h/2); grad.addColorStop(0,'#d2b37c');grad.addColorStop(.4,'#507b76');grad.addColorStop(1,'#182c34');
    c.fillStyle=grad;c.fill();c.strokeStyle='#101925';c.lineWidth=3;c.stroke();
    c.strokeStyle='#dfbd7f';c.lineWidth=1.2; c.beginPath(); c.moveTo(0,-h*.28);c.lineTo(0,h*.22);c.moveTo(-w*.2,0);c.lineTo(w*.2,0);c.stroke();
    if(name==='inksnail') {c.beginPath();for(let a=0;a<13;a+=.15){const r=1+a*1.5;c.lineTo(Math.cos(a)*r,Math.sin(a)*r-6);}c.stroke();}
    if(name==='arraydisc') {c.beginPath();c.arc(0,-3,18,0,Math.PI*2);c.stroke();}
    if(name==='sealbee') {c.strokeRect(-11,-3,22,21);c.strokeRect(-5,3,10,9);}
    if(name==='bellboat'){c.beginPath();c.arc(0,-14,13,0,Math.PI);c.stroke();}
    if(name==='lanternfox'){for(let k=0;k<4;k++){c.beginPath();c.moveTo((k-1.5)*7,-4);c.quadraticCurveTo((k-1.5)*15,-28,(k-1.5)*17,-33);c.stroke();}}
    for(let k=0;k<3;k++){c.fillStyle='#f0d4a1';c.fillRect(-8+k*8,6,2,2);}
    c.fillStyle=i%3===0?'#f28474':i%3===1?'#65e6dd':'#e4c068';c.beginPath();c.arc(0,0,4,0,7);c.fill();
  },
  glow(c){c.strokeStyle='#7be9dd';c.lineWidth=1.2;c.beginPath();c.moveTo(-7,-2);c.lineTo(0,3);c.lineTo(7,-2);c.stroke();},
}));
