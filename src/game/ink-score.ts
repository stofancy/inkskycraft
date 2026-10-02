// 墨谱为整局章节进度；死亡、重置章节和续关均保留。
import type { ChoiceCard, WeaponColor } from '../types';
export const INK_COLORS: WeaponColor[] = ['red','blue','purple'];
export const INK_NAMES = { red:'朱', blue:'青', purple:'紫' };
export const INK_GRADES = {
 red:[['朱砂浓','出符更快，主雷炸得更远'],['连环符','子符击坠后再出一符，残火更久'],['满堂红','主雷炸开六枚追踪碎符']],
 blue:[['墨弦紧','节拍更紧，光束更宽'],['天地一线','齐鸣的光束与伤害增至三倍'],['万炁归元','齐鸣之后，八束合为一道粗光']],
 purple:[['雷弧长','放电更快，电弧多跳一次'],['网密','网线更密，每线挡弹更多'],['随身网','朱雀带着灵球移动，自动接入电网']],
} as const;
export class InkScore {
 levels:Record<WeaponColor,number>={red:0,blue:0,purple:0};
 awarded=new Set<string>();pending=false;
 resetRun(){this.levels={red:0,blue:0,purple:0};this.awarded.clear();this.pending=false;}
 award(name:string):boolean{const key=['纸龙','铜雀','蜃','雷公'].find(k=>name.startsWith(k));if(!key||this.awarded.has(key))return false;this.awarded.add(key);this.pending=true;return true;}
 choose(color:string):boolean{if(!this.pending||!INK_COLORS.includes(color as WeaponColor)||this.levels[color as WeaponColor]>=3)return false;this.levels[color as WeaponColor]++;this.pending=false;return true;}
 cards():ChoiceCard[]{return INK_COLORS.map(color=>{const level=this.levels[color],next=INK_GRADES[color][Math.min(2,level)];return{id:color,name:`${INK_NAMES[color]} · ${next[0]}`,description:`${next[1]}；字灵多留半秒`,detail:`${level} → ${Math.min(3,level+1)} 级`,preview:`inkScore-${color}`,disabled:level>=3};});}
}
