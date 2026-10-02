// 墨空 UI：纯 DOM + CSS。入口 createUI()。时序要求见 tools/ui-preview.ts 顶部与最终报告。
import { DIFFS, DIFF_ORDER, type Difficulty } from '../core/difficulty';
import { DEFAULT_SETTINGS } from '../types';
import type {
  DialogueActor, GameUI, HudState, InputState, PopupKind, Rect, ScreenData, ScreenName, Settings, StageResult, UIEvents, WeaponColor,
} from '../types';
import { Motion, CURVES, MOTION } from './motion';
import { CSS } from './css';
import { passivePreview } from './passive-preview';
import { TALENTS } from '../game/progression';
import { TEST_CHECKPOINTS } from '../stages/checkpoints';
import { defaultTestOptions, TEST_CAPABILITIES } from '../game/test-options';
import { COMBO_MOVES } from '../game/combos';

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const passiveImages=import.meta.glob('/public/art/icons/passives/*.png',{eager:true,query:'?url',import:'default'});
const passiveIcon=(id:string,label:string)=>{const url=passiveImages[`/public/art/icons/passives/${id}.png`] as string|undefined;return url?`<img src="${esc(url)}" alt="${esc(label)}">`:esc(label);};
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function h(tag: string, cls = '', html = '', parent?: Element): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

const DEFS = `<svg class="defs" xmlns="http://www.w3.org/2000/svg"><defs>
<filter id="ik-rough" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves="3" seed="7" result="n"/>
 <feDisplacementMap id="ik-dm" in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feGaussianBlur in="d" stdDeviation="4" result="b"/>
 <feColorMatrix in="b" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .3 0" result="halo"/>
 <feMerge><feMergeNode in="halo"/><feMergeNode in="d"/></feMerge>
</filter>
<filter id="ik-rough-s" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.05 0.07" numOctaves="2" seed="3" result="n"/>
 <feDisplacementMap id="ik-dms" in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="ik-seal" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="11" result="n"/>
 <feDisplacementMap in="SourceGraphic" in2="n" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 2.15" result="m"/>
 <feComposite in="d" in2="m" operator="in"/>
</filter>
</defs></svg>`;

const ICON_LIFE = '<svg viewBox="0 0 24 24"><path d="M12 1.5 14 9l8.5 7-8-1.6L12 22.5 9.5 14.400 1.500 16 10 9z" fill="#d8382a" stroke="#dcb75e" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 5v9" stroke="#0b0908" stroke-width="1.6"/></svg>';
const ICON_BOMB = '<svg viewBox="0 0 24 24"><path d="M12 1.500C12 1.500 4.500 10.500 4.500 15.500a7.500 7.500 0 0 0 15 0C19.500 10.500 12 1.500 12 1.500Z" fill="#14100e" stroke="#dcb75e" stroke-width="1.300"/><path d="M8.500 15a3.500 3.500 0 0 0 2.500 3.400" stroke="#efe6d2" stroke-width="1.400" fill="none" stroke-linecap="round" opacity=".7"/></svg>';
const ICON_COIN = '<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="#c79a3a" stroke="#f2d27a" stroke-width="1.500"/><circle cx="17" cy="17" r="11.500" fill="none" stroke="#7a5a1c" stroke-width="1"/><rect x="12.500" y="12.500" width="9" height="9" fill="#0b0908" stroke="#f2d27a" stroke-width="1.200"/></svg>';

// 毛笔形墨槽（笔杆 + 金箍 + 笔肚 + 笔锋）
const BRUSH_D = 'M35 4Q43 0 51 4L52 50Q66 70 70 112C73 160 58 222 43 296C28 222 13 160 16 112Q20 70 34 50Z';
const INK_SVG = `<svg viewBox="0 0 86 300"><defs>
<clipPath id="ik-bc"><path d="${BRUSH_D}"/></clipPath>
<linearGradient id="ik-g0" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a1310"/><stop offset=".5" stop-color="#4a3a30"/><stop offset="1" stop-color="#1a1310"/></linearGradient>
<linearGradient id="ik-g1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a1a12"/><stop offset=".45" stop-color="#ff5a3a"/><stop offset="1" stop-color="#a9241a"/></linearGradient>
<linearGradient id="ik-g2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d6a1c"/><stop offset=".5" stop-color="#ffe08a"/><stop offset="1" stop-color="#a9791f"/></linearGradient>
</defs>
<path d="${BRUSH_D}" fill="#0a0807" fill-opacity=".72"/>
<g clip-path="url(#ik-bc)">
 <rect class="fill" id="ik-fill" x="0" y="0" width="86" height="300" fill="url(#ik-g0)" style="transform:translateY(300px)"/>
 <path d="M0 75H86M0 150H86M0 225H86" stroke="#ffffff" stroke-opacity=".16" stroke-width="1" stroke-dasharray="3 5"/>
</g>
<rect x="31" y="46" width="24" height="9" rx="2" fill="url(#ik-g2)" stroke="#3a2a08" stroke-width=".8"/>
<path d="${BRUSH_D}" fill="none" stroke="#dcb75e" stroke-width="2" stroke-linejoin="round"/>
</svg><div class="il">墨</div>`;

// 按键表：[动作, 键盘, 手柄]，图例、标题、暂停共用
const KEYS: [string, string, string][] = [
  ['移动', 'WASD / 方向键', '左摇杆 / 十字键'],
  ['射击', 'Z / J / 空格', 'A（南）'],
  ['泼墨', 'X / K', 'B（东）'],
  ['一笔', 'C / L', 'X（西） / RT'],
  ['集中', 'Shift', 'LT / LB'],
  ['换色', 'V / Tab', 'Y（北）'],
  ['暂停', 'Esc / P', 'Start'],
];
const keyRows = (g: boolean) => KEYS.map(([a, k, p], i) => `<div class="kr${i === 3 ? ' kb' : ''}"><span class="ka">${a}</span><span class="kk">${g ? p : k}</span></div>`).join('');

interface Row { el: HTMLElement; disabled?: boolean; activate?: () => void; adjust?: (d: number) => void }

class Digits {
  private spans: HTMLElement[] = [];
  private s = '';
  constructor(private el: HTMLElement, private min: number) {}
  set(n: number): void {
    const str = String(Math.max(0, Math.floor(n))).padStart(this.min, '0');
    if (str === this.s) return;
    if (str.length !== this.s.length) {
      this.el.textContent = '';
      this.spans = [...str].map(() => h('span', 'd', '', this.el));
      this.s = ' '.repeat(str.length);
    }
    const first = str.search(/[1-9]/);
    const z = first < 0 ? str.length - 1 : first;
    for (let i = 0; i < str.length; i++) {
      const sp = this.spans[i];
      if (str[i] !== this.s[i]) sp.textContent = str[i];
      const isz = i < z;
      if (sp.classList.contains('z') !== isz) sp.classList.toggle('z', isz);
    }
    this.s = str;
  }
}

export type { DialogueActor } from '../types';
export interface PresentationUI {
  say(actor: string | DialogueActor, expression: string, text: string, duration?: number): void;
  notice(text: string, duration?: number): void;
  stageCard(stage: number, title: string, subtitle: string, duration?: number): void;
}
export function createUI(): GameUI & PresentationUI {
  const motion = new Motion();
  let ev: UIEvents;
  let ik: HTMLElement;
  let play: HTMLElement;
  let hostL: HTMLElement, hostR: HTMLElement;
  let challengeEl: HTMLElement, comboEl: HTMLElement;
  let dock: HTMLElement, noticeL: HTMLElement;
  let movesDock: HTMLElement, movesEl: HTMLElement, moveFeedbackEl: HTMLElement;
  let fx: HTMLElement, cardL: HTMLElement, warnL: HTMLElement, capL: HTMLElement, bossEl: HTMLElement, scr: HTMLElement;
  let hint: HTMLElement | null = null;
  let settings: Settings = { ...DEFAULT_SETTINGS };
  let vp = { w: 900, h: 1200 };
  let pr: Rect = { x: 0, y: 0, w: 900, h: 1200 };
  let compact = false;
  let u = 1;
  let device: 'keyboard' | 'gamepad' = 'keyboard';
  let curDiff: Difficulty = 'normal';
  let keysEl: HTMLElement;
  let screenData: ScreenData = {};
  let baseData: ScreenData = {};
  let challengeState: HudState['challenge'] = null;

  // ------------------------------------------------ HUD
  const R: Record<string, HTMLElement> = {};
  let scoreD: Digits, hiD: Digits;
  let scoreDisp = 0;
  const prev: Record<string, unknown> = {};
  let hudVis = true;
  let stageNoPrev = '';

  function buildHud() {
    hostL = h('div', 'host l', '', ik);
    hostR = h('div', 'host r', '', ik);
    hostL.innerHTML = `<div class="hud">
 <div class="blk"><div class="lbl">得分<i>SCORE</i></div><div class="digits" data-k="score"></div></div>
 <div class="blk"><div class="lbl">最高<i>HI-SCORE</i></div><div class="digits sm" data-k="hi"></div></div>
 <div class="row2 blk nl" style="gap:18px"><div class="blk"><div class="lbl">倍率</div><div class="mv" data-k="mult"></div></div>
  <div class="blk"><div class="lbl">擦弹</div><div class="gv" data-k="graze"></div></div></div>
 <div class="blk medal nl"><div>${ICON_COIN}</div><div class="mm"><div class="lbl">金印</div><div class="gv" data-k="medal"></div></div></div>
 <div class="fps" data-k="fps"></div></div>`;
    hostR.innerHTML = `<div class="hud">
 <div class="stage"><div class="sn" data-k="stageNo"></div><div class="sm" data-k="stageName"></div><div class="dn" data-k="diff"></div></div>
 <div class="blk"><div class="lbl">剩余战机<i>LIFE</i></div><div class="icons" data-k="lives"></div></div>
 <div class="blk"><div class="lbl">泼墨<i>INK BOMB</i></div><div class="icons" data-k="bombs"></div></div>
 <div class="inkrow"><div class="ink" data-k="ink">${INK_SVG}</div>
  <div class="wp"><div class="wseal w-red" data-k="wseal">朱</div><div class="lat" data-k="lat">${'<i></i>'.repeat(8)}</div>
   <div class="mis" data-k="mis"><span>追踪弹</span><b data-k="missiles">0 / 4</b></div></div></div>
 <div class="growth-mini" data-k="growth"></div>
 <div class="partners" data-k="partners"></div></div>`;
    for (const e of ik.querySelectorAll<HTMLElement>('[data-k]')) R[e.dataset.k!] = e;
    R.fill = ik.querySelector('#ik-fill') as HTMLElement;
    keysEl = h('div', 'keyhost off', '<div class="keys"><div class="kh">操作</div><div class="kl"></div></div>', ik);
    R.keyl = keysEl.querySelector('.kl') as HTMLElement;
    renderKeys();
    movesDock = h('div', 'moves-dock off', '', ik);
    movesEl = h('div', 'active-moves', '', movesDock);
    moveFeedbackEl = h('div', 'move-feedback-card', '', movesDock);
    moveFeedbackEl.setAttribute('aria-live', 'polite');
    scoreD = new Digits(R.score, 8);
    hiD = new Digits(R.hi, 8);
    // boss
    bossEl.innerHTML = `<div class="bn"><span data-k="bname"></span><span class="ph" data-k="bph"></span><span class="tm" data-k="btm"></span></div>
 <div class="bar"><b class="tr" data-k="btr"></b><b class="hp" data-k="bhp"></b></div><div class="boss-target" data-k="btarget"></div>`;
    for (const e of bossEl.querySelectorAll<HTMLElement>('[data-k]')) R[e.dataset.k!] = e;
  }

  function renderKeys() {
    if (!R.keyl) return;
    R.keyl.innerHTML = keyRows(device === 'gamepad');
    prev.inkReady = undefined;
  }
  function setText(k: string, v: string) {
    if (prev[k] !== v) { prev[k] = v; R[k].textContent = v; }
  }
  function iconRow(k: string, n: number, svg: string) {
    if (prev[k] === n) return;
    prev[k] = n;
    const shown = Math.min(n, 8);
    R[k].innerHTML = svg.repeat(Math.max(0, shown)) + (n > 8 ? `<b>×${n}</b>` : '') + (n <= 0 ? '<b style="opacity:.4">—</b>' : '');
  }
  function toggle(k: string, el: HTMLElement, cls: string, on: boolean) {
    const key = k + cls;
    if (prev[key] !== on) { prev[key] = on; el.classList.toggle(cls, on); }
  }

  function hud(s: HudState, visible: boolean) {
    if (visible !== hudVis) {
      hudVis = visible;
      hostL.classList.toggle('off', !visible);
      hostR.classList.toggle('off', !visible);
      keysEl.classList.toggle('off', !visible);
      movesDock.classList.toggle('off', !visible);
    }
    if (!visible) { motion.clear(challengeEl); motion.clear(comboEl); motion.clear(bossEl); motion.clear(moveFeedbackEl); prev.moveFeedback = null; prev.challengeOn = false; prev.comboOn = false; ik.classList.remove('challenging'); challengeEl.classList.remove('on'); comboEl.classList.remove('on'); moveFeedbackEl.classList.remove('on'); bossEl.classList.remove('on'); ik.classList.remove('bs'); prev.boss = false; return; }

    setText('diff', s.difficulty);
    if (prev.inkReady !== s.inkReady) {
      prev.inkReady = s.inkReady;
      R.keyl.querySelector('.kb')?.classList.toggle('rdy', s.inkReady);
      if (s.inkReady) motion.pulse(R.ink);
    }
    // 分数滚动
    const diff = s.score - scoreDisp;
    if (diff < 0 || diff > 5e9) scoreDisp = s.score;
    else if (diff > 0) scoreDisp += Math.max(1, Math.ceil(diff * 0.14));
    scoreD.set(scoreDisp);
    if (prev.hi !== s.hiScore) { prev.hi = s.hiScore; hiD.set(s.hiScore); }
    const m = s.multiplier.toFixed(2);
    if (prev.multv !== m) { prev.multv = m; R.mult.innerHTML = `<small>×</small>${m}`; }
    toggle('mult', R.mult, 'hot', s.multiplier >= 4);
    setText('graze', fmt(s.graze));
    setText('medal', fmt(s.medalValue));
    const sn = `第${CN[s.stage] ?? s.stage}幕`;
    setText('stageNo', sn);
    setText('stageName', s.stageName);
    if (stageNoPrev !== sn) stageNoPrev = sn;
    iconRow('lives', s.lives, ICON_LIFE);
    iconRow('bombs', s.bombs, ICON_BOMB);
    // 墨槽
    const inkY = `translateY(${((1 - Math.min(1, Math.max(0, s.ink))) * 288 + 6).toFixed(1)}px)`;
    if (prev.ink !== inkY) { prev.ink = inkY; R.fill.style.transform = inkY; }
    const readyKey = s.brushActive ? 2 : s.inkReady ? 1 : 0;
    if (prev.inkstate !== readyKey) {
      prev.inkstate = readyKey;
      R.ink.classList.toggle('ready', readyKey === 1);
      R.ink.classList.toggle('brush', readyKey === 2);
      R.fill.setAttribute('fill', readyKey === 2 ? 'url(#ik-g2)' : readyKey === 1 ? 'url(#ik-g1)' : 'url(#ik-g0)');
      (R.ink.querySelector('.il') as HTMLElement).textContent = readyKey === 2 ? '书' : '墨';
    }
    // 武器
    if (prev.weapon !== s.weapon) {
      const first = prev.weapon === undefined;
      prev.weapon = s.weapon;
      const w: Record<WeaponColor, string> = { red: '朱', blue: '青', purple: '雷' };
      R.wseal.textContent = w[s.weapon];
      R.wseal.className = `wseal w-${s.weapon}`;
      R.lat.className = `lat w-${s.weapon}`;
      if (!first) motion.stamp(R.wseal);
    }
    if (prev.power !== s.power) {
      prev.power = s.power;
      const dots = R.lat.children;
      for (let i = 0; i < 8; i++) dots[i].classList.toggle('on', i < s.power);
    }
    if (prev.missile !== s.missile) {
      prev.missile = s.missile;
      R.missiles.textContent = `${s.missile} / 4`;
    }
    setText('fps', settings.showFps && s.fps > 0 ? `${Math.round(s.fps)} FPS` : '');
    const growth = s.growth;
    setText('growth', growth ? `一笔 Lv.${growth.brush} · 泼墨 Lv.${growth.bomb} · 天赋 ${growth.talents}` : '');
    const partners = s.companions ?? [];
    const partnerKey = partners.map(p => `${p.name}:${Math.ceil(p.active??0)}:${p.count??0}`).join('|');
    if (prev.partners !== partnerKey) {
      prev.partners = partnerKey;
      R.partners.innerHTML = partners.map((p,i)=>`<div class="partner p${i} ${(p.active??0)>0?'effect-on':''}" data-companion="${esc(p.kind??'')}"><span class="partner-seal">${esc(p.name.slice(0,1))}</span><div class="partner-info"><div>${esc(p.name)} <b>${esc(p.role??'')}</b></div><small>${(p.active??0)>0?`生效 ${Math.ceil(p.active!)}秒${p.role==='挡弹'?` · ${p.count??0}/6`:''}`:'自动协同'}</small></div></div>`).join('');
    }
    let passiveDock=R.partners.parentElement!.querySelector<HTMLElement>('.passive-dock');
    if(!passiveDock)passiveDock=h('div','passive-dock','',R.partners.parentElement!);
    const passiveKey=(s.passives??[]).map(p=>`${p.id}:${Math.ceil(p.timer)}:${p.triggers}`).join('|');
    if(prev.passives!==passiveKey){
      prev.passives=passiveKey;
      passiveDock.innerHTML=(s.passives?.length?'<div class="kh">已选被动 · 行动后自动生效</div>':'')+(s.passives??[]).map(p=>`<div class="passive-status ${p.timer>0?'triggered':''}" data-passive="${esc(p.id)}"><span class="passive-icon" aria-label="${esc(p.name)}">${passiveIcon(p.id,p.icon)}</span><strong>${esc(p.name)}</strong><small>${p.timer>0?'生效中':'已习得'}</small></div>`).join('');
      for(const el of passiveDock.querySelectorAll('.triggered'))motion.pulse(el);
    }

    const active = s.activeMoves;
    movesDock.hidden = !active;
    const feedback = active?.feedback ?? '';
    if (prev.moveFeedback !== feedback) {
      prev.moveFeedback = feedback; motion.clear(moveFeedbackEl);
      if (feedback) { moveFeedbackEl.textContent = feedback; moveFeedbackEl.classList.add('on'); motion.enter(moveFeedbackEl, 'sweep'); }
      else if (moveFeedbackEl.classList.contains('on')) motion.exit(moveFeedbackEl, () => { moveFeedbackEl.classList.remove('on'); moveFeedbackEl.textContent = ''; });
    }
    const moveKey = JSON.stringify([active, device, Math.round(s.ink*100)]);
    if (prev.activeMoves !== moveKey) {
      prev.activeMoves = moveKey;
      const key = device === 'gamepad' ? 'R3' : 'F / U';
      const direction = (input: string) => Array.from(input).map(ch => {
        const angles: Record<string, number> = { '↑': 0, '↗': 45, '→': 90, '↘': 135, '↓': 180, '↙': 225, '←': 270, '↖': 315 };
        return ch in angles ? `<i class="direction" aria-hidden="true" style="--turn:${angles[ch]}deg"><svg viewBox="0 0 24 24"><path d="M12 20V4M5 11l7-7 7 7"/></svg></i>` : '';
      }).join('');
      movesEl.innerHTML = active ? `<div class="kh">出招</div>${active.moves.map(m=>{
        const status = !m.available ? '暂不可用' : m.cooldown>0 ? `冷却 ${m.cooldown.toFixed(1)} 秒` : s.ink<m.cost ? '墨不足' : '可出招';
        return `<div class="active-move ${status==='可出招'?'ready':''}" data-move="${esc(m.id)}"><strong>${esc(m.name)}</strong><span class="move-command" role="img" aria-label="${esc(m.input)} 加 ${key}">${direction(m.input)}<b>+ ${key}</b></span><small>${status==='可出招'?`墨 ${Math.round(m.cost*100)}%`:status}</small></div>`;
      }).join('')}` : '';
    }
    const comboOn = !!s.combo && !s.challenge;
    if (prev.combo !== s.combo || prev.comboOn !== comboOn) {
      prev.combo = s.combo; prev.comboOn = comboOn;
      if (comboOn) comboEl.textContent = `被动连携 · ${s.combo}`;
      motion.clear(comboEl);
      if (comboOn) motion.enter(comboEl, 'sweep');
      else if (comboEl.classList.contains('on')) motion.exit(comboEl, () => { comboEl.classList.remove('on'); comboEl.textContent = ''; });
    }
    if (comboOn) comboEl.classList.add('on');

    challengeState = s.challenge;
    renderChallenge();
    // Boss
    const b = s.boss;
    if (b) {
      if (!prev.boss) { prev.boss = true; bossEl.classList.add('on'); ik.classList.add('bs'); motion.clear(bossEl); motion.enter(bossEl); }
      setText('bname', b.name);
      if (prev.btarget !== (b.hint ?? '')) { setText('btarget', b.hint ?? ''); if (b.hint) motion.enter(R.btarget, 'float'); }
      if (prev.bph !== b.phasesLeft) { prev.bph = b.phasesLeft; R.bph.innerHTML = '<i></i>'.repeat(Math.max(1, Math.min(9, b.phasesLeft))); }
      setText('btm', b.timer === undefined ? '' : String(Math.max(0, Math.ceil(b.timer))));
      const hp = `scaleX(${Math.min(1, Math.max(0, b.hp)).toFixed(3)})`;
      if (prev.bhp !== hp) { prev.bhp = hp; R.bhp.style.transform = hp; R.btr.style.transform = hp; }
    } else if (prev.boss) {
      prev.boss = false; motion.clear(bossEl); motion.exit(bossEl, () => bossEl.classList.remove('on')); ik.classList.remove('bs');
    }
  }

  function renderChallenge() {
    const c = challengeState;
    const challengeOn = !!c && hudVis;
    if (prev.challengeOn !== challengeOn) {
      prev.challengeOn = challengeOn; motion.clear(challengeEl);
      if (challengeOn) { challengeEl.classList.add('on'); motion.enter(challengeEl); }
      else motion.exit(challengeEl, () => challengeEl.classList.remove('on'));
    }
    ik.classList.toggle('challenging', !!c && hudVis);
    if (!c) return;
    const g = device === 'gamepad';
    const key = c.action === 'focus' ? (g ? 'LT' : 'Shift') : c.action === 'bomb' ? (g ? 'B（东）' : 'X') : (g ? 'X（西） / RT' : 'C');
    const action = c.action === 'brush' ? `按住 ${key} 运笔，松开封阵` : `松开后新按 ${key} ${c.action === 'focus' ? '集中' : '反制'}`;
    const note = c.action === 'bomb' ? '本次不耗泼墨' : c.action === 'brush' ? '画成闭环并圈住目标才封阵' : '保持移动与射击';
    const markup = `${esc(c.title)}|${action}|${esc(c.hint)}|${note}`;
    if (prev.challengeMarkup !== markup) {
      prev.challengeMarkup = markup;
      challengeEl.innerHTML = `<div class="qte-copy"><div class="qte-title">${esc(c.title)}</div><div class="qte-action">${esc(action)}</div><div class="qte-hint">${esc(c.hint)}</div><div class="qte-note">${note}</div></div><div class="qte-clock"><svg viewBox="0 0 80 80"><circle class="qte-track" cx="40" cy="40" r="34"/><circle class="qte-ring" cx="40" cy="40" r="34" pathLength="100"/></svg><b></b></div>`;
    }
    const remaining = Math.max(0, c.remaining);
    challengeEl.querySelector('.qte-clock b')!.textContent = remaining.toFixed(1);
    (challengeEl.querySelector('.qte-ring') as SVGElement).style.strokeDashoffset = String(100 * (1 - Math.min(1, remaining / Math.max(.01, c.duration))));
    challengeEl.classList.toggle('urgent', remaining < .8);
  }

  // ------------------------------------------------ 布局
  function layout(rect: Rect, viewport: { w: number; h: number }) {
    pr = rect; vp = viewport;
    u = rect.w / 900;
    const sideL = rect.x, sideR = viewport.w - rect.x - rect.w;
    const side = Math.min(sideL, sideR);
    const hu = Math.min(u * 1.3, (side - 24) / 300 * 0.95);
    compact = hu < 0.62 * u * 1.3 || side < 150;
    ik.style.setProperty('--u', u.toFixed(4));
    ik.style.setProperty('--hu', (compact ? u * 0.9 : hu).toFixed(4));
    const set = (e: HTMLElement, x: number, y: number, w: number, hh: number) => {
      e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.width = w + 'px'; e.style.height = hh + 'px';
    };
    set(play, rect.x, rect.y, rect.w, rect.h);
    ik.classList.toggle('compact', compact);
    const colWidth = Math.min(282 * hu, side - 56);
    const colInset = (sideL - colWidth) / 2;
    ik.style.setProperty('--column-width', `${Math.max(0, colWidth)}px`);
    ik.style.setProperty('--column-gutter', `${colInset}px`);
    ik.style.setProperty('--speech-x', `${Math.max(2, rect.x - 2)}px`);
    ik.style.setProperty('--speech-y', `${compact ? 92 : viewport.h * .52 + 70}px`);
    if (compact) {
      const x = rect.x + 240 * u, width = rect.w - 368 * u;
      set(dock, x, rect.y + 6, width, 202);
      set(movesDock, x, rect.y + 216, width, 82);
    } else {
      set(dock, colInset, viewport.h * .52, colWidth, 294);
      set(movesDock, rect.x + rect.w + (sideR - colWidth) / 2, viewport.h - 196, colWidth, 180);
    }
    if (compact) {
      set(hostL, rect.x, rect.y, rect.w, rect.h);
      set(hostR, rect.x, rect.y, rect.w, rect.h);
    } else {
      set(hostL, 0, 0, sideL, viewport.h);
      set(hostR, rect.x + rect.w, 0, sideR, viewport.h);
    }
    // 按键图例：放在左侧栏底部；侧栏 < 200px、紧凑模式或与左侧 HUD 重叠时隐藏
    let showKeys = !compact && sideL >= 200;
    if (showKeys) {
      keysEl.style.left = '0px'; keysEl.style.top = 'auto'; keysEl.style.bottom = '0px'; keysEl.style.width = sideL + 'px';
      keysEl.style.display = 'flex';
      const hudB = hostL.querySelector('.hud')!.getBoundingClientRect().bottom;
      const keyT = (keysEl.querySelector('.keys') as HTMLElement).getBoundingClientRect().top;
      if (keyT < hudB + 16) showKeys = false;
    }
    keysEl.style.display = showKeys ? 'flex' : 'none';
    hostL.classList.toggle('c', compact);
    hostR.classList.toggle('c', compact);
    bossEl.classList.toggle('c2', compact);
    document.getElementById('ik-dm')?.setAttribute('scale', String(Math.max(3, 5.5 * u)));
    document.getElementById('ik-dms')?.setAttribute('scale', String(Math.max(2, 4 * u)));
  }

  // ------------------------------------------------ popup 对象池
  const POOL = 48;
  const pool: HTMLElement[] = [];
  let poolI = 0;
  const mergedPopups = new Map<string,HTMLElement>();
  function popup(x: number, y: number, text: string, kind: PopupKind, mergeKey?:string) {
    const current=mergeKey?mergedPopups.get(mergeKey):undefined;
    if(current&&current.style.display!=='none'){current.textContent=text;return;}
    if (!pool.length) for (let i = 0; i < POOL; i++) { pool.push(h('div', 'pop', '', fx)); }
    const i = poolI; poolI = (poolI + 1) % POOL;
    const e = pool[i];
    for(const [key,value] of mergedPopups)if(value===e)mergedPopups.delete(key);
    if(mergeKey)mergedPopups.set(mergeKey,e);
    motion.clear(e);
    e.className = 'pop ' + kind;
    e.textContent = text;
    e.style.display = 'block';
    e.style.left = Math.min(92, Math.max(8, x / 9)) + '%';
    e.style.top = Math.min(96, Math.max(3, y / 12)) + '%';
    motion.popup(e, kind, () => { e.style.display = 'none';if(mergeKey&&mergedPopups.get(mergeKey)===e)mergedPopups.delete(mergeKey); });
  }

  // ------------------------------------------------ 演出
  function refreshPresentation() {
    ik.classList.toggle('presenting', !!dock.querySelector('.card,.warn,.communication,.battle-notice'));
  }
  function clearLayer(layer: HTMLElement) {
    motion.clear(layer); layer.replaceChildren();
  }
  function dismiss(layer: HTMLElement, seconds: number, style: 'panel' | 'sweep' | 'float' = 'panel') {
    const d = layer.firstElementChild!;
    motion.life(d, seconds, style, () => { motion.remove(d); refreshPresentation(); });
    refreshPresentation();
  }
  function stageCard(stage: number, title: string, subtitle: string, duration = 4.2) {
    clearLayer(cardL); clearLayer(warnL);
    let no = `第${CN[stage] ?? stage}幕`;
    const m = title.split(/\s*[·・]\s*/);
    if (m.length === 2) { no = m[0]; title = m[1]; }
    const d = h('div', 'card', `<i class="ink-brush" aria-hidden="true"></i><span class="chapter-seal">${esc(CN[stage] ?? String(stage))}</span><div class="chapter-copy"><div class="c-no">${esc(no)}</div><div class="c-t">${esc(title)}</div><div class="c-s">${esc(subtitle)}</div></div>`, cardL);
    motion.brush(d.querySelector('.ink-brush')!);
    motion.letters(d.querySelector('.c-t')!, title);
    motion.stamp(d.querySelector('.chapter-seal')!);
    dismiss(cardL, Math.max(2, duration));
  }
  function warning(name: string, sub: string) {
    clearLayer(warnL);
    // 章节与 Boss 登场共用边签位，后来的事件优先。
    clearLayer(cardL);
    const d = h('div', 'warn', `<i class="ink-brush" aria-hidden="true"></i><span class="warning-seal">警</span><div class="warning-copy"><div class="w-en">强敌接近</div><div class="w-name">${esc(name)}</div><div class="w-sub">${esc(sub)}</div></div>`, warnL);
    motion.brush(d.querySelector('.ink-brush')!);
    motion.stamp(d.querySelector('.warning-seal')!);
    motion.letters(d.querySelector('.w-name')!, name);
    dismiss(warnL, 2.4, 'sweep');
  }
  function notice(text: string, duration = 2.5) {
    const old = noticeL.querySelector('.battle-notice'); if (old) motion.remove(old);
    const d = h('div', 'battle-notice', esc(text), noticeL);
    motion.life(d, Math.max(1, duration), 'float', () => { motion.remove(d); refreshPresentation(); });
    refreshPresentation();
  }
  const actorIds: Record<string, string> = {
    '小满': 'xiaoman', '赤燕': 'chiyan', '老盾': 'laodun', '墨鸢': 'moyuan', '算盘': 'suanpan', '掌门': 'zhangmen', '铜雀': 'tongque',
  };
  const expressions: Record<string, string> = { '平静': 'calm', '坚定': 'calm', '得意': 'smug', '着急': 'alarmed', '急切': 'alarmed' };
  const silhouette = '<svg viewBox="0 0 96 128" aria-hidden="true"><path d="M22 126c-2-23 9-34 19-39v-9c-10-7-16-19-15-31 0-18 8-30 23-30s23 12 23 30c1 12-5 24-15 31v9c10 5 21 16 19 39Z" fill="currentColor"/><path d="M28 43c-3-20 5-35 22-35 14 0 23 11 22 31l-14-9-10 9-10-7Z" fill="#211c18"/></svg>';
  let capTimer = 0;
  let typeTimer = 0;
  function say(actor: string | DialogueActor, expression: string, text: string, duration = 4) {
    clearTimeout(capTimer); clearInterval(typeTimer);
    const a = typeof actor === 'string' ? { name: actor } : actor;
    const actorId = actorIds[a.name];
    const portrait = a.expressions?.[expression] ?? a.portrait ?? (actorId ? `/art/portraits/${actorId}/${expressions[expression] ?? 'calm'}.png` : undefined);
    const signal = h('i', 'speech-signal', '', ik); motion.life(signal, .9, 'float', () => motion.remove(signal));
    let d = capL.querySelector<HTMLElement>('.communication');
    const sameActor = d?.dataset.actor === a.name;
    if (!sameActor) { clearLayer(capL); d = h('div', 'communication', '', capL); }
    motion.clear(d!);
    d!.dataset.actor = a.name; d!.dataset.expression = expression;
    let face = d!.querySelector<HTMLElement>('.portrait');
    if (!face) face = h('div', 'portrait', silhouette, d!);
    if (portrait) {
      const current = face.querySelector('img');
      if (!current || current.getAttribute('src') !== portrait) {
        const img = document.createElement('img'); img.alt = `${a.name} · ${expression}`;
        const refreshSilhouette = () => {
          const svg = face!.querySelector<SVGElement>('svg');
          if (svg) svg.style.display = [...face!.querySelectorAll('img')].some(i => i.complete && i.naturalWidth > 0) ? 'none' : '';
        };
        img.onload = () => { refreshSilhouette(); motion.enter(img, 'sweep'); };
        img.onerror = () => { img.remove(); refreshSilhouette(); };
        if (current) {
          current.style.position = 'absolute'; current.style.inset = '0';
          motion.exit(current, () => { current.remove(); refreshSilhouette(); });
        } else face.innerHTML = silhouette;
        face.appendChild(img); img.src = portrait;
      }
    } else { face.innerHTML = silhouette; if (!sameActor) motion.enter(face, 'sweep'); }
    let copy = d!.querySelector<HTMLElement>('.communication-copy');
    if (!copy) copy = h('div', 'communication-copy', '', d!);
    copy.innerHTML = `<div class="speaker"><b>${esc(a.name || '通讯')}</b><span>${esc(expression)}</span></div>`;
    if (!sameActor) motion.enter(d!);
    else motion.enter(copy, 'float');
    const tx = h('div', 'dialogue-text', '', copy);
    // 句读连前字、左引号与左括号连后字；换行和分页共用不可拆分的文字组。
    const closing = '、。，．！？：；％%…‥”’」』）》〉】〕］）)]}»';
    const opening = '“‘「『（([{《〈【〔［«';
    const units: string[] = [];
    for (const ch of Array.from(text)) {
      const last = units.at(-1);
      if (last && (closing.includes(ch) || opening.includes(Array.from(last).at(-1)!))) units[units.length - 1] += ch;
      else units.push(ch);
    }
    // 每页最多 24 字；边界上的文字组整体移到下一页，打完后至少留 2 秒阅读。
    const pages: string[][] = [];
    let count = 0;
    for (const unit of units) {
      const size = Array.from(unit).length;
      if (!pages.length || count + size > 24) { pages.push([]); count = 0; }
      pages[pages.length - 1].push(unit); count += size;
    }
    if (!pages.length) pages.push([]);
    const hold = Math.max(2, duration);
    let page = 0;
    const showPage = () => {
      motion.clear(tx); tx.textContent = '';
      const line = pages[page]; let i = 0;
      const reduced = motion.reduced;
      const finish = () => {
        clearInterval(typeTimer);
        capTimer = window.setTimeout(() => {
          if (++page < pages.length) showPage();
          else motion.exit(d!, () => { motion.remove(d!); refreshPresentation(); });
        }, hold * 1000);
      };
      if (reduced || !line.length) { tx.textContent = line.join(''); finish(); }
      else {
        // 先排好整页，逐字显隐；打字过程中也保持标点与相邻字同一行。
        const glyphs = line.flatMap(unit => {
          const group = h('span', 'dialogue-unit', '', tx);
          return Array.from(unit).map(ch => {
            const glyph = h('span', 'motion-glyph', esc(ch), group);
            glyph.style.visibility = 'hidden'; return glyph;
          });
        });
        typeTimer = window.setInterval(() => {
          const glyph = glyphs[i++]; glyph.style.visibility = 'visible'; motion.glyph(glyph);
          if (i === glyphs.length) finish();
        }, MOTION.stagger);
      }
    };
    ik.classList.add('presenting');
    showPage();
  }
  function caption(speaker: string, text: string, duration: number) {
    if (!speaker || ['晓山', '灯河', '云垣'].includes(speaker)) { notice(text, duration); return; }
    const name = speaker === '朱雀' ? '小满' : speaker === '曜雀' ? '赤燕' : speaker;
    say(name, '平静', text, duration);
  }

  // ------------------------------------------------ 菜单与画面
  let cur: ScreenName | 'howto' = 'none';
  let base: ScreenName = 'none'; // settings / howto 的返回目标
  let rows: Row[] = [];
  let idx = 0;
  let horizontal = false;
  let onBack: (() => void) | null = null;
  let onConfirm: (() => void) | null = null;
  let lockUntil = 0;
  let timers: number[] = [];
  let raf = 0;
  let pauseArm = 0;
  let cdMax = 0;
  const holdT: Record<string, number> = {};

  function later(fn: () => void, ms: number) { timers.push(window.setTimeout(fn, ms)); }
  function clearScreen() {
    if (scr.childElementCount && scr.classList.contains('on')) {
      const leaving = scr.cloneNode(true) as HTMLElement;
      leaving.style.pointerEvents = 'none'; leaving.setAttribute('aria-hidden', 'true');
      leaving.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      play.appendChild(leaving);
      motion.exit(leaving, () => motion.remove(leaving));
    }
    timers.forEach(clearTimeout); timers = [];
    cancelAnimationFrame(raf);
    motion.clear(scr);
    scr.textContent = '';
    scr.className = 'scr';
    rows = []; idx = 0; onBack = onConfirm = null; hint = null; horizontal = false;
  }
  function focus(i: number, snd: boolean) {
    if (!rows.length) return;
    if (i === idx && rows[i].el.classList.contains('on')) return;
    rows[idx]?.el.classList.remove('on');
    idx = i;
    rows[i].el.classList.add('on');
    rows[i].el.scrollIntoView({ block: 'nearest' });
    if (snd) ev.onMenuSound('move');
  }
  function setMenu(rs: Row[], horiz = false) {
    rows = rs; horizontal = horiz;
    rs.forEach((r, i) => {
      r.el.addEventListener('pointerenter', () => focus(i, true));
      r.el.addEventListener('click', () => { focus(i, false); activate(); });
    });
    idx = 0; rs[0]?.el.classList.add('on');
  }
  function activate() {
    const r = rows[idx];
    if (r?.activate && !r.disabled) { ev.onMenuSound('ok'); r.activate(); }
  }
  function item(label: string, act?: () => void, sub = ''): Row {
    const el = h('div', 'mi', `<i class="mk"></i><span class="ml">${esc(label)}</span>${sub ? `<span class="ms">${esc(sub)}</span>` : ''}`);
    return { el, activate: act };
  }
  function setHint(kind: 'menu' | 'menuH' | 'confirm' | 'back' | 'skip', extra = '') {
    if (!hint) hint = h('div', 'hint', '', scr);
    hint.dataset.kind = kind + extra;
    renderHint();
  }
  function renderHint() {
    if (!hint) return;
    const g = device === 'gamepad';
    const k = hint.dataset.kind!;
    const move = g ? '<b>↑↓</b> 选择' : '<b>↑↓</b> 选择';
    const ok = g ? '<b>A（南）</b> 确认' : '<b>Z / Enter</b> 确认';
    const bk = g ? '<b>B（东）</b> 返回' : '<b>X / Esc</b> 返回';
    hint.innerHTML = k.startsWith('menu') ? `${move}　${ok}${k === 'menuB' ? '　' + bk : ''}` : k === 'skip' ? ok : ok;
    if (k === 'menuX') hint.innerHTML = `<b>↑↓</b> 选择　<b>←→</b> 调整　${ok}　${bk}`;
    if (k === 'menuS') hint.innerHTML = `<b>↑↓</b> 选择　<b>←→</b> 调整　${bk}`;
    if (k === 'menuT') hint.innerHTML = `<b>↑↓</b> 选择　<b>←→</b> 难度　${ok}`;
    const tk = scr.querySelector('.tkeys');
    if (tk) tk.innerHTML = KEYS.map(([a, kb, gp]) => `<span>${a} <b>${g ? gp : a === '射击' ? 'Z / 空格' : kb.split(' / ')[0]}</b></span>`).join('');
    const pk = scr.querySelector('.pkeys');
    if (pk) pk.innerHTML = keyRows(g);
    if (k === 'menuH') hint.innerHTML = `<b>←→</b> 选择　${ok}`;
  }

  function screen(name: ScreenName, data?: ScreenData) {
    if (data?.settings) settings = { ...data.settings };
    if (data?.difficulty) curDiff = data.difficulty;
    if (name === cur && name !== 'none' && name !== 'growth') { updateScreen(name, data); return; }
    ik.classList.toggle('presentation-hidden', name !== 'none');
    const from = cur;
    if (name === 'settings' && (from === 'title' || from === 'pause')) base = from;
    else if (name === 'settings') base = 'none';
    show(name, data);
    cur = name;
    lockUntil = performance.now() + 220;
  }

  function show(name: ScreenName | 'howto', data?: ScreenData, noAnim = false) {
    clearScreen();
    if (data) screenData = data;
    else if (name === 'title') screenData = {};
    cur = name;
    if (name === 'none') return;
    scr.classList.add('on');
    switch (name) {
      case 'title': buildTitle(noAnim); break;
      case 'test': buildTest(); break;
      case 'pause': buildPause(); break;
      case 'growth': buildGrowth(); break;
      case 'settings': buildSettings(); break;
      case 'howto': buildHowto(); break;
      case 'continue': buildContinue(data); break;
      case 'gameover': buildGameover(data); break;
      case 'results': buildResults(data); break;
      case 'ending': buildEnding(data); break;
      case 'loading': buildLoading(data); break;
    }
    if (!noAnim) {
      scr.querySelectorAll<HTMLElement>('.panel,.big,.ld,.sub1,.hint').forEach(el => motion.enter(el));
      scr.querySelectorAll<HTMLElement>('.ttl .ch').forEach((el, i) => motion.enter(el, 'float', i * 100));
      const titleSeal = scr.querySelector('.tseal'); if (titleSeal) motion.stamp(titleSeal);
      scr.querySelectorAll<HTMLElement>('.tsub,.title-menu').forEach((el, i) => motion.enter(el, 'panel', 220 + i * 80));
    }
  }
  function updateScreen(name: ScreenName, data?: ScreenData) {
    if (name === 'continue' && data?.countdown !== undefined) setCount(data.countdown);
    if (name === 'loading' && data?.progress !== undefined) setProgress(data.progress);
  }

  // --- 标题
  function buildTitle(noAnim: boolean) {
    scr.classList.add('ttl-bg');
    const w = h('div', 'ttlwrap' + (noAnim ? ' tw na' : ' tw'), '', scr);
    w.innerHTML = `<div class="ttl${noAnim ? ' na' : ''}"><span class="ch c1">墨</span><span class="ch c2">空</span></div>
<div class="tseal"><div class="inkseal"><span>朱</span><span>雀</span></div></div>
<div class="tsub"><i></i><span>INKSKY</span><b>· 一笔封天</b><i></i></div>`;
    // 小印章位置：随标题右下
    const menu = h('div', 'menu title-menu', '', w);

    const dEl = h('div', 'mi st', '<i class="mk"></i><span class="ml">难 度</span><span class="tg"></span>');
    const dTg = dEl.querySelector('.tg') as HTMLElement;
    const dPaint = () => { dTg.textContent = DIFFS[curDiff].name; dTg.dataset.d = curDiff; };
    dPaint();
    const dStep = (d: number) => {
      const i = DIFF_ORDER.indexOf(curDiff) + d;
      if (i < 0 || i >= DIFF_ORDER.length) return false;
      curDiff = DIFF_ORDER[i]; dPaint(); ev.onDifficultyChange(curDiff);
      return true;
    };
    const rs: Row[] = [
      item('开 始', () => ev.onStart()),
      item('测 试', () => show('test')),
      { el: dEl, activate: () => { if (!dStep(1)) { curDiff = DIFF_ORDER[0]; dPaint(); ev.onDifficultyChange(curDiff); } }, adjust: (d) => { if (dStep(d)) ev.onMenuSound('move'); } },
      item('设 置', () => { base = 'title'; show('settings'); cur = 'settings'; lockUntil = performance.now() + 150; }),
      item('操作说明', () => { base = 'title'; show('howto'); cur = 'howto'; lockUntil = performance.now() + 150; }),
    ];
    rs.forEach((r) => menu.appendChild(r.el));
    setMenu(rs);
    setHint('menu', 'T');
    const tk = h('div', 'tkeys', '', scr);
    tk.dataset.k = 'tkeys';
    renderHint();
    h('div', 'foot', 'INKSKY · 墨空 · 一笔封天', scr);
  }

  // 测试入口复用现有panel/mi/键盘与手柄导航；选项保留在本次页面内。
  const testOptions=defaultTestOptions();
  function buildTest(passives=false) {
    scr.classList.add('dim');
    const p=h('div','panel test-panel','<div class="ph1">测 试</div><div class="pline"></div>',scr);
    const menu=h('div','menu','',p);
    const rs:Row[]=[];
    const add=(row:Row)=>{rs.push(row);menu.appendChild(row.el);return row;};
    const repaint=(row:Row,text:string)=>{row.el.querySelector('.ms')!.textContent=text;};
    const toggle=(label:string,get:()=>boolean,set:(v:boolean)=>void):Row=>{
      const row=item(label,undefined,get()?'开':'关');
      const flip=()=>{set(!get());repaint(row,get()?'开':'关');};
      row.activate=flip;row.adjust=d=>{set(d>0);repaint(row,get()?'开':'关');};
      return row;
    };
    const returnTest=()=>{show('test');lockUntil=performance.now()+150;};
    if(passives){
      h('div','test-note','测试可直接选择任意技能，包含互斥组合。',p);
      for(const t of TALENTS)add(toggle(t.name,()=>testOptions.passives.includes(t.id),v=>{
        testOptions.passives=testOptions.passives.filter(id=>id!==t.id);if(v)testOptions.passives.push(t.id);
      }));
      add(item('返回测试设置',returnTest));onBack=returnTest;
    }else{
      const checkpoints=()=>TEST_CHECKPOINTS[testOptions.chapter];
      const entry=()=>checkpoints().find(c=>c.id===testOptions.checkpoint)!;
      const chapterNames=['第一章 · 晓山','第二章 · 灯河','第三章 · 云海','第四章 · 现有鲲鹏终战'];
      const chapter=item('章节',undefined,chapterNames[testOptions.chapter-1]);
      const point=item('起点',undefined,entry().label);
      const phase=item('Boss阶段',undefined,'选择Boss后可调');
      const updatePhase=()=>{phase.disabled=!entry().phases;phase.el.classList.toggle('test-disabled',phase.disabled);repaint(phase,entry().phases?`${testOptions.bossPhase} / ${entry().phases}`:'选择Boss后可调');};
      const changeChapter=(d:number)=>{
        testOptions.chapter=(testOptions.chapter-1+d+4)%4+1;
        testOptions.checkpoint=checkpoints()[0].id;testOptions.bossPhase=1;
        repaint(chapter,chapterNames[testOptions.chapter-1]);repaint(point,entry().label);updatePhase();
      };
      chapter.activate=()=>changeChapter(1);chapter.adjust=changeChapter;add(chapter);
      const changePoint=(d:number)=>{
        const list=checkpoints(),i=list.findIndex(c=>c.id===testOptions.checkpoint);
        testOptions.checkpoint=list[(i+d+list.length)%list.length].id;testOptions.bossPhase=1;
        repaint(point,entry().label);updatePhase();
      };
      point.activate=()=>changePoint(1);point.adjust=changePoint;add(point);
      const changePhase=(d:number)=>{if(!entry().phases)return;testOptions.bossPhase=(testOptions.bossPhase-1+d+entry().phases!)%entry().phases!+1;updatePhase();};
      phase.activate=()=>changePhase(1);phase.adjust=changePhase;updatePhase();add(phase);
      add(toggle('无敌',()=>testOptions.god,v=>testOptions.god=v));
      add(toggle('满墨',()=>testOptions.fullInk,v=>testOptions.fullInk=v));
      add(toggle('满泼墨',()=>testOptions.fullBombs,v=>testOptions.fullBombs=v));
      for(const [label,available] of [['执笔笔力',TEST_CAPABILITIES.brushPower],['已解锁笔法',TEST_CAPABILITIES.brushMethods],['泼墨成长',TEST_CAPABILITIES.bombGrowth]] as const){
        const row=item(label,undefined,available?'待接入':'尚未实装');row.disabled=true;row.el.classList.add('test-disabled');add(row);
      }
      const kinds=['chiyan','laodun','moyuan','suanpan'] as const;
      const names=['赤燕','老盾','墨鸢','算盘'];
      const note=h('div','test-note','伙伴最多2名；第一章E编号暂映射旧段，剧情重做后沿用。',p);
      kinds.forEach((kind,i)=>add(toggle(`伙伴 · ${names[i]}`,()=>testOptions.companions.includes(kind),v=>{
        if(v&&!testOptions.companions.includes(kind)&&testOptions.companions.length>=2){note.textContent='伙伴最多2名，请先取消一名。';return;}
        testOptions.companions=testOptions.companions.filter(k=>k!==kind);if(v)testOptions.companions.push(kind);
      })));
      add(item('被动技能',()=>{clearScreen();scr.classList.add('on');buildTest(true);lockUntil=performance.now()+150;},`${testOptions.passives.length} 项已选`));
      const start=item('进入测试',()=>ev.onTestStart?.(structuredClone(testOptions)));start.el.dataset.testAction='start';add(start);
      const back=()=>show('title',undefined,true);add(item('返回标题',back));onBack=back;
    }
    setMenu(rs);setHint('menu','X');
  }

  function backToBase() {
    if (base === 'title' || base === 'pause') { show(base, baseData, true); cur = base; }
    else { show('none'); cur = 'none'; ev.onResume(); }
    lockUntil = performance.now() + 150;
  }

  // --- 暂停
  function buildPause() {
    scr.classList.add('dim');
    const p = h('div', 'panel', '<div class="ph1">暂 停</div><div class="pline"></div>', scr);
    const menu = h('div', 'menu', '', p);
    let quit: Row;
    const rs = [
      item('继 续', () => ev.onResume()),
      item('设 置', () => { base = 'pause'; baseData = screenData; show('settings'); cur = 'settings'; lockUntil = performance.now() + 150; }),
      moveToggle(p),
      item('操作说明', () => { base = 'pause'; baseData = screenData; show('howto'); cur = 'howto'; lockUntil = performance.now() + 150; }),
      (quit = item('回到标题', () => {
        const now = performance.now();
        if (now < pauseArm) { ev.onQuitToTitle(); return; }
        pauseArm = now + 2500;
        quit.el.querySelector('.ml')!.textContent = '再按一次确认';
        later(() => { const m = quit.el.querySelector('.ml'); if (m) m.textContent = '回到标题'; }, 2500);
      })),
    ];
    rs.forEach((r) => menu.appendChild(r.el));
    setMenu(rs);
    h('div', 'pkeys', '', p);
    onBack = () => ev.onResume();
    const f = h('div', 'pfoot', '', p); f.dataset.kind = 'menuB'; hint = f; f.className = 'pfoot'; renderHint();
  }

  // --- 设置
  function buildSettings() {
    scr.classList.add('dim');
    const p = h('div', 'panel', '<div class="ph1">设 置</div><div class="pline"></div>', scr);
    const menu = h('div', 'menu', '', p);
    const emit = () => ev.onSettingsChange({ ...settings });
    const slider = (label: string, key: 'renderScale' | 'masterVol' | 'musicVol' | 'sfxVol', min: number, max: number, step: number, f: (v: number) => string): Row => {
      const el = h('div', 'mi st', `<i class="mk"></i><span class="ml">${label}</span><div class="sl"><div class="sl-f"></div><div class="sl-k"></div></div><span class="sv"></span>`);
      const sl = el.querySelector('.sl') as HTMLElement, fl = el.querySelector('.sl-f') as HTMLElement, kn = el.querySelector('.sl-k') as HTMLElement, sv = el.querySelector('.sv') as HTMLElement;
      const paint = () => { const t = (settings[key] - min) / (max - min); fl.style.width = t * 100 + '%'; kn.style.left = t * 100 + '%'; sv.textContent = f(settings[key]); };
      const setV = (v: number) => {
        v = Math.min(max, Math.max(min, Math.round(v / step) * step));
        v = Math.round(v * 1000) / 1000;
        if (v === settings[key]) return;
        settings[key] = v; paint(); emit();
      };
      paint();
      const fromX = (e: PointerEvent) => { const r = sl.getBoundingClientRect(); setV(min + ((e.clientX - r.left) / r.width) * (max - min)); };
      sl.addEventListener('pointerdown', (e) => { sl.setPointerCapture(e.pointerId); fromX(e); e.stopPropagation(); });
      sl.addEventListener('pointermove', (e) => { if (sl.hasPointerCapture(e.pointerId)) fromX(e); });
      sl.addEventListener('click', (e) => e.stopPropagation());
      return { el, adjust: (d) => { const b = settings[key]; setV(b + d * step); if (settings[key] !== b) ev.onMenuSound('move'); } };
    };
    const tog = (label: string, get: () => boolean, set: (v: boolean) => void, on: string, off: string): Row => {
      const el = h('div', 'mi st', `<i class="mk"></i><span class="ml">${label}</span><span class="tg"></span>`);
      const tg = el.querySelector('.tg') as HTMLElement;
      const paint = () => { tg.textContent = get() ? on : off; tg.classList.toggle('off', !get()); };
      paint();
      const flip = () => { set(!get()); paint(); emit(); };
      return { el, activate: flip, adjust: (d) => { if ((d > 0) !== get()) { flip(); ev.onMenuSound('move'); } } };
    };
    const rs: Row[] = [
      slider('渲染精度', 'renderScale', 0.5, 1.5, 0.05, (v) => `×${v.toFixed(2)}`),
      tog('特效品质', () => settings.quality === 'ultra', (v) => { settings.quality = v ? 'ultra' : 'high'; }, '极致', '高'),
      tog('屏幕震动', () => settings.screenShake, (v) => { settings.screenShake = v; }, '开', '关'),
      slider('主音量', 'masterVol', 0, 1, 0.05, (v) => Math.round(v * 100) + '%'),
      slider('音乐', 'musicVol', 0, 1, 0.05, (v) => Math.round(v * 100) + '%'),
      slider('音效', 'sfxVol', 0, 1, 0.05, (v) => Math.round(v * 100) + '%'),
      tog('显示帧率', () => settings.showFps, (v) => { settings.showFps = v; }, '开', '关'),
      item('返 回', () => backToBase()),
    ];
    rs.forEach((r) => menu.appendChild(r.el));
    setMenu(rs);
    onBack = backToBase;
    const f = h('div', 'pfoot', '', p); f.dataset.kind = 'menuS'; hint = f; renderHint();
  }

  // --- 操作说明
  function buildHowto() {
    scr.classList.add('dim');
    const p = h('div', 'panel wide', '<div class="ph1">操作说明</div><div class="pline"></div>', scr);
    const T = KEYS.map(([a, k, g]) => [a === '一笔' ? '一笔（按住运笔）' : a === '射击' ? '射击（按住）' : a, k, g]);
    p.insertAdjacentHTML('beforeend', `<div class="how"><div class="hh">动作</div><div class="hh">键盘</div><div class="hh">手柄 · Xbox式</div>${T.map(([a, k, g]) => `<div class="a">${esc(a)}</div><div class="k">${esc(k)}</div><div class="g">${esc(g)}</div>`).join('')}</div>
<div class="hnote"><b>一笔</b>：墨就绪时按住运笔，松开斩击；画成闭环并圈住目标才能封印。<b>反制输入通过</b>后仍需完成目标圈封。<br><b>三色弱点</b>：朱·刀口破甲，青·双波导流，雷·方印封阵。墨金方印对应雷武器；对色更快，任意色都能推进。<br><b>伙伴自动协同</b>，有效行动持续成长，无需切换。连招里的「命中」要求主武器实际击中；按键顺序请看出招表。</div>`);
    const menu = h('div', 'menu', '', p);
    const r = item('返 回', () => backToBase());
    menu.appendChild(r.el);
    const moves = moveToggle(p);
    menu.insertBefore(moves.el, r.el);
    const gallery = galleryToggle(p); menu.insertBefore(gallery.el, r.el);
    setMenu([moves, gallery, r]);
    onBack = backToBase;
  }

  function moveToggle(parent: HTMLElement): Row {
    const r = item('出招表 · 全部招式', () => {
      const open = !table.hidden;
      table.hidden = open;
      parent.classList.toggle('book-open', !open);
      if (!open) { const gallery = parent.querySelector<HTMLElement>('.art-gallery'); if (gallery) gallery.hidden = true; parent.classList.remove('gallery-open'); for (const row of parent.querySelectorAll('.mi')) if (row.querySelector('.ml')?.textContent === '三垣图鉴') { row.querySelector('.ms')!.textContent = '展开'; } }
      r.el.setAttribute('aria-expanded', String(!open));
      r.el.querySelector('.ms')!.textContent = open ? '展开' : '收起';
    }, '展开');
    r.el.setAttribute('aria-expanded', 'false');
    const table = h('div', 'move-book', '', parent);
    table.hidden = true;
    const moves = screenData.moves ?? COMBO_MOVES.map(m => ({ name: m.name + (m.talent ? ' · 天赋' : ''), input: m.description.split('：')[0], effect: m.description.split('：')[1] ?? m.description, window: m.window, cost: m.cost }));
    h('div', 'move-legend', '主动：方向 + F / U（手柄 R3），前为屏幕上方；重复方向须松开再按。被动：命中须打中目标，同招间隔 3.5 秒，天赋标记需解锁。', table);
    const grid = h('div', 'move-grid', '', table);
    for (const m of moves) {
      const condition = m.window === undefined || m.cost === undefined ? '' : `${m.window} 秒内 · 额外耗墨 ${Math.round(m.cost * 100)}%`;
      h('div', 'move-entry', `<strong>${esc(m.name)}</strong><span>${esc(m.input.replaceAll('换武', '换色').replaceAll('聚焦', '集中'))}</span>${condition ? `<small class="move-conditions">${esc(condition)}</small>` : ''}<small>${esc(m.effect)}</small>`, grid);
    }
    return r;
  }

  function galleryToggle(parent: HTMLElement): Row {
    const r = item('三垣图鉴', () => { gallery.hidden = !gallery.hidden; parent.classList.toggle('gallery-open', !gallery.hidden); if (!gallery.hidden) { const book = parent.querySelector<HTMLElement>('.move-book'); if (book) book.hidden = true; parent.classList.remove('book-open'); for (const row of parent.querySelectorAll('.mi')) if (row.querySelector('.ml')?.textContent === '出招表 · 全部招式') { row.querySelector('.ms')!.textContent = '展开'; row.setAttribute('aria-expanded', 'false'); } } r.el.querySelector('.ms')!.textContent = gallery.hidden ? '展开' : '收起'; }, '展开');
    const gallery = h('div', 'art-gallery', '<figure><img src="/art/direction/three-enclosures-world.png" alt="晓山、灯河、云垣的未来武侠三垣场景"><figcaption>晓山返笔 · 灯河还名 · 云垣断律</figcaption></figure><figure><img src="/art/direction/boss-transformations.png" alt="铜雀、蜃与鲲鹏的部件解构和变形分镜"><figcaption>破甲、开壳、鲲化鹏 · 看轮廓预告再寻弱点</figcaption></figure>', parent);
    gallery.hidden = true;
    return r;
  }

  function buildGrowth() {
    scr.classList.add('dim', 'rest-screen');
    const d = screenData;
    const shop = (d.choices ?? []).some(c => c.cost !== undefined || c.id === 'skip');
    const p = h('div', 'panel rest-panel', `<div class="rest-topline">${shop ? '行囊补给 / SUPPLY' : '章间休整 / GROWTH'}<span>墨骨 · 铜金</span></div><div class="ph1">${esc(d.choiceTitle ?? '章间休整')}</div><div class="rest-sub">${esc(d.choiceHint ?? '选择一项，继续前行')}</div><div class="pline"></div>`, scr);
    const cards = h('div', 'choice-grid', '', p);
    const rs: Row[] = [];
    for (const [i, c] of (d.choices ?? []).entries()) {
      const el = h('div', `choice-card${c.disabled ? ' unavailable' : ''}${c.id === 'skip' ? ' skip-card' : ''}`, `<div class="choice-head"><span class="choice-no">${c.id === 'skip' ? '行' : CN[i + 1] ?? i + 1}</span><span class="choice-route">${esc(c.detail ?? (shop ? '章间补给' : '天赋成长'))}</span>${c.cost === undefined ? '' : `<span class="choice-cost">${c.cost} 券</span>`}</div><strong>${esc(c.name)}</strong>${c.preview?passivePreview(c.preview,c.icon??'技'):''}<p>${esc(c.description)}</p><div class="choice-state">${c.disabled ? `补给不足 · 需 ${c.cost ?? 0} 券` : c.id === 'skip' ? '保留补给券，进入下一段' : shop ? `采购此项 · ${c.cost ?? 0} 券` : '选择后按条件自动生效'}</div>`, cards);
      el.setAttribute('role', 'button');
      el.setAttribute('aria-disabled', String(!!c.disabled));
      rs.push({ el, disabled: c.disabled, activate: () => ev.onChoice?.(c.id) });
    }
    const menu = h('div', 'menu rest-menu', '', p);
    const moves = moveToggle(p); menu.appendChild(moves.el); rs.push(moves);
    setMenu(rs);
    onBack = shop ? () => ev.onChoice?.('skip') : null;
    const f = h('div', 'pfoot', '', p); f.dataset.kind = shop ? 'menuB' : 'menu'; hint = f; renderHint();
  }

  // --- 续关
  const RING = 2 * Math.PI * 118;
  function setCount(c: number) {
    const cn = scr.querySelector('.cn'), cnt = scr.querySelector('.cnt'), rg = scr.querySelector('.rg') as SVGElement | null;
    if (!cn || !cnt || !rg) return;
    cdMax = Math.max(cdMax, c);
    const count = String(Math.max(0, Math.ceil(c)));
    if (cn.textContent !== count) { cn.textContent = count; motion.clear(cn); motion.pulse(cn); }
    cnt.classList.toggle('low', c <= 3);
    rg.style.strokeDashoffset = String(RING * (1 - Math.min(1, Math.max(0, c / (cdMax || 1)))));
  }
  function buildContinue(d?: ScreenData) {
    scr.classList.add('dim');
    cdMax = 0;
    const w = h('div', '', '', scr);
    w.style.cssText = 'display:flex;flex-direction:column;align-items:center';
    w.innerHTML = `<div class="big">续 战？</div><div class="sub1">墨未尽，笔仍在</div>
<div class="cnt"><svg viewBox="0 0 260 260"><circle class="rb" cx="130" cy="130" r="118"/><circle class="rg" cx="130" cy="130" r="118" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg><div class="cn">9</div></div>`;
    const menu = h('div', 'menu h', '', w);
    const rs = [item('续 关', () => ev.onContinue(true)), item('放 弃', () => ev.onContinue(false))];
    rs.forEach((r) => menu.appendChild(r.el));
    setMenu(rs, true);
    onBack = () => ev.onContinue(false);
    setCount(d?.countdown ?? 9);
    setHint('menuH');
  }

  // --- 游戏结束
  function buildGameover(d?: ScreenData) {
    scr.classList.add('dim');
    const fs = d?.finalScore ?? 0, hi = d?.hiScore ?? 0;
    const w = h('div', 'gov', '', scr);
    w.style.cssText = 'display:flex;flex-direction:column;align-items:center';
    w.innerHTML = `<div class="big red">墨 尽</div><div class="sub1">GAME OVER</div>
<div class="scoreb"><div class="lbl">最终得分</div><div class="digits" id="ik-fs"></div><div class="hi">最高纪录　<b>${fmt(hi)}</b></div></div>`;
    new Digits(w.querySelector('#ik-fs') as HTMLElement, 8).set(fs);
    if (fs > 0 && fs >= hi) {
      const s = h('div', 'inkseal rec', '<span>新</span><span>纪</span><span>录</span>', w);
      motion.stamp(s);
    }
    const menu = h('div', 'menu', '', w);
    const r = item('返回标题', () => ev.onQuitToTitle());
    menu.appendChild(r.el);
    setMenu([r]);
    onBack = () => ev.onQuitToTitle();
    setHint('confirm');
  }

  // --- 结算
  function buildResults(d?: ScreenData) {
    scr.classList.add('dim');
    const r: StageResult = d?.results ?? { stage: 1, stageName: '', score: 0, kills: 0, graze: 0, sealed: 0, maxChain: 0, noMiss: false, bonus: 0 };
    const p = h('div', 'panel res', '', scr);
    p.innerHTML = `<div class="rh"><span class="t">第${CN[r.stage] ?? r.stage}幕</span><span class="n">${esc(r.stageName)}</span><span class="t">完</span></div><div class="pline"></div>`;
    type L = [string, number | null, string?];
    const lines: L[] = [['击破', r.kills], ['擦弹', r.graze], ['封印', r.sealed], ['最大连锁', r.maxChain], ['无失误', null], ['关卡得分', r.score], ['结算加分', r.bonus, '+']];
    const els: { row: HTMLElement; v: HTMLElement; val: number | null; pre: string }[] = [];
    for (const [l, val, pre = ''] of lines) {
      const row = h('div', 'rr', `<span class="rl">${l}</span><span class="rv"></span>`, p);
      els.push({ row, v: row.querySelector('.rv') as HTMLElement, val, pre });
    }
    const tot = h('div', 'rr tot', '<span class="rl">总　计</span><span class="rv"></span>', p);
    els.push({ row: tot, v: tot.querySelector('.rv') as HTMLElement, val: r.score + r.bonus, pre: '' });
    const next = h('div', 'rnext', '继　续', p);
    next.addEventListener('click', () => { if (done) ev.onResultsDone(); });
    let done = false;
    const t0 = performance.now();
    const STEP = 480, COUNT = 650;
    const finish = () => {
      done = true;
      els.forEach((e) => { e.row.classList.add('on'); e.v.textContent = e.val === null ? '' : e.pre + fmt(e.val); paintNoMiss(e); });
      next.classList.add('on'); motion.enter(next);
      setHint('confirm');
      hint!.style.display = 'none';
    };
    const paintNoMiss = (e: (typeof els)[number]) => {
      if (e.val === null) e.v.innerHTML = r.noMiss ? '<span class="stampx">无失误</span>' : '<span class="none">—</span>';
    };
    const tick = (now: number) => {
      const t = now - t0;
      let all = true;
      els.forEach((e, i) => {
        const st = 350 + i * STEP + (i === els.length - 1 ? 300 : 0);
        if (t < st) { all = false; return; }
        if (!e.row.classList.contains('on')) { e.row.classList.add('on'); motion.enter(e.row); }
        if (e.val === null) { paintNoMiss(e); return; }
        const k = Math.min(1, (t - st) / COUNT);
        if (k < 1) all = false;
        const v = e.val * CURVES.cubic(k);
        e.v.textContent = e.pre + fmt(v);
      });
      if (all && t > 350 + els.length * STEP) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    onConfirm = () => { if (done) ev.onResultsDone(); else { cancelAnimationFrame(raf); finish(); } };
    onBack = onConfirm;
  }

  // --- 尾声
  function buildEnding(d?: ScreenData) {
    scr.classList.add('dim');
    const box = h('div', 'end', '', scr);
    const L = (c: string, t: string) => `<div class="ln ${c}">${t}</div>`;
    const fs = d?.finalScore;
    box.innerHTML = `<div class="roll">
${L('s', '终　章')}${L('', '最后一笔落下，<br>裂纹在天幕上逐一愈合。')}
${L('', '三垣共同供墨，<br>浮城向晨光缓缓落下。')}
${L('', '师父的名字回到原契，<br>灯河把姓名归还给每个人。')}
${L('', '朱雀撤回旧律，三曜仍在身旁。<br>山河的下一笔，<br>由众人共同写下。')}
${L('s', '监　制')}${L('', '墨空 INKSKY')}
${L('s', '水墨与霓虹')}${L('', '原画　·　程序美术　·　音乐　·　音效')}
${L('r', '一笔封天')}${L('b', '完')}${fs !== undefined ? L('s', '最终得分') + L('', fmt(fs)) : ''}</div>
<div class="go">${device === 'gamepad' ? 'A' : 'Z / Enter'}　返回标题</div>`;
    const roll = box.querySelector<HTMLElement>('.roll')!;
    motion.credits(roll, pr.h * .5 - roll.offsetHeight + 70 * u);
    motion.enter(box.querySelector('.go')!, 'panel', 600);
    onConfirm = onBack = () => ev.onQuitToTitle();
    box.addEventListener('click', () => ev.onQuitToTitle());
    box.querySelector('.go')!.addEventListener('click', () => ev.onQuitToTitle());
  }

  // --- 载入
  function buildLoading(d?: ScreenData) {
    scr.classList.add('load');
    scr.innerHTML = `<div class="ld">研 墨</div><div class="lbar"><b></b></div><div class="lpct">0%</div>`;
    setProgress(d?.progress ?? 0);
  }
  function setProgress(p: number) {
    const b = scr.querySelector('.lbar b') as HTMLElement | null, t = scr.querySelector('.lpct');
    if (!b || !t) return;
    p = Math.min(1, Math.max(0, p));
    b.style.transform = `scaleX(${p})`;
    t.textContent = Math.round(p * 100) + '%';
  }

  // ------------------------------------------------ 菜单输入
  function rep(inp: InputState, a: 'up' | 'down' | 'left' | 'right', now: number): boolean {
    if (!inp.down(a)) { delete holdT[a]; return false; }
    if (inp.pressed(a)) { holdT[a] = now + 380; return true; }
    if (holdT[a] === undefined) { holdT[a] = now + 380; return false; }
    if (now >= holdT[a]) { holdT[a] = now + 90; return true; }
    return false;
  }
  function menuInput(inp: InputState) {
    if (inp.device !== device) { device = inp.device; renderHint(); renderKeys(); renderChallenge(); }
    if (cur === 'none' || cur === 'loading') return;
    const now = performance.now();
    const conf = inp.pressed('confirm'), back = inp.pressed('back');
    const up = rep(inp, 'up', now), dn = rep(inp, 'down', now), lf = rep(inp, 'left', now), rt = rep(inp, 'right', now);
    if (now < lockUntil) return;
    const n = rows.length;
    if (n) {
      const prevK = horizontal ? lf : cur === 'growth' ? up || lf : up, nextK = horizontal ? rt : cur === 'growth' ? dn || rt : dn;
      if (prevK) focus((idx + n - 1) % n, true);
      else if (nextK) focus((idx + 1) % n, true);
      else if (!horizontal && (lf || rt) && rows[idx].adjust) rows[idx].adjust!(lf ? -1 : 1);
    }
    if (conf) { if (onConfirm) { ev.onMenuSound('ok'); onConfirm(); } else activate(); }
    else if (back && onBack) { ev.onMenuSound('back'); onBack(); }
  }

  // ------------------------------------------------ mount
  function mount(root: HTMLElement, events: UIEvents) {
    ev = events;
    const st = document.createElement('style');
    st.textContent = CSS;
    root.appendChild(st);
    ik = h('div', 'ik', DEFS, root);
    play = h('div', 'play', '', ik);
    fx = h('div', 'fx', '', play);
    bossEl = h('div', 'boss', '', play);
    challengeEl = h('div', 'qte', '', play);
    dock = h('div', 'presentation-dock', '', ik);
    cardL = h('div', 'cardl', '', dock);
    warnL = h('div', 'warnl', '', dock);
    capL = h('div', 'capl', '', dock);
    noticeL = h('div', 'noticel', '', dock);
    comboEl = h('div', 'combo-banner', '', noticeL);
    scr = h('div', 'scr', '', play);
    buildHud();
    hostL.classList.add('off'); hostR.classList.add('off');
    hudVis = false;
    layout(pr, vp);
  }

  return {
    mount, layout, hud, screen, menuInput, popup, caption,
    stageCard, warning, say, notice,
  };
}
