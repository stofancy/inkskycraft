import type { SpriteDef } from './types';
/** 图集在启动时一次性加载；实体绘制沿用普通 alpha 混合。 */
export const CH1_ATTACK_SPRITES:SpriteDef[]=[
 ['hook',42,58],['blade',62,62],['mine',48,62],['oil',48,56],['rocket',52,84],['shield',164,100],
].map(([name,w,h])=>({id:`ch1_attack_${name}`,w:Number(w),h:Number(h),image:`art/enemies/ch1/attacks/${name}.png`,textureScale:2}));
