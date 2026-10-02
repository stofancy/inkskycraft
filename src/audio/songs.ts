// 曲目数据（五声调式 × 电子）与编译：把段落描述展开为按 16 分音符步进的事件表。
import { rng } from './engine';
import type { MusicId } from '../types';

export interface Ev { k: string; n?: number; ns?: number[]; v: number; d?: number; o?: number }
export interface Song { id: MusicId; bpm: number; sw: number; steps: number; loopStart: number; loop: boolean; ev: Ev[][]; sections: { name: string; start: number; bars: number }[] }

const MODES: Record<string, number[]> = {
  gong: [0, 2, 4, 7, 9], shang: [0, 2, 5, 7, 10], jue: [0, 3, 5, 8, 10], zhi: [0, 2, 5, 7, 9], yu: [0, 3, 5, 7, 10],
};
const CH: Record<string, number[]> = {
  s2: [0, 2, 7], s4: [0, 5, 7], m: [0, 3, 7], m7: [0, 3, 7, 10], M: [0, 4, 7], M7: [0, 4, 7, 11], p5: [0, 7, 12],
};

type Pat = Record<string, string>;
type Inst = 'flute' | 'erhu' | 'saw' | 'koto';
interface Sec {
  n: number; p: string; m?: string[]; mi?: Inst; mv?: number; mo?: number;
  dbl?: { i: Inst; o: number; v: number };
  pad?: number; bass?: string; arp?: string; ai?: 'pluck' | 'bell'; koto?: string;
  dr?: string; tr?: number; cr?: 'gong' | 'cymb'; rain?: number; intro?: boolean; name?: string;
}
interface Def {
  bpm: number; root: number; mode: string; sw?: number; loop?: boolean;
  chords: Record<string, string>; ph: Record<string, string>; bass: Record<string, string>; dr: Record<string, Pat>; secs: Sec[];
}

// ---------------------------------------------------------------- 曲目定义
const DEFS: Partial<Record<MusicId, Def>> = {
  // 慢、空灵：羽调 A，古筝散板 + 二胡长句，尾段加太鼓心跳
  title: {
    bpm: 72, root: 57, mode: 'yu',
    chords: { a: '0:m7 -4:M7 -2:s2 7:m7', b: '-4:M7 -2:s2 0:m7 0:m7/7:m7' },
    ph: {
      A: '5 - - 6 5 - 3 - | 4 - - 3 2 - - -', B: '5 - - 6 7 - 6 - | 5 - 3 - 2 - 0 -',
      C: '7 - 8 - 9 - 8 6 | 7 - - - 6 - 5 -', D: '8 - 9 - 8 - 6 - | 5 - 6 5 3 - - -',
      E: '7 - 8 - 6 - 5 - | 3 - 2 - 0 - - -', F: '(56) (76) 5 - (34) (53) 4 - | (23) (42) 3 - 0 - - -',
    },
    bass: { sub: 'r---------------', two: 'r-------f-------' },
    dr: { soft: { t: 'X...............', w: '........x.......', h: '..g...g...g...g.' } },
    secs: [
      { n: 4, p: 'a', pad: 0.8, koto: 'S...............', cr: 'gong', intro: true, name: 'intro' },
      { n: 8, p: 'a', m: ['A', 'B', 'A+1', 'E'], mi: 'erhu', mv: 0.85, pad: 1, bass: 'sub', koto: '0...2...4...2...', name: 'A' },
      { n: 8, p: 'b', m: ['C', 'D', 'C+1', 'E'], mi: 'flute', dbl: { i: 'koto', o: 0, v: 0.5 }, pad: 1, bass: 'two', koto: 'S.......2...1...', dr: 'soft', name: 'B' },
      { n: 8, p: 'a', m: ['F', 'F+2', 'F', 'F-1'], mi: 'koto', mv: 0.9, pad: 0.9, ai: 'bell', arp: '4.......5.......', rain: 0.05, cr: 'gong', name: 'C' },
      { n: 8, p: 'b', m: ['A', 'B', 'C', 'E'], mi: 'erhu', dbl: { i: 'flute', o: 1, v: 0.5 }, pad: 1, bass: 'two', ai: 'bell', arp: '0...2...3...2...', koto: 'S...............', dr: 'soft', name: "A'" },
    ],
  },
  // 约 110 BPM，明亮宫调 C：笛领奏，电子琶音 + 合成贝斯 + 太鼓四拍
  stage1: {
    bpm: 110, root: 60, mode: 'gong',
    chords: { a: '0:s2 -3:m7 5:M7 7:s4', b: '5:M7 7:s4 4:m7 -3:m7', c: '0:M 7:s4 -3:m7 5:M7', d: '-3:m7 5:M7 0:s2 7:s4' },
    ph: {
      A: '5 . 6 7 8 - 7 6 | 5 - 4 5 7 - - .', B: '5 . 6 7 8 - 9 8 | 7 - 6 5 6 - - .', C: '5 . 6 7 8 - 7 6 | 5 - 3 4 5 - - -',
      D: '8 - 9 8 7 - 5 7 | 8 - 7 6 5 - 6 .', E: '9 - A 9 8 - 7 8 | 9 - 8 7 6 - - .', F: '5 5 - 7 8 - 8 9 | A - 9 8 7 - 5 .',
      G: '8 8 - 9 A - 9 8 | 7 - 8 7 5 - - -', H: '(45) (67) 8 - (76) (54) 3 - | (45) (67) 9 - (87) (65) 5 -',
    },
    bass: { pulse: 'r.rrr.r.r.rrr.f.', drive: 'r.r.r.r.r.r.r.o.', sub: 'r-------r-------' },
    dr: {
      lite: { k: 'X...X...X...X...', h: '..x...x...x...x.', w: '.......x.......x' },
      main: { k: 'X.....x.X.x.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.', o: '..............x.', t: 'X...............' },
      hard: { k: 'X..xX..x..x.X..x', s: '....X.......X..g', h: 'xgxgxgxgxgxgxgxg', o: '..............x.', t: 'X.......X.......', c: '....X.......X...' },
    },
    secs: [
      { n: 4, p: 'c', pad: 0.6, bass: 'pulse', arp: '0.1.2.1.0.1.2.3.', ai: 'pluck', koto: 'S...............', dr: 'lite', cr: 'cymb', intro: true, name: 'intro' },
      { n: 8, p: 'a', m: ['A', 'B', 'A', 'C'], mi: 'flute', pad: 0.7, bass: 'drive', arp: '0.1.2.1.0.1.2.1.', ai: 'pluck', dr: 'main', cr: 'cymb', name: 'A' },
      { n: 8, p: 'b', m: ['D', 'E', 'D', 'C'], mi: 'erhu', dbl: { i: 'koto', o: 0, v: 0.4 }, pad: 0.7, bass: 'pulse', arp: '0.2.1.3.0.2.1.3.', ai: 'pluck', dr: 'main', name: 'B' },
      { n: 8, p: 'd', m: ['H', 'H+1', 'H', 'H-1'], mi: 'koto', mv: 1, pad: 0.9, bass: 'sub', arp: '5.....4.....3...', ai: 'bell', dr: 'lite', name: 'interlude' },
      { n: 8, p: 'c', m: ['F', 'G', 'F', 'C'], mi: 'saw', mv: 0.8, dbl: { i: 'flute', o: 1, v: 0.45 }, pad: 0.8, bass: 'drive', arp: '01230123.1.2.3.4', ai: 'pluck', dr: 'hard', cr: 'cymb', name: 'chorus' },
    ],
  },
  // 约 96 BPM，夜色羽调 G：雨滴古筝随机点缀，摇摆brush鼓，二胡低吟
  stage2: {
    bpm: 96, root: 55, mode: 'yu', sw: 0.16,
    chords: { a: '0:m7 -4:M7 -2:M 5:m7', b: '5:m7 0:m7 -4:M7 -2:s4', c: '-4:M7 -2:M 0:m7 0:m7/7:s4' },
    ph: {
      A: '6 - . 5 6 - 8 - | 7 - 6 - 5 - . .', B: '6 - . 5 6 - 8 - | 9 - 8 - 6 - 5 -', C: '5 . 6 . 7 - 6 5 | 3 - 5 - 4 - . .',
      D: '8 - 7 - 6 - 5 . | 6 - 5 - 3 - 2 -', E: '9 - 8 6 7 - 6 - | 5 - 3 - 2 - 0 -',
      F: '(56) 7 (65) 3 (56) 7 (89) 8 | (76) 5 (43) 2 3 - . .', G: '3 . 5 . 6 - 5 - | 3 - 2 - 3 - . .',
    },
    bass: { sub: 'r-----------r---', walk: 'r-----f-r-----o-', pulse: 'r..r..r.r..r..f.' },
    dr: {
      lite: { w: '..x.......x.....', h: 'g.g.g.g.g.g.g.g.' },
      main: { k: 'X.......X..x....', w: '....x.......x...', h: 'gxgxgxgxgxgxgxgx', o: '..............x.', t: '........X.......' },
    },
    secs: [
      { n: 4, p: 'a', pad: 0.7, rain: 0.12, cr: 'gong', intro: true, name: 'intro' },
      { n: 8, p: 'a', m: ['A', 'B', 'A', 'E'], mi: 'erhu', mv: 0.85, pad: 0.9, bass: 'sub', rain: 0.1, dr: 'lite', name: 'A' },
      { n: 8, p: 'b', m: ['C', 'D', 'C', 'E'], mi: 'flute', pad: 0.8, bass: 'walk', arp: '0..2..4.0..2..3.', ai: 'bell', dr: 'main', rain: 0.06, name: 'B' },
      { n: 8, p: 'c', m: ['F', 'F+1', 'G', 'G-1'], mi: 'koto', mv: 0.9, pad: 1, bass: 'sub', rain: 0.18, dr: 'lite', cr: 'gong', name: 'bridge' },
      { n: 8, p: 'a', m: ['A', 'B', 'C+2', 'E'], mi: 'erhu', dbl: { i: 'koto', o: 1, v: 0.4 }, pad: 0.9, bass: 'pulse', arp: '0.2.4.2.0.2.4.5.', ai: 'bell', dr: 'main', rain: 0.08, name: "A'" },
    ],
  },
  // 约 132 BPM，激昂徵调 G：锯齿主音，奔马鼓，雷暴桥段，末段升调
  stage3: {
    bpm: 132, root: 55, mode: 'zhi',
    chords: { a: '0:s2 5:s2 4:m7 7:s4', b: '4:m7 2:m7 5:M7 7:s4', c: '4:m7 5:M7 2:m7 7:s4' },
    ph: {
      A: '5 5 . 7 8 - 7 5 | 6 - 5 3 5 - . .', B: '5 5 . 7 8 - A 8 | 9 - 8 7 8 - - .', C: 'A - 8 7 8 - 5 7 | 8 - 7 6 5 - - -',
      D: '8 8 . 9 A - 9 8 | 7 - 8 - 5 - . .', E: 'A - . 9 A - 8 - | 7 - 6 - 5 - - -',
      F: '(56) (78) A - (98) (76) 5 - | (56) (78) 9 - (87) (65) 3 -', G: '3 - 5 - 6 - 7 - | 8 - - - . . . .',
    },
    bass: { gallop: 'r.rr.rr.r.rr.rr.', drive: 'rrrrrrrrrrrrrrrr', oct: 'r.o.r.o.r.o.r.f.' },
    dr: {
      main: { k: 'X..x..X.X..x..X.', s: '....X.......X...', h: 'xgxgxgxgxgxgxgxg', t: 'X.......X.......', o: '..............x.' },
      hard: { k: 'X.xxX.x.X.xxX.xx', s: '....X..g....X.gx', h: 'xxxxxxxxxxxxxxxx', t: 'X..x..X.X..x..X.', c: '....X.......X...' },
    },
    secs: [
      { n: 4, p: 'a', pad: 0.5, bass: 'drive', arp: '0123432101234321', ai: 'pluck', dr: 'main', cr: 'cymb', intro: true, name: 'intro' },
      { n: 8, p: 'a', m: ['A', 'B', 'A', 'C'], mi: 'saw', mv: 0.85, pad: 0.6, bass: 'gallop', arp: '0.1.2.3.4.3.2.1.', ai: 'pluck', dr: 'main', cr: 'cymb', name: 'A' },
      { n: 8, p: 'b', m: ['D', 'E', 'D', 'E'], mi: 'erhu', dbl: { i: 'saw', o: 0, v: 0.5 }, pad: 0.7, bass: 'oct', arp: '01230123.1.2.3.4', ai: 'pluck', dr: 'main', name: 'B' },
      { n: 8, p: 'c', m: ['G', 'G+1', 'G+2', 'G+3'], mi: 'saw', mv: 0.7, pad: 0.9, bass: 'drive', arp: '0123456701234567', ai: 'pluck', dr: 'hard', koto: 'S...............', name: 'storm' },
      { n: 8, p: 'a', m: ['A', 'B', 'D', 'E'], mi: 'saw', mv: 0.85, dbl: { i: 'flute', o: 1, v: 0.5 }, pad: 0.8, bass: 'gallop', arp: '0.1.2.3.4.3.2.1.', ai: 'pluck', dr: 'hard', tr: 2, cr: 'cymb', name: 'final' },
    ],
  },
  // 约 140 BPM，角调 E：凝重的十六分贝斯，半速桥段
  boss: {
    bpm: 140, root: 52, mode: 'jue',
    chords: { a: '0:m 8:M7 10:s4 5:m7', b: '0:m 1:M 0:m 10:s4', c: '0:p5 1:M 0:p5 10:s4' },
    ph: {
      A: '5 . 5 (65) . 8 . 7 | 6 . 5 . 3 - . .', B: '5 . 5 (65) . 8 . A | 9 . 8 . 7 - 6 .', C: 'A - 9 8 9 - 7 - | 8 - 7 6 5 - - -',
      D: '8 8 . 9 A - 9 8 | 6 - 7 - 5 - . .', E: 'A A . 9 8 - 6 - | 7 - 6 - 5 - - -',
      F: '(56) (56) 8 (87) (65) (43) 5 - | (56) (56) 9 (98) (76) (54) 5 -', G: '5 - - - 6 - - - | 7 - - - 8 - 9 -',
    },
    bass: { gr: 'r.rr.rr.r.rr.rr.', pulse: 'rrrrrrrrrrrrrrrr', half: 'r-------r-------', oct: 'r.ro.ro.r.ro.ro.' },
    dr: {
      main: { k: 'X..xX.x.X..xX.x.', s: '....X.......X...', h: 'xxxxxxxxxxxxxxxx', t: 'X...X...X...X.x.', o: '..............x.' },
      half: { k: 'X.......x.x.....', s: '........X.......', h: 'x.x.x.x.x.x.x.x.', t: 'X.......X.......' },
      hard: { k: 'X.xxX.xxX.xxX.xx', s: '....X..g....X.gx', h: 'xxxxxxxxxxxxxxxx', t: 'X..x..X.X..x..X.', c: '....X.......X...', o: '..x...x...x...x.' },
    },
    secs: [
      { n: 4, p: 'c', pad: 0.5, bass: 'half', dr: 'half', cr: 'gong', intro: true, name: 'intro' },
      { n: 8, p: 'a', m: ['A', 'B', 'A', 'B'], mi: 'saw', mv: 0.85, pad: 0.6, bass: 'gr', arp: '0.1.2.1.0.1.2.3.', ai: 'pluck', dr: 'main', cr: 'cymb', name: 'A' },
      { n: 8, p: 'b', m: ['C', 'D', 'C', 'E'], mi: 'erhu', dbl: { i: 'saw', o: 0, v: 0.45 }, pad: 0.7, bass: 'oct', arp: '0.1.2.1.0.1.2.3.', ai: 'pluck', dr: 'main', name: 'B' },
      { n: 8, p: 'c', m: ['G', 'G+1', 'G', 'G+1'], mi: 'erhu', mv: 0.8, pad: 1, bass: 'half', arp: '0123456701234567', ai: 'pluck', dr: 'half', name: 'break' },
      { n: 8, p: 'a', m: ['A', 'B', 'C', 'E'], mi: 'saw', mv: 0.85, dbl: { i: 'erhu', o: 1, v: 0.5 }, pad: 0.8, bass: 'pulse', arp: '0.1.2.1.0.1.2.3.', ai: 'pluck', dr: 'hard', cr: 'cymb', name: 'final' },
    ],
  },
  // 约 150 BPM，商调 D：史诗，合唱式 pad，重太鼓，末段升调
  finalboss: {
    bpm: 150, root: 50, mode: 'shang',
    chords: { a: '0:m 8:M 10:M 7:m', b: '8:M 10:M 0:m 7:m/10:M', c: '0:m 3:M 8:M 10:s4' },
    ph: {
      A: '5 - 7 - 8 - 7 6 | 5 - 4 - 5 - . .', B: '5 - 7 - 8 - A 9 | 8 - 7 - 6 - . .', C: 'A - 9 - 8 - 7 6 | 7 - 8 - 9 - - -',
      D: '9 - A 9 8 - 6 7 | 8 - 7 6 5 - - -', E: 'A A - 9 8 - 9 A | B - A - 8 - - -',
      F: '(56) (78) 9 - (A9) (87) 6 - | (56) (78) A - (98) (76) 5 -', G: '0 - - - 2 - - - | 3 - 4 - 5 - - -',
    },
    bass: { epic: 'r.rrr.r.r.rrr.f.', oct: 'r.o.r.o.r.o.r.o.', pulse: 'rrrrrrrrrrrrrrrr', half: 'r-------r-------' },
    dr: {
      half: { k: 'X.......X.......', t: 'X.......X.......', c: '........X.......' },
      main: { k: 'X..xX..xX..xX..x', s: '....X.......X...', h: 'xgxgxgxgxgxgxgxg', t: 'X..x..X.X.x...X.', o: '..............x.' },
      hard: { k: 'X.xxX.xxX.xxX.xx', s: '....X..g....X.gx', h: 'xxxxxxxxxxxxxxxx', t: 'XX.xX.XxXX.xX.Xx', c: '....X.......X...', o: '..x...x...x...x.' },
    },
    secs: [
      { n: 4, p: 'c', pad: 1, bass: 'half', dr: 'half', cr: 'gong', intro: true, name: 'intro' },
      { n: 8, p: 'a', m: ['A', 'B', 'A', 'D'], mi: 'erhu', mv: 0.9, dbl: { i: 'saw', o: 0, v: 0.35 }, pad: 1, bass: 'epic', arp: '0.1.2.3.4.3.2.1.', ai: 'pluck', dr: 'main', cr: 'cymb', name: 'A' },
      { n: 8, p: 'b', m: ['C', 'D', 'C', 'E'], mi: 'saw', mv: 0.8, dbl: { i: 'erhu', o: 0, v: 0.6 }, pad: 1, bass: 'oct', arp: '01230123.1.2.3.4', ai: 'pluck', koto: 'S.......S.......', dr: 'main', name: 'B' },
      { n: 8, p: 'c', m: ['F', 'F+1', 'G', 'G+3'], mi: 'koto', mv: 0.95, pad: 1, bass: 'half', arp: '0123456701234567', ai: 'bell', dr: 'half', cr: 'gong', name: 'break' },
      { n: 8, p: 'a', m: ['C', 'E', 'D', 'E'], mi: 'saw', mv: 0.85, dbl: { i: 'erhu', o: 0, v: 0.6 }, pad: 1, bass: 'pulse', arp: '01230123.1.2.3.4', ai: 'pluck', koto: 'S.......S.......', dr: 'hard', tr: 2, cr: 'cymb', name: 'final' },
    ],
  },
  // 短乐句（不循环）：C 宫，笛与筝的凯旋
  clear: {
    bpm: 100, root: 60, mode: 'gong', loop: false,
    chords: { a: '0:M 5:M7 7:s4 0:M/0:s2' },
    ph: { A: '5 5 7 - 8 - . . | 7 8 9 - A - - -', B: '9 - 8 - 7 - 5 - | 6 - 7 - 8 - - -', D: 'A - 9 - 8 - 7 - | 5 - - - - - - -' },
    bass: { s: 'r---r---f---r---' },
    dr: { f: { t: 'X...X...X...X...', k: 'X.......X.......', h: '..x...x...x...x.', c: '........X.......' } },
    secs: [
      { n: 8, p: 'a', m: ['A', 'A+1', 'B', 'D'], mi: 'flute', mv: 0.9, dbl: { i: 'koto', o: 0, v: 0.6 }, pad: 0.8, bass: 's', koto: 'S.......S.......', dr: 'f', cr: 'gong', name: 'clear' },
    ],
  },
  gameover: {
    bpm: 60, root: 57, mode: 'yu', loop: false,
    chords: { a: '0:m7 -4:M7 -2:s2 0:m' },
    ph: { A: '6 - - - 5 - - - | 3 - - - 2 - - -', B: '3 - - - 2 - - - | 1 - - - 0 - - -', C: '2 - - - 1 - - - | 0 - - - - - - -' },
    bass: { s: 'r---------------' },
    dr: {},
    secs: [{ n: 6, p: 'a', m: ['A', 'B', 'C'], mi: 'erhu', mv: 0.85, pad: 1, bass: 's', koto: 'S...............', cr: 'gong', name: 'over' }],
  },
  // 84 BPM，宫调 D：抒情，古筝与笛，最后一段太鼓轻起
  ending: {
    bpm: 84, root: 62, mode: 'gong',
    chords: { a: '0:M7 -3:m7 5:M7 7:s4', b: '5:M7 7:s4 4:m7 -3:m7', c: '-3:m7 5:M7 0:s2 7:s4' },
    ph: {
      A: '5 - - 6 7 - 6 - | 5 - 4 - 3 - . .', B: '5 - - 6 7 - 8 - | 7 - 6 - 5 - - -', C: '8 - 9 - 8 - 7 - | 6 - 7 - 5 - . .',
      D: '9 - 8 - 7 - 6 5 | 6 - 5 - 3 - - -', E: '7 - 8 - 9 - 8 6 | 7 - - - 5 - - -',
      F: '(34) (56) 7 - (65) (43) 5 - | (34) (56) 8 - (76) (54) 3 -', G: '3 - 5 - 7 - 5 - | 4 - 3 - 0 - - -',
    },
    bass: { sub: 'r---------------', two: 'r-------f-------' },
    dr: { soft: { t: 'X...............', h: '..g...g...g...g.', w: '........x.......' } },
    secs: [
      { n: 4, p: 'a', pad: 0.8, koto: 'S...............', ai: 'bell', arp: '4.......5.......', cr: 'gong', intro: true, name: 'intro' },
      { n: 8, p: 'a', m: ['A', 'B', 'A', 'D'], mi: 'flute', mv: 0.9, pad: 0.9, bass: 'sub', koto: '0...2...3...2...', name: 'A' },
      { n: 8, p: 'b', m: ['C', 'D', 'C', 'E'], mi: 'erhu', dbl: { i: 'flute', o: 1, v: 0.4 }, pad: 0.9, bass: 'two', koto: 'S.......2...1...', name: 'B' },
      { n: 8, p: 'c', m: ['F', 'F+1', 'F', 'G'], mi: 'koto', mv: 0.95, pad: 0.9, bass: 'sub', ai: 'bell', arp: '5.......4.......', rain: 0.04, name: 'interlude' },
      { n: 8, p: 'a', m: ['A', 'B', 'E', 'D'], mi: 'erhu', dbl: { i: 'flute', o: 1, v: 0.5 }, pad: 1, bass: 'two', koto: 'S...............', ai: 'bell', arp: '0...2...3...2...', dr: 'soft', cr: 'gong', name: 'final' },
    ],
  },
};

// ---------------------------------------------------------------- 编译
function degChar(c: string): number {
  if (c >= '0' && c <= '9') return +c;
  if (c >= 'A' && c <= 'F') return 10 + c.charCodeAt(0) - 65;
  return -(c.charCodeAt(0) - 96); // a=-1 b=-2 c=-3
}
interface PN { st: number; deg: number; len: number }
function parsePhrase(s: string): PN[] {
  const toks = s.replace(/\|/g, ' ').trim().split(/\s+/);
  const out: PN[] = [];
  toks.forEach((t, i) => {
    const st = i * 2;
    if (t === '.') return;
    if (t === '-') { if (out.length) out[out.length - 1].len += 2; return; }
    if (t[0] === '(') { out.push({ st, deg: degChar(t[1]), len: 1 }, { st: st + 1, deg: degChar(t[2]), len: 1 }); return; }
    out.push({ st, deg: degChar(t), len: 2 });
  });
  return out;
}
function phraseNotes(ph: Record<string, string>, spec: string): PN[] {
  const m = /^([A-H])([+-]\d+)?(i)?$/.exec(spec);
  if (!m) return [];
  const notes = parsePhrase(ph[m[1]]);
  const sh = m[2] ? +m[2] : 0;
  if (m[3] && notes.length) { const c = notes[0].deg; notes.forEach((n) => { n.deg = 2 * c - n.deg; }); }
  notes.forEach((n) => { n.deg += sh; });
  return notes;
}

interface Chord { rel: number; type: string; start: number; len: number }
function barChords(prog: string, bar: number): Chord[] {
  const toks = prog.split(' ');
  const tk = toks[bar % toks.length];
  const parts = tk.split('/');
  return parts.map((p, i) => { const [r, t] = p.split(':'); return { rel: +r, type: t, start: i * (16 / parts.length), len: 16 / parts.length }; });
}

const VEL: Record<string, number> = { x: 0.75, X: 1, g: 0.38 };
const DRUM_KEYS: Record<string, string> = { k: 'kick', s: 'snare', h: 'hat', o: 'ohat', t: 'taiko', c: 'clap', w: 'wood' };

export function compile(id: MusicId): Song {
  const def = DEFS[id];
  if (!def) throw new Error(`仅采样曲目没有离线合成谱：${id}`);
  const mode = MODES[def.mode];
  const total = def.secs.reduce((a, s) => a + s.n, 0) * 16;
  const ev: Ev[][] = Array.from({ length: total }, () => []);
  const R = rng(id.length * 131 + def.bpm);
  const put = (s: number, e: Ev) => { if (s >= 0 && s < total) ev[s].push(e); };
  const deg2semi = (d: number) => 12 * Math.floor(d / 5) + mode[((d % 5) + 5) % 5];
  let cur = 0; let loopStart = 0; let seenBody = false;
  const sections: Song['sections'] = [];
  for (const sec of def.secs) {
    if (!sec.intro) seenBody = true;
    if (!seenBody) loopStart = cur + sec.n * 16;
    sections.push({ name: sec.name ?? '', start: cur, bars: sec.n });
    const r = def.root + (sec.tr ?? 0);
    const prog = def.chords[sec.p];
    const pat = sec.dr ? def.dr[sec.dr] : undefined;
    if (sec.cr) put(cur, { k: sec.cr, v: 0.9, n: sec.cr === 'gong' ? r - 24 : undefined });
    for (let b = 0; b < sec.n; b++) {
      const bs = cur + b * 16;
      const chs = barChords(prog, b);
      const chordAt = (s: number) => (chs.length === 2 && s >= 8 ? chs[1] : chs[0]);
      const voicing = (c: Chord) => CH[c.type].map((iv) => { const base = r - 2; return base + ((((c.rel + iv - -2) % 12) + 12) % 12); }).sort((a, b2) => a - b2);
      // pad
      if (sec.pad) for (const c of chs) put(bs + c.start, { k: 'pad', ns: voicing(c), v: sec.pad, d: c.len });
      // bass
      if (sec.bass) {
        const bp = def.bass[sec.bass];
        const p = bp.length >= 32 ? bp.slice((b % 2) * 16, (b % 2) * 16 + 16) : bp;
        for (let s = 0; s < 16; s++) {
          const ch = p[s];
          if (ch === '.' || ch === '-') continue;
          let len = 1; while (s + len < 16 && p[s + len] === '-') len++;
          const c = chordAt(s);
          let n = r + c.rel - 24; while (n < 31) n += 12; while (n >= 43) n -= 12;
          if (ch === 'f') n += 7; else if (ch === 'o') n += 12;
          put(bs + s, { k: len > 3 ? 'bassS' : 'bass', n, v: 0.9, d: len });
        }
      }
      // 琶音 / 古筝
      const chordArp = (patStr: string | undefined, kind: string, vel: number, base: number) => {
        if (!patStr) return;
        for (let s = 0; s < 16; s++) {
          const ch = patStr[s % patStr.length];
          if (ch === '.') continue;
          const c = chordAt(s);
          const v = voicing(c);
          if (ch === 'S') {
            const all = [...v, v[0] + 12, v[1] + 12];
            all.forEach((n, i) => put(bs + s, { k: kind, n: n + base - 12 + 12, v: vel, o: i * 0.038 }));
          } else {
            const tones = [...v.map((n) => n + 12 + base), ...v.map((n) => n + 24 + base)];
            put(bs + s, { k: kind, n: tones[+ch % tones.length], v: vel * (s % 4 === 0 ? 1 : 0.8), d: 1 });
          }
        }
      };
      chordArp(sec.arp, sec.ai ?? 'pluck', 0.8, 0);
      chordArp(sec.koto, 'koto', 0.7, 0);
      // 雨滴
      if (sec.rain) for (let s = 0; s < 16; s++) if (R() < sec.rain) { put(bs + s, { k: R() < 0.7 ? 'koto' : 'bell', n: r + 12 + deg2semi(4 + Math.floor(R() * 6)), v: 0.35 + R() * 0.3 }); }
      // 鼓
      if (pat) {
        for (const key of Object.keys(pat)) {
          const p = pat[key];
          for (let s = 0; s < 16; s++) {
            const ch = p[(b % (p.length / 16) * 16 + s) % p.length];
            if (ch === '.' || ch === undefined) continue;
            put(bs + s, { k: DRUM_KEYS[key], v: VEL[ch] ?? 0.7 });
          }
        }
        if (b === sec.n - 1 && sec.dr !== 'lite' && sec.dr !== 'soft' && sec.dr !== 'half') {
          for (let s = 8; s < 16; s += 2) put(bs + s, { k: 'taiko', v: 0.5 + (s - 8) * 0.07 });
          for (let s = 12; s < 16; s++) put(bs + s, { k: 'snare', v: 0.45 + (s - 12) * 0.15 });
        }
      }
    }
    // 旋律
    if (sec.m && sec.mi) {
      sec.m.forEach((spec, k) => {
        const notes = phraseNotes(def.ph, spec);
        const ps = cur + k * 32;
        for (const n of notes) {
          const semi = r + deg2semi(n.deg) + (sec.mo ?? 0) * 12;
          const acc = n.st % 8 === 0 ? 1 : n.st % 4 === 0 ? 0.92 : 0.82;
          const v = (sec.mv ?? 0.9) * acc;
          const kind = sec.mi === 'koto' ? 'koto' : 'lead:' + sec.mi;
          put(ps + n.st, { k: kind, n: semi, v, d: Math.max(1, n.len - 0.15) });
          if (sec.dbl) {
            const dk = sec.dbl.i === 'koto' ? 'koto' : 'lead:' + sec.dbl.i;
            put(ps + n.st, { k: dk, n: semi + sec.dbl.o * 12, v: v * sec.dbl.v, d: Math.max(1, n.len - 0.15) });
          }
        }
      });
    }
    // 器城主题：同一五声音级轮廓，晓山弦脊、灯河泛音、云垣弓弦齿轮。
    if(id==='stage1'||id==='stage2'||id==='stage3'){
      const motif=[0,2,4,2,0],positions=[0,3,6,10,14];
      const kind=id==='stage1'?'koto':id==='stage2'?'bell':'lead:erhu';
      const register=id==='stage2'?12:0;
      for(let i=0;i<motif.length;i++)put(cur+positions[i],{k:kind,n:r+12+deg2semi(motif[i])+register,v:id==='stage3'?.32:.38,d:id==='stage3'?1.6:2.5});
    }
    cur += sec.n * 16;
  }
  return { id, bpm: def.bpm, sw: def.sw ?? 0, steps: total, loopStart, loop: def.loop !== false, ev, sections };
}

const cache = new Map<MusicId, Song>();
export function getSong(id: MusicId): Song {
  let s = cache.get(id);
  if (!s) { s = compile(id); cache.set(id, s); }
  return s;
}
export const MUSIC_IDS = Object.keys(DEFS) as MusicId[];
