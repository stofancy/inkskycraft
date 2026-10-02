// 扭折的三维雷刃：扁菱截面、真实面法线、独立深度缓冲与 HDR 合成。
import { PLAY_H, PLAY_W } from '../types';
import { FS_TRI_VS, Program, Target, fullscreen, type GL } from './util';

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aData;
out vec3 vNormal;
out vec4 vData;
void main(){
  float w = 1.0 - aPos.z / 900.0;
  gl_Position = vec4(aPos.x / ${PLAY_W / 2}.0, -aPos.y / ${PLAY_H / 2}.0, -aPos.z / 230.0 * w, w);
  vNormal = aNormal;
  vData = aData;
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec4 vData;
uniform float uTime;
out vec4 o;
void main(){
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  float side = vData.y;
  float core = exp(-side * side * 48.0);
  float lit = max(0.0, dot(N, normalize(vec3(-0.55, -0.3, 0.8))));
  float rim = pow(1.0 - abs(N.z), 2.0);
  float flow = 0.72 + 0.28 * sin(vData.x * 0.075 - uTime * 30.0);
  float fiber = pow(max(0.0, sin(vData.x * 0.26 - side * 14.0 - uTime * 48.0)), 8.0);
  vec3 violet = mix(vec3(0.11, 0.025, 0.32), vec3(0.65, 0.12, 1.2), lit);
  vec3 gold = vec3(2.4, 1.25, 0.29) * (0.65 + lit * 0.6);
  vec3 col = violet * (0.75 + rim * 0.75) + gold * core * 0.85;
  col += vec3(2.2, 1.95, 1.35) * core * flow * (0.6 + lit * 0.7);
  col += vec3(0.35, 0.10, 0.65) * fiber * (1.0 - core);
  float a = clamp(vData.z, 0.0, 1.0);
  col *= mix(1.0, 0.72, vData.w);
  o = vec4(col * a, a);
}`;
const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 o;
void main(){ o = texture(uTex, vUv); }`;

interface P3 { x: number; y: number; z: number }
const cross = (a: P3, b: P3): P3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a: P3): P3 => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const sub = (a: P3, b: P3): P3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export class ThunderSystem {
  private data: number[] = [];
  private prog: Program;
  private composite: Program;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private target: Target;
  private depth: WebGLRenderbuffer;
  private dw = 0;
  private dh = 0;

  constructor(readonly gl: GL) {
    this.prog = new Program(gl, VS, FS);
    this.composite = new Program(gl, FS_TRI_VS, COMPOSITE);
    this.target = new Target(gl, 4, 4, 'rgba16f');
    this.depth = gl.createRenderbuffer()!;
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    for (const [loc, size, offset] of [[0, 3, 0], [1, 3, 12], [2, 4, 24]]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, offset);
    }
    gl.bindVertexArray(null);
  }

  /** pts 为屏幕 x/y；逐点反投影保留枪口、命中与分叉的位置。 */
  path(pts: ArrayLike<number>, width: number | ArrayLike<number>, alpha: number, phase: number, branch = false): void {
    const n = Math.floor(pts.length / 2);
    if (n < 2 || alpha <= 0) return;
    const centers: P3[] = [], rings: P3[][] = [], lens: number[] = [0];
    const len = Math.hypot(pts[pts.length - 2] - pts[0], pts[pts.length - 1] - pts[1]);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const z = Math.sin(Math.PI * t) * Math.min(branch ? 28 : 90, len * 0.23) *
        (Math.sin(t * Math.PI * 3.6 + phase) * 0.72 + Math.sin(t * Math.PI * 7 + phase * 0.7) * 0.28);
      const w = 1 - z / 900;
      centers.push({ x: (pts[i * 2] - PLAY_W / 2) * w, y: (pts[i * 2 + 1] - PLAY_H / 2) * w, z });
      if (i) lens.push(lens[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]));
    }
    // 四个锋面形成扁菱雷刃；截面逐段翻转，露出紫色背面与金色刃脊。
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), c = centers[i];
      const tangent = unit(sub(centers[Math.min(n - 1, i + 1)], centers[Math.max(0, i - 1)]));
      const side = unit({ x: -tangent.y, y: tangent.x, z: 0 });
      const up = unit(cross(tangent, side));
      const angle = phase * 0.27 + t * 6.5 + Math.sin(t * 11 + phase) * 0.65;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const s = { x: side.x * ca + up.x * sa, y: side.y * ca + up.y * sa, z: side.z * ca + up.z * sa };
      const b = { x: -side.x * sa + up.x * ca, y: -side.y * sa + up.y * ca, z: -side.z * sa + up.z * ca };
      const radius = (typeof width === 'number' ? width : width[i]) * (branch ? 1.05 : 1.65) * (1 - c.z / 900);
      rings.push([[1, 0], [0, 0.36], [-1, 0], [0, -0.36]].map(([x, y]) => ({ x: c.x + radius * (s.x * x + b.x * y), y: c.y + radius * (s.y * x + b.y * y), z: c.z + radius * (s.z * x + b.z * y) })));
    }
    const sides = [1, 0, -1, 0];
    const tri = (p: P3[], us: number[], ss: number[]): void => {
      const normal = unit(cross(sub(p[1], p[0]), sub(p[2], p[0])));
      for (let j = 0; j < 3; j++) this.data.push(p[j].x, p[j].y, p[j].z, normal.x, normal.y, normal.z, us[j], ss[j], alpha, branch ? 1 : 0);
    };
    for (let i = 1; i < n; i++) for (let k = 0; k < 4; k++) {
      const next = (k + 1) % 4, a = rings[i - 1][k], b = rings[i - 1][next], c = rings[i][k], d = rings[i][next];
      tri([a, b, c], [lens[i - 1], lens[i - 1], lens[i]], [sides[k], sides[next], sides[k]]);
      tri([b, d, c], [lens[i - 1], lens[i], lens[i]], [sides[next], sides[next], sides[k]]);
    }
    for (const i of [0, n - 1]) for (let k = 0; k < 4; k++) tri([centers[i], rings[i][k], rings[i][(k + 1) % 4]], [lens[i], lens[i], lens[i]], [0, sides[k], sides[(k + 1) % 4]]);
  }

  draw(time: number, scene: Target): void {
    if (!this.data.length) return;
    const gl = this.gl;
    const depthEnabled = gl.isEnabled(gl.DEPTH_TEST), cullEnabled = gl.isEnabled(gl.CULL_FACE);
    const depthWrite = gl.getParameter(gl.DEPTH_WRITEMASK) as boolean;
    const depthFunc = gl.getParameter(gl.DEPTH_FUNC) as number;
    if (this.dw !== scene.w || this.dh !== scene.h) {
      this.target.resize(scene.w, scene.h);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, scene.w, scene.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
      this.dw = scene.w; this.dh = scene.h;
    }
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.clearDepth(1);
    this.target.bind([0, 0, 0, 0]);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.data), gl.DYNAMIC_DRAW);
    this.prog.use().set('uTime', time);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.data.length / 10);
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    scene.bind();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.composite.use().tex('uTex', this.target.tex);
    fullscreen(gl);
    gl.bindVertexArray(null);
    gl.depthMask(depthWrite);
    gl.depthFunc(depthFunc);
    if (depthEnabled) gl.enable(gl.DEPTH_TEST);
    if (cullEnabled) gl.enable(gl.CULL_FACE);
  }

  clear(): void { this.data.length = 0; }
}
