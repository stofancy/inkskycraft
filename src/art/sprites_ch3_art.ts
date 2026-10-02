import type { SpriteDef, SpriteSheet } from './types';
import type { Enemy } from '../game/enemy';

interface Meta extends SpriteSheet {
  runtimeSize: [number, number];
  pivot: [number, number];
  anchors: Record<string, [number, number]>;
}

const metas = import.meta.glob('/public/art/enemies/ch3/*/sheet.json', {
  eager: true, import: 'default',
}) as Record<string, Meta>;

/** 完整精灵 id 同时覆盖敌机与随后交付的雷公、鲲鹏部件。 */
export function applyCh3Art(all: SpriteDef[]): void {
  for (const def of all) {
    const meta = metas[`/public/art/enemies/ch3/${def.id}/sheet.json`];
    if (!meta) continue;
    def.maskSource = { ...def, id: `mask_${def.id}` };
    [def.w, def.h] = meta.runtimeSize;
    def.pivot = meta.pivot;
    // 原玩法挂点优先，sheet 可补充新的美术挂点。
    def.anchors = { ...meta.anchors, ...def.anchors };
    // 全部分镜在启动时烘焙，实体运行期间只选择帧。
    def.sheet = {
      image: meta.image, columns: meta.columns, rows: meta.rows,
      count: meta.count, fps: meta.fps, mode: 'loop',
    };
    def.frames = meta.count;
    delete def.image;
    delete def.imageScale;
    delete def.glow;
  }
}

/** 同批出生的实体按编号错帧，沿用实体年龄和作用域的暂停/销毁。 */
export function startCh3Animation(e: Enemy): void {
  const meta = metas[`/public/art/enemies/ch3/${e.info.id}/sheet.json`];
  if (!meta) return;
  e.data.manualFrame = true;
  e.run((function* () {
    while (!e.dead) {
      e.frame = (Math.floor(e.age * meta.fps) + e.id % meta.count) % meta.count;
      yield;
    }
  })());
}
