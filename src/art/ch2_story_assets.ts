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
 {id:'c2_cliff-cave',w:240,h:200,image:'art/enemies/ch2/story/cliff-cave.png'},
 {id:'c2_enforcement-ship',w:640,h:300,image:'art/enemies/ch2/story/enforcement-ship.png'},
 ...['lantern-canyon','cloud-town-false','cloud-town-real'].map(key=>({id:`c2_bg-${key}`,w:900,h:900,frames:2,sheet:{image:`art/textures/ch2/${key}.png`,columns:1,rows:2,count:2,fps:8,mode:'once' as const}})),
);
export function storyFrame(key:string,state:string,age:number){const s=CH2_STORY_META[key].segments[state];return s.start+Math.floor(age*s.fps)%s.count;}
