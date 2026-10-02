"""从标准输入接收源码字集，生成本地 WOFF2、CSS 与体积/覆盖报告。"""
import hashlib
import json
import shutil
import sys
from pathlib import Path
try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
    import brotli  # WOFF2 输出依赖；缺少时交给调用方沿用已提交子集。
except ImportError:
    sys.exit(78)

payload = json.load(sys.stdin)
config, corpus = payload['config'], payload['corpus']
source = Path(config['source'])
output = Path('public/fonts')
output.mkdir(parents=True, exist_ok=True)
base = TTFont(source, recalcTimestamp=False)
cmap = base.getBestCmap()
requested = {ord(c) for c in corpus if not c.isspace()} | set(range(32, 127))
# 字体缺少的特殊符号列入报告；现有汉字缺失会阻止构建。
missing = sorted(requested - cmap.keys())
missing_han = [c for c in missing if 0x3400 <= c <= 0x9fff]
fallback = TTFont(config['numericSource'], recalcTimestamp=False)
fallback_chars = set(missing_han) & fallback.getBestCmap().keys()
if set(missing_han) - fallback_chars:
    raise ValueError('字体缺少游戏汉字：' + ''.join(map(chr, set(missing_han)-fallback_chars)))
report = {'source': str(source), 'sourceBytes': source.stat().st_size,
          'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'requestedCharacters': len(requested), 'missingSymbols': ''.join(map(chr, sorted(set(missing)-fallback_chars))),
          'upstream': config['upstream'], 'coveredCharacters': ''.join(map(chr, sorted((requested & cmap.keys()) | fallback_chars))), 'outputs': []}
css = []
for label, family, chars, filename in [
    ('text', config['roles']['body'], requested, 'ui-text.woff2'),
    ('numbers', config['roles']['numbers'], set(map(ord, config['numericText'])), 'ui-numbers.woff2'),
    *([('fallback', config['roles']['body'], fallback_chars, 'ui-fallback.woff2')] if fallback_chars else []),
]:
    role_source = Path(config['numericSource']) if label in ('numbers','fallback') else source
    font = TTFont(role_source, recalcTimestamp=False)
    role_cmap = font.getBestCmap()
    options = subset.Options()
    options.flavor = 'woff2'
    options.recalc_timestamp = False
    options.name_IDs = ['*']  # 保留版权与 OFL 元数据。
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=chars & role_cmap.keys())
    worker.subset(font)
    # 子集作为修改版使用独立家族名，避免保留字体名称问题。
    for name in font['name'].names:
        if name.nameID in (1, 2, 3, 4, 6, 16, 17):
            value = 'Regular' if name.nameID in (2, 17) else family
            name.string = value.encode(name.getEncoding())
    font.flavor = 'woff2'
    target = output / filename
    font.save(target, reorderTables=True)
    report['outputs'].append({'role': label, 'family': family, 'file': str(target),
                              'source': str(role_source),
                              'sourceSha256': hashlib.sha256(role_source.read_bytes()).hexdigest(),
                              'bytes': target.stat().st_size, 'characters': len(chars & role_cmap.keys())})
    unicode_range = (';unicode-range:' + ','.join(f'U+{c:X}' for c in sorted(chars))) if label=='fallback' else ''
    css.append(f'@font-face{{font-family:"{family}";src:url("/fonts/{filename}") format("woff2");font-style:normal;font-weight:400;font-display:swap{unicode_range}}}')
# 标题和正文暂用同一占位家族，G-1 后在同一配置内替换。
if config['roles']['title'] != config['roles']['body']:
    unicode_range = (';unicode-range:' + ','.join(f'U+{c:X}' for c in sorted(chars))) if label=='fallback' else ''
    css.append(f'@font-face{{font-family:"{config["roles"]["title"]}";src:url("/fonts/ui-text.woff2") format("woff2");font-style:normal;font-weight:400;font-display:swap{unicode_range}}}')
css.append('.ik{--font-title:"' + config['roles']['title'] + '",serif;--font-body:"' + config['roles']['body'] + '",serif;--font-number:"' + config['roles']['numbers'] + '",monospace}')
Path('src/ui/fonts.ts').write_text('// 由 npm run fonts:subset 生成；修改 tools/fonts/config.json。\nexport const FONT_CSS = ' + json.dumps('\n'.join(css), ensure_ascii=False) + ';\n')
shutil.copyfile(config['license'], output / 'OFL.txt')
shutil.copyfile(config['numericLicense'], output / 'Noto-OFL.txt')
Path('assets/fonts/subset-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
