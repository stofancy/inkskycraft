// 第一章正式美术接入：玩家机与敌机分镜。分镜缺失时保留原占位绘制。
import type { SpriteDef } from './types';
import { spriteFrames } from './images';

interface SheetMeta { columns: number; rows: number; count: number; fps: number; mode: 'loop' | 'once' | 'pingpong'; frameSize: number[]; anchorPixel: number[] }
const metas = import.meta.glob('/public/art/{player/xiaoman,enemies/ch1/*}/sheet.json', { eager: true, import: 'default' }) as Record<string, SheetMeta>;

// 现有第一章敌人 -> 新敌机家族（按外形就近）。
export const ENEMY_ART: Record<string, string> = {
  e_hornet: 'hornet', e_sealbee: 'hornet',
  e_crane: 'crane', e_swallow: 'crane',
  e_turtle: 'turtle', e_inksnail: 'turtle',
  e_turret: 'turret', e_turtle_gun: 'turret',
  e_kite: 'kite', e_shieldkite: 'kite',
  e_chariot: 'carrier', e_bellboat: 'carrier', e_bridgebreaker: 'carrier',
  e_mountainape: 'ape',
};
/** 使用分镜的敌机贴图 id；世界更新时据此推进帧。 */
export const SHEETED = new Set<string>();
/** 玩家机分段：待机 0-3 循环，左倾 4-7，右倾 12-15。 */
export const PLAYER_SHEET = { idle: [0, 3], left: [4, 7], right: [12, 15], fps: 10 };

function apply(def: SpriteDef, dir: string, size: number, count?: number): boolean {
  const m = metas[`/public/art/${dir}/sheet.json`];
  if (!m) return false;
  def.sheet = { image: `art/${dir}/sheet.png`, columns: m.columns, rows: m.rows, count: count ?? m.count, fps: m.fps, mode: m.mode };
  def.w = def.h = size;
  def.frames = def.sheet.count;
  delete def.image; delete def.imageScale;
  def.pivot = [(m.anchorPixel[0] / m.frameSize[0] - .5) * size, (m.anchorPixel[1] / m.frameSize[1] - .5) * size];
  spriteFrames(def);
  return true;
}

const RUNTIME: Record<string, [number, number]> = { // 家族 -> [整格逻辑尺寸, 目标主体宽]
  hornet: [54.6, 48], crane: [72.8, 64], turtle: [99.4, 80], turret: [92, 64], kite: [118.7, 96], carrier: [145.6, 128], ape: [127.4, 112],
};

export function applyCh1Art(all: SpriteDef[]): void {
  for (const def of all) {
    if (def.id === 'player') { apply(def, 'player/xiaoman', 145.134); continue; }
    const family = ENEMY_ART[def.id];
    if (!family) continue;
    const [frame, body] = RUNTIME[family];
    // 保持原占位机体的视觉宽度（±），避免碰撞观感突变。
    const k = Math.min(1.15, Math.max(.75, def.w / body));
    if (apply(def, `enemies/ch1/${family}`, frame * k)) SHEETED.add(def.id);
  }
}
