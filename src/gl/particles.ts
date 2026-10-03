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
  Flame = 9,   // 柔软火舌：白金芯 → 橙 → 朱红（加色）
  Blade = 10,  // 叶片：尖椭圆带中脉，正反面翻转（混合）
  PetalFlip = 11, // 翻转花瓣：正反两面（混合）
  FlameTex = 12,  // 贴图火舌：火焰图集第 1、2 行 8 格随机取一格（加色）
  EmberTex = 13,  // 贴图火星：图集第 3 行 4 格（加色）
  SmokeTex = 14,  // 贴图烟团：图集第 4 行 4 格（混合）
  FireShape = 15, // Kenney 灰度火焰褶皱（朱、金或武器色）
  SmokeShape = 16, // 灰度烟团（混合）
  SparkTex = 17, // 不规则碎火花
  FlareTex = 18, // 短促闪光
  SlashTex = 19, // 弯月刀锋
  TraceTex = 20, // 飞白拖尾，沿速度方向
  TwirlTex = 21, // 翻卷灵气
  StarTex = 22, // 金色碎光
  OilFlameTex = 23, // 向上的贴地火舌
  Fireball = 24, // 爆炸火球：饱和橙红实体
  Debris = 25, // 爆炸纸片、铜片：有棱角的实体
  ShockRing = 26, // 爆炸细冲击环
  FireSpark = 27, // 爆炸亮黄短线
}

const ADDITIVE = new Set([PK.Dot, PK.Spark, PK.Leaf, PK.Ring, PK.Ember, PK.Flame, PK.FlameTex, PK.EmberTex, PK.FireShape, PK.SparkTex, PK.FlareTex, PK.TraceTex, PK.TwirlTex, PK.StarTex, PK.FireSpark]);

const VS = `#version 300 es
layout(location=0) in vec4 aA; // x0 y0 vx vy
layout(location=1) in vec4 aB; // t0 life drag grav
layout(location=2) in vec4 aC; // size0 size1 rot0 spin
layout(location=3) in vec4 aD; // color0 rgba
layout(location=4) in vec4 aE; // color1 rgb, kind
uniform float uTime;
uniform vec2 uView;
uniform float uRetireBefore;
out vec2 vWorld;
out vec2 vQ;
out vec4 vCol;
flat out float vKind;
out float vFace;
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
  float vFaceV = 1.0;
  if (kind == 1.0 || kind == 17.0 || kind == 20.0 || kind == 27.0) {
    float sp = length(vel);
    vec2 dir = sp > 0.001 ? vel / sp : vec2(1.0, 0.0);
    float len = size + sp * (kind == 27.0 ? 0.009 : kind == 1.0 ? 0.05 : 0.025);
    local = dir * corner.x * len + vec2(-dir.y, dir.x) * corner.y * size * (kind == 1.0 ? 0.35 : 0.55);
  } else {
    float r = aC.z + aC.w * t;
    float c = cos(r), s = sin(r);
    vec2 q = corner * size;
    if (kind == 23.0) { q.x *= 0.8; q.y *= 1.3; }
    if (kind == 19.0) q.y *= 0.55;
    if (kind == 4.0) q.x *= 0.55 + 0.45 * sin(r * 2.3); // 金箔翻转
    if (kind >= 10.0 && kind < 12.0) {
      float sd = fract(float(gl_InstanceID) * 0.61803398875);
      float fl = cos(t * (4.5 + 4.0 * sd) + sd * 6.28);
      vFaceV = fl;
      q.x *= max(abs(fl), 0.14);
      if (kind == 10.0) q.y *= 1.35;
    }
    local = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
  }
  if (kind == 8.0) pos += vec2(sin(t * 13.0 + float(gl_InstanceID)), cos(t * 11.0 + float(gl_InstanceID) * 1.7)) * 2.0;
  if (kind == 9.0) pos += vec2(sin(t * 18.0 + float(gl_InstanceID) * 1.7), cos(t * 13.0 + float(gl_InstanceID))) * u * 5.0;
  vec2 p = pos + local;
  vWorld = p;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vQ = corner;
  vec3 col = mix(aD.rgb, aE.rgb, u);
  if (kind == 9.0) col = mix(mix(aD.rgb, vec3(2.0, 0.44, 0.035), smoothstep(0.0, 0.4, u)), aE.rgb, smoothstep(0.4, 1.0, u));
  float a = aD.a;
  if (aB.x < uRetireBefore) a *= clamp(1.0 - (uTime - uRetireBefore) / 0.15, 0.0, 1.0);
  if (kind == 5.0) a *= 1.0 - u;
  else if (kind == 2.0 || kind == 3.0 || kind == 14.0 || kind == 16.0) a *= smoothstep(1.0, 0.55, u) * smoothstep(0.0, 0.06, u);
  else a *= (1.0 - u * u);
  vCol = vec4(col, a);
  vKind = kind;
  vFace = vFaceV;
  vSeed = fract(float(gl_InstanceID) * 0.61803398875);
  vU = u;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vQ;
in vec4 vCol;
flat in float vKind;
in float vFace;
flat in float vSeed;
in float vU;
in vec2 vWorld;
uniform vec3 uClearZone;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform sampler2D uFlame;
uniform sampler2D uShapes;
out vec4 o;
float h(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float r = length(vQ);
  int k = int(vKind + 0.5);
  float a;
  vec3 extra = vec3(0.0);
  vec3 shard = vec3(0.0);
  vec3 tint = vCol.rgb;
  bool add = (k == 0 || k == 1 || k == 4 || k == 5 || k == 8 || k == 9 || k == 12 || k == 13 || (k >= 15 && k <= 22 && k != 16 && k != 19) || k == 27);
  if (k == 0 || k == 8) a = exp(-r * r * 5.0);
  else if (k == 9) {
    vec2 q = vQ;
    q.x += sin(q.y * 5.0 + vSeed * 37.0 + vU * 8.0) * 0.13;
    a = exp(-(q.x * q.x * 5.5 + q.y * q.y * 2.6)) * smoothstep(1.0, 0.65, r);
  }
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
  else if (k == 24) {
    float cell=floor(vSeed*2.0);
    vec4 tx=texture(uShapes,(vec2(cell,0.0)+vQ*.49+.5)*.25);
    float edge=smoothstep(1.0,.82,max(abs(vQ.x),abs(vQ.y)));
    a=max(smoothstep(.008,.08,tx.a),1.0-smoothstep(.3,.65,r))*edge;
    float folds=smoothstep(.02,.6,tx.r);
    tint=mix(vec3(.48,.018,.002),vCol.rgb,folds);
  }
  else if (k == 25) {
    // 斜切的四边形纸片，铜片保留窄折痕；无花瓣曲线和橙色自发光。
    vec2 q=vQ;
    float d=max(abs(q.x+q.y*.28)-.68,max(abs(q.y)-.4,(q.x-q.y)*.7-.68));
    a=1.0-smoothstep(-.035,.035,d);
    if(vSeed<.5)tint=vec3(.028,.02,.014);
    tint*=.65+.35*step(.0,q.x+q.y*.35);
  }
  else if (k == 26) {
    a=1.0-smoothstep(fwidth(r),fwidth(r)*2.0,abs(r-.85));
  }
  else if (k == 27) {
    a=(1.0-smoothstep(.45,1.0,abs(vQ.x)))*exp(-vQ.y*vQ.y*24.0);
  }
  else if (k >= 15) {
    float cell = k == 15 ? floor(vSeed * 2.0) : k == 16 ? 4.0 + floor(vSeed * 2.0)
               : k == 17 ? 6.0 + floor(vSeed * 2.0) : k == 18 ? 3.0
               : k == 19 ? 8.0 : k == 20 ? 9.0 : k == 21 ? 10.0 : k == 22 ? 11.0 : 2.0;
    vec2 q = vQ;
    // 拖尾源图朝上，转到局部速度轴；火舌随寿命轻摆。
    if (k == 20) q = vec2(q.y, -q.x);
    if (k == 23) q.x += sin(q.y * 4.0 + vU * 8.0 + vSeed * 30.0) * 0.10 * (1.0 - q.y);
    vec2 org = vec2(mod(cell, 4.0), floor(cell / 4.0));
    vec4 tx = texture(uShapes, (org + clamp(q, -1.0, 1.0) * 0.49 + 0.5) * 0.25);
    float mask = tx.r * tx.a * smoothstep(1.0, 0.88, max(abs(q.x), abs(q.y)));
    // 灰度只决定轮廓与浓淡，所有颜色来自游戏色板；收住白热与泛光。
    a = mask;
    if (k == 16) { a = tx.a * 0.72; tint *= 0.6 + tx.r * 0.4; }
    else if (k == 23) {
      tint = mix(vCol.rgb * vec3(0.55, 0.3, 0.2), vec3(1.05, 0.48, 0.075), smoothstep(-0.6, 0.7, q.y));
    }
    else if (k == 15) {
      vec3 core = mix(vCol.rgb, vec3(1.4, 0.82, 0.30), 0.3);
      extra = mix(vCol.rgb * 0.48, core, smoothstep(0.35, 0.9, tx.r)) * mask * vCol.a;
      a = 0.0;
    }
  }
  else if (k >= 12) {
    // 火焰图集 4x4，每格 256：第 1、2 行火舌（黑底加色），第 3 行火星（黑底加色），第 4 行烟（透明底）
    float cell = floor(vSeed * (k == 12 ? 8.0 : 4.0));
    vec2 org = k == 12 ? vec2(mod(cell, 4.0), floor(cell / 4.0)) : vec2(cell, k == 13 ? 2.0 : 3.0);
    vec4 tx = texture(uFlame, (org + vQ * 0.49 + 0.5) * 0.25);
    float edgeFade = smoothstep(1.0, 0.8, max(abs(vQ.x), abs(vQ.y)));
    if (k == 14) { a = tx.a * edgeFade; tint = tx.rgb * vCol.rgb; }
    else { a = 0.0; extra = tx.rgb * vCol.rgb * vCol.a * edgeFade; }
  }
  else if (k == 4) {
    vec2 q = abs(vQ);
    a = step(q.x, 0.9) * step(q.y, 0.9);
    a *= 0.6 + 0.4 * sin(vU * 40.0 + vSeed * 20.0);
  }
  else if (k == 5) a = exp(-pow((r - 0.85) * 9.0, 2.0));
  else if (k == 10) {
    float yy = clamp(vQ.y * 0.74, -1.0, 1.0);
    float w = 0.62 * pow(max(1.0 - yy * yy, 0.0), 0.8) * (0.55 + 0.45 * smoothstep(-1.0, -0.2, yy));
    a = smoothstep(0.06, -0.02, abs(vQ.x) - w) * step(abs(yy), 0.99);
    float rib = exp(-vQ.x * vQ.x * 260.0);
    float lit = vFace > 0.0 ? 1.0 : 0.5;
    tint = vCol.rgb * lit * (0.85 + 0.35 * rib + 0.2 * vQ.y * vQ.y) + vec3(0.5, 0.35, 0.08) * rib * 0.4 * lit;
  }
  else if (k == 11) {
    vec2 q = vQ;
    float petal = length(vec2(q.x * 1.5, q.y + 0.25 * q.x * q.x)) - 0.7 - 0.15 * q.y;
    a = smoothstep(0.05, -0.05, petal);
    tint = vCol.rgb * (vFace > 0.0 ? 1.0 : 0.55) * (0.9 + 0.3 * smoothstep(-0.6, 0.6, q.y));
  }
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
  // 专用玩家粒子在判定点附近留白；普通特效的半径为零。
  float clear = uClearZone.z > 0.0 ? mix(0.035, 1.0, smoothstep(uClearZone.z * 0.5, uClearZone.z, distance(vWorld, uClearZone.xy))) : 1.0;
  a *= clear;
  extra *= clear;
  if (a < 0.002 && max(extra.r, max(extra.g, extra.b)) < 0.002) discard;
  if (k == 7) o = vec4(shard * a, a);
  else o = add ? vec4(vCol.rgb * a + extra, 0.0) : vec4(tint * a, a);
}`;

const FLOATS = 20;

/** 火焰图集：每个 GL 上下文只建一张，构造粒子系统时创建，图片异步到位后一次性上传。 */
const flameSheets = new WeakMap<GL, WebGLTexture>();
const shapeSheets = new WeakMap<GL, WebGLTexture>();
function particleSheet(gl: GL, sheets: WeakMap<GL, WebGLTexture>, url: string): WebGLTexture {
  let t = sheets.get(gl);
  if (t) return t;
  t = gl.createTexture()!;
  sheets.set(gl, t);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const img = new Image();
  img.src = url;
  const tex = t;
  void img.decode().then(() => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }).catch(() => {});
  return t;
}

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
  private flameTex: WebGLTexture;
  private shapeTex: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private staging: Float32Array;
  private pending = 0;
  private head = 0;
  /** 已写入的槽位数；未用槽位无需每帧提交顶点。 */
  private used = 0;
  /** 粒子时钟（游戏时间），由外部每帧推进。 */
  time = 0;
  /** 可选的判定点留白与换色时旧粒子 150ms 淡出。 */
  clearZone: [number, number, number] = [0, 0, 0];
  retireBefore = -1;
  /** 日光（屏幕空间，指向太阳）、日光色与天光：碎片受光用。 */
  sun: [number, number, number] = [-0.78, 0.12, 0.48];
  sunCol: [number, number, number] = [1, 0.98, 0.92];
  amb: [number, number, number] = [0.62, 0.64, 0.68];

  constructor(readonly gl: GL, readonly capacity = 262144) {
    this.prog = new Program(gl, VS, FS);
    this.flameTex = particleSheet(gl, flameSheets, '/art/vfx/burn/flame-sheet.png');
    this.shapeTex = particleSheet(gl, shapeSheets, '/art/vfx/kenney/sheet.png');
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
    this.prog.use().set('uTime', this.time).set('uView', PLAY_W, PLAY_H).set('uSun', this.sun).set('uSunCol', this.sunCol).set('uAmb', this.amb).set('uClearZone', this.clearZone).set('uRetireBefore', this.retireBefore).tex('uFlame', this.flameTex).tex('uShapes', this.shapeTex);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.used);
    gl.bindVertexArray(null);
  }
}
