// PNG 透明/边缘检查与无损裁边。依赖 Python3 + Pillow（巡游工具同用）。原文件保留。
// node tools/art-check.mjs <png或目录> [--out=输出目录] [--rect=x,y,w,h] [--anchor=root:x,y] [--anchor=muzzle:x,y]
// 锚点为原图像素坐标，输出同时报告裁边后坐标和相对矩形中心坐标；默认仅检查。
// 白/灰边是半透明边缘像素的启发式候选，允许金属高光，需在深浅背景上人工审图。
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (!args.length) { console.error('用法：node tools/art-check.mjs <PNG或目录> [--out=目录] [--rect=x,y,w,h] [--anchor=root:x,y]'); process.exit(1); }
const result = spawnSync('python3', ['-c', String.raw`
import sys,json
from pathlib import Path
from PIL import Image
args=sys.argv[1:]; inputs=[a for a in args if not a.startswith('--')]
opts={}; anchors={}
for a in args:
 if a.startswith('--anchor='):
  name,xy=a.split('=',1)[1].split(':',1);anchors[name]=list(map(float,xy.split(',')))
 elif a.startswith('--'):
  key,value=a[2:].split('=',1);opts[key]=value
if set(opts)-{'out','rect'}:raise ValueError('未知选项')
files=[]
for arg in inputs:
 p=Path(arg);files.extend(sorted(p.rglob('*.png')) if p.is_dir() else [p])
if not files:raise ValueError('没有 PNG 文件')
if 'out' in opts:
 names=[p.name for p in files]
 if len(set(names))!=len(names):raise ValueError('输出目录有重复文件名')
records=[]
for p in files:
 with Image.open(p) as source:
  if source.format!='PNG':raise ValueError(f'{p} 须为 PNG')
  has_alpha='A' in source.getbands() or 'transparency' in source.info
  original=source.size;im=source.convert('RGBA');origin=[0,0]
 if 'rect' in opts:
  x,y,w,h=map(int,opts['rect'].split(','))
  if min(x,y)<0 or min(w,h)<=0 or x+w>im.width or y+h>im.height:raise ValueError('裁切矩形超出图像')
  im=im.crop((x,y,x+w,y+h));origin=[x,y]
 alpha=im.getchannel('A');bbox=alpha.getbbox()
 semi=white=gray=transparent=0
 for r,g,b,a in (im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata()):
  if a==0:transparent+=1
  if 8<=a<=247:
   semi+=1
   if min(r,g,b)>=220 and max(r,g,b)-min(r,g,b)<=25:white+=1
   elif 65<=min(r,g,b) and max(r,g,b)<=220 and max(r,g,b)-min(r,g,b)<=16:gray+=1
 warning=[]
 if not has_alpha:warning.append('缺少透明通道')
 if transparent==0:warning.append('没有全透明像素')
 if not bbox:warning.append('全透明图像')
 if semi and (white+gray)/semi>.05:warning.append('半透明边缘存在白/灰候选，请审图')
 crop=im.crop(bbox) if bbox else im
 offset=[origin[0]+(bbox[0] if bbox else 0),origin[1]+(bbox[1] if bbox else 0)]
 mapped={name:{'pixel':[x-offset[0],y-offset[1]],'center':[x-offset[0]-crop.width/2,y-offset[1]-crop.height/2],
  'inside':0<=x-offset[0]<crop.width and 0<=y-offset[1]<crop.height} for name,(x,y) in anchors.items()}
 output=None
 if 'out' in opts:
  dst=Path(opts['out'])/p.name
  if dst.resolve()==p.resolve():raise ValueError('输出路径不能覆盖原文件')
  dst.parent.mkdir(parents=True,exist_ok=True);crop.save(dst);output=str(dst)
 records.append({'file':str(p),'originalSize':original,'alphaChannel':has_alpha,'alphaRange':alpha.getextrema(),
  'transparentPixels':transparent,'semiTransparentPixels':semi,'whiteEdgeCandidates':white,'grayEdgeCandidates':gray,
  'cropOffset':offset,'trimmedSize':crop.size,'anchors':mapped,'warnings':warning,'output':output})
print(json.dumps(records,ensure_ascii=False,indent=2))
if any(not r['alphaChannel'] or r['alphaRange'][1]==0 for r in records):sys.exit(2)
`, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
