// 切帧回归：偏移网格、连通区域、三种锚点、透明拒绝、保留源文件。
// node tools/validate-sheet-tool.mjs [证据目录=.shots/p0-09]
import { spawnSync } from 'node:child_process';
const r = spawnSync('python3', ['-c', String.raw`
import json,hashlib,subprocess,tempfile,sys
from pathlib import Path
from PIL import Image,ImageDraw
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
results=[]
with tempfile.TemporaryDirectory() as folder:
 root=Path(folder);srcdir=root/'sources';srcdir.mkdir()
 def run(name,im,options,valid=True):
  src=srcdir/(name+'.png');im.save(src);before=hashlib.sha256(src.read_bytes()).hexdigest()
  dest=root/name
  proc=subprocess.run(['node','tools/sheet.mjs',str(src),'--out='+str(dest),'--columns=2','--rows=2','--size=128',*options],capture_output=True,text=True)
  assert (proc.returncode==0)==valid,(name,proc.stderr)
  assert before==hashlib.sha256(src.read_bytes()).hexdigest()
  result={'case':name,'sourcePreserved':True,'exitCode':proc.returncode}
  if valid:
   meta=json.loads((dest/'sheet.json').read_text());result.update(method=meta['splitMethod'],jitterPx=meta['jitterPx'])
   assert meta['count']==4 and meta['jitterPx']<=1.415
   assert len(list(dest.glob('[0-9][0-9].png')))==4
   for frame in meta['frames']:assert frame['anchorResidualPx']<=.708
   result['metadata']=meta
  else:result['error']=proc.stderr.splitlines()[-1]
  results.append(result);return result
 grid=Image.new('RGBA',(200,200));d=ImageDraw.Draw(grid)
 for i,(x,y) in enumerate([(35,40),(140,20),(25,130),(160,140)]):d.rectangle((x,y,x+15+i*3,y+22+i*4),fill=(200,30,40,255))
 run('centroid',grid,['--anchor=centroid','--split=grid','--mode=once','--events=2:impact'])
 run('bottom',grid,['--anchor=bottom','--split=grid'])
 run('point',grid,['--anchor=point','--point=.5,.5','--split=grid'])
 uneven=Image.new('RGBA',(200,200));d=ImageDraw.Draw(uneven)
 for x,y,h in [(40,70,60),(145,70,60),(40,155,25),(145,155,25)]:d.rectangle((x,y,x+16,y+h),fill=(50,150,200,255))
 auto=run('uneven',uneven,['--anchor=centroid']);assert auto['method']=='components'
 # 连通裁切后，固定原图锚点继续使用原网格坐标。
 rootPoint=run('uneven-point',uneven,['--anchor=point','--point=.5,.8'])
 for i,frame in enumerate(rootPoint['metadata']['frames']):
  x,y=frame['sourceRect'][:2];trim=frame['trim']
  a=frame['sourceAnchor'];assert abs(x+trim[0]+a[0]-(i%2*100+50))<1e-6
  assert abs(y+trim[1]+a[1]-(i//2*100+80))<1e-6
 run('opaque',Image.new('RGBA',(200,200),(255,255,255,255)),[],False)
 run('blank',Image.new('RGBA',(200,200)),[],False)
 run('bad-count',grid,['--count=5'],False)
 run('bad-event',grid,['--events=4:hit'],False)
 # 产物含阈值与独立动作尺寸；所有输出帧统一画布，无逐帧拉伸。
 for r in results:
  if 'metadata' in r:
   assert r['metadata']['alphaFloor']==8 and r['metadata']['frameSize']==[128,128]
(out/'sheet-tool-tests.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':len(results),'evidence':str(out/'sheet-tool-tests.json')},ensure_ascii=False))
`, process.argv[2] ?? '.shots/p0-09'], { encoding: 'utf8', maxBuffer: 2*1024*1024 });
process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exit(r.status ?? 1);
