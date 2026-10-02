import type { SpriteLayer } from './sprites';

type Size = 's' | 'm' | 'l' | 'xl';
const WIDTH: Record<Size,number> = {s:125,m:225,l:355,xl:550};
const DURATION: Record<Size,number> = {s:.8,m:1,l:1.2,xl:1.5};
interface Burst { x:number; y:number; born:number; size:Size; rot:number }

/** 短暂的序列帧批次。世界时钟驱动，暂停不走帧，结束后移除，敌弹在其上绘制。 */
export class InkBursts {
  private list: Burst[] = [];
  constructor(readonly layer: SpriteLayer) {}
  get count(): number { return this.list.length; }
  spawn(time:number,x:number,y:number,size:Size,rot=0): void {
    // 极端连锁保留最近 128 个；验收的同时 30 个完整保留。
    if(this.list.length>=128)this.list.shift();
    this.list.push({x,y,born:time,size,rot});
  }
  draw(time:number): void {
    this.list=this.list.filter(b=>time-b.born<DURATION[b.size]);
    for(const b of this.list){
      const age=Math.max(0,time-b.born),scale=WIDTH[b.size]/256;
      this.layer.add('fx_ink_burst',{x:b.x,y:b.y,rot:b.rot,sx:scale,sy:scale,frame:Math.min(15,Math.floor(age/DURATION[b.size]*16)),glow:0});
    }
  }
  clear():void { this.list=[];this.layer.clear(); }
}
