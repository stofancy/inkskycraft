import type { MusicId } from '../types';
// 音乐素材元数据；循环曲与一次性短乐段共用实际采样播放入口。
export function bossMusicAtPhase(id: MusicId, phase: number): MusicId {
  if (id === 'boss' && phase >= 3) return 'boss-tongque-2';
  if (id === 'boss-shen' && phase >= 4) return 'boss-shen-2';
  if (id === 'boss-leigong' && phase >= 2) return 'boss-leigong-2';
  return id;
}
export const MUSIC_CUES = {
  "title": {
    "bpm": 72,
    "loop": true,
    "seconds": 202,
    "name": "标题 · 群山初晴"
  },
  "stage1": {
    "bpm": 110,
    "loop": true,
    "seconds": 159,
    "name": "第一章 · 晨山飞行"
  },
  "boss": {
    "bpm": 126,
    "loop": true,
    "seconds": 159,
    "name": "铜雀胸甲与双翼"
  },
  "stage1b": {
    "bpm": 116,
    "loop": true,
    "seconds": 150,
    "name": "第一章纸龙之后E07–E10，群山护航压力上升，紧凑而仍有飞行的开阔"
  },
  "boss-zhilong": {
    "bpm": 120,
    "loop": true,
    "seconds": 120,
    "name": "纸扎巡检机纸龙，轻巧、狡黠，薄纸翻动中藏着威胁"
  },
  "boss-tongque-2": {
    "bpm": 138,
    "loop": true,
    "seconds": 150,
    "name": "铜雀控制器，守关对峙进入重压急战"
  },
  "warning": {
    "bpm": 100,
    "loop": false,
    "seconds": 3,
    "name": "Boss登场前警报，3秒后接入战斗"
  },
  "boss-clear": {
    "bpm": 84,
    "loop": false,
    "seconds": 6,
    "name": "Boss击破后6秒短乐段，威胁解除，伙伴仍在身边"
  },
  "clear": {
    "bpm": 84,
    "loop": true,
    "seconds": 30,
    "name": "章末结算，30秒循环，松弛、有收获感，轻松的修机武侠"
  },
  "rest": {
    "bpm": 72,
    "loop": true,
    "seconds": 60,
    "name": "休整点和长对话，60秒循环，低压安静，留出说话空间"
  },
  "fall": {
    "bpm": 72,
    "loop": true,
    "seconds": 40,
    "name": "E09飞舟下坠和世界减速，40秒循环，悬在空中的紧张与接住飞舟的希望"
  },
  "stage2": {
    "bpm": 102,
    "loop": true,
    "seconds": 180,
    "name": "第二章夜间灯河、河道和投影船闸，水汽倒影，旅程继续"
  },
  "boss-shen": {
    "bpm": 112,
    "loop": true,
    "seconds": 140,
    "name": "蜃第一段，幻象、水汽、投影船闸，错位的真假路径"
  },
  "boss-shen-2": {
    "bpm": 128,
    "loop": true,
    "seconds": 140,
    "name": "蜃第二段，幻象显形，真假重叠，逐渐确定突破口"
  },
  "stage3": {
    "bpm": 118,
    "loop": true,
    "seconds": 180,
    "name": "第三章风暴云海、雷公执法，师兄在前，向雷暴飞行"
  },
  "boss-leigong": {
    "bpm": 126,
    "loop": true,
    "seconds": 150,
    "name": "雷公第一段，师兄执法，压迫而正面的对决"
  },
  "boss-leigong-2": {
    "bpm": 142,
    "loop": true,
    "seconds": 150,
    "name": "雷公第二段，执法压力到顶，师兄与小满正面争执决胜"
  },
  "stage4": {
    "bpm": 108,
    "loop": true,
    "seconds": 180,
    "name": "终章天门航道，船队飞向高天"
  },
  "boss-kun": {
    "bpm": 116,
    "loop": true,
    "seconds": 160,
    "name": "鲲鹏守天门，鲲形态深沉巨大"
  },
  "boss-peng": {
    "bpm": 144,
    "loop": true,
    "seconds": 160,
    "name": "鲲鹏展开巨翼，天门前的最后对决"
  },
  "gameover": {
    "bpm": 60,
    "loop": true,
    "seconds": 15,
    "name": "游戏结束15秒循环，低沉、失落，出镖的路还没走完"
  },
  "ending": {
    "bpm": 80,
    "loop": false,
    "seconds": 180,
    "name": "片尾船队抵达高天，温暖，旅途结束"
  },
  "interlude": {
    "bpm": 96,
    "loop": false,
    "seconds": 18,
    "name": "章与章之间18秒转场，旅途继续，出镖的方向仍在前方"
  },
  "finalboss": {
    "bpm": 144,
    "loop": true,
    "seconds": 160,
    "name": "鹏形态旧入口"
  }
} as const;
