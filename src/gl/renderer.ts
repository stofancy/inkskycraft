import { ElementalVfx } from './elemental-vfx';
import { MantraGlyphs } from './mantra-glyphs';
import { SpellLayer } from './spell';
// 渲染总调度：管理画布尺寸、游戏区视口、各渲染层与固定的绘制顺序。
import { ALL_SPRITES } from '../art/index';
import { BG_HEADER, FRAME_HEADER, type BgDef, type Vec4 } from '../bg/header';
import { BACKGROUNDS, FRAME_FRAG } from '../bg/index';
import { SkyGroundLayer } from '../bg/sky-scene';
import { PLAY_H, PLAY_W, type Rect, type Settings } from '../types';
import { Atlas } from './atlas';
import { BulletRenderer } from './bullets';
import { DebrisSystem } from './debris';
import { FireballSystem } from './fireball';
import { Fluid } from './fluid';
import { LightBuffer } from './lightbuf';
import { ParticleSystem } from './particles';
import { Post } from './post';
import { RibbonBatch, RibbonRenderer, RS } from './ribbons';
import { GpuTimer, Lights, Scene3D } from './scene3d';
import { SpriteRenderer, type SpriteLayer } from './sprites';
import { ThunderSystem } from './thunder';
import { LeichiSystem } from './leichi';
import { ImpactSystem } from './impact';
import { InkBursts } from './ink-bursts';
import { MoveTitles } from './move-titles';
import { FS_TRI_VS, Program, Target, fullscreen, type GL } from './util';

/** 各关日光（屏幕空间：x 右，y 上，z 朝向观者；与 scene3d 各关 sunDir() 一致），供火球与碎片受光。 */
const SUN: Record<string, { dir: [number, number, number]; col: [number, number, number]; amb: [number, number, number] }> = {
  stage1: { dir: norm3(-0.78, 0.12, 0.48), col: [1.0, 0.98, 0.92], amb: [0.62, 0.64, 0.68] },
  stage2: { dir: norm3(-0.5, -0.35, 0.72), col: [0.55, 0.68, 1.0], amb: [1.1, 1.3, 1.8] },
  stage3: { dir: norm3(-0.55, -0.45, 0.75), col: [1.0, 1.0, 1.0], amb: [0.6, 0.6, 0.6] },
  title: { dir: norm3(-0.78, 0.12, 0.48), col: [1.0, 0.98, 0.92], amb: [0.5, 0.5, 0.5] },
};
function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

interface BgProgs { def: BgDef; bg: Program | null; fg: Program | null; s3: Scene3D | null }

export class Renderer {
  readonly gl: GL;
  readonly atlas: Atlas;
  sprites!: SpriteRenderer;
  bullets!: BulletRenderer;
  ribbons!: RibbonRenderer;
  fluid!: Fluid;
  post!: Post;
  /** 低层粒子（墨滴、烟），在空中敌机之下。 */
  partLow!: ParticleSystem;
  /** 高层粒子（火花、余烬），在敌弹之下、其余之上。 */
  partHigh!: ParticleSystem;
  /** 机身粒子独立限额、时钟与判定点留白。 */
  playerFx!: ParticleSystem;
  /** 体积火球（爆炸），叠在空中敌机之上、玩家子弹之下。 */
  fireballs!: FireballSystem;
  /** 三维甲片碎块，独立深度缓冲保证翻滚时的自遮挡。 */
  debris!: DebrisSystem;
  /** 带三维截面、前后扭折与受光面的雷弧。 */
  thunder!: ThunderSystem;
  leichi!: LeichiSystem;
  impact!: ImpactSystem;
  inkBursts!: InkBursts;
  moveTitles!: MoveTitles;
  mantraGlyphs!:MantraGlyphs;
  elemental!:ElementalVfx;
  /** 泼墨施法的屏幕层（暗角、字、立绘笔触、火墙）。 */
  spell!:SpellLayer;
  /** 泼墨墨浪期间让流体按真实时间推进。 */
  fluidReal=false;
  mantraZoom=1;mantraInk=0;mantraDim=1;mantraShake:[number,number]=[0,0];
  /** 弹光缓冲（1/4 分辨率 HDR）：弹幕、激光、爆炸的柔光，供 3D 背景采样。 */
  lightBuf!: LightBuffer;
  /** 弹光缓冲进入 3D 背景光照的强度。 */
  lightBufK = 0.6;
  /** 玩家子弹的光色（随武器切换）。 */
  shotLight: [number, number, number] = [1.0, 0.42, 0.28];

  // 各层（每帧由游戏填充，渲染后清空）
  ground!: SkyGroundLayer;
  shadows!: SpriteLayer;
  air!: SpriteLayer;
  shots!: SpriteLayer;   // 玩家子弹（加色）
  shotArt!: SpriteLayer; // 玩家主炮原画与命中（带透明，普通混合）
  player!: SpriteLayer;
  items!: SpriteLayer;
  top!: SpriteLayer;     // 印章等最上层
  ribbonPlayer = new RibbonBatch(); // 贴合机翼的表面辉光，位于玩家精灵与敌弹之间
  ribbonGround = new RibbonBatch(); // 重炮驻留纹样，在空中敌机下方
  ribbonMid = new RibbonBatch();  // 激光、雷弧（在空中敌机之上）
  ribbonTop = new RibbonBatch();  // 一笔墨迹、敌方激光（最上层）

  /** 动态光源（3D 背景读取）：爆炸等调用 lights.pulse，激光/枪口光由 render() 从光带与子弹层推得。 */
  readonly lights = new Lights();
  /** 调试：设置后 render() 记录背景与整帧 GPU 耗时到 timer.ms.bg / timer.ms.frame。 */
  timer: GpuTimer | null = null;
  /** 开启 GPU 计时（调试/压测用）：only='bg' 只测背景，'frame' 测整帧。结果在 timer.ms。 */
  startTimer(only: 'bg' | 'frame'): GpuTimer {
    this.timer = new GpuTimer(this.gl);
    this.timer.only = only;
    return this.timer;
  }
  quality: 'high' | 'ultra' = 'ultra';
  private lastReal = 0;
  scene!: Target;
  private mantraWash!:Program;
  private frameProg!: Program;
  private bgs = new Map<string, BgProgs>();
  bgId = 'title';
  bgParams: Vec4[] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  tint: [number, number, number] = [0.6, 0.05, 0.02];

  /** 游戏区在画布中的像素矩形（原点左上）与 CSS 矩形。 */
  playPx: Rect = { x: 0, y: 0, w: 1, h: 1 };
  playCss: Rect = { x: 0, y: 0, w: 1, h: 1 };
  renderScale = 1;
  onResize: (() => void) | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('需要 WebGL2');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('需要 EXT_color_buffer_float');
    gl.getExtension('EXT_float_blend');
    gl.getExtension('OES_texture_float_linear');
    this.gl = gl;
    this.atlas = new Atlas(gl);
  }

  gpuName(): string {
    const gl = this.gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  }

  async init(settings: Settings, onProgress: (p: number) => void): Promise<void> {
    const gl = this.gl;
    this.renderScale = Math.max(1, settings.renderScale);
    this.quality = settings.quality;
    // 公共图集固定两倍密度，小机体通过textureScale保留原帧。
    // DPR提升渲染缓冲分辨率；整套文字和素材同步超采样会占用数倍显存。
    const texScale = 2;
    await this.atlas.build(ALL_SPRITES, texScale, (p) => onProgress(p * 0.85));
    this.sprites = new SpriteRenderer(gl, this.atlas);
    this.bullets = new BulletRenderer(gl);
    this.ribbons = new RibbonRenderer(gl);
    const ultra = settings.quality === 'ultra';
    this.fluid = new Fluid(gl, settings.quality);
    this.post = new Post(gl);
    this.partLow = new ParticleSystem(gl, ultra ? 262144 : 131072);
    this.partHigh = new ParticleSystem(gl, ultra ? 524288 : 196608);
    this.playerFx = new ParticleSystem(gl, 800);
    this.fireballs = new FireballSystem(gl);
    this.debris = new DebrisSystem(gl);
    this.thunder = new ThunderSystem(gl);
    this.leichi = new LeichiSystem(gl);
    this.impact = new ImpactSystem(gl);
    this.fireballs.quality = 1;
    this.fireballs.scale = 1;
    this.lightBuf = new LightBuffer(gl);
    this.ground = new SkyGroundLayer(this.atlas);
    this.shadows = this.sprites.layer();
    this.air = this.sprites.layer();
    this.shots = this.sprites.layer(4096);
    this.shotArt = this.sprites.layer(1024);
    this.player = this.sprites.layer(64);
    this.items = this.sprites.layer();
    this.top = this.sprites.layer(64);
    this.inkBursts = new InkBursts(this.sprites.layer(128));
    this.mantraGlyphs=new MantraGlyphs(gl);
    this.elemental=new ElementalVfx(gl);
    this.spell=new SpellLayer(gl);
    this.moveTitles = new MoveTitles(this.sprites.layer(1));
    this.mantraWash=new Program(gl,FS_TRI_VS,`#version 300 es
precision highp float;uniform float dim;out vec4 o;void main(){o=vec4(vec3(dim),1.);}`);
    this.frameProg = new Program(gl, FS_TRI_VS, FRAME_HEADER + FRAME_FRAG);
    this.scene = new Target(gl, 4, 4, 'rgba16f');
    onProgress(0.9);
    // 预编译所有背景，避免关卡切换时卡顿
    for (const id of Object.keys(BACKGROUNDS)) this.bgProgs(id);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    onProgress(1);
  }

  private bgProgs(id: string): BgProgs {
    let p = this.bgs.get(id);
    if (!p) {
      const def = BACKGROUNDS[id] ?? BACKGROUNDS.title;
      p = {
        def,
        bg: def.frag ? new Program(this.gl, FS_TRI_VS, BG_HEADER + def.frag) : null,
        fg: def.fg ? new Program(this.gl, FS_TRI_VS, BG_HEADER + def.fg) : null,
        s3: def.scene3d ? new Scene3D(this.gl, def.scene3d, this.quality) : null,
      };
      this.bgs.set(id, p);
    }
    return p;
  }

  setBackground(id: string): void {
    this.bgId = id;
    const sun = SUN[id] ?? SUN.stage1;
    this.fireballs.sun = sun.dir;
    this.fireballs.sunCol = sun.col;
    this.fireballs.amb = sun.amb;
    this.debris.sun = sun.dir;
    this.debris.sunCol = sun.col;
    this.debris.amb = sun.amb;
    for (const ps of [this.partLow, this.partHigh]) { ps.sun = sun.dir; ps.sunCol = sun.col; ps.amb = sun.amb; }
    const def = this.bgProgs(id).def;
    const P = def.params ?? {};
    this.bgParams = [
      [...(P.p0 ?? [0, 0, 0, 0])] as Vec4, [...(P.p1 ?? [0, 0, 0, 0])] as Vec4,
      [...(P.p2 ?? [0, 0, 0, 0])] as Vec4, [...(P.p3 ?? [0, 0, 0, 0])] as Vec4,
    ];
    const t = def.tint ?? 0xd8391f;
    this.tint = [(t >> 16) & 255, (t >> 8) & 255, t & 255].map((v) => Math.pow(v / 255, 2.2)) as [number, number, number];
    this.resizeBg();
  }

  /** 画质档：3D 背景的分辨率倍率与雾步数随之变化（其余由 init 时决定）。 */
  setQuality(q: 'high' | 'ultra'): void {
    if (q === this.quality) return;
    this.quality = q;
    this.fireballs.quality = 1;
    this.fireballs.scale = 1;
    this.fireballs.resize(this.playPx.w, this.playPx.h);
    for (const p of this.bgs.values()) p.s3?.setQuality(q);
    this.resizeBg();
  }

  setRenderScale(s: number): void {
    // 旧设置可低至 0.5；画面至少按屏幕实际像素绘制。
    this.renderScale = Math.max(1, s);
    this.resize();
  }

  resize(): void {
    const dpr = (window.devicePixelRatio || 1) * this.renderScale;
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const cw = Math.max(1, Math.round(cssW * dpr)), ch = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    // 游戏区 3:4，尽量占满高度
    let ph = cssH, pw = ph * 0.75;
    if (pw > cssW) { pw = cssW; ph = pw / 0.75; }
    this.playCss = { x: (cssW - pw) / 2, y: (cssH - ph) / 2, w: pw, h: ph };
    this.playPx = {
      x: Math.round(this.playCss.x * dpr), y: Math.round(this.playCss.y * dpr),
      w: Math.round(pw * dpr), h: Math.round(ph * dpr),
    };
    this.scene.resize(this.playPx.w, this.playPx.h);
    this.post.resize(this.playPx.w, this.playPx.h);
    this.elemental?.resize(this.playPx.w,this.playPx.h);
    this.fireballs?.resize(this.playPx.w, this.playPx.h);
    this.lightBuf?.resize(this.playPx.w, this.playPx.h);
    this.resizeBg();
    this.onResize?.();
  }

  private resizeBg(): void {
    if (!this.scene) return;
    const P = this.bgProgs(this.bgId);
    P.s3?.resize(this.playPx.w, this.playPx.h);
  }

  private setBgUniforms(p: Program, w: number, h: number, time: number, scroll: number, beat: number, flash: number): void {
    p.use().set('uRes', w, h).set('uTime', time).set('uScroll', scroll).set('uBeat', beat).set('uFlash', flash)
      .set('uP0', this.bgParams[0]).set('uP1', this.bgParams[1]).set('uP2', this.bgParams[2]).set('uP3', this.bgParams[3]);
  }

  /**
   * 渲染一帧。time = 游戏时间（受子弹时间影响），real = 真实时间。
   */
  render(time: number, real: number, scroll: number, beat: number, bgFlash: number, fluidDt: number, visualTime=time): void {
    const gl = this.gl;
    const P = this.bgProgs(this.bgId);
    this.fireballs.realTime=real;
    this.partLow.time = visualTime;
    this.partHigh.time = visualTime;
    this.sprites.time = time;

    const tm = this.timer;
    if (tm && tm.only === 'frame') tm.begin('frame');
    // 顿帧期间墨浪仍按真实时间注入，暂停时 real 不前进。
    this.fluid.step(this.mantraDim<1||this.fluidReal?Math.min(1/30,Math.max(0,real-this.lastReal)):fluidDt);
    // 1. 背景
    gl.disable(gl.BLEND);
    if (tm && tm.only === 'bg') tm.begin('bg');
    if (P.s3) {
      this.collectLights(real);
      this.buildLightBuf(time);
      P.s3.render(this.scene, { time, scroll, beat, flash: bgFlash, params: this.bgParams, lightTex: this.lightBuf.target.tex, lightK: this.lightBufK }, this.lights);
      this.lights.endFrame();
    } else {
      const bgT = this.scene;
      bgT.bind();
      this.setBgUniforms(P.bg!, bgT.w, bgT.h, time, scroll, beat, bgFlash);
      fullscreen(gl);
    }
    if (tm && tm.only === 'bg') tm.end();

    this.scene.bind();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const S = this.sprites;
    // 先压暗背景；随后绘制的战斗对象、亮芯、敌弹保持本身亮度。
    if(this.mantraDim<1){this.scene.bind();gl.enable(gl.BLEND);gl.blendFunc(gl.ZERO,gl.SRC_COLOR);this.mantraWash.use().set('dim',this.mantraDim);fullscreen(gl);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}
    // 2. 地面单位 → 3. 空中单位投影 → 4. 墨流体 → 5. 低层粒子
    S.draw(this.ground.scenery);
    // 天气盖过背景景物，玩家、敌机及双方子弹随后绘制。
    if (P.fg) {
      this.setBgUniforms(P.fg, this.scene.w, this.scene.h, time, scroll, beat, bgFlash);
      fullscreen(gl);
    }
    S.draw(this.ground);
    S.draw(this.shadows, 1, [26, 44], 0.92);
    this.fluid.composite(time, 1.6);
    this.partLow.draw();
    // 6. 空中敌机 → 7. 玩家子弹与光带 → 8. 玩家 → 9. 道具
    this.ribbons.draw(this.ribbonGround, time);
    this.elemental.draw(this.scene,true);
    S.draw(this.air);
    this.debris.draw(visualTime, this.scene);
    this.fireballs.draw(visualTime, this.scene);
    this.inkBursts.draw(visualTime);
    S.draw(this.inkBursts.layer);
    this.inkBursts.layer.clear();
    this.elemental.draw(this.scene,false);
    S.draw(this.shotArt);
    S.draw(this.shots, 2);
    this.ribbons.draw(this.ribbonMid, time);
    this.thunder.draw(visualTime, this.scene);
    this.playerFx.draw();
    S.draw(this.player);
    this.ribbons.draw(this.ribbonPlayer, time);
    this.impact.draw(visualTime, this.scene);
    S.draw(this.items);
    this.mantraGlyphs.draw();
    this.spell.drawBack(real);
    this.spell.drawGlyphs(real);
    // 11. 高层粒子 → 12. 敌弹 → 13. 一笔与敌方激光 → 14. 印章
    this.partHigh.draw();
    this.moveTitles.draw(real);
    S.draw(this.moveTitles.layer);
    this.moveTitles.layer.clear();
    this.leichi.draw();
    this.bullets.draw(time);
    this.ribbons.draw(this.ribbonTop, time);
    this.spell.drawTop(real);
    S.draw(this.top);
    gl.disable(gl.BLEND);

    // 边框（整张画布），然后游戏区后处理
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const pp = this.playPx;
    const flipY = this.canvas.height - pp.y - pp.h;
    this.frameProg.use().set('uRes', this.canvas.width, this.canvas.height)
      .set('uPlay', pp.x, flipY, pp.w, pp.h).set('uTime', real).set('uBeat', beat).set('uTint', this.tint).set('uFlash', bgFlash * 0.3);
    fullscreen(gl);
    const zoom=this.post.zoom,shake=this.post.shake,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.post.zoom=zoom*(reduced?1:this.mantraZoom);this.post.shake=reduced?[0,0]:[shake[0]+this.mantraShake[0],shake[1]+this.mantraShake[1]];this.post.mantraInk=this.mantraInk;
    this.post.render(this.scene, real, pp.x, flipY, pp.w, pp.h);
    this.post.zoom=zoom;this.post.shake=shake;

    for (const l of [this.ground, this.shadows, this.air, this.shots, this.shotArt, this.player, this.items, this.top]) l.clear();
    this.ribbonGround.clear();
    this.ribbonMid.clear();
    this.ribbonPlayer.clear();
    this.ribbonTop.clear();
    this.thunder.clear();
    this.elemental.clear();
    this.impact.clear();
    this.bullets.clear();
    if (tm) { if (tm.only === 'frame') tm.end(); tm.poll(); }
  }

  /** 弹光缓冲：把敌弹、玩家子弹、激光、火球画成柔光斑（背景之前）。 */
  private buildLightBuf(time: number): void {
    const LB = this.lightBuf;
    const B = this.bullets, BD = B.data;
    for (let i = 0; i < B.count; i++) {
      const o = i * 12, a = BD[o + 9] * 0.5;
      LB.blob(BD[o], BD[o + 1], BD[o + 3] * 3.4 + 10, BD[o + 5] * a, BD[o + 6] * a, BD[o + 7] * a);
    }
    const sl = this.shotLight;
    for (const S of [this.shots, this.shotArt]) for (let i = 0, SD = S.data; i < S.count; i++) LB.blob(SD[i * 16], SD[i * 16 + 1], 46, sl[0] * 0.3, sl[1] * 0.3, sl[2] * 0.3);
    const beams = (b: RibbonBatch): void => b.scanSegments(RS.Beam, (ax, ay, bx, by, r, g, bl, a) => {
      if (a >= 0.3) LB.seg(ax, ay, bx, by, 70, r * a * 0.5, g * a * 0.5, bl * a * 0.5);
    });
    beams(this.ribbonMid);
    beams(this.ribbonTop);
    this.fireballs.forEachGlow(time, (x, y, r, cr, cg, cb) => LB.blob(x, y, r * 1.6, cr * 0.25, cg * 0.25, cb * 0.25));
    LB.flush();
  }

  /** 推进衰减光，并从光带（激光）与玩家子弹层推出本帧的动态光源。 */
  private collectLights(real: number): void {
    const L = this.lights;
    L.tick(Math.min(0.1, Math.max(0, real - this.lastReal)));
    this.lastReal = real;
    // 激光：沿线段每 ~240 单位一盏
    const beams = (b: RibbonBatch, k: number): void => {
      b.scanSegments(RS.Beam, (ax, ay, bx, by, r, g, bl, a) => {
        if (a < 0.3) return;
        const len = Math.hypot(bx - ax, by - ay);
        const n = Math.min(6, Math.max(1, Math.round(len / 240)));
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n;
          L.add(ax + (bx - ax) * u, ay + (by - ay) * u, 150, r * a * k, g * a * k, bl * a * k);
        }
      });
    };
    beams(this.ribbonMid, 0.25);
    beams(this.ribbonTop, 0.35);
    // 枪口光：最靠近玩家（y 最大）的两发玩家子弹
    let y1 = -1e9, x1 = 0, y2 = -1e9, x2 = 0;
    for (const S of [this.shots, this.shotArt]) for (let i = 0, D = S.data; i < S.count; i++) {
      const x = D[i * 16], y = D[i * 16 + 1];
      if (y > y1) { y2 = y1; x2 = x1; y1 = y; x1 = x; } else if (y > y2) { y2 = y; x2 = x; }
    }
    if (y1 > -1e8) L.add(x1, y1, 110, 0.45, 0.28, 0.18);
    if (y2 > -1e8) L.add(x2, y2, 110, 0.3, 0.19, 0.12);
  }
}

export { PLAY_W, PLAY_H };
