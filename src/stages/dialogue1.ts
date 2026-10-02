// 第一章对白：按 studio/specs/dialogue-ch1.md 接入，经 G.say 走通讯窗。
import type { G } from '../game/api';
import type { DialogueActor } from '../types';

const LABEL = { calm: '平静', smug: '得意', alarmed: '着急' } as const;
type Expr = keyof typeof LABEL;
// public/art/portraits 里已有的表情图；缺的表情回退到 calm。
const HAVE: Record<string, Expr[]> = {
  xiaoman: ['calm', 'smug', 'alarmed'], chiyan: ['calm'], laodun: ['calm'], moyuan: ['calm'],
  suanpan: ['calm'], zhangmen: ['calm'], tongque: ['calm'],
};
const NAMES: Record<string, string> = { xiaoman: '小满', chiyan: '赤燕', laodun: '老盾', moyuan: '墨鸢', suanpan: '算盘', zhangmen: '掌门', tongque: '铜雀', zhilong: '纸龙' };
const actors: Record<string, DialogueActor> = {};
for (const id of Object.keys(NAMES)) {
  const have = HAVE[id];
  actors[id] = have
    ? { name: NAMES[id], portrait: `/art/portraits/${id}/calm.png`, expressions: Object.fromEntries(have.map(e => [LABEL[e], `/art/portraits/${id}/${e}.png`])) }
    : { name: NAMES[id] };
}

// 台词 ID -> [说话人, 表情, 台词, 时长]
type Line = [string, Expr, string, number];
const LINES: Record<string, Line> = {
  'M1-0-00': ['xiaoman', 'calm', '我是修机徒弟小满，来救修桥工。', 3],
  'M1-0-01': ['xiaoman', 'alarmed', '断桥上的工人，被机器拦住了。', 3],
  'M1-0-02': ['xiaoman', 'calm', '师父教过我：人在，桥才在。', 3],
  'M1-0-03': ['zhangmen', 'calm', '小满，先回来。检修交给师兄。', 3],
  'M1-0-04': ['xiaoman', 'alarmed', '师父，我先救人，再回去见您。', 3],
  'M1-0-05': ['chiyan', 'calm', '赤燕火力手，先把拦路炮拆了！', 3],
  'M1-0-06': ['xiaoman', 'smug', '赤燕，你那旧机像条咸鱼。', 3],
  'M1-0-07': ['chiyan', 'smug', '咸鱼也有梦想！旧机子也要起飞！', 3],
  'M1-0-08': ['xiaoman', 'smug', '飞起来了！回镇给它刷漆。', 3],
  'M1-0-09': ['laodun', 'calm', '老盾护航。人先走，我来挡弹。', 3],
  'M1-0-10': ['xiaoman', 'calm', '你护工人，我拆拦路炮。', 3],
  'M1-1-00': ['moyuan', 'calm', '我是侦察机墨鸢，拍下了断桥。', 3],
  'M1-1-01': ['moyuan', 'calm', '我拍的是断桥，广播播的却是新桥。', 3],
  'M1-1-03': ['suanpan', 'calm', '修理机器人算盘，镇上又停电了。', 3],
  'M1-1-04': ['suanpan', 'alarmed', '掌门，怎么突然之间没电了呢？', 3],
  'M1-1-05': ['xiaoman', 'alarmed', '师父在山上，只看得到广播。', 3],
  'M1-1-07': ['suanpan', 'alarmed', '电池都往河边运，镇上拿什么开工？', 3],
  'M1-1-08': ['xiaoman', 'calm', '记下去向，先救桥上的人。', 3],
  'M1-2-00': ['xiaoman', 'calm', '纸龙是巡逻机，连修桥的人也查？', 3],
  'M1-2-04': ['xiaoman', 'calm', '前面是纸龙，先让它停下。', 3],
  'M1-2-06': ['moyuan', 'calm', '纸龙回报：桥已经修好。', 3],
  'M1-2-07': ['chiyan', 'alarmed', '修好了？断桥的洞自己长的？', 3],
  'M1-2-08': ['xiaoman', 'calm', '先过检查，再去桥口放人。', 3],
  'M1-3-00': ['xiaoman', 'calm', '纸龙停了，继续去桥口救人。', 3],
  'M1-3-01': ['laodun', 'calm', '铜雀是守桥机器，堵着桥口。', 3],
  'M1-3-03': ['xiaoman', 'alarmed', '师父若知道停电，一定会撤令。', 3],
  'M1-3-05': ['suanpan', 'calm', '灯河是运电池的河，记住方向。', 3],
  'M1-3-07': ['xiaoman', 'calm', '先开桥口，再沿灯河找回电池。', 3],
  'M1-3-09': ['chiyan', 'calm', '铜雀的旧甲，是我亲手装的。', 3],
  'M1-3-10': ['xiaoman', 'calm', '师父教过我：人在，桥才在。', 3],
  'M1-PD-IN': ['zhilong', 'calm', '桥没修好，修桥的人禁止通行。', 3],
  'M1-TQ-IN': ['tongque', 'calm', '桥没修好，谁都别走。掌门有令。', 3],
  'M1-TQ-STRIP': ['chiyan', 'smug', '敌羞，吾去脱他衣！', 3],
  'M1-TQ-SHY': ['tongque', 'alarmed', '旧甲退壳。这是……羞？', 3],
  'M1-TQ-RETRY': ['moyuan', 'calm', '回墨，再圈住发光的核心。', 2],
  'M1-END': ['xiaoman', 'calm', '工人能下桥了，沿灯河找回电池！', 2],
};

let played = new Set<string>();
let lastAt = -99;
/** 新一局开始时清空「只播一次」记录。 */
export function resetDialogue(): void { played = new Set(); lastAt = -99; }

/** 播放一条台词；同一条只播一次。返回是否播出。 */
export function sayLine(g: G, id: string, opts: { spaced?: boolean; after?: string; repeat?: boolean } = {}): boolean {
  const l = LINES[id];
  if (!l || (played.has(id) && !opts.repeat)) return false;
  if (opts.after && !played.has(opts.after)) return false;
  if (opts.spaced && g.t - lastAt < 4.5) return false;
  played.add(id); lastAt = g.t;
  g.say(actors[l[0]], LABEL[l[1]], l[2], l[3]);
  return true;
}

/** 普通遭遇对白：encounter 开始时按 chapter/round 查表。 */
export function sayEncounter(g: G, chapter: number, round: number): void {
  const id = `M1-${chapter}-${String(round).padStart(2, '0')}`;
  if (LINES[id]) sayLine(g, id);
}
