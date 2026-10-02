// 通用 3D 背景基础设施（俯视透视摄像机 + 高度场地形 + 实例化模型 + 动态点光 + 体积雾 + 水墨合成）。
//
// 一个 3D 关卡背景 = 一个 `Bg3D`（本文件定义）：一段 GLSL（地形高度函数、材质、雾密度、配色钩子）
// + 若干实例化模型。BgDef.scene3d 指向它，Renderer 在步骤 1（背景）里改走 Scene3D.render。
//
// ── 世界与摄像机 ─────────────────────────────────────────────────────────────
//   世界坐标 (x, y, z)：x 0..900 与游戏区同宽；y 向上并随 uScroll 增长（与 2D 背景的世界 y 一致：
//   屏幕 y_up 处的地面点世界 y = uScroll + y_up）；z 向上，z=0 为「地面参考平面」。
//   摄像机在 (450, uScroll + 600 - CAM_S, 1600)（游戏区南侧、高 1600），成像平面平行于地面，用非对称视锥
//   （移轴）把 z=0 平面恰好框满游戏区：fovY = 2·atan(600/1600)，clip.y 里减去 CAM_S/600·w。
//   因此 z=0 平面到屏幕是线性 1:1 并 1:1 随 uScroll 滚动 —— 地面敌人（e_turtle 等）坐在 z=0 上，
//   所以「地面单位经过的地方，地形高度必须贴近 0」。z>0 的山峰更近、放大、滚动更快（真实视差），
//   并向屏幕上方偏移 ≈ z·CAM_S/(1600−z)（z=300 时约 320 单位），因此能看到朝南的山体立面。
//   注意遮挡：地面敌人是 2D 精灵永远盖在背景上，其正南方（同 x）不要有高于射线的地形。
//   不要做随玩家的摄像机平移/倾斜。屏幕点 (sx, sy_down) 放在高度 z 处的反投影见 unproject()。
//
// ── 一帧的流程（全在 Scene3D.render）────────────────────────────────────────
//   1. 高度图烘焙：世界窗口（x -120..1020，y scroll-430..scroll+1350，1 单位 1 像素）→ RGBA16F
//      (高度, dh/dx, dh/dy, 保留)。地形 VS/FS、太阳阴影、体积雾都读这张图，所以昂贵的噪声只算一次。
//   2. 光栅化（MRT + 深度）：地形网格 → 各实例化模型。输出 color（已含光照的墨色）与
//      aux = (法线 xy, 材质 id, 线性深度 d = 1600 - z)。
//   3. 体积雾：半分辨率光线步进，读 aux 深度，受太阳（含高度图阴影）与动态光源散射。
//   4. 合成（全分辨率，写入 renderer.scene）：aux 法线/深度不连续画墨线，双边上采样雾，
//      远处/上方淡入纸色，屏幕中部压低对比（子弹可读性），叠宣纸纹理。
//
// ── Bg3D.glsl 必须定义的钩子（拼接在 SCENE_LIB 之后，可用 uP0..uP3、uTime、uScroll、uFlash、
//    noise/ridged/fbm/cun/absorb/paperCol/hexc 及下方 SCENE_LIB 里的函数）─────────────
//   float terrainH(vec2 w, int oct);     世界 (x,y) 处的地形高度（oct 为噪声倍频上限）。烘焙时调用
//                                       3 次求梯度，请保持它便宜、连续。
//   vec3  sunDir();  vec3 sunCol();  vec3 skyAmb();   太阳方向（指向太阳）、太阳与天光的线性强度
//   vec3  paperTone();  vec3 inkTone();               宣纸底色 / 墨的透射色（absorb 用）
//   vec3  shadeTerrain(vec3 p, vec3 n, float sunLit, vec3 dyn, out float mat);
//                                       地形着色，返回线性 HDR。sunLit = max(n·L,0)·阴影，
//                                       dyn = 动态光源辐照（已含 uFlash），mat 写入 aux.b（0 岩 1 水 2 径 3+ 自定义）。
//   float fogDensity(vec3 p);           世界点 p 的雾消光系数（每单位）。
// 模型（Model3D）另有 place / shade 钩子，见其注释。
//
// ── 动态光源 ────────────────────────────────────────────────────────────────
//   Lights：每帧重建的点光列表（上限 MAX_LIGHTS，按亮度取舍）。来源：
//     · Lights.pulse(...)  一次性、随时间衰减的光（爆炸、炸弹）
//     · Lights.add(...)    只亮这一帧（激光、蓄力、枪口光；每帧持续调用）
//   坐标用游戏屏幕坐标（0..900 × 0..1200，y 向下），内部按透视反投影到 z≈LIGHT_Z 的世界位置。
//   着色器里用 dynLights(p, n)（表面）与 dynLightsVol(p)（体积）读取。
import { BG_LIB } from '../bg/lib';
import { GLSL_COMMON } from '../bg/header';
import { Program, Target, FS_TRI_VS, fullscreen, type GL } from './util';

export const CAM_Z = 1600;
export const TAN_HALF = 600 / 1600;
/**
 * 摄像机相对游戏区中心向南（-y）偏移的距离。摄像机成像平面始终平行于地面（移轴/偏轴透视），
 * 所以 z=0 平面到屏幕仍是线性 1:1 映射；但高处的山被推向屏幕上方，露出朝南的山体立面（斜视立体感）。
 * z 处的点相对其地面位置在屏幕上向上偏移 ≈ z·CAM_S/(CAM_Z−z)。
 */
export const CAM_S = 1400;
/** 屏幕光源的世界高度（低空，偏移小：屏幕点被反投影到这个高度）。 */
export const LIGHT_Z = 150;
export const MAX_LIGHTS = 32;

export interface Model3D {
  /** 三角形列表，交错顶点 [x,y,z, nx,ny,nz, aux]；局部坐标 z 向上、脚底 z=0，尺寸约 1。 */
  mesh: Float32Array;
  /** 实例格：cols×rows 个格点，边长 cell（世界单位）。格点世界坐标随滚动吸附（不闪烁）。 */
  cell: number;
  cols: number;
  rows: number;
  /**
   * GLSL：`bool place(vec2 c, out vec3 pos, out float sc, out float yaw, out float rnd)`
   * c = 该格点的世界坐标；返回 false 剔除；pos 为世界位置（z 自己用 groundH 取）；
   * 局部顶点先乘 sc（世界单位/局部单位）再绕 z 旋转 yaw。rnd 传给 shade。
   */
  place: string;
  /**
   * GLSL：`vec3 shadeModel(vec3 wp, vec3 n, float aux, float rnd, float sunLit, vec3 dyn)`
   * wp 世界位置、n 世界法线、aux 顶点 aux、sunLit = max(n·L,0)·（实例脚下的地形阴影）。返回线性 HDR。
   */
  shade: string;
  /**
   * 水面倒影：为 true 时额外画一份绕 z=0 镜像的模型，alpha 混合到 z=0 水面上（不写深度、不写 aux，所以不会出墨线）。
   * 需要 Bg3D.glsl 定义：`float waterMask(vec2 w)`（世界 (x,y) 处 z=0 是否为水面，0..1）、
   * `vec2 reflWarp(vec2 wpt, vec3 wp)`（倒影落点的世界位移：波纹、艺术化的侧向偏移；wp 为镜像前的顶点世界位置）、`vec4 shadeReflect(vec3 col, vec2 wpt, vec3 wp)`
   * （col 为 shadeModel 的结果，wpt 为倒影落在水面的世界点，wp 为镜像前的世界位置；返回 rgb + 混合 alpha）。
   */
  reflect?: boolean;
}

export interface Bg3D {
  /** 共享 GLSL（见文件头的钩子清单）。 */
  glsl: string;
  models?: Model3D[];
  /** 体积雾的顶面高度 z（其上无雾），默认 240。越低越省。 */
  fogTop?: number;
  /** 摄像机南向偏移（默认 CAM_S=1400）。越大越斜，能看到更多朝南立面；z=0 平面仍与游戏区 1:1。 */
  camS?: number;
  /**
   * 可选：整段替换体积雾片元着色器（半分辨率）。可用 uAux/uSteps/uFogTop、vUv、SCENE_LIB 与 glsl 里的函数；
   * 输出 o = (预乘 rgb 辐射, 透射率 T)，合成时 col = terrain*T + rgb（默认合成，可被 compHook 覆盖）。
   */
  fogFS?: string;
  /**
   * 可选：GLSL 函数 `vec3 compHook(vec3 col, vec4 F, vec2 uv)`，替换合成里「雾叠加」一步。
   * col 为墨线后的地形色，F 为双边上采样后的雾 (rgb, T)，uv 为游戏区 0..1（原点左下）；
   * 可用 uFog / uCol / uAux 与 glsl 里的函数。返回值之后继续做淡入纸色与纸纹。默认 col*F.a+F.rgb。
   */
  compHook?: string;
  /** 体积雾目标相对光栅分辨率的缩小倍数，默认 2（半分辨率）；重型云步进可用 3。 */
  fogDiv?: number;
}

export type Quality3D = 'high' | 'ultra';

// ─────────────────────────────────────────────────────────────── 动态光源

interface L3 { x: number; y: number; r: number; cr: number; cg: number; cb: number; life: number; age: number }

export class Lights {
  private timed: L3[] = [];
  private frame: L3[] = [];
  private pool: L3[] = [];
  /** 一次性衰减光：radius 为软半径（世界单位），(r,g,b) 为线性 HDR 强度。 */
  pulse(x: number, y: number, radius: number, r: number, g: number, b: number, life: number): void {
    if (this.timed.length >= 48) this.timed.shift();
    this.timed.push({ x, y, r: radius, cr: r, cg: g, cb: b, life, age: 0 });
  }
  /** 只亮一帧的光（每帧调用）。 */
  add(x: number, y: number, radius: number, r: number, g: number, b: number): void {
    if (this.frame.length >= 96) return;
    const l = this.pool.pop() ?? { x: 0, y: 0, r: 0, cr: 0, cg: 0, cb: 0, life: 1, age: 0 };
    l.x = x; l.y = y; l.r = radius; l.cr = r; l.cg = g; l.cb = b; l.age = 0; l.life = 1;
    this.frame.push(l);
  }
  /** 推进衰减光的寿命。 */
  tick(dt: number): void {
    for (const l of this.timed) l.age += dt;
    this.timed = this.timed.filter((l) => l.age < l.life);
  }
  /** 一帧渲染完成后清掉单帧光。 */
  endFrame(): void {
    for (const l of this.frame) this.pool.push(l);
    this.frame.length = 0;
  }
  clear(): void {
    this.timed.length = 0;
    this.endFrame();
  }

  /** 按亮度取前 MAX_LIGHTS 个，写入 P（世界 xyz + 半径）与 C（rgb）。返回个数。 */
  pack(scroll: number, P: Float32Array, C: Float32Array, camS = CAM_S): number {
    const all: { l: L3; k: number; s: number }[] = [];
    for (const l of this.timed) {
      const u = 1 - l.age / l.life;
      const k = u * u;
      all.push({ l, k, s: (l.cr + l.cg + l.cb) * k * l.r });
    }
    for (const l of this.frame) all.push({ l, k: 1, s: (l.cr + l.cg + l.cb) * l.r });
    all.sort((a, b) => b.s - a.s);
    const n = Math.min(MAX_LIGHTS, all.length);
    for (let i = 0; i < n; i++) {
      const { l, k } = all[i];
      // 屏幕点（y 向下）→ 世界：z=LIGHT_Z 处按透视缩放
      const [wx, wy] = unproject(l.x, l.y, scroll, LIGHT_Z, camS);
      P[i * 4] = wx;
      P[i * 4 + 1] = wy;
      P[i * 4 + 2] = LIGHT_Z;
      P[i * 4 + 3] = l.r;
      C[i * 4] = l.cr * k; C[i * 4 + 1] = l.cg * k; C[i * 4 + 2] = l.cb * k; C[i * 4 + 3] = 0;
    }
    return n;
  }
}

/** 屏幕点（游戏区坐标，y 向下）按摄像机在高度 z 处反投影到世界 (x, y)。 */
export function unproject(sx: number, sy: number, scroll: number, z = 0, camS = CAM_S): [number, number] {
  const d = CAM_Z - z;
  const ndcX = (sx - 450) / 450, ndcY = (600 - sy) / 600;
  return [450 + ndcX * TAN_HALF * 0.75 * d, scroll + 600 - camS + (ndcY + camS / 600) * TAN_HALF * d];
}

// ─────────────────────────────────────────────────────────────── GPU 计时（调试）

/** EXT_disjoint_timer_query_webgl2 计时器。用法：t.begin('bg'); …; t.end(); 然后 t.poll()，t.ms.bg 为滑动平均毫秒。 */
export class GpuTimer {
  ms: Record<string, number> = {};
  /** 同一时刻只能有一个 TIME_ELAPSED 查询：只测背景('bg')或整帧('frame')。 */
  only: 'bg' | 'frame' = 'bg';
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
  private pending: { name: string; q: WebGLQuery }[] = [];
  private cur: { name: string; q: WebGLQuery } | null = null;
  constructor(private gl: GL) {
    const e = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!e) throw new Error('无 EXT_disjoint_timer_query_webgl2');
    this.ext = e;
  }
  begin(name: string): void {
    const q = this.gl.createQuery()!;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.cur = { name, q };
  }
  end(): void {
    if (!this.cur) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.cur);
    this.cur = null;
  }
  poll(): void {
    const gl = this.gl;
    while (this.pending.length) {
      const p = this.pending[0];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
      if (!disjoint) {
        const ms = (gl.getQueryParameter(p.q, gl.QUERY_RESULT) as number) / 1e6;
        this.ms[p.name] = p.name in this.ms ? this.ms[p.name] * 0.9 + ms * 0.1 : ms;
      }
      gl.deleteQuery(p.q);
    }
  }
}

// ─────────────────────────────────────────────────────────────── GLSL 公共部分

const SCENE_HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
precision highp int;
uniform vec2 uRes;      // 光栅化目标像素尺寸
uniform float uTime;
uniform float uScroll;
uniform float uBeat;
uniform float uFlash;
uniform vec4 uP0;
uniform vec4 uP1;
uniform vec4 uP2;
uniform vec4 uP3;
uniform vec3 uCam;      // (450, uScroll + 600 - CAM_S, 1600)
uniform vec4 uHRect;    // 高度图窗口：xy = 世界原点，zw = 世界尺寸
uniform sampler2D uHmap;
uniform vec4 uLightP[${MAX_LIGHTS}];   // 世界 xyz + 软半径
uniform vec4 uLightC[${MAX_LIGHTS}];   // 线性 HDR rgb
uniform int uLightN;
uniform sampler2D uLightBuf;   // 弹光缓冲（屏幕空间，1/4 分辨率 HDR）
uniform float uLightBufK;
const float CAM_Z = ${CAM_Z}.0;
uniform float uCamS;   // 每关可配的摄像机南向偏移（Bg3D.camS）
#define CAM_S uCamS
const float TAN_H = ${TAN_HALF};
const float ASPECT = 0.75;
` + GLSL_COMMON + BG_LIB;

const SCENE_LIB = `
vec4 hmapAt(vec2 w) { return textureLod(uHmap, (w - uHRect.xy) / uHRect.zw, 0.0); }
float groundH(vec2 w) { return hmapAt(w).x; }
// 世界点 → 裁剪空间（透视，w = 视线方向深度 d = CAM_Z - z）
vec4 projectW(vec3 p) {
  float d = CAM_Z - p.z;
  const float n = 200.0, f = 3200.0;
  vec2 xy = (p.xy - uCam.xy) / vec2(TAN_H * ASPECT, TAN_H);
  xy.y -= CAM_S / 600.0 * d;
  float z = (f + n) / (f - n) * d - 2.0 * f * n / (f - n);
  return vec4(xy, z, d);
}
// 弹光缓冲：世界点按摄像机投影到屏幕，采样敌弹/玩家子弹/激光/爆炸的柔光（所有关卡自动生效）
vec3 lightBufAt(vec3 p) {
  vec4 c = projectW(p);
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  vec2 m = smoothstep(vec2(-0.02), vec2(0.04), uv) * smoothstep(vec2(1.02), vec2(0.96), uv);
  return min(textureLod(uLightBuf, uv, 0.0).rgb, vec3(3.0)) * (uLightBufK * m.x * m.y);
}
// 表面动态光照辐照：n 为世界法线
vec3 dynLights(vec3 p, vec3 n) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightN) break;
    vec3 d = uLightP[i].xyz - p;
    float r = uLightP[i].w;
    float att = 1.0 / (1.0 + (dot(d.xy, d.xy) + d.z * d.z * 0.12) / (r * r));
    att *= att;
    float ndl = dot(n, normalize(d)) * 0.5 + 0.5;
    acc += uLightC[i].rgb * (att * ndl);
  }
  acc += lightBufAt(p) * (0.55 + 0.45 * max(n.z, 0.0));
  return acc + uFlash * vec3(1.0, 0.95, 0.85) * 0.6;
}
// 体积动态光照（无法线）
vec3 dynLightsVol(vec3 p) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightN || i >= 20) break;
    vec3 d = uLightP[i].xyz - p;
    float r = uLightP[i].w;
    float att = 1.0 / (1.0 + dot(d, d) / (r * r));
    acc += uLightC[i].rgb * (att * att);
  }
  acc += lightBufAt(p) * 0.9;
  return acc + uFlash * vec3(1.0, 0.95, 0.85) * 0.6;
}
// 太阳阴影：沿太阳方向在高度图上步进（软影）
float sunShadow(vec3 p, vec3 L) {
  float sh = 1.0, t = 5.0;
  for (int i = 0; i < 16; i++) {
    vec3 q = p + L * t;
    sh = min(sh, clamp((q.z - groundH(q.xy)) * 7.0 / t + 0.15, 0.0, 1.0));
    t *= 1.27;
  }
  return sh * sh * (3.0 - 2.0 * sh);
}
vec3 nrmFromAux(vec4 a) { return vec3(a.xy, sqrt(max(0.0, 1.0 - dot(a.xy, a.xy)))); }
`;

const OUT_MRT = `
layout(location = 0) out vec4 oCol;
layout(location = 1) out vec4 oAux;
`;

const BAKE_FS = `
in vec2 vUv;
out vec4 o;
void main() {
  vec2 w = uHRect.xy + vUv * uHRect.zw;
  float h = terrainH(w, 6);
  float hx = terrainH(w + vec2(1.5, 0.0), 6), hy = terrainH(w + vec2(0.0, 1.5), 6);
  o = vec4(h, (hx - h) / 1.5, (hy - h) / 1.5, 0.0);
}`;

const TERRAIN_VS = `
layout(location = 0) in vec2 aG;
uniform vec4 uGrid;   // 网格原点 xy，间距 z
out vec3 vW;
void main() {
  vec2 w = uGrid.xy + aG * uGrid.z;
  vec3 p = vec3(w, groundH(w));
  vW = p;
  gl_Position = projectW(p);
}`;

const TERRAIN_FS = `
in vec3 vW;
` + OUT_MRT + `
void main() {
  vec4 hm = hmapAt(vW.xy);
  vec3 n = normalize(vec3(-hm.y, -hm.z, 1.0));
  vec3 L = sunDir();
  vec3 p = vec3(vW.xy, hm.x);
  float sunLit = max(dot(n, L), 0.0) * sunShadow(p + vec3(0.0, 0.0, 1.5), L);
  float mat;
  vec3 col = shadeTerrain(p, n, sunLit, dynLights(p, n), mat);
  oCol = vec4(col, 1.0);
  oAux = vec4(n.xy, mat, CAM_Z - vW.z);
}`;

const MODEL_VS = `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNrm;
layout(location = 2) in float aAux;
uniform vec4 uGrid;   // 原点 xy，格距 z，列数 w
out vec3 vW;
out vec3 vN;
out float vAux;
out float vRnd;
out float vShadow;
void main() {
  int cols = int(uGrid.w);
  vec2 c = uGrid.xy + vec2(float(gl_InstanceID % cols), float(gl_InstanceID / cols)) * uGrid.z;
  vec3 pos; float sc, yaw, rnd;
  if (!place(c, pos, sc, yaw, rnd)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vW = vec3(0.0); vN = vec3(0.0, 0.0, 1.0); vAux = 0.0; vRnd = 0.0; vShadow = 0.0; return; }
  float cs = cos(yaw), sn = sin(yaw);
  vec3 lp = aPos * sc;
  vec3 wp = pos + vec3(lp.x * cs - lp.y * sn, lp.x * sn + lp.y * cs, lp.z);
  vN = vec3(aNrm.x * cs - aNrm.y * sn, aNrm.x * sn + aNrm.y * cs, aNrm.z);
  vW = wp; vAux = aAux; vRnd = rnd;
  vShadow = sunShadow(pos + vec3(0.0, 0.0, 3.0), sunDir());
  gl_Position = projectW(wp);
}`;

const MODEL_FS = `
in vec3 vW;
in vec3 vN;
in float vAux;
in float vRnd;
in float vShadow;
` + OUT_MRT + `
void main() {
  vec3 n = normalize(vN);
  float sunLit = max(dot(n, sunDir()), 0.0) * vShadow;
  vec3 col = shadeModel(vW, n, vAux, vRnd, sunLit, dynLights(vW, n));
  oCol = vec4(col, 1.0);
  oAux = vec4(n.xy, 4.0, CAM_Z - vW.z);
}`;

const MODEL_VS_R = `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNrm;
layout(location = 2) in float aAux;
uniform vec4 uGrid;
out vec3 vW;
out vec3 vN;
out float vAux;
out float vRnd;
out float vShadow;
out vec2 vWpt;
void main() {
  int cols = int(uGrid.w);
  vec2 c = uGrid.xy + vec2(float(gl_InstanceID % cols), float(gl_InstanceID / cols)) * uGrid.z;
  vec3 pos; float sc, yaw, rnd;
  if (!place(c, pos, sc, yaw, rnd)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vW = vec3(0.0); vN = vec3(0.0, 0.0, 1.0); vAux = 0.0; vRnd = 0.0; vShadow = 0.0; vWpt = vec2(0.0); return; }
  float cs = cos(yaw), sn = sin(yaw);
  vec3 lp = aPos * sc;
  vec3 wp = pos + vec3(lp.x * cs - lp.y * sn, lp.x * sn + lp.y * cs, lp.z);
  vN = vec3(aNrm.x * cs - aNrm.y * sn, aNrm.x * sn + aNrm.y * cs, aNrm.z);
  vW = wp; vAux = aAux; vRnd = rnd;
  vShadow = sunShadow(pos + vec3(0.0, 0.0, 3.0), sunDir());
  // 镜像点 (wp.xy, -wp.z) 的视线与 z=0 平面的交点：屏幕位置不变，深度取水面
  float s = CAM_Z / (CAM_Z + wp.z);
  vec2 wpt = uCam.xy + (wp.xy - uCam.xy) * s;
  wpt += reflWarp(wpt, wp);
  vWpt = wpt;
  gl_Position = projectW(vec3(wpt, 0.4));
}`;

const MODEL_FS_R = `
in vec3 vW;
in vec3 vN;
in float vAux;
in float vRnd;
in float vShadow;
in vec2 vWpt;
layout(location = 0) out vec4 oCol;
void main() {
  float wm = waterMask(vWpt);
  if (wm < 0.02) discard;
  vec3 n = normalize(vN);
  float sunLit = max(dot(n, sunDir()), 0.0) * vShadow;
  vec3 col = shadeModel(vW, n, vAux, vRnd, sunLit, vec3(0.0));
  vec4 r = shadeReflect(col, vWpt, vW);
  oCol = vec4(r.rgb, r.a * wm);
}`;

const FOG_FS = `
uniform sampler2D uAux;
uniform vec2 uFogRes;
uniform int uSteps;
uniform float uFogTop;
in vec2 vUv;
out vec4 o;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  ivec2 ap = min(ip * 2, textureSize(uAux, 0) - 1);
  float D = texelFetch(uAux, ap, 0).a;
  vec3 dir = vec3((vUv.x * 2.0 - 1.0) * TAN_H * ASPECT, (vUv.y * 2.0 - 1.0 + CAM_S / 600.0) * TAN_H, -1.0);
  float t0 = CAM_Z - uFogTop;
  float t1 = min(D, CAM_Z + 40.0);
  vec3 S = vec3(0.0); float T = 1.0;
  if (t1 > t0) {
    float ds = (t1 - t0) / float(uSteps);
    float len = ds * length(dir);
    float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 L = sunDir(), sc = sunCol(), amb = skyAmb(), tint = paperTone();
    for (int i = 0; i < 64; i++) {
      if (i >= uSteps) break;
      vec3 p = uCam + dir * (t0 + (float(i) + jit) * ds);
      float sig = fogDensity(p);
      if (sig < 1e-5) continue;
      float a = 1.0 - exp(-sig * len);
      vec3 q = p + L * 45.0, q2 = p + L * 120.0;
      float vis = smoothstep(0.0, 30.0, q.z - groundH(q.xy)) * smoothstep(0.0, 60.0, q2.z - groundH(q2.xy));
      vec3 Ls = tint * (amb + sc * (0.32 * vis) + dynLightsVol(p) * 1.2);
#ifdef HAS_FOG_GLOW
      Ls += fogGlow(p);   // Bg3D.glsl 里 #define HAS_FOG_GLOW 并定义 vec3 fogGlow(vec3 p)：雾里的自发光（灯火晕）
#endif
      S += T * a * Ls;
      T *= 1.0 - a;
      if (T < 0.02) break;
    }
  }
  o = vec4(S, T);
}`;

const DEFAULT_HOOK = 'vec3 compHook(vec3 col, vec4 F, vec2 uv) { return col * F.a + F.rgb; }';

const COMP_FS = `
uniform sampler2D uCol;
uniform sampler2D uAux;
uniform sampler2D uFog;
uniform float uLine;    // 墨线宽（光栅像素）
//COMPHOOK
in vec2 vUv;
out vec4 fragColor;
void main() {
  ivec2 rr = textureSize(uAux, 0);
  ivec2 ip = min(ivec2(vUv * vec2(rr)), rr - 1);
  vec3 col = texture(uCol, vUv).rgb;
  vec4 a0 = texelFetch(uAux, ip, 0);
  vec3 paper = paperTone();
  vec3 inkT = inkTone();

  // ---- 墨线：深度 / 法线不连续 ----
  int o = int(uLine);
  vec4 aE = texelFetch(uAux, min(ip + ivec2(o, 0), rr - 1), 0);
  vec4 aW = texelFetch(uAux, max(ip - ivec2(o, 0), ivec2(0)), 0);
  vec4 aN = texelFetch(uAux, min(ip + ivec2(0, o), rr - 1), 0);
  vec4 aS = texelFetch(uAux, max(ip - ivec2(0, o), ivec2(0)), 0);
  float dd = max(max(abs(aE.a - a0.a), abs(aW.a - a0.a)), max(abs(aN.a - a0.a), abs(aS.a - a0.a)));
  vec3 n0 = nrmFromAux(a0);
  float dn = 1.0 - min(min(dot(n0, nrmFromAux(aE)), dot(n0, nrmFromAux(aW))), min(dot(n0, nrmFromAux(aN)), dot(n0, nrmFromAux(aS))));
  float edge = max(smoothstep(6.0, 22.0, dd), smoothstep(0.10, 0.4, dn));
  vec2 fp = vUv * vec2(PLAY_W, PLAY_H);
  float dry = 0.55 + 0.45 * vnoise(fp * vec2(0.9, 0.9) + 3.0);   // 枯笔
  edge *= dry * (1.0 - step(0.5, abs(a0.b - 1.0)) * 0.0);
  col = absorb(col, inkT, edge * 1.5);

  // ---- 体积雾：双边上采样 ----
  vec2 fs = vec2(textureSize(uFog, 0));
  vec2 fq = vUv * fs - 0.5;
  ivec2 f0 = ivec2(floor(fq));
  vec2 fr = fq - vec2(f0);
  vec4 F = vec4(0.0); float wsum = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 of = ivec2(k & 1, k >> 1);
    ivec2 fi = clamp(f0 + of, ivec2(0), ivec2(fs) - 1);
    ivec2 ai = min(ivec2((vec2(fi) + 0.5) * vec2(rr) / fs), rr - 1);
    float dS = texelFetch(uAux, ai, 0).a;
    float w = (of.x == 1 ? fr.x : 1.0 - fr.x) * (of.y == 1 ? fr.y : 1.0 - fr.y) * exp(-abs(dS - a0.a) * 0.06) + 1e-4;
    F += texelFetch(uFog, fi, 0) * w;
    wsum += w;
  }
  F /= wsum;
  col = compHook(col, F, vUv);

  // ---- 远处 / 上方淡入纸色；中部降对比；宣纸纹理 ----
  float edgeX = abs(vUv.x - 0.5) * 2.0;
  col = mix(col, paper, smoothstep(0.45, 1.0, vUv.y) * 0.45);
  col = mix(paper, col, mix(0.72, 1.0, edgeX * edgeX));
  col *= mix(0.83, 1.0, smoothstep(0.0, 0.85, edgeX));
  col *= paperCol(fp, vec3(1.0));
  fragColor = vec4(col, 1.0);
}`;

// ─────────────────────────────────────────────────────────────── Scene3D

const HM_X0 = -120, HM_W = 1140, HM_Y0 = -430, HM_H = 1780;
const GRID_SP = 3, GRID_X0 = -100, GRID_W = 1100, GRID_Y0 = -390, GRID_H = 1650;

interface ModelGpu { m: Model3D; prog: Program; progR: Program | null; vao: WebGLVertexArrayObject; verts: number }

export interface SceneView {
  time: number;
  scroll: number;
  beat: number;
  flash: number;
  params: ArrayLike<number>[];
  /** 弹光缓冲纹理与强度（缺省不加）。 */
  lightTex?: WebGLTexture | null;
  lightK?: number;
}

export class Scene3D {
  private gl: GL;
  private bake: Program;
  private terrain: Program;
  private fog: Program;
  private comp: Program;
  private hmap: Target;
  private colTex: WebGLTexture;
  private auxTex: WebGLTexture;
  private depthRb: WebGLRenderbuffer;
  private fbo: WebGLFramebuffer;
  private fogT: Target;
  private w = 0;
  private h = 0;
  private gridVao: WebGLVertexArrayObject;
  private gridIdx: number;
  private models: ModelGpu[] = [];
  private lightP = new Float32Array(MAX_LIGHTS * 4);
  private lightC = new Float32Array(MAX_LIGHTS * 4);
  /** 光栅分辨率相对游戏区目标的比例、雾步数（随画质档）。 */
  scale: number;
  fogSteps: number;
  camS: number;

  constructor(gl: GL, readonly def: Bg3D, quality: Quality3D) {
    this.gl = gl;
    this.camS = def.camS ?? CAM_S;
    this.scale = quality === 'ultra' ? 1 : 0.75;
    this.fogSteps = quality === 'ultra' ? 24 : 14;
    const pre = SCENE_HEAD + SCENE_LIB + def.glsl;
    this.bake = new Program(gl, FS_TRI_VS, pre + BAKE_FS);
    this.terrain = new Program(gl, pre + TERRAIN_VS, pre + TERRAIN_FS);
    this.fog = new Program(gl, FS_TRI_VS, pre + (def.fogFS ?? FOG_FS));
    this.comp = new Program(gl, FS_TRI_VS, pre + COMP_FS.replace('//COMPHOOK', def.compHook ?? DEFAULT_HOOK));
    this.hmap = new Target(gl, HM_W, HM_H, 'rgba16f');

    // 光栅目标：color + aux + 深度
    const mk = (linear: boolean): WebGLTexture => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.colTex = mk(true);
    this.auxTex = mk(false);
    this.depthRb = gl.createRenderbuffer()!;
    this.fbo = gl.createFramebuffer()!;
    this.fogT = new Target(gl, 4, 4, 'rgba16f', gl.NEAREST);

    // 地形网格（规则格点，(i, j) 整数格坐标，VS 里换成世界坐标）
    const cols = Math.floor(GRID_W / GRID_SP) + 1, rows = Math.floor(GRID_H / GRID_SP) + 1;
    const v = new Float32Array(cols * rows * 2);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { v[(j * cols + i) * 2] = i; v[(j * cols + i) * 2 + 1] = j; }
    const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
    let k = 0;
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c;
    }
    this.gridIdx = idx.length;
    this.gridVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.gridVao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    for (const m of def.models ?? []) {
      const prog = new Program(gl, pre + m.place + MODEL_VS, pre + m.shade + MODEL_FS);
      const progR = m.reflect ? new Program(gl, pre + m.place + MODEL_VS_R, pre + m.shade + MODEL_FS_R) : null;
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, m.mesh, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
      gl.bindVertexArray(null);
      this.models.push({ m, prog, progR, vao, verts: m.mesh.length / 7 });
    }
  }

  setQuality(q: Quality3D): void {
    this.scale = q === 'ultra' ? 1 : 0.75;
    this.fogSteps = q === 'ultra' ? 24 : 14;
    this.w = 0; this.h = 0;   // 下次 resize 重建目标
  }

  /** 目标为游戏区像素尺寸（Renderer.playPx）。 */
  resize(playW: number, playH: number): void {
    const w = Math.max(8, Math.round(playW * this.scale)), h = Math.max(8, Math.round(playH * this.scale));
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const gl = this.gl;
    for (const t of [this.colTex, this.auxTex]) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    }
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.colTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.auxTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthRb);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Scene3D 帧缓冲不完整 0x' + st.toString(16));
    const fd = this.def.fogDiv ?? 2;
    this.fogT.resize(Math.ceil(w / fd), Math.ceil(h / fd));
  }

  private common(p: Program, v: SceneView, n: number): void {
    p.use().set('uRes', this.w, this.h).set('uTime', v.time).set('uScroll', v.scroll).set('uBeat', v.beat).set('uFlash', v.flash)
      .set('uP0', v.params[0]).set('uP1', v.params[1]).set('uP2', v.params[2]).set('uP3', v.params[3])
      .set('uCam', 450, v.scroll + 600 - this.camS, CAM_Z).set('uCamS', this.camS)
      .set('uHRect', this.hx, this.hy, HM_W, HM_H)
      .set('uLightP', this.lightP).set('uLightC', this.lightC).set('uLightN', n)
      .set('uLightBufK', v.lightTex ? (v.lightK ?? 1) : 0)
      .tex('uHmap', this.hmap.tex).tex('uLightBuf', v.lightTex ?? null);
  }
  private hx = HM_X0;
  private hy = 0;

  /** 渲染一帧到 out（游戏区目标，RGBA16F 线性 HDR）。 */
  render(out: Target, v: SceneView, lights: Lights): void {
    const gl = this.gl;
    const nl = lights.pack(v.scroll, this.lightP, this.lightC, this.camS);
    this.hy = Math.floor(v.scroll) + HM_Y0;
    gl.disable(gl.BLEND);

    // 1. 高度图
    this.hmap.bind();
    this.common(this.bake, v, nl);
    fullscreen(gl);

    // 2. 光栅化
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 1]);
    gl.clearBufferfv(gl.COLOR, 1, [0, 0, 1, 4000]);
    gl.depthMask(true);
    gl.clearBufferfv(gl.DEPTH, 0, [1]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    const gy = Math.floor((v.scroll + GRID_Y0) / GRID_SP) * GRID_SP;
    this.common(this.terrain, v, nl);
    this.terrain.set('uGrid', GRID_X0, gy, GRID_SP, 0);
    gl.bindVertexArray(this.gridVao);
    gl.drawElements(gl.TRIANGLES, this.gridIdx, gl.UNSIGNED_INT, 0);
    // 水面倒影：镜像模型（alpha 混合，只写 color，不写深度与 aux）
    if (this.models.some((md) => md.progR)) {
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      for (const md of this.models) {
        if (!md.progR) continue;
        this.common(md.progR, v, nl);
        const c = md.m.cell;
        md.progR.set('uGrid', Math.floor(GRID_X0 / c) * c, Math.floor((v.scroll + GRID_Y0) / c) * c, c, md.m.cols);
        gl.bindVertexArray(md.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, md.verts, md.m.cols * md.m.rows);
      }
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    }
    for (const md of this.models) {
      this.common(md.prog, v, nl);
      const c = md.m.cell;
      md.prog.set('uGrid', Math.floor(GRID_X0 / c) * c, Math.floor((v.scroll + GRID_Y0) / c) * c, c, md.m.cols);
      gl.bindVertexArray(md.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, md.verts, md.m.cols * md.m.rows);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);

    // 3. 体积雾（半分辨率）
    this.fogT.bind();
    this.common(this.fog, v, nl);
    this.fog.set('uFogRes', this.fogT.w, this.fogT.h).set('uSteps', this.fogSteps).set('uFogTop', this.def.fogTop ?? 240)
      .tex('uAux', this.auxTex);
    fullscreen(gl);

    // 4. 合成到 out
    out.bind();
    this.common(this.comp, v, nl);
    this.comp.set('uLine', Math.max(1, Math.round((this.h / 1200) * 0.55)))
      .tex('uCol', this.colTex).tex('uAux', this.auxTex).tex('uFog', this.fogT.tex);
    fullscreen(gl);
  }
}
