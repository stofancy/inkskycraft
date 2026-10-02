import type { SpriteDef } from './types';
const sizes:Record<string,[number,number]>={
 'falling-rock':[52.8731,58.4772],'carrier-body':[139.6364,110.2545],
 'carrier-gun':[18.9545,65.4545],'carrier-gun-charge':[19.0909,65.4545],
 'carrier-lid':[69.8182,61.6727],'carrier-claw':[28.486,53.8318],
 'carrier-gun-mirror':[18.9545,65.4545],'carrier-gun-charge-mirror':[19.0909,65.4545],'carrier-claw-mirror':[28.486,53.8318],
 'fortress-body':[540,270],'fortress-turret':[45,63],'fortress-turret-charge':[45,63],'fortress-clamp':[48,96],'fortress-clamp-mirror':[48,96],'fortress-bay-open':[64,62],
};
export const STORY_SPRITES:SpriteDef[]=Object.entries(sizes).map(([id,[w,h]])=>({id:`story_${id}`,w,h,image:`art/textures/ch1/story/${id}.png`,draw(c){c.fillStyle='#a78b5b';c.fillRect(-w/3,-h/3,w*2/3,h*2/3);}}));
for(const d of STORY_SPRITES){
 if(d.id.includes('carrier-gun'))d.pivot=[d.id.endsWith('mirror')?1.77:-1.77,-25.74];
 if(d.id.includes('carrier-claw'))d.pivot=[0,-21.1693];
 if(d.id==='story_carrier-lid')d.pivot=[0,-23.4589];

 // 堡垒分件按装配图根轴设枢轴：炮塔(45,61)，钳臂(20,26)/(76,26)，显示比例 0.5。
 if(d.id.startsWith('story_fortress-turret'))d.pivot=[0,-1];
 if(d.id==='story_fortress-clamp')d.pivot=[-14,-35];
 if(d.id==='story_fortress-clamp-mirror')d.pivot=[14,-35];
}
STORY_SPRITES.push({id:'story_fortress-shadow',w:760,h:420,draw(c){const g=c.createRadialGradient(0,0,0,0,0,200);g.addColorStop(0,'rgba(0,0,0,.9)');g.addColorStop(.6,'rgba(0,0,0,.6)');g.addColorStop(1,'rgba(0,0,0,0)');c.save();c.scale(1.9,1.05);c.fillStyle=g;c.fillRect(-200,-200,400,400);c.restore();}});
STORY_SPRITES.push({id:'story_warning',w:160,h:160,draw(c){c.strokeStyle='#e3a457';c.lineWidth=3;c.setLineDash([9,7]);c.beginPath();c.arc(0,0,65,0,Math.PI*2);c.stroke();}});
STORY_SPRITES.push({id:'story_guide',w:260,h:12,draw(c){c.strokeStyle='#5edac7';c.lineWidth=3;c.setLineDash([12,7]);c.beginPath();c.moveTo(-120,0);c.lineTo(120,0);c.stroke();}});
STORY_SPRITES.push({id:'story_lamp',w:24,h:30,draw(c){c.fillStyle='#ffb843';c.beginPath();c.arc(0,0,9,0,Math.PI*2);c.fill();},glow(c){c.fillStyle='#ffa726';c.beginPath();c.arc(0,0,9,0,Math.PI*2);c.fill();}});
