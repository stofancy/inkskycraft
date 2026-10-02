// 分镜画廊挂入真实游戏 iframe，复用 World、attach、图集、背景与形变路径。
// 仅预览页显式加载；正常四章资产与内容保持原有路径。
import type { Game } from '../src/game/game';
import { ALL_SPRITES } from '../src/art';
import { loadSheetSprite } from '../src/art/sheets';
import { SpritePlayback, animateEntity } from '../src/art/playback';
import type { Enemy } from '../src/game/enemy';
import type { SpriteDef } from '../src/art/types';
import { Atlas } from '../src/gl/atlas';

const samples = [
  { id: 'player', label: '玩家 · 左右倾斜', size: 100, x: 210, y: 240 },
  { id: 'bird', label: '伙伴 · 扇翅', size: 96, x: 450, y: 240 },
  { id: 'enemy', label: '敌机 · 展开', size: 80, x: 690, y: 240 },
  { id: 'boss', label: '部件 · 开合与挂接', size: 180, x: 220, y: 555 },
  { id: 'bullet', label: '子弹 · 脉动', size: 28, x: 450, y: 555 },
  { id: 'explosion', label: '爆炸 · 单次播放', size: 150, x: 690, y: 555 },
  { id: 'portrait', label: '立绘 · 眨眼与口型', size: 170, x: 210, y: 935 },
  { id: 'lantern', label: '场景 · 灯火', size: 110, x: 450, y: 860 },
];

export async function installSheetScene(game: Game, version: 1 | 2 = 2) {
  const w = game.world, r = game.r;
  const doc = r.canvas.ownerDocument, sceneWindow = doc.defaultView!;
  game.state = 'paused';
  const defs = await Promise.all(samples.map(s => loadSheetSprite(`sheet_${s.id}`, `art/sheets/${s.id}/${version === 2 && ['bird','enemy','portrait'].includes(s.id) ? 'aligned-v2' : 'aligned'}`, s.size)));
  const oldAlbedo = r.atlas.albedo, oldGlow = r.atlas.glow;
  // 在独立图集中完整构建后同步切换，加载期间游戏仍可使用旧图集绘制。
  const next = new Atlas(r.gl);
  await next.build([...ALL_SPRITES, ...defs], 1.5);
  r.atlas.map.clear();
  for (const [id, info] of next.map) r.atlas.map.set(id, info);
  r.atlas.albedo = next.albedo; r.atlas.glow = next.glow;
  r.gl.deleteTexture(oldAlbedo); r.gl.deleteTexture(oldGlow);
  w.resetStage(); w.player.reset(false); w.player.entering = 0; w.player.invuln = 1e6;
  w.player.x = 450; w.player.y = 1100; w.player.weapon = 'red';
  game.state = 'playing'; game.ui.screen('none');
  const events: { time: number; name: string; frame: number }[] = [];
  const entries: { entity: Enemy; playback: SpritePlayback; def: SpriteDef; id: string; offset: number }[] = [];
  const add = (def: SpriteDef, entity: Enemy, offset = 0) => {
    const playback = new SpritePlayback(def.sheet!, event => {
      events.push({ time: w.time, name: event.name, frame: event.frame });
      if (events.length > 32) events.shift();
      if (event.name === 'impact') entries.find(e => e.id === 'enemy')!.entity.flash = 1;
    });
    playback.seek(offset);
    entity.frame = playback.frame;
    entries.push({ entity, playback, def, id: def.id.replace('sheet_', ''), offset });
  };
  samples.forEach((s, i) => {
    if (s.id === 'boss') {
      const body = w.spawn({ sprite: 'pipeline_body', hp: 1e6, noCollide: true, invulnerable: true }, s.x - 28, s.y);
      body.scaleX = body.scaleY = .4;
      const wing = w.attach(body, { sprite: defs[i].id, hp: 1e6, noCollide: true, invulnerable: true,
        bone: { rot: { amplitude: .06, period: 2.4 } } }, [0, 0]);
      add(defs[i], wing);
    } else {
      const entity = w.spawn({ sprite: defs[i].id, hp: 1e6, noCollide: true, invulnerable: true,
        deform: s.id === 'bird' ? { breath: .025, sway: 2, speed: 3, weight: [.2, 1] } : undefined }, s.x, s.y);
      add(defs[i], entity);
    }
  });
  const clone = w.spawn({ sprite: 'sheet_bird', hp: 1e6, noCollide: true, invulnerable: true }, 690, 860);
  add(defs[1], clone, .375);
  clone.run(animateEntity(clone, entries.at(-1)!.playback));
  let elapsed = 0, nextReplay = 2.5;
  const originalTick = w.tick.bind(w);
  w.tick = dt => {
    originalTick(dt); elapsed += w.dt;
    if (elapsed >= nextReplay) {
      entries.find(e => e.id === 'explosion')!.playback.restart(); nextReplay += 2.5;
    }
    for (const entry of entries) {
      if (entry.entity === clone) continue; // 此伙伴通过实体协程推进，证明关卡接入路径。
      entry.playback.update(w.dt); entry.entity.frame = entry.playback.frame;
    }
  };
  const labels = doc.createElement('div');
  labels.id = 'sheet-labels'; labels.style.cssText = 'position:fixed;pointer-events:none;z-index:20';
  doc.body.append(labels);
  const descriptions = [...samples.map(s => ({ ...s, ly: s.id === 'portrait' ? 995 : s.y + 115 })),
    { id: 'clone', label: '伙伴 · 独立相位', x: 690, ly: 975 }];
  const updateLabels = () => {
    const p = r.playCss; labels.style.left = `${p.x}px`; labels.style.top = `${p.y}px`;
    labels.style.width = `${p.w}px`; labels.style.height = `${p.h}px`;
    labels.innerHTML = descriptions.map(s => `<span style="position:absolute;left:${s.x/9}%;top:${s.ly/12}%;transform:translateX(-50%);white-space:nowrap;font:12px serif;color:#eee7d6;background:#182126cc;border-bottom:1px solid #a7874e;padding:4px 8px">${s.label}</span>`).join('');
  };
  updateLabels();
  sceneWindow.addEventListener('resize', updateLabels);
  const controls = {
    entries, events, version,
    seek(time: number) {
      elapsed = time; nextReplay = (Math.floor(time / 2.5) + 1) * 2.5;
      w.time = w.real = time;
      entries.forEach(e => {
        e.playback.seek((e.id === 'explosion' ? time % 2.5 : time) + e.offset);
        e.entity.frame = e.playback.frame; e.entity.age = time; e.entity.flash = 0;
        if (e.entity.parent) e.entity.syncToParent();
      });
    },
    replay: () => {
      const entry = entries.find(e => e.id === 'explosion')!;
      entry.playback.restart(); entry.entity.frame = entry.playback.frame;
    },
    setDeform(enabled: boolean) {
      entries.filter(e => e.id === 'bird').forEach(e => e.entity.def.deform = enabled ? { breath: .025, sway: 2, speed: 3, weight: [.2, 1] } : undefined);
    },
  };
  (sceneWindow as unknown as { __sheets: typeof controls }).__sheets = controls;
  return controls;
}
