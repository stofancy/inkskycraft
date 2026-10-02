// 模块间共享契约。改动前先与主代理确认。

/** 逻辑游戏区尺寸（单位），y 轴向下，原点在左上角。 */
export const PLAY_W = 900;
export const PLAY_H = 1200;

export type WeaponColor = 'red' | 'blue' | 'purple';
export type DamageSource = WeaponColor | 'ink' | 'companion' | 'neutral' | 'bomb' | 'qte';
export type MoveId = 'guard' | 'cut' | 'dash' | 'assist' | 'counter';

// ---------------------------------------------------------------- 输入

export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'shoot' | 'bomb' | 'brush' | 'focus' | 'weapon' | 'move'
  | 'skill1' | 'skill2' | 'skill3' | 'skill4' | 'skill5'
  | 'companionQ' | 'companionE' | 'companionR' | 'roll' | 'pause' | 'confirm' | 'back';

export interface InputState {
  consume?(action:Action):void;
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
  /** 渲染分辨率相对 devicePixelRatio 的比例，1..1.5。 */
  renderScale: number;
  /** 特效档位。 */
  quality: 'high' | 'ultra';
  screenShake: boolean;
  masterVol: number; // 0..1
  musicVol: number;  // 0..1
  sfxVol: number;    // 0..1
  voiceVol: number;  // 0..1
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  renderScale: 1,
  quality: 'ultra',
  screenShake: true,
  masterVol: 0.8,
  musicVol: 0.7,
  sfxVol: 0.8,
  voiceVol: 0.8,
  showFps: false,
};

// ---------------------------------------------------------------- HUD / UI

export interface BossHud {
  bombLimited?:boolean;
  name: string;
  /** 当前阶段剩余血量 0..1。 */
  hp: number;
  /** 剩余阶段数（含当前阶段）。 */
  phasesLeft: number;
  /** 最近半秒的掉血残影。 */
  trail?: number;
  /** 阶段计时（秒），无则 undefined。 */
  timer?: number;
  hint?: string;
}

export interface SkillSlot {
  id:string; name:string; key?:string; icon:string; cooldown:number; cooldownMax:number; ready:boolean; visible:boolean; active?:number; value?:string; fill?:number; unlocking?:boolean;
}

export interface HudState {
  ship?: {durability:number;x:number;y:number;label:boolean;state:string};
  inkScore?:Record<WeaponColor,number>;
  score: number;
  hiScore: number;
  lives: number;
  /** 本局残机上限，用于显示已失去的命。 */
  lifeMax?: number;
  /** 当前命剩余羽甲 0..3。 */
  armor?: number;
  /** 累计受击次数，界面据此触发边缘淡红闪。 */
  hurtSeq?: number;
  bombs: number;
  /** 墨量 0..1。 */
  ink: number;
  /** 墨量是否足够发动一笔。 */
  inkReady: boolean;
  /** 主武器等级 1..4。 */
  power: number;
  /** 追踪墨矢等级 0..4。 */
  missile?: number;
  weapon: WeaponColor;
  /** 连击倍率，1.0 起。 */
  multiplier: number;
  graze: number;
  /** 当前金印奖牌面值。 */
  medalValue: number;
  stage: number;
  stageName: string;
  boss: BossHud | null;
  brushActive: boolean;
  brushProtection?:number;
  brushForm?:string;
  brushMethods?:string[];
  fps: number;
  /** 当前难度名（简单/普通/困难）。 */
  difficulty: string;
  companions?: { name: string; level: number; xp: number; kind?:string; role?:string; active?:number; count?:number }[];
  passives?: { id:string; name:string; icon:string; timer:number; triggers:number }[];
  growth?: { brush: number; bomb: number; talents: number };
  combo?: string;
  skillSlots?: SkillSlot[];
  overclock?: {x:number;y:number;left:number};
  rollCharges?: number;
  rollRecharge?: number;
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
  shipBonus?:number;
  bonus: number;      // 结算加分
}

export type ScreenName =
  | 'none' | 'title' | 'pause' | 'communications' | 'settings' | 'continue'
  | 'test' | 'gameover' | 'results' | 'ending' | 'loading' | 'growth';

export interface ChoiceCard { id: string; name: string; description: string; detail?: string; cost?: number; disabled?: boolean; preview?:string; icon?:string }

export interface ScreenData {
  inkScore?:Record<WeaponColor,number>;
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
}

export type PopupKind = 'score' | 'seal' | 'extend' | 'graze' | 'info' | 'chain' | `damage-${WeaponColor}-${'small'|'medium'|'large'}`;

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
  /** 暂停对白的手动补全与翻页反馈。 */
  onDialogueSound?(): void;
  onDialogueStop?(): void;
  /** 让音频播放菜单音效。 */
  onMenuSound(kind: 'move' | 'ok' | 'back'): void;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** 通讯角色；某表情没有立绘时使用 portrait。 */
export interface DialogueActor {
  name: string;
  identity?: string;
  portrait?: string;
  expressions?: Record<string, string>;
}

/** 由 src/ui 实现。 */
export interface GameUI {
  dialogueState():{active:boolean;id:string;page:number;pages:number;complete:boolean};
  dialogueTick(dt:number,input:InputState):void;
  dialogueAdvance():void;
  dialogueSkip():void;
  recordCommunication(actor:DialogueActor,expression:string,text:string,id:string,memory:boolean):void;
  resetCommunications():void;
  chapterSay(actor:DialogueActor,expression:string,text:string,id:string,memory:boolean,options?:{pause:boolean;onDone:()=>void;onSkip:()=>void}):void;
  missionBrief(id:number):void;
  mount(root: HTMLElement, events: UIEvents): void;
  /** 视口变化时调用。playRect 为游戏区在页面上的 CSS 像素矩形。 */
  layout(playRect: Rect, viewport: { w: number; h: number }): void;
  /** 每帧调用；实现内部自行节流 DOM 写入。 */
  hud(state: HudState, visible: boolean): void;
  screen(name: ScreenName, data?: ScreenData): void;
  /** 每帧调用，处理菜单导航（仅在菜单画面有效）。 */
  menuInput(input: InputState): void;
  stageCardActive():boolean;
  stageCard(stage: number, title: string, subtitle: string): void;
  warning(bossName: string, subtitle: string): void;
  warningEnd?():void;
  /** 在游戏区坐标 (x,y) 处弹出文字。 */
  popup(x: number, y: number, text: string, kind: PopupKind, mergeKey?:string): void;
  /** 弹出对话/剧情字幕，duration 秒。 */
  caption(speaker: string, text: string, duration: number): void;
  controlsHint(text:string,duration:number):void;
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
  | 'mantra_start' | 'mantra_roll' | 'mantra_finale' | 'mantra_slash'
  | `mantra_hit_${1|2|3|4|5|6|7|8|9}`
  | 'swap_red' | 'swap_purple' | 'swap_blue' | 'roll'
  | 'boss_phase' | 'stage_clear'
  | 'brush_loop' | 'bomb_red' | 'bomb_blue' | 'bomb_purple' | 'mantra_hit'
  | 'companion_q' | 'companion_e' | 'companion_r' | 'skill_unlock'
  | 'workship_hit' | 'bomber_release' | 'bomb_land'
  | 'item_power' | 'item_bomb' | 'item_ink' | 'item_medal'
  | 'boss_part' | 'bullet_time' | 'counter_success' | 'counter_fail'
  | `move:${MoveId}`;

export type MusicId =
  | 'title' | 'stage1' | 'stage2' | 'stage3'
  | 'boss' | 'finalboss' | 'clear' | 'gameover' | 'ending'
  | 'stage1b' | 'boss-zhilong' | 'boss-tongque-2' | 'warning' | 'boss-clear' | 'rest' | 'fall' | 'boss-shen' | 'boss-shen-2' | 'boss-leigong' | 'boss-leigong-2' | 'stage4' | 'boss-kun' | 'boss-peng' | 'interlude';

export interface BeatInfo {
  /** 当前小节内的拍位置（整数拍 + 小数）。 */
  beat: number;
  /** 当前拍内相位 0..1。 */
  phase: number;
  bpm: number;
}

/** 由 src/audio 实现。 */
export interface DialogueVoiceState { id: string; state: 'loading' | 'playing' | 'ended' | 'silent' | 'stopped' }

export interface GameAudio {
  /** 首次用户手势时调用。可重复调用。 */
  init(): Promise<void>;
  /** 进章前加载道中与短乐段，Boss 在道中后台预取。0标题，1–4章节，5片尾。 */
  prepareMusic(chapter: number, bossesReady?: boolean): Promise<void>;
  sfx(id: Sfx, opts?: { pan?: number; vol?: number; pitch?: number }): void;
  stopSfx?(id:Sfx):void;
  prefetchDialogue(lines: readonly { id: string; text: string }[]): void;
  playDialogue(id: string, text: string): DialogueVoiceState | null;
  stopDialogue(): void;
  /** 切换音乐，null 为停止。 */
  music(id: MusicId | null, fadeSec?: number): void;
  /** 一笔（子弹时间）强度 0..1：低通、降调、混响加深。 */
  setSlowmo(amount: number): void;
  setVolumes(master: number, music: number, sfx: number, voice: number): void;
  beat(): BeatInfo;
}
