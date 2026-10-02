import { MATERIALS, MUSIC_FILES, VOICE_EVENTS } from './materials';
import { focusCue, type Graph } from './engine';
import type { MusicId } from '../types';

/** 独立素材总线；状态用于开发工具验收，不暴露玩家界面。 */
export class SampleAudio {
  readonly status: Record<string, 'loading' | 'ready' | 'failed'> = {};
  readonly log: { event: string; material: string; time: number }[] = [];
  private buffers = new Map<string, AudioBuffer>();
  private musicBus: GainNode;
  private voiceBus: GainNode;
  private track: { source: AudioBufferSourceNode; gain: GainNode; id: MusicId; started: number } | null = null;
  private voice: AudioBufferSourceNode | null = null;
  private sequence: Record<string, number> = {};
  private lastVoice = -10;
  private musicVolume = .7;
  private duckUntil = 0;
  private duckDepth = 1;
  constructor(private G: Graph) {
    this.musicBus = G.ctx.createGain(); this.musicBus.connect(G.lp);
    this.voiceBus = G.ctx.createGain(); this.voiceBus.connect(G.lp);
    this.volumes(.7, .9);
  }
  async load() {
    await Promise.all(MATERIALS.map(async m => {
      this.status[m.id] = 'loading';
      try {
        const r = await fetch(m.url); if (!r.ok) throw new Error(`${r.status}`);
        const buffer = await this.G.ctx.decodeAudioData(await r.arrayBuffer());
        this.buffers.set(m.id, buffer); this.status[m.id] = 'ready';
      } catch { this.status[m.id] = 'failed'; }
    }));
  }
  volumes(music: number, sfx: number) {
    this.musicVolume = music;
    const t = this.G.ctx.currentTime;
    this.musicBus.gain.cancelAndHoldAtTime(t);
    this.musicBus.gain.setTargetAtTime(.65 * music * (t < this.duckUntil ? this.duckDepth : 1), t, .03);
    if (t < this.duckUntil) this.musicBus.gain.setTargetAtTime(.65 * music, this.duckUntil, .25);
    this.voiceBus.gain.setTargetAtTime(.85 * sfx, t, .03);
  }
  silence(event: string) { this.record(event, 'silence'); }
  fallback(event: string, material: string) { this.record(event, `synth:${material}`); }
  private duck(duration: number, depth: number) {
    const t = this.G.ctx.currentTime;
    this.duckDepth = t < this.duckUntil ? Math.min(depth, this.duckDepth) : depth;
    this.duckUntil = Math.max(this.duckUntil, t + duration);
    this.musicBus.gain.cancelAndHoldAtTime(t);
    this.musicBus.gain.setTargetAtTime(.65 * this.musicVolume * this.duckDepth, t, .04);
    this.musicBus.gain.setTargetAtTime(.65 * this.musicVolume, this.duckUntil, .25);
    focusCue(this.G, t, duration, depth);
  }
  private record(event: string, material: string) {
    this.log.push({ event, material, time: this.G.ctx.currentTime });
    if (this.log.length > 120) this.log.shift();
  }
  stopMusic(fade: number) {
    const old = this.track; if (!old) return;
    const t = this.G.ctx.currentTime, duration = Math.max(.03, fade);
    old.gain.gain.cancelScheduledValues(t);
    old.gain.gain.setValueAtTime(old.gain.gain.value, t);
    old.gain.gain.linearRampToValueAtTime(0, t + duration);
    old.source.stop(t + duration); this.track = null;
  }
  music(id: MusicId, fade: number): boolean {
    const file = MUSIC_FILES[id as keyof typeof MUSIC_FILES];
    const buffer = this.buffers.get(`music:${file}`); if (!buffer) return false;
    if (this.track?.id === id) return true;
    this.stopMusic(fade);
    const t = this.G.ctx.currentTime, source = this.G.ctx.createBufferSource(), gain = this.G.ctx.createGain();
    source.buffer = buffer; source.loop = true; source.connect(gain); gain.connect(this.musicBus);
    gain.gain.setValueAtTime(fade > .03 ? 0 : 1, t); gain.gain.linearRampToValueAtTime(1, t + Math.max(.03, fade));
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(t); this.track = { source, gain, id, started: t }; this.record(`music:${id}`, `music:${file}`); return true;
  }
  get playing() { return this.track; }
  sfx(id: string, opts?: { vol?: number; pan?: number; pitch?: number }): boolean {
    const voiceIds = VOICE_EVENTS[id];
    if (voiceIds) {
      const t = this.G.ctx.currentTime;
      if (t - this.lastVoice < (id.startsWith('companion:') ? 3 : .3)) return true;
      const n = this.sequence[id] ?? 0, key = voiceIds[n % voiceIds.length], b = this.buffers.get(key);
      if (!b) return false;
      this.sequence[id] = n + 1; this.lastVoice = t;
      if (this.voice) { try { this.voice.stop(); } catch { /* 已结束 */ } }
      const s = this.G.ctx.createBufferSource(); s.buffer = b; s.connect(this.voiceBus); s.start(t);
      this.voice = s; s.onended = () => { s.disconnect(); if (this.voice === s) this.voice = null; };
      this.duck(b.duration, .55);
      this.record(id, key); return true;
    }
    const b = this.buffers.get(id); if (!b) return false;
    const c = this.G.ctx, s = c.createBufferSource(), gain = c.createGain(), pan = c.createStereoPanner();
    const finite = (x: number | undefined, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(x) ? x! : fallback));
    s.buffer = b; s.playbackRate.value = finite(opts?.pitch,1,.25,4);
    gain.gain.value = finite(opts?.vol,1,0,2); pan.pan.value = finite(opts?.pan,0,-1,1);
    s.connect(gain); gain.connect(pan); pan.connect(id === 'warning' || id.startsWith('menu_') ? this.G.sfxIn : this.G.combatFocus);
    s.onended = () => { s.disconnect(); gain.disconnect(); pan.disconnect(); };
    if (id === 'warning') this.duck(b.duration,.3);
    else if (id === 'bomb' || id === 'seal') this.duck(.6,.65);
    s.start(); this.record(id,id); return true;
  }
}
