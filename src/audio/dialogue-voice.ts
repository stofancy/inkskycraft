import type { DialogueVoiceState } from '../types';

type Line = { id: string; text: string };
type Clip = Line & { abort: AbortController; ready: Promise<AudioBuffer | null>; buffer?: AudioBuffer };

/** 只保留当前句与后两句；翻页取消过期请求，结束即释放已解码音频。 */
export class DialogueVoice {
  private index: Promise<Record<string, { text: string }>> | null = null;
  private clips = new Map<string, Clip>();
  private current: DialogueVoiceState | null = null;
  private source: AudioBufferSourceNode | null = null;
  constructor(private ctx: BaseAudioContext, private bus: GainNode, readonly enabled: boolean,
    private onPlaying: (playing: boolean) => void, private record: (event: string, material: string) => void) {}

  private metadata() {
    return this.index ??= fetch('/audio/voice/dialogue/index.json', { signal: AbortSignal.timeout(8000) })
      .then(async r => { if (!r.ok) throw Error(String(r.status)); return (await r.json()).lines; })
      .catch(() => ({}));
  }

  prefetch(lines: readonly Line[]) {
    const wanted = new Map((this.enabled ? lines.slice(0, 3) : []).map(line => [line.id, line.text]));
    for (const [id, clip] of this.clips) if (wanted.get(id) !== clip.text) this.release(id);
    for (const [id, text] of wanted) {
      if (this.clips.has(id)) continue;
      const abort = new AbortController();
      const clip: Clip = { id, text, abort, ready: Promise.resolve(null) };
      this.clips.set(id, clip);
      clip.ready = (async () => {
        try {
          const entry = (await this.metadata())[id];
          if (abort.signal.aborted) return null;
          if (entry?.text !== text) {
            this.record(`dialogue:silent:${id}`, entry ? 'text-mismatch' : 'missing');
            return null;
          }
          const r = await fetch(`/audio/voice/dialogue/${encodeURIComponent(id)}.ogg`,
            { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]) });
          if (!r.ok) throw Error(String(r.status));
          const buffer = await this.ctx.decodeAudioData(await r.arrayBuffer());
          if (abort.signal.aborted || this.clips.get(id) !== clip) return null;
          clip.buffer = buffer;
          return buffer;
        } catch {
          if (!abort.signal.aborted) this.record(`dialogue:silent:${id}`, 'load-failed');
          return null;
        }
      })();
    }
  }

  play(id: string, text: string): DialogueVoiceState | null {
    this.stop();
    if (!this.enabled) return null;
    if (this.clips.get(id)?.text !== text) this.prefetch([{ id, text }]);
    const clip = this.clips.get(id)!;
    const state: DialogueVoiceState = { id, state: 'loading' };
    this.current = state;
    void clip.ready.then(buffer => {
      if (this.current !== state || state.state !== 'loading') return;
      if (!buffer) { state.state = 'silent'; return; }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer; source.connect(this.bus);
      source.onended = () => {
        source.disconnect(); source.buffer = null;
        if (this.current !== state) return;
        this.source = null; this.current = null; state.state = 'ended';
        this.release(id); this.onPlaying(false);
        this.record(`dialogue:end:${id}`, 'voiceBus');
      };
      this.source = source; state.state = 'playing';
      this.onPlaying(true); source.start();
      this.record(`dialogue:start:${id}`, 'voiceBus');
    });
    return state;
  }

  stop() {
    const current = this.current, source = this.source;
    this.current = null; this.source = null;
    if (source) { source.stop(); source.disconnect(); source.buffer = null; this.onPlaying(false); }
    if (current) {
      current.state = 'stopped'; this.release(current.id);
      this.record(`dialogue:stop:${current.id}`, 'voiceBus');
    }
  }

  private release(id: string) {
    const clip = this.clips.get(id);
    if (clip) { clip.abort.abort(); clip.buffer = undefined; this.clips.delete(id); }
  }

  get active() { return this.current?.state === 'loading' || this.current?.state === 'playing'; }
  get decoded() {
    const clips = [...this.clips.values()].filter(clip => clip.buffer);
    return { ids: clips.map(clip => clip.id), bytes: clips.reduce((n, clip) =>
      n + clip.buffer!.length * clip.buffer!.numberOfChannels * 4, 0), pending: [...this.clips.values()].filter(clip => !clip.buffer).length };
  }
}
