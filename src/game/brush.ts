// 「一笔」：按住画笔键 → 子弹时间，战机拖出墨迹；松开 → 笔画「斩」，闭环「封」。
import { clamp, pointInPoly, polyArea, segDist2, segIntersect } from '../core/math';
import { CURVES } from '../ui/motion';
import { PK } from '../gl/particles';
import type { Renderer } from '../gl/renderer';
import { RS } from '../gl/ribbons';
import type { Enemy } from './enemy';
import type { World } from './world';

const MIN_INK = 0.25;
const INK_PER_UNIT = 1 / 2600;
const MAX_TIME = 3.2;
const STEP = 7;
const HALF_W = 18;

interface Stroke { pts: number[]; t: number; dur: number }
interface Stamp { x: number; y: number; scale: number; t: number; rot: number; reduced: boolean }

export class Brush {
  active = false;
  pts: number[] = [];
  private t = 0;
  private strokes: Stroke[] = [];
  private stamps: Stamp[] = [];
  private readonly motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  /** 本关封印计数（结算用）。 */
  sealed = 0;

  constructor(readonly w: World) {}

  update(realDt: number): void {
    const w = this.w, p = w.player, inp = w.input;
    if (!this.active) {
      if (inp.pressed('brush')) {
        if (p.alive && p.entering <= 0 && p.bombT <= 0 && p.ink >= w.progression.brushMods.minInk) this.start();
        else if (p.alive) w.audio.sfx('menu_back', { vol: 0.5 });
      }
    } else {
      this.t += realDt;
      const n = this.pts.length;
      const lx = this.pts[n - 2], ly = this.pts[n - 1];
      const d = Math.hypot(p.x - lx, p.y - ly);
      if (d >= STEP) {
        this.pts.push(p.x, p.y);
        p.ink = Math.max(0, p.ink - d * INK_PER_UNIT * w.progression.brushMods.costScale);
        if (this.pts.length % 6 === 0) {
          w.r.fluid.splat({ x: p.x, y: p.y, r: 9, glow: [0.9, 0.12, 0.04] });
          w.fx.emitHigh({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.5, size: 2.5, r: 2.4, g: 0.4, b: 0.12, kind: PK.Ember });
        }
      }
      if (!inp.down('brush') || p.ink <= 0 || this.t > w.progression.brushMods.maxTime || this.pts.length > 1200 || !p.alive) this.release();
    }
    for (const s of this.strokes) s.t += realDt;
    this.strokes = this.strokes.filter((s) => s.t < s.dur);
    for (const s of this.stamps) s.t += realDt;
    this.stamps = this.stamps.filter((s) => s.t < 1.6);
  }

  private start(): void {
    const p = this.w.player;
    this.active = true;
    this.t = 0;
    this.pts = [p.x, p.y];
    this.w.audio.sfx('brush_start');
  }

  cancel(): void {
    this.active = false;
    this.pts = [];
  }

  private release(): void {
    this.active = false;
    const pts = this.pts;
    this.pts = [];
    if (pts.length < 8) return;
    this.strokes.push({ pts, t: 0, dur: 0.9 });
    this.resolve(pts);
  }

  private resolve(pts: number[]): void {
    const w = this.w;
    const n = pts.length / 2;
    w.audio.sfx('brush_release');

    // ---- 斩：沿笔画 ----
    let slashed = 0, erased = 0;
    const hitSet = new Set<Enemy>();
    for (const e of w.enemies) {
      if (!w.targetable(e)) continue;
      const rr = (e.radius + w.progression.brushMods.width) ** 2;
      for (let i = 0; i < n - 1; i++) {
        if (segDist2(e.x, e.y, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3]) < rr) {
          hitSet.add(e);
          break;
        }
      }
    }
    for (const b of w.bullets.list) {
      if (b.dead || b.hard) continue;
      const rr = (b.radius + w.progression.brushMods.width) ** 2;
      for (let i = 0; i < n - 1; i++) {
        if (segDist2(b.x, b.y, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3]) < rr) {
          w.bulletToGold(b);
          erased++;
          break;
        }
      }
    }

    // ---- 封：自交闭环 ----
    const loops: number[][] = [];
    let i = 0;
    while (i < n - 3) {
      let found = false;
      for (let j = n - 2; j >= i + 2; j--) {
        const t = segIntersect(
          pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3],
          pts[j * 2], pts[j * 2 + 1], pts[j * 2 + 2], pts[j * 2 + 3],
        );
        if (t >= 0) {
          const ix = pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * t;
          const iy = pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * t;
          const poly = [ix, iy];
          for (let k = i + 1; k <= j; k++) poly.push(pts[k * 2], pts[k * 2 + 1]);
          loops.push(poly);
          i = j + 1;
          found = true;
          break;
        }
      }
      if (!found) i++;
    }
    // 首尾相近也算闭合
    if (!loops.length && n > 12) {
      const dx = pts[0] - pts[(n - 1) * 2], dy = pts[1] - pts[(n - 1) * 2 + 1];
      if (Math.hypot(dx, dy) < 55) loops.push(pts.slice());
    }

    let sealedEnemies = 0, sealedBullets = 0;
    for (const poly of loops) {
      const area = polyArea(poly);
      if (area < 1500) continue;
      let cx = 0, cy = 0;
      const m = poly.length / 2;
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (let k = 0; k < m; k++) {
        cx += poly[k * 2]; cy += poly[k * 2 + 1];
        minX = Math.min(minX, poly[k * 2]); maxX = Math.max(maxX, poly[k * 2]);
        minY = Math.min(minY, poly[k * 2 + 1]); maxY = Math.max(maxY, poly[k * 2 + 1]);
      }
      cx /= m; cy /= m;
      for (const e of w.enemies) {
        if (!w.targetable(e) || !pointInPoly(e.x, e.y, poly)) continue;
        sealedEnemies++;
        hitSet.delete(e);
        const boss = e.phaseLock || !!e.def.boss;
        if (!boss && !e.parent?.phaseLock) e.sealed = Math.max(e.sealed, w.progression.brushMods.sealDuration);
        w.damage(e, (boss ? 260 : 160) * w.progression.brushMods.damageScale, e.x, e.y, true, 'ink');
        e.data.lastSealedAt = w.t;
      }
      for (const b of w.bullets.list) {
        if (b.dead || b.hard || !pointInPoly(b.x, b.y, poly)) continue;
        w.bulletToGold(b);
        sealedBullets++;
      }
      // 印章与演出
      const size = Math.sqrt(area);
      this.stamps.push({ x: cx, y: cy, scale: Math.min(1.5, Math.max(0.35, size / 256 * 1.2)), t: 0,
        rot: (Math.random() - 0.5) * Math.PI / 30, reduced: this.motionPreference.matches });
      w.fx.shockwave(cx, cy, size * 1.1, 14, 0.6);
      w.fx.shake(0.45);
      w.fx.flash(0.18, [1.0, 0.25, 0.12]);
      w.r.fluid.splat({ x: cx, y: cy, r: size * 0.35, radial: true, vx: 500, ink: [0.75, 0.06, 0.03, 0.55], glow: [1.4, 0.2, 0.06] });
      for (let k = 0; k < 90 * w.fx.density; k++) {
        const x = minX + Math.random() * (maxX - minX), y = minY + Math.random() * (maxY - minY);
        if (!pointInPoly(x, y, poly)) continue;
        w.fx.emit({ x, y, vx: (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 120, drag: 1.2, grav: 90, life: 1.6, size: 5, spin: 5, rot: Math.random() * 6, r: 0.8, g: 0.08, b: 0.05, a: 0.95, kind: PK.Petal });
        w.fx.emitHigh({ x, y, vx: (Math.random() - 0.5) * 200, vy: -150 - Math.random() * 200, drag: 2, life: 1.1, size: 3, spin: 9, r: 2.2, g: 1.5, b: 0.4, kind: PK.Leaf });
      }
      w.audio.sfx('seal');
    }
    this.sealed += sealedEnemies + sealedBullets;

    // 斩击伤害（未被封印的）
    for (const e of hitSet) {
      slashed++;
      w.damage(e, (e.phaseLock ? 90 : 70) * w.progression.brushMods.damageScale, e.x, e.y, true, 'ink');
      w.fx.hit(e.x, e.y, [2.6, 0.5, 0.2], 10);
      w.r.fluid.splat({ x: e.x, y: e.y, r: 20, radial: true, vx: 300, ink: [0.02, 0.015, 0.015, 0.6] });
    }
    if (slashed) w.audio.sfx('slash');

    // 笔锋墨迹注入流体：顺着笔势甩出
    for (let k = 0; k < n - 1; k += 3) {
      const x = pts[k * 2], y = pts[k * 2 + 1];
      const dx = pts[k * 2 + 2] - x, dy = pts[k * 2 + 3] - y;
      const l = Math.hypot(dx, dy) || 1;
      w.r.fluid.splat({ x, y, r: 11, vx: (dx / l) * 700, vy: (dy / l) * 700, ink: [0.012, 0.01, 0.01, 0.55], glow: [0.8, 0.1, 0.03] });
    }

    // 计分与倍率
    const bonus = slashed * 2 + sealedEnemies * 6 + Math.floor(sealedBullets * 0.3) + Math.floor(erased * 0.1);
    w.addChain(bonus);
    if (loops.length && (sealedEnemies || sealedBullets)) {
      const lp = loops[0];
      const pts2 = lp.length / 2;
      let cx = 0, cy = 0;
      for (let k = 0; k < pts2; k++) { cx += lp[k * 2]; cy += lp[k * 2 + 1]; }
      w.ui.popup(cx / pts2, Math.max(60, cy / pts2 - 170), `封 ×${sealedEnemies + sealedBullets}`, 'seal');
      w.addScore((sealedEnemies * 3000 + sealedBullets * 200));
    }
    if (slashed) w.ui.popup(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1] - 30, `斩 ×${slashed}`, 'chain');
    w.progression.onBrushRelease(pts, slashed, erased + sealedBullets, sealedEnemies);
    w.shop.onBrushRelease(pts, slashed, erased + sealedBullets, sealedEnemies);
    w.combos.record('brushRelease');
    if (sealedEnemies || sealedBullets) w.combos.record('seal');
  }

  draw(r: Renderer, time: number): void {
    const cin: [number, number, number] = [1.9, 0.28, 0.08];
    if (this.active && this.pts.length >= 4) {
      const n = this.pts.length / 2;
      const wd = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const head = Math.min(1, i / 5), tail = Math.min(1, (n - 1 - i) / 3 + 0.35);
        wd[i] = HALF_W * (0.35 + 0.65 * head) * tail * (0.9 + 0.1 * Math.sin(i * 0.7 + time * 10));
      }
      r.ribbonTop.strip(this.pts, wd, RS.Brush, cin[0], cin[1], cin[2], 1);
      // 起点提示：回到这里即可闭合
      const pulse = 0.6 + 0.4 * Math.sin(time * 12);
      r.bullets.add(this.pts[0], this.pts[1], 0, 10 * pulse + 6, 4, 1.8, 0.3, 0.1, 1, 0.8, 0.3);
    }
    for (const s of this.strokes) {
      const u = s.t / s.dur;
      const n = s.pts.length / 2;
      const wd = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const head = Math.min(1, i / 5), tail = Math.min(1, (n - 1 - i) / 5);
        wd[i] = HALF_W * (1 + 0.6 * (1 - u)) * (0.3 + 0.7 * Math.min(head, tail));
      }
      const hot = Math.max(0, 1 - u * 6);
      r.ribbonTop.strip(s.pts, wd, RS.Brush, cin[0] + hot * 2, cin[1] + hot * 1.6, cin[2] + hot, 1 - u * u);
    }
    for (const s of this.stamps) {
      // 与界面印章共用 460ms 弹簧；幅度相对闭环尺寸，保留 1.6s 生命期及透明度时序。
      const t = clamp(s.t / 0.46, 0, 1);
      const scale = s.scale * (s.reduced ? 1 : clamp(1.04 - 0.04 * CURVES.spring(t), 0.96, 1.04));
      const a = Math.min(1, s.t / 0.12) * Math.min(1, (1.6 - s.t) / 0.5);
      r.top.add('fx_seal', { x: s.x, y: s.y, rot: s.rot, sx: scale, sy: scale, alpha: a * 0.92, glow: 1.5,
        flash: !s.reduced && s.t < 0.15 ? 0.6 : 0 });
    }
  }

  clear(): void {
    this.cancel();
    this.strokes = [];
    this.stamps = [];
  }
}
