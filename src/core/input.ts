import type { Action, InputState } from '../types';

const KEYMAP: Record<string, Action[]> = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  KeyZ: ['shoot', 'confirm'], KeyJ: ['shoot', 'confirm'], Space: ['shoot', 'confirm'], Enter: ['confirm'],
  KeyX: ['bomb', 'back'], KeyK: ['bomb'],
  KeyC: ['brush'], KeyL: ['brush'],
  KeyV: ['weapon'], Tab: ['weapon'],
  KeyF: ['move'], KeyU: ['move'],
  ShiftLeft: ['focus'], ShiftRight: ['focus'],
  Escape: ['pause', 'back'], KeyP: ['pause'], Backspace: ['back'],
};

const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'shoot', 'bomb', 'brush', 'focus', 'weapon', 'move', 'pause', 'confirm', 'back'];

/** 键盘 + 手柄统一输入。每个逻辑帧开头调用 poll()。 */
export class Input implements InputState {
  private keys = new Set<string>();
  private cur = new Set<Action>();
  private prev = new Set<Action>();
  /** 两次 poll 之间按下又松开的键也要记一次 pressed。 */
  private tapped = new Set<Action>();
  resetSerial = 0;
  axisX = 0;
  axisY = 0;
  device: 'keyboard' | 'gamepad' = 'keyboard';
  /** 任意按键的首次回调（用于解锁音频）。 */
  onFirstGesture: (() => void) | null = null;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (KEYMAP[e.code]) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      for (const a of KEYMAP[e.code] ?? []) this.tapped.add(a);
      this.device = 'keyboard';
      this.gesture();
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => { this.keys.clear(); this.tapped.clear(); this.resetSerial++; });
    target.addEventListener('pointerdown', () => this.gesture());
  }

  private gesture(): void {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture;
      this.onFirstGesture = null;
      f();
    }
  }

  poll(): void {
    const tmp = this.prev;
    this.prev = this.cur;
    this.cur = tmp;
    this.cur.clear();
    for (const k of this.keys) for (const a of KEYMAP[k] ?? []) this.cur.add(a);
    let ax = (this.cur.has('right') ? 1 : 0) - (this.cur.has('left') ? 1 : 0);
    let ay = (this.cur.has('down') ? 1 : 0) - (this.cur.has('up') ? 1 : 0);

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const b = (i: number) => !!gp.buttons[i]?.pressed || (gp.buttons[i]?.value ?? 0) > 0.4;
      const map: [number, Action[]][] = [
        [0, ['shoot', 'confirm']], [1, ['bomb', 'back']], [2, ['brush']], [3, ['weapon']],
        [7, ['brush']], [6, ['focus']], [4, ['focus']], [5, ['brush']],
        [9, ['pause']], [8, ['back']], [11, ['move']],
        [12, ['up']], [13, ['down']], [14, ['left']], [15, ['right']],
      ];
      let any = false;
      for (const [i, acts] of map) if (b(i)) { any = true; for (const a of acts) this.cur.add(a); }
      const sx = gp.axes[0] ?? 0, sy = gp.axes[1] ?? 0;
      const mag = Math.hypot(sx, sy);
      if (mag > 0.22) {
        any = true;
        const k = Math.min(1, (mag - 0.22) / 0.7) / mag;
        ax = sx * k;
        ay = sy * k;
        if (sx < -0.5) this.cur.add('left');
        if (sx > 0.5) this.cur.add('right');
        if (sy < -0.5) this.cur.add('up');
        if (sy > 0.5) this.cur.add('down');
      } else {
        if (b(14)) ax = -1;
        if (b(15)) ax = 1;
        if (b(12)) ay = -1;
        if (b(13)) ay = 1;
      }
      if (any) { this.device = 'gamepad'; this.gesture(); }
    }
    const m = Math.hypot(ax, ay);
    if (m > 1) { ax /= m; ay /= m; }
    this.axisX = ax;
    this.axisY = ay;
    this.pressedNow.clear();
    for (const a of ACTIONS) if ((this.cur.has(a) && !this.prev.has(a)) || this.tapped.has(a)) this.pressedNow.add(a);
    for (const a of this.tapped) this.cur.add(a); // 极短按键也至少持续一帧
    this.tapped.clear();
  }

  private pressedNow = new Set<Action>();

  down(a: Action): boolean {
    return this.cur.has(a);
  }
  pressed(a: Action): boolean {
    return this.pressedNow.has(a);
  }
  /** 消费掉某个 pressed，避免同一帧被多处响应。 */
  consume(a: Action): void {
    this.pressedNow.delete(a);
  }
}
