// 雷池：覆盖电场的单个四边形，片元里用噪声扭出环形电带、内部电纹与随机窜出的电弧；每帧只改 uniform，程序在构造时建一次。
import { PLAY_H, PLAY_W } from '../types';
import { Program, type GL } from './util';

const VS = `#version 300 es
uniform vec3 uBox;
out vec2 vP;
void main(){
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  vP = c * uBox.z;
  vec2 w = uBox.xy + vP;
  gl_Position = vec4(w.x / ${PLAY_W / 2}.0 - 1.0, 1.0 - w.y / ${PLAY_H / 2}.0, 0.0, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec2 vP;
uniform float uTime, uR, uFade, uK;
uniform vec3 uHit[8];
out vec4 o;
float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
vec4 over(vec4 top, vec4 under){ return top + under * (1.0 - top.a); }
vec4 layer(vec4 c, vec3 col, float a){ return over(vec4(col * a, a), c); }
vec4 glow(vec4 c, vec3 col, float g){ return c + vec4(col * g, 0.0); }
float segd(vec2 p, vec2 a, vec2 b, out float t){
  vec2 ba = b - a; t = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
  return length(p - a - ba * t);
}
void main(){
  float r = length(vP), a = atan(vP.y, vP.x);
  float R = uR * (1.0 - pow(1.0 - uK, 3.0));
  float rot = uTime * 0.55;
  vec2 dir = vec2(cos(a + rot), sin(a + rot));
  float flick = 1.0 + 0.7 * step(0.86, vn(vec2(uTime * 7.0, 3.0)));
  float boost = (1.0 + (1.0 - uK) * 2.5) * flick * uFade;
  vec4 c = vec4(0);

  // 环带：两股噪声扭动的电丝叠成约 22 像素厚的带，亮白芯、紫焰、暗紫描边
  float w1 = (vn(dir * 2.6 + vec2(uTime * 2.2, 1.7)) - 0.5) * 2.0 * 6.0 + (vn(dir * 5.0 + vec2(-uTime * 3.1, 9.0)) - 0.5) * 3.0;
  float w2 = (vn(dir * 3.1 + vec2(-uTime * 1.9, 5.3)) - 0.5) * 2.0 * 6.0 + (vn(dir * 6.5 + vec2(uTime * 3.7, 2.0)) - 0.5) * 3.0;
  float hw = 13.0 * (0.8 + 0.4 * vn(dir * 2.0 + uTime));
  float d1 = abs(r - R - w1), d2 = abs(r - R - w2), dm = abs(r - R - (w1 + w2) * 0.25);
  float body = smoothstep(hw, hw * 0.25, dm);
  float outline = smoothstep(hw + 6.0, hw - 1.0, dm);
  float f1 = exp(-d1 * d1 / 16.0), f2 = exp(-d2 * d2 / 16.0);
  float k1 = exp(-d1 * d1 / 7.0), k2 = exp(-d2 * d2 / 7.0);
  float halo = exp(-max(r - R - hw, 0.0) / 16.0) * smoothstep(0.0, 6.0, r - R + 30.0);
  float outer = step(R, r);
  float ringOn = uFade;

  // 环内：淡紫填充和流动电纹
  float inside = smoothstep(R + 2.0, R - 14.0, r);
  float n1 = vn(vP * 0.045 + vec2(uTime * 1.3, -uTime * 0.9)), n2 = vn(vP * 0.09 + vec2(-uTime * 1.7, uTime * 1.1) + 4.0);
  float vein = pow(max(0.0, 1.0 - abs(n1 * 2.0 - 1.0) * 3.2), 3.0) + 0.6 * pow(max(0.0, 1.0 - abs(n2 * 2.0 - 1.0) * 4.0), 3.0);
  float edge = smoothstep(R - 40.0, R, r);
  c = layer(c, vec3(0.22, 0.04, 0.55), inside * (0.10 + 0.18 * edge) * ringOn);
  c = glow(c, vec3(0.7, 0.35, 1.5), inside * vein * (0.12 + 0.35 * edge) * ringOn);

  // 电弧：每道独立周期，从环上窜出（或内缩）再收回
  float arcs = 0.0, arcCore = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= 8.0 * uFade) break;
    float T = 0.34 + 0.05 * fi, ph = uTime / T + fi * 0.37, cyc = floor(ph), f = fract(ph);
    float s = h11(cyc * 3.1 + fi * 17.0), s2 = h11(cyc * 5.7 + fi * 31.0);
    float ai = s * 6.2832, reach = (26.0 + 46.0 * s2) * sin(3.14159 * f);
    float q = (i & 1) == 0 ? r - R : R - r;
    float dA = (mod(a - ai + 3.14159, 6.2832) - 3.14159) * max(r, 1.0);
    float jag = (vn(vec2(q * 0.16, s * 40.0 + uTime * 14.0)) - 0.5) * 20.0 * min(1.0, q / 10.0);
    float lat = dA - jag;
    float on = step(0.0, q) * step(q, reach) * smoothstep(0.0, 4.0, reach);
    arcs += on * exp(-lat * lat / 24.0) * (1.0 - 0.5 * q / max(reach, 1.0));
    arcCore += on * exp(-lat * lat / 4.5);
  }

  // 毁弹：落点一闪，一道电弧顺环滑到旁边
  float hitG = 0.0, hitC = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 hh = uHit[i];
    if (hh.z >= 1.0) continue;
    float life = 1.0 - hh.z;
    vec2 hp = hh.xy;
    float ha = atan(hp.y, hp.x), off = (h11(floor(hp.x + hp.y * 7.0)) > 0.5 ? 1.0 : -1.0) * (0.45 + 0.3 * h11(hp.x));
    vec2 B = vec2(cos(ha + off), sin(ha + off)) * R;
    float t; float dd = segd(vP, hp, B, t);
    float jj = (vn(vec2(t * 7.0, hp.x + uTime * 30.0)) - 0.5) * 14.0 * sin(3.14159 * t);
    vec2 nrm = normalize(vec2(-(B - hp).y, (B - hp).x) + 1e-4);
    float lat = dot(vP - hp - (B - hp) * t, nrm) - jj;
    hitG += life * (exp(-lat * lat / 8.0) * 0.8 * step(0.0, abs(t)) ) + life * life * exp(-dot(vP - hp, vP - hp) / 260.0) * 2.5;
    hitC += life * exp(-lat * lat / 1.2) + life * exp(-dot(vP - hp, vP - hp) / 40.0) * 2.0;
  }

  // 合成：先暗紫描边（普通混合，亮背景上也压得住），再紫焰、白芯，最后加色光晕
  c = layer(c, vec3(0.07, 0.01, 0.2), outline * 0.9 * ringOn);
  c = layer(c, vec3(0.20, 0.02, 0.55), body * 0.95 * ringOn);
  c = layer(c, vec3(0.62, 0.22, 1.25), clamp(f1 + f2, 0.0, 1.0) * 0.8 * ringOn);
  c = glow(c, vec3(2.4, 2.3, 2.9), (k1 + k2) * 1.5 * boost);
  c = glow(c, vec3(0.55, 0.2, 1.2), halo * 0.3 * boost);
  c = layer(c, vec3(0.12, 0.015, 0.3), clamp(arcs * 1.6, 0.0, 1.0) * 0.8);
  c = glow(c, vec3(0.9, 0.5, 1.8), arcs * 1.1 * boost);
  c = glow(c, vec3(2.4, 2.3, 2.9), arcCore * 1.5 * boost);
  c = glow(c, vec3(1.0, 0.85, 1.8), hitG * 0.7);
  c = glow(c, vec3(2.6, 2.5, 3.0), hitC);
  // 展开瞬间：圆盘白闪
  c = glow(c, vec3(1.4, 1.3, 2.0), (1.0 - uK) * (1.0 - uK) * smoothstep(R + 6.0, 0.0, r) * 1.2);
  o = c;
}`;

const HIT_LIFE = 0.14;

export class LeichiSystem {
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private on = false;
  private x = 0; private y = 0; private R = 110; private k = 1; private fade = 1; private time = 0;
  private hits = new Float32Array(24);

  constructor(readonly gl: GL) {
    this.prog = new Program(gl, VS, FS);
    this.vao = gl.createVertexArray()!;
    this.hits.fill(0);
    for (let i = 0; i < 8; i++) this.hits[i * 3 + 2] = 1;
  }

  /** 每帧调用一次：k 为展开进度 0..1，fade 为尾段淡出 0..1，hits 为世界坐标毁弹点与已过去的秒数。 */
  set(x: number, y: number, R: number, k: number, fade: number, time: number, hits: readonly { x: number; y: number; age: number }[]): void {
    this.on = true; this.x = x; this.y = y; this.R = R; this.k = k; this.fade = fade; this.time = time;
    for (let i = 0; i < 8; i++) {
      const h = hits[i];
      this.hits[i * 3] = h ? h.x - x : 0; this.hits[i * 3 + 1] = h ? h.y - y : 0; this.hits[i * 3 + 2] = h ? h.age / HIT_LIFE : 1;
    }
  }

  draw(): void {
    if (!this.on) return;
    this.on = false;
    const gl = this.gl, half = this.R + 90;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.prog.use().set('uBox', this.x, this.y, half).set('uTime', this.time).set('uR', this.R).set('uFade', this.fade).set('uK', this.k).set('uHit', this.hits);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}
