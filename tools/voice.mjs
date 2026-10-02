#!/usr/bin/env node
// 配音：node tools/voice.mjs [--role 小满] [--dry-run] [--force] [--id CH1.D01] [--jobs 3]
// VOICE_API_KEY 或 VOICE_API_KEY_FILE 提供中转站推理密钥；密钥不写进选角表或索引。
import { readFile, writeFile, mkdir, rename, rm, access, readdir, mkdtemp, copyFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), options = { jobs: 3 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help') {
    console.log('VOICE_API_KEY_FILE=/path/to/key node tools/voice.mjs\nnode tools/voice.mjs --role 小满\nnode tools/voice.mjs --dry-run\n可选：--force 强制重配；--id <id> 单句；--jobs <1..8> 并发。默认同时维护对白和14条战斗喊声。\n--samples 仅生成 studio/assets/voice-tests 的9组对照；旧版复制现有成品，调过版请求TTS，不改游戏音频。');
    process.exit(0);
  }
  if (a === '--dry-run' || a === '--force' || a === '--samples') options[a.slice(2)] = true;
  else if (['--role', '--id', '--jobs'].includes(a) && args[i + 1] && !args[i + 1].startsWith('--')) options[a.slice(2)] = args[++i];
  else throw new Error(`未知参数或缺少值：${a}；用 --help 查看用法`);
}
options.jobs = Number(options.jobs);
if (!Number.isInteger(options.jobs) || options.jobs < 1 || options.jobs > 8) throw new Error('--jobs 必须为 1..8');
const cast = JSON.parse(await readFile(join(root, 'studio/assets/voice-cast.json'), 'utf8'));
async function loadTS(file) {
  // Node 24 去除类型后读取数据导出，保留字符串和对象结构，不用正则拆台词。
  const source = await readFile(join(root, file), 'utf8');
  const outputText = stripTypeScriptTypes(source);
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const sources = ['src/stages/dialogue1_data.ts', 'src/stages/dialogue1_boss_data.ts', 'src/stages/dialogue2_data.ts', 'src/stages/fodder1_text.ts'];
const [ch1, boss, ch2, fodder] = await Promise.all(sources.map(loadTS));
const lines = [];
function add(line, source, kind = 'dialogue') {
  const { id, speaker, text, emotion = 'calm' } = line;
  if (!id || !/^[\p{L}\p{N}_.-]+$/u.test(id) || !speaker || typeof text !== 'string' || !text.trim()) throw new Error(`无效台词：${id}`);
  if (!cast.roles[speaker]) throw new Error(`未选角：${speaker} (${id})`);
  lines.push({ id, speaker, text, emotion, source, kind, file: `public/audio/voice/${kind === 'combat' ? '' : 'dialogue/'}${id}.ogg` });
}
for (const [data, file] of [[ch1.CH1_LINES, sources[0]], [boss.BOSS_LINES, sources[1]], [ch2.CH2_LINES, sources[2]]]) for (const line of data) add(line, file);
for (const [key, cues] of Object.entries(fodder.FODDER_TEXT)) for (const [cue, text] of Object.entries(cues)) {
  add({ id: `CH1.FODDER.${key}.${cue}`, speaker: cue === 'R' ? text[0] : fodder.FODDER_NAME[key], text: cue === 'R' ? text[1] : text, emotion: cue === 'R' ? 'calm' : 'alarmed' }, sources[3]);
}
for (const [key, cues] of Object.entries(ch2.CH2_BUBBLES)) for (const [cue, text] of Object.entries(cues)) add({ id: `CH2.BUBBLE.${key}.${cue}`, speaker: ch2.CH2_NAME[key], text, emotion: 'calm' }, sources[2]);
for (const [id, line] of Object.entries(cast.combat)) add({ id, ...line }, 'studio/assets/voice-cast.json', 'combat');
const ids = new Set();
for (const line of lines) { if (ids.has(line.id)) throw new Error(`重复 id：${line.id}`); ids.add(line.id); }
if (options.role && !lines.some(l => l.speaker === options.role || cast.roles[l.speaker].alias === options.role)) throw new Error(`角色没有台词：${options.role}`);
if (options.id && !ids.has(options.id)) throw new Error(`台词不存在：${options.id}`);
if (options.samples && (options.role || options.id)) throw new Error('--samples 不能与 --role/--id 合用');
const samplePairs = [];
if (options.samples) {
  for (const test of cast.voiceTests) {
    const line = lines.find(line => line.id === test.id);
    if (!line) throw new Error(`试听源台词不存在：${test.id}`);
    samplePairs.push({ ...test, line });
  }
  lines.splice(0, lines.length, ...samplePairs.map(({ name, emotion, line }) => ({
    ...line, id: `${name}-tuned`, emotion, sourceId: line.id, file: `studio/assets/voice-tests/${name}-tuned.ogg`,
  })));
  ids.clear(); for (const line of lines) ids.add(line.id);
}
const directory = join(root, options.samples ? 'studio/assets/voice-tests' : 'public/audio/voice/dialogue'), indexPath = join(directory, 'index.json');
let index = { version: 1, lines: {} };
try { index = JSON.parse(await readFile(indexPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
function recipe(line) {
  const role = cast.roles[line.speaker];
  if (role.model.startsWith('tts-botcf01-') && role.model !== `tts-botcf01-${role.voice}`) throw new Error(`${line.speaker} 的固定模型与音色不一致；请一起更新 model 和 voice`);
  const delivery = role.delivery?.[line.emotion] ?? {};
  if (delivery.speed !== undefined && (!Number.isFinite(delivery.speed) || delivery.speed < 0.7 || delivery.speed > 1.3)) throw new Error(`${line.speaker} 的 speed 必须在本管线已测范围 0.7..1.3`);
  let input = Object.entries(cast.pronunciation).reduce((text, [word, replacement]) => text.replaceAll(word, replacement), line.text);
  if (delivery.sentenceEnd) {
    if (!['。', '！'].includes(delivery.sentenceEnd)) throw new Error('sentenceEnd 仅接受中文句号/感叹号');
    input = input.replace(/[。！]/g, delivery.sentenceEnd);
  }
  return { model: role.model, voice: role.voice, tone: role.tone, input, emotion: line.emotion,
    emotionParameter: cast.provider.emotionParameter, mappedEmotion: cast.provider.emotions?.[line.emotion], effects: role.effects ?? '', audio: cast.audio, pipeline: 2,
    ...(Object.keys(delivery).length ? { delivery } : {}) };
}
const signature = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pending = [];
for (const line of lines) {
  if (options.role && line.speaker !== options.role && cast.roles[line.speaker].alias !== options.role) continue;
  if (options.id && line.id !== options.id) continue;
  const previous = index.lines[line.id], current = recipe(line);
  let exists = true; try { await access(join(root, line.file)); } catch { exists = false; }
  if (options.force || !exists || previous?.text !== line.text || previous?.speaker !== line.speaker || previous?.signature !== signature(current)) pending.push({ ...line, recipe: current });
}
// 清理仅限本管线的对白目录；战斗目录里其他素材由各自制作任务管理。
const obsolete = new Set(options.samples ? [] : Object.keys(index.lines).filter(id => !ids.has(id)));
try { if (!options.samples) for (const file of await readdir(directory)) if (file.endsWith('.ogg') && !ids.has(file.slice(0, -4))) obsolete.add(file.slice(0, -4)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
console.log(`源台词 ${lines.length}（对白 ${lines.filter(l => l.kind === 'dialogue').length}，喊声 ${lines.filter(l => l.kind === 'combat').length}）；需生成 ${pending.length}；需删除 ${obsolete.size}`);
if (options['dry-run']) {
  for (const line of pending) console.log(`生成 ${line.id}\t${line.speaker}\t${line.recipe.model}\t${line.text}`);
  for (const id of obsolete) console.log(`删除 ${id}`);
  process.exit(0);
}
const apiKey = process.env.VOICE_API_KEY ?? (process.env.VOICE_API_KEY_FILE ? (await readFile(process.env.VOICE_API_KEY_FILE, 'utf8')).trim() : '');
if (pending.length && !apiKey) throw new Error('生成需要 VOICE_API_KEY 或 VOICE_API_KEY_FILE（中转站推理令牌）。');
await mkdir(directory, { recursive: true });
if (options.samples) {
  const original = JSON.parse(await readFile(join(root, 'public/audio/voice/dialogue/index.json'), 'utf8'));
  for (const { name, label, line } of samplePairs) {
    const previous = original.lines[line.id];
    if (!previous || previous.text !== line.text || previous.voice !== cast.roles[line.speaker].voice) throw new Error(`试听旧版与当前台词/音色不符：${line.id}`);
    const file = `studio/assets/voice-tests/${name}-current.ogg`;
    await copyFile(join(root, line.file), join(root, file));
    index.lines[`${name}-current`] = { ...previous, id: `${name}-current`, file, sourceId: line.id, label, variant: 'current' };
  }
}
async function saveIndex() {
  const sorted = Object.fromEntries(Object.entries(index.lines).sort(([a], [b]) => a.localeCompare(b, 'zh')));
  await writeFile(`${indexPath}.tmp`, JSON.stringify({ ...index, lines: sorted }, null, 2) + '\n');
  await rename(`${indexPath}.tmp`, indexPath);
}
for (const id of obsolete) { await rm(join(directory, `${id}.ogg`), { force: true }); delete index.lines[id]; }
// 保存按串行队列写入，避免多个请求完成时覆盖索引；每句完成即落盘，可安全续跑。
let saves = Promise.resolve();
function checkpoint() { saves = saves.then(saveIndex); return saves; }
function command(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => stdout += b); child.stderr.on('data', b => stderr += b);
    child.on('error', reject); child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${executable} ${code}: ${stderr.slice(-1500)}`)));
  });
}
async function generate(line) {
  const temp = await mkdtemp(join(tmpdir(), 'skycraft-voice-'));
  try {
    const r = line.recipe;
    const payload = { model: r.model, input: r.input, voice: r.voice, response_format: 'mp3' };
    // 只发送实测有效的语速；情绪与语气说明保留在本地，不混进朗读正文。
    if (r.delivery?.speed !== undefined) payload.speed = r.delivery.speed;
    const url = `${(process.env.VOICE_API_BASE ?? cast.provider.baseUrl).replace(/\/$/, '')}/audio/speech`;
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(180000) });
    if (!response.ok) throw new Error(`TTS HTTP ${response.status}`);
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('audio') && !type.includes('octet-stream')) throw new Error(`TTS 返回 ${type}，未得到音频`);
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 1000) throw new Error(`TTS 音频过短：${audio.length} 字节`);
    const raw = join(temp, 'raw.mp3'), trimmed = join(temp, 'trim.wav'), output = join(root, line.file);
    await writeFile(raw, audio);
    const trim = 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB:start_silence=0.025';
    const pre = [r.effects, trim, 'areverse', trim, 'areverse'].filter(Boolean).join(',');
    await command('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af', `${pre},${r.audio.compressor}`, '-ar', String(r.audio.sampleRate), '-ac', String(r.audio.channels), trimmed]);
    const target = `loudnorm=I=${r.audio.lufs}:TP=${r.audio.truePeak}:LRA=${r.audio.lra}`;
    const measurement = await command('ffmpeg', ['-nostdin', '-hide_banner', '-i', trimmed, '-af', `${target}:print_format=json`, '-f', 'null', '-']);
    const m = JSON.parse(measurement.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] ?? 'null');
    if (!m || !Number.isFinite(Number(m.input_i))) throw new Error('音频无有效语音响度');
    const normal = `${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    await command('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', trimmed, '-af', normal, '-ar', String(r.audio.sampleRate), '-ac', String(r.audio.channels), '-c:a', 'libvorbis', '-q:a', String(r.audio.quality), '-f', 'ogg', `${output}.tmp`]);
    const probe = await command('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', `${output}.tmp`]);
    const duration = Number(probe.stdout.trim());
    if (!Number.isFinite(duration) || duration < 0.15) throw new Error('归一音频时长无效');
    await rename(`${output}.tmp`, output);
    index.lines[line.id] = { id: line.id, text: line.text, speaker: line.speaker, emotion: line.emotion, model: r.model, voice: r.voice, tone: r.tone,
      duration: +duration.toFixed(3), file: line.file, source: line.source, kind: line.kind, ttsInput: r.input, signature: signature(r), delivery: r.delivery, ...(options.samples ? { sourceId: line.sourceId, variant: 'tuned' } : {}), generatedAt: new Date().toISOString() };
    await checkpoint();
    console.log(`完成 ${line.id}\t${line.speaker}\t${duration.toFixed(2)}s`);
  } finally { await rm(temp, { recursive: true, force: true }); await rm(join(root, `${line.file}.tmp`), { force: true }); }
}
const failures = [];
let next = 0;
await Promise.all(Array.from({ length: options.jobs }, async () => {
  while (next < pending.length) {
    const line = pending[next++];
    try { await generate(line); } catch (error) { failures.push({ id: line.id, speaker: line.speaker, text: line.text, error: error.message }); console.error(`失败 ${line.id}: ${error.message}`); }
  }
}));
await checkpoint();
console.log(`本轮成功 ${pending.length - failures.length}；失败 ${failures.length}；索引 ${indexPath}`);
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
