// 鼠标运笔：起笔位置优先，再识别闭环与已解锁笔形。
import { clamp, pointInPoly, polyArea, segDist2, segIntersect } from '../core/math';
import { PK } from '../gl/particles';
import type { Renderer } from '../gl/renderer';
import { BrushPaths } from './brush-paths';
import { BrushColors, BRUSH_COLORS } from './brush-colors';
import type { WeaponColor } from '../types';
import { RS } from '../gl/ribbons';
import type { Enemy } from './enemy';
import type { World } from './world';

const INK_PER_UNIT = 1 / 4000;
export type { BrushForm } from './brush-shape';
import { identifyStroke, type BrushForm } from './brush-shape';
export const BRUSH_POWER=[{level:1,slow:.6,maxLength:1200},{level:2,slow:.5,maxLength:1600},{level:3,slow:.4,maxLength:2000}] as const;
const STEP = 7;
const HALF_W = 18;
const SLASH_LIFE = .25;

interface Stroke { pts: number[]; t: number; dur: number; route:boolean; color:WeaponColor }
interface Stamp { x: number; y: number; scale: number; t: number; rot: number; reduced: boolean; color:WeaponColor; radius:number; white:boolean }

export class Brush {
  active = false;
  /** 关卡机制要求划线时（纸龙查封令）：不耗墨，墨为 0 也能起笔。 */
  free = false;
  pts: number[] = [];
  private t = 0;
  private releaseProtection = 0;
  readonly paths:BrushPaths;
  private length=0;
  private origin: 'player'|'chiyan'|'laodun'|null=null;
  lastForm = '斩／封';
  lastStroke: {id:number;form:string;pts:number[]} | null = null;
  private strokeId=0;
  /** 终章由关卡接入组合判定；null表示尚未接入。本接口不触发伤害或演出。 */
  yongJudge: ((pts:readonly number[],unlocked:ReadonlySet<BrushForm>)=>boolean)|null=null;
  lastYongResult:boolean|null=null;
  readonly colors:BrushColors;
  get walls(){return this.colors.walls;}
  get power(){return BRUSH_POWER[clamp(Math.floor(this.w.brushPower)-1,0,2)];}
  get protectionRemaining(){return this.releaseProtection;}
  get protected(){return this.protectionRemaining>0;}
  /** 在玩家移动前读鼠标起笔；运笔期间保持正常移动与受击。 */
  beginFrame(realDt:number):void{
    this.releaseProtection=Math.max(0,this.releaseProtection-realDt);
    const p=this.w.player;
    if(this.w.bossCombat.inputLocked)return;
    if(!this.active&&this.w.input.pressed('brush')){if(p.alive&&p.entering<=0&&p.bombT<=0&&(this.w.escort?.rescuing||this.free||p.ink>=this.w.progression.brushMods.minInk)&&this.w.input.pointer.inside)this.start();else if(p.alive)this.noInk();}

  }
  /** 按下右键但墨不足：光标旁提示一次，侧栏墨条闪一下，配一声干擦。 */
  private noInk():void{
    const p=this.w.player,at=this.w.input.pointer;this.w.audio.sfx('brush_release',{vol:.35});
    this.w.ui.popup(at.inside?at.x:p.x,(at.inside?at.y:p.y)-45,'墨不足','chain','noink');
    try{document.querySelector('[data-k="ink"]')?.animate([{filter:'brightness(1)'},{filter:'brightness(2.6) drop-shadow(0 0 8px #ff6a30)'},{filter:'brightness(1)'}],{duration:600});}catch{/* 无动画支持时只出文字 */}
  }
  private strokes: Stroke[] = [];
  private stamps: Stamp[] = [];
  /** 斩的刀光：沿笔迹一道亮白带墨色，0.25 秒收掉。 */
  private slashes: {pts:number[];t:number}[] = [];
  private readonly motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  /** 本关封印计数（结算用）。 */
  sealed = 0;

  constructor(readonly w: World) {this.colors=new BrushColors(w);this.paths=new BrushPaths(w);}

  update(realDt: number): void {
    const w = this.w, p = w.player, inp = w.input;
    if(w.bossCombat.inputLocked)return;
    if (this.active) {
      const points=inp.pointerSamples.splice(0);points.push(inp.pointer.x,inp.pointer.y);
      for(let i=0;i<points.length;i+=2)this.sample(points[i],points[i+1]);
      if(!inp.down('brush'))this.sample(inp.pointer.x,inp.pointer.y,true);
      if (!inp.down('brush') || (p.ink <= 0&&!w.escort?.rescuing&&!this.free) || this.length>=this.power.maxLength || !p.alive) this.release();
    }
    if(!this.active)inp.pointerSamples.length=0;
    this.colors.update(realDt,w.dt);this.paths.update(w.dt);
    for (const s of this.strokes) s.t += realDt;
    this.strokes = this.strokes.filter((s) => s.t < s.dur);
    for (const s of this.stamps) s.t += realDt;
    this.stamps = this.stamps.filter((s) => s.t < 1.6);
    for (const s of this.slashes) s.t += realDt;
    this.slashes = this.slashes.filter((s) => s.t < SLASH_LIFE);
  }

  private sample(x:number,y:number,force=false):void {
    const n=this.pts.length,lx=this.pts[n-2],ly=this.pts[n-1],d=Math.hypot(x-lx,y-ly);if(d===0||(!force&&d<STEP))return;
    const p=this.w.player,cost=this.w.allSkills||this.w.escort?.rescuing||this.free?0:INK_PER_UNIT*this.w.progression.brushMods.costScale;
    const length=Math.min(d,this.power.maxLength-this.length,(cost?p.ink/cost:Infinity));if(length<=0)return;
    const count=Math.max(1,Math.ceil(length/STEP));for(let i=1;i<=count;i++)this.pts.push(lx+(x-lx)/d*length*i/count,ly+(y-ly)/d*length*i/count);
    this.length+=length;p.ink=Math.max(0,p.ink-length*cost);
    this.w.r.fluid.splat({x:this.pts.at(-2)!,y:this.pts.at(-1)!,r:9,ink:[.02,.02,.02,.6]});
  }
  private start(): void {
    const p=this.w.player,queued=this.w.input.pointerSamples,at=queued.length>=2?{x:queued[0],y:queued[1]}:this.w.input.pointer;
    this.active=true;this.t=0;this.length=0;this.releaseProtection=0;this.pts=[at.x,at.y];
    const candidates:{kind:'player'|'chiyan'|'laodun';distance:number}[]=[];
    const distance=Math.hypot(at.x-p.x,at.y-p.y);if(distance<=50)candidates.push({kind:'player',distance});
    for(const s of this.w.companions.team)if(s.kind==='chiyan'||s.kind==='laodun'){const d=Math.hypot(at.x-s.x,at.y-s.y);if(d<=50)candidates.push({kind:s.kind,distance:d});}
    this.origin=candidates.sort((a,b)=>a.distance-b.distance)[0]?.kind??null;
    if(this.w.brushPower>1)this.w.progression.trigger('bili',at.x,at.y);
    if(this.w.escort?.rescuing)this.origin=null;
    this.w.audio.sfx('brush_start');this.w.audio.sfx('brush_loop',{vol:.5});
  }

  cancel(): void {
    this.w.audio.stopSfx?.('brush_loop');
    this.active = false;
    this.pts = [];this.releaseProtection=0;
  }

  private release(): void {
    this.w.audio.stopSfx?.('brush_loop');this.w.audio.sfx('brush_release');
    this.active = false;
    const pts = this.pts;
    this.pts = [];
    if(this.length<40){this.releaseProtection=0;return;}
    if(this.w.player.alive&&this.length>=120)this.releaseProtection=.3;
    this.strokes.push({ pts, t: 0, dur: 0.9,route:!!this.origin,color:this.w.player.weapon });
    this.resolve(pts);
  }

  private resolve(pts: number[]): void {
    const w = this.w,cast=this.colors.cast(pts);
    this.lastYongResult=w.stageIndex===4&&this.yongJudge?this.yongJudge(pts,w.brushForms):null;
    const n = pts.length / 2;

    if(this.origin){
      this.lastForm=this.origin==='player'?'墨矢航迹':this.origin==='chiyan'?'赤燕航迹':'老盾护盾墙';
      this.lastStroke={id:++this.strokeId,form:this.lastForm,pts:pts.slice()};
      if(this.origin==='player')this.paths.arrows(pts,[6,8,10][this.power.level-1],cast);
      else if(this.origin==='chiyan')this.paths.chiyan(pts,cast);
      else this.colors.wall(pts,cast,true);
      w.ui.popup(pts[0],pts[1]-35,this.lastForm,'chain');return;
    }

    // ---- 斩：沿笔画 ----
    let slashed = 0, erased = 0;
    const hitSet = new Set<Enemy>(),hitAngle = new Map<Enemy,number>();
    for (const e of w.enemies) {
      if (!w.targetable(e)) continue;
      const rr = (e.radius + w.progression.brushMods.width) ** 2;
      for (let i = 0; i < n - 1; i++) {
        if (segDist2(e.x, e.y, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3]) < rr) {
          hitSet.add(e);hitAngle.set(e,Math.atan2(pts[i * 2 + 3] - pts[i * 2 + 1], pts[i * 2 + 2] - pts[i * 2]));
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
    // 人手留口：直径比例容差，或绕几何中心转过约300度（抖动容差15度）。
    // 正反转抵消，细长笔画保留横/竖识别；闭合后仍以目标当前中心入圈结算。
    if (n > 12) {
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(let k=0;k<n;k++){minX=Math.min(minX,pts[k*2]);maxX=Math.max(maxX,pts[k*2]);minY=Math.min(minY,pts[k*2+1]);maxY=Math.max(maxY,pts[k*2+1]);}
      const width=maxX-minX,height=maxY-minY,diameter=Math.max(width,height),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
      let turn=0;
      for(let k=1;k<n;k++){const before=Math.atan2(pts[k*2-1]-cy,pts[k*2-2]-cx),after=Math.atan2(pts[k*2+1]-cy,pts[k*2]-cx);turn+=Math.atan2(Math.sin(after-before),Math.cos(after-before));}
      const gap=Math.hypot(pts[0]-pts[n*2-2],pts[1]-pts[n*2-1]);
      if(Math.min(width,height)>=diameter*.45&&(gap<=diameter*.4||Math.abs(turn)>=Math.PI*(300-15)/180))loops.push(pts.slice());
    }

    const closed=loops.some(poly=>polyArea(poly)>=6000);
    const identified=closed?null:identifyStroke(pts);
    const form=identified&&w.brushForms.has(identified)?identified:null;
    for (const b of w.bullets.list) {
      if(closed)break;
      if (b.dead || b.hard || b.delay>0) continue;
      const rr = (b.radius + w.progression.brushMods.width) ** 2;
      for (let i = 0; i < n - 1; i++) {
        if (segDist2(b.x, b.y, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3]) < rr) {
          w.bulletToGold(b);
          erased++;
          break;
        }
      }
    }

    this.lastForm=closed?'封':form??'斩';
    this.lastStroke={id:++this.strokeId,form:this.lastForm,pts:pts.slice()};
    if(form)w.ui.popup(w.player.x,w.player.y-55,form==='横'?'横 · 墨堤':'竖 · 贯','seal','brush:form');
    if(form==='竖')this.paths.spear(pts,cast);
    if(form==='横')this.colors.wall(pts,cast);
    if(!closed&&!form)this.slashes.push({pts:pts.slice(),t:0});
    let sealedEnemies = 0, sealedBullets = 0, rewardedEnemies=0;
    const sealSet=new Set<Enemy>(),freshTargets:Enemy[]=[];
    let hasBoss=false;
    for (const poly of loops) {
      const area = polyArea(poly);
      if (area < 6000) continue;
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
        if (sealSet.has(e)||!w.targetable(e) || !pointInPoly(e.x, e.y, poly)) continue;
        sealSet.add(e);sealedEnemies++;hitSet.delete(e);
        hasBoss ||= this.colors.boss(e);
        if(this.colors.seal(e,cast,freshTargets.length)){rewardedEnemies++;freshTargets.push(e);}
      }
      for (const b of w.bullets.list) {
        if (b.dead || b.hard || !pointInPoly(b.x, b.y, poly)) continue;
        b.dead=true;this.paths.drops.push({x:b.x,y:b.y});
        sealedBullets++;
      }
      // 印章与演出
      const size = Math.sqrt(area);
      this.stamps.push({ x: cx, y: cy, scale: Math.min(1.5, Math.max(0.35, size / 256 * 1.2)), t: 0,
        rot: (Math.random() - 0.5) * Math.PI / 30, reduced: this.motionPreference.matches,color:cast.color,radius:size*.55,white:true });
      w.fx.shockwave(cx, cy, size * 1.1, 14, 0.6);
      const color=BRUSH_COLORS[cast.color];
      w.r.fluid.splat({ x: cx, y: cy, r: size * 0.35, radial: true, vx: 500, ink: [0.04, 0.02, 0.04, 0.55], glow: color });
      for (let k = 0; k < 90 * w.fx.density; k++) {
        const x = minX + Math.random() * (maxX - minX), y = minY + Math.random() * (maxY - minY);
        if (!pointInPoly(x, y, poly)) continue;
        w.fx.emit({ x, y, vx: (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 120, drag: 1.2, grav: 90, life: 1.6, size: 5, spin: 5, rot: Math.random() * 6, r: color[0]*.5, g: color[1]*.5, b: color[2]*.5, a: 0.95, kind: PK.Petal });
        w.fx.emitHigh({ x, y, vx: (Math.random() - 0.5) * 200, vy: -150 - Math.random() * 200, drag: 2, life: 1.1, size: 3, spin: 9, r: color[0], g: color[1], b: color[2], kind: PK.Leaf });
      }
      w.audio.sfx('seal',{vol:hasBoss?1.1:.8});
      w.audio.sfx(cast.color==='blue'?'swap_blue':cast.color==='red'?'hit_red':'hit_purple',{vol:.5});
    }
    if(closed){this.colors.network(freshTargets,cast);this.colors.sealImpact(sealedEnemies,hasBoss);}
    this.sealed += sealedEnemies + sealedBullets;

    // 斩击伤害（未被封印的）
    for (const e of hitSet) {
      slashed++;
      if(!closed&&form!=='竖')this.colors.damage(e,70,cast);
      if(!closed&&!form)w.fx.slashSpark(e.x,e.y,hitAngle.get(e)??0);
      else w.fx.hit(e.x, e.y, BRUSH_COLORS[cast.color], 10);
      w.r.fluid.splat({ x: e.x, y: e.y, r: 20, radial: true, vx: 300, ink: [0.02, 0.015, 0.015, 0.6] });
    }
    if (slashed) {w.audio.sfx('slash');if(!closed&&!form)w.hitstop(.05);}
    // 笔锋墨迹注入流体：顺着笔势甩出
    for (let k = 0; k < n - 1; k += 3) {
      const x = pts[k * 2], y = pts[k * 2 + 1];
      const dx = pts[k * 2 + 2] - x, dy = pts[k * 2 + 3] - y;
      const l = Math.hypot(dx, dy) || 1;
      w.r.fluid.splat({ x, y, r: 11, vx: (dx / l) * 700, vy: (dy / l) * 700, ink: [0.012, 0.01, 0.01, 0.55], glow: BRUSH_COLORS[cast.color] });
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
      w.addScore((rewardedEnemies * 3000 + sealedBullets * 200));
    }
    if (slashed) w.ui.popup(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1] - 30, `斩 ×${slashed}`, 'chain');
    w.progression.onBrushRelease(pts, slashed, erased + sealedBullets, sealedEnemies);
    w.combos.record('brushRelease');
    if (sealedEnemies || sealedBullets) w.combos.record('seal');
  }

  draw(r: Renderer, time: number): void {
    this.colors.draw();

    const cin=BRUSH_COLORS[this.w.player.weapon];
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
      const cin=BRUSH_COLORS[s.color];
      const u = s.t / s.dur;
      if(s.route){r.ribbonTop.strip(s.pts,2,RS.InkTrail,.05,.06,.06,.35*(1-u));continue;}
      const n = s.pts.length / 2;
      const wd = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const head = Math.min(1, i / 5), tail = Math.min(1, (n - 1 - i) / 5);
        wd[i] = HALF_W * (1 + 0.6 * (1 - u)) * (0.3 + 0.7 * Math.min(head, tail));
      }
      const hot = Math.max(0, 1 - u * 6);
      r.ribbonTop.strip(s.pts, wd, RS.Brush, cin[0] + hot * 2, cin[1] + hot * 1.6, cin[2] + hot, 1 - u * u);
    }
    for (const s of this.slashes) {
      const n = s.pts.length / 2, u = s.t / SLASH_LIFE;
      const wd = new Float32Array(n), dark = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const taper = Math.sin(Math.PI * (i + .5) / n) ** .6;
        wd[i] = HALF_W * .75 * (1 - u * .7) * taper;
        dark[i] = wd[i] * 2.1;
      }
      r.ribbonTop.strip(s.pts, dark, RS.InkArrow, .03, .025, .035, .75 * (1 - u));
      r.ribbonTop.strip(s.pts, wd, RS.Brush, 2.6, 2.6, 2.8, Math.min(1, (1 - u) * 1.6));
    }
    for (const s of this.stamps) {
      const scale=s.scale*(s.reduced?1:1+.6*(1-clamp(s.t/.1,0,1)));
      const a=Math.min(1,(1.6-s.t)/.5);
      const color=BRUSH_COLORS[s.color];
      const radius=s.radius*(s.reduced?1:1-.2*clamp(s.t/.1,0,1));
      const ring:number[]=[];for(let i=0;i<=40;i++){const q=i/40*Math.PI*2;ring.push(s.x+Math.cos(q)*radius,s.y+Math.sin(q)*radius);}
      r.ribbonTop.strip(ring,7,RS.InkArrow,.035,.025,.04,a*.65);
      r.ribbonTop.strip(ring,3,RS.InkHalo,...color,a*.8);
      if(s.white&&s.t<.15){r.bullets.add(s.x,s.y,0,s.radius,0,2,2,2,.55,0,0);s.white=false;}
      const stampAlpha=Math.max(0,1-Math.max(0,s.t-.1)/.1);
      r.top.add('fx_seal',{x:s.x,y:s.y,rot:s.rot,sx:scale,sy:scale,alpha:stampAlpha*.92,glow:.35,flash:!s.reduced&&s.t<.1?.6:0});
    }
    this.paths.draw();
  }

  clear(): void {
    this.cancel();this.paths.clear();
    this.strokes = [];
    this.lastStroke=null;
    this.stamps = [];this.slashes = [];this.colors.clear();this.lastYongResult=null;this.yongJudge=null;
  }
}
