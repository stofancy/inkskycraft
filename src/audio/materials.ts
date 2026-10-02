// 生成音乐、配音和离线分层音效的事件目录。后续玩法只需发出同名事件。
export const MUSIC_FILES = { title: 'title', stage1: 'stage1', boss: 'boss' } as const;
export const VOICE_EVENTS: Record<string, string[]> = {
  'move:guard': ['xiaoman-guard'], 'move:cut': ['xiaoman-cut'],
  'move:dash': ['xiaoman-dash'], 'move:assist': ['xiaoman-assist'], 'move:counter': ['xiaoman-counter'],
  'companion:chiyan': ['chiyan-attack', 'chiyan-hit'],
  'companion:laodun': ['laodun-shield', 'laodun-block'],
  'companion:moyuan': ['moyuan-bind', 'moyuan-hit'],
  'companion:suanpan': ['suanpan-supply', 'suanpan-buff'],
  'boss:tongque': ['tongque-intro'],
};
export const SFX_FILES = ['shot_red','shot_blue','shot_purple','hit','hit_red','hit_blue','hit_purple','hit_armor','explode_s','explode_m','explode_l','explode_boss','item','bomb','graze','warning','slash','seal','menu_ok','menu_back'] as const;
export const MATERIALS = [
  ...Object.values(MUSIC_FILES).map(id => ({ id: `music:${id}`, url: `/audio/music/${id}.ogg`, bus: 'music' })),
  ...SFX_FILES.map(id => ({ id, url: `/audio/sfx/${id}.ogg`, bus: 'sfx' })),
  ...Object.values(VOICE_EVENTS).flat().map(id => ({ id, url: `/audio/voice/${id}.ogg`, bus: 'voice' })),
];
