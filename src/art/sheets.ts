import { artURL, spriteFrames } from './images';
import type { SpriteDef, SpriteSheet } from './types';

/** 读取 sheet.mjs 的产物，保留元数据帧率、循环方式、关键帧与锚点。 */
export async function loadSheetSprite(id: string, directory: string, w: number, h = w): Promise<SpriteDef> {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) throw new Error('精灵尺寸无效');
  const response = await fetch(artURL(`${directory}/sheet.json`));
  if (!response.ok) throw new Error(`分镜元数据读取失败：${directory} (${response.status})`);
  const m = await response.json();
  if (!Array.isArray(m.frameSize) || m.frameSize.length !== 2 || m.frameSize.some((v: number) => !Number.isFinite(v) || v <= 0)
    || !Array.isArray(m.anchorPixel) || m.anchorPixel.length !== 2 || m.anchorPixel.some((v: number) => !Number.isFinite(v))) throw new Error('分镜锚点元数据无效');
  const sheet: SpriteSheet = { image: `${directory}/sheet.png`, columns: m.columns, rows: m.rows, count: m.count,
    fps: m.fps, mode: m.mode, events: m.events };
  const def: SpriteDef = { id, w, h, sheet,
    pivot: [(m.anchorPixel[0] / m.frameSize[0] - .5) * w, (m.anchorPixel[1] / m.frameSize[1] - .5) * h],
    anchors: { root: [0, 0] }, radius: 0 };
  spriteFrames(def);
  return def;
}
