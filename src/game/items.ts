// 即拾即用道具：浮游火力/泼墨/墨锭、下落金印、自动吸附的清弹金。
import { PLAY_H, PLAY_W } from '../types';
import type { ItemKind } from './enemy';

export type ItemType = ItemKind | 'gold';

export class Item {
  x = 0; y = 0; vx = 0; vy = 0;
  age = 0;
  /** 出现后的真实战斗秒数；菜单停留不计入。 */
  elapsed = 0;
  dead = false;
  homing = false;
  /** 关卡固定教学掉落禁止被钱耗拿走。 */
  tutorial=false;
  scoreValue?:number;
  spriteOverride?:string;
  constructor(readonly kind: ItemType) {}
}

export const MAX_POWER = 4;
export const MAX_BOMBS = 6;
export const EXTEND_SCORES = [1_000_000, 1_800_000] as const;

export function medalScore(seconds: number): number {
  return seconds <= 1 + 1e-9 ? 2000 : seconds <= 2 + 1e-9 ? 1000 : seconds <= 3 + 1e-9 ? 500 : 200;
}
const SPRITE: Record<ItemType, string> = {
  p: 'item_p', bomb: 'item_bomb', medal: 'item_medal', ink: 'item_ink', gold: 'item_gold',
};

export class Items {
  list: Item[] = [];

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

  static sprite(it: Item): string {
    if(it.spriteOverride)return it.spriteOverride;
    return SPRITE[it.kind];
  }

  /** dt 为游戏时间。magnet=true 时所有道具被吸向玩家。 */
  tick(dt: number, px: number, py: number, playerAlive: boolean, magnet: boolean, onPick: (it: Item) => void, realDt = dt): void {
    for (const it of this.list) {
      if (it.dead) continue;
      it.age += dt;
      it.elapsed += realDt;
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
      }
    }
    this.list = this.list.filter((i) => !i.dead);
  }

  clear(): void {
    this.list = [];
  }
}
