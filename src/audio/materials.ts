// 生成音乐、配音和离线分层音效的事件目录。后续玩法只需发出同名事件。
export const MUSIC_FILES = {
  "title": "title",
  "stage1": "stage1",
  "boss": "boss",
  "stage1b": "stage1b",
  "boss-zhilong": "boss-zhilong",
  "boss-tongque-2": "boss-tongque-2",
  "warning": "warning",
  "boss-clear": "boss-clear",
  "clear": "clear",
  "rest": "rest",
  "fall": "fall",
  "stage2": "stage2",
  "boss-shen": "boss-shen",
  "boss-shen-2": "boss-shen-2",
  "stage3": "stage3",
  "boss-leigong": "boss-leigong",
  "boss-leigong-2": "boss-leigong-2",
  "stage4": "stage4",
  "boss-kun": "boss-kun",
  "boss-peng": "boss-peng",
  "gameover": "gameover",
  "ending": "ending",
  "interlude": "interlude",
  "finalboss": "boss-peng"
} as const;
// 短乐段常驻；道中曲在进章前就绪，Boss 曲在道中后台解码。
export const MUSIC_RESIDENT = ['warning', 'boss-clear', 'clear', 'gameover', 'interlude'] as const;
export const MUSIC_CHAPTERS = {
  0: { core: ['title', 'stage1', 'stage1b', 'rest', 'fall'], bosses: [] },
  1: { core: ['stage1', 'stage1b', 'rest', 'fall'], bosses: ['boss', 'boss-zhilong', 'boss-tongque-2'] },
  2: { core: ['stage2', 'rest'], bosses: ['boss-shen', 'boss-shen-2'] },
  3: { core: ['stage3', 'rest'], bosses: ['boss-leigong', 'boss-leigong-2'] },
  4: { core: ['stage4', 'rest'], bosses: ['boss-kun', 'boss-peng'] },
  5: { core: ['ending'], bosses: [] },
} as const;
export const MUSIC_CONTEXT: Partial<Record<keyof typeof MUSIC_FILES, keyof typeof MUSIC_CHAPTERS>> = {
  title: 0, stage1: 1, stage2: 2, stage3: 3, stage4: 4, ending: 5,
};
export const VOICE_EVENTS: Record<string, string[]> = {
  'move:guard': ['xiaoman-guard'], 'move:cut': ['xiaoman-cut'],
  'move:dash': ['xiaoman-dash'], 'move:assist': ['xiaoman-assist'], 'move:counter': ['xiaoman-counter'],
  'companion:chiyan': ['chiyan-attack', 'chiyan-hit'],
  'companion:laodun': ['laodun-shield', 'laodun-block'],
  'companion:moyuan': ['moyuan-bind', 'moyuan-hit'],
  'companion:suanpan': ['suanpan-supply', 'suanpan-buff'],
  'boss:tongque': ['tongque-intro'],
};
// P4 素材专用事件：加载失败时静音，禁止运行时合成鼓声回退。
export const P4_SFX = {
  mantra_start: '起手 · 大鼓', mantra_roll: '滚奏 · 急急风参考',
  mantra_hit_1: '砸字 1', mantra_hit_2: '砸字 2', mantra_hit_3: '砸字 3',
  mantra_hit_4: '砸字 4', mantra_hit_5: '砸字 5', mantra_hit_6: '砸字 6',
  mantra_hit_7: '砸字 7', mantra_hit_8: '砸字 8', mantra_hit_9: '砸字 9',
  mantra_finale: '收势 · 软四击头参考', mantra_slash: '九字刀光',
  swap_red: '换朱雀 · 笛子上滑', swap_purple: '换紫 · 近雷',
  swap_blue: '换青锋 · 剑鸣', roll: '翻滚 · 风声',
} as const;
export type P4Sfx = keyof typeof P4_SFX;
export const P4_SFX_IDS = Object.keys(P4_SFX) as P4Sfx[];
export const isP4Sfx = (id: string): id is P4Sfx => Object.hasOwn(P4_SFX, id);
export const NEW_SFX_IDS = ["brush_start", "brush_loop", "brush_release", "bomb_red", "bomb_blue", "bomb_purple", "mantra_hit", "companion_q", "companion_e", "companion_r", "skill_unlock", "workship_hit", "bomber_release", "bomb_land", "item_power", "item_bomb", "item_ink", "item_medal", "extend", "player_die", "boss_part", "boss_phase", "bullet_time", "counter_success", "counter_fail", "menu_move"] as const;
export const isNewSfx = (id:string) => (NEW_SFX_IDS as readonly string[]).includes(id);
export const SFX_FILES = ['shot_red','shot_blue','shot_purple','hit','hit_red','hit_blue','hit_purple','hit_armor','explode_s','explode_m','explode_l','explode_boss','item','bomb','graze','warning','slash','seal','menu_ok','menu_back', ...P4_SFX_IDS] as const;
export const MATERIALS = [
  ...[...new Set(Object.values(MUSIC_FILES))].map(id => ({ id: `music:${id}`, url: `/audio/music/${id}.ogg`, bus: 'music' })),
  ...NEW_SFX_IDS.map(id => ({ id, url: `/audio/sfx/new/${id}.ogg`, bus: 'sfx' })),
  ...SFX_FILES.filter(id => !isNewSfx(id)).map(id => ({ id, url: `/audio/sfx/${id}.ogg`, bus: 'sfx' })),
  ...Object.values(VOICE_EVENTS).flat().map(id => ({ id, url: `/audio/voice/${id}.ogg`, bus: 'voice' })),
];
