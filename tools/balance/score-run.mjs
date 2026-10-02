// P4-13 整局得分样本：复用真实圈封/反制流程，普通难度、初始火力1、三色各10个固定种子。
// 无敌、自动射击及自动选天赋；不使用伤害、掉落或分数覆写。菜单停留不计战斗时间。
// node tools/balance/score-run.mjs [URL] [输出目录] [每色次数，默认10]
import {runValidation} from '../validate-expansion.mjs';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5178/';
const out=process.argv[3]??'.shots/p4-13-score',count=Number(process.argv[4]??10);
if(!Number.isInteger(count)||count<1)throw Error('每色次数必须为正整数');
mkdirSync(out,{recursive:true});
const rows=[];
for(const [colorIndex,weapon] of ['red','blue','purple'].entries())for(let i=0;i<count;i++){
 const seed=202610130+colorIndex*100+i,dir=`${out}/${weapon}-${seed}`;
 const query=`power=1&weapon=${weapon}&diff=normal&seed=${seed}`;
 const cached=existsSync(`${dir}/validation.json`)?JSON.parse(readFileSync(`${dir}/validation.json`,'utf8')):null;
 const report=cached?.complete?cached:await runValidation(query,base,dir,false);
 rows.push({weapon,seed,score:report.finalScore,chapters:report.stages.map(s=>({stage:s.stage,seconds:s.simulatedSeconds,score:s.score})),extends:report.extends,complete:report.complete});
 writeFileSync(`${out}/samples.json`,JSON.stringify(rows,null,2));
 console.log(JSON.stringify({weapon,seed,score:report.finalScore,completed:rows.length}));
}
const stats=group=>{
 const values=group.map(r=>r.score),n=values.length,mean=values.reduce((a,b)=>a+b,0)/n;
 return{n,mean,min:Math.min(...values),max:Math.max(...values),sampleStdDev:n>1?Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)):0,reach1M:values.filter(v=>v>=1e6).length,reach1_8M:values.filter(v=>v>=1.8e6).length,extendChapters:Object.fromEntries([1,2].map(line=>[line,Object.fromEntries([1,2,3].map(stage=>[stage,group.filter(r=>r.extends?.some(e=>e.line===line&&e.stage===stage)).length]))]))};
};
const summary={difficulty:'normal',initialPower:1,god:true,autofire:true,bot:true,scope:'三关结算至终章入口；含结算奖励',overall:stats(rows),colors:Object.fromEntries(['red','blue','purple'].map(c=>[c,stats(rows.filter(r=>r.weapon===c))]))};
writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
