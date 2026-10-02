// 体积火球：每个爆炸一个实例（包围四边形 + 片元着色器沿视线光线步进 3D 噪声）。
// 生命周期：黑体色火球膨胀翻滚 → 受光的翻滚烟团（自阴影 + 日光）→ 侵蚀成墨烟消散（由 fx 接墨流体 splat）。
// 以完整分辨率渲入独立缓冲（预乘 alpha，HDR）；折叠的环状主形形成有空腔的火莲。
import { PLAY_H, PLAY_W } from '../types';
import type { ExplosionPalette } from '../game/api';
import { Program, Target, FS_TRI_VS, fullscreen, type GL } from './util';

export const MAX_FIREBALLS = 32;
const QH = 2.15;   // 包围四边形半宽（火球半径的倍数）

const VS = `#version 300 es
layout(location=0) in vec4 aA;  // x y R t0
layout(location=1) in vec4 aB;  // dur seed ink power
layout(location=2) in vec4 aC;  // steps octaves - -
uniform vec2 uView;
out vec2 vQ;
flat out vec4 vA;
flat out vec4 vB;
flat out vec4 vC;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 p = aA.xy + corner * aA.z * ${QH.toFixed(2)};
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vQ = corner;
  vA = aA; vB = aB; vC = aC;
}`;

const FS = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D uNoise;
uniform float uTime;
uniform vec3 uSun;     // 指向太阳（屏幕空间：x 右，y 上，z 朝向观者）
uniform vec3 uSunCol;
uniform vec3 uAmb;
in vec2 vQ;
flat in vec4 vA;
flat in vec4 vB;
flat in vec4 vC;
out vec4 o;

float gAge, gSeedA, gRad, gRise, gEro, gSmoke, gRotC, gRotS, gOpen, gLarge;
vec3 gOff;

// 朱砂、熔金与很窄的金白热缝，烟的厚度保留在发光区域之间。
vec3 heatCol(float T, float ink) {
  vec3 c = vec3(0.42, 0.015, 0.003) * smoothstep(0.04, 0.25, T);
  c = mix(c, vec3(1.55, 0.16, 0.012), smoothstep(0.22, 0.62, T));
  c = mix(c, vec3(2.4, 0.79, 0.09), smoothstep(0.60, 0.94, T));
  c = mix(c, vec3(3.4, 2.45, 1.05), smoothstep(1.02, 1.36, T));
  vec3 vermilion = vec3(1.3, 0.055, 0.008) * smoothstep(0.04, 0.6, T);
  vermilion = mix(vermilion, vec3(2.4, 0.72, 0.09), smoothstep(0.72, 1.28, T));
  if(vC.z > 0.5 && vC.z < 1.5) {
    vec3 jade=mix(vec3(0.008,0.16,0.12),vec3(0.045,1.2,0.85),smoothstep(0.12,0.8,T));
    return mix(jade,vec3(0.55,2.0,1.6),smoothstep(0.9,1.4,T));
  }
  if(vC.z > 1.5) return mix(vec3(0.13,0.008,0.28),vec3(1.1,0.12,1.8),smoothstep(0.1,0.85,T))+vec3(1.5,0.8,0.13)*smoothstep(1.0,1.6,T);
  return mix(c, vermilion, ink * 0.72);
}

// q 的三个方向均参与纹理采样；低频噪声推动整片厚边，高频只雕刻褶皱。
float dens(vec3 p, out float fold, out float throat) {
  if (vC.z > 0.5) {
    // 青的切面冷爆与雷的分叉裂解改变密度轮廓，保留步进、自阴影与厚度。
    float a = atan(p.y,p.x);
    p.xy *= 1.0 + (vC.z < 1.5 ? 0.12*cos(a*6.0) : 0.15*sin(a*3.0+gSeedA*8.0));
    p.z *= vC.z < 1.5 ? 1.25 : 0.84;
  }
  vec3 w = (p - vec3(0.0, gRise, 0.0)) / gRad;
  w.x -= 0.09 * gOpen * sin(gSeedA * 18.0 + w.y * 2.1);
  vec3 q = vec3(w.x * gRotC - w.z * gRotS, w.y - gAge * 0.18,
                w.x * gRotS + w.z * gRotC) * 0.34 + gOff;
  float broad = texture(uNoise, q).r;
  float rolls = texture(uNoise, q * 2.15 + vec3(0.21, -gAge * 0.08, 0.53)).r;
  float grain = texture(uNoise, q * 5.2 + 0.73).r;
  w += vec3(broad - 0.5, rolls - 0.5, grain - 0.5) * vec3(0.26, 0.22, 0.16);
  float angle = atan(w.y * 1.14, w.x);
  float petal = sin(angle * 5.0 + gSeedA * 15.0 + 0.9 * w.z + rolls * 2.0);
  float secondary = sin(angle * 3.0 - gSeedA * 21.0);
  float radial = length(vec2(w.x, w.y * 1.13));
  float ring = mix(0.34, 0.67, gOpen) + 0.050 * petal * gLarge
             + 0.052 * secondary + (broad - 0.5) * 0.18;
  // 翻卷厚边在深度方向前后起伏，瓣尖舒展，内壁承接余热。
  float curl = 0.15 * sin(angle * 5.0 + gSeedA * 15.0 + 0.7)
             + 0.11 * secondary + 0.10 * w.y;
  float tube = mix(0.39, 0.28, gOpen) + (rolls - 0.5) * 0.085;
  float rim = tube - length(vec2(radial - ring, (w.z - curl) * 0.82));
  float petals = 0.09 * gLarge * gOpen * pow(max(petal, 0.0), 3.0);
  rim += petals * smoothstep(0.40, 0.80, radial);
  // 上冠与偏轴的卷云相接。宽阔体积依靠连续密度场联结。
  vec3 crownP = w - vec3(-0.13 * gLarge, 0.47 + 0.08 * secondary, -0.17);
  crownP.x += 0.11 * sin(w.y * 3.0 + gSeedA * 6.0);
  float crown = 0.46 - length(crownP * vec3(0.89, 1.35, 1.03));
  crown += (broad - 0.5) * 0.30 + (rolls - 0.5) * 0.13;
  crown *= 0.65 + 0.35 * gSmoke;
  // 后壁为火莲的内膛，正面留出有纵深的中央空腔。
  float back = 0.34 - length((w - vec3(0.07, -0.10, -0.29)) * vec3(1.0, 1.08, 1.1));
  back -= gOpen * 0.08;
  float shape = max(rim, max(crown, back));
  float cavity = length(vec3(w.x * 1.06, (w.y + 0.04) * 1.22, (w.z - 0.32) * 0.63))
               - mix(0.06, 0.38, gOpen);
  shape = min(shape, cavity);
  float detail = (rolls - 0.5) * 0.20 + (grain - 0.5) * 0.14;
  float erosion = gEro * (0.10 + 0.21 * (1.0 - rolls));
  fold = clamp(0.55 + (rolls - 0.5) * 1.7 + (grain - 0.5) * 0.55, 0.0, 1.0);
  // 内壁、后膛及卷边中的缝隙，热量不会铺满整个正面。
  float inner = 1.0 - smoothstep(ring - 0.08, ring + 0.13, radial);
  float crease = pow(1.0 - abs(sin(rolls * 10.0 + w.z * 2.2 + radial * 1.4)), 2.0);
  throat = clamp(inner * (0.20 + 0.80 * crease) + crease * 0.13, 0.0, 1.0);
  throat *= 0.68 + 0.32 * (1.0 - smoothstep(-0.26, 0.24, w.z));
  return smoothstep(-0.016, 0.105, shape + detail - erosion) * (0.66 + 0.34 * fold);
}

void main() {
  float age = uTime - vA.w;
  float dur = vB.x;
  float u = age / dur;
  if (u < 0.0 || u >= 1.0) discard;
  float ink = vB.z, power = vB.w;
  gAge = age;
  gSeedA = vB.y;
  gLarge = smoothstep(32.0, 105.0, vA.z);
  gOff = vec3(fract(vB.y * 7.31), fract(vB.y * 3.17), fract(vB.y * 5.53));
  float ang = age * 0.20 * (vB.y > 0.5 ? 1.0 : -1.0);
  gRotC = cos(ang); gRotS = sin(ang);
  float burst = 1.0 - exp(-age * 13.0);
  float unfurl = smoothstep(0.08, 0.48, u);
  gOpen = smoothstep(0.025, 0.36, u);
  gRad = mix(0.18, 0.81, burst) + 0.27 * unfurl;
  gRise = 0.28 * smoothstep(0.12, 0.9, u);
  gEro = smoothstep(0.52, 1.0, u);
  gSmoke = smoothstep(0.12, 0.58, u);
  float heat = exp(-u * mix(3.3, 3.8, ink)) * (1.0 - smoothstep(0.64, 0.93, u));

  vec2 pxy = vec2(vQ.x, -vQ.y) * ${QH.toFixed(2)};
  // 包围球随主形上升，视线交段与密度场使用同一中心，舒展的冠缘留足空间。
  float bound = gRad * 1.65;
  vec2 offset = pxy - vec2(0.0, gRise);
  float zh2 = bound * bound - dot(offset, offset);
  if (zh2 <= 0.0) discard;
  float zh = sqrt(zh2);
  int N = int(vC.x);
  float ds = 2.0 * zh / float(N);
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 albedo = mix(vec3(0.11, 0.075, 0.055), vec3(0.025, 0.030, 0.034), ink);
  if(vC.z > 0.5) albedo = vC.z < 1.5 ? vec3(0.018,0.065,0.055) : vec3(0.055,0.022,0.074);
  vec3 S = vec3(0.0);
  float Tr = 1.0;
  for (int i = 0; i < 192; i++) {
    if (i >= N) break;
    vec3 p = vec3(pxy, zh - (float(i) + jit) * ds);
    float fold, throat;
    float rho = dens(p, fold, throat);
    if (rho < 0.003) continue;
    float a = 1.0 - exp(-rho * mix(5.0, 7.2, gSmoke) * ds);
    float Tt = heat * (0.045 + 2.65 * throat) * (0.65 + 0.55 * fold);
    // 两段顺光密度积分形成厚边自阴影；密度差保留瓣状受光转折。
    float fl, th;
    float dl = dens(p + uSun * 0.16 * gRad, fl, th);
    float shadow = dl * 0.19;
    shadow += dens(p + uSun * 0.42 * gRad, fl, th) * 0.28;
    float dif = clamp(0.50 + (rho - dl) * 1.85, 0.0, 1.0) * exp(-shadow * 3.2);
    float up = clamp((p.y - gRise) / gRad * 0.5 + 0.5, 0.0, 1.0);
    vec3 sm = albedo * (uAmb * (0.42 + 0.43 * up) + uSunCol * dif * 1.85);
    sm += vec3(0.32, 0.045, 0.006) * heat * throat * (1.0 - dif) * 0.16;
    vec3 em = heatCol(Tt, ink) * power * 0.82;
    S += Tr * a * (em + sm);
    Tr *= 1.0 - a;
    if (Tr < 0.012) break;
  }
  float fade = 1.0 - smoothstep(0.82, 1.0, u);
  float A = (1.0 - Tr) * fade * mix(0.93, 0.98, ink);
  o = vec4(S * fade, A);
}`;

const COMP = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 o;
void main() { o = texture(uTex, vUv); }`;

interface Ball { x: number; y: number; R: number; t0: number; dur: number; seed: number; ink: number; power: number; steps: number; palette: number; realClock:boolean }

/** 生成 64³ 可平铺 3D 噪声（3 个倍频的值噪声，已拉伸到 0..1）。 */
function makeNoise(gl: GL): WebGLTexture {
  const S = 64;
  const lat: Float32Array[] = [];
  const cells = [4, 8, 16];
  let s = 12345;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (const c of cells) { const a = new Float32Array(c * c * c); for (let i = 0; i < a.length; i++) a[i] = rnd(); lat.push(a); }
  const W = [0.56, 0.3, 0.14];
  const f = new Float32Array(S * S * S);
  let mn = 1e9, mx = -1e9;
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let z = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    for (let o = 0; o < 3; o++) {
      const c = cells[o], a = lat[o];
      const fx = (x / S) * c, fy = (y / S) * c, fz = (z / S) * c;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
      const tx = sm(fx - x0), ty = sm(fy - y0), tz = sm(fz - z0);
      const x1 = (x0 + 1) % c, y1 = (y0 + 1) % c, z1 = (z0 + 1) % c;
      const g = (i: number, j: number, k: number) => a[(k * c + j) * c + i];
      const l = (a0: number, a1: number, t: number) => a0 + (a1 - a0) * t;
      const v0 = l(l(g(x0, y0, z0), g(x1, y0, z0), tx), l(g(x0, y1, z0), g(x1, y1, z0), tx), ty);
      const v1 = l(l(g(x0, y0, z1), g(x1, y0, z1), tx), l(g(x0, y1, z1), g(x1, y1, z1), tx), ty);
      v += W[o] * l(v0, v1, tz);
    }
    const i = (z * S + y) * S + x;
    f[i] = v;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const u8 = new Uint8Array(S * S * S);
  for (let i = 0; i < u8.length; i++) u8[i] = Math.round(((f[i] - mn) / (mx - mn)) * 255);
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_3D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, S, S, S, 0, gl.RED, gl.UNSIGNED_BYTE, u8);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
  return t;
}

export class FireballSystem {
  /** 泼墨按真实时间播放；其他火球继续使用世界时钟，同批绘制。 */
  realTime=0;
  private prog: Program;
  private comp: Program;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private noise: WebGLTexture;
  private target: Target;
  private balls: Ball[] = [];
  private data = new Float32Array(MAX_FIREBALLS * 12);
  /** 日光方向（屏幕空间，指向太阳）、日光色与天光，由 Renderer 按关卡设置。 */
  sun: [number, number, number] = [-0.78, 0.12, 0.48];
  sunCol: [number, number, number] = [1.0, 0.98, 0.92];
  amb: [number, number, number] = [0.62, 0.64, 0.68];
  /** 体积步数倍率（画质）。 */
  quality = 1;
  /** 缓冲相对游戏区像素的分辨率比例。 */
  scale = 1;

  constructor(readonly gl: GL) {
    this.prog = new Program(gl, VS, FS);
    this.comp = new Program(gl, FS_TRI_VS, COMP);
    this.noise = makeNoise(gl);
    this.target = new Target(gl, 8, 8, 'rgba16f');
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
  }

  resize(playW: number, playH: number): void {
    this.target.resize(Math.max(16, playW * this.scale), Math.max(16, playH * this.scale));
  }

  get active(): number { return this.balls.length; }

  /**
   * 生成火球。R 为最大半径（游戏单位），dur 为寿命（秒），ink=1 为墨黑翻卷（朱红余烬），power 为发光强度倍率。
   * 同时存在超过 MAX_FIREBALLS 时挤掉最旧的；体积采样维持厚边与热缝的连续性。
   */
  spawn(time: number, x: number, y: number, R: number, dur: number, seed: number, ink = 0, power = 1, palette: ExplosionPalette = 'fire', realClock=false): void {
    if (this.balls.length >= MAX_FIREBALLS) this.balls.shift();
    const steps = Math.max(128, Math.min(192, Math.round((144 + Math.min(R, 140) * 0.30) * this.quality)));
    this.balls.push({ x, y, R, t0: time, dur, seed, ink, power, steps, realClock, palette: palette === 'cyan' ? 1 : palette === 'violet' ? 2 : 0 });
  }

  clear(): void { this.balls.length = 0; }

  /** 遍历当前存活火球的发光状态（供弹光缓冲取光斑）：u 为生命进度。 */
  forEachGlow(time: number, fn: (x: number, y: number, radius: number, r: number, g: number, b: number) => void): void {
    for (const b of this.balls) {
      const u = ((b.realClock?this.realTime:time) - b.t0) / b.dur;
      if (u < 0 || u >= 1) continue;
      const h = Math.exp(-u * 3.2) * b.power;
      const rad = b.R * (0.9 + 0.8 * Math.min(1, u * 3));
      if(b.palette === 1) fn(b.x,b.y,rad,.12*h,1.0*h,.72*h);
      else if(b.palette === 2) fn(b.x,b.y,rad,.7*h,.16*h,1.1*h);
      else if (b.ink) fn(b.x, b.y, rad, 1.0 * h * 0.7, 0.16 * h * 0.7, 0.04 * h * 0.7);
      else fn(b.x, b.y, rad, 2.2 * h, 0.9 * h, 0.22 * h);
    }
  }

  /** 渲染到内部缓冲并叠回当前绑定的场景目标（调用方随后需自己重新绑定场景）。 */
  draw(time: number, scene: Target): void {
    const gl = this.gl;
    // 清理过期（时间被重置时一并丢弃）
    this.balls = this.balls.filter((b) => {const now=b.realClock?this.realTime:time;return now-b.t0<b.dur&&now-b.t0>-.5;});
    if (!this.balls.length) return;
    const D = this.data;
    let n = 0;
    for (const b of this.balls) {
      const now=b.realClock?this.realTime:time;if (now < b.t0) continue;
      const o = n++ * 12;
      D[o] = b.x; D[o + 1] = b.y; D[o + 2] = b.R; D[o + 3] = time-(now-b.t0);
      D[o + 4] = b.dur; D[o + 5] = b.seed; D[o + 6] = b.ink; D[o + 7] = b.power;
      D[o + 8] = b.steps; D[o + 9] = 3; D[o + 10] = b.palette; D[o + 11] = 0;
    }
    if (!n) return;
    this.target.bind([0, 0, 0, 0]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, D, 0, n * 12);
    this.prog.use().set('uView', PLAY_W, PLAY_H).set('uTime', time).set('uSun', this.sun).set('uSunCol', this.sunCol).set('uAmb', this.amb).tex('uNoise', this.noise, gl.TEXTURE_3D);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindVertexArray(null);
    scene.bind();
    this.comp.use().tex('uTex', this.target.tex);
    fullscreen(gl);
  }
}
