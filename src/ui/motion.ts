/** 界面动效真源：曲线、幅度、错峰、生命周期与并发动效预算。 */
export const CURVES = {
  cubic: (t: number) => 1 - Math.pow(1 - t, 3),
  exponential: (t: number) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  rebound: (t: number) => { const x = t - 1; return 1 + 1.15 * x * x * x + .15 * x * x; },
  spring: (t: number) => t >= 1 ? 1 : 1 - Math.exp(-7 * t) * (Math.cos(10 * t) + .7 * Math.sin(10 * t)),
};
export const EASING = {
  cubic: 'cubic-bezier(.22,.61,.36,1)', exponential: 'cubic-bezier(.16,1,.3,1)',
  rebound: 'cubic-bezier(.2,.9,.3,1.12)',
};
export const MOTION = { entry: 360, exit: 240, stagger: 36, glyph: 150, maxActive: 16, maxPopups: 8 };
type Entry = { el: Element; animation: Animation; ambient: boolean };
export type CueStyle = 'panel' | 'sweep' | 'float' | 'popup';

export class Motion {
  private active = new Set<Entry>();
  private fallback = new Map<Element, number>();
  private media = matchMedia('(prefers-reduced-motion: reduce)');
  get reduced() { return this.media.matches; }
  get activeCount() { return this.active.size; }

  /** 超预算时普通动效静止呈现；重要提示挤出一个普通动效。 */
  play(el: Element, frames: Keyframe[], options: KeyframeAnimationOptions, ambient = false, done?: () => void): Animation | null {
    if (this.active.size >= MOTION.maxActive) {
      const expendable = [...this.active].find(e => e.ambient);
      if (!ambient && expendable) { this.active.delete(expendable); expendable.animation.finish(); }
      else { done?.(); return null; }
    }
    const a = el.animate(frames, { ...options, fill: 'both' });
    const entry = { el, animation: a, ambient };
    this.active.add(entry);
    const release = () => this.active.delete(entry);
    a.oncancel = release;
    a.onfinish = () => { release(); done?.(); a.cancel(); };
    return a;
  }
  clear(root: Element) {
    for (const [el, timer] of this.fallback) if (el === root || root.contains(el)) { clearTimeout(timer); this.fallback.delete(el); }
    for (const e of [...this.active]) if (e.el === root || root.contains(e.el)) e.animation.cancel();
  }
  remove(el: Element) { this.clear(el); el.remove(); }
  enter(el: Element, style: CueStyle = 'panel', delay = 0) {
    const from = style === 'sweep' ? 'translateX(-16px) scaleX(.96)' : style === 'float' ? 'translateY(10px)' : 'translateY(8px) scale(.98)';
    return this.play(el, this.reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
      { duration: this.reduced ? 120 : MOTION.entry, delay: this.reduced ? 0 : delay, easing: EASING.exponential });
  }
  exit(el: Element, done: () => void) {
    return this.play(el, this.reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px) scale(.98)' }],
      { duration: this.reduced ? 120 : MOTION.exit, easing: EASING.cubic }, false, done);
  }
  /** 单个动画覆盖入场、静止阅读与退场；总时长使用调用方给定的秒数。 */
  life(el: Element, seconds: number, style: CueStyle, done: () => void) {
    const duration = Math.max(700, seconds * 1000);
    const entry = this.reduced ? 120 : MOTION.entry;
    const exit = this.reduced ? 120 : MOTION.exit;
    const from = style === 'sweep' ? 'translateX(-16px) scaleX(.96)' : style === 'float' ? 'translateY(10px)' : 'translateY(6px) scale(.98)';
    const normal: Keyframe[] = [
      { opacity: 0, transform: from, offset: 0, easing: EASING.exponential },
      { opacity: 1, transform: 'none', offset: entry / duration },
      { opacity: 1, transform: 'none', offset: 1 - exit / duration, easing: EASING.cubic },
      { opacity: 0, transform: 'translateY(-6px) scale(.98)', offset: 1 },
    ];
    const frames = this.reduced ? normal.map(({ transform: _transform, ...frame }) => frame) : normal;
    // 生命周期占满预算时仍须保留阅读时长。静止等待后通过同一出口移除。
    const a = this.play(el, frames, { duration }, false);
    if (a) { const finish = a.onfinish; a.onfinish = ev => { finish?.call(a, ev); done(); }; }
    else {
      const timer = window.setTimeout(() => { this.fallback.delete(el); done(); }, duration);
      this.fallback.set(el, timer);
    }
    return a;
  }
  /** 字图自身承担入退场，容器只保留原有阅读时间。 */
  hold(el:Element,seconds:number,done:()=>void){const timer=window.setTimeout(()=>{this.fallback.delete(el);done();},seconds*1000);this.fallback.set(el,timer);}
  brush(el: Element) {
    if (this.reduced) return;
    // 仅墨迹本身使用遮罩，其余提示优先走合成层 transform / opacity。
    this.play(el, [{ clipPath: 'inset(0 100% 0 0)', opacity: .5 }, { clipPath: 'inset(0)', opacity: 1 }], { duration: 500, easing: EASING.cubic });
  }
  stamp(el: Element) {
    if (this.reduced) return;
    const frames = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, p = CURVES.spring(t);
      return { offset: t, opacity: Math.min(1, t * 6), transform: `translateX(${(Math.sin(t * Math.PI * 6) * Math.exp(-8 * t)).toFixed(3)}px) rotate(${(-3 * (1 - p)).toFixed(3)}deg) scale(${Math.max(.96, Math.min(1.04, 1.04 - .04 * p)).toFixed(4)})` };
    });
    this.play(el, frames, { duration: 460, delay: 80 });
  }
  letters(el: HTMLElement, text: string, stagger = MOTION.stagger) {
    el.replaceChildren();
    if (this.reduced) { el.textContent = text; return; }
    Array.from(text).forEach((ch, i) => {
      const span = document.createElement('span'); span.className = 'motion-glyph'; span.textContent = ch; el.appendChild(span);
      this.glyph(span, i * stagger);
    });
  }
  glyph(el: Element, delay = 0) {
    if (this.reduced) return;
    return this.play(el, [{ opacity: 0, transform: 'translateY(-6px) rotate(-2deg)' }, { opacity: 1, transform: 'none' }],
      { duration: MOTION.glyph, delay, easing: EASING.cubic }, true);
  }
  pulse(el: Element) {
    if (this.reduced) return;
    this.play(el, [{ transform: 'scale(.98)', opacity: .85 }, { transform: 'scale(1.04)', opacity: 1, offset: .35 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: EASING.rebound }, true);
  }
  popup(el: Element, kind: string, done: () => void) {
    const damage=kind.startsWith('damage-');
    if (!damage&&[...this.active].filter(e => e.el.classList.contains('pop')).length >= MOTION.maxPopups) { done(); return; }
    const duration = kind === 'graze' ? 650 : kind === 'score' ? 1000 : 1500;
    const entry = this.reduced ? 100 : 200;
    const frames: Keyframe[] = this.reduced ? [
      { opacity: 0, offset: 0, easing: EASING.cubic }, { opacity: 1, offset: entry / duration },
      { opacity: 1, offset: .75, easing: EASING.cubic }, { opacity: 0, offset: 1 },
    ] : [
      { opacity: 0, transform: 'translate(-50%,-50%) translateY(8px) scale(.96)', offset: 0, easing: EASING.rebound },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.02)', offset: entry / duration, easing: EASING.cubic },
      { opacity: 1, transform: 'translate(-50%,-50%) translateY(-6px)', offset: .7, easing: EASING.cubic },
      { opacity: 0, transform: 'translate(-50%,-50%) translateY(-18px) scale(.98)', offset: 1 },
    ];
    this.play(el, frames, { duration }, !damage, done);
  }
  /** 长篇结尾滚动保持阅读速度；启停由三次曲线缓动。 */
  credits(el: Element, distance: number) {
    if (this.reduced) return;
    this.play(el, [{ transform: 'translateY(100cqh)', easing: EASING.cubic }, { transform: 'translateY(0)', offset: .35 }, { transform: `translateY(${distance}px)`, offset: 1 }], { duration: 52000 });
  }
}
