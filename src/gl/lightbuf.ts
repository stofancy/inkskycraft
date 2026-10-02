// 弹光缓冲：约 1/4 分辨率的 HDR 光照图（屏幕空间，与游戏区同一映射）。
// 每帧在画背景之前，把敌弹、玩家子弹、激光、火球以柔和光斑加色绘入；3D 背景在光照函数里按屏幕投影采样它，
// 于是弹幕会在下方的山体与雾上投下彩色光晕。光斑以线段（含退化为点）为单位，一次实例化绘制。
import { PLAY_H, PLAY_W } from '../types';
import { Program, Target, type GL } from './util';

const VS = `#version 300 es
layout(location=0) in vec4 aA;  // ax ay bx by
layout(location=1) in vec4 aB;  // r g b radius
uniform vec2 uView;
out vec2 vL;            // 以 radius 为单位、相对线段中心的 (沿线, 垂直)
flat out float vHalf;   // 线段半长（radius 单位）
flat out vec3 vCol;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 d = aA.zw - aA.xy;
  float len = length(d);
  vec2 dir = len > 0.001 ? d / len : vec2(1.0, 0.0);
  float rad = aB.w;
  float ext = 1.6;   // 高斯截断半径（radius 的倍数）
  vec2 c = (aA.xy + aA.zw) * 0.5;
  vec2 p = c + dir * corner.x * (len * 0.5 + rad * ext) + vec2(-dir.y, dir.x) * corner.y * rad * ext;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vL = vec2(corner.x * (len * 0.5 + rad * ext), corner.y * rad * ext) / rad;
  vHalf = len * 0.5 / rad;
  vCol = aB.rgb;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vL;
flat in float vHalf;
flat in vec3 vCol;
out vec4 o;
void main() {
  vec2 q = vec2(max(abs(vL.x) - vHalf, 0.0), vL.y);
  float d2 = dot(q, q);
  float a = exp(-d2 * 2.6) * smoothstep(2.56, 1.6, d2);
  o = vec4(vCol * a, 0.0);
}`;

const F = 8;

export class LightBuffer {
  readonly target: Target;
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private data = new Float32Array(4096 * F);
  private n = 0;
  private cap = 0;
  /** 相对游戏区像素尺寸的分辨率比例。 */
  scale = 0.25;

  constructor(readonly gl: GL) {
    this.target = new Target(gl, 8, 8, 'rgba16f');
    this.prog = new Program(gl, VS, FS);
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    for (let i = 0; i < 2; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, F * 4, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
  }

  resize(playW: number, playH: number): void {
    this.target.resize(Math.max(16, playW * this.scale), Math.max(16, playH * this.scale));
  }

  /** 线段光斑（点光传 a = b）。radius 为游戏单位，(r,g,b) 为线性 HDR 强度。 */
  seg(ax: number, ay: number, bx: number, by: number, radius: number, r: number, g: number, b: number): void {
    if ((this.n + 1) * F > this.data.length) {
      const d = new Float32Array(this.data.length * 2);
      d.set(this.data);
      this.data = d;
    }
    const o = this.n++ * F, D = this.data;
    D[o] = ax; D[o + 1] = ay; D[o + 2] = bx; D[o + 3] = by;
    D[o + 4] = r; D[o + 5] = g; D[o + 6] = b; D[o + 7] = radius;
  }

  blob(x: number, y: number, radius: number, r: number, g: number, b: number): void {
    this.seg(x, y, x, y, radius, r, g, b);
  }

  get count(): number { return this.n; }

  /** 绘制并清空。 */
  flush(): void {
    const gl = this.gl;
    this.target.bind([0, 0, 0, 0]);
    if (this.n) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      const bytes = this.n * F * 4;
      if (bytes > this.cap) {
        this.cap = Math.max(bytes, this.cap * 2);
        gl.bufferData(gl.ARRAY_BUFFER, this.cap, gl.DYNAMIC_DRAW);
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * F);
      this.prog.use().set('uView', PLAY_W, PLAY_H);
      gl.bindVertexArray(this.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    }
    this.n = 0;
  }
}

