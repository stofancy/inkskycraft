// P4-19 正式分镜；动画只改变画面，运动、发弹和碰撞仍由原 AI 决定。
import type { SpriteDef } from './types';
import type { Enemy } from '../game/enemy';
interface Meta {image:string;columns:number;rows:number;count:number;fps:number;runtimeSize:[number,number];pivot:[number,number];anchors:Record<string,[number,number]>}
const metas=import.meta.glob('/public/art/enemies/ch2/*/sheet.json',{eager:true,import:'default'}) as Record<string,Meta>;
export const CH2_SHEETED=new Set<string>();
export function applyCh2Art(all:SpriteDef[]):void {
  for(const def of all){const meta=metas[`/public/art/enemies/ch2/${def.id.slice(2)}/sheet.json`];if(!meta)continue;
    def.maskSource={...def,id:`mask_${def.id}`};
    [def.w,def.h]=meta.runtimeSize;def.pivot=meta.pivot;def.anchors={...def.anchors,...meta.anchors};
    def.sheet={image:meta.image,columns:meta.columns,rows:meta.rows,count:meta.count,fps:meta.fps,mode:'once'};def.frames=meta.count;
    delete def.image;delete def.imageScale;delete def.glow;CH2_SHEETED.add(def.id);
  }
}
export function ch2Frame(e:Enemy):number {
  if(e.def.sprite==='e_umbrellaguest'){
    if(e.data.bodyPhase==='伞合')return Math.min(11,8+Math.floor((e.age-(e.data.artClosedAt??e.age))*10));
    if(e.data.artOpenedAt!==undefined&&e.age-e.data.artOpenedAt<.4)return 12+Math.min(3,Math.floor((e.age-e.data.artOpenedAt)*10));
  }
  const age=e.age-(e.data.artAttackAt??-Infinity),delay=e.data.artAttackDelay??.4;
  if(age>=0&&age<delay+.4)return 8+Math.min(7,Math.floor(age<delay?age/Math.max(.001,delay)*4:4+(age-delay)*10));
  return Math.floor(e.age*(e.def.anim||10))%8;
}
