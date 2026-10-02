# 第二章浮岛贴图（ART-45）

工具：内置 image_gen；每件仅生成一次，无候选。提示词按「共用开头＋该件主体＋共用反向」原文拼接，不添加描述。

参考图：每张均输入 `public/art/sky/ch1/rock-large-pine.png`，用于画法、视角、岩石材质和光照；`island-houses.png`、`island-tower.png`、`island-falls.png` 另输入 `public/art/sky/ch1-low/roof-a.png`，用于瓦顶材质。

交付画布：浮岛 1024×1536，桥 1536×1024；透明 PNG。生成原图尺寸全部符合目标，直接复制并保留原始 alpha，未裁切或缩放。

## island-houses.png

```text
Environment sprite for a vertical-scrolling top-down shmup. Match the reference image exactly in painting style, lighting and camera: three-quarter view from slightly above, Chinese guofeng digital thick-paint with soft ink-wash edges, warm ochre rock faces, muted teal moss, paper-white mist, light from the upper left, bright, airy and low-contrast. One complete floating island centered, its broken root hanging toward the bottom of the image, true transparent background, 10% empty margin. At most three big masses, readable when shrunk to 200 px. A medium floating island carrying a small water-town: two Chinese houses with grey-blue tile roofs and white walls standing close together on the left, a short wooden jetty reaching out to the right with two mooring posts, one small willow. Avoid: night, dark overall tone, large black shadow areas, muddy details, dense repeating texture, many tiny houses, crowded composition, clouds or sky behind the object, ground plane, cast shadow on background, text, seal stamp, watermark, frame, 3D render, low poly, flat vector, cartoon outline, photo. No vermilion, azure or violet color areas.
```

## island-tower.png

```text
Environment sprite for a vertical-scrolling top-down shmup. Match the reference image exactly in painting style, lighting and camera: three-quarter view from slightly above, Chinese guofeng digital thick-paint with soft ink-wash edges, warm ochre rock faces, muted teal moss, paper-white mist, light from the upper left, bright, airy and low-contrast. One complete floating island centered, its broken root hanging toward the bottom of the image, true transparent background, 10% empty margin. At most three big masses, readable when shrunk to 200 px. A tall narrow floating rock with one slim three-storey watchtower on top, grey-blue tile roofs, a few pale rice-paper lanterns hanging from the eaves, lanterns unlit with no glow. Avoid: night, dark overall tone, large black shadow areas, muddy details, dense repeating texture, many tiny houses, crowded composition, clouds or sky behind the object, ground plane, cast shadow on background, text, seal stamp, watermark, frame, 3D render, low poly, flat vector, cartoon outline, photo. No vermilion, azure or violet color areas.
```

## island-falls.png

```text
Environment sprite for a vertical-scrolling top-down shmup. Match the reference image exactly in painting style, lighting and camera: three-quarter view from slightly above, Chinese guofeng digital thick-paint with soft ink-wash edges, warm ochre rock faces, muted teal moss, paper-white mist, light from the upper left, bright, airy and low-contrast. One complete floating island centered, its broken root hanging toward the bottom of the image, true transparent background, 10% empty margin. At most three big masses, readable when shrunk to 200 px. A wide floating island with a stream across its top that pours off the front edge as one clean vertical waterfall ribbon into the void below; a small water-mill house beside the stream. Avoid: night, dark overall tone, large black shadow areas, muddy details, dense repeating texture, many tiny houses, crowded composition, clouds or sky behind the object, ground plane, cast shadow on background, text, seal stamp, watermark, frame, 3D render, low poly, flat vector, cartoon outline, photo. No vermilion, azure or violet color areas.
```

## bridge.png

```text
Environment sprite for a vertical-scrolling top-down shmup. Match the reference image exactly in painting style, lighting and camera: three-quarter view from slightly above, Chinese guofeng digital thick-paint with soft ink-wash edges, warm ochre rock faces, muted teal moss, paper-white mist, light from the upper left, bright, airy and low-contrast. One complete floating island centered, its broken root hanging toward the bottom of the image, true transparent background, 10% empty margin. At most three big masses, readable when shrunk to 200 px. A long slender stone arch bridge spanning between two small floating rocks, horizontal composition, a single lantern post at the middle of the deck, lantern unlit with no glow. Avoid: night, dark overall tone, large black shadow areas, muddy details, dense repeating texture, many tiny houses, crowded composition, clouds or sky behind the object, ground plane, cast shadow on background, text, seal stamp, watermark, frame, 3D render, low poly, flat vector, cartoon outline, photo. No vermilion, azure or violet color areas.
```

## lantern-rock.png

```text
Environment sprite for a vertical-scrolling top-down shmup. Match the reference image exactly in painting style, lighting and camera: three-quarter view from slightly above, Chinese guofeng digital thick-paint with soft ink-wash edges, warm ochre rock faces, muted teal moss, paper-white mist, light from the upper left, bright, airy and low-contrast. One complete floating island centered, its broken root hanging toward the bottom of the image, true transparent background, 10% empty margin. At most three big masses, readable when shrunk to 200 px. A small floating rock with a tall wooden lantern pole on top, five pale rice-paper lanterns hanging in a row from a curved arm, lanterns unlit with no glow. Avoid: night, dark overall tone, large black shadow areas, muddy details, dense repeating texture, many tiny houses, crowded composition, clouds or sky behind the object, ground plane, cast shadow on background, text, seal stamp, watermark, frame, 3D render, low poly, flat vector, cartoon outline, photo. No vermilion, azure or violet color areas.
```

## mirage-town.png

```text
Environment sprite for a vertical-scrolling top-down shmup. Match the reference image exactly in painting style, lighting and camera: three-quarter view from slightly above, Chinese guofeng digital thick-paint with soft ink-wash edges, warm ochre rock faces, muted teal moss, paper-white mist, light from the upper left, bright, airy and low-contrast. One complete floating island centered, its broken root hanging toward the bottom of the image, true transparent background, 10% empty margin. At most three big masses, readable when shrunk to 200 px. A mirage of a harbour town on a floating island, houses and a slim tower, painted as a pale translucent ghost image in very light ink and paper white with faint warm haze, edges dissolving into mist. Keep it light and low-contrast. Avoid: night, dark overall tone, large black shadow areas, muddy details, dense repeating texture, many tiny houses, crowded composition, clouds or sky behind the object, ground plane, cast shadow on background, text, seal stamp, watermark, frame, 3D render, low poly, flat vector, cartoon outline, photo. No vermilion, azure or violet color areas.
```
