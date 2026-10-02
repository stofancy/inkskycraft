// 敌弹：实例化 SDF 渲染。深色描边（alpha 压暗背景）+ 彩色本体 + 白热核心 + 加色光晕，
// 在纸白与夜色背景上都清晰可辨。
import { PLAY_H, PLAY_W } from '../types';
import { Program, type GL } from './util';

export const BULLET_SHAPES = ['orb', 'rice', 'needle', 'star', 'ring', 'petal', 'big', 'crystal', 'flame'] as const;
export type BulletShape = (typeof BULLET_SHAPES)[number];

const VS = `#version 300 es
layout(location=0) in vec4 aA;  // x, y, angle, size
layout(location=1) in vec4 aB;  // shape, r, g, b
layout(location=2) in vec4 aC;  // age, alpha, seed, -
uniform vec2 uView;
out vec2 vP;
flat out vec4 vB;
flat out vec4 vC;
flat out float vTrail;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  float spawn = clamp(aA.w > 0.0 ? aC.x / 0.14 : 1.0, 0.0, 1.0);
  float grow = mix(2.2, 1.0, spawn * spawn);
  float ext = 2.4 * grow;                 // 四边形半径 = size * ext，留出光晕
  vec2 local = corner * aA.w * ext;
  float c = cos(aA.z), s = sin(aA.z);
  vec2 p = aA.xy + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vP = corner * ext;                      // 以 size 为单位的局部坐标，+x 为飞行方向
  vB = aB;
  vC = vec4(aC.x, aC.y * mix(0.25, 1.0, spawn), aC.z, grow);
  vTrail = aC.w;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vP;
flat in vec4 vB;
flat in vec4 vC;
flat in float vTrail;
uniform float uTime;
uniform float uIntensity;
out vec4 o;
float sdRhombus(vec2 p, vec2 b) {
  p = abs(p);
  vec2 q = b * vec2(1.0, -1.0);
  float h = clamp(dot(b - 2.0 * p, q) / dot(q, q), -1.0, 1.0);
  float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
  return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
}
float sdStar(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
void main() {
  int shape = int(vB.x + 0.5);
  vec2 p = vP;
  float age = vC.x;
  float d;
  if (shape == 0) d = length(p) - 1.0;
  else if (shape == 1) d = (length(p / vec2(1.25, 0.62)) - 1.0) * 0.62;
  else if (shape == 2) d = sdRhombus(p, vec2(1.6, 0.36));
  else if (shape == 3) { float a = age * 5.0 + vC.z * 6.28; float cs = cos(a), sn = sin(a); d = sdStar(mat2(cs, -sn, sn, cs) * p, 1.15, 0.5); }
  else if (shape == 4) d = abs(length(p) - 0.8) - 0.22;
  else if (shape == 5) { vec2 q = p; q.x += 0.35; float r = mix(0.95, 0.35, clamp((q.x + 0.9) / 1.8, 0.0, 1.0)); d = (length(vec2(q.x * 0.75, q.y)) - r); }
  else if (shape == 6) d = length(p) - 1.0;
  else if (shape == 7) d = sdRhombus(p, vec2(1.2, 0.72));
  else { vec2 q = p; q.x += 0.4; d = length(q * vec2(0.6, 1.0)) - 0.75 + 0.18 * sin(q.y * 6.0 + uTime * 20.0 + vC.z * 9.0) * clamp(-q.x, 0.0, 1.0); }

  float aa = fwidth(d) * 1.2;
  float body = smoothstep(aa, -aa, d);
  float core = smoothstep(-0.28, -0.62, d);
  float outline = smoothstep(0.42, 0.14, d) * (1.0 - body);
  // 光晕：较窄较柔，避免弹幕密集时糊成一片
  float halo = exp(-max(d, 0.0) * 4.2) * (1.0 - body);
  vec3 col = vB.yzw;
  if (shape == 6) {
    float sw = sin(atan(p.y, p.x) * 3.0 + length(p) * 6.0 - uTime * 6.0) * 0.5 + 0.5;
    core = max(core * 0.7, smoothstep(-0.2, -0.9, d) * sw * 0.8);
  }
  if (shape == 4) core *= 0.4;
  float pulse = 0.85 + 0.15 * sin(uTime * 14.0 + vC.z * 40.0);
  // 快速弹的短拖尾（沿飞行反方向，加色，不压暗背景）
  float sp = smoothstep(160.0, 420.0, vTrail);
  float tt = clamp(-p.x / 2.3, 0.0, 1.0);
  float trail = sp * step(p.x, 0.0) * (1.0 - tt) * (1.0 - tt) * exp(-p.y * p.y / (0.28 + 0.5 * (1.0 - tt))) * (1.0 - body) * 0.55;
  vec3 emit = col * (body * 1.1 + halo * 0.6 * pulse + trail) + vec3(1.0, 0.97, 0.92) * core * 3.0;
  float alpha = clamp(body + outline * 0.78, 0.0, 1.0);
  float A = vC.y;
  o = vec4(emit * uIntensity * A, alpha * A);
}`;

const FLOATS = 12;

export class BulletRenderer {
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  data = new Float32Array(8192 * FLOATS);
  count = 0;
  private cap = 0;
  intensity = 1.6;

  constructor(readonly gl: GL) {
    this.prog = new Program(gl, VS, FS);
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, FLOATS * 4, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
  }

  add(x: number, y: number, angle: number, size: number, shape: number, r: number, g: number, b: number, age: number, alpha: number, seed: number, speed = 0): void {
    if ((this.count + 1) * FLOATS > this.data.length) {
      const n = new Float32Array(this.data.length * 2);
      n.set(this.data);
      this.data = n;
    }
    const o = this.count++ * FLOATS, D = this.data;
    D[o] = x; D[o + 1] = y; D[o + 2] = angle; D[o + 3] = size;
    D[o + 4] = shape; D[o + 5] = r; D[o + 6] = g; D[o + 7] = b;
    D[o + 8] = age; D[o + 9] = alpha; D[o + 10] = seed; D[o + 11] = speed;
  }

  clear(): void {
    this.count = 0;
  }

  draw(time: number): void {
    if (!this.count) return;
    const gl = this.gl;
    const bytes = this.count * FLOATS * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (bytes > this.cap) {
      this.cap = Math.max(bytes, this.cap * 2);
      gl.bufferData(gl.ARRAY_BUFFER, this.cap, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * FLOATS);
    this.prog.use().set('uView', PLAY_W, PLAY_H).set('uTime', time).set('uIntensity', this.intensity);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }
}
