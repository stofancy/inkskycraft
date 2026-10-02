// 正式画布原尺寸进入图集，保留烟气、倾斜及离舱炸弹的透明余量。
import type { SpriteDef } from './types';
import { CH1_AIR_ART as A } from './ch1_air_assets';
export const CH1_AIR_SPRITES:SpriteDef[]=[
 ...[A.ship,A.post,A.bomber].map(a=>({id:a.atlas,w:a.runtimeSize[0],h:a.runtimeSize[1],pivot:a.pivot,anchors:a.anchors,sheet:{image:a.image,columns:a.columns,rows:a.rows,count:a.count,fps:a.fps,mode:'once' as const}})),
 ...[A.net,A.brokenNet,A.bomb].map(a=>({id:a.atlas,w:a.runtimeSize[0],h:a.runtimeSize[1],image:a.image})),
];
