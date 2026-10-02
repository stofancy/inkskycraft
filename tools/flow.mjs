// 自动巡游：默认三章，URL 倍速默认 16；固定 1/60 步长，批量推进后渲染。
// node tools/flow.mjs --from ch2 --to ch2
// node tools/flow.mjs --from paper --to paper（也可用 SERPENT）
// 兼容位置参数：[额外 URL 参数] [服务 URL]；默认服务为当前开发目录的 5177。
import { runValidation, flowRange } from './validate-expansion.mjs';
const args=process.argv.slice(2),pos=[];let from,to;
for(let i=0;i<args.length;i++){
 if(args[i]==='--from'||args[i]==='--to'){
  const flag=args[i],value=args[++i];if(!value||value.startsWith('--'))throw Error(`${flag} 缺少参数`);
  if(flag==='--from')from=value;else to=value;
 }else if(args[i].startsWith('--'))throw Error(`未知参数 ${args[i]}`);
 else pos.push(args[i]);
}
if(pos.length>2)throw Error('位置参数最多两个：URL 参数、服务 URL');
const range=flowRange(from??'ch1',to??(from??'ch3'));
try{await runValidation(pos[0]??'power=4',pos[1]??'http://127.0.0.1:5177/',`.shots/flow-${range.name??`ch${range.first}-ch${range.last}`}`,process.env.FLOW_CAPTURE!=='0',4,range);}
catch(error){if(!error.flowReported)console.error(`没通过 启动 · ${error.message}`);process.exitCode=1;}
