import type { BgDef } from './header';
import type { Bg3D } from '../gl/scene3d';

/**
 * 第三幕 · 云海雷（真 3D：光线步进体积云海 + 云内闪电，见 src/gl/scene3d.ts 的 fogFS / compHook 扩展）
 *
 * 场景：摄像机在 z=1600 俯视。z≈-330..+540 是积云海（底 z≈-330，云塔可升到 z≈+540，穿过游戏平面 z=0），
 * z≈760..920 是摄像机与游戏平面之间掠过的稀薄前景云（淡、亮，不遮敌弹），云隙下是更远处（z≈-950）的墨色云海。
 * 没有地面敌人：地形只是一张 z=-30 的空平面（给体积雾提供深度与网格），画面全部来自 fogFS + compHook。
 * 体积云：半分辨率光线步进（3D 值噪声塑形的云团/云塔，太阳沿光线 3 步自阴影，多次散射近似 + 前向银边，
 * 环境光随高度），亮度积分后映射成连续墨洗与纸白受光面，云团边缘保留柔和银边。
 * 闪电：分叉光带（compHook 全分辨率画，闪电路径同时作为线光源照亮云内部）。
 *
 * uP0.x 雷暴 0..1：0 金色落日；1 紫色雷暴（云更厚更黑、云塔更高、云隙更暗、自动闪电增多）。建议 scroll 0..5000 为 0，5000→9000 升到 1。
 * uP0.y 云量 0..1：云海覆盖度（默认 0.55）
 * uP0.z 天宫 0..1：远处天宫在云隙里升起（默认 0，终幕为 1）
 * uP0.w 战氛 0..1：Boss 战氛围，云速加快并带品红脉动（默认 0）
 * uP1.x 云速倍率（默认 1）；uP1.y 自动闪电频率倍率（默认 1，0 关闭）
 * uFlash：游戏驱动的闪电（全云层打亮 + 画出一道闪电）。
 */
const GLSL = `
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3(vec3 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { if (i >= oct) break; s += a * vn3(p); p = p * 2.03 + vec3(3.1, 1.7, 5.3); a *= 0.5; }
  return s / (1.0 - pow(0.5, float(oct)));
}

vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
// 相邻格中的球状云包：中心抖动限制在格内，半径小于离开采样邻域的距离。
// 保证格边界连续，避免 Worley 最近点切换形成岩壁式长裂纹。
float bill3(vec3 p, out vec3 normal) {
  vec3 closest = vec3(0.0);
  vec3 i = floor(p - 0.5), f = p - i;
  float d = 2.0;
  for (int k = 0; k < 8; k++) {
    vec3 o = vec3(float(k & 1), float((k >> 1) & 1), float(k >> 2));
    vec3 r = o + 0.5 + (h33(i + o) - 0.5) * 0.30 - f;
    if (dot(r, r) < d) { d = dot(r, r); closest = r; }
  }
  normal = -closest / max(sqrt(d), 1e-3);
  return (1.0 - smoothstep(0.30, 0.78, sqrt(d)));
}
float bill3(vec3 p) { vec3 n; return bill3(p, n); }

float terrainH(vec2 w, int oct) { return -30.0; }
vec3 sunDir() { return normalize(vec3(-0.55, -0.45, 0.75)); }
vec3 sunCol() { return vec3(1.0); }
vec3 skyAmb() { return vec3(0.6); }
vec3 paperTone() { return mix(hexc(0xf6e2bc), hexc(0xb4b2bc), uP0.x); }
vec3 inkTone() { return mix(hexc(0x4a3f60), hexc(0x24242c), uP0.x) / vec3(0.86); }
vec3 shadeTerrain(vec3 p, vec3 n, float sunLit, vec3 dyn, out float mat) { mat = 0.0; return vec3(0.0); }
float fogDensity(vec3 p) { return 0.0; }

// ---- 云参数 ----
float cloudCover() { return mix(0.30, 0.64, uP0.y) + 0.07 * uP0.x; }
float spd() { return uP1.x * (1.0 + 0.5 * uP0.w); }
const float Z_BASE = -330.0;
// 密度（无量纲 0..1）。oct：3D 噪声倍频。h：云内高度分数（0 底 .. 1 顶）
float cloudD(vec3 p, int oct, out float h, out vec3 normal) {
  normal = vec3(0.0, 0.0, 1.0);
  h = 0.0;
  float storm = uP0.x;
  vec2 w = p.xy + vec2(uTime * 7.0 * spd(), 0.0);
  float cov = fbm(w * 0.0038 + 3.0, oct >= 2 ? 3 : 2);
  float c = smoothstep(1.0 - cloudCover() - 0.12, 1.0 - cloudCover() + 0.08, cov);
  if (c <= 0.0) return 0.0;
  float tw = smoothstep(0.52 - 0.10 * storm, 0.78, vnoise(w * 0.0042 + 9.0) * 0.6 + (oct >= 2 ? vnoise(w * 0.0095) : 0.5) * 0.4);
  float Ht = 260.0 + 130.0 * storm + tw * (220.0 + 180.0 * storm);
  float zb = Z_BASE + 40.0 * vnoise(w * 0.004);
  h = (p.z - zb) / max(Ht, 1.0);
  if (h < 0.0 || h > 1.0) return 0.0;
  float prof = smoothstep(0.0, 0.14, h) * (1.0 - smoothstep(0.82, 1.0, h));
  float b = prof * (0.30 + 0.70 * c);
  if (b < 0.06) return 0.0;
  vec3 pn = vec3(w, p.z);
  float q = bill3(pn * 0.0075) * 0.38 + (oct >= 2 ? bill3(pn * 0.019 + 7.0) * 0.34 : 0.17) + (oct >= 3 ? bill3(pn * 0.045 + 3.0) * 0.28 : 0.14);
  q = clamp((q - 0.5) * 1.6 + 0.5, 0.0, 1.0);
  float d = b - (1.0 - q) * 1.0 * (0.35 + 0.65 * h) - 0.02;
  return clamp(d * 3.4 - 0.12, 0.0, 1.0);
}

float cloudD(vec3 p, int oct, out float h) { vec3 n; return cloudD(p, oct, h, n); }

// ---- 闪电 ----
const float B_TOP = 470.0, B_BOT = -330.0;
// x 强度，y 种子
vec2 boltState() {
  float t8 = floor(uTime * 0.9), ph = fract(uTime * 0.9);
  float r8 = hash21(vec2(t8, 3.0));
  float autoF = step(0.30, r8) * smoothstep(0.05, 0.4, uP0.x) * uP1.y * exp(-ph * 7.0) * (0.6 + 0.4 * sin(ph * 60.0));
  float f = max(uFlash, autoF);
  return vec2(f, uFlash > autoF ? floor(uTime * 4.0) : t8);
}
vec2 boltRoot(float seed) { return vec2(150.0 + 600.0 * hash21(vec2(seed, 11.0)), uScroll + 300.0 + 560.0 * hash21(vec2(seed, 13.0))); }
// 主干：u 0..1（顶到底）
vec2 boltXY(float u, float seed) {
  vec2 r = boltRoot(seed);
  float j = (vnoise(vec2(u * 7.0, seed)) - 0.5) * 90.0 + (vnoise(vec2(u * 23.0 + 5.0, seed + 2.0)) - 0.5) * 34.0;
  float j2 = (vnoise(vec2(u * 6.0 + 9.0, seed + 4.0)) - 0.5) * 60.0;
  return r + vec2(j, j2);
}
float boltZ(float u) { return mix(B_TOP, B_BOT, u); }
// 分叉 k：从主干 u0 处横向伸出
vec2 forkXY(float u, float seed, float k, out float u0) {
  u0 = 0.25 + 0.30 * hash21(vec2(seed, 21.0 + k * 7.0));
  float sg = hash21(vec2(seed, 31.0 + k)) < 0.5 ? -1.0 : 1.0;
  float du = u - u0;
  vec2 o = vec2(sg * du * 520.0, (hash21(vec2(seed, 41.0 + k)) - 0.5) * du * 260.0);
  o += (vec2(vnoise(vec2(u * 17.0 + k * 3.0, seed + 8.0)), vnoise(vec2(u * 15.0, seed + 12.0 + k))) - 0.5) * 46.0;
  return boltXY(u0, seed) + o;
}
// 云中点到闪电主干（3 个锚点折线）的距离；锚点由调用者预先算好
float segD3(vec3 p, vec3 a, vec3 b) { vec3 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float boltDist(vec3 p, vec3 a0, vec3 a1, vec3 a2) { return min(segD3(p, a0, a1), segD3(p, a1, a2)); }
vec2 boltScr(vec3 p) { vec4 c = projectW(p); return (c.xy / c.w * 0.5 + 0.5) * vec2(PLAY_W, PLAY_H); }
`;

const FOG = `
uniform sampler2D uAux;
uniform int uSteps;
uniform float uFogTop;
in vec2 vUv;
out vec4 o;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float hg(float mu, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * mu, 1.5)); }

void main() {
  vec3 dir = vec3((vUv.x * 2.0 - 1.0) * TAN_H * ASPECT, (vUv.y * 2.0 - 1.0 + CAM_S / 600.0) * TAN_H, -1.0);
  float dl = length(dir);
  vec3 V = dir / dl, L = sunDir();
  float storm = uP0.x;
  vec2 bs = boltState();
  float flash = bs.x, seed = bs.y;
  float mu = dot(V, L);
  float phase = 0.55 + 1.6 * hg(mu, 0.55) + 0.9 * pow(max(mu, 0.0), 8.0);
  float sunK = mix(1.0, 1.0, storm);
  float jit = ign(gl_FragCoord.xy);
  vec3 ba0 = vec3(boltXY(0.0, seed), B_TOP), ba1 = vec3(boltXY(0.5, seed), 0.5 * (B_TOP + B_BOT)), ba2 = vec3(boltXY(1.0, seed), B_BOT);
  float T = 1.0, Bacc = 0.0, Eacc = 0.0, Ldir = 0.0;
  vec3 dynAcc = vec3(0.0);

  // 前景稀云（z 760..920，摄像机与游戏平面之间）：淡而亮
  {
    const int NN = 5;
    float t0 = CAM_Z - 920.0, ds = 160.0 / float(NN);
    for (int i = 0; i < NN; i++) {
      float t = t0 + (float(i) + jit) * ds;
      vec3 p = uCam + dir * t;
      vec2 w = p.xy + vec2(uTime * 11.0 * spd(), 0.0);
      float n = fbm(w * 0.0042 + vec2(p.z * 0.002, 17.0), 3);
      float dn = smoothstep(0.50 - 0.04 * storm, 0.82, n) * (0.05 + 0.10 * storm);
      float a = 1.0 - exp(-dn * 0.006 * ds * dl);
      Bacc += T * a * mix(0.95, 1.15, 0.5) * 0.9;
      T *= 1.0 - a;
    }
  }

  // 主云海
  {
    float zTop = mix(240.0, 550.0, storm);
    float t0 = CAM_Z - zTop, t1 = CAM_Z - (Z_BASE - 50.0);
    // 固定采样相位：入云时回退重置相位会在受光面留下整圈阶梯纹。
    float ds = (t1 - t0) / float(uSteps * 2);
    float len = ds * dl;
    float sig = mix(0.018, 0.025, storm);
    for (int i = 0; i < 56; i++) {
      if (i >= uSteps * 2) break;
      float t = t0 + (float(i) + jit) * ds;
      vec3 p = uCam + dir * t;
      float h;
      vec3 cloudN;
      float dn = cloudD(p, 3, h, cloudN);
      if (dn < 0.004) continue;
      float a = 1.0 - exp(-dn * sig * len);
      // 太阳自阴影
      float tau = 0.0;
      float sh;
      tau += cloudD(p + L * 14.0, 3, sh) * 1.2;
      tau += cloudD(p + L * 50.0, 2, sh) * 2.5;
      tau += cloudD(p + L * 130.0, 1, sh) * 5.0;
      tau *= sig * 24.0;
      float sunE = exp(-tau) + 0.30 * exp(-0.25 * tau);
      float amb = 0.04 + 0.26 * smoothstep(0.0, 1.0, h);
      float B = sunE * phase * 1.35 * sunK + amb;
      B += 0.7 * (1.0 - dn) * exp(-tau) * sunK;   // 银边：薄处强前向透光
      B *= mix(0.45, 1.0, smoothstep(0.0, 0.25, h));                 // 云底更暗
      float E = 0.0;
      if (flash > 0.02) {
        float bd = boltDist(p, ba0, ba1, ba2);
        E = flash * 2.0 / (1.0 + bd * bd / (150.0 * 150.0));
        B += E * 0.9;
      }
      vec3 dl3 = dynLightsVol(p) - uFlash * vec3(1.0, 0.95, 0.85) * 0.6;
      float dyn = dot(dl3, vec3(0.33));
      B += dyn * 0.9;
      float wB = T * a;
      Bacc += wB * B;
      Eacc += wB * E;
      Ldir += wB * sunE;
      dynAcc += wB * dl3;
      T *= 1.0 - a;
      if (T < 0.005) break;
    }
  }

  float cov = 1.0 - T;
  float Bavg = Bacc / max(cov, 1e-3);
  float Eavg = Eacc / max(cov, 1e-3);
  // 连续墨洗保留球团明暗；低幅纸纹不产生整片等高线。
  vec2 fp = vUv * vec2(PLAY_W, PLAY_H);
  float D = (1.0 - smoothstep(0.42, 1.25, Bavg));
  D = clamp(D + 0.22 * storm * (1.0 - Eavg) * smoothstep(0.0, 0.3, D + 0.3), 0.0, 1.0);
  D *= 1.0 - 0.8 * sat1(Eavg * 0.9);
  float q = (D + 0.10 * (vnoise(fp * 0.03 + 3.0) - 0.5)) * 3.0;
  float lvl = floor(q);
  float blockD = (lvl + smoothstep(0.30, 0.70, fract(q))) / 3.0;
  D = mix(D, clamp(blockD, 0.0, 1.0), 0.2);
  vec3 paper = paperTone(), inkT = inkTone();
  vec3 c = absorb(paper, inkT, D * mix(1.5, 1.35, storm));
  float lit = clamp(Ldir / max(cov, 1e-3) - 0.5, 0.0, 1.0);
  c *= mix(vec3(1.0), vec3(1.10, 0.98, 0.82), lit * (1.0 - storm));
  c *= 1.0 + storm * 1.6 * (1.0 - D);
  c += hexc(0xd0c4ff) * Eavg * 0.5;
  c += hexc(0xc08cff) * uP0.w * 0.10 * (1.0 - uBeat) * cov;
  o = vec4(c * cov, T);
}
`;

const HOOK = `
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0)); }

// 云层下方的远景天宫：浮岛、殿身、飞檐仍由近处的体积云自然遮挡。
float palaceTower(vec2 uv, float cx, float base, float ht, float wid) {
  vec2 p = uv - vec2(cx, base);
  float island = (1.0 - smoothstep(0.0, 0.002, abs(p.x) - wid * 1.9 * clamp(1.0 + p.y * 14.0, 0.0, 1.0)))
    * smoothstep(-0.04, -0.036, p.y) * (1.0 - smoothstep(0.0, 0.002, p.y));
  float body = (1.0 - smoothstep(0.0, 0.002, abs(p.x) - wid))
    * (1.0 - smoothstep(0.0, 0.002, -p.y)) * (1.0 - smoothstep(ht * 0.8, ht * 0.8 + 0.002, p.y));
  float roof = 0.0;
  for (int i = 0; i < 3; i++) {
    float yy = ht * (0.36 + 0.23 * float(i));
    float w = wid * (1.7 - 0.22 * float(i));
    float eave = (1.0 - smoothstep(0.0, 0.002, abs(p.x) - w * (1.0 - clamp((p.y - yy) * 35.0, 0.0, 0.4))))
      * (1.0 - smoothstep(0.0, 0.002, yy - p.y)) * (1.0 - smoothstep(yy + 0.012, yy + 0.014, p.y));
    roof = max(roof, eave);
  }
  float spire = (1.0 - smoothstep(0.0, 0.002, abs(p.x) - 0.002))
    * (1.0 - smoothstep(0.0, 0.002, ht * 0.80 - p.y)) * (1.0 - smoothstep(ht * 1.08, ht * 1.1, p.y));
  return max(max(island, body), max(roof, spire));
}

// 云隙下更远处的墨色云海（z≈-950）
vec3 abyss(vec2 uv) {
  float storm = uP0.x;
  vec3 dir = vec3((uv.x * 2.0 - 1.0) * TAN_H * ASPECT, (uv.y * 2.0 - 1.0 + CAM_S / 600.0) * TAN_H, -1.0);
  vec3 p = uCam + dir * (CAM_Z + 950.0);
  float n = fbm(p.xy * 0.0017 + vec2(uTime * 0.012 * spd(), 40.0), 4);
  float D = mix(1.1, 0.7, smoothstep(0.38, 0.68, n)) * (1.0 - 0.05 * storm) + 0.15 * storm;
  vec3 c = absorb(paperTone(), inkTone(), D * mix(1.5, 4.5, storm));
  vec2 sun = vec2(0.22, 0.86);
  float g = exp(-length((uv - sun) * vec2(0.75, 1.0)) * 2.4);
  c += hexc(0xffb868) * g * 0.42 * (1.0 - storm) * (0.6 + uP0.z * 0.4);
  c += hexc(0xffd795) * (1.0 - smoothstep(0.037, 0.044, length((uv - sun) * vec2(0.75, 1.0)))) * 0.5 * (1.0 - storm);
  c += hexc(0x9a78ff) * (1.0 - uv.y) * 0.05 * storm;
  if (uP0.z > 0.01 && uv.y > 0.55) {
    float rise = smoothstep(0.0, 1.0, uP0.z);
    float base = 0.69 + rise * 0.08;
    float sway = 0.012 * sin(uScroll * 0.0002);
    float pal = palaceTower(uv, 0.31 + sway, base, 0.082, 0.019);
    pal = max(pal, palaceTower(uv, 0.52 + sway, base + 0.012, 0.13, 0.028));
    pal = max(pal, palaceTower(uv, 0.72 + sway, base - 0.014, 0.095, 0.021));
    vec3 palCol = mix(hexc(0x4c3855), hexc(0x241a3d), storm);
    c = mix(c, palCol, pal * rise * 0.82);
  }
  return c;
}

vec3 compHook(vec3 col, vec4 F, vec2 uv) {
  vec2 fp = uv * vec2(PLAY_W, PLAY_H);
  // 对低分辨率的步进采样做轻柔墨洗，保留云包尺度并压低像素噪声。
  vec2 fo = 1.2 / vec2(textureSize(uFog, 0));
  F = (F * 4.0 + texture(uFog, uv + vec2(fo.x, 0.0)) + texture(uFog, uv - vec2(fo.x, 0.0))
    + texture(uFog, uv + vec2(0.0, fo.y)) + texture(uFog, uv - vec2(0.0, fo.y))) / 8.0;
  vec3 c = abyss(uv) * F.a + F.rgb;
  vec3 inkT = inkTone();
  // 勾云：云缘（透射率梯度）与云内明暗交界的墨线
  vec2 o = vec2(0.75) / vec2(textureSize(uFog, 0));
  vec4 fR = vec4(0.0), fL = vec4(0.0), fU = vec4(0.0), fD = vec4(0.0);
  for (int k = -1; k <= 1; k++) {
    float kk = float(k);
    fR += texture(uFog, uv + vec2(3.0, 1.5 * kk) * o); fL += texture(uFog, uv - vec2(3.0, -1.5 * kk) * o);
    fU += texture(uFog, uv + vec2(1.5 * kk, 3.0) * o); fD += texture(uFog, uv - vec2(-1.5 * kk, 3.0) * o);
  }
  fR /= 3.0; fL /= 3.0; fU /= 3.0; fD /= 3.0;
  float g = length(vec2(fR.a - fL.a, fU.a - fD.a));
  float lu = 0.0;
  {
    vec3 k = vec3(0.33);
    float lR = dot(fR.rgb, k) / max(1.0 - fR.a, 0.05), lL = dot(fL.rgb, k) / max(1.0 - fL.a, 0.05);
    float lU = dot(fU.rgb, k) / max(1.0 - fU.a, 0.05), lD = dot(fD.rgb, k) / max(1.0 - fD.a, 0.05);
    lu = length(vec2(lR - lL, lU - lD)) * smoothstep(0.1, 0.5, 1.0 - F.a);
  }
  float dry = 0.5 + 0.5 * vnoise(fp * 0.9 + 3.0);
  vec2 outw = vec2(fR.a - fL.a, fU.a - fD.a);
  float litSide = smoothstep(0.1, 0.6, dot(outw / (length(outw) + 1e-4), normalize(vec2(-0.75, 0.35))));
  float edge = smoothstep(0.14, 0.55, g) * litSide * dry;
  c = absorb(c, inkT, edge * 1.3);
  // 闪电本体：分叉光带
  vec2 bs = boltState();
  float flash = bs.x;
  vec2 bb0 = boltScr(vec3(boltXY(0.0, bs.y), B_TOP)), bb1 = boltScr(vec3(boltXY(0.5, bs.y), 0.5 * (B_TOP + B_BOT))), bb2 = boltScr(vec3(boltXY(1.0, bs.y), B_BOT));
  vec2 blo = min(bb0, min(bb1, bb2)) - vec2(260.0, 90.0), bhi = max(bb0, max(bb1, bb2)) + vec2(260.0, 90.0);
  if (flash > 0.03 && all(greaterThan(fp, blo)) && all(lessThan(fp, bhi))) {
    float seed = bs.y;
    float dmin = 1e4;
    vec3 pp = vec3(boltXY(0.0, seed), B_TOP);
    vec2 sp = boltScr(pp);
    for (int i = 1; i <= 14; i++) {
      float u = float(i) / 14.0;
      vec3 q = vec3(boltXY(u, seed), boltZ(u));
      vec2 sq = boltScr(q);
      dmin = min(dmin, segD(fp, sp, sq));
      sp = sq;
    }
    float dfk = 1e4;
    for (int k = 0; k < 2; k++) {
      float u0; forkXY(0.5, seed, float(k), u0);
      vec2 s0 = vec2(0.0);
      for (int i = 0; i <= 5; i++) {
        float u = u0 + float(i) / 5.0 * 0.38;
        float uu;
        vec3 q = vec3(forkXY(u, seed, float(k), uu), boltZ(u));
        vec2 sq = boltScr(q);
        if (i > 0) dfk = min(dfk, segD(fp, s0, sq));
        s0 = sq;
      }
    }
    float I = sat1((flash - 0.03) * 2.5);
    float core = (1.0 - smoothstep(0.6, 3.2, dmin)) + 0.7 * (1.0 - smoothstep(0.4, 2.2, dfk));
    float halo = exp(-dmin * 0.045) * 0.55 + exp(-dfk * 0.06) * 0.25;
    float vis = mix(1.0, 0.55, sat1((1.0 - F.a) * 1.2));
    c += hexc(0xc4b4ff) * halo * I * 0.9 * vis;
    c = mix(c, hexc(0xfff8ff) * 1.6, sat1(core) * I * vis);
  }
  return c;
}
`;

const SCENE: Bg3D = { glsl: GLSL, fogFS: FOG, compHook: HOOK, fogTop: 560, fogDiv: 3 };

export const BG_STAGE3: BgDef = {
  id: 'stage3',
  tint: 0x5a3c8c,
  params: { p0: [0, 0.55, 0, 0], p1: [1, 1, 0, 0] },
  scene3d: SCENE,
};
