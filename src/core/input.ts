import type { Action, InputState } from '../types';

const KEYMAP: Record<string, Action[]> = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  Digit1: ['skill1'], Digit2: ['skill2'], Digit3: ['skill3'], Digit4: ['skill4'], Digit5: ['skill5'],
  KeyQ: ['companionQ'], KeyE: ['companionE'], KeyR: ['companionR'],
  Space: ['brush'], KeyF: ['bomb'], Enter: ['confirm'],
  ShiftLeft: ['roll'], ShiftRight: ['roll'],
  Escape: ['pause', 'back'], Backspace: ['back'],
};

const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'shoot', 'bomb', 'brush', 'focus', 'weapon', 'move', 'skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'companionQ', 'companionE', 'companionR', 'roll', 'pause', 'confirm', 'back'];

/** 键盘 + 手柄统一输入。每个逻辑帧开头调用 poll()。 */
export class Input implements InputState {
  onKey: ((code:string)=>void)|null=null;
  private brushBlocked=false;
  private cursor:HTMLDivElement|null=null;
  private cursorPosition={x:0,y:0};
  setCursorColor(color:string):void {this.cursor?.style.setProperty('--pen-color',color);}
  blockBrushUntilRelease():void {this.brushBlocked=true;this.pointerSamples=[];this.consume('brush');}
  private keys = new Set<string>();
  private cur = new Set<Action>();
  private prev = new Set<Action>();
  /** 两次 poll 之间按下又松开的键也要记一次 pressed。 */
  private tapped = new Set<Action>();
  resetSerial = 0;
  /** 所有键盘/鼠标按下次数；自动重复和长按不累计。 */
  pressSerial = 0;
  pointer = { x: 450, y: 600, inside: false };
  pointerSamples: number[] = [];
  private mouse = new Set<Action>();
  private refreshSurface: (()=>void)|null=null;
  axisX = 0;
  axisY = 0;
  device: 'keyboard' | 'gamepad' = 'keyboard';
  /** 任意按键的首次回调（用于解锁音频）。 */
  onFirstGesture: (() => void) | null = null;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (KEYMAP[e.code]) e.preventDefault();
      if (e.repeat) return;
      if(this.keys.has(e.code))return;
      this.pressSerial++;
      this.keys.add(e.code);
      if(e.code==='Space'){this.pointerSamples=[];if(this.pointer.inside)this.pointerSamples.push(this.pointer.x,this.pointer.y);}
      this.onKey?.(e.code);
      for (const a of KEYMAP[e.code] ?? []) this.tapped.add(a);
      this.device = 'keyboard';
      this.gesture();
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => { this.keys.clear(); this.tapped.clear(); this.mouse.clear(); this.pointerSamples=[]; this.pointer.inside=false; this.resetSerial++; });
    target.addEventListener('pointerdown', () => this.gesture());
    target.addEventListener('mousedown', () => { this.pressSerial++; });
  }

  /** Canvas 的 CSS 战场矩形同时供渲染和鼠标定位使用。 */
  bindCanvas(canvas: HTMLCanvasElement, rect: () => {x:number;y:number;w:number;h:number}, playing: () => boolean): void {
    const pen=document.createElement('div');pen.className='pen-cursor';pen.innerHTML='<svg viewBox="0 0 36 36"><path d="M3 33 L10 12 L25 3 L33 11 L24 26 Z" fill="var(--pen-color)" stroke="#111" stroke-width="5" stroke-linejoin="round"/><path d="M3 33 L10 12 L25 3 L33 11 L24 26 Z" fill="var(--pen-color)" stroke="white" stroke-width="2" stroke-linejoin="round"/><path d="M3 33 L18 18 M10 12 L24 26" stroke="#111" stroke-width="2"/><circle cx="18" cy="18" r="2" fill="white"/></svg>';Object.assign(pen.style,{position:'fixed',width:'36px',height:'36px',pointerEvents:'none',zIndex:'45',filter:'drop-shadow(0 0 5px var(--pen-color))'});document.body.appendChild(pen);this.cursor=pen;
    this.refreshSurface=()=>{if(!playing()){this.mouse.clear();this.pointer.inside=false;}canvas.style.cursor=this.pointer.inside?'none':'auto';pen.hidden=!this.pointer.inside;pen.style.left=(this.cursorPosition.x-3)+'px';pen.style.top=(this.cursorPosition.y-33)+'px';};
    const locate = (e: MouseEvent) => {
      this.cursorPosition={x:e.clientX,y:e.clientY};
      const r=rect(),x=(e.clientX-r.x)*900/r.w,y=(e.clientY-r.y)*1200/r.h;
      this.pointer={x:Math.max(0,Math.min(900,x)),y:Math.max(0,Math.min(1200,y)),inside:playing()&&x>=0&&x<=900&&y>=0&&y<=1200};
      canvas.style.cursor=this.pointer.inside?'none':'auto';
    };
    // Chromium的mousedown/up坐标取整；同一像素内沿用pointermove的亚像素位置。
    const locateButton=(e:MouseEvent)=>{
      if(!this.pointer.inside||Math.floor(this.cursorPosition.x)!==e.clientX||Math.floor(this.cursorPosition.y)!==e.clientY)locate(e);
    };
    window.addEventListener('pointermove', e => {
      const wasInside=this.pointer.inside,wasBrush=this.mouse.has('brush');locate(e);
      // buttons 是当前整组按钮状态，补齐从画布外开始或被覆盖层接收的左右键组合。
      if(playing()){
        if(e.buttons&1)this.mouse.add('shoot');else this.mouse.delete('shoot');
        if(e.buttons&2)this.mouse.add('brush');else this.mouse.delete('brush');
      }
      const held=this.mouse.has('brush')||this.keys.has('Space');
      if(!this.brushBlocked&&this.pointer.inside&&held){
        if(!wasInside||(!wasBrush&&this.mouse.has('brush'))){this.pointerSamples=[];this.tapped.add('brush');}
        this.pointerSamples.push(this.pointer.x,this.pointer.y);
      }
    });
    // mousedown/up 逐按钮触发，覆盖左右键同按后任意顺序松开的情况。
    canvas.addEventListener('mousedown', e => {
      locateButton(e);if(!this.pointer.inside)return;
      const action=e.button===0?'shoot':e.button===2?'brush':e.button===1?'weapon':null;
      if(!action)return;e.preventDefault();this.device='keyboard';this.gesture();this.tapped.add(action);
      if(action!=='weapon')this.mouse.add(action);
      if(action==='brush'){this.pointerSamples=[];this.pointerSamples.push(this.pointer.x,this.pointer.y);}
    });
    window.addEventListener('mouseup', e => {locateButton(e);this.mouse.delete(e.button===0?'shoot':e.button===2?'brush':'weapon');});
    window.addEventListener('pointerout', e => {if(!e.relatedTarget){this.mouse.clear();this.pointer.inside=false;canvas.style.cursor='auto';}});
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  private gesture(): void {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture;
      this.onFirstGesture = null;
      f();
    }
  }

  refreshPointer():void {this.refreshSurface?.();}

  poll(): void {
    this.refreshPointer();
    const tmp = this.prev;
    this.prev = this.cur;
    this.cur = tmp;
    this.cur.clear();
    for (const k of this.keys) for (const a of KEYMAP[k] ?? []) this.cur.add(a);
    for (const a of this.mouse) this.cur.add(a);
    if(this.brushBlocked){if(!this.keys.has('Space')&&!this.mouse.has('brush'))this.brushBlocked=false;this.cur.delete('brush');this.tapped.delete('brush');}
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
    if(this.cur.has('brush')){this.cur.delete('shoot');this.pressedNow.delete('shoot');}
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
