import type { SpriteDef } from './types';

export type SpriteImages = Map<string, HTMLImageElement>;

/** 从模块所在的应用根目录加载，预览页和相对子路径部署共用。 */
export function artURL(path: string): string {
  if (!/^\/?art\//.test(path) || path.split('/').includes('..')) throw new Error(`资产路径须位于 public/art：${path}`);
  const root = new URL(import.meta.env.DEV ? '../../' : '../', import.meta.url);
  return new URL(path.replace(/^\//, ''), root).href;
}

export async function loadSpriteImages(defs: SpriteDef[]): Promise<SpriteImages> {
  defs.forEach(spriteFrames);
  const paths = new Set(defs.flatMap(d => d.sheet ? [d.sheet.image] : d.image ? typeof d.image === 'string' ? [d.image] : d.image : []));
  const images: SpriteImages = new Map();
  await Promise.all([...paths].map(async path => {
    const image = new Image();
    try {
      image.src = artURL(path);
      await image.decode();
      images.set(path, image);
    } catch (error) {
      console.warn(`图片加载失败，使用绘制回退：${path}`, error);
    }
  }));
  return images;
}

/** 烘焙与精灵预览共用图片来源和回退规则。画布原点仍为矩形中心。 */
export function drawSprite(ctx: CanvasRenderingContext2D, def: SpriteDef, frame: number, images: SpriteImages): void {
  const sheet = def.sheet;
  const path = sheet?.image ?? (typeof def.image === 'string' ? def.image : def.image?.[frame % def.image.length]);
  const image = path ? images.get(path) : undefined;
  const scale = def.imageScale?.[frame] ?? 1;
  if (image && sheet) {
    const index = ((Math.floor(frame) % sheet.count) + sheet.count) % sheet.count;
    const col = index % sheet.columns, row = Math.floor(index / sheet.columns);
    const x0 = Math.round(col * image.width / sheet.columns), x1 = Math.round((col + 1) * image.width / sheet.columns);
    const y0 = Math.round(row * image.height / sheet.rows), y1 = Math.round((row + 1) * image.height / sheet.rows);
    ctx.drawImage(image, x0, y0, x1 - x0, y1 - y0, -def.w * scale / 2, -def.h * scale / 2, def.w * scale, def.h * scale);
  } else if (image) ctx.drawImage(image, -def.w * scale / 2, -def.h * scale / 2, def.w * scale, def.h * scale);
  else if (def.draw) def.draw(ctx, frame);
  else {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(-def.w / 2, -def.h / 2, def.w, def.h);
    ctx.fillStyle = '#141414';
    ctx.fillRect(-def.w / 4, -def.h / 4, def.w / 2, def.h / 2);
  }
}

export function spriteFrames(def: SpriteDef): number {
  if (def.sheet) {
    const s = def.sheet;
    if (def.image || !Number.isInteger(s.columns) || s.columns < 1 || !Number.isInteger(s.rows) || s.rows < 1
      || !Number.isInteger(s.count) || s.count < 1 || s.count > s.columns * s.rows
      || !Number.isFinite(s.fps) || s.fps <= 0 || !['loop', 'once', 'pingpong'].includes(s.mode)
      || (def.frames !== undefined && def.frames !== s.count)) throw new Error(`精灵 ${def.id} 分镜元数据无效`);
    return s.count;
  }
  return def.frames ?? (Array.isArray(def.image) ? def.image.length : 1);
}
