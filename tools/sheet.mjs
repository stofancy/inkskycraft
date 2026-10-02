// 透明分镜切帧、裁边、统一缩放与锚点对齐。依赖 Python3 + Pillow，保留原图。
// node tools/sheet.mjs <源PNG> --columns=4 --rows=4 --out=public/art/sheets/player
// [--count=16 --size=256 --anchor=centroid|bottom|point --point=.5,.5 --fps=12
//  --mode=loop|once|pingpong --events=3:impact --split=auto|grid|components]
// components 按透明连通主体重建行列，仅在主体数量可确认时使用；歧义时报错供人工处理。
// jitter 是所选锚点的栅格化残差；形体/动作漂移另看 shape 与 seam，不作保形证明。
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const r = spawnSync('python3', [fileURLToPath(new URL('./sheet.py', import.meta.url)), ...process.argv.slice(2)],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exit(r.status ?? 1);
