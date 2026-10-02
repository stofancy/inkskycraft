// 引擎自测关卡（?stage=0）。同时作为关卡脚本写法的参考示例。
import type { EnemyDef } from '../game/enemy';
import type { Co, G } from '../game/api';
import type { StageDef } from './types';

const PI = Math.PI;

/** 杂兵：从上方俯冲，途中朝玩家打一发。 */
const Hornet: EnemyDef = {
  sprite: 'e_hornet', hp: 4, score: 200, face: 'move',
  *ai(e, g) {
    e.vel(PI / 2, 260);
    yield* g.wait(0.6 + g.rng.next() * 0.4);
    const m = e.anchor('muzzle');
    g.shoot(m.x, m.y, g.aim(m.x, m.y), 300, { shape: 'rice', color: 'cyan' });
    // 转向离场
    const side = e.x < 450 ? 1 : -1;
    for (let i = 0; i < 60; i++) {
      const a = Math.atan2(e.vy, e.vx) - side * 0.03;
      e.vel(a, 300);
      yield;
    }
  },
};

/** 纸鹤：缓慢飘入、悬停撒一圈弹、再离开。 */
const Crane: EnemyDef = {
  sprite: 'e_crane', hp: 10, score: 400, drops: 'medal',
  *ai(e, g) {
    yield* e.moveTo(e.x, 180 + g.rng.next() * 120, 1.2);
    for (let k = 0; k < 3; k++) {
      g.ring(e.x, e.y, 12, 170, { shape: 'orb', color: 'magenta' }, k * 0.13);
      yield* g.wait(0.7);
    }
    e.vel(-PI / 2, 120);
  },
};

/** 地面铜龟 + 可旋转炮塔（部件）。 */
const TurtleGun: EnemyDef = {
  sprite: 'e_turtle_gun', hp: 30, score: 800, ground: true, face: 'player',
  *ai(e, g) {
    yield* g.wait(1);
    for (;;) {
      const m = e.anchor('muzzle');
      g.fan(m.x, m.y, g.aim(m.x, m.y), 3, 0.35, 240, { shape: 'crystal', color: 'amber' });
      yield* g.wait(1.4);
    }
  },
};
const Turtle: EnemyDef = {
  sprite: 'e_turtle', hp: 40, score: 1000, ground: true, armor: 0.7, drops: 'p',
  *ai(e, g) {
    g.attach(e, TurtleGun, 'turret');
  },
};

/** 迷你 Boss：铜雀机身 + 双翼 + 核心，两个阶段。 */
const Wing: EnemyDef = { sprite: 'b_sparrow_wing', hp: 400, score: 5000, armor: 0.8 };
const MiniBoss: EnemyDef = {
  sprite: 'b_sparrow_body', hp: 1, score: 50000, boss: { name: '测试 · 铜雀', phases: 2 },
  *ai(e, g) {
    const wl = g.attach(e, Wing, 'wingL');
    const wr = g.attach(e, Wing, 'wingL', { mirror: true });
    g.attach(e, { sprite: 'b_sparrow_tail', hp: 1, invulnerable: true }, 'tail');
    yield* e.moveTo(450, 260, 2);
    yield* g.phase(e, { hp: 800, time: 30 }, function* (): Co {
      g.fork((function* () {
        for (;;) { yield* e.moveTo(300, 240, 2, 'inOutQuad'); yield* e.moveTo(600, 240, 2, 'inOutQuad'); }
      })());
      for (let i = 0; ; i++) {
        for (const w of [wl, wr]) {
          if (w.dead) continue;
          for (const gun of ['gun1', 'gun2', 'gun3']) {
            const p = w.anchor(gun);
            g.shoot(p.x, p.y, PI / 2 + (i % 2 ? 0.1 : -0.1), 280, { shape: 'rice', color: 'amber' });
          }
        }
        const b = e.anchor('beak');
        if (i % 4 === 0) g.fan(b.x, b.y, g.aim(b.x, b.y), 7, 0.9, 220, { shape: 'orb', color: 'magenta' });
        yield* g.wait(0.5);
      }
    });
    yield* g.phase(e, { hp: 1000, time: 40, name: '铜雀 · 羽刃回旋' }, function* (): Co {
      yield* e.moveTo(450, 280, 1);
      for (let i = 0; ; i++) {
        const b = e.anchor('beak');
        g.ring(b.x, b.y, 24, 200, { shape: 'petal', color: 'violet', angVel: i % 2 ? 0.5 : -0.5 }, i * 0.1);
        if (i % 5 === 0) g.laser(b.x, b.y, g.aim(b.x, b.y), { follow: e, anchor: 'beak', color: 'cyan', warn: 0.9, duration: 1 });
        yield* g.wait(0.45);
      }
    });
  },
};

export const TEST_STAGE: StageDef = {
  index: 1, title: '试炼 · 空卷', subtitle: 'ENGINE TEST', name: '空卷', bg: 'stage1', music: 'stage1',
  *script(g: G) {
    g.card('试炼 · 空卷', 'ENGINE TEST');
    yield* g.wait(2);
    for (let w = 0; w < 3; w++) {
      for (let i = 0; i < 6; i++) {
        g.spawn(Hornet, 150 + i * 120, -30);
        yield* g.wait(0.18);
      }
      yield* g.wait(1);
    }
    g.spawn(Turtle, 250, -60);
    g.spawn(Turtle, 650, -160);
    for (let i = 0; i < 4; i++) g.spawn(Crane, 180 + i * 180, -40 - i * 30);
    yield* g.waitClear(20);
    yield* g.boss(MiniBoss, 450, -200, { subtitle: 'TEST' });
  },
};
