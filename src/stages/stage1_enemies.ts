// 第一幕 · 墨山晓：普通敌人定义（杂兵、纸鹤、风筝、铜龟、炮台、战车）。
// 颜色约定：cyan = 自机狙 / 快弹；magenta = 慢速花瓣、圆弹（适合画圈）；amber = 炮塔 / 战车的水晶弹。
import type { EnemyDef } from '../game/enemy';

const PI = Math.PI;

/** 杂兵：沿 data.angle 方向直线飞行，途中朝玩家打 burst 发，然后转向离场。 */
export const Hornet: EnemyDef = {
  sprite: 'e_hornet', hp: 14, score: 200, face: 'move',
  *ai(e, g) {
    const d = e.data;
    const sp: number = d.speed ?? 250;
    e.vel(d.angle ?? PI / 2, sp);
    yield* g.wait(d.fireAt ?? 0.75);
    const burst: number = d.burst ?? 1;
    for (let i = 0; i < burst && d.fire !== false; i++) {
      const m = e.anchor('muzzle');
      g.shoot(m.x, m.y, g.aim(m.x, m.y), 200 + g.rank * 50, { shape: 'rice', color: 'cyan' });
      yield* g.wait(0.14);
    }
    const side: number = d.turn ?? (e.x < 450 ? 1 : -1);
    for (;;) {
      e.vel(Math.atan2(e.vy, e.vx) - side * 1.5 * g.dt, sp);
      yield;
    }
  },
};

/** 纸鹤：从侧面滑入编队位置（data.slot），悬停撒慢速圆弹环，然后向侧面离场。 */
export const Crane: EnemyDef = {
  sprite: 'e_crane', hp: 20, score: 400, anim: 6,
  *ai(e, g) {
    const d = e.data;
    const [sx, sy] = d.slot as [number, number];
    yield* e.moveTo(sx, sy, d.enter ?? 1.7, 'outQuad');
    yield* g.wait(d.fireAt ?? 0.3);
    const volleys: number = d.volleys ?? 3;
    for (let k = 0; k < volleys; k++) {
      const m = e.anchor('muzzle');
      const n = 9 + Math.round(g.rank * 3);
      g.ring(m.x, m.y, n, 125 + g.rank * 30, { shape: 'orb', color: 'magenta' }, k * 0.2 + (e.x < 450 ? 0 : 0.17));
      if (k === 1) g.shoot(m.x, m.y, g.aim(m.x, m.y), 190, { shape: 'rice', color: 'cyan' });
      yield* g.wait((d.gap ?? 1.0) / g.difficulty.aggression);
    }
    yield* g.wait(0.3);
    e.vel(e.x < 450 ? PI : 0, 190);
    e.vy = -60;
  },
};

/** 铜风筝（中型）：沿 data.dir 方向横穿，边飞边撒慢速花瓣环（适合画圈）。 */
export const Kite: EnemyDef = {
  sprite: 'e_kite', hp: 70, score: 1500, armor: 0.85, drops: 'medal', explosion: 'm',
  *ai(e, g) {
    const d = e.data;
    const dir: number = d.dir ?? 1;
    const y0 = e.y;
    e.vx = dir * (d.speed ?? 120);
    yield* g.wait(0.8);
    let t = 0;
    for (let i = 0; ; i++) {
      // 边飞边缓慢起伏
      const until = t + 0.65;
      while (t < until) { e.y = y0 + 26 * Math.sin(t * 1.5); t += g.dt; yield; }
      const m = e.anchor('muzzle');
      const n = 9 + Math.round(g.rank * 3);
      g.ring(m.x, m.y, n, 100 + g.rank * 20, { shape: 'petal', color: 'magenta', angVel: dir * 0.35, life: 7 }, i * 0.31);
      if (i % 3 === 2) g.fan(m.x, m.y, g.aim(m.x, m.y), 3, 0.32, 210, { shape: 'rice', color: 'cyan' });
    }
  },
};

/** 铜龟炮塔（部件）：朝玩家扇形晶弹。 */
export const TurtleGun: EnemyDef = {
  sprite: 'e_turtle_gun', hp: 30, score: 600, ground: true, face: 'player',
  *ai(e, g) {
    yield* g.wait(1.2);
    for (;;) {
      const m = e.anchor('muzzle');
      g.fan(m.x, m.y, g.aim(m.x, m.y), 3, 0.4, 190 + g.rank * 30, { shape: 'crystal', color: 'amber' });
      yield* g.wait((1.7 - g.rank * 0.3) / g.difficulty.aggression);
    }
  },
};
/** 山径上的铜龟（地面，随卷轴移动）。 */
export const Turtle: EnemyDef = {
  sprite: 'e_turtle', hp: 85, score: 1000, ground: true, armor: 0.7,
  *ai(e, g) {
    g.attach(e, TurtleGun, 'turret');
  },
};

/** 山体炮台（地面）：两连发自机狙。 */
export const Turret: EnemyDef = {
  sprite: 'e_turret', hp: 65, score: 500, ground: true, face: 'player',
  *ai(e, g) {
    yield* g.wait(0.8 + (e.data.delay ?? 0));
    for (;;) {
      for (let i = 0; i < 2; i++) {
        if (e.data.disabled) { yield* g.wait(.3); continue; }
        const m = e.anchor('muzzle');
        g.shoot(m.x, m.y, g.aim(m.x, m.y), 215 + g.rank * 30, { shape: 'crystal', color: 'amber' });
        yield* g.wait(0.16);
      }
      yield* g.wait((1.9 - g.rank * 0.3) / g.difficulty.aggression);
    }
  },
};

/** 飞行战车（中型轰炸机）：入场压制，双炮自机狙三连发，舱口投下大慢弹。 */
export const Chariot: EnemyDef = {
  sprite: 'e_chariot', hp: 260, score: 4000, armor: 0.85, drops: ['medal', 'medal'], explosion: 'l',
  *ai(e, g) {
    const d = e.data;
    const ty: number = d.ty ?? 210;
    yield* e.moveTo(e.x, ty, 2.2, 'outCubic');
    g.fx.shockwave(e.x, e.y, 180, 6, 0.6);
    g.fx.shake(0.25);
    const hold: number = d.hold ?? 13;
    let t = 0;
    for (let i = 0; t < hold; i++) {
      for (let k = 0; k < 3; k++) {
        for (const a of ['gunL', 'gunR']) {
          const m = e.anchor(a);
          g.shoot(m.x, m.y, g.aim(m.x, m.y) + (a === 'gunL' ? -0.05 : 0.05), 225 + g.rank * 30, { shape: 'rice', color: 'cyan' });
        }
        yield* g.wait(0.13);
        t += 0.13;
      }
      if (i % 2 === 1) {
        const b = e.anchor('bay');
        g.ring(b.x, b.y, 6, 105, { shape: 'big', color: 'magenta' }, PI / 6);
        g.ring(b.x, b.y, 12, 135, { shape: 'orb', color: 'magenta' }, i * 0.2);
      }
      const w = 1.5 / g.difficulty.aggression;
      yield* g.wait(w);
      t += w;
    }
    e.vel(-PI / 2, 130);
  },
};
