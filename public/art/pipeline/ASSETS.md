# 动画管线演示切片

复用 `public/art/companions/yaoque.png` 的第二稿，原图保留。原生图提示词与来源见 `public/art/companions/ASSETS.md`。
三片均为技术演示用矩形切片，版本 `p0-demo-v1`，美术状态为待审。矩形边缘和翼根缺少专门分件重绘，正式角色需要美术规格卡与审图。

裁切以原图像素为单位，然后以 alpha>0 自动裁边。使用 `tools/art-check.mjs`：

```sh
node tools/art-check.mjs public/art/companions/yaoque.png --out=/tmp/p0-01-body --rect=563,270,128,376 --anchor=origin:625,520
node tools/art-check.mjs public/art/companions/yaoque.png --out=/tmp/p0-01-wing --rect=165,195,400,490 --anchor=root:558,530
node tools/art-check.mjs public/art/companions/yaoque.png --out=/tmp/p0-01-tail --rect=418,646,430,430 --anchor=root:625,646
```

| 文件 | 裁边后尺寸 | 原图裁边起点 | 原点相对裁边矩形中心（像素） |
|---|---|---|---|
| bird-body.png | 128×360 | 563,286 | -2,54 |
| bird-wing.png | 386×474 | 179,211 | 186,82 |
| bird-tail.png | 413×413 | 422,646 | -3.5,-206.5 |

演示中每像素为 0.55 逻辑单位，原点写入 `SpriteDef.pivot`；翅膀与尾巴的 `anchors.root=[0,0]`。挂点与尺寸声明见 `src/art/sprites_pipeline.ts`。
左翼图片镜像复用于右翼。小敌机直接复用青璃原图，身份与造型仅用于检查图片通道。
