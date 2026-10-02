// 实例化精灵批渲染。所有层共享一个程序和 GPU 缓冲，CPU 端各层独立累积。
import { PLAY_H, PLAY_W } from '../types';
import type { Atlas, SpriteInfo } from './atlas';
import { Program, type GL } from './util';
import type { SpritePlayback } from '../art/playback';

const VS = `#version 300 es
layout(location=0) in vec4 aA;   // x, y, rot, layer
layout(location=1) in vec4 aB;   // w, h, flash, glow
layout(location=2) in vec4 aUV;  // u0 v0 u1 v1
layout(location=3) in vec4 aTint;// rgb, alpha
layout(location=4) in vec4 aDeform; // 弯曲、摆动、呼吸、相位
layout(location=5) in vec4 aWeight; // UV.y 起止权重、角速度、启用
layout(location=6) in vec4 aPivot;
uniform vec2 uView;
uniform vec2 uOffset;
uniform float uShadowScale;
uniform float uTime;
uniform float uGrid;
out vec3 vUV;
out vec4 vTint;
out vec2 vFG;
void main() {
  int cell = gl_VertexID / 6, vertex = gl_VertexID % 6;
  int k = vertex == 3 ? 2 : (vertex == 4 ? 1 : (vertex == 5 ? 3 : vertex));
  vec2 corner = vec2(float(k & 1), (float(cell) + float(k >> 1)) / 12.0);
  if (uGrid == 0.0) corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 local = (corner - 0.5) * aB.xy;
  if (aWeight.w > 0.0) {
    float weight = smoothstep(aWeight.x, aWeight.y, corner.y);
    float phase = uTime * aWeight.z + aDeform.w;
    local.x += (aDeform.x * sin(phase + corner.y * 1.7) + aDeform.y * sin(phase) * (corner.y - 0.5)) * weight * sign(aB.x);
    local *= 1.0 + aDeform.z * sin(phase) * weight;
  }
  local = (local - aPivot.xy) * uShadowScale;
  float c = cos(aA.z), s = sin(aA.z);
  vec2 p = aA.xy + vec2(local.x * c - local.y * s, local.x * s + local.y * c) + uOffset;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vUV = vec3(mix(aUV.xy, aUV.zw, corner), aA.w);
  vTint = aTint;
  vFG = aB.zw;
}`;

const FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uAlb;
uniform sampler2DArray uGlow;
uniform float uMode;      // 0 普通 1 投影 2 纯加色
uniform float uGlowMul;
uniform float uShadowLod;
uniform float uShadowAlpha;
in vec3 vUV;
in vec4 vTint;
in vec2 vFG;
out vec4 o;
void main() {
  if (uMode == 1.0) {
    float a = textureLod(uAlb, vUV, uShadowLod).a;
    o = vec4(0.0, 0.0, 0.0, a * vTint.a * uShadowAlpha);
    return;
  }
  vec4 al = texture(uAlb, vUV);
  vec3 gl = texture(uGlow, vUV).rgb;
  float a = vTint.a;
  vec3 col = al.rgb * vTint.rgb + vFG.x * al.a * vec3(1.6, 1.45, 1.3);
  vec3 emit = gl * vFG.y * uGlowMul * (1.0 + vFG.x * 2.0);
  if (uMode == 2.0) o = vec4((col + emit) * a, 0.0);
  else o = vec4(col * a + emit * a, al.a * a);
}`;

const FLOATS = 28;

/** 视觉形变的逻辑单位幅度，weight 为 UV.y 区域；碰撞与炮口用静态挂点。 */
export interface SpriteDeform {
  bend?: number;
  sway?: number;
  breath?: number;
  phase?: number;
  speed?: number;
  weight?: [number, number];
}

export interface SpriteDraw {
  x: number;
  y: number;
  rot?: number;
  sx?: number;
  sy?: number;
  frame?: number;
  /** 实体自己的播放实例；调用方在更新阶段推进。可与 deform、旋转、挂点组合。 */
  animation?: SpritePlayback;
  flash?: number;
  glow?: number;
  r?: number;
  g?: number;
  b?: number;
  alpha?: number;
  deform?: SpriteDeform;
}

export class SpriteLayer {
  data: Float32Array;
  count = 0;
  deformed = false;
  constructor(readonly atlas: Atlas, cap = 2048) {
    this.data = new Float32Array(cap * FLOATS);
  }
  private grow(): void {
    const n = new Float32Array(this.data.length * 2);
    n.set(this.data);
    this.data = n;
  }
  /** 按精灵 id 绘制。 */
  add(id: string | SpriteInfo, d: SpriteDraw): void {
    const info = typeof id === 'string' ? this.atlas.get(id) : id;
    const fr = info.frames[(d.animation?.frame ?? d.frame ?? 0) % info.frames.length] ?? info.frames[0];
    this.raw(d.x, d.y, d.rot ?? 0, info.w * (d.sx ?? 1), info.h * (d.sy ?? 1), fr.layer, fr.u0, fr.v0, fr.u1, fr.v1,
      d.flash ?? 0, d.glow ?? 1, d.r ?? 1, d.g ?? 1, d.b ?? 1, d.alpha ?? 1, d.deform,
      info.pivot[0] * (d.sx ?? 1), info.pivot[1] * (d.sy ?? 1));
  }
  raw(x: number, y: number, rot: number, w: number, h: number, layer: number,
    u0: number, v0: number, u1: number, v1: number, flash: number, glow: number,
    r: number, g: number, b: number, a: number, deform?: SpriteDeform, pivotX = 0, pivotY = 0): void {
    if ((this.count + 1) * FLOATS > this.data.length) this.grow();
    const o = this.count * FLOATS;
    const D = this.data;
    D[o] = x; D[o + 1] = y; D[o + 2] = rot; D[o + 3] = layer;
    D[o + 4] = w; D[o + 5] = h; D[o + 6] = flash; D[o + 7] = glow;
    D[o + 8] = u0; D[o + 9] = v0; D[o + 10] = u1; D[o + 11] = v1;
    D[o + 12] = r; D[o + 13] = g; D[o + 14] = b; D[o + 15] = a;
    D[o + 16] = deform?.bend ?? 0; D[o + 17] = deform?.sway ?? 0; D[o + 18] = deform?.breath ?? 0; D[o + 19] = deform?.phase ?? 0;
    D[o + 20] = deform?.weight?.[0] ?? 0; D[o + 21] = deform?.weight?.[1] ?? 1;
    D[o + 22] = deform?.speed ?? 3; D[o + 23] = deform ? 1 : 0;
    D[o + 24] = pivotX; D[o + 25] = pivotY; D[o + 26] = 0; D[o + 27] = 0;
    if (deform) this.deformed = true;
    this.count++;
  }
  clear(): void {
    this.count = 0;
    this.deformed = false;
  }
}

export class SpriteRenderer {
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private cap = 0;
  glowMul = 2.6;
  time = 0;

  constructor(readonly gl: GL, readonly atlas: Atlas) {
    this.prog = new Program(gl, VS, FS);
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    for (let i = 0; i < 7; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, FLOATS * 4, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
  }

  layer(cap?: number): SpriteLayer {
    return new SpriteLayer(this.atlas, cap);
  }

  /** mode: 0 普通，1 投影（offset 为投影偏移），2 纯加色。 */
  draw(layer: SpriteLayer, mode = 0, offset: [number, number] = [0, 0], shadowScale = 1): void {
    if (layer.count === 0) return;
    const gl = this.gl;
    const bytes = layer.count * FLOATS * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (bytes > this.cap) {
      this.cap = Math.max(bytes, this.cap * 2);
      gl.bufferData(gl.ARRAY_BUFFER, this.cap, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, layer.data, 0, layer.count * FLOATS);
    this.prog.use()
      .set('uView', PLAY_W, PLAY_H)
      .set('uOffset', offset[0], offset[1])
      .set('uShadowScale', shadowScale)
      .set('uTime', this.time)
      .set('uGrid', layer.deformed ? 1 : 0)
      .set('uMode', mode)
      .set('uGlowMul', this.glowMul)
      .set('uShadowLod', 3.5)
      .set('uShadowAlpha', 0.42)
      .tex('uAlb', this.atlas.albedo, gl.TEXTURE_2D_ARRAY)
      .tex('uGlow', this.atlas.glow, gl.TEXTURE_2D_ARRAY);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(layer.deformed ? gl.TRIANGLES : gl.TRIANGLE_STRIP, 0, layer.deformed ? 12 * 6 : 4, layer.count);
    gl.bindVertexArray(null);
  }
}
