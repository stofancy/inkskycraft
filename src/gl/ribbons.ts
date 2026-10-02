// 动态光带：激光、雷弧、一笔墨迹、拖尾、敌方激光预警线。CPU 每帧生成三角形。
import { PLAY_H, PLAY_W } from '../types';
import { Program, type GL } from './util';

export enum RS {
  Beam = 0,      // 激光（加色）
  Lightning = 1, // 雷弧（加色）
  Brush = 2,     // 墨迹（混合 + 朱砂边光）
  Trail = 3,     // 拖尾（加色，沿 u 渐隐）
  Warn = 4,      // 预警虚线（加色）
  InkTrail = 5,  // 墨色拖尾（混合）
  Bolt = 6,      // 雷主干：飞白干笔断续（加色）
  Glow = 7,      // 纯软辉光（加色）
  Calligraphy = 8, // 朱墨笔锋：沿程飞白，实色混合
  InkHalo = 9,   // 湿墨环：纤维边与向外渗化
}

const VS = `#version 300 es
layout(location=0) in vec4 aA; // x y u v
layout(location=1) in vec4 aC; // rgba
layout(location=2) in vec2 aS; // style, len
uniform vec2 uView;
out vec2 vUV;
out vec4 vCol;
flat out float vStyle;
out float vLen;
void main() {
  gl_Position = vec4(aA.x / uView.x * 2.0 - 1.0, 1.0 - aA.y / uView.y * 2.0, 0.0, 1.0);
  vUV = aA.zw;
  vCol = aC;
  vStyle = aS.x;
  vLen = aS.y;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec4 vCol;
flat in float vStyle;
in float vLen;
uniform float uTime;
out vec4 o;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
void main() {
  float v = vUV.y;         // -1..1 横向
  float u = vUV.x;         // 沿长度（单位：游戏区单位）
  int s = int(vStyle + 0.5);
  vec3 c = vCol.rgb;
  float A = vCol.a;
  if (s == 0) {
    float n = noise(vec2(u * 0.03 - uTime * 14.0, v * 2.0)) * 0.5 + noise(vec2(u * 0.08 - uTime * 25.0, v * 5.0)) * 0.5;
    float core = exp(-v * v * 14.0);
    float body = exp(-v * v * 3.0) * (0.6 + 0.6 * n);
    vec3 col = c * body * 1.6 + vec3(1.0, 1.0, 0.95) * core * 2.2;
    o = vec4(col * A, 0.0);
  } else if (s == 1) {
    float core = exp(-v * v * 30.0);
    float glow = exp(-v * v * 2.5);
    o = vec4((c * glow * 1.4 + vec3(1.0) * core * 2.5) * A, 0.0);
  } else if (s == 2) {
    // 毛笔墨迹：边缘被噪声侵蚀、飞白条纹、朱砂边光
    float av = abs(v);
    float edge = 0.78 + 0.22 * noise(vec2(u * 0.12, v * 0.5 + 3.0)) - 0.15 * noise(vec2(u * 0.5, 7.0));
    float ink = smoothstep(edge, edge - 0.1, av);
    float streak = noise(vec2(u * 0.02, v * 9.0));
    ink *= mix(1.0, smoothstep(0.25, 0.5, streak), smoothstep(0.35, 0.9, av));
    float rim = smoothstep(edge - 0.35, edge, av) * ink;
    vec3 inkCol = vec3(0.012, 0.010, 0.010);
    vec3 glow = c * (rim * 2.2 + exp(-av * av * 1.5) * 0.25);
    o = vec4(inkCol * ink * A + glow * A, ink * A * 0.95);
  } else if (s == 8 || s == 9) {
    float along = u / max(vLen, 1.0);
    float av = abs(v);
    float fibers = noise(vec2(u * 0.038, v * 18.0));
    float grain = noise(vec2(u * 0.19, v * 7.0));
    float edge = 0.73 + fibers * 0.20;
    float body = 1.0 - smoothstep(edge - 0.13, edge + 0.06, av);
    float bleed = smoothstep(edge - 0.12, edge, av) * (1.0 - smoothstep(edge, 1.0, av)) * 0.20;
    if (s == 8) {
      // 长向纤维的空白贯穿笔腹，落笔保留浓墨，收笔露出干锋。
      float dry = smoothstep(0.12, 0.75, along);
      body *= mix(1.0, smoothstep(0.37, 0.55, fibers), dry * 0.98);
      body *= 0.85 + grain * 0.15;
      vec3 pigment = mix(vec3(0.018, 0.014, 0.012), c, smoothstep(-0.3, 0.8, v) * 0.88);
      float a = (body * 0.91 + bleed) * A;
      o = vec4(pigment * a, a);
    } else {
      float islands = 0.72 + 0.28 * noise(vec2(u * 0.04, 7.0));
      float a = (body * 0.78 + bleed * 1.6) * islands * A;
      vec3 pigment = mix(vec3(0.012, 0.024, 0.023), c, grain * 0.22);
      o = vec4(pigment * a, a);
    }
  } else if (s == 3) {
    float fade = clamp(u / max(vLen, 1.0), 0.0, 1.0);
    float a = exp(-v * v * 3.0) * fade * fade;
    o = vec4(c * a * A, 0.0);
  } else if (s == 4) {
    float dash = step(0.5, fract(u * 0.04 - uTime * 3.0));
    float a = exp(-v * v * 8.0) * (0.35 + 0.65 * dash);
    o = vec4(c * a * A, 0.0);
  } else if (s == 6) {
    // 飞白：沿长度拉长的纤维噪声 + 随时间闪动的断续，边缘被侵蚀
    float av = abs(v);
    float fq = floor(uTime * 24.0);
    float fib = noise(vec2(u * 0.05 + fq * 3.1, v * 7.0 + fq));
    float gap = noise(vec2(u * 0.11 + fq * 1.7, fq * 0.37));
    float m = smoothstep(0.34, 0.58, fib * 0.65 + gap * 0.45 + (1.0 - av) * 0.32);
    float edge = smoothstep(1.0, 0.55, av + 0.25 * noise(vec2(u * 0.2, fq)));
    o = vec4(c * m * edge * 2.0 * A, 0.0);
  } else if (s == 7) {
    float glow = exp(-v * v * 2.2);
    o = vec4(c * glow * A, 0.0);
  } else {
    float fade = clamp(u / max(vLen, 1.0), 0.0, 1.0);
    float a = smoothstep(1.0, 0.3, abs(v)) * fade * A;
    o = vec4(c * a, a);
  }
}`;

const FLOATS = 10;

export class RibbonBatch {
  data = new Float32Array(6 * 4096 * FLOATS);
  count = 0; // 顶点数
  private grow(): void {
    const n = new Float32Array(this.data.length * 2);
    n.set(this.data);
    this.data = n;
  }
  private v(x: number, y: number, u: number, vv: number, r: number, g: number, b: number, a: number, style: number, len: number): void {
    if ((this.count + 1) * FLOATS > this.data.length) this.grow();
    const o = this.count++ * FLOATS, D = this.data;
    D[o] = x; D[o + 1] = y; D[o + 2] = u; D[o + 3] = vv;
    D[o + 4] = r; D[o + 5] = g; D[o + 6] = b; D[o + 7] = a;
    D[o + 8] = style; D[o + 9] = len;
  }

  /**
   * 折线光带。pts 为扁平 [x0,y0,x1,y1,...]；width 为半宽（数字或逐点数组）。
   * color 为线性 HDR 颜色，alpha 为整体透明度。u 坐标 = 累计长度（Trail 风格下 0 在尾端）。
   */
  strip(pts: ArrayLike<number>, width: number | ArrayLike<number>, style: RS, r: number, g: number, b: number, a = 1): void {
    const n = pts.length / 2;
    if (n < 2) return;
    // 累计长度
    let total = 0;
    const lens = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      total += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
      lens[i] = total;
    }
    let pLx = 0, pLy = 0, pRx = 0, pRy = 0, pU = 0;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      let dx = pts[i1 * 2] - pts[i0 * 2], dy = pts[i1 * 2 + 1] - pts[i0 * 2 + 1];
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const w = typeof width === 'number' ? width : width[i];
      const x = pts[i * 2], y = pts[i * 2 + 1];
      const Lx = x - dy * w, Ly = y + dx * w, Rx = x + dy * w, Ry = y - dx * w;
      const U = lens[i];
      if (i > 0) {
        this.v(pLx, pLy, pU, -1, r, g, b, a, style, total);
        this.v(pRx, pRy, pU, 1, r, g, b, a, style, total);
        this.v(Lx, Ly, U, -1, r, g, b, a, style, total);
        this.v(pRx, pRy, pU, 1, r, g, b, a, style, total);
        this.v(Rx, Ry, U, 1, r, g, b, a, style, total);
        this.v(Lx, Ly, U, -1, r, g, b, a, style, total);
      }
      pLx = Lx; pLy = Ly; pRx = Rx; pRy = Ry; pU = U;
    }
  }

  /** 直线段光带。 */
  line(x0: number, y0: number, x1: number, y1: number, width: number, style: RS, r: number, g: number, b: number, a = 1): void {
    this.strip([x0, y0, x1, y1], width, style, r, g, b, a);
  }

  /** 主动招式的笔触。age 为出招秒数；几何与纹理均使用连续沿程坐标。 */
  move(id: 'cut' | 'guard', x: number, y: number, age: number): void {
    const alpha = Math.min(1, Math.max(0, (0.65 - age) / 0.22));
    const pts: number[] = [], widths: number[] = [];
    if (id === 'cut') {
      const travel = Math.min(1, age / 0.11);
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, u = t * travel;
        pts.push(x + 12 * Math.sin(u * Math.PI) - 6 * u, y - 14 - 416 * u);
        // 落笔圆腹 → 提腕笔腹 → 零宽尖锋；宽度沿实际已写部分计算。
        widths.push((i === 40 ? 0 : (28 + 25 * Math.exp(-u * 10)) * Math.pow(1 - t, 0.58)) * Math.sqrt(Math.min(1,t/.07)) * Math.min(1, age / .025));
      }
      this.strip(pts, widths, RS.Calligraphy, .92, .11, .035, alpha);
    } else {
      const radius = 80 + 75 * Math.min(1, age / .2), wet = Math.min(1, age / .4);
      for (let i = 0; i <= 96; i++) {
        const a = i * Math.PI / 48;
        const r = radius + 2.8 * Math.sin(a * 7) + 1.8 * Math.sin(a * 13);
        pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
        widths.push((5 + wet * 7) * (1 + .24 * Math.sin(a * 5) + .15 * Math.cos(a * 9)));
      }
      this.strip(pts, widths, RS.InkHalo, .045, .16, .14, alpha);
      // 外缘逐渐出现稀淡渗圈，主体与边缘共享同一圆心。
      if (wet > .25) this.strip(pts, widths.map(w => w * (1.5 + wet)), RS.InkHalo, .02, .035, .03, alpha * .18);
    }
  }

  /**
   * 遍历指定风格的光带线段（每 6 个顶点 = 一段），回调线段两端（取最远的一对顶点）与顶点 0 的颜色。
   * 供 3D 背景把激光等当作动态光源使用。
   */
  scanSegments(style: RS, fn: (ax: number, ay: number, bx: number, by: number, r: number, g: number, b: number, a: number) => void): void {
    const D = this.data;
    for (let q = 0; q + 6 <= this.count; q += 6) {
      const o = q * FLOATS;
      if (D[o + 8] !== style) continue;
      let best = -1, ia = 0, ib = 1;
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
        const dx = D[o + i * FLOATS] - D[o + j * FLOATS], dy = D[o + i * FLOATS + 1] - D[o + j * FLOATS + 1];
        const d = dx * dx + dy * dy;
        if (d > best) { best = d; ia = i; ib = j; }
      }
      fn(D[o + ia * FLOATS], D[o + ia * FLOATS + 1], D[o + ib * FLOATS], D[o + ib * FLOATS + 1], D[o + 4], D[o + 5], D[o + 6], D[o + 7]);
    }
  }

  clear(): void {
    this.count = 0;
  }
}

export class RibbonRenderer {
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private cap = 0;

  constructor(readonly gl: GL) {
    this.prog = new Program(gl, VS, FS);
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, FLOATS * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FLOATS * 4, 16);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, FLOATS * 4, 32);
    gl.bindVertexArray(null);
  }

  draw(batch: RibbonBatch, time: number): void {
    if (!batch.count) return;
    const gl = this.gl;
    const bytes = batch.count * FLOATS * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (bytes > this.cap) {
      this.cap = Math.max(bytes, this.cap * 2);
      gl.bufferData(gl.ARRAY_BUFFER, this.cap, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data, 0, batch.count * FLOATS);
    this.prog.use().set('uView', PLAY_W, PLAY_H).set('uTime', time);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, batch.count);
    gl.bindVertexArray(null);
  }
}
