import type { MoveId } from '../types';
import type { SpriteLayer } from './sprites';

const FRAME:Record<MoveId,number>={guard:0,cut:1,dash:2,assist:3,counter:4};
/** 招式题字靠近战场左上缘，独立真实时钟与缓动，敌弹层画在其上。 */
export class MoveTitles {
  private current:{id:MoveId;born:number}|null=null;
  constructor(readonly layer:SpriteLayer){}
  spawn(id:MoveId,real:number):void{this.current={id,born:real};}
  clear():void{this.current=null;this.layer.clear();}
  get active():MoveId|null{return this.current?.id??null;}
  draw(real:number):void{
    const v=this.current;if(!v)return;
    const age=Math.max(0,real-v.born);if(age>=.95){this.clear();return;}
    const enter=1-Math.pow(1-Math.min(1,age/.13),3),exit=Math.max(0,(age-.65)/.3);
    const alpha=enter*(1-exit*exit),scale=.86+.14*enter-.035*exit;
    this.layer.add('move_title',{x:175-18*(1-enter),y:108-10*exit,sx:scale,sy:scale,rot:-.03*(1-enter),frame:FRAME[v.id],alpha,glow:0});
  }
}
