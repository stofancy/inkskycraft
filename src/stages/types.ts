import type { Co, G } from '../game/api';
import type { MusicId } from '../types';

export interface StageDef {
  /** 1..3 */
  index: number;
  /** 标题卡大字，如「第一幕 · 墨山晓」。 */
  title: string;
  /** 标题卡副标题，如「MOUNTAINS AT DAWN」。 */
  subtitle: string;
  /** HUD 显示的短名，如「墨山晓」。 */
  name: string;
  /** 背景 id（src/bg/index.ts 的 BACKGROUNDS 键）。 */
  bg: string;
  music: MusicId;
  /** 普通本体和独立行为类型的可审计内容基线。 */
  content?: { baselineBodies: number; normalBodies: number; baselineTypes: number; enemyTypes: string[]; encounters: number; chapters: string[] };
  /** 关卡脚本：从开场到 Boss 被击破。返回即判定过关。 */
  script(g: G): Co;
}
