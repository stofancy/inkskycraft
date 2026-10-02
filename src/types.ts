// 模块间共享契约。改动前先与主代理确认。

/** 逻辑游戏区尺寸（单位），y 轴向下，原点在左上角。 */
export const PLAY_W = 900;
export const PLAY_H = 1200;

export type WeaponColor = 'red' | 'blue' | 'purple';
export type DamageSource = WeaponColor | 'ink' | 'companion' | 'neutral';
export type MoveId = 'guard' | 'cut' | 'dash' | 'assist' | 'counter';

// ---------------------------------------------------------------- 输入

export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'shoot' | 'bomb' | 'brush' | 'focus' | 'weapon' | 'move'
  | 'pause' | 'confirm' | 'back';

export interface InputState {
  /** 当前是否按住。 */
  down(a: Action): boolean;
  /** 本帧刚按下（边沿触发）。 */
  pressed(a: Action): boolean;
  /** 模拟摇杆或方向键合成的轴，-1..1。 */
  readonly axisX: number;
  readonly axisY: number;
  /** 最近一次使用的设备，用于 UI 显示按键提示。 */
  readonly device: 'keyboard' | 'gamepad';
}

// ---------------------------------------------------------------- 设置

export interface Settings {
  /** 渲染分辨率相对 devicePixelRatio 的比例，0.5..1.5。 */
  renderScale: number;
  /** 特效档位。 */
  quality: 'high' | 'ultra';
  screenShake: boolean;
  masterVol: number; // 0..1
  musicVol: number;  // 0..1
  sfxVol: number;    // 0..1
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  renderScale: 1,
  quality: 'ultra',
  screenShake: true,
  masterVol: 0.8,
  musicVol: 0.7,
  sfxVol: 0.8,
  showFps: false,
};

// ---------------------------------------------------------------- HUD / UI

export interface BossHud {
  name: string;
  /** 当前阶段剩余血量 0..1。 */
  hp: number;
  /** 剩余阶段数（含当前阶段）。 */
  phasesLeft: number;
  /** 阶段计时（秒），无则 undefined。 */
  timer?: number;
  hint?: string;
}

export interface HudState {
  score: number;
  hiScore: number;
  lives: number;
  bombs: number;
  /** 墨量 0..1。 */
  ink: number;
  /** 墨量是否足够发动一笔。 */
  inkReady: boolean;
  /** 主武器等级 1..8。 */
  power: number;
  weapon: WeaponColor;
  /** 副武器（追踪墨矢）等级 0..4。 */
  missile: number;
  /** 连击倍率，1.0 起。 */
  multiplier: number;
  graze: number;
  /** 当前金印奖牌面值。 */
  medalValue: number;
  stage: number;
  stageName: string;
  boss: BossHud | null;
  brushActive: boolean;
  fps: number;
  /** 当前难度名（简单/普通/困难）。 */
  difficulty: string;
  companions?: { name: string; level: number; xp: number; kind?:string; role?:string; active?:number; count?:number }[];
  passives?: { id:string; name:string; icon:string; timer:number; triggers:number }[];
  growth?: { brush: number; bomb: number; talents: number };
  combo?: string;
  activeMoves?: { feedback: string; history: string; moves: { id: string; name: string; input: string; cost: number; cooldown: number; available: boolean }[] };
  challenge?: { title: string; hint: string; action: 'brush' | 'bomb' | 'focus'; remaining: number; duration: number } | null;
}

export interface StageResult {
  stage: number;
  stageName: string;
  score: number;
  kills: number;
  graze: number;
  sealed: number;     // 被封印的敌人与子弹总数
  maxChain: number;
  noMiss: boolean;
  bonus: number;      // 结算加分
}

export type ScreenName =
  | 'none' | 'title' | 'pause' | 'settings' | 'continue'
  | 'test' | 'gameover' | 'results' | 'ending' | 'loading' | 'growth';

export interface ChoiceCard { id: string; name: string; description: string; detail?: string; cost?: number; disabled?: boolean; preview?:string; icon?:string }

export interface ScreenData {
  results?: StageResult;
  /** continue 画面倒计时秒数。 */
  countdown?: number;
  finalScore?: number;
  hiScore?: number;
  settings?: Settings;
  /** 标题画面当前难度。 */
  difficulty?: 'easy' | 'normal' | 'hard';
  /** loading 进度 0..1。 */
  progress?: number;
  choices?: ChoiceCard[];
  choiceTitle?: string;
  choiceHint?: string;
  moves?: { name: string; input: string; effect: string; window?: number; cost?: number }[];
}

export type PopupKind = 'score' | 'seal' | 'extend' | 'graze' | 'info' | 'chain';

/** UI 回调给游戏的事件。 */
export interface UIEvents {
  onStart(): void;
  onTestStart?(options: import('./game/test-options').TestRunOptions): void;
  onResume(): void;
  onQuitToTitle(): void;
  onContinue(yes: boolean): void;
  onResultsDone(): void;
  onSettingsChange(s: Settings): void;
  onDifficultyChange(d: 'easy' | 'normal' | 'hard'): void;
  onChoice?(id: string): void;
  /** 让音频播放菜单音效。 */
  onMenuSound(kind: 'move' | 'ok' | 'back'): void;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** 通讯角色；某表情没有立绘时使用 portrait。 */
export interface DialogueActor {
  name: string;
  portrait?: string;
  expressions?: Record<string, string>;
}

/** 由 src/ui 实现。 */
export interface GameUI {
  mount(root: HTMLElement, events: UIEvents): void;
  /** 视口变化时调用。playRect 为游戏区在页面上的 CSS 像素矩形。 */
  layout(playRect: Rect, viewport: { w: number; h: number }): void;
  /** 每帧调用；实现内部自行节流 DOM 写入。 */
  hud(state: HudState, visible: boolean): void;
  screen(name: ScreenName, data?: ScreenData): void;
  /** 每帧调用，处理菜单导航（仅在菜单画面有效）。 */
  menuInput(input: InputState): void;
  stageCard(stage: number, title: string, subtitle: string): void;
  warning(bossName: string, subtitle: string): void;
  /** 在游戏区坐标 (x,y) 处弹出文字。 */
  popup(x: number, y: number, text: string, kind: PopupKind, mergeKey?:string): void;
  /** 弹出对话/剧情字幕，duration 秒。 */
  caption(speaker: string, text: string, duration: number): void;
  /** 角色通讯，duration 秒；省略时为 4 秒。 */
  say(actor: string | DialogueActor, expression: string, text: string, duration?: number): void;
}

// ---------------------------------------------------------------- 音频

export type Sfx =
  | 'shot_red' | 'shot_blue' | 'shot_purple' | 'missile'
  | 'hit' | 'hit_armor' | 'hit_red' | 'hit_blue' | 'hit_purple'
  | `move:${string}` | `companion:${string}` | `boss:${string}`
  | 'explode_s' | 'explode_m' | 'explode_l' | 'explode_boss'
  | 'graze' | 'item' | 'powerup' | 'weapon_change' | 'medal'
  | 'bomb' | 'brush_start' | 'brush_release' | 'slash' | 'seal'
  | 'player_die' | 'extend' | 'warning'
  | 'menu_move' | 'menu_ok' | 'menu_back'
  | 'enemy_shot' | 'enemy_shot_big' | 'laser_charge' | 'laser_fire' | 'thunder'
  | 'boss_phase' | 'stage_clear'
  | `move:${MoveId}`;

export type MusicId =
  | 'title' | 'stage1' | 'stage2' | 'stage3'
  | 'boss' | 'finalboss' | 'clear' | 'gameover' | 'ending';

export interface BeatInfo {
  /** 当前小节内的拍位置（整数拍 + 小数）。 */
  beat: number;
  /** 当前拍内相位 0..1。 */
  phase: number;
  bpm: number;
}

/** 由 src/audio 实现。 */
export interface GameAudio {
  /** 首次用户手势时调用。可重复调用。 */
  init(): Promise<void>;
  sfx(id: Sfx, opts?: { pan?: number; vol?: number; pitch?: number }): void;
  /** 切换音乐，null 为停止。 */
  music(id: MusicId | null, fadeSec?: number): void;
  /** 一笔（子弹时间）强度 0..1：低通、降调、混响加深。 */
  setSlowmo(amount: number): void;
  setVolumes(master: number, music: number, sfx: number): void;
  beat(): BeatInfo;
}
