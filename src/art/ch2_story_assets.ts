// P5-02/03：保留透明画布、左右壳瓣根锚点与状态段。
import type { SpriteDef } from './types';
interface Meta {image:string;columns:number;rows:number;count:number;fps:number;runtimeSize:[number,number];pivot:[number,number];anchors:Record<string,[number,number]>;segments:Record<string,{start:number;count:number;fps:number}>}
const metas=import.meta.glob('/public/art/enemies/ch2/story/*/sheet.json',{eager:true,import:'default'}) as Record<string,Meta>;
export const CH2_STORY_META:Record<string,Meta>={};
export const CH2_STORY_SPRITES:SpriteDef[]=Object.entries(metas).map(([path,m])=>{
 const key=path.split('/').at(-2)!;CH2_STORY_META[key]=m;
 return {id:`c2_${key}`,w:m.runtimeSize[0],h:m.runtimeSize[1],pivot:m.pivot,anchors:m.anchors,frames:m.count,sheet:{image:m.image,columns:m.columns,rows:m.rows,count:m.count,fps:m.fps,mode:'once'}};
});
CH2_STORY_SPRITES.push(
 {id:'c2_enforcement-ship',w:640,h:300,image:'art/enemies/ch2/story/enforcement-ship.png'},
 // 景物在启动时烘焙；运行时只提交位置、透明度与摆动参数。
 ...Object.entries({'island-houses':[240,360],'island-tower':[190,285],'island-falls':[260,390],bridge:[280,187],'lantern-rock':[150,225],'mirage-town':[300,450]}).map(([key,[w,h]])=>({id:`c2_town-${key}`,w,h,image:`art/sky/ch2-town/${key}.png`,imageFilter:'saturate(.7) contrast(.85) brightness(1.1)'})),
 ...Object.entries({'rock-small-shard':[64,96],'rock-small-root':[58,87],'rock-medium-pine':[180,187],'rock-medium-vine':[126,189],'rock-large-pine':[200,300],'rock-large-root':[180,270]}).map(([key,[w,h]])=>({id:`c2_rock-${key}`,w,h,image:`art/sky/ch2/${key}.png`,imageFilter:'saturate(.65) contrast(.8) brightness(1.15)'})),
);
export function storyFrame(key:string,state:string,age:number){const s=CH2_STORY_META[key].segments[state];return s.start+Math.floor(age*s.fps)%s.count;}
