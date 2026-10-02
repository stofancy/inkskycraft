// 关卡脚本与敌人 AI 使用的游戏接口。关卡子代理只需读这个文件和 enemy.ts / bullets.ts 的类型。
import type { Rng } from '../core/math';
import type { Co } from '../core/tasks';
import type { DialogueActor, MusicId, Sfx } from '../types';
import type { DamageSource } from '../types';
import type { DiffCfg } from '../core/difficulty';
import type { Bullet, BulletStyle } from './bullets';
import type { Enemy, EnemyDef, ExplosionSize, ItemKind } from './enemy';

export type { Co };
export type ExplosionPalette = 'neon' | 'fire' | 'ink' | 'cyan' | 'violet';
export interface ChallengeOpts { action: 'brush' | 'bomb' | 'focus'; title: string; hint: string; duration: number }
export interface ForceOpts { x: number; y: number; radius: number; strength: number; duration: number; mode: 'attract' | 'repel' | 'wind'; vx?: number; vy?: number }

/** 敌方激光。 */
export interface LaserOpts {
  /** 长度（单位），默认 1600（贯穿全屏）。 */
  length?: number;
  /** 光束半宽（单位），默认 14。判定半宽约为 0.6 倍。 */
  width?: number;
  /** 预警时长（秒，只显示虚线、无判定），默认 0.8。 */
  warn?: number;
  /** 发射持续时长（秒），默认 1.2。 */
  duration?: number;
  color?: 'cyan' | 'magenta' | 'violet' | 'amber' | 'red' | 'gold';
  /** 旋转角速度（弧度/秒），发射期间与预警期间都生效。 */
  sweep?: number;
  /** 跟随某个敌人（及其挂点）移动；敌人死亡时激光立即消失。 */
  follow?: Enemy;
  anchor?: string;
  /** 跟随时角度是否随敌人旋转（加到 angle 上），默认 false。 */
  followAngle?: boolean;
}

export interface Laser {
  x: number;
  y: number;
  angle: number;
  readonly dead: boolean;
  kill(): void;
}

export interface Fx {
  /** 爆炸。palette：'neon' 蚀阵营（默认），'fire' 火焰，'ink' 墨。 */
  explosion(x: number, y: number, size: ExplosionSize, palette?: ExplosionPalette): void;
  /** 冲击波（屏幕扭曲环）。 */
  shockwave(x: number, y: number, radius: number, strength?: number, duration?: number): void;
  /** 闪白，amount 0..1。 */
  flash(amount: number, color?: [number, number, number]): void;
  /** 震屏，amount 约 0..1（1 为极强）。 */
  shake(amount: number): void;
  /** 在墨流体中泼一团墨（带颜色可选）。 */
  ink(x: number, y: number, radius: number, density?: number, color?: [number, number, number]): void;
  /** 在墨流体中注入速度（吹动墨）。 */
  push(x: number, y: number, vx: number, vy: number, radius: number): void;
  /** 发光粒子爆散（充能、登场等），color 为线性 HDR。 */
  burst(x: number, y: number, count: number, speed: number, color: [number, number, number], life?: number): void;
  /** 向中心汇聚的充能粒子，持续 sec 秒。 */
  charge(x: number, y: number, radius: number, sec: number, color: [number, number, number]): void;
  /** 色差强度脉冲 0..1。 */
  aberration(amount: number): void;
}

export interface PhaseOpts {
  /** 本阶段血量。 */
  hp: number;
  /** 时限（秒），超时直接进入下一阶段（无奖励），默认 60。 */
  time?: number;
  /** 阶段名（显示为字幕，可选，如「符·朱雀焚天」风格的招式名）。 */
  name?: string;
}

export interface BossOpts {
  /** 1起算；Boss脚本从此阶段开始，省略为1。 */
  startPhase?: number;
  /** 是否显示警告演出，默认 true。中 Boss 可设 false。 */
  warning?: boolean;
  /** 警告副标题。 */
  subtitle?: string;
  /** 是否切换 Boss 音乐，默认 true。 */
  music?: boolean;
  /** 同一Boss换形，旧躯体静默退场，保留音乐，不播击破结算。 */
  transition?: boolean;
}

/**
 * 游戏接口。关卡脚本 `script(g)` 与敌人 `ai(e, g)` 都拿到同一个 g。
 * 坐标：游戏区 900×1200，y 向下；角度为弧度，0 = 向右，PI/2 = 向下（朝玩家方向）。
 * 时间：秒，受「一笔」子弹时间缩放影响（协程里的 wait 自动适配）。
 */
export interface G {
  /** 关卡已进行时间（秒）。 */
  readonly t: number;
  /** 本帧时长（秒，已缩放）。 */
  readonly dt: number;
  /** 累计滚动距离（单位）。 */
  readonly scroll: number;
  /** ink 为墨量 0..1，可写（如终幕自动补满）。 */
  readonly player: { readonly x: number; readonly y: number; readonly alive: boolean; ink: number };
  /** 一笔状态：active 为正在落笔（子弹时间中）；pts 为本笔点列 [x0,y0,x1,y1,…]，末两项是笔尖。 */
  readonly brush: { readonly active: boolean; readonly pts: readonly number[] };
  readonly rng: Rng;
  /** 难度等级 0..1，随关卡推进与玩家火力略升，可用于调节弹量/弹速。 */
  readonly rank: number;
  readonly difficulty: DiffCfg;
  readonly fx: Fx;

  // ---------- 协程 ----------
  wait(sec: number): Co;
  frames(n: number): Co;
  /** 等待条件成立或超时。 */
  until(cond: () => boolean, timeout?: number): Co;
  /** 在当前作用域并行启动协程（作用域结束时自动取消）。 */
  fork(co: Co): Co;
  /** 并行运行，全部结束后返回。 */
  all(...cos: Co[]): Co;

  // ---------- 敌人 ----------
  /** 生成敌人并启动其 ai。init 在 ai 启动前调用（可设置速度、data 等）。 */
  spawn(def: EnemyDef, x: number, y: number, init?: (e: Enemy) => void): Enemy;
  /**
   * 给 parent 挂一个部件敌人。at 为父精灵挂点名或本地坐标。
   * at 为挂点名且部件精灵有 `root` 挂点时，自动让部件 root 对齐父体挂点（镜像时两者都镜像），无需手算偏移。
   * 部件跟随父体移动/旋转；父体死亡时部件一并死亡。mirror=true 时水平镜像（右侧部件，挂点 x 取反）。
   * 部件的 ai 仍会运行（可用于炮塔独立开火）。
   */
  attach(parent: Enemy, def: EnemyDef, at: string | [number, number], opts?: { mirror?: boolean; rot?: number; followRot?: boolean }): Enemy;
  /** 当前存活敌人（含部件）。 */
  liveEnemies(): readonly Enemy[];
  /** 等待直到没有存活的非地面敌人（或超时）。 */
  waitClear(timeout?: number): Co;
  damage(e: Enemy, amount: number, x?: number, y?: number, quiet?: boolean, source?: DamageSource): void;
  remove(e: Enemy): void;

  // ---------- 子弹 ----------
  shoot(x: number, y: number, angle: number, speed: number, style?: BulletStyle): Bullet;
  /** 扇形：以 angle 为中心，count 发，总张角 spread。 */
  fan(x: number, y: number, angle: number, count: number, spread: number, speed: number, style?: BulletStyle): Bullet[];
  /** 环形：count 发均匀分布，offset 为起始角。 */
  ring(x: number, y: number, count: number, speed: number, style?: BulletStyle, offset?: number): Bullet[];
  /** (x,y) 指向玩家的角度。 */
  aim(x: number, y: number): number;
  /** 敌方激光（预警 → 发射）。 */
  laser(x: number, y: number, angle: number, opts?: LaserOpts): Laser;
  /** 清除全部敌弹；toGold=true 时化为金（加分）。 */
  clearBullets(toGold?: boolean): void;
  /** 当前敌弹数量。 */
  bulletCount(): number;

  // ---------- 道具 ----------
  drop(kind: ItemKind, x: number, y: number): void;

  // ---------- 关卡控制 ----------
  /** 命名段落入口。返回false时脚本跳过本段；普通游戏始终true。 */
  checkpoint(id: string): boolean;
  /** 所选Boss的1起算阶段；普通游戏/其他Boss返回undefined。 */
  testBossPhase(id: string): number | undefined;
  /** 未抵达所选检查点时为true，供开场/清场/休整跳过使用。 */
  readonly seekingCheckpoint: boolean;
  /** 滚动速度（单位/秒，默认 60），sec 秒内平滑过渡。 */
  scrollSpeed(v: number, sec?: number): void;
  /** 背景参数：index 0..15 对应 uP0.x, uP0.y, … uP3.w。sec 秒内平滑过渡。 */
  bg(index: number, value: number, sec?: number): void;
  /** 背景闪光（雷电等）0..1，会自然衰减。 */
  bgFlash(amount: number): void;
  music(id: MusicId | null, fade?: number): void;
  sfx(id: Sfx, opts?: { pan?: number; vol?: number; pitch?: number }): void;
  /** 关卡标题卡（开场用）。 */
  card(title: string, subtitle: string): void;
  /** 剧情字幕。 */
  caption(speaker: string, text: string, duration?: number): void;
  /** 角色通讯；表情立绘缺失时回退到默认立绘，时长默认 4 秒。 */
  say(actor: string | DialogueActor, expression: string, text: string, duration?: number): void;
  /** 章节补给休整，采购或跳过后继续；成长用 growthChoice。 */
  milestone(label: string): Co;
  /** 遭遇结束后的安全成长窗口，与商店访问独立。 */
  growthChoice(slot:number): Co;
  /** 限时反制，新按下生效；不会消耗常规泼墨库存。 */
  challenge(opts: ChallengeOpts): Generator<unknown, boolean, unknown>;
  /** 已预告的风/潮/吸力场，仅改变移动，不直接造成伤害。 */
  force(opts: ForceOpts): void;
  /**
   * 生成 Boss（def.boss 必填）并等待其被击破。Boss 的 ai 应由若干 `yield* g.phase(...)` 组成；
   * ai 结束即判定击破，自动播放击破演出。Boss 在阶段中血量归零不会死亡。
   */
  boss(def: EnemyDef, x: number, y: number, opts?: BossOpts): Co;
  /**
   * Boss 阶段：设置血量，body 在独立作用域运行（阶段结束自动取消其中所有协程）。
   * 血量归零或超时后返回；返回值为 true 表示被击破（非超时）。
   * 阶段之间自动清弹化金并短暂无敌。
   */
  phase(e: Enemy, opts: PhaseOpts, body: () => Co): Generator<unknown, boolean, unknown>;
}
