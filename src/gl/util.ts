// WebGL2 基础工具：着色器程序、渲染目标、全屏三角形。

export type GL = WebGL2RenderingContext;

/** 全屏三角形顶点着色器（无需顶点缓冲，需绑定空 VAO）。vUv: (0,0)=左下。 */
export const FS_TRI_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

function annotate(src: string, log: string): string {
  const lines = src.split('\n');
  const out: string[] = [log];
  const re = /ERROR: \d+:(\d+)/g;
  let m: RegExpExecArray | null;
  const seen = new Set<number>();
  while ((m = re.exec(log))) {
    const ln = +m[1];
    if (seen.has(ln)) continue;
    seen.add(ln);
    for (let i = Math.max(1, ln - 2); i <= Math.min(lines.length, ln + 1); i++) {
      out.push(`${i === ln ? '>>' : '  '} ${i}: ${lines[i - 1]}`);
    }
  }
  return out.join('\n');
}

export function compileShader(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) || '';
    gl.deleteShader(s);
    const lost = gl.isContextLost() ? '（上下文已丢失）' : '';
    throw new Error(`着色器编译失败${lost}:\n${annotate(src, log)}\n--- 源码开头 ---\n${src.slice(0, 300)}`);
  }
  return s;
}

type UInfo = { loc: WebGLUniformLocation; type: number; size: number; unit?: number };

export class Program {
  readonly prog: WebGLProgram;
  private u = new Map<string, UInfo>();
  constructor(readonly gl: GL, vs: string, fs: string, opts: { tfVaryings?: string[] } = {}) {
    const p = gl.createProgram()!;
    const v = compileShader(gl, gl.VERTEX_SHADER, vs);
    const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    if (opts.tfVaryings) gl.transformFeedbackVaryings(p, opts.tfVaryings, gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('程序链接失败: ' + gl.getProgramInfoLog(p));
    gl.deleteShader(v);
    gl.deleteShader(f);
    this.prog = p;
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    let unit = 0;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i)!;
      const name = info.name.replace(/\[0\]$/, '');
      const loc = gl.getUniformLocation(p, info.name)!;
      const isSampler = info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_2D_ARRAY || info.type === gl.SAMPLER_3D;
      this.u.set(name, { loc, type: info.type, size: info.size, unit: isSampler ? unit++ : undefined });
    }
  }
  use(): this {
    this.gl.useProgram(this.prog);
    return this;
  }
  has(name: string): boolean {
    return this.u.has(name);
  }
  /** 设置 uniform；数组或向量传 number[] / Float32Array。未使用的 uniform 静默忽略。 */
  set(name: string, ...v: (number | ArrayLike<number>)[]): this {
    const info = this.u.get(name);
    if (!info) return this;
    const gl = this.gl;
    const flat: ArrayLike<number> = v.length === 1 && typeof v[0] !== 'number' ? (v[0] as ArrayLike<number>) : (v as number[]);
    switch (info.type) {
      case gl.FLOAT: gl.uniform1fv(info.loc, flat as Float32List); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(info.loc, flat as Float32List); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(info.loc, flat as Float32List); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(info.loc, flat as Float32List); break;
      case gl.INT: case gl.BOOL: gl.uniform1iv(info.loc, Array.from(flat) as number[]); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(info.loc, false, flat as Float32List); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(info.loc, false, flat as Float32List); break;
      default: throw new Error(`uniform ${name} 类型不支持 set()，采样器请用 tex()`);
    }
    return this;
  }
  /** 绑定纹理到采样器 uniform。 */
  tex(name: string, tex: WebGLTexture | null, target: number = this.gl.TEXTURE_2D): this {
    const info = this.u.get(name);
    if (!info || info.unit === undefined) return this;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + info.unit);
    gl.bindTexture(target, tex);
    gl.uniform1i(info.loc, info.unit);
    return this;
  }
}

export type TargetFormat = 'rgba16f' | 'rgba8' | 'rg16f' | 'r16f' | 'rgba32f';

const FORMATS: Record<TargetFormat, [number, number, number]> = {
  rgba16f: [WebGL2RenderingContext.RGBA16F, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.HALF_FLOAT],
  rgba32f: [WebGL2RenderingContext.RGBA32F, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.FLOAT],
  rgba8: [WebGL2RenderingContext.RGBA8, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.UNSIGNED_BYTE],
  rg16f: [WebGL2RenderingContext.RG16F, WebGL2RenderingContext.RG, WebGL2RenderingContext.HALF_FLOAT],
  r16f: [WebGL2RenderingContext.R16F, WebGL2RenderingContext.RED, WebGL2RenderingContext.HALF_FLOAT],
};

/** 单纹理渲染目标。 */
export class Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w = 0;
  h = 0;
  constructor(
    readonly gl: GL, w: number, h: number,
    readonly format: TargetFormat = 'rgba16f',
    readonly filter: number = WebGL2RenderingContext.LINEAR,
    readonly wrap: number = WebGL2RenderingContext.CLAMP_TO_EDGE,
  ) {
    this.tex = gl.createTexture()!;
    this.fbo = gl.createFramebuffer()!;
    this.resize(w, h);
  }
  resize(w: number, h: number): void {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = w;
    this.h = h;
    const [ifmt, fmt, type] = FORMATS[this.format];
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrap);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  bind(clear?: [number, number, number, number]): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
    if (clear) {
      gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }
}

/** 乒乓双缓冲（流体模拟等）。 */
export class DoubleTarget {
  read: Target;
  write: Target;
  constructor(gl: GL, w: number, h: number, format: TargetFormat, filter?: number, wrap?: number) {
    this.read = new Target(gl, w, h, format, filter, wrap);
    this.write = new Target(gl, w, h, format, filter, wrap);
  }
  swap(): void {
    const t = this.read;
    this.read = this.write;
    this.write = t;
  }
  resize(w: number, h: number): void {
    this.read.resize(w, h);
    this.write.resize(w, h);
  }
}

let emptyVao: WebGLVertexArrayObject | null = null;
/** 画全屏三角形（使用 FS_TRI_VS）。 */
export function fullscreen(gl: GL): void {
  if (!emptyVao) emptyVao = gl.createVertexArray();
  gl.bindVertexArray(emptyVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
