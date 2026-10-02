/** 获取页的机制示意；绘图与正式战斗隔离，不结算资源。 */
export function passivePreview(kind:string,icon:string):string {
 const player='<path d="M120 105l-9 19 9-5 9 5z" fill="#eee6d2"/>';
 const enemy='<path d="M114 24l6 13 6-13z" fill="#c36b65"/>';
 let effect='';
 switch(kind){
  case 'split':effect='<path d="M110 100L72 26M130 100L168 26"/><path d="M120 100V28" stroke-dasharray="3 6" opacity=".25"/>';break;
  case 'beam':effect='<g class="preview-sway"><path d="M120 100V20" stroke-width="6"/></g>';break;
  case 'mark':effect='<path d="M85 90L120 36" stroke-dasharray="4 3"/><path d="M108 23v-6h24v6M108 35v6h24v-6"/><path d="M120 100l-8-20 20-15-12-29"/>';break;
  case 'echo':effect='<path d="M65 90L175 42" opacity=".35"/><circle r="6" class="preview-return"><animateMotion dur="2s" repeatCount="indefinite" path="M175 42L65 90"/></circle>';break;
  case 'seal':effect='<ellipse cx="120" cy="60" rx="49" ry="33"/><path d="M114 12l6 13 6-13z" fill="#c36b65"><animateTransform attributeName="transform" type="translate" values="0 0;0 43;0 43" keyTimes="0;.5;1" dur="2.5s" repeatCount="indefinite"/></path>';break;
  case 'poolMoving':effect='<g class="preview-sway"><ellipse cx="120" cy="77" rx="48" ry="22" fill="#51817a" fill-opacity=".3"/><path d="M120 85l-9 19 9-5 9 5z" fill="#eee6d2"/></g>';break;
  case 'poolFixed':effect='<ellipse cx="120" cy="70" rx="48" ry="25" fill="#51817a" fill-opacity=".3"/><path d="M90 113H175" stroke-dasharray="4 4"/>';break;
  case 'front':effect='<path d="M120 74L120 44M85 98L83 60M155 98L157 45M120 137V129"/><circle cx="120" cy="44" r="8"/><circle cx="83" cy="60" r="8"/><circle cx="157" cy="45" r="8"/><circle cx="120" cy="130" r="8"/>';break;
  case 'wings':effect='<path d="M78 70V105M162 70V105M120 72V34"/><circle cx="78" cy="83" r="8"/><circle cx="162" cy="83" r="8"/><circle cx="120" cy="34" r="8"/><circle cx="120" cy="65" r="8"/>';break;
  case 'damage':effect='<rect x="77" y="53" width="85" height="8" fill="#c36b65"/><rect x="77" y="72" width="70" height="8" fill="#c36b65"/><text x="120" y="95">同次命中，伤害 +15%</text>';break;
  default:effect='<path d="M72 65H168M72 83H148" stroke-width="8"/><text x="120" y="52">同次画线，耗墨 -15%</text>';
 }
 return `<div class="passive-preview" aria-label="效果示意"><span>效果示意 · ${icon}</span><svg viewBox="0 0 240 150" role="img"><g fill="none" stroke="#d8ba69" stroke-width="3" stroke-linecap="round">${effect}</g>${kind==='poolMoving'?'':player}${['front','wings','damage','ink'].includes(kind)?'':enemy}</svg></div>`;
}
