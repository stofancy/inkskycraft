// 全屏 GPU 墨流体（Stable Fluids）：爆炸、尾流、一笔、泼墨把墨与光注入流场，涡量约束让墨色翻卷。
// 速度场单位：游戏区单位/秒，纹理空间 y 向上。墨场 rgb=预乘颜料，a=浓度；光场 rgb=发光。
import { PLAY_H, PLAY_W } from '../types';
import { DoubleTarget, FS_TRI_VS, Program, Target, fullscreen, type GL } from './util';

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
`;

const ADVECT = HEAD + `
uniform sampler2D uVel;
uniform sampler2D uSrc;
uniform vec2 uWorld;
uniform vec2 uDrift;
uniform float uDt;
uniform float uDecay;
uniform float uClampA;
void main() {
  vec2 vel = texture(uVel, vUv).xy + uDrift;
  vec2 c = vUv - uDt * vel / uWorld;
  vec4 v = texture(uSrc, c) * uDecay;
  if (uClampA > 0.5 && v.a > 1.0) v /= v.a;
  o = v;
}`;

const CURL = HEAD + `
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORT = HEAD + `
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uCurlK;
uniform float uDt;
void main() {
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= uCurlK * C;
  f.y = -f.y;
  vec2 v = texture(uVel, vUv).xy + f * uDt;
  o = vec4(clamp(v, -3000.0, 3000.0), 0.0, 1.0);
}`;

const DIV = HEAD + `
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const PRESSURE = HEAD + `
uniform sampler2D uP;
uniform sampler2D uDiv;
uniform vec2 uTexel;
void main() {
  float L = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
  float d = texture(uDiv, vUv).x;
  o = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
}`;

const SCALE = HEAD + `
uniform sampler2D uSrc;
uniform float uK;
void main() { o = texture(uSrc, vUv) * uK; }`;

const GRADSUB = HEAD + `
uniform sampler2D uP;
uniform sampler2D uVel;
uniform vec2 uTexel;
uniform float uDamp;
void main() {
  float L = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
  vec2 v = texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B);
  o = vec4(v * uDamp, 0.0, 1.0);
}`;

const SPLAT_VS = `#version 300 es
layout(location=0) in vec4 aA; // x y (uv), radius(单位), mode
layout(location=1) in vec4 aB; // vx vy (单位/秒, y 向上), -, -
layout(location=2) in vec4 aC; // 墨 rgba（预乘）
layout(location=3) in vec4 aD; // 光 rgb, -
uniform vec2 uWorld;
out vec2 vD;
flat out vec4 vB;
flat out vec4 vC;
flat out vec4 vDd;
flat out float vR;
flat out float vMode;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  float ext = aA.z * 2.6;
  vec2 uv = aA.xy + corner * ext / uWorld;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  vD = corner * ext;
  vB = aB; vC = aC; vDd = aD; vR = aA.z; vMode = aA.w;
}`;

const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 vD;
flat in vec4 vB;
flat in vec4 vC;
flat in vec4 vDd;
flat in float vR;
flat in float vMode;
uniform int uTarget; // 0 速度 1 墨 2 光
out vec4 o;
void main() {
  float g = exp(-dot(vD, vD) / (vR * vR));
  if (g < 0.003) discard;
  if (uTarget == 0) {
    vec2 v = vMode > 0.5 ? normalize(vD + 1e-4) * vB.x : vB.xy;
    o = vec4(v * g, 0.0, 0.0);
  } else if (uTarget == 1) {
    o = vC * g;
  } else {
    o = vec4(vDd.rgb * g, 0.0);
  }
}`;

const COMPOSITE = HEAD + `
uniform sampler2D uInk;
uniform sampler2D uGlow;
uniform vec2 uTexel;
uniform float uOpacity;
uniform float uGlowMul;
uniform float uTime;
float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec4 ink = texture(uInk, vUv);
  float a = ink.a;
  vec3 glow = texture(uGlow, vUv).rgb * uGlowMul;
  if (a < 0.002) { o = vec4(glow, 0.0); return; }
  vec2 t = uTexel * 1.5;
  float gx = texture(uInk, vUv + vec2(t.x, 0.0)).a - texture(uInk, vUv - vec2(t.x, 0.0)).a;
  float gy = texture(uInk, vUv + vec2(0.0, t.y)).a - texture(uInk, vUv - vec2(0.0, t.y)).a;
  float edge = clamp(length(vec2(gx, gy)) * 4.0, 0.0, 1.0);        // 水渍边：墨边更浓
  float grain = h(floor(vUv / uTexel * 2.0)) * 0.25 + 0.875;         // 纸面颗粒
  float A = clamp((a * 0.85 + edge * 0.45 * smoothstep(0.02, 0.2, a)) * grain * uOpacity, 0.0, 0.9);
  vec3 pig = ink.rgb / max(a, 1e-3);
  o = vec4(pig * A + glow, A);
}`;

const FLOATS = 16;

export interface Splat {
  x: number; y: number;            // 游戏区坐标（y 向下）
  r: number;                        // 半径（单位）
  vx?: number; vy?: number;         // 速度（单位/秒，y 向下）；radial 时 vx 为径向速度
  radial?: boolean;
  ink?: [number, number, number, number]; // 颜料（线性，非预乘）+ 浓度
  glow?: [number, number, number];
}

export class Fluid {
  private vel: DoubleTarget;
  private pres: DoubleTarget;
  private div: Target;
  private curl: Target;
  ink: DoubleTarget;
  glow: DoubleTarget;
  private pAdvect: Program;
  private pCurl: Program;
  private pVort: Program;
  private pDiv: Program;
  private pPres: Program;
  private pScale: Program;
  private pGrad: Program;
  private pSplat: Program;
  private pComp: Program;
  private splatVao: WebGLVertexArrayObject;
  private splatVbo: WebGLBuffer;
  private splats = new Float32Array(4096 * FLOATS);
  private nSplats = 0;
  private dyeSplats = 0;
  simW = 0; simH = 0; dyeW = 0; dyeH = 0;
  curlK = 18;
  iterations = 24;
  /** 墨向下漂移速度（单位/秒，随滚动速度设置）。 */
  drift = 40;
  inkDecay = 0.3;
  glowDecay = 2.2;
  velDamp = 0.6;
  opacity = 1;

  constructor(readonly gl: GL, quality: 'high' | 'ultra') {
    const [sw, dw] = quality === 'ultra' ? [288, 1350] : [144, 600];
    this.simW = sw; this.simH = Math.round(sw * 4 / 3);
    this.dyeW = dw; this.dyeH = Math.round(dw * 4 / 3);
    const L = gl.LINEAR;
    this.vel = new DoubleTarget(gl, this.simW, this.simH, 'rg16f', L);
    this.pres = new DoubleTarget(gl, this.simW, this.simH, 'r16f', gl.NEAREST);
    this.div = new Target(gl, this.simW, this.simH, 'r16f', gl.NEAREST);
    this.curl = new Target(gl, this.simW, this.simH, 'r16f', gl.NEAREST);
    this.ink = new DoubleTarget(gl, this.dyeW, this.dyeH, 'rgba16f', L);
    this.glow = new DoubleTarget(gl, this.dyeW, this.dyeH, 'rgba16f', L);
    for (const t of [this.vel, this.pres, this.ink, this.glow]) { t.read.bind([0, 0, 0, 0]); t.write.bind([0, 0, 0, 0]); }
    this.pAdvect = new Program(gl, FS_TRI_VS, ADVECT);
    this.pCurl = new Program(gl, FS_TRI_VS, CURL);
    this.pVort = new Program(gl, FS_TRI_VS, VORT);
    this.pDiv = new Program(gl, FS_TRI_VS, DIV);
    this.pPres = new Program(gl, FS_TRI_VS, PRESSURE);
    this.pScale = new Program(gl, FS_TRI_VS, SCALE);
    this.pGrad = new Program(gl, FS_TRI_VS, GRADSUB);
    this.pSplat = new Program(gl, SPLAT_VS, SPLAT_FS);
    this.pComp = new Program(gl, FS_TRI_VS, COMPOSITE);
    this.splatVao = gl.createVertexArray()!;
    this.splatVbo = gl.createBuffer()!;
    gl.bindVertexArray(this.splatVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.splats.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, FLOATS * 4, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  splat(s: Splat): void {
    if (this.nSplats >= 4096) return;
    const o = this.nSplats++ * FLOATS, D = this.splats;
    D[o] = s.x / PLAY_W; D[o + 1] = 1 - s.y / PLAY_H; D[o + 2] = s.r; D[o + 3] = s.radial ? 1 : 0;
    D[o + 4] = s.vx ?? 0; D[o + 5] = s.radial ? 0 : -(s.vy ?? 0); D[o + 6] = 0; D[o + 7] = 0;
    const ink = s.ink ?? [0, 0, 0, 0];
    D[o + 8] = ink[0] * ink[3]; D[o + 9] = ink[1] * ink[3]; D[o + 10] = ink[2] * ink[3]; D[o + 11] = ink[3];
    const g = s.glow ?? [0, 0, 0];
    D[o + 12] = g[0]; D[o + 13] = g[1]; D[o + 14] = g[2]; D[o + 15] = 0;
    if (s.ink || s.glow) this.dyeSplats++;
  }

  clear(): void {
    for (const t of [this.vel, this.pres, this.ink, this.glow]) { t.read.bind([0, 0, 0, 0]); t.write.bind([0, 0, 0, 0]); }
    this.nSplats = 0;
  }

  private pass(p: Program, target: Target): void {
    target.bind();
    p.use();
    fullscreen(this.gl);
  }

  step(dt: number): void {
    const gl = this.gl;
    if (dt <= 0) return;
    gl.disable(gl.BLEND);
    const texel = [1 / this.simW, 1 / this.simH];
    // 注入
    if (this.nSplats) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.splats, 0, this.nSplats * FLOATS);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.pSplat.use().set('uWorld', PLAY_W, PLAY_H);
      gl.bindVertexArray(this.splatVao);
      const targets: [Target, number][] = [[this.vel.read, 0]];
      if (this.dyeSplats) targets.push([this.ink.read, 1], [this.glow.read, 2]);
      for (const [t, id] of targets) {
        t.bind();
        this.pSplat.set('uTarget', id);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.nSplats);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
      this.nSplats = 0;
      this.dyeSplats = 0;
    }
    // 涡量
    this.pCurl.use().set('uTexel', texel).tex('uVel', this.vel.read.tex);
    this.pass(this.pCurl, this.curl);
    this.pVort.use().set('uTexel', texel).set('uCurlK', this.curlK).set('uDt', dt).tex('uVel', this.vel.read.tex).tex('uCurl', this.curl.tex);
    this.pass(this.pVort, this.vel.write);
    this.vel.swap();
    // 投影
    this.pDiv.use().set('uTexel', texel).tex('uVel', this.vel.read.tex);
    this.pass(this.pDiv, this.div);
    this.pScale.use().set('uK', 0.8).tex('uSrc', this.pres.read.tex);
    this.pass(this.pScale, this.pres.write);
    this.pres.swap();
    this.pPres.use().set('uTexel', texel).tex('uDiv', this.div.tex);
    for (let i = 0; i < this.iterations; i++) {
      this.pPres.tex('uP', this.pres.read.tex);
      this.pass(this.pPres, this.pres.write);
      this.pres.swap();
    }
    this.pGrad.use().set('uTexel', texel).set('uDamp', Math.exp(-this.velDamp * dt)).tex('uP', this.pres.read.tex).tex('uVel', this.vel.read.tex);
    this.pass(this.pGrad, this.vel.write);
    this.vel.swap();
    // 平流
    this.pAdvect.use().set('uWorld', PLAY_W, PLAY_H).set('uDt', dt).set('uDrift', 0, 0).set('uDecay', 1).set('uClampA', 0)
      .tex('uVel', this.vel.read.tex).tex('uSrc', this.vel.read.tex);
    this.pass(this.pAdvect, this.vel.write);
    this.vel.swap();
    this.pAdvect.set('uDrift', 0, -this.drift).set('uDecay', Math.exp(-this.inkDecay * dt)).set('uClampA', 1)
      .tex('uVel', this.vel.read.tex).tex('uSrc', this.ink.read.tex);
    this.pass(this.pAdvect, this.ink.write);
    this.ink.swap();
    this.pAdvect.set('uDecay', Math.exp(-this.glowDecay * dt)).set('uClampA', 0).tex('uSrc', this.glow.read.tex);
    this.pass(this.pAdvect, this.glow.write);
    this.glow.swap();
  }

  /** 把墨与光合成进当前绑定的目标（需预乘混合）。 */
  composite(time: number, glowMul = 1): void {
    this.pComp.use()
      .set('uTexel', 1 / this.dyeW, 1 / this.dyeH)
      .set('uOpacity', this.opacity)
      .set('uGlowMul', glowMul)
      .set('uTime', time)
      .tex('uInk', this.ink.read.tex)
      .tex('uGlow', this.glow.read.tex);
    fullscreen(this.gl);
  }
}
