// 难度档位：数值表 + localStorage 存取。现有数值 = 困难。
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DiffCfg {
  name: string;
  /** 敌弹速度倍率。 */
  speed: number;
  /** fan / ring 数量倍率。 */
  count: number;
  /** 普通敌本体数量倍率，与弹量独立。 */
  enemyCount: number;
  quantity: number;
  /** 攻击欲望：攻击节拍倍率。 */
  aggression: number;
  /** 0 保守追旧位、0.5 部分协同、1 预测夹击。 */
  intelligence: number;
  /** 敌人 hp 倍率（含 Boss）。 */
  hp: number;
  /** rank 系数。 */
  rank: number;
  lives: number;
  bombs: number;
  /** 激光预警时间倍率。 */
  warn: number;
}

export const DIFFS: Record<Difficulty, DiffCfg> = {
  easy: { name: '简单', speed: 0.7, count: 0.5, enemyCount: 0.65, quantity: 0.65, aggression: 0.65, intelligence: 0, hp: 0.75, rank: 0, lives: 5, bombs: 4, warn: 1.3 },
  normal: { name: '普通', speed: 0.82, count: 0.7, enemyCount: 1, quantity: 1, aggression: 1, intelligence: 0.5, hp: 0.85, rank: 0.5, lives: 3, bombs: 3, warn: 1.15 },
  hard: { name: '困难', speed: 1, count: 1, enemyCount: 1.25, quantity: 1.25, aggression: 1.3, intelligence: 1, hp: 1, rank: 1, lives: 3, bombs: 3, warn: 1 },
};

export const DIFF_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

const KEY = 'inksky.difficulty.v1';
const valid = (v: unknown): v is Difficulty => v === 'easy' || v === 'normal' || v === 'hard';

export function loadDifficulty(urlValue?: string | null): Difficulty {
  if (valid(urlValue)) return urlValue;
  try {
    const v = localStorage.getItem(KEY);
    if (valid(v)) return v;
  } catch { /* 隐私模式等 */ }
  return DEFAULT_DIFFICULTY;
}

export function saveDifficulty(d: Difficulty): void {
  try { localStorage.setItem(KEY, d); } catch { /* 忽略 */ }
}
