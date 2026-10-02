import { letterFor, MOVE_LETTERS } from '../art/lettering';
import type { MoveId } from '../types';
import type { SpriteLayer } from './sprites';

/** 招式题字位于玩家上方并向战场内收，独立真实时钟与缓动，敌弹层画在其上。 */
export class MoveTitles {
  player:[number,number]=[450,900];
  private current:{id:MoveId;born:number}|null=null;
  constructor(readonly layer:SpriteLayer){}
  spawn(id:MoveId,real:number):void{this.current={id,born:real};}
  clear():void{this.current=null;this.layer.clear();}
  get active():MoveId|null{return this.current?.id??null;}
  draw(real:number):void{
    const v=this.current;if(!v)return;
    const age=Math.max(0,real-v.born);if(age>=1.15){this.clear();return;}
    const enter=1-Math.pow(1-Math.min(1,age/.25),3),exit=Math.max(0,(age-.85)/.3);
    const entry=letterFor(MOVE_LETTERS[v.id]);
    if(entry){const half=74.666667*entry.pixelSize[0]/entry.pixelSize[1]/2,x=Math.max(half+20,Math.min(900-half-20,this.player[0])),y=Math.max(50,Math.min(1150,this.player[1]-160));this.layer.add(`letter_${entry.id}`,{x,y,sx:1.08-.08*enter,sy:1.08-.08*enter,reveal:enter,alpha:.9*(1-exit*exit),glow:0});}
  }
}
