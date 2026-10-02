// 动画演示共用真实 World/attach/Renderer；仅 ?pipeline=1 加载，不改四章内容。
import type { Game } from '../src/game/game';
import type { EnemyDef } from '../src/game/enemy';

export function installAnimationScene(game: Game) {
  const w = game.world;
  w.resetStage();
  w.player.reset(false);
  w.player.entering = 0;
  w.player.invuln = 0;
  w.player.weapon = 'red';
  game.debug.god = false;
  game.state = 'playing';
  game.ui.screen('none');
  w.root.run(w.boss({ sprite: 'pipeline_body', hp: 5000, boss: { name: '分件演示', phases: 1 }, noCollide: true,
    *ai() { for (;;) yield; },
  }, 450, 330, { warning: false, music: false }));
  w.root.tick();
  const body = w.liveEnemies()[0];
  const wing = (phase: number): EnemyDef => ({ sprite: 'pipeline_wing', hp: 400, noCollide: true,
    bone: { rot: { amplitude: .32, period: 1.4, phase, ease: 'inOutQuad' }, y: { amplitude: 5, period: 1.4, phase } } });
  const left = w.attach(body, wing(0), 'wingL');
  const right = w.attach(body, wing(Math.PI), 'wingL', { mirror: true });
  const tailDef: EnemyDef = { sprite: 'pipeline_tail', hp: 800, noCollide: true,
    deform: { bend: 18, sway: 12, breath: .06, speed: 3.5, weight: [.06, .95] } };
  const tail = w.attach(body, tailDef, 'tail');
  body.angle = Math.PI;
  const enemy = w.spawn({ sprite: 'pipeline_enemy', hp: 300, noCollide: true,
    deform: { bend: 8, breath: .08, speed: 4.2, weight: [0, 1] } }, 225, 830);
  enemy.angle = Math.PI;
  for (const e of [left, right, tail]) e.syncToParent();
  body.run((function* () {
    for (;;) { body.x = 450 + Math.sin(body.age * .65) * 30; yield; }
  })());
  const controls = {
    body, left, right, tail, enemy,
    breakWing: () => w.damage(left, 10000, left.x, left.y, false, 'red'),
    turn: () => { body.angle += Math.PI / 6; for (const e of body.children) e.syncToParent(); },
    setDeform: (enabled: boolean) => {
      tailDef.deform = enabled ? { bend: 18, sway: 12, breath: .06, speed: 3.5, weight: [.06, .95] } : undefined;
      enemy.def.deform = enabled ? { bend: 8, breath: .08, speed: 4.2, weight: [0, 1] } : undefined;
    },
  };
  (window as unknown as { __anim: typeof controls }).__anim = controls;
  return controls;
}
