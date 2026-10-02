// 音频底层：资源预渲染（古筝采样 / 噪声 / 混响脉冲）、总线图、以及各乐器声部。
export type Ctx = BaseAudioContext;
export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- 资源
export interface KotoEntry { buf: AudioBuffer; f: number; midi: number }
export interface Assets { koto: KotoEntry[]; noise: AudioBuffer }
const SR = 44100;
let assets: Assets | null = null;

function mkBuf(len: number, ch = 1): AudioBuffer {
  return new AudioBuffer({ length: len, sampleRate: SR, numberOfChannels: ch });
}

function makeKoto(): KotoEntry[] {
  const r = rng(7);
  const out: KotoEntry[] = [];
  for (let m = 45; m <= 93; m += 4) {
    const f0 = mtof(m);
    const N = Math.max(4, Math.round(SR / f0 - 0.5));
    const f = SR / (N + 0.5);
    const T60 = m < 60 ? 3.2 : m < 78 ? 2.4 : 1.6;
    const g = Math.pow(10, -3 / (f * T60));
    const len = Math.floor(SR * (m < 60 ? 2.8 : m < 78 ? 2.2 : 1.5));
    const line = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += (r() * 2 - 1 - lp) * 0.55; line[i] = lp; }
    const pp = Math.max(1, Math.floor(N * 0.17));
    const ex = new Float32Array(N);
    for (let i = 0; i < N; i++) ex[i] = line[i] - line[(i + pp) % N] * 0.8;
    const data = new Float32Array(len);
    let idx = 0;
    let peak = 0;
    for (let n = 0; n < len; n++) {
      const y = ex[idx];
      const nx = ex[(idx + 1) % N];
      ex[idx] = g * 0.5 * (y + nx);
      data[n] = y;
      if (++idx >= N) idx = 0;
      const a = Math.abs(y); if (a > peak) peak = a;
    }
    const k = 0.9 / (peak || 1);
    const fade = Math.floor(SR * 0.12);
    for (let n = 0; n < len; n++) {
      let x = data[n] * k;
      if (n > len - fade) x *= (len - n) / fade;
      data[n] = x;
    }
    const buf = mkBuf(len);
    buf.copyToChannel(data, 0);
    out.push({ buf, f, midi: m });
  }
  return out;
}

const irCache = new Map<number, AudioBuffer>();
function makeIR(SR: number): AudioBuffer {
  const hit = irCache.get(SR); if (hit) return hit;
  const r = rng(99);
  const len = Math.floor(SR * 2.8);
  const buf = new AudioBuffer({ length: len, sampleRate: SR, numberOfChannels: 2 });
  irCache.set(SR, buf);
  const pre = Math.floor(SR * 0.012);
  for (let c = 0; c < 2; c++) {
    const d = new Float32Array(len);
    let y = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / SR;
      const co = 0.75 * Math.exp(-t * 2.2) + 0.06;
      y += ((r() * 2 - 1) - y) * co;
      d[i] = y * Math.exp(-t * 2.3) * (i < pre + 300 ? (i - pre) / 300 : 1);
    }
    buf.copyToChannel(d, c);
  }
  return buf;
}

export function getAssets(): Assets {
  if (assets) return assets;
  const r = rng(1234);
  const noise = mkBuf(SR * 2);
  const nd = new Float32Array(SR * 2);
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  noise.copyToChannel(nd, 0);
  assets = { koto: makeKoto(), noise };
  return assets;
}

// ---------------------------------------------------------------- 总线
export interface Out { dry: AudioNode; wet: AudioNode; dly?: AudioNode; det?: ConstantSourceNode }
export interface Graph {
  ctx: Ctx; a: Assets;
  musicIn: GainNode; musicFocus: GainNode; musicWetFocus: GainNode; musicDelayFocus: GainNode; combatFocus: GainNode; combatWet: GainNode; mixUntil: number; mixDepth: number; combatOut: Out; sfxIn: GainNode; master: GainNode; lp: BiquadFilterNode;
  revIn: GainNode; revOut: GainNode; dlyIn: GainNode; dlyL: DelayNode; dlyR: DelayNode;
  det: ConstantSourceNode; sfxOut: Out;
}

function softClipCurve(): Float32Array {
  const n = 2048; const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1; const a = Math.abs(x);
    const y = a < 0.7 ? a : 0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

export function buildGraph(ctx: Ctx): Graph {
  const a = getAssets();
  const g = (v: number) => { const x = ctx.createGain(); x.gain.value = v; return x; };
  const musicIn = g(0.2), sfxIn = g(0.85), master = g(0.9);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(20000, ctx.sampleRate * 0.45); lp.Q.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
  const shaper = ctx.createWaveShaper(); shaper.curve = softClipCurve() as Float32Array<ArrayBuffer>; shaper.oversample = '2x';
  const musicFocus=g(1),musicWetFocus=g(1),musicDelayFocus=g(1),combatFocus=g(1),combatWet=g(0.22);
  musicIn.connect(musicFocus);musicFocus.connect(lp);combatFocus.connect(sfxIn);
  sfxIn.connect(lp);
  lp.connect(comp); comp.connect(shaper); shaper.connect(master); master.connect(ctx.destination);
  // 混响
  const revIn = g(1), revOut = g(0.5);
  const conv = ctx.createConvolver(); conv.buffer = makeIR(ctx.sampleRate);
  combatWet.connect(revIn);musicWetFocus.connect(revIn);
  revIn.connect(conv); conv.connect(revOut); revOut.connect(lp);
  // 立体声延迟
  const dlyIn = g(1);musicDelayFocus.connect(dlyIn);
  const mkDly = (t: number, pan: number) => {
    const d = ctx.createDelay(2); d.delayTime.value = t;
    const f = g(0.36); const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2800;
    const p = ctx.createStereoPanner(); p.pan.value = pan; const o = g(0.42);
    dlyIn.connect(d); d.connect(flt); flt.connect(f); f.connect(d); flt.connect(p); p.connect(o); o.connect(lp);
    return d;
  };
  const dlyL = mkDly(0.34, -0.6), dlyR = mkDly(0.51, 0.6);
  const det = ctx.createConstantSource(); det.offset.value = 0; det.start();
  const sw = g(0.22); sw.connect(revIn);
  return { ctx, a, musicIn, musicFocus, musicWetFocus, musicDelayFocus, combatFocus, combatWet, mixUntil:0, mixDepth:1, combatOut:{dry:combatFocus,wet:combatWet}, sfxIn, master, lp, revIn, revOut, dlyIn, dlyL, dlyR, det, sfxOut: { dry: sfxIn, wet: sw } };
}

/** 危险/反制提示给常规声部留出空间，重复提示延长保持，弱提示不抬高正在压低的混音。 */
export function focusCue(G:Graph,t:number,hold:number,depth:number):void {
  const active=t<G.mixUntil;
  G.mixDepth=active?Math.min(G.mixDepth,depth):depth;
  G.mixUntil=Math.max(active?G.mixUntil:0,t+hold);
  for(const [node,target] of [[G.combatFocus,G.mixDepth],[G.combatWet,G.mixDepth*.22],[G.musicFocus,Math.sqrt(G.mixDepth)],[G.musicWetFocus,Math.sqrt(G.mixDepth)],[G.musicDelayFocus,Math.sqrt(G.mixDepth)]] as [GainNode,number][]){
    const p=node.gain;p.cancelAndHoldAtTime(t);p.linearRampToValueAtTime(target,t+.012);p.setValueAtTime(target,G.mixUntil);p.linearRampToValueAtTime(node===G.combatWet?.22:1,G.mixUntil+.22);
  }
}

// ---------------------------------------------------------------- 声部工具
export class V {
  n: AudioNode[] = [];
  s: AudioScheduledSourceNode[] = [];
  d: AudioParam[] = [];
  constructor(readonly c: Ctx, readonly o: Out, readonly G: Graph, readonly pan = 0) {}
  add<T extends AudioNode>(x: T): T { this.n.push(x); return x; }
  gain(v = 1) { const x = this.c.createGain(); x.gain.value = v; return this.add(x); }
  filt(type: BiquadFilterType, f: number, q = 1) {
    const x = this.c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return this.add(x);
  }
  osc(type: OscillatorType, f: number, t: number) {
    const x = this.c.createOscillator(); x.type = type; x.frequency.setValueAtTime(f, t); x.start(t);
    this.s.push(x);
    if (this.o.det) { this.o.det.connect(x.detune); this.d.push(x.detune); }
    return x;
  }
  noise(t: number) {
    const x = this.c.createBufferSource(); x.buffer = this.G.a.noise; x.loop = true; x.start(t, Math.random() * 1.5);
    this.s.push(x); return x;
  }
  buf(b: AudioBuffer, t: number, rate: number) {
    const x = this.c.createBufferSource(); x.buffer = b; x.playbackRate.value = rate; x.start(t);
    this.s.push(x);
    if (this.o.det) { this.o.det.connect(x.detune); this.d.push(x.detune); }
    return x;
  }
  send(x: AudioNode, wet = 0, dly = 0) {
    let dst: AudioNode = this.o.dry;
    let wdst: AudioNode = this.o.wet;
    if (this.pan !== 0) {
      const p = this.add(this.c.createStereoPanner()); p.pan.value = this.pan; p.connect(this.o.dry); dst = p;
      if (wet) { const p2 = this.add(this.c.createStereoPanner()); p2.pan.value = this.pan * 0.5; p2.connect(this.o.wet); wdst = p2; }
    }
    x.connect(dst);
    if (wet) { const w = this.gain(wet); x.connect(w); w.connect(wdst); }
    if (dly && this.o.dly) { const w = this.gain(dly); x.connect(w); w.connect(this.o.dly); }
  }
  end(t: number) {
    for (const x of this.s) x.stop(t);
    this.s[0].onended = () => this.kill();
  }
  kill() {
    for (const x of this.s) { try { x.disconnect(); } catch { /* */ } }
    if (this.o.det) for (const p of this.d) { try { this.o.det.disconnect(p); } catch { /* */ } }
    for (const x of this.n) { try { x.disconnect(); } catch { /* */ } }
  }
}

/** 线性起音 + 指数衰减包络。 */
export function env(p: AudioParam, t: number, a: number, peak: number, end: number) {
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
  p.exponentialRampToValueAtTime(0.0001, Math.max(t + a + 0.01, end));
}
/** 起音-保持-释放包络。 */
export function ar(p: AudioParam, t: number, a: number, peak: number, hold: number, rel: number) {
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
  p.setValueAtTime(Math.max(0.0002, peak), t + Math.max(a, hold));
  p.linearRampToValueAtTime(0.0001, t + Math.max(a, hold) + rel);
}

// ---------------------------------------------------------------- 打击乐
export function kick(G: Graph, o: Out, t: number, v: number) {
  const s = new V(G.ctx, o, G);
  const x = s.osc('sine', 155, t); x.frequency.exponentialRampToValueAtTime(44, t + 0.12);
  const g = s.gain(0); env(g.gain, t, 0.002, 0.95 * v, t + 0.34);
  x.connect(g);
  const n = s.noise(t); const hp = s.filt('highpass', 2500); const ng = s.gain(0); env(ng.gain, t, 0.001, 0.22 * v, t + 0.02);
  n.connect(hp); hp.connect(ng);
  s.send(g); s.send(ng); s.end(t + 0.4);
}
export function taiko(G: Graph, o: Out, t: number, v: number, pitch = 1) {
  const s = new V(G.ctx, o, G);
  const x = s.osc('sine', 130 * pitch, t); x.frequency.exponentialRampToValueAtTime(62 * pitch, t + 0.22);
  const x2 = s.osc('triangle', 260 * pitch, t); x2.frequency.exponentialRampToValueAtTime(120 * pitch, t + 0.12);
  const g = s.gain(0); env(g.gain, t, 0.003, 1.0 * v, t + 0.75);
  const g2 = s.gain(0); env(g2.gain, t, 0.002, 0.35 * v, t + 0.2);
  x.connect(g); x2.connect(g2);
  const n = s.noise(t); const bp = s.filt('bandpass', 1100, 0.8); const ng = s.gain(0); env(ng.gain, t, 0.001, 0.32 * v, t + 0.07);
  n.connect(bp); bp.connect(ng);
  s.send(g, 0.22); s.send(g2); s.send(ng, 0.1); s.end(t + 0.85);
}
export function tom(G: Graph, o: Out, t: number, v: number, f = 200) {
  const s = new V(G.ctx, o, G);
  const x = s.osc('sine', f * 1.5, t); x.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  const g = s.gain(0); env(g.gain, t, 0.002, 0.7 * v, t + 0.3);
  x.connect(g); s.send(g, 0.12); s.end(t + 0.35);
}
export function snare(G: Graph, o: Out, t: number, v: number) {
  const s = new V(G.ctx, o, G);
  const n = s.noise(t); const bp = s.filt('bandpass', 2400, 0.6); const ng = s.gain(0); env(ng.gain, t, 0.001, 0.5 * v, t + 0.17);
  n.connect(bp); bp.connect(ng);
  const x = s.osc('triangle', 210, t); x.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  const g = s.gain(0); env(g.gain, t, 0.001, 0.4 * v, t + 0.1); x.connect(g);
  s.send(ng, 0.2); s.send(g, 0.1); s.end(t + 0.2);
}
export function clap(G: Graph, o: Out, t: number, v: number) {
  const s = new V(G.ctx, o, G);
  const n = s.noise(t); const bp = s.filt('bandpass', 1500, 1.2); const g = s.gain(0);
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < 3; i++) { g.gain.linearRampToValueAtTime(0.5 * v, t + i * 0.011 + 0.001); g.gain.exponentialRampToValueAtTime(0.05 * v, t + i * 0.011 + 0.01); }
  g.gain.linearRampToValueAtTime(0.5 * v, t + 0.034); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  n.connect(bp); bp.connect(g); s.send(g, 0.3); s.end(t + 0.22);
}
export function hat(G: Graph, o: Out, t: number, v: number, open = false) {
  const s = new V(G.ctx, o, G);
  const n = s.noise(t); const hp = s.filt('highpass', 7200); const g = s.gain(0);
  env(g.gain, t, 0.001, 0.2 * v, t + (open ? 0.22 : 0.045));
  n.connect(hp); hp.connect(g); s.send(g, open ? 0.1 : 0.03); s.end(t + (open ? 0.25 : 0.06));
}
export function wood(G: Graph, o: Out, t: number, v: number, f = 900) {
  const s = new V(G.ctx, o, G);
  const x = s.osc('sine', f, t); x.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.05);
  const g = s.gain(0); env(g.gain, t, 0.001, 0.4 * v, t + 0.09); x.connect(g);
  s.send(g, 0.2); s.end(t + 0.12);
}
export function cymb(G: Graph, o: Out, t: number, v: number) {
  const s = new V(G.ctx, o, G);
  const n = s.noise(t); const hp = s.filt('highpass', 4800); const g = s.gain(0);
  env(g.gain, t, 0.002, 0.3 * v, t + 1.8); n.connect(hp); hp.connect(g); s.send(g, 0.35); s.end(t + 1.9);
}
const GONG = [1, 1.47, 2.0, 2.56, 3.16, 4.2];
export function gong(G: Graph, o: Out, t: number, v: number, f = 150) {
  const s = new V(G.ctx, o, G);
  const g = s.gain(1);
  GONG.forEach((r, i) => {
    const x = s.osc('sine', f * r * (1 + (i % 2 ? 0.003 : -0.002)), t);
    const e = s.gain(0); env(e.gain, t, 0.005 + i * 0.02, (0.34 / (1 + i * 0.7)) * v, t + 4.2 - i * 0.4);
    x.connect(e); e.connect(g);
  });
  const n = s.noise(t); const bp = s.filt('bandpass', 900, 0.5); const ng = s.gain(0); env(ng.gain, t, 0.002, 0.16 * v, t + 0.25);
  n.connect(bp); bp.connect(ng); ng.connect(g);
  s.send(g, 0.4); s.end(t + 4.3);
}

// ---------------------------------------------------------------- 旋律与和声乐器
export function bass(G: Graph, o: Out, t: number, m: number, dur: number, v: number, kind: 'pluck' | 'sub' = 'pluck') {
  const s = new V(G.ctx, o, G);
  const f = mtof(m);
  const x = s.osc('sawtooth', f, t); const x2 = s.osc('sine', f, t); const x3 = s.osc('square', f * 0.5, t);
  const lp = s.filt('lowpass', 1200, 3);
  lp.frequency.setValueAtTime(kind === 'pluck' ? 1500 : 700, t); lp.frequency.exponentialRampToValueAtTime(kind === 'pluck' ? 260 : 300, t + 0.16);
  const g = s.gain(0); ar(g.gain, t, 0.006, 0.42 * v, dur, 0.05);
  const g3 = s.gain(0.25); const g2 = s.gain(0.8);
  x.connect(lp); x3.connect(g3); g3.connect(lp); lp.connect(g); x2.connect(g2); g2.connect(g);
  s.send(g); s.end(t + dur + 0.1);
}
export function pad(G: Graph, o: Out, t: number, ms: number[], dur: number, v: number, bright = 1) {
  const s = new V(G.ctx, o, G);
  const lp = s.filt('lowpass', 500, 0.7);
  lp.frequency.setValueAtTime(350, t); lp.frequency.linearRampToValueAtTime(900 * bright + 500, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(500, t + dur);
  const g = s.gain(0);
  const at = Math.min(0.9, dur * 0.35);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11 * v, t + at); g.gain.setValueAtTime(0.11 * v, t + Math.max(at, dur - 0.5)); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.35);
  for (const m of ms) {
    const f = mtof(m);
    const a = s.osc('sawtooth', f, t); a.detune.value = -8;
    const b = s.osc('sawtooth', f, t); b.detune.value = 8;
    const ga = s.gain(0.5); a.connect(ga); b.connect(ga); ga.connect(lp);
  }
  lp.connect(g); s.send(g, 0.45); s.end(t + dur + 0.4);
}
export type LeadKind = 'flute' | 'erhu' | 'saw';
export function lead(G: Graph, o: Out, t: number, m: number, dur: number, v: number, kind: LeadKind) {
  const s = new V(G.ctx, o, G);
  const f = mtof(m);
  const out = s.gain(0);
  if (kind === 'flute') {
    const x = s.osc('triangle', f, t); const x2 = s.osc('sine', f * 2, t);
    const lfo = s.osc('sine', 5.1, t); const lg = s.gain(0); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.011, t + Math.min(0.5, dur)); lfo.connect(lg); lg.connect(x.frequency); lg.connect(x2.frequency);
    const lp = s.filt('lowpass', Math.min(9000, f * 5), 0.8);
    const x2g = s.gain(0.22); x.connect(lp); x2.connect(x2g); x2g.connect(lp); lp.connect(out);
    const n = s.noise(t); const bp = s.filt('bandpass', Math.min(6000, f * 3.5), 1.2); const ng = s.gain(0);
    env(ng.gain, t, 0.02, 0.05 * v, t + 0.25); n.connect(bp); bp.connect(ng); ng.connect(out);
    ar(out.gain, t, 0.05, 0.36 * v, dur, 0.12);
  } else if (kind === 'erhu') {
    const x = s.osc('sawtooth', f, t); const x2 = s.osc('sawtooth', f, t); x2.detune.value = 6;
    x.frequency.setValueAtTime(f * 0.89, t); x.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    x2.frequency.setValueAtTime(f * 0.89, t); x2.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    const lfo = s.osc('sine', 5.6, t); const lg = s.gain(0); lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.12); lg.gain.linearRampToValueAtTime(f * 0.014, t + 0.4); lfo.connect(lg); lg.connect(x.frequency); lg.connect(x2.frequency);
    const lp = s.filt('lowpass', 2600, 0.7); const pk = s.filt('peaking', 1150, 2.2); pk.gain.value = 9; const pk2 = s.filt('peaking', 2400, 3); pk2.gain.value = 5;
    const xg = s.gain(0.5); x.connect(xg); x2.connect(xg); xg.connect(lp); lp.connect(pk); pk.connect(pk2); pk2.connect(out);
    const n = s.noise(t); const bp = s.filt('bandpass', 3000, 1); const ng = s.gain(0); env(ng.gain, t, 0.01, 0.025 * v, t + 0.12); n.connect(bp); bp.connect(ng); ng.connect(out);
    ar(out.gain, t, 0.07, 0.3 * v, dur, 0.1);
  } else {
    const x = s.osc('sawtooth', f, t); x.detune.value = -11; const x2 = s.osc('sawtooth', f, t); x2.detune.value = 11; const x3 = s.osc('square', f, t);
    const lp = s.filt('lowpass', 4200, 2); lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1800, t + Math.min(0.5, dur));
    const g3 = s.gain(0.4); x.connect(lp); x2.connect(lp); x3.connect(g3); g3.connect(lp); lp.connect(out);
    ar(out.gain, t, 0.012, 0.2 * v, dur, 0.09);
  }
  s.send(out, kind === 'saw' ? 0.25 : 0.4, kind === 'saw' ? 0.3 : 0.18);
  s.end(t + Math.max(0.06, dur) + 0.35);
}
export function pluck(G: Graph, o: Out, t: number, m: number, v: number, kind: 'pluck' | 'bell') {
  const s = new V(G.ctx, o, G);
  const f = mtof(m);
  const g = s.gain(0);
  if (kind === 'pluck') {
    const x = s.osc('sawtooth', f, t); const lp = s.filt('lowpass', 3800, 2); lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.16);
    x.connect(lp); lp.connect(g); env(g.gain, t, 0.003, 0.2 * v, t + 0.26); s.send(g, 0.2, 0.55); s.end(t + 0.3);
  } else {
    const x = s.osc('sine', f, t); const x2 = s.osc('sine', f * 2.76, t); const g2 = s.gain(0.25);
    x.connect(g); x2.connect(g2); g2.connect(g); env(g.gain, t, 0.002, 0.2 * v, t + 0.9); s.send(g, 0.4, 0.45); s.end(t + 0.95);
  }
}
export function koto(G: Graph, o: Out, t: number, m: number, v: number) {
  const bank = G.a.koto;
  let e = bank[0];
  for (const b of bank) if (Math.abs(b.midi - m) < Math.abs(e.midi - m)) e = b;
  const s = new V(G.ctx, o, G);
  const x = s.buf(e.buf, t, mtof(m) / e.f);
  const g = s.gain(0.55 * v); x.connect(g); s.send(g, 0.28, 0.12);
  s.end(t + e.buf.duration / Math.max(0.5, mtof(m) / e.f) + 0.02);
}
