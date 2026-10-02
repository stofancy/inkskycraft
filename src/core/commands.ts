/** 固定屏幕方向：数字键盘记法，8=前，2=后，5=松开。只观察输入，不消费移动。 */
export type Direction = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export interface Command { sequence: readonly Direction[]; window: number }
export const DIRECTION_ICON: Record<Direction, string> = {1:'↙',2:'↓',3:'↘',4:'←',5:'·',6:'→',7:'↖',8:'↑',9:'↗'};
interface Sample { direction: Direction; time: number }
export function directionFromAxes(x: number, y: number): Direction {
  if (Math.hypot(x, y) < .35) return 5;
  const angle = Math.atan2(-y, x);
  return ([6,9,8,7,4,1,2,3] as const)[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}
const ADJACENT: Partial<Record<Direction, readonly Direction[]>> = {2:[1,3],4:[1,7],6:[3,9],8:[7,9]};
export class DirectionBuffer {
  private readonly ring: (Sample | undefined)[] = new Array(32);
  private head = 0;
  private size = 0;
  private last: Direction = 5;
  clear(): void { this.head = this.size = 0; this.last = 5; this.ring.fill(undefined); }
  sample(direction: Direction, time: number): void {
    if (direction === this.last) return;
    this.last = direction;
    this.ring[this.head] = {direction, time};
    this.head = (this.head + 1) % this.ring.length;
    this.size = Math.min(this.size + 1, this.ring.length);
  }
  get history(): readonly Sample[] {
    return Array.from({length:this.size}, (_,i) => this.ring[(this.head-this.size+i+this.ring.length)%this.ring.length]!);
  }
  matches(command: Command, now: number): boolean {
    const tokens: Sample[] = [];
    let neutral: number | null = null;
    for (const s of this.history) {
      if (s.direction === 5) { neutral = s.time; continue; }
      // 明确写在指令里的斜向保留；其他邻近斜向归入唯一相邻的目标直向。
      const candidates = command.sequence.filter(d => ADJACENT[d]?.includes(s.direction));
      const direction = command.sequence.includes(s.direction) || new Set(candidates).size !== 1 ? s.direction : candidates[0];
      const previous = tokens.at(-1);
      if (previous?.direction !== direction || (neutral !== null && s.time-neutral >= .035)) tokens.push({direction,time:s.time});
      neutral = null;
    }
    const tail = tokens.slice(-command.sequence.length);
    if (tail.length !== command.sequence.length || now-tail[0].time > command.window || now-tail.at(-1)!.time > .3) return false;
    return tail.every((s,i) => s.direction === command.sequence[i] && (i===0 || s.time-tail[i-1].time <= .5));
  }
  get icons(): string { return this.history.filter(s=>s.direction!==5).slice(-6).map(s=>DIRECTION_ICON[s.direction]).join(' '); }
}
