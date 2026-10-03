import type { Enemy } from '../game/enemy';
import type { World } from '../game/world';
import { CH3_BUBBLES, CH3_NAME } from './dialogue3_data';

type Name=keyof typeof CH3_BUBBLES;
const NAMES:Record<string,Name>={hornet:'蜂机',lancer:'雷枪',drum:'雷鼓',wingfort:'翼堡',thunderray:'雷鳐',cloudspider:'云蛛',whalecalf:'幼鲲',jadeshuttle:'玉梭'};
type Bubble={owner:Enemy;text:string;until:number;pos?:{x:number;y:number}};
/** 道中短气泡沿用第二章的两句预算，不进入语音队列。 */
export class Chapter3Air {
 private bubbles:Bubble[]=[];
 private last=new Map<string,number>();
 private overlay=document.createElement('div');
 constructor(private w:World){
  this.overlay.className='chapter3-bubbles';
  Object.assign(this.overlay.style,{position:'fixed',pointerEvents:'none',zIndex:'13',fontFamily:'InkskyFangsong,serif',color:'#f2e6cb'});
  document.body.append(this.overlay);
 }
 dispose(){this.overlay.remove();}
 clear(){this.bubbles=[];}
 update(){this.bubbles=this.bubbles.filter(b=>this.w.real<b.until&&(b.pos||!b.owner.dead)&&!this.w.chapterDialogue?.current?.long);}
 bubble(e:Enemy,key:'01'|'02'='01'){
  this.update();const name=NAMES[e.def.name??''];if(!name)return;
  const slot=name+key;
  if(this.w.dialoguePaused||this.w.real-(this.last.get(slot)??-10)<1.5||this.bubbles.length>=2)return;
  this.last.set(slot,this.w.real);
  this.bubbles.push({owner:e,text:`${CH3_NAME[name]}：${CH3_BUBBLES[name][key]}`,until:this.w.real+1.8,pos:key==='02'?{x:e.x,y:e.y}:undefined});
 }
 draw(){
  const w=this.w,rect=w.r.playCss;
  Object.assign(this.overlay.style,{left:`${rect.x}px`,top:`${rect.y}px`,width:`${rect.w}px`,height:`${rect.h}px`});
  let html='';
  for(const b of this.bubbles){
   const p=b.pos??b.owner,x=p.x,y=Math.max(18,p.y-65);
   if(Math.hypot(w.player.x-x,w.player.y-y)<100||w.bullets.list.some(v=>!v.dead&&Math.abs(v.x-x)<130&&Math.abs(v.y-y)<30))continue;
   html+=`<div style="position:absolute;left:${Math.max(2,Math.min(60,x/9-10))}%;top:${y/12}%;background:#191d26ce;border:1px solid #b56f67;padding:5px;font-size:16px">${b.text}</div>`;
  }
  this.overlay.innerHTML=w.ui.dialogueState().active?'':html;
 }
}
