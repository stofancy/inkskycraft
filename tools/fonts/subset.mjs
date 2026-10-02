// 从游戏源码的字符串/模板文本收集字符，交给项目 .venv 内的 fontTools。
// npm run fonts:subset；正文 source 与数字 numericSource 独立配置，并附各自许可。
// 外部动态文案应登记 extraText；每次构建重新取源码字集，不读取 studio 或依赖外网。
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '../..');
const config = JSON.parse(readFileSync(join(import.meta.dirname, 'config.json'), 'utf8'));
const text = [config.extraText, config.numericText];
function scan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) { scan(path); continue; }
    if (!e.name.endsWith('.ts') || ['fonts.ts', 'css.ts'].includes(e.name)) continue;
    // 忽略注释；收集引号及模板字面量。模板插值中的固定文字也纳入字集。
    const source = readFileSync(path, 'utf8');
    const literals = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
    for (const match of source.matchAll(literals)) {
      if (match[0].startsWith('/')) continue;
      text.push(match[0].slice(1, -1).replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))));
    }
  }
}
scan(join(root, 'src'));
scan(join(root, 'tools')); // 包含预览样例中可见的文字。
// 模板中有 SVG/HTML：去掉标签，保留文字与实体；保守包含普通源码字符串。
const corpus = text.map(chunk => chunk.replace(/<\/?[a-z][^>]*>/gi, '').replace(/&(?:amp|lt|gt|quot|nbsp);/g, ' ')).join('');
function useCommittedSubset() {
  let coverage = '字形覆盖记录不可用';
  try {
    const report = JSON.parse(readFileSync(join(root, 'assets/fonts/subset-report.json'), 'utf8'));
    if (typeof report.coveredCharacters === 'string') {
      const covered = new Set(report.coveredCharacters);
      const missing = [...new Set([...corpus].filter(c => !/\s/u.test(c)))].filter(c => !covered.has(c));
      coverage = missing.length ? `缺失字形：${missing.join('')}` : '已记录子集覆盖当前源码扫描用字';
    }
  } catch { /* 旧统计或未生成统计时仍可使用已提交资源。 */ }
  console.warn(`[字体] 工具不可用，沿用已提交子集；新文字可能回退系统字体；${coverage}；运行 npm run fonts:setup 后重新构建。`);
  process.exit(0);
}
const result = spawnSync(join(root, '.venv/bin/python'), [join(import.meta.dirname, 'subset.py')], {
  cwd: root, env: { ...process.env, PYTHONHASHSEED: '0' }, input: JSON.stringify({ config, corpus }), encoding: 'utf8',
});
if (result.error || result.status === 78) useCommittedSubset();
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);
process.stdout.write(result.stdout);
