// 无状态 GPU 粒子：CPU 只写入生成参数（环形缓冲），位置/颜色/尺寸由顶点着色器按解析式计算。
// 每个系统可容纳数十万粒子；加色与混合在同一批次内（加色粒子输出 alpha=0）。
import { PLAY_H, PLAY_W } from '../types';
import { Program, type GL } from './util';

export enum PK {
  Dot = 0,     // 柔光点（加色）
  Spark = 1,   // 沿速度拉长的火花（加色）
  Ink = 2,     // 墨滴（混合，暗色）
  Smoke = 3,   // 烟团（混合）
  Leaf = 4,    // 金箔碎片（加色，旋转闪烁）
  Ring = 5,    // 扩散环（加色）
  Petal = 6,   // 花瓣（混合）
  Shard = 7,   // 碎片（混合）
  Ember = 8,   // 余烬（加色，抖动）
}

const ADDITIVE = new Set([PK.Dot, PK.Spark, PK.Leaf, PK.Ring, PK.Ember]);

const VS = `#version 300 es
layout(location=0) in vec4 aA; // x0 y0 vx vy
layout(location=1) in vec4 aB; // t0 life drag grav
layout(location=2) in vec4 aC; // size0 size1 rot0 spin
layout(location=3) in vec4 aD; // color0 rgba
layout(location=4) in vec4 aE; // color1 rgb, kind
uniform float uTime;
uniform vec2 uView;
out vec2 vQ;
out vec4 vCol;
flat out float vKind;
flat out float vSeed;
out float vU;
void main() {
  float t = uTime - aB.x;
  float life = aB.y;
  if (t < 0.0 || t > life || life <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float u = t / life;
  float k = aB.z;
  float e = exp(-k * t);
  float f = k > 0.0001 ? (1.0 - e) / k : t;
  vec2 g = vec2(0.0, aB.w);
  vec2 pos = aA.xy + aA.zw * f + 0.5 * g * t * t;
  vec2 vel = aA.zw * e + g * t;
  float size = mix(aC.x, aC.y, u);
  float kind = aE.w;
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 local;
  if (kind == 1.0) {
    float sp = length(vel);
    vec2 dir = sp > 0.001 ? vel / sp : vec2(1.0, 0.0);
    float len = size + sp * 0.05;
    local = dir * corner.x * len + vec2(-dir.y, dir.x) * corner.y * size * 0.35;
  } else {
    float r = aC.z + aC.w * t;
    float c = cos(r), s = sin(r);
    vec2 q = corner * size;
    if (kind == 4.0) q.x *= 0.55 + 0.45 * sin(r * 2.3); // 金箔翻转
    local = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
  }
  if (kind == 8.0) pos += vec2(sin(t * 13.0 + float(gl_InstanceID)), cos(t * 11.0 + float(gl_InstanceID) * 1.7)) * 2.0;
  vec2 p = pos + local;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vQ = corner;
  vec3 col = mix(aD.rgb, aE.rgb, u);
  float a = aD.a;
  if (kind == 5.0) a *= 1.0 - u;
  else if (kind == 2.0 || kind == 3.0) a *= smoothstep(1.0, 0.55, u) * smoothstep(0.0, 0.06, u);
  else a *= (1.0 - u * u);
  vCol = vec4(col, a);
  vKind = kind;
  vSeed = fract(float(gl_InstanceID) * 0.61803398875);
  vU = u;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vQ;
in vec4 vCol;
flat in float vKind;
flat in float vSeed;
in float vU;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uAmb;
out vec4 o;
float h(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float r = length(vQ);
  int k = int(vKind + 0.5);
  float a;
  vec3 extra = vec3(0.0);
  vec3 shard = vec3(0.0);
  bool add = (k == 0 || k == 1 || k == 4 || k == 5 || k == 8);
  if (k == 0 || k == 8) a = exp(-r * r * 5.0);
  else if (k == 1) {
    // 火花：尾部渐隐的运动模糊拖尾 + 头部 HDR 白热
    float along = vQ.x * 0.5 + 0.5;
    a = pow(along, 1.7) * exp(-vQ.y * vQ.y * mix(14.0, 5.0, along)) * smoothstep(1.0, 0.85, abs(vQ.x));
    float head = exp(-((vQ.x - 0.7) * (vQ.x - 0.7) * 20.0 + vQ.y * vQ.y * 14.0));
    extra = vec3(1.0, 0.9, 0.7) * head * 1.7 * vCol.a * (1.0 - vU * vU);
  }
  else if (k == 2) {
    float ang = atan(vQ.y, vQ.x);
    float edge = 0.72 + 0.14 * sin(ang * 3.0 + vSeed * 30.0) + 0.08 * sin(ang * 7.0 + vSeed * 50.0);
    a = smoothstep(edge, edge - 0.18, r);
    a *= 0.75 + 0.25 * smoothstep(0.0, edge, r); // 墨滴边缘更浓（水渍）
  }
  else if (k == 3) {
    float ang = atan(vQ.y, vQ.x);
    float n = 0.6 + 0.2 * sin(ang * 4.0 + vSeed * 20.0 + vU * 3.0);
    a = smoothstep(n + 0.3, n - 0.3, r) * 0.6;
  }
  else if (k == 4) {
    vec2 q = abs(vQ);
    a = step(q.x, 0.9) * step(q.y, 0.9);
    a *= 0.6 + 0.4 * sin(vU * 40.0 + vSeed * 20.0);
  }
  else if (k == 5) a = exp(-pow((r - 0.85) * 9.0, 2.0));
  else if (k == 6) {
    vec2 q = vQ;
    float petal = length(vec2(q.x * 1.6, q.y + 0.25 * q.x * q.x)) - 0.6 - 0.15 * q.y;
    a = smoothstep(0.05, -0.05, petal);
  }
  else {
    // 碎块：不规则轮廓 + 随翻转变化的伪法线受光 + 高光闪 + 余热发红
    float aa = atan(vQ.y, vQ.x);
    float rad = 0.62 + 0.22 * sin(aa * 3.0 + vSeed * 40.0) + 0.1 * sin(aa * 5.0 + vSeed * 17.0);
    a = smoothstep(0.05, -0.05, r - rad);
    float tum = vSeed * 50.0 + vU * (9.0 + 8.0 * vSeed);
    vec3 n = normalize(vec3(vQ.x * 0.9 + sin(vSeed * 9.0) * 0.25, -vQ.y * 0.9 + cos(vSeed * 7.0) * 0.25, 0.55));
    float c1 = cos(tum), s1 = sin(tum), c2 = cos(tum * 0.7), s2 = sin(tum * 0.7);
    n = vec3(n.x, n.y * c1 - n.z * s1, n.y * s1 + n.z * c1);
    n = vec3(n.x * c2 - n.z * s2, n.y, n.x * s2 + n.z * c2);
    float dif = max(dot(n, uSun), 0.0);
    float spec = pow(max(dot(n, normalize(uSun + vec3(0.0, 0.0, 1.0))), 0.0), 26.0);
    float hot = pow(1.0 - vU, 3.0);
    shard = vCol.rgb * (uAmb * 0.55 + uSunCol * dif * 1.6) + vec3(1.0, 0.92, 0.8) * spec * 0.9
          + vec3(2.0, 0.62, 0.13) * hot * (0.55 + 0.45 * dif);
  }
  a *= vCol.a;
  if (a < 0.002 && max(extra.r, max(extra.g, extra.b)) < 0.002) discard;
  if (k == 7) o = vec4(shard * a, a);
  else o = add ? vec4(vCol.rgb * a + extra, 0.0) : vec4(vCol.rgb * a, a);
}`;

const FLOATS = 20;

export interface ParticleSpec {
  x: number; y: number;
  vx?: number; vy?: number;
  life: number;
  drag?: number;
  grav?: number;
  size: number;
  sizeEnd?: number;
  rot?: number;
  spin?: number;
  /** 起始颜色（线性 HDR）与透明度。 */
  r: number; g: number; b: number; a?: number;
  /** 结束颜色，默认同起始。 */
  r1?: number; g1?: number; b1?: number;
  kind: PK;
  /** 延迟生成（秒）。 */
  delay?: number;
}

export class ParticleSystem {
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private staging: Float32Array;
  private pending = 0;
  private head = 0;
  /** 已写入的槽位数；未用槽位无需每帧提交顶点。 */
  private used = 0;
  /** 粒子时钟（游戏时间），由外部每帧推进。 */
  time = 0;
  /** 日光（屏幕空间，指向太阳）、日光色与天光：碎片受光用。 */
  sun: [number, number, number] = [-0.78, 0.12, 0.48];
  sunCol: [number, number, number] = [1, 0.98, 0.92];
  amb: [number, number, number] = [0.62, 0.64, 0.68];

  constructor(readonly gl: GL, readonly capacity = 262144) {
    this.prog = new Program(gl, VS, FS);
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    this.staging = new Float32Array(16384 * FLOATS);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * FLOATS * 4, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 5; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, FLOATS * 4, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
  }

  static isAdditive(k: PK): boolean {
    return ADDITIVE.has(k);
  }

  emit(p: ParticleSpec): void {
    if ((this.pending + 1) * FLOATS > this.staging.length) {
      if (this.staging.length >= this.capacity * FLOATS) return;
      const n = new Float32Array(this.staging.length * 2);
      n.set(this.staging);
      this.staging = n;
    }
    const o = this.pending++ * FLOATS, D = this.staging;
    D[o] = p.x; D[o + 1] = p.y; D[o + 2] = p.vx ?? 0; D[o + 3] = p.vy ?? 0;
    D[o + 4] = this.time + (p.delay ?? 0); D[o + 5] = p.life; D[o + 6] = p.drag ?? 0; D[o + 7] = p.grav ?? 0;
    D[o + 8] = p.size; D[o + 9] = p.sizeEnd ?? p.size; D[o + 10] = p.rot ?? 0; D[o + 11] = p.spin ?? 0;
    D[o + 12] = p.r; D[o + 13] = p.g; D[o + 14] = p.b; D[o + 15] = p.a ?? 1;
    D[o + 16] = p.r1 ?? p.r; D[o + 17] = p.g1 ?? p.g; D[o + 18] = p.b1 ?? p.b; D[o + 19] = p.kind;
  }

  /** 清空所有存活粒子。 */
  reset(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.capacity * FLOATS * 4, gl.DYNAMIC_DRAW);
    this.pending = 0;
    this.head = 0;
    this.used = 0;
  }

  private upload(): void {
    if (!this.pending) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    let n = Math.min(this.pending, this.capacity);
    this.used = Math.min(this.capacity, this.used + n);
    let src = 0;
    while (n > 0) {
      const chunk = Math.min(n, this.capacity - this.head);
      gl.bufferSubData(gl.ARRAY_BUFFER, this.head * FLOATS * 4, this.staging, src * FLOATS, chunk * FLOATS);
      this.head = (this.head + chunk) % this.capacity;
      src += chunk;
      n -= chunk;
    }
    this.pending = 0;
  }

  draw(): void {
    this.upload();
    if (!this.used) return;
    const gl = this.gl;
    this.prog.use().set('uTime', this.time).set('uView', PLAY_W, PLAY_H).set('uSun', this.sun).set('uSunCol', this.sunCol).set('uAmb', this.amb);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.used);
    gl.bindVertexArray(null);
  }
}
