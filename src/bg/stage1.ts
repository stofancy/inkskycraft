import type { BgDef } from './header';
import type { Bg3D } from '../gl/scene3d';

/**
 * 第一幕 · 墨山晓（真 3D 场景：高度场群山 + 实例化松林 + 谷雾，透视俯视摄像机，见 src/gl/scene3d.ts）
 * uP0.x 蚀 0..1：霓虹裂纹从高处山体向下蔓延（脚本建议 scroll 0..8000 为 0；8000→15000 升到 1）
 * uP0.y 雾 0..1：谷雾浓度（默认 0.5）
 * uP0.z 晨光 0..1：0 冷白晓色 → 1 暖金朝霞（默认 0.35，建议随 scroll 缓慢升高）
 * uP0.w 未使用
 * uP1.x 水流速度倍率（默认 1）；uP1.y 松林密度倍率（默认 1）
 * uP1.z / uP1.w 炮台平台的世界 y 区间 [z, w]（默认 0,0 = 无平台）：区间内两侧山腰（x≈125 / 775）压平成贴地平台，
 *   因为地面炮台 x 固定、随地面向下走，脚下必须贴近 z=0。关卡脚本在炮台第一波生成时 g.bg(6, g.scroll + 1215)、g.bg(7, g.scroll + 1e6)，
 *   最后一波时 g.bg(7, g.scroll + 1330)（世界 y = scroll + 1200 - 屏幕 y）。
 * 构图：山谷（山径）沿 pathC(y) 蜿蜒，两侧山脊起伏；谷底与炮台平台贴近 z=0，地面敌人坐在上面。
 * 地貌地标（uScroll，约）：大瀑布 4500（左）与 11500（右），另有零星小瀑；山径 5000-10500；
 *   两侧山腰的炮台平台见 uP1.z/w；12000-15000 山体被蚀（配合 uP0.x）。
 * 与关卡脚本的约定：stages/stage1.ts 的 pathX(worldY) 必须与这里的 pathC(y) 相同。
 */
const GLSL = `
float pathC(float y) { return 450.0 + 34.0 * sin(y * 0.0011 + 4.0) + 12.0 * sin(y * 0.0037 + 1.0); }
float streamX(float y) { return pathC(y) + 90.0 * sin(y * 0.0045 + 2.0) + 3.0 * sin(y * 0.05); }

// 瀑布表：(y0, 侧 -1 左 / +1 右, 尺度, 种子)
const int NWF = 8;
const vec4 WF[8] = vec4[8](
  vec4(4500.0, -1.0, 1.0, 1.0), vec4(11500.0, 1.0, 1.0, 2.0),
  vec4(1700.0, 1.0, 0.55, 3.0), vec4(3000.0, -1.0, 0.5, 4.0), vec4(7000.0, -1.0, 0.6, 5.0),
  vec4(8800.0, 1.0, 0.55, 6.0), vec4(13300.0, -1.0, 0.6, 7.0), vec4(14300.0, 1.0, 0.5, 8.0));
void wfEnds(vec4 f, out vec2 A, out vec2 B) {
  float pc = pathC(f.x);
  // 顺 -y 泻下：站在南侧的摄像机看到的是山体的朝南立面
  A = vec2(pc + f.y * 215.0, f.x + 140.0 * f.z);
  B = vec2(pc + f.y * 150.0, f.x - 100.0 * f.z);
}

float terrainBase(vec2 w, int oct) {
  float pc = pathC(w.y);
  float ad = abs(w.x - pc);
  vec2 wq = w + 60.0 * vec2(vnoise(w * 0.004), vnoise(w * 0.004 + 9.0));
  float r = ridged(wq * 0.0032 + vec2(3.1, 7.7), min(oct, 5)).x;
  r = 0.82 * r + 0.22 * ridged(wq * 0.0105 + vec2(1.7, 4.4), 2).x;
  float n2 = fbm(w * 0.012 + 5.0, min(oct, 3));
  float rise = smoothstep(90.0, 330.0, ad);
  float mtn = (60.0 + 400.0 * pow(r, 1.4) + 60.0 * n2) * rise;
  float valley = 2.0 + 9.0 * n2 * smoothstep(20.0, 140.0, ad);
  float h = valley + mtn;
  // 炮台平台：山腰上平坦的一条带
  // 平台区间 [uP1.z, uP1.w]：两端做成逐渐变宽/变窄的楔形，避免一刀切的横向断崖
  float t0 = w.y - uP1.z, t1 = uP1.w - w.y;
  float zone = smoothstep(0.0, 40.0, t0) * smoothstep(0.0, 40.0, t1);
  float wr = mix(0.55, 1.0, smoothstep(0.0, 140.0, min(t0, t1)));
  float ln = 60.0 * (vnoise(vec2(w.y * 0.008, 3.0)) - 0.5) + 25.0 * (vnoise(vec2(w.y * 0.03, 8.0)) - 0.5);
  float lane = max(1.0 - smoothstep((72.0 + ln) * wr, (118.0 + ln) * wr, abs(w.x - 125.0)), 1.0 - smoothstep((72.0 - ln) * wr, (118.0 - ln) * wr, abs(w.x - 775.0)));
  return mix(h, 6.0 + 5.0 * n2, lane * zone);
}

float terrainH(vec2 w, int oct) {
  float h = terrainBase(w, oct);
  for (int i = 0; i < NWF; i++) {
    vec4 f = WF[i];
    if (abs(w.y - f.x) > 380.0) continue;
    vec2 A, B; wfEnds(f, A, B);
    vec2 dA = w - A;
    h += 140.0 * f.z * exp(-dot(dA, dA) / (2.0 * 90.0 * 90.0));   // 源头处山峰
    vec2 ab = B - A;
    float t = clamp(dot(dA, ab) / dot(ab, ab), 0.0, 1.0);
    float dist = length(dA - ab * t);
    if (dist > 55.0) continue;
    float hA = terrainBase(A, 4) + 140.0 * f.z * 0.9;
    float hc = mix(hA, 3.0, smoothstep(0.05, 0.95, t)) + dist * dist * 0.03;
    h = mix(h, min(h, hc), smoothstep(55.0, 14.0, dist));
  }
  // 溪床
  float bed = smoothstep(12.0, 3.0, abs(w.x - streamX(w.y))) * (1.0 - smoothstep(20.0, 60.0, h));
  return max(h - 4.0 * bed, -6.0);
}

// 溪流遮罩
float streamMask(vec2 w) {
  float wd = 8.0 + 3.0 * sin(w.y * 0.021);
  return smoothstep(wd, wd - 2.5, abs(w.x - streamX(w.y)));
}
// 瀑布遮罩：x 覆盖，y 边缘（1 = 水边），z 沿程 t，w 横向坐标（带符号，用于水纹）
vec4 wfMask(vec2 w) {
  vec4 best = vec4(0.0);
  for (int i = 0; i < NWF; i++) {
    vec4 f = WF[i];
    if (abs(w.y - f.x) > 260.0 * f.z + 60.0) continue;
    vec2 A, B; wfEnds(f, A, B);
    vec2 ab = B - A, dA = w - A;
    float t = clamp(dot(dA, ab) / dot(ab, ab), 0.0, 1.0);
    vec2 pr = dA - ab * t;
    float dist = length(pr);
    float ww = (6.0 + 8.0 * t) * f.z;
    float cover = smoothstep(ww, ww - 2.0, dist) * smoothstep(0.02, 0.07, t) * (1.0 - smoothstep(0.93, 0.99, t));
    if (cover > best.x) best = vec4(cover, smoothstep(ww * 0.55, ww, dist), t, dot(pr, vec2(-ab.y, ab.x)) / length(ab));
  }
  return best;
}

vec3 paperTone() { return mix(hexc(0xf0eadc), hexc(0xf7e6c4), uP0.z); }
vec3 inkTone() { return clamp(hexc(0x2e363e) / vec3(0.86), 0.02, 0.9); }
vec3 sunDir() { return normalize(vec3(-0.78, 0.12, 0.48)); }
vec3 sunCol() { return mix(vec3(0.95, 1.0, 1.05), vec3(1.25, 1.0, 0.78), uP0.z); }
vec3 skyAmb() { return vec3(0.62, 0.64, 0.68); }

vec3 shadeTerrain(vec3 p, vec3 n, float sunLit, vec3 dyn, out float mat) {
  mat = 0.0;
  float corr = uP0.x, flow = uP1.x;
  vec3 paper = paperTone(), inkT = inkTone();
  float nz = n.z;
  vec2 g2 = -n.xy / max(nz, 0.2);
  float gl = length(g2);
  vec2 gd = g2 / (gl + 1e-4);
  float edgeX = pow(abs(p.x - 450.0) / 450.0, 2.0);
  float sideMul = mix(0.65, 1.15, edgeX);

  // 受光：太阳 + 天光；动态光让表面变亮
  float lit = 0.40 + 0.18 * nz + 0.85 * sunLit + dot(dyn, vec3(0.33));
  float dn = clamp(1.25 - lit, 0.0, 1.0);                 // 0 亮 .. 1 暗
  // 墨块：明暗量化成几级，阈值随低频噪声抖动（干湿浓淡），边缘柔和
  float q = (dn + 0.12 * (vnoise(p.xy * 0.018 + 3.0) - 0.5)) * 3.0;
  float lvl = floor(q);
  float blockD = (lvl + smoothstep(0.30, 0.70, fract(q))) / 3.0;
  float wash = mix(dn, clamp(blockD, 0.0, 1.0), 0.28);
  // 皴：沿坡向（弧长坐标）的笔触
  float arc = dot(p.xy, gd) * nz + p.z * sqrt(max(0.0, 1.0 - nz * nz));
  float perp = dot(p.xy, vec2(-gd.y, gd.x));
  float st = vnoise(vec2(perp * 0.07, arc * 0.014)) * 0.75 + vnoise(vec2(perp * 0.09 + 5.0, arc * 0.018)) * 0.25;
  float stroke = smoothstep(0.40, 0.75, st);
  float slopeK = smoothstep(0.12, 0.7, gl);
  float alt = smoothstep(10.0, 260.0, p.z);
  float D = wash * 0.80 + slopeK * stroke * (0.05 + 0.24 * dn);
  D *= mix(0.40, 1.0, alt);
  // 山脊勾勒（浓）与沟壑（淡）：高度图曲率
  float e = 3.0;
  float lap = 0.25 * (hmapAt(p.xy + vec2(e, 0.0)).x + hmapAt(p.xy - vec2(e, 0.0)).x + hmapAt(p.xy + vec2(0.0, e)).x + hmapAt(p.xy - vec2(0.0, e)).x) - p.z;
  float dry = 0.55 + 0.45 * vnoise(vec2(perp * 0.25, arc * 0.06));
  D += (0.55 * smoothstep(0.5, 2.5, -lap) + 0.15 * smoothstep(0.6, 3.0, lap)) * dry * smoothstep(10.0, 70.0, p.z);
  D *= sideMul;
  vec3 col = absorb(paper, inkT, D * 2.2);
  col *= mix(vec3(1.0), vec3(1.08, 1.0, 0.90), sunLit * (0.3 + 0.7 * uP0.z));

  // 水：溪流与瀑布
  float sm = streamMask(p.xy) * step(p.z, 24.0);
  vec4 wf = wfMask(p.xy);
  float wcov = max(sm, wf.x);
  if (wcov > 0.0) {
    float fl = smoothstep(0.55, 0.85, vnoise(vec2(p.x * 0.6, (p.y + uTime * 60.0 * flow) * 0.05)));
    vec3 wc = mix(paper * 1.02, hexc(0x8fa3a8), 0.25 + 0.35 * fl);
    float streak = smoothstep(0.40, 0.8, vnoise(vec2(wf.w * 0.7, (wf.z * 190.0 + uTime * 45.0 * flow) * 0.10)));
    vec3 fc = mix(paper * 1.12, hexc(0x9fb4b8), 0.50 * (1.0 - streak));
    fc = absorb(fc, inkT, wf.y * 0.9);
    wc = mix(wc, fc, step(sm, wf.x));
    col = mix(col, wc, wcov);
    mat = 1.0;
  }
  // 山径
  float zone = smoothstep(4800.0, 5300.0, p.y) * (1.0 - smoothstep(10600.0, 11000.0, p.y));
  float pc = pathC(p.y);
  float pd = abs(p.x - pc) - 14.0;
  float path = smoothstep(2.0, -2.0, pd) * zone * smoothstep(30.0, 12.0, p.z) * (1.0 - wcov);
  col = mix(col, paper * hexc(0xdcc79a) * 1.05, path * 0.85);
  col *= 1.0 - 0.18 * smoothstep(2.5, 0.0, abs(abs(p.x - pc) - 6.0)) * step(0.5, fract(p.y / 14.0)) * path;
  if (path > 0.3) mat = 2.0;

  // 蚀：霓虹裂纹自高处山体向下爬
  if (corr > 0.001 && p.z > 6.0) {
    vec2 pw = p.xy + 45.0 * vec2(vnoise(p.xy * 0.02), vnoise(p.xy * 0.02 + 7.0)) - 22.0;
    vec2 q = pw * 0.0085; vec2 iq = floor(q), fq = fract(q);
    float F1 = 9.0, F2 = 9.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      float d = length(o + hash22(iq + o) - fq);
      if (d < F1) { F2 = F1; F1 = d; } else if (d < F2) F2 = d;
    }
    float edgeC = F2 - F1;
    float altc = clamp(p.z / 300.0, 0.0, 1.0);
    float region = smoothstep(1.05 - corr * 1.05, 1.3 - corr * 1.05, altc * 0.85 + fbm(p.xy * 0.006, 2) * 0.4) * (1.0 - wcov);
    float crack = smoothstep(0.035 + 0.03 * vnoise(p.xy * 0.03), 0.0, edgeC) * region * step(0.28, hash21(iq + floor(F1 * 3.0)));
    float halo = smoothstep(0.30, 0.0, edgeC) * region;
    float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + hash21(iq) * 20.0 + uBeat * 6.28);
    vec3 neon = mix(hexc(0x3ff4ff), hexc(0xff3fbf), smoothstep(0.35, 0.65, vnoise(p.xy * 0.004 + 2.0)));
    col = absorb(col, vec3(0.6, 0.55, 0.6), halo * 0.6);
    col += neon * crack * 0.85 * pulse + neon * halo * 0.04;
  }
  col += dyn * paper * (0.5 * (1.0 - D * 0.5));
  return col;
}

// ---- 谷雾 ----
float fogDensity(vec3 p) {
  float top = smoothstep(190.0, 20.0, p.z);
  float n = fbm(vec2(p.x * 0.0055 + uTime * 0.010, p.y * 0.0048 + p.z * 0.004), 3);
  float d = top * (0.25 + 1.5 * smoothstep(0.30, 0.75, n)) * 0.0040 * (0.25 + 1.5 * uP0.y);
  for (int i = 0; i < NWF; i++) {
    vec4 f = WF[i];
    if (abs(p.y - f.x) > 260.0 * f.z + 100.0) continue;
    vec2 A, B; wfEnds(f, A, B);
    vec2 dB = p.xy - B;
    d += 0.02 * f.z * exp(-dot(dB, dB) / (2.0 * 45.0 * 45.0)) * exp(-p.z / 40.0);
  }
  return d;
}
`;

const PINE_PLACE = `
bool place(vec2 c, out vec3 pos, out float sc, out float yaw, out float rnd) {
  vec2 h = hash22(c * 0.37 + 11.0);
  vec2 xy = c + (h - 0.5) * 20.0;
  pos = vec3(xy, 0.0); sc = 0.0; yaw = 0.0;
  rnd = hash21(c + 7.7);
  vec4 hm = hmapAt(xy);
  // 成簇：低频噪声选出松林斑块；山脊（凸）与坡腰优先，平地与凹沟稀疏
  float lap = 0.25 * (hmapAt(xy + vec2(14.0, 0.0)).x + hmapAt(xy - vec2(14.0, 0.0)).x + hmapAt(xy + vec2(0.0, 14.0)).x + hmapAt(xy - vec2(0.0, 14.0)).x) - hm.x;
  float ridge = 0.25 + 0.75 * smoothstep(0.5, 5.0, -lap);
  float slope = 0.5 + 0.5 * smoothstep(0.08, 0.4, length(hm.yz));
  float dens = smoothstep(0.50, 0.66, fbm(xy * 0.0052 + 9.0, 3)) * uP1.y * ridge * slope * smoothstep(30.0, 100.0, hm.x) * (1.0 - smoothstep(260.0, 380.0, hm.x));
  if (rnd > dens * 1.3 || length(hm.yz) > 1.5) return false;
  if (wfMask(xy).x > 0.0) return false;
  sc = 62.0 + 40.0 * hash21(c + 3.3);
  yaw = hash21(c + 1.9) * 6.283;
  pos.z = hm.x - 1.0;
  return true;
}
`;
const PINE_SHADE = `
vec3 shadeModel(vec3 wp, vec3 n, float aux, float rnd, float sunLit, vec3 dyn) {
  vec3 ink = hexc(0x0b100f);
  float lit = 0.18 + 0.22 * n.z + 0.95 * sunLit + dot(dyn, vec3(0.33));
  if (aux < -0.5) {
    // 树干：焦墨偏褐，受光面一线
    return mix(hexc(0x14100c), hexc(0x5a4632), clamp(0.6 * (lit - 0.3), 0.0, 1.0)) + dyn * 0.15;
  }
  // 针叶：焦墨，针尖与受光面略淡（aux 大处偏淡，飞白）
  float k = clamp(0.5 * (lit - 0.3) + 0.55 * aux + 0.2 * (rnd - 0.5), 0.0, 1.0);
  vec3 col = mix(ink, hexc(0x4a5a52), k * k);
  return col + dyn * hexc(0x2a3530) * 0.6;
}

`;

/**
 * 水墨松：一笔浓墨的弯曲树干 + 数根细枝，枝梢是放射状的针叶簇（每根针是一条细长三角，浓淡随机、针尖淡，边缘是一根根针）。
 * 针簇大体平铺（略上翘 / 下垂），从俯视与斜视都呈放射纹理。局部高度 1。
 */
function pineMesh(): Float32Array {
  const out: number[] = [];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const norm = (x: number, y: number, z: number) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const V = (p: number[], n: number[], aux: number) => out.push(p[0], p[1], p[2], n[0], n[1], n[2], aux);
  // 一段细枝：a→b，用两片十字四边形（各 2 个三角）
  const stick = (a: number[], b: number[], w0: number, w1: number) => {
    for (const [ox, oy] of [[1, 0], [0, 1]]) {
      const A0 = [a[0] - ox * w0, a[1] - oy * w0, a[2]], A1 = [a[0] + ox * w0, a[1] + oy * w0, a[2]];
      const B0 = [b[0] - ox * w1, b[1] - oy * w1, b[2]], B1 = [b[0] + ox * w1, b[1] + oy * w1, b[2]];
      const n = norm(ox * 0.5, oy * 0.5, 1);
      V(A0, n, -1); V(A1, n, -1); V(B0, n, -1); V(A1, n, -1); V(B1, n, -1); V(B0, n, -1);
    }
  };
  // 针簇：中心 c，半径 R，n 根针
  const burst = (c: number[], R: number, n: number, lift: number) => {
    for (let i = 0; i < n; i++) {
      const th = (i + rnd() * 0.8) / n * Math.PI * 2;
      const L = R * (0.55 + 0.45 * rnd());
      const dx = Math.cos(th), dy = Math.sin(th);
      const dz = lift * (rnd() - 0.35) * L;
      const w = 0.014 * (0.7 + 0.6 * rnd());
      const tip = [c[0] + dx * L, c[1] + dy * L, c[2] + dz];
      const b0 = [c[0] - dy * w, c[1] + dx * w, c[2]], b1 = [c[0] + dy * w, c[1] - dx * w, c[2]];
      const nn = norm(dx * 0.35, dy * 0.35, 1);
      const dark = rnd() < 0.3 ? 0.55 : 0.0; // 少数针偏淡：飞白
      V(b0, nn, dark); V(b1, nn, dark); V(tip, nn, dark + 0.25 * rnd());
    }
  };
  // 树干：沿曲线的 6 段，一笔浓墨，越往上越细
  const trunk: number[][] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; trunk.push([0.10 * Math.sin(t * 2.6) - 0.05 * t, 0.04 * Math.sin(t * 4.0), t * 0.78]); }
  for (let i = 0; i < 6; i++) stick(trunk[i], trunk[i + 1], 0.034 * (1 - i / 7), 0.034 * (1 - (i + 1) / 7));
  // 枝：自树干不同高度伸出，交替左右，末端一簇针叶
  const br = [[2, -1, 0.26], [3, 1, 0.30], [4, -1, 0.24], [5, 1, 0.20], [6, 0, 0.12]];
  for (const [ti, side, len] of br) {
    const o = trunk[ti];
    const ang = side === 0 ? 0 : (side < 0 ? Math.PI : 0) + (rnd() - 0.5) * 0.9;
    const dx = Math.cos(ang), dy = Math.sin(ang) * 0.6 + (rnd() - 0.5) * 0.4;
    const mid = [o[0] + dx * len * 0.5, o[1] + dy * len * 0.5, o[2] + len * 0.08];
    const end = [o[0] + dx * len, o[1] + dy * len, o[2] + len * (side === 0 ? 0.3 : 0.02)];
    stick(o, mid, 0.011, 0.008); stick(mid, end, 0.008, 0.005);
    burst([end[0], end[1], end[2] + 0.01], 0.22 * (0.75 + 0.5 * rnd()) * (side === 0 ? 0.8 : 1), 44, 0.25);
    burst([(o[0] + end[0]) / 2, (o[1] + end[1]) / 2, mid[2] + 0.01], 0.13, 22, 0.2);
    burst([end[0], end[1], end[2] - 0.01], 0.15, 14, -0.9);
  }
  return new Float32Array(out);
}

const SCENE: Bg3D = {
  glsl: GLSL,
  fogTop: 220,
  models: [{ mesh: pineMesh(), cell: 14, cols: 82, rows: 118, place: PINE_PLACE, shade: PINE_SHADE }],
};

export const BG_STAGE1: BgDef = {
  id: 'stage1',
  tint: 0xb9a888,
  params: { p0: [0, 0.5, 0.35, 0], p1: [1, 1, 0, 0] },
  scene3d: SCENE,
  fg: `
void main() {
  vec2 base = vec2(vUv.x * PLAY_W, vUv.y * PLAY_H);
  float y = base.y + uScroll * 1.7;
  float n = fbm(vec2(base.x * 0.0028 + uTime * 0.02, y * 0.0017) + 11.0, 3);
  float a = smoothstep(0.52, 0.86, n) * 0.20 * (0.3 + 0.7 * uP0.y);
  vec3 c = mix(hexc(0xf1ece0), hexc(0xffe9c0), uP0.z);
  fragColor = vec4(c * a, a);
}`,
};
