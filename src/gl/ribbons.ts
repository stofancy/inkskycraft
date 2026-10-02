// 动态光带：激光、雷弧、一笔墨迹、拖尾、敌方激光预警线。CPU 每帧生成三角形。
import { PLAY_H, PLAY_W } from '../types';
import { Program, type GL } from './util';

export enum RS {
  TearBullet = 22, // 朱弹：正圆头 + 收尖的尾，中心白黄向边缘橙红降温（混合）
  ArcBullet = 23,  // 紫弹：短折线电弧，白芯紫晕，头部亮电球（混合）
  WaterBody = 21,   // 水龙身：流动的青色水体，焦散纹、白色浪沫边（混合）
  FlameBullet = 19, // 朱弹：泪滴火舌，尖端跳动，白黄芯、橙红身，深红边（混合）
  SparkBolt = 20,   // 紫弹：短电光，亮芯线加锯齿电丝，垫暗紫底（混合）
  MantraLightning = 18, // 泼墨雷：宽辉光、紫色雷腹与局部亮芯
  FireShot = 15, // 火弹：白金芯、淡橙红晕与流动火星
  WaterShot = 16, // 风水针：清亮细芯与薄雾
  ElectricShot = 17, // 电弹：短芯与跳动锯齿
  Beam = 0,      // 激光（加色）
  Lightning = 1, // 雷弧（加色）
  Brush = 2,     // 墨迹（混合 + 朱砂边光）
  Trail = 3,     // 拖尾（加色，沿 u 渐隐）
  Warn = 4,      // 预警虚线（加色）
  InkTrail = 5,  // 墨色拖尾（混合）
  Bolt = 6,      // 雷主干：飞白干笔断续（加色）
  Glow = 7,      // 纯软辉光（加色）
  Calligraphy = 8, // 朱墨笔锋：沿程飞白，实色混合
  InkArrow = 14, // 墨矢实色箭芯，保留独立箭形的黑色轮廓
  AuraFire = 11, // 有暗红轮廓的三层火焰
  AuraArc = 12, // 实色紫边和近白芯
  Sword = 13, // 剑身的青边、亮芯与暗轮廓
  Fire = 10,    // 翻卷火带：饱和外焰、白色亮芯和流动噪声
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
  if(s == 21){
    float av = abs(v);
    float flow = noise(vec2(u * .035 - uTime * 6., v * 2.5 + uTime * .7)) * .6 + noise(vec2(u * .1 - uTime * 11., v * 5.)) * .4;
    float edge = .84 + .1 * flow;
    float al = (1.0 - smoothstep(edge - .1, edge, av)) * A;
    vec3 w = mix(vec3(.01,.12,.2), vec3(.06,.7,1.0), smoothstep(.15, .7, flow + (1.0 - av) * .35));
    w += vec3(.5,1.4,1.6) * pow(smoothstep(.55, .9, flow), 2.0) * .9;
    float foam = smoothstep(edge - .28, edge - .04, av) * (.4 + .6 * flow);
    w = mix(w, vec3(1.8,2.4,2.5), foam * .8);
    w += vec3(.9,1.8,2.0) * exp(-v * v * 28.) * .45;
    o = vec4(w * al, al);
  } else if(s == 22){
    float R = vLen / 3.3;
    vec2 q = vec2(u - (vLen - R), v * R) / R;   // 以头部半径为单位，头心在原点
    float Lt = 2.3, d, rr, sT = 0.0;
    if (q.x >= 0.0) { d = length(q) - 1.0; rr = length(q); }
    else {
      sT = clamp(-q.x / Lt, 0.0, 1.0);
      float w = pow(1.0 - sT, 1.7);
      d = (abs(q.y) - w) * 0.9; rr = abs(q.y) / max(w, 0.06);
    }
    float aa = fwidth(d) * 1.2 + 1e-4;
    float body = smoothstep(aa, -aa, d);
    float heat = smoothstep(1.15, 0.0, rr) * (1.0 - 0.5 * sT);
    vec3 f = mix(vec3(.55,.05,.02), vec3(1.7,.32,.05), smoothstep(.0, .55, heat));
    f = mix(f, vec3(2.4,1.5,.35), smoothstep(.45, .8, heat));
    f = mix(f, vec3(3.0,2.7,1.8), smoothstep(.8, 1.0, heat));
    float al = body * A * mix(1.0, .55, sT);
    o = vec4(f * al * mix(1.0, .75, sT), al);
  } else if(s == 23){
    // 短折线电弧：沿程 4 段折线，锐利拐角，每 2.5 帧换形；中段一根小分叉；头部亮电球
    float Rh = vLen / 3.3;
    float t = clamp(u / vLen, 0.0, 1.0);
    float sd = vCol.r, fq = floor(uTime * 24.0) + sd * 37.0;
    float k = t * 4.0; float ki = floor(k), kf = fract(k);
    float z0 = (hash(vec2(ki, fq)) - .5) * 1.5, z1 = (hash(vec2(ki + 1.0, fq)) - .5) * 1.5;
    float env = smoothstep(0.0, .18, t) * .9 + .1;
    float zc = mix(z0, z1, kf) * env * .62;
    float dm = abs(v - zc);
    float zk = (hash(vec2(2.0, fq)) - .5) * 1.5 * .62 * env;
    float side = hash(vec2(fq, 5.0)) > .5 ? 1.0 : -1.0;
    float zb = zk + side * max(0.0, .72 - t) * 1.05;
    float db = abs(v - zb) * step(.5, t) ;
    db = t > .5 ? db : 9.0;
    float core = exp(-dm * dm * 32.0), halo = exp(-dm * dm * 5.0);
    float bcore = exp(-db * db * 130.0) * .8, bhalo = exp(-db * db * 18.0) * .5;
    vec2 pb = vec2(u - (vLen - Rh * .9), v * Rh) / Rh;
    float orb = exp(-dot(pb, pb) * 4.5) * (1.0 - v * v);
    vec3 emit = vec3(3.0,2.8,3.4) * (core + bcore) + vec3(1.2,.35,2.4) * (halo * .8 + bhalo) + vec3(2.2,1.2,3.2) * orb * 1.2 + vec3(3.2,3.0,3.4) * orb * orb;
    float al = clamp(max(halo * .5, orb * .8) * A * (1.0 - v * v * .5), 0.0, 1.0);
    o = vec4(emit * A + vec3(.05,.01,.1) * al, al);
  } else if(s == 19){
    float t = clamp(u / max(vLen, 1.0), 0.0, 1.0);
    float x = 1.0 - t;
    float n = noise(vec2(uTime * 45.0, u * .05 + 3.7));
    x = clamp(x + (n - .5) * .22 * (1.0 - x), 0.0, 1.0);
    float w = x < .5 ? pow(x / .5, .75) : sqrt(max(0.0, 1.0 - pow((x - .5) / .5, 2.0)));
    float av = abs(v);
    float a = (1.0 - smoothstep(w - .14, w, av)) * step(.001, w) * A;
    float q = av / max(w, .06);
    vec3 f = mix(vec3(.5,.035,.012), vec3(1.9,.36,.04), 1.0 - smoothstep(.5, .95, q));
    f = mix(f, vec3(2.5,1.7,.4), 1.0 - smoothstep(.15, .6, q * (1.0 + x * .6)));
    f = mix(f, vec3(3.0,2.7,1.5), (1.0 - smoothstep(.0, .3, q)) * smoothstep(.1, .5, x));
    o = vec4(f * a, a);
  } else if(s == 20){
    float t = clamp(u / max(vLen, 1.0), 0.0, 1.0);
    float fq = floor(uTime * 32.0);
    float env = sin(3.14159 * clamp(t, 0.0, 1.0));
    float z1 = (noise(vec2(u * .32 + fq * 5.1, fq)) - .5) * 1.7 * env;
    float z2 = (noise(vec2(u * .3 + fq * 3.7 + 9.0, fq * 1.3)) - .5) * 1.7 * env;
    float core = exp(-v * v * 110.0);
    float f1 = exp(-pow((v - z1) * 9.0, 2.0)), f2 = exp(-pow((v - z2) * 9.0, 2.0));
    float dk = exp(-v * v * 2.2) * .5 * A * (.3 + .7 * env);
    vec3 emit = (vec3(3.1,2.8,3.5) * core + vec3(1.4,.45,2.6) * (f1 + f2) * .95) * A * (.4 + .6 * env);
    o = vec4(vec3(.06,.015,.12) * dk + emit, dk);
  } else if(s == 18){
    float n=noise(vec2(u*.05-uTime*8.,v*4.));
    float glow=exp(-v*v*3.5),body=exp(-v*v*9.0),core=exp(-v*v*100.0);
    vec3 light=c*(glow*.18+body*(.28+n*.35))+vec3(3.0,2.9,3.2)*core*1.3;
    o=vec4(light*A,glow*A*.18);
  } else if (s >= 15 && s <= 17) {
    float t = clamp(u / max(1.0, vLen), 0.0, 1.0);
    float head = exp(-pow((t - .8) * 6.0, 2.0));
    float core = exp(-v*v*38.0);
    float halo = exp(-v*v*4.5) * head;
    float tail = pow(t, 1.6) * (1.0-head*.4);
    float flick = .8+.2*sin(u*.8-uTime*80.0);
    vec3 light = vec3(0.0);
    if (s == 15) light = vec3(2.0,1.7,.9)*core*head + c*(halo*.23 + tail*core*.4*flick);
    else if (s == 16) light = vec3(1.5,2.2,2.4)*core*head + c*(halo*.5 + exp(-v*v*6.0)*tail*.28*flick);
    else {
      float zig = abs(v) - (.3+.22*sin(floor(t*9.0)*9.0+floor(uTime*40.0)));
      float tip=exp(-pow((t-.74)*4.3,2.0));
      light = vec3(3.1,2.95,3.3)*exp(-v*v*12.0)*tip + c*(exp(-zig*zig*100.0)*tip*.65+exp(-v*v*3.5)*tip*.8+tail*core*.4*flick);
    }
    o = vec4(light*A,s == 15 ? 0.0 : head*exp(-v*v*10.0)*A*.65);
  } else if (s == 0) {
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
  } else if (s == 14) {
    float a = (1.0 - smoothstep(0.72, 1.0, abs(v))) * A;
    o = vec4(c * a, a);
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
  } else if (s == 11) {
    float n = noise(vec2(u*.08-uTime*13.,v*5.));
    float av=abs(v),edge=.80+.12*n;
    float alpha=(1.-smoothstep(edge,edge+.08,av))*A;
    vec3 flame=mix(vec3(.25,.014,.003),vec3(.85,.165,.039),1.-smoothstep(.55,.82,av));
    flame=mix(flame,vec3(1.,.54,.10),1.-smoothstep(.20,.57,av));
    flame=mix(flame,vec3(1.8,1.72,1.35),1.-smoothstep(.03,.23+n*.1,av));
    o=vec4(flame*alpha,alpha);
  } else if (s == 12 || s == 13) {
    float av=abs(v),alpha=(1.-smoothstep(.82,1.,av))*A;
    vec3 pigment=mix(c*.09,c,1.-smoothstep(.58,.85,av));
    pigment=mix(pigment,vec3(1.6,1.6,1.5),1.-smoothstep(.12,.38,av));
    o=vec4(pigment*alpha,alpha);
  } else if (s == 10) {
    float n = noise(vec2(u * .075 - uTime * 14., v * 4.)) * .65 + noise(vec2(u * .18 - uTime * 22., v * 8.)) * .35;
    float body = exp(-v * v * 2.3) * (.45 + .75 * n);
    float core = exp(-v * v * 23.) * smoothstep(.18, .7, n);
    float coverage = exp(-v * v * 2.) * .35 * A;
    vec3 flame = c * body * 2. + vec3(3.) * core;
    o = vec4(flame * A, coverage);
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
