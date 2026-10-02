// 音频预览与离线自测。
// 页面按钮：试听每首音乐 / 每个音效。控制台/评估：window.audioTest(opts) 用 OfflineAudioContext 渲染并统计。
//   SHOT_EVAL='return await window.audioTest({})' node tools/shot.mjs http://127.0.0.1:5173/tools/audio.html .shots/a.png 1500
import { createAudio, makeSongOut, scheduleSteps } from '../src/audio';
import { buildGraph } from '../src/audio/engine';
import { getSong, MUSIC_IDS } from '../src/audio/songs';
import { playSfx, SFX_IDS } from '../src/audio/sfx';
import { VOICE_EVENTS, SFX_FILES } from '../src/audio/materials';
import type { MusicId, Sfx } from '../src/types';

const audio = createAudio();
(window as unknown as Record<string,unknown>).audioPreview = audio;
const $ = (id: string) => document.getElementById(id)!;
const btn = (host: string, label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { void audio.init().then(fn); }; $(host).appendChild(b); };
const musicNames: Partial<Record<MusicId,string>> = { title:'标题 · 群山初晴', stage1:'第一章道中 · 晨山飞行', boss:'铜雀战 · 铜翼封桥' };
for (const id of MUSIC_IDS) btn('music', musicNames[id] ?? `${id}（未配置素材，静音）`, () => audio.music(id, 0.5));
btn('music', '■ stop', () => audio.music(null, 0.5));
for (const id of [...new Set([...SFX_IDS, ...SFX_FILES])]) btn('sfx', id, () => audio.sfx(id, { pan: 0 }));
for (const event of Object.keys(VOICE_EVENTS)) btn('voice', `${event} · ${VOICE_EVENTS[event].join(' / ')}`, () => audio.sfx(event as Sfx));
btn('ctl', 'slowmo 1', () => audio.setSlowmo(1)); btn('ctl', 'slowmo 0', () => audio.setSlowmo(0));
setInterval(() => {
  const samples = audio.diagnostics();
  $('materials').textContent = samples ? `素材：${Object.values(samples.status).filter(s=>s==='ready').length} 已加载 / ${Object.keys(samples.status).length}；最近播放：${samples.log.slice(-5).map(e=>`${e.event} → ${e.material}`).join(' | ')}` : '点击试听后解锁并加载音频';
  const b = audio.beat(); $('beat').textContent = `beat ${b.beat.toFixed(2)} phase ${b.phase.toFixed(2)} bpm ${b.bpm.toFixed(1)}`; }, 100);

const SR = 44100;
interface Stat { name: string; peak: number; rms: number; minSecRms: number; nan: number; clip: number; dc: number; secs: number }
function analyze(name: string, buf: AudioBuffer, skip = 0): Stat {
  let peak = 0, sum = 0, n = 0, nan = 0, clip = 0, dc = 0;
  const secRms: number[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      if (!Number.isFinite(x)) { nan++; continue; }
      const a = Math.abs(x); if (a > peak) peak = a; if (a >= 0.999) clip++;
      if (i >= skip) { sum += x * x; n++; dc += x; }
    }
  }
  const d0 = buf.getChannelData(0);
  for (let s = 0; s + SR <= d0.length; s += SR) { let q = 0; for (let i = 0; i < SR; i++) q += d0[s + i] ** 2; secRms.push(Math.sqrt(q / SR)); }
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return { name, peak: r(peak), rms: r(Math.sqrt(sum / Math.max(1, n))), minSecRms: r(secRms.length ? Math.min(...secRms) : 0), nan, clip, dc: r(Math.abs(dc / Math.max(1, n))), secs: r(buf.duration) };
}
async function renderMusic(id: MusicId, startStep: number, secs: number): Promise<Stat> {
  const c = new OfflineAudioContext(2, Math.floor(SR * secs), SR);
  const G = buildGraph(c);
  const song = getSong(id);
  const so = makeSongOut(G);
  const sd = 60 / song.bpm / 4;
  const n = Math.min(song.steps - startStep, Math.floor((secs - 0.2) / sd));
  scheduleSteps(G, so.out, song, startStep, startStep + n, 0.05);
  const buf = await c.startRendering();
  return analyze(`${id}@${startStep / 16}`, buf);
}
async function renderSfx(id: Sfx, secs = 3.2): Promise<Stat> {
  const c = new OfflineAudioContext(2, Math.floor(SR * secs), SR);
  const G = buildGraph(c);
  playSfx(G, id, 0.05);
  const buf = await c.startRendering();
  return analyze(id, buf);
}
(window as unknown as Record<string, unknown>).audioTest = async (o: { music?: boolean; sfx?: boolean; full?: boolean; win?: number; only?: string } = {}) => {
  const out: { music: Stat[]; sfx: Stat[]; problems: string[]; info: string[] } = { music: [], sfx: [], problems: [], info: [] };
  const t0 = performance.now();
  if (o.music !== false) for (const id of MUSIC_IDS) {
    if (o.only && o.only !== id) continue;
    const song = getSong(id);
    out.info.push(`${id}: bpm ${song.bpm} bars ${song.steps / 16} loopStart ${song.loopStart / 16} events ${song.ev.reduce((a, e) => a + e.length, 0)} sections ${song.sections.map((s) => s.name + '@' + s.start / 16).join(',')}`);
    const starts = o.full ? [0] : song.sections.map((s) => s.start);
    for (const s of starts) {
      const secs = o.full ? song.steps * 60 / song.bpm / 4 + 1 : (o.win ?? 8);
      const st = await renderMusic(id, s, secs);
      out.music.push(st);
      if (st.nan) out.problems.push(`${st.name} NaN`);
      if (st.peak < 0.02 || st.rms < 0.005) out.problems.push(`${st.name} silent/quiet`);
      if (st.peak >= 0.99) out.problems.push(`${st.name} clip peak ${st.peak}`);
    }
  }
  if (o.sfx !== false) for (const id of SFX_IDS) {
    const st = await renderSfx(id);
    out.sfx.push(st);
    if (st.nan) out.problems.push(`${id} NaN`);
    if (st.peak < 0.02) out.problems.push(`${id} silent`);
    if (st.peak >= 0.99) out.problems.push(`${id} clip ${st.peak}`);
  }
  const fmt = (s: Stat) => `${s.name.padEnd(18)} peak ${s.peak.toFixed(3)} rms ${s.rms.toFixed(3)} minSecRms ${s.minSecRms.toFixed(3)} nan ${s.nan} clip ${s.clip} dc ${s.dc.toFixed(4)}`;
  const text = [...out.info, ...out.music.map(fmt), ...out.sfx.map(fmt), 'PROBLEMS: ' + (out.problems.join('; ') || 'none'), `time ${Math.round(performance.now() - t0)}ms`].join('\n');
  $('log').textContent = text;
  return text;
};
