# P4-05b：两章各三局峰值与P4-M1证据并排；保留原截图比例。
import json,pathlib,sys
from PIL import Image,ImageDraw,ImageFont
D=pathlib.Path(sys.argv[1]);R=D/'round2';M=pathlib.Path('local-source/P4-M1')
fontfile='local-source/ZhuqueFangsong-Regular.ttf'
f=ImageFont.truetype(fontfile,24);small=ImageFont.truetype(fontfile,19)
im=Image.new('RGB',(2200,1660),'#faf8f1');d=ImageDraw.Draw(im)
def put(path,x,y,w,h):
 a=Image.open(path).convert('RGB');a.thumbnail((w,h));im.paste(a,(x+(w-a.width)//2,y+(h-a.height)//2))
tops=json.loads((R/'top5.json').read_text());runs=json.loads((R/'runs.json').read_text())
for ch in [1,2]:
 y=20+(ch-1)*820;d.text((25,y),f'第{ch}章 · P4-M1与P4-05b第二轮',font=f,fill='#222a25')
 if ch==1:
  d.text((25,y+40),'P4-M1原始三局曲线',font=small,fill='#222a25');put(M/'ch1-density.png',15,y+160,520,460)
  d.text((25,y+95),'敌机峰值2 / 普通战弹量中位0',font=small,fill='#222a25')
  d.text((25,y+690),'M1未留第一章峰值截图，使用原曲线。',font=small,fill='#222a25')
 else:
  d.text((25,y+40),'P4-M1第二章峰值截图',font=small,fill='#222a25');put(M/'ch2-top1.png',15,y+100,520,650)
  d.text((25,y+760),'全章峰值45机 / 180弹 / 面积42.52%',font=small,fill='#222a25')
 for run in [1,2,3]:
  row=next(q for q in tops if q['chapter']==ch and q['run']==run);seed=next(q['seed'] for q in runs if q['chapter']==ch and q['run']==run);x=550+(run-1)*550
  d.text((x+10,y+40),f"第{run}局 · seed {seed} · {row['elapsed_s']:g}s",font=small,fill='#222a25');put(R/row['screenshot'],x,y+100,530,650)
  d.text((x+10,y+760),f"{row['enemy_count']}机 / {row['bullet_count']}弹 / 面积{row['enemy_area_pct']:.2f}%",font=small,fill='#222a25')
im.save(D/'peak-comparison.png')
im=Image.new('RGB',(2200,920),'#faf8f1');d=ImageDraw.Draw(im);bosses=json.loads((D/'bosses/results.json').read_text());names={'SPARROW':'铜雀','SERPENT':'纸龙','MIRAGE':'蜃'}
for i,b in enumerate(bosses):
 x=i*550;d.text((x+20,20),f"{names[b['checkpoint']]} · 普通难度 · 未开无敌",font=f,fill='#222a25');a=Image.open(D/'bosses'/b['peak']['screenshot']).convert('RGB');a.thumbnail((530,750));im.paste(a,(x+(550-a.width)//2,80+(750-a.height)//2))
 d.text((x+20,850),f"屏内采样峰值{b['peak']['bullet_count']} / 总池逐帧峰值{max(c['poolPeak'] for c in b['checks'])}",font=small,fill='#222a25')
im.save(D/'boss-comparison.png')
