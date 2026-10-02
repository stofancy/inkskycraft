import { createDialogue } from './dialogue';
import { battleLetter } from './battle-lettering';
// 墨空 UI：纯 DOM + CSS。入口 createUI()。时序要求见 tools/ui-preview.ts 顶部与最终报告。
import { DIFFS, DIFF_ORDER, type Difficulty } from '../core/difficulty';
import { DEFAULT_SETTINGS } from '../types';
import type {
  DialogueActor, GameUI, HudState, InputState, PopupKind, Rect, ScreenData, ScreenName, Settings, StageResult, UIEvents, WeaponColor,
} from '../types';
import { Motion, CURVES, MOTION } from './motion';
import { CSS } from './css';
import { applyMenuLettering, loadMenuLettering } from './lettering';
import { INK_COLORS,INK_NAMES,INK_GRADES,inkPreview,INK_SCORE_CSS } from './ink-score';
import { passivePreview } from './passive-preview';
import { TALENTS } from '../game/progression';
import { TEST_CHECKPOINTS } from '../stages/checkpoints';
import { SKILL_IDS, SKILL_RULES,filterSkills } from '../game/skills';
import { BRUSH_FORMS, filterBrushForms } from '../game/brush-shape';
import { defaultTestOptions } from '../game/test-options';

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const passiveIcon=(_id:string,url:string)=>`<img src="${esc(url.replace('.png','-32.png'))}" alt="天赋图标">`;
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
const ICON_BOMB = '<img src="/art/icons/skills/ink-bomb.png" width="24" height="24" alt="泼墨">';
const ICON_COIN = '<img src="/art/icons/items/gold-seal.png" width="34" height="34" alt="金印">';

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
  ['射击', '鼠标左键', 'A（南）'],
  ['泼墨', 'F', 'B（东）'],
  ['执笔', '右键 / 左右键 / 空格', 'X（西） / RT'],
  ['翻滚', 'Shift', '—'],
  ['换色', '鼠标中键', 'Y（北）'],
  ['暂停', 'Esc', 'Start'],
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
  let overclockEl:HTMLElement;
  let dock: HTMLElement, noticeL: HTMLElement;
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
  let missionEl:HTMLElement;
  let shipLabel:HTMLElement;
  let recordScroll:HTMLElement|null=null;
  let story:ReturnType<typeof createDialogue>;
  let communicationHistory:{id:string;speaker:string;identity?:string;text:string;memory:boolean}[]=[];
  let openingHint:HTMLElement;
  let openingTimer=0;
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
 <div class="fps" data-k="fps"></div><div class="combat-status"><div data-k="protection"></div><div data-k="armor"></div></div></div>`;
    hostR.innerHTML = `<div class="hud">
 <div class="stage"><div class="sn" data-k="stageNo"></div><div class="sm" data-k="stageName"></div><div class="dn" data-k="diff"></div></div>
 <div class="blk"><div class="lbl">剩余战机<i>LIFE</i></div><div class="icons" data-k="lives"></div></div>
 <div class="blk"><div class="lbl">泼墨<i>INK BOMB</i></div><div class="icons" data-k="bombs"></div></div>
 <div class="inkrow"><div class="ink" data-k="ink">${INK_SVG}</div>
  <div class="wp"><div class="wseal w-red" data-k="wseal">朱</div><div class="lat" data-k="lat">${'<i></i>'.repeat(4)}</div>
   <div class="mis"><span>矢</span><b data-k="missiles">0 / 4</b></div></div></div>
 <div class="blk ship-durability" data-k="ship"></div>
 <div class="growth-mini" data-k="growth"></div>
 <div class="partners" data-k="partners"></div><div class="skillbar" data-k="skills"><div class="skill-row" data-row="1"></div><div class="skill-row" data-row="2"></div></div></div>`;
    for (const e of ik.querySelectorAll<HTMLElement>('[data-k]')) R[e.dataset.k!] = e;
    R.fill = ik.querySelector('#ik-fill') as HTMLElement;
    keysEl = h('div', 'keyhost off', '<div class="keys"><div class="kh">操作</div><div class="kl"></div></div>', ik);
    R.keyl = keysEl.querySelector('.kl') as HTMLElement;
    renderKeys();
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
    if (prev[k] === n && prev[k+'svg'] === svg) return;
    prev[k] = n;prev[k+'svg']=svg;
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

    }
    if (!visible) { motion.clear(R.armor); R.armor.textContent = ''; motion.clear(challengeEl); motion.clear(comboEl); motion.clear(bossEl); prev.challengeOn = false; prev.comboOn = false; ik.classList.remove('challenging'); challengeEl.classList.remove('on'); comboEl.classList.remove('on'); bossEl.classList.remove('on'); ik.classList.remove('bs'); prev.boss = false; return; }

    setText('diff', s.difficulty);
    R.ship.hidden=!s.ship;setText('ship',s.ship?`云梭耐久 ${s.ship.durability}`:'');
    shipLabel.hidden=!s.ship?.label;
    if(s.ship){shipLabel.style.left=`${s.ship.x/9}%`;shipLabel.style.top=`${(s.ship.y+145)/12}%`;}
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
    iconRow('lives', s.lives, '<img src="/art/player/zhuque/life.png" width="24" height="24" alt="朱雀">');
    iconRow('bombs', s.bombs, ICON_BOMB);
    R.bombs.style.setProperty('--bomb-color',{red:'#f06b43',blue:'#6ce2eb',purple:'#c79bef'}[s.weapon]);R.bombs.querySelectorAll('svg').forEach(svg=>svg.style.color=R.bombs.style.getPropertyValue('--bomb-color'));
    let inkDots=R.bombs.parentElement!.querySelector<HTMLElement>('.ink-score-dots');if(!inkDots)inkDots=h('div','ink-score-dots','',R.bombs.parentElement!);const dots=INK_COLORS.map(c=>`<span class="${c}">${INK_NAMES[c]} ${'●'.repeat(s.inkScore?.[c]??0)}${'○'.repeat(3-(s.inkScore?.[c]??0))}</span>`).join('');if(inkDots.innerHTML!==dots)inkDots.innerHTML=dots;
    const bombLabel=R.bombs?.previousElementSibling;
    if(bombLabel)bombLabel.textContent='泼墨';
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
      const w: Record<WeaponColor, string> = { red: '朱', blue: '青', purple: '紫' };
      R.wseal.textContent = w[s.weapon];
      R.wseal.setAttribute('aria-label',w[s.weapon]);
      if(s.weapon==='purple'){
        const glyph=new Image();glyph.src='/art/lettering/weapon-purple-paper-v2.png';glyph.alt='紫';glyph.className='weapon-glyph';
        glyph.onerror=()=>{R.wseal.textContent='紫';};R.wseal.replaceChildren(glyph);
      }
      R.wseal.className = `wseal w-${s.weapon}`;
      R.lat.className = `lat w-${s.weapon}`;
      if (!first) motion.stamp(R.wseal);
    }
    if (prev.power !== s.power) {
      prev.power = s.power;
      const dots = R.lat.children;
      for (let i = 0; i < 4; i++) dots[i].classList.toggle('on', i < s.power);
    }
    setText('missiles', `${s.missile ?? 0} / 4`);
    setText('fps', settings.showFps && s.fps > 0 ? `${Math.round(s.fps)} FPS` : '');
    const growth = s.growth;
    setText('growth', growth ? `笔力 ${growth.brush} · 天赋 ${growth.talents}\n已学笔法：${['斩', '封', ...filterBrushForms(s.brushMethods)].join('、')}` : '');
    renderSkills(s);
    setText('protection', s.brushActive ? '运笔中 · 世界减速' : '');
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
      bossEl.querySelector('.bomb-limit')?.remove();
      if (!prev.boss) { prev.boss = true; bossEl.classList.add('on'); ik.classList.add('bs'); motion.clear(bossEl); motion.enter(bossEl); }
      if(prev.bname!==b.name){setText('bname', b.name);delete R.bname.dataset.lettering;battleLetter(R.bname,b.name);}
      if (prev.btarget !== (b.hint ?? '')) { setText('btarget', b.hint ?? ''); if (b.hint) motion.enter(R.btarget, 'float'); }
      R.bph.innerHTML='';const bar=R.bhp.parentElement!;let ticks=bar.querySelector<HTMLElement>('.phase-ticks');if(b.name==='铜雀'){if(!ticks){ticks=h('span','phase-ticks','',bar);ticks.innerHTML='<i></i><i></i>';}}else ticks?.remove();
      setText('btm', b.timer === undefined ? '' : String(Math.max(0, Math.ceil(b.timer))));
      const hp = `scaleX(${Math.min(1, Math.max(0, b.hp)).toFixed(3)})`;
      if(prev.bhp!==hp){const old=Number(String(prev.bhp??'scaleX(1)').slice(7,-1)),next=Math.min(1,Math.max(0,b.hp));prev.bhp=hp;R.bhp.style.transform=hp;if(next<old)R.bhp.parentElement?.animate([{filter:'brightness(2.2)'},{filter:'brightness(1)'}],{duration:100});}
      R.btr.style.transform=`scaleX(${b.trail??b.hp})`;
    } else if (prev.boss) {
      prev.boss = false; motion.clear(bossEl); motion.play(bossEl,[{opacity:1},{opacity:0}],{duration:300},false,()=>bossEl.classList.remove('on')); ik.classList.remove('bs');
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
    const key = c.action === 'focus' ? (g ? 'LT' : '手柄 LT') : c.action === 'bomb' ? (g ? 'B（东）' : 'F') : (g ? 'X（西） / RT' : '右键 / 空格');
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

  function renderSkills(s:HudState){
    const hot=s.overclock;overclockEl.hidden=!hot||!hudVis;
    if(hot){overclockEl.style.left=`${hot.x/900*100}%`;overclockEl.style.top=`${hot.y/1200*100}%`;overclockEl.querySelector('b')!.textContent=`超频 ${hot.left.toFixed(1)}秒`; (overclockEl.querySelector('i') as HTMLElement).style.transform=`scaleX(${hot.left/5})`;}

    const slots=(s.skillSlots??[]).filter(slot=>slot.visible);
    const key=slots.map(slot=>slot.id).join('|');
    if(prev.skillIds!==key){
      prev.skillIds=key;
      for(const row of R.skills.querySelectorAll('.skill-row'))row.replaceChildren();
      for(const slot of slots){
        const row=R.skills.querySelector(slot.key==='Shift'||/^[1-5]$/.test(slot.key??'')?'[data-row="1"]':'[data-row="2"]')!;
        const el=h('div','skill-slot',`<span class="skill-key">${esc(slot.key??'')}</span><div class="skill-icon">${slot.icon?`<img src="${esc(slot.icon)}" alt="">`:""}<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" pathLength="100"/></svg><b class="skill-seconds"></b></div><span class="skill-name">${esc(slot.name)}</span><small class="skill-value"></small><i class="skill-fill"></i>`,row);
        el.dataset.skill=slot.id;
        if(slot.id==='zhongpao')el.querySelector('.skill-icon')!.appendChild(el.querySelector('.skill-value')!);
      }
    }
    for(const slot of slots){
      const el=R.skills.querySelector<HTMLElement>(`[data-skill="${slot.id}"]`)!;
      if(slot.ready&&!el.classList.contains('ready')){el.classList.remove('ready-pulse');void el.offsetWidth;el.classList.add('ready-pulse');}el.classList.toggle('ready',slot.ready);el.classList.toggle('active',(slot.active??0)>0);el.classList.toggle('unlocking',!!slot.unlocking);
      el.querySelector('circle')!.style.strokeDashoffset=String(100*(1-Math.min(1,slot.cooldown/Math.max(.001,slot.cooldownMax))));
      el.querySelector('.skill-seconds')!.textContent=slot.cooldown>0?String(Math.ceil(slot.cooldown)):'';
      el.querySelector('.skill-value')!.textContent=slot.value??((slot.active??0)>0?`${Math.ceil(slot.active!)}秒`:'');
      (el.querySelector('.skill-fill') as HTMLElement).style.transform=`scaleX(${slot.fill??0})`;
      el.title=`${slot.key} ${slot.name}${slot.cooldown>0?` · 冷却 ${Math.ceil(slot.cooldown)}秒`:slot.ready?' · 就绪':''}`;
    }
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
    } else {
      set(dock, colInset, viewport.h * .52, colWidth, 294);
    }
    if (compact) {
      set(hostL, rect.x, rect.y, rect.w, rect.h);
      set(hostR, rect.x, rect.y, rect.w, rect.h);
    } else {
      set(hostL, 0, 0, sideL, viewport.h);
      set(hostR, rect.x + rect.w, 0, sideR, viewport.h);
    }
    const skillParent=compact?hostR:hostR.querySelector('.hud')!;
    if(R.skills.parentElement!==skillParent)skillParent.appendChild(R.skills);
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
    story?.resize();
    document.getElementById('ik-dm')?.setAttribute('scale', String(Math.max(3, 5.5 * u)));
    document.getElementById('ik-dms')?.setAttribute('scale', String(Math.max(2, 4 * u)));
  }

  // ------------------------------------------------ popup 对象池
  const POOL = 48;
  const pool: HTMLElement[] = [];
  let poolI = 0;
  const mergedPopups = new Map<string,HTMLElement>();
  function popup(x: number, y: number, text: string, kind: PopupKind, mergeKey?:string) {
    if (text === '外甲松动') {
      motion.clear(R.armor); R.armor.textContent = text;
      motion.life(R.armor, 1.5, 'float', () => { R.armor.textContent = ''; });
      return;
    }
    const current=mergeKey?mergedPopups.get(mergeKey):undefined;
    if(current&&current.style.display!=='none'){current.textContent=text;if(kind.startsWith('damage-'))current.className='pop '+kind;return;}
    if (!pool.length) for (let i = 0; i < POOL; i++) { pool.push(h('div', 'pop', '', fx)); }
    const i = poolI; poolI = (poolI + 1) % POOL;
    const e = pool[i];
    for(const [key,value] of mergedPopups)if(value===e)mergedPopups.delete(key);
    if(mergeKey)mergedPopups.set(mergeKey,e);
    motion.clear(e);
    e.className = 'pop ' + kind;e.style.opacity='';e.style.fontSize='';
    delete e.dataset.lettering;e.removeAttribute('aria-label');e.classList.remove('battle-lettered','brush-letter-unlock');e.textContent = text;
    const unlock=/^学会(.+)$/.exec(text);
    let hasLetter=false;
    if(unlock){e.classList.add('brush-letter-unlock');hasLetter=battleLetter(e,unlock[1],2.15);}else if(mergeKey==='ink:cast')hasLetter=battleLetter(e,text,1.15);
    e.style.display = 'block';
    e.style.left = Math.min(92, Math.max(8, x / 9)) + '%';
    e.style.top = Math.min(96, Math.max(3, y / 12)) + '%';
    if(unlock){e.style.left='50%';e.style.top='50%';e.style.setProperty('font-size',180*pr.w/675+'px','important');const descriptions:Record<string,string>={'横':'横 · 墨堤：画一横，立墙挡弹','竖':'竖 · 贯：画一竖，贯穿敌阵'};const note=h('span','brush-letter-description',descriptions[unlock[1]]??`${unlock[1]}：学会了新笔法`,e);note.style.fontSize=20*pr.w/675+'px';}
    if(mergeKey==='ink:cast'){e.style.opacity='.9';e.style.fontSize=56*pr.w/675+'px';const image=e.querySelector('img')!,half=image.naturalWidth/image.naturalHeight*56*pr.w/675/2||100;const px=Math.max(half+20,Math.min(pr.w-half-20,x/900*pr.w));e.style.left=px/pr.w*100+'%';e.style.top=Math.max(56,Math.min(pr.h-56,y/1200*pr.h-105/1200*pr.h))/pr.h*100+'%';}
    const hide=()=>{e.style.display='none';if(mergeKey&&mergedPopups.get(mergeKey)===e)mergedPopups.delete(mergeKey);};
    if(hasLetter){e.style.transform='translate(-50%,-50%)';motion.hold(e,unlock?2.15:1.15,hide);}else if(mergeKey?.startsWith('passive:')){e.style.transform='translate(-50%,-50%)';e.style.opacity='1';motion.hold(e,1.5,hide);}else motion.popup(e,kind,hide);
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
    motion.hold(d,seconds,()=>{motion.remove(d);refreshPresentation();});
    refreshPresentation();
  }
  function clearHero(){for(const e of fx.querySelectorAll('.hero-letter'))motion.remove(e);}
  function heroLetter(text:string,seal:string|null,height:number,sealHeight:number,seconds:number,done:()=>void,top='50%',flash=false){
    const scale=pr.w/675,d=h('div','hero-letter','',fx);d.style.top=top;d.style.gap=24*scale+'px';
    if(seal){const mark=h('span','hero-seal',seal,d);mark.style.fontSize=sealHeight*scale+'px';mark.style.width=sealHeight*scale+'px';mark.style.height=sealHeight*scale+'px';battleLetter(mark,seal,undefined,'cinnabar');}
    const word=h('span','',esc(text),d);word.style.fontSize=height*scale+'px';battleLetter(word,text,undefined,text==='强敌接近'?'cinnabar':'paper');
    if(flash)d.animate([{opacity:1,offset:0},{opacity:.12,offset:.2},{opacity:1,offset:.3},{opacity:.12,offset:.55},{opacity:1,offset:.65},{opacity:1,offset:1}],{duration:seconds*1000});
    motion.hold(d,seconds,done);return d;
  }
  function heroFinish(hero:HTMLElement,target:HTMLElement,done:()=>void){
    const wide=vp.w>vp.h,a=hero.getBoundingClientRect(),b=target.getBoundingClientRect(),dx=b.x+b.width/2-a.x-a.width/2,dy=b.y+b.height/2-a.y-a.height/2;
    hero.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:wide?`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.22)`:'translate(-50%,-50%)',opacity:0}],{duration:450,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'});
    motion.hold(hero,.45,()=>{motion.remove(hero);done();});
  }
  function stageCard(stage: number, title: string, subtitle: string, duration = 4.2) {
    clearHero();clearLayer(cardL); clearLayer(warnL);
    let no = `第${CN[stage] ?? stage}幕`;
    const m = title.split(/\s*[·・]\s*/);
    if (m.length === 2) { no = m[0]; title = m[1]; }
    const d = h('div', 'card', `<i class="ink-brush" aria-hidden="true"></i><span class="chapter-seal">${esc(CN[stage] ?? String(stage))}</span><div class="chapter-copy"><div class="c-no">${esc(no)}</div><div class="c-t">${esc(title)}</div><div class="c-s">${esc(subtitle)}</div></div>`, cardL);
    motion.brush(d.querySelector('.ink-brush')!);
    if(!battleLetter(d.querySelector('.c-t')!,title))motion.letters(d.querySelector('.c-t')!, title);
    battleLetter(d.querySelector('.chapter-seal')!,CN[stage]??String(stage),undefined,'cinnabar');

    d.style.visibility='hidden';
    const hero=heroLetter(title,CN[stage]??String(stage),110,140,2.45,()=>heroFinish(hero,d,()=>{if(vp.w>vp.h){d.style.visibility='visible';dismiss(cardL,Math.max(2,duration));}else{motion.remove(d);refreshPresentation();}}));

  }
  let warningHero:HTMLElement|null=null;
  function warningEnd(){if(warningHero)motion.remove(warningHero);warningHero=null;clearLayer(warnL);refreshPresentation();}
  function warning(name: string, sub: string) {
    clearHero();clearLayer(warnL);
    // 章节与 Boss 登场共用边签位，后来的事件优先。
    clearLayer(cardL);
    const d = h('div', 'warn', `<i class="ink-brush" aria-hidden="true"></i><span class="warning-seal">警</span><div class="warning-copy"><div class="w-en">强敌接近</div><div class="w-name">${esc(name)}</div><div class="w-sub">${esc(sub)}</div></div>`, warnL);
    motion.brush(d.querySelector('.ink-brush')!);

    if(!battleLetter(d.querySelector('.w-name')!,name))motion.letters(d.querySelector('.w-name')!, name);
    battleLetter(d.querySelector('.w-en')!,'强敌接近',2.4,'cinnabar');
    battleLetter(d.querySelector('.warning-seal')!,'警',2.4,'cinnabar');
    d.style.visibility='hidden';
    warningHero=heroLetter('强敌接近','警',120,140,3,warningEnd,'50%',true);warningHero.classList.add('hero-warning-paper');
    const warningName=h('span','warning-boss-name',esc(name),warningHero);
    warningName.style.fontSize=32*pr.w/675+'px';battleLetter(warningName,name,undefined,'ink');

  }
  function notice(text: string, duration = 2.5) {
    const old = noticeL.querySelector('.battle-notice'); if (old) motion.remove(old);
    const d = h('div', 'battle-notice', esc(text), noticeL);
    motion.life(d, Math.max(1, duration), 'float', () => { motion.remove(d); refreshPresentation(); });
    refreshPresentation();
  }
  const actorIds: Record<string, string> = {
    '小满': 'xiaoman', '赤燕': 'chiyan', '老盾': 'laodun', '墨鸢': 'moyuan', '算盘': 'suanpan', '总镖头': 'zhangmen', '铜雀': 'tongque',
    '纸龙':'zhilong','屿长':'gongtou','蜃':'mirage','雷公':'leigong',
  };
  const expressions: Record<string, string> = { '平静': 'calm', '坚定': 'calm', '得意': 'smug', '着急': 'alarmed', '急切': 'alarmed' };
  const silhouette = '<svg viewBox="0 0 96 128" aria-hidden="true"><path d="M22 126c-2-23 9-34 19-39v-9c-10-7-16-19-15-31 0-18 8-30 23-30s23 12 23 30c1 12-5 24-15 31v9c10 5 21 16 19 39Z" fill="currentColor"/><path d="M28 43c-3-20 5-35 22-35 14 0 23 11 22 31l-14-9-10 9-10-7Z" fill="#211c18"/></svg>';
  let capTimer = 0;
  let typeTimer = 0;
  function say(actor: string | DialogueActor, expression: string, text: string, duration = 4) {
    clearTimeout(capTimer); clearInterval(typeTimer);
    const a = typeof actor === 'string' ? { name: actor } : actor;
    communicationHistory.push({id:'',speaker:a.name,identity:a.identity,text,memory:false});
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
        const img = document.createElement('img'); img.alt = a.name;
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
    copy.innerHTML = `<div class="speaker"><b>${esc(a.name || '通讯')}</b>${a.identity?`<span>${esc(a.identity)}</span>`:''}</div>`;
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

  function resetCommunications(){story.reset();communicationHistory=[];missionEl.hidden=true;clearTimeout(capTimer);clearInterval(typeTimer);clearLayer(capL);clearLayer(noticeL);clearHero();}
  function chapterSay(actor:DialogueActor,expression:string,text:string,id:string,memory:boolean,options?:{pause:boolean;onDone:()=>void;onSkip:()=>void}){
    clearTimeout(capTimer);clearInterval(typeTimer);clearLayer(capL);
    if(!text){refreshPresentation();return;}
    communicationHistory.push({id,speaker:actor.name,identity:actor.identity,text,memory});
    if(options?.pause){story.show(actor,expression,text,id,memory,options.onDone,options.onSkip);refreshPresentation();return;}
    const portrait=actor.expressions?.[expression]??actor.portrait;
    const d=h('div',`communication${memory?' memory':''}`,'',capL);d.dataset.id=id;d.dataset.actor=actor.name;
    const face=h('div','portrait','',d);if(portrait){const img=document.createElement('img');img.src=portrait;img.alt=actor.name;img.onerror=()=>{img.src=actor.portrait??'';img.onerror=null;};face.appendChild(img);}
    h('div','communication-copy',`<div class="speaker"><b>${esc(actor.name)}</b>${actor.identity?`<span>${esc(actor.identity)}</span>`:''}${memory?'<span>回忆</span>':''}</div><div class="dialogue-text">${esc(text)}</div>` ,d);
    ik.classList.add('presenting');
  }
  function missionBrief(id:number){
    const titles=['护送云梭','闯过查封','截下雷石','冲过铜雀关'];
    const targets=['青石屿的三架云梭','纸龙（风筝帮的查封机）','空中堡垒','铜雀（守关机）'];
    const purposes=['护送云梭队前往高天','它扣下了浮石林里所有经过的飞船','风筝帮运走的雷石能让青石屿多浮些日子','让三架云梭通过铜雀关'];
    missionEl.hidden=false;missionEl.dataset.mission=String(id);missionEl.innerHTML=`<div class="brief-title"><small>任务${CN[id]}</small><b>${titles[id-1]}</b></div><div>目标：${targets[id-1]}</div><p>${purposes[id-1]}</p>`;
    missionEl.style.animation='none';void missionEl.offsetWidth;missionEl.style.animation='mission-air 3.65s both';
    missionEl.onanimationend=()=>{missionEl.hidden=true;};
    window.setTimeout(()=>{if(missionEl.dataset.mission===String(id))missionEl.hidden=true;},3700);
  }
  function buildCommunications(){
    scr.classList.add('dim');const p=h('div','panel communications','<div class="ph1">通讯记录</div><div class="pline"></div>',scr);
    recordScroll=h('div','communication-history','',p);
    for(const line of communicationHistory)h('div','record-line',`<b>${esc(line.speaker)}</b>${line.identity?` <small>${esc(line.identity)}</small>`:''}${line.memory?' <small>回忆</small>':''}<p>${esc(line.text)}</p>`,recordScroll);
    if(!communicationHistory.length)h('p','','本章暂无通讯记录',recordScroll);
    const close=()=>{show('pause');lockUntil=performance.now()+150;};const button=h('div','pfoot','点击关闭 · Esc 返回',p);button.addEventListener('click',close);onBack=close;onConfirm=close;setMenu([]);
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
    const ok = g ? '<b>A（南）</b> 确认' : '<b>Enter</b> 确认';
    const bk = g ? '<b>B（东）</b> 返回' : '<b>Esc</b> 返回';
    hint.innerHTML = k.startsWith('menu') ? `${move}　${ok}${k === 'menuB' ? '　' + bk : ''}` : k === 'skip' ? ok : ok;
    if (k === 'menuX') hint.innerHTML = `<b>↑↓</b> 选择　<b>←→</b> 调整　${ok}　${bk}`;
    if (k === 'menuS') hint.innerHTML = `<b>↑↓</b> 选择　<b>←→</b> 调整　${bk}`;
    if (k === 'menuT') hint.innerHTML = `<b>↑↓</b> 选择　<b>←→</b> 难度　${ok}`;
    const tk = scr.querySelector('.tkeys');
    if (tk) tk.innerHTML = KEYS.map(([a, kb, gp]) => `<span>${a} <b>${g ? gp : kb.split(' / ')[0]}</b></span>`).join('');
    const pk = scr.querySelector('.pkeys');
    if (pk) pk.innerHTML = keyRows(g);
    if (k === 'menuH') hint.innerHTML = `<b>←→</b> 选择　${ok}`;
  }

  function controlsHint(text:string,duration:number):void {
    window.clearTimeout(openingTimer);openingHint.textContent=text;openingHint.hidden=false;
    openingTimer=window.setTimeout(()=>openingHint.hidden=true,duration*1000);
  }

  function screen(name: ScreenName, data?: ScreenData) {
    if(name!=='none')clearHero();
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
      case 'communications': buildCommunications(); break;
      case 'growth': buildGrowth(); break;
      case 'settings': buildSettings(); break;
      case 'howto': buildHowto(); break;
      case 'continue': buildContinue(data); break;
      case 'gameover': buildGameover(data); break;
      case 'results': buildResults(data); break;
      case 'ending': buildEnding(data); break;
      case 'loading': buildLoading(data); break;
    }
    applyMenuLettering(scr);
    if (!noAnim) {
      scr.querySelectorAll<HTMLElement>('.panel,.big,.ld,.sub1,.hint').forEach(el => motion.enter(el));
      scr.querySelectorAll<HTMLElement>('.ttl .ch,.ttl.lettered').forEach((el, i) => motion.enter(el, 'float', i * 100));
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
      item('墨 谱',()=>buildInkScore()),
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
  function buildTest(passives=false, growth: 'methods'|'skills'|null=null) {
    scr.classList.add('dim');
    testOptions.brushMethods=filterBrushForms(testOptions.brushMethods);
    testOptions.skills=filterSkills(testOptions.skills);
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
    const sub=(kind:'methods'|'skills')=>{clearScreen();scr.classList.add('on');buildTest(false,kind);lockUntil=performance.now()+150;};
    if(growth){
      if(growth==='methods')for(const method of BRUSH_FORMS)add(toggle(`笔法 · ${method}`,()=>testOptions.brushMethods.includes(method),v=>{testOptions.brushMethods=testOptions.brushMethods.filter(m=>m!==method);if(v)testOptions.brushMethods.push(method);}));
      if(growth==='skills')for(const id of SKILL_IDS)add(toggle(`${SKILL_RULES[id].key} · ${SKILL_RULES[id].name}`,()=>testOptions.skills.includes(id),v=>{testOptions.skills=testOptions.skills.filter(s=>s!==id);if(v)testOptions.skills.push(id);}));
      add(item('返回测试设置',returnTest));onBack=returnTest;
    }else if(passives){
      h('div','test-note','测试可选任意技能；笔力以测试设置为准。',p);
      for(const t of TALENTS)add(toggle(t.name,()=>testOptions.passives.includes(t.id),v=>{
        testOptions.passives=testOptions.passives.filter(id=>id!==t.id);if(v)testOptions.passives.push(t.id);
      }));
      add(item('返回测试设置',returnTest));onBack=returnTest;
    }else{
      const checkpoints=()=>TEST_CHECKPOINTS[testOptions.chapter];
      const entry=()=>checkpoints().find(c=>c.id===testOptions.checkpoint)!;
      const chapterNames=['第一章 · 出镖','第二章 · 蜃海','第三章 · 雷场','第四章 · 现有鲲鹏终战'];
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
      add(toggle('全技能 · 无限资源 · 冷却¼',()=>!!testOptions.allSkills,v=>testOptions.allSkills=v));
      add(toggle('满墨',()=>testOptions.fullInk,v=>testOptions.fullInk=v));
      add(toggle('满泼墨',()=>testOptions.fullBombs,v=>testOptions.fullBombs=v));
      const bombColor=item('泼墨颜色',undefined,INK_NAMES[testOptions.bombColor]);const changeColor=(d:number)=>{testOptions.bombColor=INK_COLORS[(INK_COLORS.indexOf(testOptions.bombColor)+d+3)%3];repaint(bombColor,INK_NAMES[testOptions.bombColor]);};bombColor.activate=()=>changeColor(1);bombColor.adjust=changeColor;add(bombColor);
      for(const color of INK_COLORS){const grade=item(`墨谱 · ${INK_NAMES[color]}`,undefined,`${testOptions.inkScore[color]} 级`);const change=(d:number)=>{testOptions.inkScore[color]=(testOptions.inkScore[color]+d+4)%4;repaint(grade,`${testOptions.inkScore[color]} 级`);};grade.activate=()=>change(1);grade.adjust=change;add(grade);}
      const power=item('执笔笔力',undefined,`${testOptions.brushPower} 级`);
      const changePower=(d:number)=>{testOptions.brushPower=((testOptions.brushPower-1+d+3)%3+1) as 1|2|3;repaint(power,`${testOptions.brushPower} 级`);};
      power.activate=()=>changePower(1);power.adjust=changePower;add(power);
      add(item('已解锁笔法',()=>sub('methods'),`${testOptions.brushMethods.length} 项已选`));
      add(item('已解锁技能',()=>sub('skills'),`${testOptions.skills.length} 项已选`));
      const kinds=['chiyan','laodun','moyuan','suanpan'] as const;
      const names=['赤燕','老盾','墨鸢','算盘'];
      const note=h('div','test-note','伙伴最多2名；第一章可直入剧情事件与首领阶段。',p);
      kinds.forEach((kind,i)=>add(toggle(`伙伴 · ${names[i]}`,()=>testOptions.companions.includes(kind),v=>{
        if(v&&!testOptions.companions.includes(kind)&&testOptions.companions.length>=2){note.textContent='伙伴最多2名，请先取消一名。';return;}
        testOptions.companions=testOptions.companions.filter(k=>k!==kind);if(v)testOptions.companions.push(kind);
      })));
      add(item('被动技能',()=>{clearScreen();scr.classList.add('on');buildTest(true);lockUntil=performance.now()+150;},`${testOptions.passives.length} 项已选`));
      const start=item('进入测试',()=>ev.onTestStart?.(structuredClone(testOptions)));start.el.dataset.testAction='start';add(start);
      const back=()=>show('title',undefined,true);add(item('返回标题',back));onBack=back;
    }
    setMenu(rs);setHint('menu','X');applyMenuLettering(scr);
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
      item('通讯记录',()=>{show('communications');lockUntil=performance.now()+150;}),
      item('墨 谱',()=>buildInkScore()),
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

  function buildInkScore(){const levels=screenData.inkScore??{red:0,blue:0,purple:0};clearScreen();scr.classList.add('on','dim');const p=h('div','panel ink-score-page','<div class="ph1">墨 谱</div><div class="pline"></div>',scr);const columns=h('div','ink-score-columns','',p);for(const color of INK_COLORS){const column=h('div','',`<h3>${INK_NAMES[color]} · ${levels[color]}/3</h3>`,columns);INK_GRADES[color].forEach(([name,effect],i)=>h('p',i<levels[color]?'learned':'unlearned',`${i<levels[color]?'● 已获得':'○ 未获得'} · ${name}<br>${effect}；字灵多留半秒`,column));}const back=item('返回暂停',()=>show('pause',screenData,true));p.appendChild(back.el);setMenu([back]);onBack=()=>show('pause',screenData,true);}

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
      slider('渲染精度', 'renderScale', 1, 1.5, 0.05, (v) => `×${v.toFixed(2)}`),
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
<div class="hnote"><b>一笔</b>：墨就绪时按住运笔，松开斩击；画成闭环并圈住目标才能封印。<b>反制输入通过</b>后仍需完成目标圈封。<br><b>三色弱点</b>：朱·刀口破甲，青·双波导流，紫·方印封阵。墨金方印对应紫色武器；对色更快，任意色都能推进。<br><b>伙伴自动协同</b>，有效行动持续成长，无需切换。鼠标右键画线，松手按起笔位置与笔形生效。Shift 翻滚穿弹回墨。</div>`);
    const menu = h('div', 'menu', '', p);
    const r = item('返 回', () => backToBase());
    menu.appendChild(r.el);
    const gallery = galleryToggle(p); menu.insertBefore(gallery.el, r.el);
    setMenu([gallery, r]);
    onBack = backToBase;
  }

  function galleryToggle(parent: HTMLElement): Row {
    const r = item('美术图鉴', () => { gallery.hidden = !gallery.hidden; parent.classList.toggle('gallery-open', !gallery.hidden); r.el.querySelector('.ms')!.textContent = gallery.hidden ? '展开' : '收起'; }, '展开');
    const gallery = h('div', 'art-gallery', '<figure><img src="/art/direction/three-enclosures-world.png" alt="浮石林、蜃海与雷场"><figcaption>出镖 · 蜃海 · 雷场</figcaption></figure><figure><img src="/art/direction/boss-transformations.png" alt="铜雀、蜃与鲲鹏的部件解构和变形分镜"><figcaption>破甲、开壳、鲲化鹏 · 看轮廓预告再寻弱点</figcaption></figure>', parent);
    gallery.hidden = true;
    return r;
  }

  function buildGrowth() {
    scr.classList.add('dim', 'rest-screen');
    const d = screenData;
    const p = h('div', 'panel rest-panel', `<div class="rest-topline">${d.choiceTitle==='墨谱'?'墨谱 / INK SCORE':'天赋 / TALENT'}<span>墨骨 · 铜金</span></div><div class="ph1">${esc(d.choiceTitle ?? '章间休整')}</div><div class="rest-sub">${esc(d.choiceHint ?? '选择一项，继续前行')}</div><div class="pline"></div>`, scr);
    const cards = h('div', 'choice-grid', '', p);
    const rs: Row[] = [];
    for (const [i, c] of (d.choices ?? []).entries()) {
      const el = h('div', `choice-card${c.disabled ? ' unavailable' : ''}`, `<div class="choice-head"><span class="choice-no">${CN[i + 1] ?? i + 1}</span><span class="choice-route">${esc(c.detail ?? '天赋成长')}</span></div><strong>${esc(c.name)}</strong>${c.preview?.startsWith('inkScore-')?inkPreview(c.id as WeaponColor):c.preview?passivePreview(c.preview,c.icon??'技'):''}<p>${esc(c.description)}</p><div class="choice-state">${c.disabled ? (d.choiceTitle==='墨谱'?'此色墨谱已满级':'暂不可选') : d.choiceTitle==='墨谱'?'这一色泼墨升一级':'选择后按条件自动生效'}</div>`, cards);
      el.setAttribute('role', 'button');
      el.setAttribute('aria-disabled', String(!!c.disabled));
      rs.push({ el, disabled: c.disabled, activate: () => ev.onChoice?.(c.id) });
    }
    const menu = h('div', 'menu rest-menu', '', p);
    setMenu(rs);
    onBack = null;
    const f = h('div', 'pfoot', '', p); f.dataset.kind = 'menu'; hint = f; renderHint();
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
    battleLetter(w.querySelector('.big')!,'续战？');(w.querySelector('.big') as HTMLElement).style.fontSize=160*pr.w/675+'px';
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
    battleLetter(w.querySelector('.big')!,'墨尽',undefined,'cinnabar');(w.querySelector('.big') as HTMLElement).style.fontSize=160*pr.w/675+'px';
    new Digits(w.querySelector('#ik-fs') as HTMLElement, 8).set(fs);
    if (fs > 0 && fs >= hi) {
      const s = h('div', 'inkseal rec', '<span>新</span><span>纪</span><span>录</span>', w);
      battleLetter(s,'新纪录',undefined,'cinnabar');
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
    battleLetter(p.querySelector('.rh .n')!,r.stageName);battleLetter(p.querySelector('.rh .t:last-child')!,'完');const finishTitle=heroLetter('完',null,160,0,1.15,()=>motion.remove(finishTitle));
    type L = [string, number | null, string?];
    const lines: L[] = [['击破', r.kills], ['擦弹', r.graze], ['封印', r.sealed], ['最大连锁', r.maxChain], ['无失误', null], ['关卡得分', r.score], ...(r.shipBonus!==undefined&&r.stage===1?([['云梭耐久',r.shipBonus,'+'],['其余加分',r.bonus-r.shipBonus,'+']] as L[]):([['结算加分',r.bonus,'+']] as L[]))];
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
${L('s', '终　章')}
${L('s', '监　制')}${L('', '墨空 INKSKY')}
${L('s', '水墨与霓虹')}${L('', '原画　·　程序美术　·　音乐　·　音效')}
${L('r', '一笔封天')}${L('b', '完')}${fs !== undefined ? L('s', '最终得分') + L('', fmt(fs)) : ''}</div>
<div class="go">${device === 'gamepad' ? 'A' : 'Enter'}　返回标题</div>`;
    battleLetter(box.querySelector('.ln.b')!,'完');(box.querySelector('.ln.b') as HTMLElement).style.fontSize=160*pr.w/675+'px';
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
    if(cur==='communications'){if(up||dn)recordScroll?.scrollBy({top:up?-90:90});if(back||conf)onBack?.();return;}
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
    st.textContent = CSS+INK_SCORE_CSS;
    root.appendChild(st);
    ik = h('div', 'ik', DEFS, root);
    play = h('div', 'play', '', ik);
    fx = h('div', 'fx', '', play);
    overclockEl=h('div','overclock-clock','<b></b><i></i>',play);
    bossEl = h('div', 'boss', '', play);
    challengeEl = h('div', 'qte', '', play);
    dock = h('div', 'presentation-dock', '', ik);
    cardL = h('div', 'cardl', '', dock);
    warnL = h('div', 'warnl', '', dock);
    capL = h('div', 'capl', '', dock);
    noticeL = h('div', 'noticel', '', dock);
    comboEl = h('div', 'combo-banner', '', noticeL);
    missionEl=h('div','mission-brief','',play);missionEl.hidden=true;
    shipLabel=h('div','ship-label','云梭',play);shipLabel.hidden=true;
    openingHint=h('div','opening-controls','',play);openingHint.hidden=true;
    story=createDialogue(play,()=>ev.onDialogueSound?.());
    scr = h('div', 'scr', '', play);
    buildHud();
    loadMenuLettering().then(() => applyMenuLettering(scr)).catch(error => console.warn(error.message));
    hostL.classList.add('off'); hostR.classList.add('off');
    hudVis = false;
    layout(pr, vp);
  }

  return {
    dialogueState:()=>story.state(),dialogueTick:(dt,input)=>story.tick(dt,input),dialogueAdvance:()=>story.advance(),dialogueSkip:()=>story.skip(),
    recordCommunication:(actor,expression,text,id,memory)=>{communicationHistory.push({id,speaker:actor.name,identity:actor.identity,text,memory});},
    resetCommunications,chapterSay,missionBrief,mount, layout, hud, screen, menuInput, popup, caption, controlsHint,
    stageCardActive:()=>cardL.childElementCount>0,stageCard, warning, warningEnd, say, notice,
  };
}
