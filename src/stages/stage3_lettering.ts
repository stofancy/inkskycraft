import type { Co, G } from '../game/api';
import type { Enemy } from '../game/enemy';
import type { World } from '../game/world';

// 楷书「局」：横折、横、撇、横折钩、竖、横折、横。折笔一次落笔连续完成。
export const JU_STROKES: readonly (readonly number[])[] = [
 [340,545,535,545,535,605], [340,605,535,605],
 [340,545,337,650,320,730,295,775],
 [338,655,570,655,568,780,551,800,528,785],
 [390,700,390,756], [390,700,485,700,485,756], [390,756,485,756],
];
export const JU_NAMES=['横折','横','撇','横折钩','竖','横折','横'];
function near(x:number,y:number,p:readonly number[]):{distance:number;along:number} {
 let distance=Infinity,along=0,total=0;
 for(let i=0;i<p.length-2;i+=2){const dx=p[i+2]-p[i],dy=p[i+3]-p[i+1],len=Math.hypot(dx,dy),u=Math.max(0,Math.min(1,((x-p[i])*dx+(y-p[i+1])*dy)/(len*len||1))),d=Math.hypot(x-p[i]-dx*u,y-p[i+1]-dy*u);if(d<distance){distance=d;along=total+len*u;}total+=len;}
 return {distance,along};
}
export function judgeJuStroke(pts:readonly number[],path:readonly number[]):boolean {
 if(pts.length<4||pts.some(v=>!Number.isFinite(v)))return false;
 if(Math.hypot(pts[0]-path[0],pts[1]-path[1])>24||Math.hypot(pts.at(-2)!-path.at(-2)!,pts.at(-1)!-path.at(-1)!)>24)return false;
 let furthest=0;
 for(let i=0;i<pts.length;i+=2){const p=near(pts[i],pts[i+1],path);if(p.distance>24||p.along<furthest-24)return false;furthest=Math.max(furthest,p.along);}
 let covered=0,total=0;
 for(let i=0;i<path.length-2;i+=2){const dx=path[i+2]-path[i],dy=path[i+3]-path[i+1],len=Math.hypot(dx,dy),n=Math.ceil(len/4);for(let k=0;k<n;k++){total+=len/n;if(near(path[i]+dx*(k+.5)/n,path[i+1]+dy*(k+.5)/n,pts).distance<=24)covered+=len/n;}}
 return total>0&&covered/total>=.8;
}
const d=(p:readonly number[])=>p.reduce((s,v,i)=>s+(i%2?' '+v:(i?' L':'M')+v),'');
export class KunpengLettering {
 count=0; zoom=0; writing=false; stroke=0; ink:number[][]=[]; message=''; fall=-100; fallIndex=0;
 constructor(readonly g:G){}
 get path():readonly number[]|undefined{return this.writing?JU_STROKES[this.stroke]:undefined;}
 svg():string {
  const z=this.zoom,cx=450,cy=134+506*z,scale=.13+.87*z,sy=.09+.91*z;
  let out=`<g transform="translate(${cx} ${cy}) scale(${scale} ${sy})"><rect x="-345" y="-195" width="690" height="390" rx="18" fill="${z>0?'#142d35':'#d9be7b'}" stroke="#cda963" stroke-width="12"/><rect x="-328" y="-178" width="656" height="356" rx="10" fill="none" stroke="#826a42" stroke-width="3"/>`;
  if(z<.99){for(let i=0;i<this.count;i++)out+=`<text x="${-225+i*150}" y="50" text-anchor="middle" font-size="140" fill="${z>0?'#f2ce7d':'#665023'}">${'朱雀镖局'[i]}</text>`;}
  out+='</g>';
  const f=this.g.t-this.fall;if(f>=0&&f<1.2){const t=Math.min(1,f/1.2);out+=`<text x="${450+(-225+this.fallIndex*150)*.13}" y="${40+101*t}" text-anchor="middle" font-size="${90-72*t}" fill="#ffe6a0" opacity="${1-t*.3}">${'朱雀镖'[this.fallIndex]}</text>`;}
  if(this.writing){
   out+='<text x="450" y="445" text-anchor="middle" font-size="32" fill="#f2ce7d" stroke="#243339" stroke-width="3" paint-order="stroke">朱 雀 镖 · 题「局」</text><path d="M290 665H585 M440 525V810" stroke="#c5a362" stroke-width="1" stroke-dasharray="8 10" opacity=".3"/>';
   JU_STROKES.forEach((p,i)=>out+=`<path d="${d(this.ink[i]??p)}" fill="none" stroke="${i<this.stroke?'#edce8c':i===this.stroke?'#d9b66d':'#796e51'}" stroke-width="${i<this.stroke?14:10}" stroke-linejoin="round" stroke-linecap="round" opacity="${i<=this.stroke?1:.35}"/>`);
   const p=JU_STROKES[this.stroke];if(p){const dx=p[2]-p[0],dy=p[3]-p[1],a=Math.atan2(dy,dx)*180/Math.PI;out+=`<circle cx="${p[0]}" cy="${p[1]}" r="18" fill="#e5cf8b"/><path d="M-8 -7L5 0 -8 7" transform="translate(${p[0]} ${p[1]}) rotate(${a})" fill="none" stroke="#25383a" stroke-width="4"/><circle cx="${p.at(-2)}" cy="${p.at(-1)}" r="11" fill="none" stroke="#f4dda5" stroke-width="3"/>`;}
   out+=`<text x="450" y="887" text-anchor="middle" font-size="28" fill="#f7e5b9" stroke="#243339" stroke-width="3" paint-order="stroke">${this.stroke<7?`第 ${this.stroke+1} / 7 笔 · ${JU_NAMES[this.stroke]}`:'题字已成'}</text><text x="450" y="931" text-anchor="middle" font-size="23" fill="#eadbbd" stroke="#243339" stroke-width="3" paint-order="stroke">${this.message||'按住右键沿金线写，抬笔提交 · 免费供墨'}</text>`;
  }
  return out;
 }
 *award(index:number):Co {
  this.fall=this.g.t;this.fallIndex=index;
  yield* this.g.wait(1.2);this.count=Math.max(this.count,index+1);this.g.bgFlash(.25);yield* this.g.wait(.4);
 }
 *write(e:Enemy):Co {
  const w=this.g as World,forms=new Set(w.brushForms);w.brushForms.clear();w.brush.cancel();w.brush.free=true;let seen=w.brush.lastStroke?.id??0;
  e.data.lettering=this;
  try {
   const at=this.g.t;while(this.g.t-at<1.5){this.zoom=Math.min(1,(this.g.t-at)/1.5);yield;}this.zoom=1;this.writing=true;
   while(this.stroke<7){
    w.player.ink=1;
    const last=w.brush.lastStroke;
    if(last&&last.id!==seen){seen=last.id;if(judgeJuStroke(last.pts,JU_STROKES[this.stroke])){this.ink.push(last.pts.slice());this.stroke++;this.message='';}else this.message='这一笔再试一次，已写好的字迹会保留';}
    yield;
   }
   this.count=4;yield* this.g.wait(1);this.writing=false;
   const at2=this.g.t;while(this.g.t-at2<1.5){this.zoom=1-Math.min(1,(this.g.t-at2)/1.5);yield;}this.zoom=0;
  }finally{w.brush.free=false;for(const form of forms)w.brushForms.add(form);delete e.data.lettering;}
 }
}
