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
  // 出生放大回弹：先胀到 1.8 倍，过冲收到 0.9 倍，再回到 1
  float grow = 1.0 + 0.8 * exp(-aC.x * 16.0) * cos(aC.x * 26.0);
  int sh = int(aB.x + 0.5) - 16;
  bool lng = sh == 1 || sh == 2 || sh == 5 || sh == 7 || sh == 8;
  float ext = (lng ? 5.6 : 3.0) * max(grow, 1.0);       // 四边形半径 = size * ext，留出光晕与符纹环
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
float hsh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),u.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),u.x),u.y);}
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
  bool en = shape >= 16;
  if (en) { shape -= 16; if (vTrail > 240.0 && shape != 4 && shape != 6 && shape != 3) shape = 2; }
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
  if (en) {
    // 敌弹：白亮芯 + 本色外焰 + 暗色细描边。拉长类是两头收尖的能量弹（芯沿长轴、尾端渐细），
    // 圆类是白热芯硬边弹，flame 是圆头加短火尾。弹下垫窄墨影，亮背景上也能一眼看清。
    p /= vC.w;
    float AE = vC.y;
    vec3 base = vB.yzw;
    float lum = dot(base, vec3(0.3, 0.59, 0.11));
    base = clamp(mix(vec3(lum), base, 1.9), 0.0, 1.4) * 0.9;
    vec3 cBody = base * 1.2 + 0.08;
    vec3 cHot = mix(base * 1.5 + 0.35, vec3(2.8, 2.6, 2.3), 0.6);
    vec3 cWhite = vec3(2.8, 2.7, 2.5);
    float sp = smoothstep(160.0, 420.0, vTrail);
    float dE, rr, wh = -1.0, tA = 0.0, Wd = 1.0;
    vec3 tC = base;
    float Lf = 1.0, Lt = 1.0, W = 1.0;
    bool spin = true;
    float tp = 0.6;
    if (shape == 1) { Lf = 1.5; Lt = 5.2; W = 0.62; tp = 1.0; }
    else if (shape == 2) { Lf = 1.9; Lt = 5.4; W = 0.4; tp = 1.2; }
    else if (shape == 5) { Lf = 1.3; Lt = 4.6; W = 0.78; tp = 0.9; }
    else if (shape == 7) { Lf = 1.5; Lt = 4.2; W = 0.72; tp = 1.0; }
    else if (shape == 8) { Lf = 1.1; Lt = 3.6; W = 0.9; tp = 0.8; }
    else spin = false;
    if (spin) {
      // 弹头：前半椭圆加圆后背，实体加描边；弹尾：本色渐隐光迹，软边，不描边
      Lt = min(Lt * mix(1.0, 1.1, sp), 5.5);
      float x = p.x, ex = x >= 0.0 ? Lf : W * 1.1;
      Wd = W;
      float uf = x / Lf;
      if (x < 0.0) dE = (length(vec2(x / ex, p.y / W)) - 1.0) * min(ex, W);
      else if (uf >= 1.0) dE = length(vec2(x - Lf, p.y));
      else dE = (abs(p.y) - W * pow(1.0 - uf, tp));
      rr = length(vec2(x / ex, p.y / W));
      wh = length(vec2((x - 0.05) / (0.6 * Lf + 0.2), p.y / (0.5 * W)));
      float u = clamp(-x / Lt, 0.0, 1.0);
      float fk = shape == 8 ? 0.75 + 0.5 * noise(vec2(u * 4.0 - uTime * 18.0, vC.z * 40.0)) : 1.0;
      float tw = max(W * (1.0 - u) * fk, 0.04);
      tA = step(x, 0.0) * smoothstep(1.0, 0.5, abs(p.y) / tw) * pow(1.0 - u, 0.7);
      tC = mix(cBody * 0.9, base * 0.8, smoothstep(0.0, 0.5, u));
    } else if (shape == 3) {
      float a = age * 5.0 + vC.z * 6.28; float cs = cos(a), sn = sin(a);
      dE = sdStar(mat2(cs, -sn, sn, cs) * p, 1.15, 0.5);
      rr = length(p) / 1.15;
    } else if (shape == 4) { float rg = abs(length(p) - 0.8) / 0.22; dE = (rg - 1.0) * 0.22; rr = rg; }
    else { dE = length(p) - 1.0; rr = length(p); }
    float ae = fwidth(dE) * 1.2;
    float bodyE = smoothstep(ae, -ae, dE);
    float inkE = 1.0 - smoothstep(0.2, 0.2 + ae * 2.0, dE);
    float shadowE = exp(-max(dE, 0.0) * 2.2) * (spin ? 0.22 : 0.4);
    float rim = smoothstep(-0.12, -0.02, dE);
    vec3 f = mix(cBody * 0.75, cBody, smoothstep(1.0, 0.7, rr));
    if (spin) f = mix(f, cHot, smoothstep(0.9, 0.5, rr) * 0.5);
    else f = mix(f, cHot, smoothstep(0.72, 0.4, rr));
    f = mix(f, cWhite, spin ? smoothstep(1.0, 0.55, wh) : smoothstep(0.5, 0.2, rr));
    f = mix(f, base * 0.35, rim * (spin ? 0.5 : 0.7));
    vec3 emit = vec3(0.0);
    float ringA = 0.0;
    if (shape == 6) {
      float r0 = length(p), ang = atan(p.y, p.x) + uTime * 2.4;
      float band = smoothstep(0.06, 0.0, abs(r0 - 1.5));
      float seg = step(0.0, sin(ang * 5.0));
      float tick = smoothstep(0.1, 0.0, abs(r0 - 1.72)) * step(0.88, sin(ang * 12.0 - uTime * 3.0) * 0.5 + 0.5);
      ringA = clamp(band * (0.4 + 0.6 * seg) + tick, 0.0, 1.0);
      emit += cBody * ringA * 1.4;
    }
    float tailAlpha = 0.0;
    if (spin) {
      float halo = exp(-max(dE, 0.0) / (0.8 * Wd + 0.2)) * 0.5;
      emit += (tC * tA + base * 1.4 * halo * (1.0 - tA)) * (1.0 - inkE);
      tailAlpha = (tA + halo * 0.15) * (1.0 - inkE);
    }
    float fl = max(0.0, 1.0 - vC.x / 0.12);
    emit += vec3(2.6, 2.3, 1.9) * fl * fl * exp(-dot(p, p) * 0.9);
    float inkA = max(inkE, shadowE);
    vec3 rgb = f * bodyE * AE + vec3(0.012, 0.006, 0.01) * max(inkA - bodyE, 0.0) * AE + emit * AE;
    o = vec4(max(rgb, vec3(0.0)), clamp(max(max(inkA, ringA * 0.5), tailAlpha) * AE, 0.0, 1.0));
    return;
  }
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
