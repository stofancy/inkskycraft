// 基于生成器的协程调度。每次 yield = 等待一个逻辑帧（1/60 秒 × 时间缩放）。
// Scope 形成树：取消父 Scope 会取消其所有任务和子 Scope（敌人死亡、Boss 阶段结束时使用）。

export type Co = Generator<unknown, void, unknown>;

/** 全局时钟（由世界每帧更新）。dt 为经过时间缩放后的秒数。 */
export const Clock = {
  dt: 1 / 60,
  t: 0,
  realDt: 1 / 60,
  frame: 0,
};

export class Scope {
  static current: Scope | null = null;
  private tasks: Co[] = [];
  private children: Scope[] = [];
  dead = false;
  /** 暂停时本作用域及子作用域都不推进（封印定身）。 */
  paused = false;

  constructor(readonly parent?: Scope) {
    if (parent) parent.children.push(this);
  }

  run(co: Co): Co {
    if (!this.dead) this.tasks.push(co);
    return co;
  }

  get idle(): boolean {
    return this.tasks.length === 0 && this.children.every((c) => c.idle);
  }

  cancel(): void {
    if (this.dead) return;
    this.dead = true;
    const ts = this.tasks;
    this.tasks = [];
    for (const t of ts) {
      try { t.return(undefined); } catch { /* 忽略 */ }
    }
    for (const c of this.children) c.cancel();
    this.children = [];
  }

  tick(): void {
    if (this.dead || this.paused) return;
    const prev = Scope.current;
    Scope.current = this;
    for (let i = 0; i < this.tasks.length; i++) {
      const t = this.tasks[i];
      let done = true;
      try {
        done = !!t.next().done;
      } catch (e) {
        console.error('协程异常', e);
      }
      if (this.dead) break;
      if (done) {
        this.tasks.splice(i, 1);
        i--;
      }
    }
    Scope.current = prev;
    if (this.dead) return;
    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      c.tick();
      if (c.dead) {
        this.children.splice(i, 1);
        i--;
      }
    }
  }
}

/** 等待 sec 秒（游戏时间，受子弹时间影响）。 */
export function* wait(sec: number): Co {
  let t = 0;
  while (t < sec) {
    yield;
    t += Clock.dt;
  }
}

/** 等待 n 个逻辑帧。 */
export function* frames(n: number): Co {
  for (let i = 0; i < n; i++) yield;
}

/** 等待条件成立，可选超时（秒）。返回前条件是否成立由调用方自行判断。 */
export function* until(cond: () => boolean, timeout = Infinity): Co {
  let t = 0;
  while (!cond() && t < timeout) {
    yield;
    t += Clock.dt;
  }
}

/** 在当前 Scope 中并行启动一个协程（不等待）。 */
export function fork(co: Co): Co {
  const s = Scope.current;
  if (!s) throw new Error('fork() 必须在协程内调用');
  return s.run(co);
}

/** 并行运行多个协程，全部结束后返回。 */
export function* all(...cos: Co[]): Co {
  const live = cos.slice();
  while (live.length) {
    for (let i = 0; i < live.length; i++) {
      if (live[i].next().done) {
        live.splice(i, 1);
        i--;
      }
    }
    if (live.length) yield;
  }
}

/** 重复执行：每隔 interval 秒调用 fn(i)，共 count 次（count=Infinity 则一直重复）。 */
export function* every(interval: number, count: number, fn: (i: number) => void): Co {
  for (let i = 0; i < count; i++) {
    fn(i);
    if (i < count - 1) yield* wait(interval);
  }
}
