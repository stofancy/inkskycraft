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
  /** 普通敌单次发射量倍率（敌机变多时单只少发，总弹量只小幅上升）。 */
  fire: number;
  /** 同屏普通敌弹上限。 */
  bulletCap: number;
}

/** 刷怪表基数：旧刷怪表数量 × 1.8 = 新的 1 倍（旧简单档实际出怪量的 2 倍）。三档倍数 1 / 1.5 / 2.2。 */
export const COUNT_BASE = 1.8;

export const DIFFS: Record<Difficulty, DiffCfg> = {
  easy: { name: '简单', speed: 0.7, count: 0.5, enemyCount: COUNT_BASE * 1, quantity: COUNT_BASE * 1, aggression: 0.65, intelligence: 0, hp: 0.7, rank: 0, lives: 5, bombs: 4, warn: 1.3, fire: 0.7, bulletCap: 60 },
  normal: { name: '普通', speed: 0.82, count: 0.7, enemyCount: COUNT_BASE * 1.5, quantity: COUNT_BASE * 1.5, aggression: 1, intelligence: 0.5, hp: 0.8, rank: 0.5, lives: 3, bombs: 3, warn: 1.15, fire: 0.6, bulletCap: 90 },
  hard: { name: '困难', speed: 1, count: 1, enemyCount: COUNT_BASE * 2.2, quantity: COUNT_BASE * 2.2, aggression: 1.3, intelligence: 1, hp: 0.9, rank: 1, lives: 3, bombs: 3, warn: 1, fire: 0.5, bulletCap: 120 },
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
