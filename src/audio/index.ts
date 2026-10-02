// 素材音频入口；程序化声部仅供离线工具及音效回退使用。
import type { BeatInfo, GameAudio, MusicId, Sfx } from '../types';
import { buildGraph, mtof, kick, taiko, tom, snare, clap, hat, wood, cymb, gong, bass, pad, lead, pluck, koto, type Graph, type Out, type LeadKind } from './engine';
import { type Ev, type Song } from './songs';
import { playSfx, SFX_LIMITS } from './sfx';
import { SampleAudio } from './samples';
import { MUSIC_CUES } from './music-cues';
import { isP4Sfx, isNewSfx, MUSIC_CONTEXT } from './materials';

// 共享音效合同与素材播放诊断。
export type MaterialAudio = GameAudio & { diagnostics(): SampleAudio | null };

// ---------------------------------------------------------------- 事件播放
export function playEv(G: Graph, o: Out, e: Ev, t: number, sd: number) {
  const h = () => Math.random() * 0.010;
  switch (e.k) {
    case 'kick': kick(G, o, t, e.v); break;
    case 'snare': snare(G, o, t, e.v); break;
    case 'clap': clap(G, o, t, e.v); break;
    case 'hat': hat(G, o, t, e.v); break;
    case 'ohat': hat(G, o, t, e.v, true); break;
    case 'taiko': taiko(G, o, t, e.v); break;
    case 'tom': tom(G, o, t, e.v); break;
    case 'wood': wood(G, o, t, e.v); break;
    case 'cymb': cymb(G, o, t, e.v); break;
    case 'gong': gong(G, o, t, e.v, mtof((e.n ?? 36) + 12)); break;
    case 'bass': bass(G, o, t, e.n!, (e.d ?? 1) * sd * 0.9, e.v, 'pluck'); break;
    case 'bassS': bass(G, o, t, e.n!, (e.d ?? 4) * sd * 0.95, e.v, 'sub'); break;
    case 'pad': pad(G, o, t, e.ns!, (e.d ?? 16) * sd, e.v); break;
    case 'pluck': pluck(G, o, t + h(), e.n!, e.v, 'pluck'); break;
    case 'bell': pluck(G, o, t + h(), e.n!, e.v, 'bell'); break;
    case 'koto': koto(G, o, t + (e.o ?? 0) + h(), e.n!, e.v); break;
    default:
      if (e.k.startsWith('lead:')) lead(G, o, t + h(), e.n!, (e.d ?? 2) * sd, e.v, e.k.slice(5) as LeadKind);
  }
}

/** 调度 [s0, s1) 步（离线渲染与实时调度共用）；t 为 s0 对应时间。返回 s1 对应时间。 */
export function scheduleSteps(G: Graph, o: Out, song: Song, s0: number, s1: number, t: number, rate = 1): number {
  const sd = 60 / song.bpm / 4 / rate;
  for (let s = s0; s < s1; s++) {
    const evs = song.ev[s];
    const tt = t + (s % 2 === 1 ? song.sw * sd : 0);
    for (const e of evs) playEv(G, o, e, tt, sd);
    t += sd;
  }
  return t;
}

export function makeSongOut(G: Graph): { out: Out; gain: GainNode; dispose: () => void } {
  const c = G.ctx;
  const gain = c.createGain(); gain.gain.value = 1; gain.connect(G.musicIn);
  const wet = c.createGain(); wet.gain.value = 0.55; wet.connect(G.musicWetFocus);
  const dly = c.createGain(); dly.gain.value = 0.6; dly.connect(G.musicDelayFocus);
  return { out: { dry: gain, wet, dly, det: G.det }, gain, dispose: () => { gain.disconnect(); wet.disconnect(); dly.disconnect(); } };
}

// ---------------------------------------------------------------- 实时引擎
export function createAudio(): MaterialAudio {
  let G: Graph | null = null;
  let samples: SampleAudio | null = null;
  let ctx: AudioContext | null = null;
  let vols = { master: 0.8, music: 0.7, sfx: 0.9 };
  let slow = 0;
  let pending: { id: MusicId | null; fade: number } | null = null;
  const last: Record<string, number> = {};
  const live: Record<string, number[]> = {};
  let initP: Promise<void> | null = null;

  const applyVols = () => {
    if (!G) return;
    const t = G.ctx.currentTime;
    G.master.gain.setTargetAtTime(0.9 * vols.master, t, 0.03);
    G.musicIn.gain.setTargetAtTime(0.2 * vols.music, t, 0.03);
    G.sfxIn.gain.setTargetAtTime(0.85 * vols.sfx, t, 0.03);
    samples?.volumes(vols.music, vols.sfx);
  };
  // 未就绪的采样由 SampleAudio 延续道中曲，不调度合成鼓组。
  const startMusic = (id: MusicId | null, fade: number) => {
    if (!G || !ctx) return;
    samples?.music(id, fade);
  };

  const api: MaterialAudio = {
    diagnostics: () => samples,
    init() {
      if (initP) { ctx?.resume(); return initP; }
      initP = (async () => {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC({ latencyHint: 'interactive' });
        G = buildGraph(ctx);
        samples = new SampleAudio(G);
        applyVols();
        if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* 需要手势 */ } }
        document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx?.state === 'suspended') void ctx.resume(); });
        window.addEventListener('blur',()=>samples?.stopSfx('brush_loop'));
        document.addEventListener('visibilitychange',()=>{if(document.hidden)samples?.stopSfx('brush_loop');});
        window.addEventListener('pointerup',e=>{if(e.button===2)samples?.stopSfx('brush_loop');});
        await samples.load();
        if (pending) { const p = pending; pending = null; api.music(p.id, p.fade); }
      })();
      return initP;
    },
    async prepareMusic(chapter, bossesReady = false) {
      await api.init();
      await samples?.prepareChapter(chapter);
      if (bossesReady) await samples?.musicReady();
    },
    sfx(id: Sfx, opts) {
      if (!G || !ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const lim = isP4Sfx(id) ? undefined : SFX_LIMITS[id];
      if (lim) {
        if (now - (last[id] ?? -9) < lim.gap) return;
        const l = (live[id] ??= []).filter((e) => e > now);
        if (l.length >= lim.max) { live[id] = l; return; }
        l.push(now + lim.life); live[id] = l;
        last[id] = now;
      }
      try {
        if (samples?.sfx(id, opts)) return;
        if (isP4Sfx(id) || isNewSfx(id)) { samples?.silence(id); return; }
        const fallback = id.startsWith('move:') ? (id === 'move:guard' ? 'seal' : 'slash') : id.startsWith('companion:') ? 'item' : id.startsWith('boss:') ? 'warning' : id.startsWith('hit_') && id !== 'hit_armor' ? 'hit' : id;
        samples?.fallback(id, fallback);
        playSfx(G, fallback as Sfx, now + 0.005, opts);
      } catch { /* 忽略 */ }
    },
    stopSfx(id){samples?.stopSfx(id);},
    music(id, fadeSec = 1) {
      if (!G) { pending = { id, fade: fadeSec }; return; }
      const chapter = id ? MUSIC_CONTEXT[id] : undefined;
      if (chapter !== undefined) void samples?.prepareChapter(chapter);
      startMusic(id, fadeSec);
    },
    setSlowmo(a) {
      slow = Math.max(0, Math.min(1, a));
      if (!G) return;
      const t = G.ctx.currentTime;
      const top = Math.min(20000, G.ctx.sampleRate * 0.45);
      G.lp.frequency.setTargetAtTime(top * Math.pow(900 / top, slow), t, 0.08);
      G.revOut.gain.setTargetAtTime(0.5 + 0.6 * slow, t, 0.1);
      G.det.offset.setTargetAtTime(-130 * slow, t, 0.1);
    },
    setVolumes(m, mu, s) { vols = { master: m, music: mu, sfx: s }; applyVols(); },
    beat(): BeatInfo {
      if (G && ctx && samples?.playing) {
        const track = samples.playing, bpm = MUSIC_CUES[track.id].bpm;
        const beat = (ctx.currentTime - track.started) * bpm / 60 % 4;
        return { beat, phase: beat % 1, bpm };
      }
      return { beat: 0, phase: 0, bpm: 100 };
    },
  };
  return api;
}
