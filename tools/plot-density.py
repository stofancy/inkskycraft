# P4-05：沿用P4-M1的三局采样表和线性分位数，PNG使用Pillow输出。
import json,csv,pathlib,shutil,sys,statistics
from PIL import Image,ImageDraw,ImageFont
D=pathlib.Path(sys.argv[1]);runs=json.loads((D/'runs.json').read_text());stats={}
fontfile='local-source/ZhuqueFangsong-Regular.ttf'
font=ImageFont.truetype(fontfile,21);small=ImageFont.truetype(fontfile,17)
metrics=['enemy_count','bullet_count','enemy_area_pct']
def percentile(values,p):
 a=sorted(values);x=(len(a)-1)*p;i=int(x);return a[i]+(a[min(i+1,len(a)-1)]-a[i])*(x-i)
def summarize(rows):
 return {m:{'peak':max(r[m] for r in rows),'median':statistics.median(r[m] for r in rows),'p90':percentile([r[m] for r in rows],.9)} for m in metrics}
def gap(rows):
 best=cur=0
 for q in rows:cur=cur+.5 if q['enemy_count']==0 else 0;best=max(cur,best)
 return best
for chapter in sorted({r['chapter'] for r in runs}):
 group=[r for r in runs if r['chapter']==chapter];rows=[q for r in group for q in r['rows']]
 normal=[q for q in rows if not q['boss'] and (q['checkpoint'].startswith('E') or q['checkpoint'].startswith('W'))]
 stats[str(chapter)]={'pooled':summarize(rows),'ordinary':summarize(normal),'runs':{str(r['run']):summarize(r['rows']) for r in group},'samples':len(rows),'zero_enemy_seconds_max':max(gap(r['rows']) for r in group),'deaths':[len(r['deaths']) for r in group]}
 if chapter==1:
  gaps=[];active=[]
  for r in group:
   t=r['end'].get('times',{});best=0
   for i in range(1,11):
    if f'E{i}.start' not in t or f'E{i}.end' not in t:continue
    part=[q for q in r['rows'] if t[f'E{i}.start']<=q['game_s']<=t[f'E{i}.end']];active+=part;best=max(best,gap(part))
   gaps.append(best)
  stats[str(chapter)]['active_event_zero_enemy_seconds']=gaps
  stats[str(chapter)]['active_events']=summarize(active)
 with (D/f'ch{chapter}.csv').open('w') as f:
  wr=csv.DictWriter(f,fieldnames=rows[0].keys());wr.writeheader();wr.writerows(rows)
 im=Image.new('RGB',(1400,1060),'#faf8f1');d=ImageDraw.Draw(im);d.text((35,15),f'第{chapter}章 · 普通难度三局 · 0.5秒采样 · 无无敌',font=font,fill='#282820')
 for k,r in enumerate(group):
  yy=80+k*310;x0,x1=90,1290;y0,y1=yy+25,yy+240;tmax=max(q['elapsed_s'] for q in r['rows']);num=max(10,max(max(q['enemy_count'],q['bullet_count']) for q in r['rows']));area=max(10,max(q['enemy_area_pct'] for q in r['rows']))
  d.text((35,yy-15),f"第{r['run']}局 · {r['end']['checkpoint']} · 截止{r['end']['elapsed_s']:.0f}秒 · 死亡{len(r['deaths'])}次",font=small,fill='#282820')
  for j in range(5):
   y=y1-j/4*(y1-y0);d.line((x0,y,x1,y),fill='#d5d1c7');d.text((20,y-10),f'{num*j/4:.0f}',font=small,fill='#48483a');d.text((x1+8,y-10),f'{area*j/4:.1f}%',font=small,fill='#008b6f')
  for m,color,limit in [('enemy_count','#1473b6',num),('bullet_count','#d55e00',num),('enemy_area_pct','#008b6f',area)]:
   pts=[(x0+q['elapsed_s']/max(1,tmax)*(x1-x0),y1-q[m]/limit*(y1-y0)) for q in r['rows']];d.line(pts,fill=color,width=2)
  for death in r['deaths']:
   x=x0+death['elapsed_s']/max(1,tmax)*(x1-x0);d.line((x,y0,x,y1),fill='#a80037',width=2)
  for j in range(5):d.text((x0+j/4*(x1-x0)-15,y1+6),f'{tmax*j/4:.0f}s',font=small,fill='#48483a')
 d.text((90,1010),'蓝：同屏敌机   橙：同屏敌弹   绿：敌机包围盒并集面积（右轴）',font=font,fill='#282820');im.save(D/f'ch{chapter}-density.png')
(D/'statistics.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n')
if (D/'top5.json').exists():
 tops=json.loads((D/'top5.json').read_text());ranks={}
 for row in tops:
  ch=row['chapter'];ranks[ch]=ranks.get(ch,0)+1;target=f'ch{ch}-top{ranks[ch]}.png';shutil.copyfile(D/row['screenshot'],D/target);row['rank_screenshot']=target
 (D/'top5.json').write_text(json.dumps(tops,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(stats,ensure_ascii=False))
