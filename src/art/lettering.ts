import manifest from '../../public/art/lettering/manifest.json';
import type { SpriteDef } from './types';
export const combatLetters=manifest.entries.filter(e=>/^(chapter-|section-|warning-|boss-|move-|bomb-|brush-|continue-|gameover-|ending-|record-|seal-)/.test(e.id));
export function letterFor(text:string,palette='paper'){
 const key=text.replace(/\s/g,'');return combatLetters.find(e=>e.text.replace(/\s/g,'')===key&&e.palette===palette);
}
export const MOVE_LETTERS:Record<string,string>={guard:'收墨',cut:'破甲',dash:'飞身追击',counter:'回身反击'};
export const LETTER_SPRITES:SpriteDef[]=combatLetters.filter(e=>e.id.startsWith('move-')&&e.palette==='paper').map(e=>{
 const w=74.666667*e.pixelSize[0]/e.pixelSize[1];return{id:`letter_${e.id}`,image:e.url.slice(1),w,h:w*e.pixelSize[1]/e.pixelSize[0]};
});
