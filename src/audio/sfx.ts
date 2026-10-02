// 音效：逐个设计。节流 / 复音限制在 SFX_LIMITS。
import { V, env, ar, mtof, focusCue, type Graph, type Out } from './engine';
import type { Sfx } from '../types';

interface P { v: number; pitch: number; pan: number }
type Fn = (G: Graph, o: Out, t: number, p: P) => void;

interface TOpt { f: number; f2?: number; dur: number; type?: OscillatorType; vol: number; a?: number; wet?: number; lp?: number; lp2?: number; q?: number; at?: number; sweep?: number; pan?: number }
function tone(G: Graph, o: Out, t0: number, p: P, x: TOpt) {
  const t = t0 + (x.at ?? 0);
  const s = new V(G.ctx, o, G, x.pan ?? p.pan);
  const f = x.f * p.pitch;
  const os = s.osc(x.type ?? 'sine', f, t);
  if (x.f2) os.frequency.exponentialRampToValueAtTime(Math.max(20, x.f2 * p.pitch), t + (x.sweep ?? x.dur));
  const g = s.gain(0); env(g.gain, t, x.a ?? 0.004, x.vol * p.v, t + x.dur);
  if (x.lp) {
    const l = s.filt('lowpass', x.lp, x.q ?? 0.8);
    if (x.lp2) l.frequency.exponentialRampToValueAtTime(x.lp2, t + x.dur);
    os.connect(l); l.connect(g);
  } else os.connect(g);
  s.send(g, x.wet ?? 0); s.end(t + x.dur + 0.03);
}
interface NOpt { f: number; f2?: number; dur: number; vol: number; type?: BiquadFilterType; q?: number; a?: number; wet?: number; at?: number; pan?: number }
function noise(G: Graph, o: Out, t0: number, p: P, x: NOpt) {
  const t = t0 + (x.at ?? 0);
  const s = new V(G.ctx, o, G, x.pan ?? p.pan);
  const n = s.noise(t);
  const fl = s.filt(x.type ?? 'bandpass', x.f * p.pitch, x.q ?? 1);
  if (x.f2) fl.frequency.exponentialRampToValueAtTime(x.f2 * p.pitch, t + x.dur);
  const g = s.gain(0);
  if ((x.a ?? 0.002) > 0.05) ar(g.gain, t, x.a!, x.vol * p.v, x.dur * 0.7, x.dur * 0.3); else env(g.gain, t, x.a ?? 0.002, x.vol * p.v, t + x.dur);
  n.connect(fl); fl.connect(g); s.send(g, x.wet ?? 0); s.end(t + x.dur + 0.03);
}
// 音符序列（MIDI）
function notes(G: Graph, o: Out, t: number, p: P, ms: number[], gap: number, x: Partial<TOpt>) {
  ms.forEach((m, i) => tone(G, o, t, { ...p, pitch: p.pitch }, { f: mtof(m), dur: 0.3, vol: 0.2, ...x, at: i * gap }));
}
const rumble = (G: Graph, o: Out, t: number, p: P, dur: number, vol: number, at = 0) => {
  noise(G, o, t, p, { f: 500, f2: 60, dur, vol, type: 'lowpass', q: 0.7, a: 0.004, wet: 0.2, at, pan: 0 });
  tone(G, o, t, p, { f: 90, f2: 30, dur: dur * 0.8, vol: vol * 1.2, at, pan: 0, type: 'sine' });
};

const FX: Partial<Record<Sfx, Fn>> = {
  // 朱：拨弦刀口和窄铜脊，短释放留出每一轮羽刃之间的空隙。
  shot_red: (G,o,t,p)=>{
    tone(G,o,t,p,{f:640,f2:310,dur:.065,vol:.10,type:'triangle',lp:2100});
    tone(G,o,t,p,{f:1320,f2:1140,dur:.085,vol:.038,wet:.025});
    noise(G,o,t,p,{f:2300,f2:1100,dur:.04,vol:.065,q:1.8});
  },
  // 青：玉流泛音，少噪声、平滑起音，两个谐振峰形成稳定切面。
  shot_blue: (G,o,t,p)=>{
    tone(G,o,t,p,{f:880,f2:850,dur:.17,vol:.085,a:.025,wet:.045});
    tone(G,o,t,p,{f:1760,f2:1700,dur:.145,vol:.035,a:.018});
    noise(G,o,t,p,{f:1050,f2:790,dur:.10,vol:.021,q:3,a:.015});
  },
  // 雷：低紫电身体、金属双击和短窄带电蚀，不铺宽带白噪墙。
  shot_purple: (G,o,t,p)=>{
    tone(G,o,t,p,{f:230,f2:920,dur:.035,vol:.085,type:'triangle',lp:1800});
    tone(G,o,t,p,{f:980,f2:740,dur:.085,vol:.050,at:.018,wet:.025});
    tone(G,o,t,p,{f:1440,dur:.06,vol:.028,at:.038});
    noise(G,o,t,p,{f:3200,dur:.022,vol:.050,q:3});
  },
  missile: (G, o, t, p) => { noise(G, o, t, p, { f: 500, f2: 2600, dur: 0.28, vol: 0.13, type: 'lowpass', a: 0.06 }); tone(G, o, t, p, { f: 110, f2: 220, dur: 0.22, vol: 0.06, type: 'sawtooth', lp: 500 }); },
  hit: (G, o, t, p) => { noise(G, o, t, p, { f: 2200, dur: 0.04, vol: 0.14, q: 1.5 }); tone(G, o, t, p, { f: 520, f2: 300, dur: 0.045, vol: 0.09, type: 'triangle' }); },
  hit_armor:(G,o,t,p)=>{
    // 阻挡为短促双金属回弹；普通hit仍有低频穿甲身体。
    tone(G,o,t,p,{f:1530,dur:.115,vol:.105,a:.001,wet:.025});
    tone(G,o,t,p,{f:1530*1.47,dur:.075,vol:.052,a:.001});
    tone(G,o,t,p,{f:930,f2:720,dur:.045,vol:.048,at:.022,type:'triangle'});
  },
  explode_s: (G,o,t,p) => { noise(G,o,t,p,{f:150,dur:.28,vol:.4,type:'lowpass'}); noise(G,o,t,p,{f:1800,f2:450,dur:.22,vol:.2,q:.5}); },
  explode_m: (G,o,t,p) => { noise(G,o,t,p,{f:170,dur:.55,vol:.5,type:'lowpass'}); noise(G,o,t,p,{f:2000,f2:350,dur:.4,vol:.3,q:.5}); },
  explode_l: (G,o,t,p) => { noise(G,o,t,p,{f:190,dur:.9,vol:.6,type:'lowpass'}); noise(G,o,t,p,{f:1800,f2:250,dur:.7,vol:.3,q:.5}); },
  explode_boss: (G,o,t,p) => { for(let i=0;i<4;i++){noise(G,o,t,p,{f:160,dur:1.1,vol:.35,type:'lowpass',at:i*.3});noise(G,o,t,p,{f:2200,f2:400,dur:.5,vol:.2,at:i*.3,q:.5});} },
  graze: (G,o,t,p) => noise(G,o,t,p,{f:2600,dur:.065,vol:.08,q:.5,a:.01}),
  item: (G,o,t,p) => { noise(G,o,t,p,{f:1700,dur:.1,vol:.16,q:.65}); noise(G,o,t,p,{f:2900,dur:.08,vol:.09,at:.045,q:.8}); },
  powerup: (G,o,t,p) => { noise(G,o,t,p,{f:850,f2:2100,dur:.35,vol:.18,a:.035,q:.6}); },
  weapon_change: (G,o,t,p) => noise(G,o,t,p,{f:500,f2:2300,dur:.23,vol:.18,a:.035,q:.7}),
  medal: (G,o,t,p) => { noise(G,o,t,p,{f:2100,dur:.12,vol:.18,q:.8}); noise(G,o,t,p,{f:1200,dur:.2,vol:.08,at:.06}); },
  bomb:(G,o,t,p)=>{ noise(G,o,t,p,{f:850,f2:1900,dur:.18,vol:.18,a:.035,q:.6}); noise(G,o,t,p,{f:180,dur:1.1,vol:.6,type:'lowpass',at:.11}); noise(G,o,t,p,{f:1700,f2:300,dur:.6,vol:.3,at:.11,q:.5}); },
  brush_start: (G, o, t, p) => { noise(G, o, t, p, { f: 250, f2: 1100, dur: 0.55, vol: 0.2, a: 0.25, q: 0.9, wet: 0.35 }); tone(G, o, t, p, { f: 220, f2: 150, dur: 0.5, vol: 0.12, wet: 0.3 }); },
  brush_release:(G,o,t,p)=>{
    // 执笔有弦锋的上挑，释放落到印封之前的低铜音。
    noise(G,o,t,p,{f:850,f2:2500,dur:.11,vol:.13,q:1.7});
    notes(G,o,t,p,[62,69,74],.032,{dur:.14,vol:.09,type:'triangle',wet:.08});
    tone(G,o,t,p,{f:160,f2:74,dur:.34,vol:.21,at:.09});
  },
  slash: (G, o, t, p) => { noise(G, o, t, p, { f: 1500, f2: 7500, dur: 0.14, vol: 0.28, q: 1.4, wet: 0.15 }); tone(G, o, t, p, { f: 2000, f2: 1800, dur: 0.25, vol: 0.06, at: 0.05, wet: 0.3 }); },
  seal:(G,o,t,p)=>{
    tone(G,o,t,p,{f:98,f2:51,dur:.30,vol:.34});
    noise(G,o,t,p,{f:750,dur:.065,vol:.12,type:'lowpass'});
    [1,1.47,2.56].forEach((r,i)=>tone(G,o,t,p,{f:260*r,dur:.72-i*.14,vol:.085/(1+i*.65),at:.025,a:.002,wet:.13}));
    tone(G,o,t,p,{f:520,f2:390,dur:.12,vol:.035,at:.13});
  },
  player_die: (G, o, t, p) => {
    tone(G, o, t, p, { f: 700, f2: 50, dur: 1.0, vol: 0.2, type: 'sawtooth', lp: 2500, lp2: 200 });
    noise(G, o, t, p, { f: 3000, f2: 150, dur: 1.1, vol: 0.4, type: 'lowpass', wet: 0.4 }); tone(G, o, t, p, { f: 95, f2: 28, dur: 1.0, vol: 0.5 });
  },
  extend: (G,o,t,p) => noise(G,o,t,p,{f:1300,f2:2800,dur:.5,vol:.18,a:.12,q:.6,wet:.1}),
  warning: (G,o,t,p) => { for(let i=0;i<4;i++)noise(G,o,t,p,{f:i%2?900:450,dur:.22,vol:.22,q:1.4,at:i*.3,a:.012}); },
  menu_move: (G,o,t,p) => noise(G,o,t,p,{f:1100,dur:.045,vol:.08,q:.6}),
  menu_ok: (G,o,t,p) => { noise(G,o,t,p,{f:1000,dur:.07,vol:.12,q:.6}); noise(G,o,t,p,{f:1700,dur:.1,vol:.08,at:.06,q:.6}); },
  menu_back: (G,o,t,p) => noise(G,o,t,p,{f:750,dur:.12,vol:.1,q:.6,a:.015}),
  enemy_shot: (G, o, t, p) => { tone(G, o, t, p, { f: 620, f2: 330, dur: 0.08, vol: 0.07 }); noise(G, o, t, p, { f: 1800, dur: 0.03, vol: 0.03 }); },
  enemy_shot_big: (G, o, t, p) => { tone(G, o, t, p, { f: 320, f2: 120, dur: 0.2, vol: 0.14, type: 'sawtooth', lp: 1200, lp2: 300 }); noise(G, o, t, p, { f: 900, f2: 300, dur: 0.15, vol: 0.08 }); },
  laser_charge: (G, o, t, p) => {
    tone(G, o, t, p, { f: 140, f2: 1500, dur: 1.1, vol: 0.14, type: 'sawtooth', lp: 500, lp2: 5000, a: 0.9, wet: 0.2 });
    tone(G, o, t, p, { f: 70, f2: 420, dur: 1.1, vol: 0.2, a: 0.9 }); noise(G, o, t, p, { f: 800, f2: 6000, dur: 1.1, vol: 0.07, a: 0.9, q: 2 });
  },
  laser_fire: (G, o, t, p) => {
    tone(G, o, t, p, { f: 180, f2: 150, dur: 0.9, vol: 0.2, type: 'sawtooth', lp: 4500, lp2: 700, a: 0.01, wet: 0.2 }); tone(G, o, t, p, { f: 184, f2: 154, dur: 0.9, vol: 0.14, type: 'square', lp: 3000, lp2: 600 });
    noise(G, o, t, p, { f: 3500, f2: 900, dur: 0.9, vol: 0.14, q: 0.8, wet: 0.2 }); tone(G, o, t, p, { f: 60, f2: 40, dur: 0.6, vol: 0.3 });
  },
  thunder: (G, o, t, p) => {
    noise(G, o, t, p, { f: 6000, f2: 900, dur: 0.16, vol: 0.32, type: 'highpass' });
    noise(G, o, t, p, { f: 900, f2: 70, dur: 2.2, vol: 0.5, type: 'lowpass', a: 0.06, wet: 0.5, at: 0.05, pan: 0 });
    tone(G, o, t, p, { f: 55, f2: 30, dur: 1.8, vol: 0.4, at: 0.1 });
  },
  boss_phase:(G,o,t,p)=>{
    // 已与美术三拍确认：切口—铰链—落位；余韵不盖住反制预告。
    noise(G,o,t,p,{f:2200,f2:700,dur:.08,vol:.15,q:1.7});
    tone(G,o,t,p,{f:170,f2:65,dur:.22,vol:.27});
    [1,1.47,2.56].forEach((r,i)=>tone(G,o,t,p,{f:210*r,dur:.25-i*.045,vol:.085/(1+i*.6),at:.18,wet:.045}));
    tone(G,o,t,p,{f:105,f2:56,dur:.42,vol:.24,at:.46});
    notes(G,o,t+.46,p,[57,64],.07,{dur:.36,vol:.060,wet:.10});
  },
  stage_clear: (G,o,t,p) => { noise(G,o,t,p,{f:650,f2:2300,dur:.7,vol:.2,a:.1,q:.6}); noise(G,o,t,p,{f:1300,dur:.4,vol:.1,at:.35,a:.05,wet:.15}); },
};

/** gap: 同 id 最小间隔(秒)；max: 同时发声数上限。 */
export const SFX_LIMITS: Partial<Record<Sfx, { gap: number; max: number; life: number }>> = {
  shot_red: { gap: 0.075, max: 2, life: 0.115 }, shot_blue: { gap: 0.10, max: 2, life: 0.20 }, shot_purple: { gap: 0.085, max: 2, life: 0.12 },
  hit_red: { gap: .035, max: 4, life: .08 }, hit_blue: { gap: .035, max: 4, life: .08 }, hit_purple: { gap: .035, max: 4, life: .08 },
  missile: { gap: 0.09, max: 3, life: 0.3 }, hit: { gap: 0.035, max: 4, life: 0.08 }, hit_armor: { gap: 0.05, max: 3, life: 0.15 },
  graze: { gap: 0.045, max: 3, life: 0.07 }, enemy_shot: { gap: 0.045, max: 4, life: 0.1 }, enemy_shot_big: { gap: 0.08, max: 3, life: 0.25 },
  explode_s: { gap: 0.06, max: 3, life: 0.35 }, explode_m: { gap: 0.08, max: 3, life: 0.65 }, explode_l: { gap: 0.15, max: 2, life: 1 },
  explode_boss: { gap: 0.5, max: 1, life: 2.5 }, item: { gap: 0.05, max: 3, life: 0.4 }, medal: { gap: 0.05, max: 3, life: 0.5 },
  slash: { gap: 0.05, max: 3, life: 0.3 }, seal: { gap: 0.1, max: 2, life: 1.5 }, menu_move: { gap: 0.03, max: 2, life: 0.06 },
  thunder: { gap: 0.3, max: 2, life: 2.3 }, laser_charge: { gap: 0.5, max: 1, life: 1.2 }, laser_fire: { gap: 0.3, max: 2, life: 1 },
  boss_phase:{gap:.30,max:1,life:1.05}, bomb:{gap:.5,max:1,life:1.85}, brush_release:{gap:.13,max:2,life:.48},
  warning: { gap: 1, max: 1, life: 1.3 }, powerup: { gap: 0.1, max: 2, life: 0.8 },
};

const BOOST: Partial<Record<Sfx, number>> = { shot_red: 1.35, shot_blue: 1.35, shot_purple: 1.3, hit: 1.6, graze: 1.6, enemy_shot: 1.6, enemy_shot_big: 1.3, slash: 1.4, menu_move: 1.4, hit_armor: 1.3, missile: 1.3, brush_start: 1.4 };
export function playSfx(G: Graph, id: Sfx, t: number, opts?: { pan?: number; vol?: number; pitch?: number }) {
  const finite=(v:number|undefined,f:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(v)?v!:f));
  const p:P={v:finite(opts?.vol,1,0,2)*(BOOST[id]??1),pitch:finite(opts?.pitch,1,.25,4),pan:finite(opts?.pan,0,-1,1)};
  const danger=id==='warning'||id==='laser_charge'||id==='laser_fire';
  const accent=id==='boss_phase'||id==='bomb'||id==='seal'||id==='brush_release';
  if(p.v>0 && (danger||accent))focusCue(G,t,danger?(id==='warning'?1.25:1.1):id==='bomb'?1.0:.6,danger?.23:.53);
  const important=danger||accent||id==='player_die'||id==='enemy_shot_big'||id==='graze'||id.startsWith('menu_');
  (FX[id] ?? FX.hit!)(G,important?G.sfxOut:G.combatOut,t,p);
}
export const SFX_IDS = Object.keys(FX) as Sfx[];
