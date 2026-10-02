// P3-12c：逐字核对源码字面量内的汉字与实际 WOFF2 cmap；注释不纳入。
// FONT_PYTHON=/path/.venv/bin/python node tools/fonts/check-coverage.mjs [绝对JSON输出路径]
// 保守收录所有字符串/模板中的汉字，包含动态拼接的固定片段。
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../..'),files=[],characters=new Set();
function scan(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory()){scan(p);continue;}if(!/\.(ts|tsx|js|json)$/.test(e.name))continue;
 const s=readFileSync(p,'utf8'),chars=new Set();
 const tokens=/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
 for(const m of s.matchAll(tokens)){if(m[0].startsWith('/'))continue;const text=(e.name==='css.ts'?m[0].slice(1,-1).replace(/\/\*[\s\S]*?\*\//g,''):m[0].slice(1,-1)).replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi,(_,a,b)=>String.fromCodePoint(parseInt(a??b,16))).replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,a,b)=>String.fromCodePoint(parseInt(a??b,a?16:10)));
 for(const c of text)if(/\p{Script=Han}/u.test(c)){characters.add(c);chars.add(c);}}
 if(chars.size)files.push({file:relative(root,p),characters:[...chars].sort().join('')});}}
scan(join(root,'src'));
const font=join(root,'public/fonts/ui-text.woff2'),r=spawnSync(process.env.FONT_PYTHON??join(root,'.venv/bin/python'),['-c','import json,sys;from fontTools.ttLib import TTFont;print(json.dumps(sorted(TTFont(sys.argv[1]).getBestCmap())))',font],{encoding:'utf8'});
if(r.error||r.status!==0)throw Error(r.error??r.stderr);
const cmap=new Set(JSON.parse(r.stdout)),missing=[...characters].filter(c=>!cmap.has(c.codePointAt(0))).sort();
const report={status:missing.length?'failed':'passed',font:relative(root,font),sha256:createHash('sha256').update(readFileSync(font)).digest('hex'),sourceFiles:files.length,requiredHan:characters.size,coveredHan:characters.size-missing.length,missingCount:missing.length,missing:missing.join(''),files};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined}));if(missing.length)process.exitCode=1;
