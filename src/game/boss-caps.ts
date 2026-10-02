// Boss 伤害限额：子弹是主要伤害来源，技能每次封顶，破绽窗口内放宽一次。统一在 World.damage 结算。
import type { World } from './world';
import type { Enemy } from './enemy';
import type { DamageSource } from '../types';
import { RS } from '../gl/ribbons';

/** 占当前段满血的比例；暂定数值。 */
export const BOSS_CAP={ink:.06,bomb:.10,skill:.06,companion:.03,burnPerSec:.005,weak:.25,weakSeconds:4};
interface State{phase:unknown;casts:Map<unknown,{used:number;cap:number}>;burn:{level:number;at:number};group:Map<string,{key:object;last:number}>;weaks:number}
export class BossCaps {
 private states=new WeakMap<Enemy,State>();
 constructor(readonly w:World){}
 bossOf(e:Enemy):Enemy|null{let root=e;while(root.parent)root=root.parent;const c=(e.data.bossOwner??root.data.bossOwner??root) as Enemy;return c.def?.boss?c:null;}
 private state(boss:Enemy):State{let s=this.states.get(boss);const phase=boss.data.phase??0;
  if(!s||s.phase!==phase){s={phase,casts:new Map(),burn:{level:boss.maxHp*BOSS_CAP.burnPerSec,at:this.w.real},group:new Map(),weaks:0};this.states.set(boss,s);}return s;}
 /** 返回允许的伤害；amount 已含护甲与易伤倍率。 */
 apply(boss:Enemy,source:DamageSource,amount:number,opts:{tag?:string;castKey?:object}):number{
  if(source==='qte')return amount;
  const now=this.w.real,max=boss.maxHp,s=this.state(boss);
  if(opts.tag==='burn'){const b=s.burn,rate=max*BOSS_CAP.burnPerSec;b.level=Math.min(rate,b.level+rate*(now-b.at));b.at=now;const a=Math.min(amount,b.level);b.level-=a;return a;}
  const kind=source==='ink'?'ink':source==='bomb'?'bomb':source==='companion'?'companion':source==='neutral'?'skill':null;
  if(!kind)return amount;
  // 没有显式施放对象的来源（伙伴、技能）按时间分组：0.5 秒内连续伤害算同一次。
  let key:unknown=opts.castKey;
  if(!key){let g=s.group.get(kind);if(!g||now-g.last>.5){g={key:{},last:now};s.group.set(kind,g);}g.last=now;key=g.key;}
  let c=s.casts.get(key);
  if(!c){c={used:0,cap:max*BOSS_CAP[kind]};
   const weak=boss.data.weak as {until:number;claimed?:boolean}|undefined;
   if(weak&&now<weak.until&&!weak.claimed&&(kind==='ink'||kind==='bomb')){weak.claimed=true;c.cap=max*BOSS_CAP.weak;this.w.fx.shake(.25);this.w.audio.sfx('seal');}
   s.casts.set(key,c);}
  const a=Math.max(0,Math.min(amount,c.cap-c.used));c.used+=a;return a;
 }
 /** 打开破绽窗口：窗口内第一次执笔或泼墨可以结算大额。 */
 openWeak(boss:Enemy,label='破绽'):void{
  boss.data.weak={until:this.w.real+BOSS_CAP.weakSeconds,claimed:false};
  this.w.audio.sfx('warning');this.w.caption('',`${label} · 现在执笔或泼墨`,BOSS_CAP.weakSeconds);
 }
 /** 关卡机制直接扣掉当前段满血的一部分，不受限额约束；用破绽圈和字幕提示。 */
 chunk(boss:Enemy,frac:number,label:string):void{
  boss.hp=Math.max(1,boss.hp-boss.maxHp*frac);boss.data.weak={until:this.w.real+1,claimed:true};
  this.w.audio.sfx('seal');this.w.fx.shake(.25);this.w.caption('',label,2);
 }
 draw():void{
  const r=this.w.r,now=this.w.real;
  // 没有自定义破绽条件的 Boss：每段血量降到 65% 和 30% 时各开一次。
  for(const e of this.w.enemies){if(!e.def.boss||e.dead||e.data.weakCustom||e.maxHp<=0||e.hp<=0)continue;const s=this.state(e),f=e.hp/e.maxHp;if((s.weaks===0&&f<=.65)||(s.weaks===1&&f<=.3)){s.weaks++;this.openWeak(e);}}
  for(const e of this.w.enemies){const weak=e.data.weak as {until:number;claimed?:boolean}|undefined;if(!weak||e.dead||now>=weak.until)continue;
   const p=(weak.until-now)/BOSS_CAP.weakSeconds,pulse=.5+.5*Math.sin(now*14),a=weak.claimed?.35:.9;
   const x=e.x,y=e.y,R=120+30*pulse;const pts:number[]=[];for(let j=0;j<=48;j++){const t=j/48*Math.PI*2*Math.max(.02,p);pts.push(x+Math.cos(t-Math.PI/2)*R,y+Math.sin(t-Math.PI/2)*R);}
   r.ribbonTop.strip(pts,7,RS.Warn,1.4,.9,.3,a);
   for(let k=0;k<4;k++){const t=k*Math.PI/2+now*2;r.ribbonTop.line(x+Math.cos(t)*(R+24),y+Math.sin(t)*(R+24),x+Math.cos(t)*(R-8),y+Math.sin(t)*(R-8),5,RS.Warn,1.5,.4,.2,a);}
  }
 }
}
