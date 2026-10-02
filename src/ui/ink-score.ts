// 升级卡内的三秒小演示，与战场三色语言一致。
import { INK_COLORS,INK_NAMES,INK_GRADES } from '../game/ink-score';
import type { WeaponColor } from '../types';
export { INK_COLORS,INK_NAMES,INK_GRADES };
export function inkPreview(color:WeaponColor):string{const colors={red:'#f36833',blue:'#54e9f2',purple:'#cd9cff'},c=colors[color];let content='';
 if(color==='red')content='<circle class="ink-target" cx="220" cy="50" r="20"/><text class="ink-red-flier" x="35" y="62" fill="currentColor" font-size="38">急</text><ellipse class="ink-fire" cx="220" cy="84" rx="30" ry="9" fill="currentColor"/>';
 if(color==='blue'){content='<path d="M120 85l-8 15h16z" fill="currentColor"/>';for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,x=120+Math.cos(a)*60,y=70+Math.sin(a)*50;content+=`<circle cx="${x}" cy="${y}" r="7" fill="currentColor"/><path class="ink-preview-beam" style="animation-delay:${i*.18}s" d="M${x} ${y}L120 10"/>`;}}
 if(color==='purple'){content='<path d="M60 25H180L200 105H40Z M60 25L200 105M180 25L40 105" stroke="currentColor" stroke-width="3"/>';for(const [x,y] of [[60,25],[180,25],[200,105],[40,105]])content+=`<circle cx="${x}" cy="${y}" r="9" fill="currentColor"/>`;content+='<circle class="ink-preview-bullet" cx="120" cy="0" r="5" fill="#fce8c0"/>';}
 return `<div class="ink-preview" style="color:${c}"><svg viewBox="0 0 260 140" aria-label="${INK_NAMES[color]}色字灵三秒演示">${content}</svg></div>`;
}
export const INK_SCORE_CSS=`
.ink-score-dots{display:flex;gap:8px;align-items:center;margin-top:4px;font:11px sans-serif}.ink-score-dots span{white-space:nowrap}.ink-score-dots .red{color:#dd633f}.ink-score-dots .blue{color:#3ba4b6}.ink-score-dots .purple{color:#ad88cb}
.bomb-limit{color:#999;font-size:12px;margin-left:12px}.ink-preview{height:140px;background:radial-gradient(ellipse,#172329,#080d14);border:1px solid #66583d;margin:18px 0;border-radius:4px}.ink-preview svg{width:100%;height:100%;overflow:hidden}.ink-target{stroke:#f4d79a;fill:#242828}.ink-red-flier{animation:ink-flight 3s infinite}.ink-fire{animation:ink-fire 3s infinite}.ink-preview-beam{stroke:currentColor;stroke-width:3;animation:ink-beat 3s infinite;opacity:0}.ink-preview-bullet{animation:ink-bullet 3s infinite}
@keyframes ink-flight{0%{transform:translate(0,0);opacity:0}15%{opacity:1}65%{transform:translate(180px,-12px);opacity:1}70%,100%{transform:translate(180px,-12px);opacity:0}}@keyframes ink-fire{0%,65%{opacity:0}70%{opacity:1}100%{opacity:0}}@keyframes ink-beat{0%,9%,100%{opacity:0}3%,6%{opacity:1}}@keyframes ink-bullet{0%{transform:translateY(0);opacity:1}40%{transform:translateY(25px);opacity:1}45%,100%{transform:translateY(25px);opacity:0}}
.ink-score-page{width:94%!important;max-width:94%!important;padding:24px!important}.ink-score-columns{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:16px;line-height:1.6}.ink-score-columns h3{margin:0 0 16px}.ink-score-columns p{padding:8px 0;border-bottom:1px solid #685738}.ink-score-columns .unlearned{opacity:.45}.test-panel{max-height:90vh!important;overflow-y:auto}.icons[data-k="bombs"]{color:var(--bomb-color,#e96138)}
@media(prefers-reduced-motion:reduce){.ink-preview *{animation-duration:6s}}
`;
