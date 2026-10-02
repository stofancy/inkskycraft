// 整局流程自测：真实反制、实际Brush闭环、三关逐章结算 → 终章。
// 用法：node tools/flow.mjs [额外 URL 参数，如 'power=4&weapon=blue&diff=hard'] [服务 URL，默认 http://127.0.0.1:5173/]
// 剧情每页显示全文0.5秒后自动翻页，游玩时间与对白暂停时间分别记录。
// 与扩展验收共用入口，报告及截图保存到 .shots/expansion；FLOW_CAPTURE=0 只写报告。
import { runValidation } from './validate-expansion.mjs';
await runValidation(process.argv[2] ?? 'power=4', process.argv[3] ?? 'http://127.0.0.1:5173/', '.shots/expansion', process.env.FLOW_CAPTURE !== '0');
