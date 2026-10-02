// 暂停对白：逻辑帧驱动打字与输入，窗口尺寸决定分页；句读完整保留。
import type { DialogueActor, InputState } from '../types';
export function createDialogue(parent:HTMLElement,onAdvance:()=>void) {
 const layer=document.createElement('div');layer.className='story-dialogue';layer.hidden=true;parent.appendChild(layer);
 layer.innerHTML='<div class="story-shade"></div><div class="story-faces"></div><div class="story-box"><div class="story-speaker"></div><div class="story-text"></div><div class="story-footer"><span class="story-page"></span><span class="story-next"></span><span class="story-skip">按住 Esc 跳过本段</span></div></div>';
 const faces=layer.querySelector<HTMLElement>('.story-faces')!,speaker=layer.querySelector<HTMLElement>('.story-speaker')!,textEl=layer.querySelector<HTMLElement>('.story-text')!,pageEl=layer.querySelector<HTMLElement>('.story-page')!,nextEl=layer.querySelector<HTMLElement>('.story-next')!,skipEl=layer.querySelector<HTMLElement>('.story-skip')!;
 let pages:string[]=[],page=0,typed=0,elapsed=0,skipHeld=0,done:()=>void=()=>{},skip:()=>void=()=>{};
 let original='',portraits:{name:string;url:string;side:number}[]=[],id='';
 const state=()=>({active:!layer.hidden,id,page,pages:pages.length,complete:typed>=Array.from(pages[page]??'').length});
 function paginate(value:string):string[]{
  const style=getComputedStyle(textEl),font=parseFloat(style.fontSize),lineHeight=parseFloat(style.lineHeight);
  const capacity=Math.max(12,Math.floor(textEl.clientWidth/font)*Math.max(1,Math.floor(textEl.clientHeight/lineHeight)));
  const sentences=value.match(/[^。？！…]*[。？！…]+[”’」』]?|[^。？！…]+$/gu)??[value];
  const result:string[]=[];let current='';
  for(const sentence of sentences){if(current&&Array.from(current+sentence).length>capacity){result.push(current);current='';}current+=sentence;}
  if(current)result.push(current);return result.length?result:[''];
 }
 function paint(){const chars=Array.from(pages[page]??'');textEl.textContent=chars.slice(0,typed).join('');textEl.classList.toggle('overflowing',textEl.scrollHeight>textEl.clientHeight+1);if(textEl.classList.contains('overflowing'))textEl.scrollTop=textEl.scrollHeight;pageEl.textContent=`${page+1} / ${pages.length}`;nextEl.textContent=typed>=chars.length?'▼ 点击 / 回车':'点击补全文字';layer.dataset.page=String(page);layer.dataset.complete=String(typed>=chars.length);}
 function finish(){layer.hidden=true;const callback=done;done=()=>{};callback();}
 function advance(){if(layer.hidden)return;const length=Array.from(pages[page]).length;if(typed<length){typed=length;paint();}else if(page+1<pages.length){page++;typed=0;elapsed=0;textEl.scrollTop=0;paint();}else finish();}
 function manualAdvance(){if(layer.hidden)return;onAdvance();advance();}
 function skipSegment(){if(layer.hidden)return;layer.hidden=true;portraits=[];const callback=skip;done=skip=()=>{};callback();}
 layer.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();manualAdvance();});
 layer.addEventListener('contextmenu',e=>e.preventDefault());
 return {
  state,advance,skip:skipSegment,
  reset(){layer.hidden=true;portraits=[];pages=[];done=skip=()=>{};},
  show(actor:DialogueActor,expression:string,text:string,lineId:string,memory:boolean,onDone:()=>void,onSkip:()=>void){
   const wasActive=!layer.hidden;layer.hidden=false;id=lineId;original=text;done=onDone;skip=onSkip;page=typed=elapsed=skipHeld=0;
   layer.dataset.id=id;layer.classList.toggle('memory',memory);skipEl.textContent='按住 Esc 跳过本段';
   const url=actor.expressions?.[expression]??actor.portrait??'';
   let face=portraits.find(p=>p.name===actor.name);
   if(!face){face={name:actor.name,url,side:portraits.length===1?1-portraits[0].side:0};if(portraits.length>=2)portraits.splice(portraits.findIndex(p=>p.side===face!.side),1);portraits.push(face);}else face.url=url;
   faces.replaceChildren();for(const portrait of portraits){
    const holder=document.createElement('div');holder.className=`story-portrait side-${portrait.side}${portrait.name===actor.name?' speaking':' dimmed'}`;holder.setAttribute('aria-label',portrait.name);
    const fallback=()=>{holder.innerHTML='<svg viewBox="0 0 96 128" aria-hidden="true"><path d="M22 126c-2-23 9-34 19-39v-9c-10-7-16-19-15-31 0-18 8-30 23-30s23 12 23 30c1 12-5 24-15 31v9c10 5 21 16 19 39Z" fill="#887e6a"/></svg>';};
    if(portrait.url){const img=document.createElement('img');img.src=portrait.url;img.alt=portrait.name;img.onerror=fallback;holder.appendChild(img);}else fallback();faces.appendChild(holder);
   }
   speaker.textContent=actor.name;if(actor.identity){const identity=document.createElement('small');identity.textContent=actor.identity;speaker.appendChild(identity);}if(memory){const badge=document.createElement('small');badge.textContent='回忆';speaker.appendChild(badge);}if(!wasActive)layer.classList.remove('entered');void layer.offsetWidth;layer.classList.add('entered');pages=paginate(text);textEl.scrollTop=0;paint();
  },
  resize(){if(layer.hidden)return;const read=pages.slice(0,page).join('').length;pages=paginate(original);let count=0;page=0;while(page+1<pages.length&&count+pages[page].length<=read)count+=pages[page++].length;typed=Math.min(typed,Array.from(pages[page]).length);paint();},
  tick(dt:number,input:InputState){if(layer.hidden)return;
   if(input.down('pause')){skipHeld+=dt;skipEl.textContent=`跳过本段 ${Math.min(100,Math.round(skipHeld*100))}%`;if(skipHeld+1e-8>=1){skipSegment();return;}}else{skipHeld=0;skipEl.textContent='按住 Esc 跳过本段';}
   if(input.pressed('confirm')){input.consume?.('confirm');manualAdvance();return;}
   elapsed+=dt;const count=Math.floor(elapsed*30);if(count>typed){typed=Math.min(count,Array.from(pages[page]).length);paint();}
  }
 };
}
