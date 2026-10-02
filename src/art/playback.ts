/** 每个实体持有一个实例。update 接收游戏 dt；暂停时传 0。事件在进入帧时触发。 */
export type PlaybackMode = 'loop' | 'once' | 'pingpong';
export interface PlaybackSpec {
  count: number;
  fps: number;
  mode: PlaybackMode;
  events?: { frame: number; name: string }[];
}
export interface FrameEvent { frame: number; name: string; direction: 1 | -1 }
export class SpritePlayback {
  frame = 0;
  finished = false;
  paused = false;
  private steps = 0;
  private remainder = 0;
  constructor(readonly spec: PlaybackSpec, readonly onEvent?: (event: FrameEvent) => void) {
    if (!Number.isInteger(spec.count) || spec.count < 1 || !Number.isFinite(spec.fps) || spec.fps <= 0
      || !['loop', 'once', 'pingpong'].includes(spec.mode)) throw new Error('动画帧数、帧率或播放方式无效');
    if (spec.events?.some(e => !Number.isInteger(e.frame) || e.frame < 0 || e.frame >= spec.count)) throw new Error('关键帧超出动画范围');
  }
  private at(step: number): number {
    const n = this.spec.count;
    if (this.spec.mode === 'once') return Math.min(step, n - 1);
    if (this.spec.mode === 'loop' || n === 1) return step % n;
    const k = step % (2 * n - 2);
    return k < n ? k : 2 * n - 2 - k;
  }
  private emit(direction: 1 | -1): void {
    for (const event of this.spec.events ?? []) if (event.frame === this.frame) this.onEvent?.({ ...event, direction });
  }
  /** 重播会进入第 0 帧并发送它的事件；构造和 seek 不发送事件。 */
  restart(): void { this.steps = this.remainder = this.frame = 0; this.finished = false; this.emit(1); }
  /** 固定采样/同步用，时间单位秒；不触发事件。 */
  seek(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('动画时间须为非负有限秒数');
    const position = seconds * this.spec.fps;
    this.steps = Math.floor(position); this.remainder = position - this.steps;
    this.frame = this.at(this.steps);
    this.finished = this.spec.mode === 'once' && this.steps >= this.spec.count;
  }
  update(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('动画 dt 须为非负有限秒数');
    if (this.paused || this.finished || dt === 0) return;
    this.remainder += dt * this.spec.fps;
    const advance = Math.floor(this.remainder + 1e-9);
    this.remainder -= advance;
    for (let i = 0; i < advance; i++) {
      if (this.spec.mode === 'once' && this.steps + 1 >= this.spec.count) {
        this.finished = true; this.remainder = 0; break;
      }
      const previous = this.frame;
      this.frame = this.at(++this.steps);
      // 单帧 loop 每一周期仍有一次进入帧的事件。
      this.emit(this.frame < previous && this.spec.mode === 'pingpong' ? -1 : 1);
    }
  }
}

/** 用 e.run(animateEntity(e, playback)) 接入现有实体协程；anim 帧率字段留空。 */
export function* animateEntity(entity: { age: number; frame: number; dead: boolean }, playback: SpritePlayback): Generator<void> {
  let previous = entity.age;
  while (!entity.dead) {
    playback.update(Math.max(0, entity.age - previous)); previous = entity.age;
    entity.frame = playback.frame;
    if (playback.finished) return;
    yield;
  }
}
