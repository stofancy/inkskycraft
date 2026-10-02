// P4-13b：普通难度、固定种子和相同自动控制器，当前4级与 p4-a-int 8级三色逐一比较。
// 基线URL指向未修改的 p4-a-int；满级流程保留各版本实际道具/伙伴，结果是整套配置用时。
// node tools/balance/compare-boss-power.mjs [当前URL] [基线URL] [证据目录]
import {runValidation} from '../validate-expansion.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const [current='http://127.0.0.1:5178/',baseline='http://127.0.0.1:5199/',out='.shots/p4-13b-boss']=process.argv.slice(2);
mkdirSync(out,{recursive:true});const rows=[];
for(const weapon of ['red','blue','purple']){
 const pair={weapon,seed:2026101313};
 for(const [name,url,power] of [['baseline',baseline,8],['current',current,4]]){
  const r=await runValidation(`power=${power}&weapon=${weapon}&diff=normal&seed=${pair.seed}`,url,`${out}/${name}-${weapon}`,name==='current'&&weapon==='purple',power);
  pair[name]=Object.fromEntries(['paper','copper'].map(boss=>{
   const b=r.stages[0].bossResults[boss],start=b.events.find(e=>e.id==='phase-1'),end=b.events.find(e=>e.id===(boss==='paper'?'paper-folded':'control-sealed'));
   if(!start||!end)throw Error('Boss时间事件缺失');
   return[boss,{seconds:end.real-start.real,result:b.result,loadouts:r.stages[0].bossLoadouts.filter(l=>l.boss===(boss==='paper'?'纸龙':'铜雀')),phases:b.phases,events:b.events}];
  }));
 }rows.push(pair);writeFileSync(`${out}/comparison.json`,JSON.stringify({scope:'第一阶段开始到圈封成功的真实游戏秒；无敌自动流程，含真实反制/圈绘；每色一个匹配种子',rows},null,2));
 console.log(JSON.stringify({weapon,current:Object.fromEntries(Object.entries(pair.current).map(([k,v])=>[k,v.seconds])),baseline:Object.fromEntries(Object.entries(pair.baseline).map(([k,v])=>[k,v.seconds]))}));
}
