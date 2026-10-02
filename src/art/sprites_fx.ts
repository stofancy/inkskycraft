import type { SpriteDef } from './types';

/** P0-09 已登记的透明朱墨爆散；第一章敌机击破使用原切帧资产。 */
export const FX_SPRITES: SpriteDef[] = [
{
  id: 'fx_ink_burst', w: 256, h: 256,
  sheet: {image:'art/sheets/explosion/aligned/sheet.png',columns:4,rows:4,count:16,fps:16,mode:'once'},
  // 图片缺失仍可辨识击破；正常加载使用上述 16 帧。
  draw(ctx,frame) {
    const age=frame/16,r=85*Math.sin(age*Math.PI);
    ctx.fillStyle=`rgba(122,30,14,${1-age})`;
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.beginPath();ctx.ellipse(Math.cos(a)*r*.5,Math.sin(a)*r*.5,r*.55,r*.17,a,0,Math.PI*2);ctx.fill();}
  },
}];
