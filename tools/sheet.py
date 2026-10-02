"""sheet.mjs 的 Pillow 实现。输入原图只读，输出目录须为空。"""
import argparse
import json
import math
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops, ImageStat


def centroid(im):
    a = im.getchannel('A')
    hist = a.histogram()
    mass = sum(i * n for i, n in enumerate(hist))
    if not mass:
        return None
    px = a.load()
    xsum = ysum = 0
    for y in range(a.height):
        for x in range(a.width):
            v = px[x, y]
            xsum += (x + .5) * v
            ysum += (y + .5) * v
    return [xsum / mass, ysum / mass]


def components(im, columns, rows, count):
    """透明连通主体加邻近小岛。主体数有歧义时拒绝猜测。"""
    a = im.getchannel('A'); w, h = im.size
    data = bytearray(1 if v > 24 else 0 for v in a.tobytes())
    blobs = []
    for k in range(len(data)):
        if data[k] != 1:
            continue
        data[k] = 0; queue = deque([k]); xs = []; ys = []
        while queue:
            j = queue.popleft(); x = j % w; y = j // w
            xs.append(x); ys.append(y)
            for xx, yy in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                if 0 <= xx < w and 0 <= yy < h:
                    idx = yy*w+xx
                    if data[idx] == 1:
                        data[idx] = 0; queue.append(idx)
        if len(xs) >= 5:
            blobs.append([len(xs), [min(xs), min(ys), max(xs)+1, max(ys)+1], [sum(xs)/len(xs), sum(ys)/len(ys)]])
    if not blobs:
        raise ValueError('连通区域没有可识别主体')
    threshold = max(b[0] for b in blobs) * .08
    main = [b for b in blobs if b[0] >= threshold]
    if len(main) != count:
        raise ValueError(f'连通主体 {len(main)} 个，预期 {count}；请人工裁切或用 --split=grid，禁止自动补帧')
    main.sort(key=lambda b: b[2][1])
    ordered = []
    for row in range(rows):
        group = main[row*columns:min((row+1)*columns, count)]
        ordered.extend(sorted(group, key=lambda b: b[2][0]))
    boxes = [b[1][:] for b in ordered]
    for blob in blobs:
        if blob in main:
            continue
        idx = min(range(len(main)), key=lambda i: math.dist(blob[2], ordered[i][2]))
        # 小岛须接近主体，避免把邻格噪声当成轮廓。
        if math.dist(blob[2], ordered[idx][2]) > max(w/columns, h/rows)*.6:
            continue
        box = boxes[idx]; b = blob[1]
        box[:] = [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
    # 保留抗锯齿/细发光边；矩形重叠表示无法可靠切分。
    boxes = [[max(0,x0-4), max(0,y0-4), min(w,x1+4), min(h,y1+4)] for x0,y0,x1,y1 in boxes]
    for i, b in enumerate(boxes):
        if any(max(b[0],q[0]) < min(b[2],q[2]) and max(b[1],q[1]) < min(b[3],q[3]) for q in boxes[:i]):
            raise ValueError('连通主体裁切框重叠，需要人工处理')
    return boxes


def measure(im):
    a = im.getchannel('A'); bbox = a.getbbox()
    semi = white = gray = 0
    for r,g,b,v in (im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata()):
        if 8 <= v <= 247:
            semi += 1
            if min(r,g,b) >= 220 and max(r,g,b)-min(r,g,b) <= 25:
                white += 1
            elif 65 <= min(r,g,b) and max(r,g,b) <= 220 and max(r,g,b)-min(r,g,b) <= 16:
                gray += 1
    return {'bbox': bbox, 'centroid': centroid(im), 'alphaRange': a.getextrema(),
            'whiteEdgeCandidates': white, 'grayEdgeCandidates': gray, 'semiTransparentPixels': semi}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source'); p.add_argument('--out', required=True)
    for name, default in [('columns',None), ('rows',None), ('count',None), ('size',256)]:
        p.add_argument('--'+name, type=int, default=default, required=name in ['columns','rows'])
    p.add_argument('--anchor', choices=['centroid','bottom','point'], default='centroid')
    p.add_argument('--point', default='.5,.5'); p.add_argument('--points', help='逐帧格内像素锚点 JSON 数组')
    p.add_argument('--alpha-floor', type=int, default=8); p.add_argument('--fps', type=float, default=12)
    p.add_argument('--mode', choices=['loop','once','pingpong'], default='loop')
    p.add_argument('--split', choices=['auto','grid','components'], default='auto')
    p.add_argument('--events', default='')
    opt = p.parse_args(); count = opt.count or opt.columns*opt.rows
    if min(opt.columns,opt.rows,opt.size,count) < 1 or count > opt.columns*opt.rows or not math.isfinite(opt.fps) or opt.fps <= 0:
        raise ValueError('网格、帧数、尺寸、帧率无效')
    point = list(map(float,opt.point.split(',')))
    if len(point)!=2 or any(not math.isfinite(v) or v<0 or v>1 for v in point):
        raise ValueError('指定点须为两个 0..1 数值')
    points=json.loads(Path(opt.points).read_text()) if opt.points else None
    if points is not None and (opt.anchor!='point' or len(points)!=count or any(len(a)!=2 or any(not math.isfinite(v) for v in a) for a in points)):
        raise ValueError('逐帧锚点须与帧数一致且使用 point')
    if not 0 <= opt.alpha_floor < 255: raise ValueError('alpha-floor 须为 0..254')
    events = [{'frame':int(e.split(':',1)[0]),'name':e.split(':',1)[1]} for e in opt.events.split(',') if e]
    if any(e['frame'] < 0 or e['frame'] >= count or not e['name'] for e in events):
        raise ValueError('关键帧事件超出范围或无名称')
    src = Path(opt.source).resolve(); out = Path(opt.out).resolve()
    if out == src.parent or out.exists() and any(out.iterdir()):
        raise ValueError('输出目录须为空，不能覆盖原图或旧产物')
    with Image.open(src) as raw:
        if raw.format != 'PNG' or ('A' not in raw.getbands() and 'transparency' not in raw.info):
            raise ValueError('输入须为有透明通道的 PNG')
        im = raw.convert('RGBA')
    if im.getchannel('A').getextrema()[0] != 0:
        raise ValueError('输入没有全透明像素，需重新生图')
    if im.getchannel('A').getextrema()[1] <= opt.alpha_floor:
        raise ValueError('输入全透明或仅含近透明噪点')
    # 清除生图近透明噪点；原图保留，阈值写入元数据。
    im.putalpha(im.getchannel('A').point(lambda a: a if a > opt.alpha_floor else 0))
    w,h = im.size
    boxes = [[round(col*w/opt.columns),round(row*h/opt.rows),round((col+1)*w/opt.columns),round((row+1)*h/opt.rows)]
             for row in range(opt.rows) for col in range(opt.columns)][:count]
    grid_boxes = [b[:] for b in boxes]
    touched = []
    for i,box in enumerate(boxes):
        alpha = im.crop(box).getchannel('A'); aw,ah=alpha.size
        if any(max(alpha.crop(b).getextrema()) > 24 for b in [(0,0,aw,1),(0,ah-1,aw,ah),(0,0,1,ah),(aw-1,0,aw,ah)]):
            touched.append(i)
    method = 'grid'; warnings=[]
    if opt.split == 'components' or opt.split == 'auto' and touched:
        try:
            boxes = components(im,opt.columns,opt.rows,count); method='components'
        except ValueError as exc:
            if opt.split == 'components': raise
            warnings.append(str(exc)); warnings.append('保留网格切分，触边帧需要审图')
    cuts=[]; anchors=[]; measurements=[]
    for i,box in enumerate(boxes):
        cell = im.crop(box); m=measure(cell); measurements.append(m)
        bbox = m['bbox']; cut=cell.crop(bbox) if bbox else Image.new('RGBA',(1,1))
        if opt.anchor == 'centroid':
            a=m['centroid'] or [cell.width/2,cell.height/2]
        elif opt.anchor == 'bottom':
            a=[(bbox[0]+bbox[2])/2,bbox[3]] if bbox else [cell.width/2,cell.height/2]
        else:
            # 指定点以原网格为参照，连通区域重新裁切后仍保持同一原图位置。
            grid=grid_boxes[i]
            original=points[i] if points is not None else [point[0]*(grid[2]-grid[0]),point[1]*(grid[3]-grid[1])]
            a=[grid[0]+original[0]-box[0],grid[1]+original[1]-box[1]]
        anchors.append([a[0]-(bbox[0] if bbox else 0),a[1]-(bbox[1] if bbox else 0)])
        cuts.append(cut)
    target=[opt.size*.5,opt.size*(.88 if opt.anchor=='bottom' else .5)]
    margin=opt.size*.06
    limits=[]
    for cut,a in zip(cuts,anchors):
        for extent,space in [(a[0],target[0]-margin),(cut.width-a[0],opt.size-target[0]-margin),
                             (a[1],target[1]-margin),(cut.height-a[1],opt.size-target[1]-margin)]:
            if extent>0: limits.append(space/extent)
    scale=min(limits); aligned=[]; records=[]
    for i,(cut,a,m,box) in enumerate(zip(cuts,anchors,measurements,boxes)):
        size=[max(1,round(cut.width*scale)),max(1,round(cut.height*scale))]
        resized=cut.resize(size,Image.Resampling.LANCZOS)
        factors=[size[0]/cut.width,size[1]/cut.height]
        offset=[round(target[k]-a[k]*factors[k]) for k in range(2)]
        frame=Image.new('RGBA',(opt.size,opt.size));frame.alpha_composite(resized,tuple(offset));aligned.append(frame)
        actual=[offset[k]+a[k]*factors[k] for k in range(2)]
        records.append({'index':i,'file':f'{i:02d}.png','sourceRect':box,'trim':m['bbox'],'sourceAnchor':a,
                        'offset':offset,'alignedAnchor':actual,'anchorResidualPx':math.dist(actual,target),
                        'aligned':measure(frame),'source':m})
    def difference(a,b):
        # 透明区域 RGB 不参与；预乘后比较全格均值。
        def premul(x):
            rgb=x.convert('RGB'); alpha=x.getchannel('A'); mask=Image.merge('RGB',(alpha,alpha,alpha))
            return ImageChops.multiply(rgb,mask)
        return sum(ImageStat.Stat(ImageChops.difference(premul(a),premul(b))).mean)/3/255
    changes=[difference(aligned[i],aligned[i+1]) for i in range(count-1)]
    seam=difference(aligned[-1],aligned[0])
    packed=Image.new('RGBA',(opt.size*opt.columns,opt.size*opt.rows))
    for i,frame in enumerate(aligned): packed.alpha_composite(frame,((i%opt.columns)*opt.size,(i//opt.columns)*opt.size))
    pairs=[r['alignedAnchor'] for r in records]
    jitter=math.hypot(max(x[0] for x in pairs)-min(x[0] for x in pairs),max(x[1] for x in pairs)-min(x[1] for x in pairs))
    metadata={'version':1,'source':src.name,'alphaFloor':opt.alpha_floor,'columns':opt.columns,'rows':opt.rows,'count':count,'fps':opt.fps,'mode':opt.mode,
              'events':events,'anchor':opt.anchor,'anchorPixel':target,'frameSize':[opt.size,opt.size],
              'commonScale':scale,'splitMethod':method,'gridTouchingFrames':touched,'warnings':warnings,
              'jitterPx':jitter,'maxAnchorResidualPx':max(r['anchorResidualPx'] for r in records),
              'seam':{'firstLastPremultipliedMAE':seam,'adjacentMeanMAE':sum(changes)/len(changes) if changes else 0,'adjacentMAE':changes},
              'frames':records}
    out.mkdir(parents=True,exist_ok=True)
    for i,frame in enumerate(aligned): frame.save(out/f'{i:02d}.png')
    packed.save(out/'sheet.png'); (out/'sheet.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'out':str(out),'count':count,'splitMethod':method,'jitterPx':jitter,'warnings':warnings},ensure_ascii=False))


if __name__ == '__main__':
    main()
