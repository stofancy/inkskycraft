"""P4-04 证据拼接：保留原始游戏帧，另生成长条、局部对照及可播放的 HTML 索引。
python3 tools/compose-a-vfx.py [绝对证据目录]；依赖 Pillow，不改游戏资产。
"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'local-source/P4-04-evidence')
assert out.is_absolute()
root = Path(__file__).resolve().parents[1]
font = ImageFont.truetype(str(root / 'assets/fonts/source/NotoSerifCJKsc-Regular.otf'), 18)
colors = {'red': '朱 · 浴火', 'purple': '雷 · 雷殛', 'blue': '青 · 御剑'}
scenes = {'stage1': '第一章', 'stage2': '第二章', 'boss': '铜雀战'}

def canvas(w, h):
    im = Image.new('RGB', (w, h), (15, 18, 23))
    return im, ImageDraw.Draw(im)

sheet, d = canvas(1080, 870)
for row, (color, label) in enumerate(colors.items()):
    for col, (state, name) in enumerate({'idle': '静止', 'moving': '移动', 'firing': '开火'}.items()):
        im = Image.open(out / f'aura-{color}-{state}.png').crop((580, 615, 1080, 890)).resize((360, 255))
        sheet.paste(im, (col * 360, row * 290 + 30))
        d.text((col * 360 + 8, row * 290 + 4), label + ' · ' + name, font=font, fill='#eee')
sheet.save(out / 'aura-contact.png')
sheet, d = canvas(1800, 840)
for row, (color, label) in enumerate(colors.items()):
    for i in range(6):
        im = Image.open(out / f'aura-{color}-switch-{i}.png').crop((585, 610, 1015, 900)).resize((300, 250))
        sheet.paste(im, (i * 300, row * 280 + 30))
        d.text((i * 300 + 8, row * 280 + 4), f'{label} {i * .05:.2f}s', font=font, fill='#eee')
sheet.save(out / 'aura-switch-contact.png')
for name, frame in [('mantra-contact', 45), ('mantra-start-contact', 2)]:
    sheet, d = canvas(1080, 1530)
    for row, (scene, title) in enumerate(scenes.items()):
        for col, (color, label) in enumerate(colors.items()):
            im = Image.open(out / f'{scene}-{color}/{frame:03}.jpg').crop((463, 0, 1138, 900)).resize((360, 480))
            sheet.paste(im, (col * 360, row * 510 + 30))
            d.text((col * 360 + 8, row * 510 + 4), title + ' · ' + label, font=font, fill='#eee')
    sheet.save(out / f'{name}.png')
for scene in scenes:
    for color in colors:
        sheet, d = canvas(225 * 74, 324)
        for i in range(74):
            im = Image.open(out / f'{scene}-{color}/{i:03}.jpg').crop((463, 0, 1138, 900)).resize((225, 300))
            sheet.paste(im, (i * 225, 24))
            d.text((i * 225 + 6, 1), f'{i * .05:.2f} s', font=font, fill='#eee')
        sheet.save(out / f'{scene}-{color}-strip.png')
report = json.loads((out / 'validation.json').read_text())
assert report['passed'] and len(report['casts']) == 9 and len(report['performance']) == 9
options = ''.join(f'<option value="{s}-{c}">{title} · {label}</option>' for s, title in scenes.items() for c, label in colors.items())
rows = ''.join(f'<tr><td>{scenes[p["scene"]]}</td><td>{colors[p["color"]]}</td><td>{p["completedP95"]:.2f}</td><td>{p["gpuP95"]:.2f}</td></tr>' for p in report['performance'])
links = ''.join(f'<a href="{s}-{c}-strip.png">{title} · {label}</a>' for s, title in scenes.items() for c, label in colors.items())
html = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>光环与真言演出验收</title>
<style>body{background:#101319;color:#efe9dc;font:16px/1.7 system-ui;margin:32px auto;max-width:1100px}h1,h2{font-weight:500}img{max-width:100%}button,select,input{font:inherit}button,select{background:#252b34;color:inherit;border:1px solid #525763;padding:6px 14px}input{width:50%}.links{display:flex;flex-wrap:wrap;gap:16px}a{color:#95dbd8}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #444;padding:8px;text-align:left}</style>
<h1>三色光环与泼墨真言</h1><p>1600×900 游戏原帧；真言每 0.05 秒一帧，0–3.65 秒，每组 74 帧。默认繁体字图来自 P4-02。</p>
<select id="scene">OPTIONS</select> <button id="play">播放连续帧</button> <input id="frame" type="range" min="0" max="73" value="0"> <span id="time"></span><img id="shot">
<p><a id="strip">打开本组逐帧长条</a> · <a href="validation.json">数值与帧时间原始数据</a></p>
<h2>九组逐帧长条</h2><div class="links">LINKS</div><p>长条裁取战场并缩小用于对照；上方播放器和各组原始 JPG 保留完整 HUD。</p>
<h2>光环：静止、移动、开火</h2><img src="aura-contact.png"><h2>换入：连续六帧</h2><img src="aura-switch-contact.png">
<h2>起手暗场：0.10 秒</h2><img src="mantra-start-contact.png"><h2>墨碑驻留：2.25 秒</h2><img src="mantra-contact.png">
<h2>全程帧时间 p95（毫秒）</h2><p>本机 RTX 5070 Ti / ANGLE Vulkan。每组 216 帧；CPU 包含 World 更新、绘制调用和 gl.finish 调用，GPU 用独立 TIME_ELAPSED 原始查询。</p><table><tr><th>场景</th><th>颜色</th><th>CPU p95</th><th>整帧 GPU p95</th></tr>ROWS</table>
<script>const scene=document.querySelector('#scene'),frame=document.querySelector('#frame'),shot=document.querySelector('#shot'),play=document.querySelector('#play');let timer=null;function draw(){let i=+frame.value;shot.src=scene.value+'/'+String(i).padStart(3,'0')+'.jpg';document.querySelector('#time').textContent=(i*.05).toFixed(2)+' 秒';document.querySelector('#strip').href=scene.value+'-strip.png';}scene.onchange=()=>{frame.value=0;draw()};frame.oninput=draw;play.onclick=()=>{if(timer){clearInterval(timer);timer=null;play.textContent='播放连续帧'}else{timer=setInterval(()=>{frame.value=(+frame.value+1)%74;draw()},50);play.textContent='暂停'}};draw();</script></html>'''
(out / 'index.html').write_text(html.replace('OPTIONS', options).replace('LINKS', links).replace('ROWS', rows))
print('已生成9条74帧横条、4张审图对照和HTML索引')

# 可选第二参数为上次审图目录；新旧均直接拼接游戏帧。
if len(sys.argv) > 2:
    old = Path(sys.argv[2])
    assert old.is_absolute()
    sheet, d = canvas(2160, 2480)
    for col, (directory, title) in enumerate([(old, 'P4-04 原交付'), (out, 'P4-04b 返工')]):
        x = col * 1080
        d.text((x + 16, 6), title, font=font, fill='#eee')
        sheet.paste(Image.open(directory / 'aura-contact.png'), (x, 40))
        sheet.paste(Image.open(directory / 'mantra-contact.png'), (x, 930))
    sheet.save(out / 'before-after.png')
    sheet, d = canvas(780, 270)
    for i, (color, label) in enumerate(colors.items()):
        im = Image.open(out / f'aura-{color}-idle.png').crop((670, 660, 930, 900))
        sheet.paste(im, (i * 260, 30))
        d.text((i * 260 + 8, 4), label + ' · 100%', font=font, fill='#eee')
    sheet.save(out / 'aura-100-contact.png')
    html = (out / 'index.html').read_text()
    details = '<h2>原交付与返工并排</h2><a href="before-after.png"><img src="before-after.png"></a><h2>第一章静止光环 100% 裁图</h2><img src="aura-100-contact.png">'
    details += '<h2>字间距与实际播放记录</h2><p>非末字中心距离，游戏单位；正式采样事件包含 AudioContext 原始时刻、World 真实时间和演出年龄。</p><table><tr><th>场景 / 颜色</th><th>最小间距</th></tr>'
    details += ''.join(f'<tr><td>{scenes[c["scene"]]} · {colors[c["color"]]}</td><td>{c["layout"]["minSpacing"]:.3f}</td></tr>' for c in report['casts']) + '</table><p><a href="audio-events.json">九组实际播放时刻</a></p>'
    (out / 'audio-events.json').write_text(json.dumps({'auras': [{'color': a['color'], 'sounds': a['sounds']} for a in report['auras']], 'casts': [{'scene': c['scene'], 'color': c['color'], 'sounds': c['sounds']} for c in report['casts']]}, ensure_ascii=False, indent=2))
    (out / 'index.html').write_text(html.replace('<script>', details + '<script>'))
    print('已生成新旧并排图、100%光环裁图、实际音效记录')
