import { MATERIALS, MUSIC_FILES, MUSIC_CHAPTERS, MUSIC_RESIDENT, VOICE_EVENTS } from './materials';
import { MUSIC_CUES } from './music-cues';
import { focusCue, type Graph } from './engine';
import { DialogueVoice } from './dialogue-voice';
import type { MusicId } from '../types';

/** 独立素材总线；状态用于开发工具验收，不暴露玩家界面。 */
export class SampleAudio {
  readonly status: Record<string, 'loading' | 'ready' | 'failed'> = {};
  readonly log: { event: string; material: string; time: number }[] = [];
  private loops = new Map<string,AudioBufferSourceNode>();
  stopSfx(id:string){const source=this.loops.get(id);if(source){this.loops.delete(id);source.stop();this.record(`stop:${id}`,id);}}
  private buffers = new Map<string, AudioBuffer>();
  private loads = new Map<string, Promise<void>>();
  private allowedMusic = new Set<string>();
  private fading = new Set<NonNullable<SampleAudio['track']>>();
  private wanted: MusicId | null = null;
  private ambient: MusicId = 'title';
  private chapter = 0;
  private chapterRequest = 0;
  private chapterReady: Promise<void> = Promise.resolve();
  onMusic: ((id: MusicId | null, fade: number) => void) | null = null;
  private musicBus: GainNode;
  private voiceBus: GainNode;
  private track: { source: AudioBufferSourceNode; gain: GainNode; id: MusicId; started: number } | null = null;
  private voice: AudioBufferSourceNode | null = null;
  private sequence: Record<string, number> = {};
  private lastVoice = -10;
  private musicVolume = .7;
  private duckUntil = 0;
  private duckDepth = 1;
  private dialoguePlaying = false;
  readonly dialogue: DialogueVoice;
  constructor(private G: Graph) {
    this.musicBus = G.ctx.createGain(); this.musicBus.connect(G.lp);
    this.voiceBus = G.ctx.createGain(); this.voiceBus.connect(G.lp);
    this.dialogue = new DialogueVoice(G.ctx, this.voiceBus,
      !(Number(new URLSearchParams(location.search).get('flowspeed') ?? 1) > 1),
      playing => { this.dialoguePlaying = playing; this.applyMusicVolume(); },
      (event, material) => this.record(event, material));
    this.volumes(.7, .9);
  }
  async load() {
    await Promise.all([
      ...MATERIALS.filter(m => m.bus !== 'music').map(m => this.loadMaterial(m.id)),
      this.prepareChapter(0),
    ]);
  }
  private loadMaterial(id: string): Promise<void> {
    if (this.buffers.has(id)) return Promise.resolve();
    const pending = this.loads.get(id); if (pending) return pending;
    const m = MATERIALS.find(m => m.id === id); if (!m) return Promise.resolve();
    this.status[id] = 'loading';
    const work = (async () => {
      try {
        const r = await fetch(m.url); if (!r.ok) throw new Error(`${r.status}`);
        const buffer = await this.G.ctx.decodeAudioData(await r.arrayBuffer());
        if (m.bus !== 'music' || this.allowedMusic.has(id)) {
          this.buffers.set(id, buffer); this.status[id] = 'ready';
        } else delete this.status[id];
      } catch { this.status[id] = 'failed'; }
      finally { this.loads.delete(id); }
    })();
    this.loads.set(id, work); return work;
  }
  prepareChapter(chapter: number): Promise<void> {
    const group = MUSIC_CHAPTERS[chapter as keyof typeof MUSIC_CHAPTERS];
    if (!group) return Promise.resolve();
    if (this.chapter === chapter && this.allowedMusic.size) return this.chapterReady;
    this.dialogue.stop(); this.dialogue.prefetch([]);
    this.chapter = chapter; const request = ++this.chapterRequest;
    this.allowedMusic = new Set([...MUSIC_RESIDENT, ...group.core, ...group.bosses].map(id => `music:${MUSIC_FILES[id]}`));
    this.releaseUnused();
    this.chapterReady = (async () => {
      await Promise.all([...MUSIC_RESIDENT, ...group.core].map(id => this.loadMaterial(`music:${MUSIC_FILES[id]}`)));
      if (request !== this.chapterRequest) return;
      const ambient = group.core[0];
      if (this.buffers.has(`music:${MUSIC_FILES[ambient]}`)) this.ambient = ambient;
      this.releaseUnused();
      // 不阻塞进入道中；请求早于预取完成时由 music() 留住道中曲。
      for (const id of group.bosses) void this.loadMaterial(`music:${MUSIC_FILES[id]}`);
    })();
    return this.chapterReady;
  }
  async musicReady(): Promise<void> {
    await this.chapterReady;
    await Promise.all([...this.loads].filter(([id]) => this.allowedMusic.has(id)).map(([,p]) => p));
  }
  private releaseUnused() {
    const retained = new Set([this.ambient, this.track?.id, ...[...this.fading].map(t => t.id)].filter((id): id is MusicId => !!id).map(id => `music:${MUSIC_FILES[id]}`));
    for (const id of this.buffers.keys()) if (id.startsWith('music:') && !this.allowedMusic.has(id) && !retained.has(id)) {
      this.buffers.delete(id); delete this.status[id];
    }
  }
  get decodedMusic() {
    const music = [...this.buffers].filter(([id]) => id.startsWith('music:'));
    const seconds = music.reduce((n,[,b]) => n + b.duration, 0);
    return { ids: music.map(([id]) => id.slice(6)), seconds, mb48000: seconds * 48000 * 2 * 4 / 1e6 };
  }
  volumes(music: number, voice: number) {
    this.musicVolume = music;
    this.applyMusicVolume();
    this.voiceBus.gain.setTargetAtTime(.85 * voice, this.G.ctx.currentTime, .03);
  }
  private applyMusicVolume() {
    const t = this.G.ctx.currentTime;
    const dialogueDepth = this.dialoguePlaying ? Math.pow(10, -6 / 20) : 1;
    this.musicBus.gain.cancelAndHoldAtTime(t);
    this.musicBus.gain.setTargetAtTime(.65 * this.musicVolume * Math.min(dialogueDepth, t < this.duckUntil ? this.duckDepth : 1), t, this.dialoguePlaying ? .04 : .25);
    if (t < this.duckUntil) this.musicBus.gain.setTargetAtTime(.65 * this.musicVolume * dialogueDepth, this.duckUntil, .25);
  }
  silence(event: string) { this.record(event, 'silence'); }
  fallback(event: string, material: string) { this.record(event, `synth:${material}`); }
  private duck(duration: number, depth: number) {
    const t = this.G.ctx.currentTime;
    this.duckDepth = t < this.duckUntil ? Math.min(depth, this.duckDepth) : depth;
    this.duckUntil = Math.max(this.duckUntil, t + duration);
    this.applyMusicVolume();
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
    this.fading.add(old); old.source.stop(t + duration); this.track = null;
  }
  music(id: MusicId | null, fade: number): void {
    this.wanted = id;
    if (!id) { this.stopMusic(fade); this.onMusic?.(null, fade); return; }
    const key = `music:${MUSIC_FILES[id]}`;
    this.allowedMusic.add(key);
    const core = MUSIC_CHAPTERS[this.chapter as keyof typeof MUSIC_CHAPTERS].core as readonly MusicId[];
    if (core.includes(id) && this.buffers.has(key)) this.ambient = id;
    if (this.playMusic(id, fade)) return;
    // 未解码完成时保留当前曲；警报/转场尾声结束后接回道中循环。
    this.playMusic(this.ambient, .5);
    this.record(`music:${id}`, 'loading');
    void this.loadMaterial(key).then(() => {
      if (this.wanted === id) this.playMusic(id, fade);
    });
  }
  private playMusic(id: MusicId, fade: number): boolean {
    const file = MUSIC_FILES[id as keyof typeof MUSIC_FILES];
    const buffer = this.buffers.get(`music:${file}`); if (!buffer) return false;
    if (this.track?.id === id) return true;
    this.stopMusic(fade);
    const t = this.G.ctx.currentTime, source = this.G.ctx.createBufferSource(), gain = this.G.ctx.createGain();
    source.buffer = buffer; source.loop = MUSIC_CUES[id].loop; source.connect(gain); gain.connect(this.musicBus);
    gain.gain.setValueAtTime(fade > .03 ? 0 : 1, t); gain.gain.linearRampToValueAtTime(1, t + Math.max(.03, fade));
    const track = { source, gain, id, started: t };
    source.onended = () => {
      source.disconnect(); gain.disconnect(); source.buffer = null; this.fading.delete(track);
      if (this.track === track) {
        this.track = null;
        if (this.wanted && ['warning', 'boss-clear', 'interlude'].includes(id)) this.playMusic(this.ambient, .5);
      }
      this.releaseUnused();
    };
    source.start(t); this.track = track; this.record(`music:${id}`, `music:${file}`); this.onMusic?.(id, fade); return true;
  }
  get playing() { return this.track; }
  playDialogue(id: string, text: string) {
    if (this.voice) { this.voice.stop(); this.voice = null; }
    return this.dialogue.play(id, text);
  }
  sfx(id: string, opts?: { vol?: number; pan?: number; pitch?: number }): boolean {
    const voiceIds = VOICE_EVENTS[id];
    if (voiceIds) {
      if (!this.dialogue.enabled || this.dialogue.active) return true;
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
    if(id==='brush_loop'&&this.loops.has(id))return true;
    const b = this.buffers.get(id); if (!b) return false;
    const c = this.G.ctx, s = c.createBufferSource(), gain = c.createGain(), pan = c.createStereoPanner();
    const finite = (x: number | undefined, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(x) ? x! : fallback));
    s.buffer = b; s.playbackRate.value = finite(opts?.pitch,1,.25,4);
    gain.gain.value = finite(opts?.vol,1,0,2); pan.pan.value = finite(opts?.pan,0,-1,1);
    s.connect(gain); gain.connect(pan); pan.connect(id === 'warning' || id.startsWith('menu_') ? this.G.sfxIn : this.G.combatFocus);
    if(id==='brush_loop'){s.loop=true;this.loops.set(id,s);}
    s.onended = () => { if(this.loops.get(id)===s)this.loops.delete(id);s.disconnect(); gain.disconnect(); pan.disconnect(); };
    if (id === 'warning') this.duck(b.duration,.3);
    else if (id === 'bomb' || id.startsWith('bomb_') || id === 'seal') this.duck(.6,.65);
    s.start(); this.record(id,id); return true;
  }
}
