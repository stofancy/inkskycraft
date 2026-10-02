// 战斗字图共用入口，未知文字保持调用方原字体。
import { letterFor } from '../art/lettering';
export const missingBattleLetters=new Set<string>();
export function battleLetter(el:HTMLElement,text:string,seconds?:number,palette='paper'):boolean{
 const entry=letterFor(text,palette);if(!entry){missingBattleLetters.add(text);return false;}
 if(el.dataset.lettering===entry.id)return true;
 el.dataset.lettering=entry.id;el.classList.add('battle-lettered');el.setAttribute('aria-label',text);
 const img=document.createElement('img');img.src=entry.url;img.alt=text;img.className='battle-letter-image';el.replaceChildren(img);
 img.style.cssText='height:1em;width:auto;max-width:100%;object-fit:contain;vertical-align:middle;display:inline-block;transform-origin:center;';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const frames:Keyframe[]=[{clipPath:reduced?'inset(0)':'inset(0 100% 0 0)',transform:reduced?'none':'scale(1.08)',opacity:1,offset:0,easing:'cubic-bezier(.16,1,.3,1)'},{clipPath:'inset(0)',transform:'scale(1)',opacity:1,offset:seconds?.25/seconds:1}];
 if(seconds){frames.push({clipPath:'inset(0)',transform:'scale(1)',opacity:1,offset:1-.3/seconds},{clipPath:'inset(0)',transform:'scale(1)',opacity:0,offset:1});}
 img.animate(frames,{duration:seconds?seconds*1000:250,fill:'forwards'});
 return true;
}
