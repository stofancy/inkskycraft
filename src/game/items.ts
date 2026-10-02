// 道具：浮游反弹（P/武器/炸弹等）、下落（金印奖牌）、自动吸附（子弹化成的金）。
import { PLAY_H, PLAY_W, type WeaponColor } from '../types';
import type { ItemKind } from './enemy';

export type ItemType = ItemKind | 'gold';

export class Item {
  x = 0; y = 0; vx = 0; vy = 0;
  age = 0;
  dead = false;
  homing = false;
  constructor(readonly kind: ItemType) {}
}

const WEAPON_CYCLE: WeaponColor[] = ['red', 'blue', 'purple'];
const SPRITE: Record<ItemType, string> = {
  p: 'item_p', weapon: 'item_red', bomb: 'item_bomb', missile: 'item_missile', medal: 'item_medal', ink: 'item_ink', '1up': 'item_1up', gold: 'item_medal',
};

export class Items {
  list: Item[] = [];
  /** 奖牌漏接回调。 */
  onMedalMissed: (() => void) | null = null;

  spawn(kind: ItemType, x: number, y: number): Item {
    const it = new Item(kind);
    it.x = x;
    it.y = y;
    if (kind === 'gold') {
      const a = Math.random() * Math.PI * 2;
      it.vx = Math.cos(a) * 80;
      it.vy = Math.sin(a) * 80 - 60;
    } else if (kind === 'medal') {
      it.vx = (Math.random() - 0.5) * 60;
      it.vy = -160;
    } else {
      it.vx = (Math.random() - 0.5) * 140;
      it.vy = -180;
    }
    this.list.push(it);
    return it;
  }

  /** 武器水晶当前颜色。 */
  static weaponColor(it: Item): WeaponColor {
    return WEAPON_CYCLE[Math.floor(it.age / 1.6) % 3];
  }

  static sprite(it: Item): string {
    if (it.kind === 'weapon') return 'item_' + Items.weaponColor(it);
    return SPRITE[it.kind];
  }

  /** dt 为游戏时间。magnet=true 时所有道具被吸向玩家。 */
  tick(dt: number, px: number, py: number, playerAlive: boolean, magnet: boolean, onPick: (it: Item) => void): void {
    for (const it of this.list) {
      it.age += dt;
      const dx = px - it.x, dy = py - it.y;
      const d = Math.hypot(dx, dy);
      if (playerAlive && (it.homing || magnet || d < 80 || (it.kind === 'gold' && it.age > 0.3))) it.homing = true;
      if (it.homing && playerAlive) {
        const sp = Math.min(1600, 500 + it.age * 600);
        it.vx = (dx / (d || 1)) * sp;
        it.vy = (dy / (d || 1)) * sp;
      } else if (it.kind === 'gold') {
        it.vx *= Math.exp(-3 * dt);
        it.vy *= Math.exp(-3 * dt);
      } else if (it.kind === 'medal') {
        it.vy = Math.min(110, it.vy + 400 * dt);
        it.vx *= Math.exp(-1.5 * dt);
      } else {
        // 雷电式浮游：先上抛，然后在屏幕内缓慢反弹，8 秒后放行下落
        it.vy = Math.min(90, it.vy + 300 * dt);
        if (it.age < 8) {
          if (it.x < 30 && it.vx < 0) it.vx = Math.abs(it.vx) + 20;
          if (it.x > PLAY_W - 30 && it.vx > 0) it.vx = -Math.abs(it.vx) - 20;
          if (it.y > PLAY_H - 120 && it.vy > 0) it.vy = -120;
          if (Math.abs(it.vx) < 40) it.vx = (it.vx < 0 ? -1 : 1) * 40;
        }
      }
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      if (playerAlive && Math.hypot(px - it.x, py - it.y) < (it.kind === 'gold' ? 30 : 38)) {
        it.dead = true;
        onPick(it);
      } else if (it.y > PLAY_H + 40 || it.x < -80 || it.x > PLAY_W + 80) {
        it.dead = true;
        if (it.kind === 'medal') this.onMedalMissed?.();
      }
    }
    this.list = this.list.filter((i) => !i.dead);
  }

  clear(): void {
    this.list = [];
  }
}
