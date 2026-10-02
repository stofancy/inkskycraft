import type { BgDef } from './header';
import type { Bg3D } from '../gl/scene3d';

/**
 * 第二幕 · 灯河夜（真 3D 场景：夜色长河、两岸实例化瓦顶/楼阁/宝塔、檐下灯笼、水面倒影、河灯、薄雾；
 * 透视俯视摄像机，见 src/gl/scene3d.ts；fg 为斜雨丝）
 * uP0.x 雨量 0..1：雨丝与水面雨圈密度（默认 0.25；脚本建议 6000 之后逐步升到 0.8）
 * uP0.y 蚀 0..1：楼阁瓦顶脊线/檐口的霓虹发光覆盖率（建议 scroll 8000→15000 从 0 升到 1）
 * uP0.z 水灯密度 0..1：漂流河灯数量，同时决定岸灯/檐下灯笼点亮的比例（默认 0.6；灯会段 4500-7000 可升到 1）
 * uP0.w 月色/河雾 0..1：月光碎银与河面薄雾（默认 0.5）
 * uP1.x 水流速度倍率（默认 1）
 * 构图：河面在 z=0（贴合第二关地面敌人「破船」），河道中心 riverC(y)、半宽 riverW(y)；两岸是高 ≈16 的条石驳岸平台，
 *   平台上按 120 单位地块随机放置瓦顶屋/楼阁/宝塔（沿河向），檐下挂灯笼；沿岸每 64 单位一盏岸灯。
 * 地貌地标（uScroll，约）：拱桥于 2400、7400、12400（桥面在 z≈20..38，桥下不可见水面）；4500-7000 灯会（uP0.z 升到 1）；
 *   8000 之后楼阁被蚀。
 * 与关卡脚本的约定：stages/stage2.ts 的 riverX(worldY) 必须与这里的 riverC(y) 相同。
 * 灯光可读性：灯火只做大而柔、低饱和的暖光晕（雾里自发光 + 表面溢光），灯笼本体亮度 ≤0.5，避免与敌弹（品红/白色小圆点）混淆。
 */
const LAMPC = 72;   // 河灯格距
const LOT = 120;    // 地块格距
const POST = 64;    // 岸灯间距

const GLSL = `
#define HAS_FOG_GLOW
const float LOT = ${LOT}.0;
const float LAMPC = ${LAMPC}.0;
const float POSTD = ${POST}.0;
vec3 gWarm = vec3(0.0);

float riverC(float y) { return 450.0 + 55.0 * sin(y * 0.0022 + 0.5) + 18.0 * sin(y * 0.0060); }
// 最窄半宽 248：脚本里的破船最外侧中心偏移 190，半船宽 50，整船仍在 z=0 水面。
float riverW(float y) { return 263.0 + 15.0 * sin(y * 0.0043 + 1.0); }
float aBank(vec2 w) { return abs(w.x - riverC(w.y)) - riverW(w.y); }   // <0 水面，>0 岸上
vec3 bridgeInfo(float y) {   // x: 距桥中心 dy, y: 是否有桥
  float k = floor((y - 2400.0) / 5000.0 + 0.5);
  return vec3(y - (2400.0 + 5000.0 * k), step(-0.5, k), k);
}
float litProb() { return 0.35 + 0.65 * uP0.z; }

float bridgeMask(vec2 w) {
  vec3 b = bridgeInfo(w.y);
  float dx = w.x - riverC(w.y);
  float span = riverW(w.y) + 30.0;
  return b.y * (1.0 - smoothstep(29.0, 31.0, abs(b.x))) * (1.0 - smoothstep(span, span + 4.0, abs(dx)));
}
float bridgeH(vec2 w) {
  float m = bridgeMask(w);
  if (m <= 0.0) return 0.0;
  vec3 b = bridgeInfo(w.y);
  float u = clamp((w.x - riverC(w.y)) / (riverW(w.y) + 30.0), -1.0, 1.0);
  return m * (22.0 + 16.0 * (1.0 - u * u) + 5.0 * smoothstep(24.0, 27.0, abs(b.x)));
}

float terrainH(vec2 w, int oct) {
  float a = aBank(w);
  // 水面高度恒为零，烘焙高度与梯度时只需检查桥面。
  if (a <= 0.0) return bridgeH(w);
  float n = fbm(w * 0.02, min(oct, 2));
  float h = smoothstep(0.0, 5.0, a) * (16.0 + 4.0 * n);
  return max(h, bridgeH(w));
}
float waterMask(vec2 w) { return (1.0 - smoothstep(-5.0, 0.0, aBank(w))); }
// 倒影落点：俯视下物理倒影正好在物体正下方，河道两侧的楼会被自己挡住，读不出「楼映在水里」。
// 所以把倒影艺术化：以岸线为镜，离岸距离 a 与高度 z 共同决定倒影伸进河里多深（压缩 0.55 / 高度 0.9），再叠加水波。
vec2 reflWarp(vec2 w, vec3 wp) {
  float c = riverC(wp.y), W = riverW(wp.y);
  float sgn = wp.x < c ? -1.0 : 1.0;
  float a = abs(wp.x - c) - W;
  float newA = -(0.55 * max(a, 0.0) + max(wp.z - 14.0, 0.0) * 0.9 + 3.0);
  float nx = c + sgn * (W + newA);
  return vec2(nx - w.x + 2.2 * sin(w.y * 0.13 + uTime * 1.7) + 1.5 * sin(w.y * 0.31 - uTime * 2.3 + w.x * 0.05), 0.0);
}

vec3 paperTone() { return hexc(0x0f1218); }
vec3 inkTone() { return vec3(0.14, 0.15, 0.20); }
vec3 sunDir() { return normalize(vec3(-0.5, -0.35, 0.72)); }
vec3 sunCol() { return vec3(0.52, 0.58, 0.72) * (0.6 + 0.8 * uP0.w); }
vec3 skyAmb() { return vec3(1.1, 1.2, 1.5); }

// ---- 地块（屋/楼阁/塔）----
bool lotAt(vec2 ci, out vec2 c, out vec4 inf) {
  vec2 h1 = hash22(ci * 1.31 + 11.0), h2 = hash22(ci * 0.77 + 5.0);
  c = (ci + 0.5 + (h1 - 0.5) * 0.2) * LOT;
  inf = vec4(0.0, h2.x, 0.0, 0.0);
  if (h2.y > 0.80 || c.x < -40.0 || c.x > 940.0) return false;
  if (aBank(c) < 48.0) return false;
  vec3 br = bridgeInfo(c.y);
  if (br.y > 0.5 && abs(br.x) < 100.0) return false;
  float r = hash21(ci + 71.0);
  float type = r < 0.07 ? 2.0 : (r < 0.30 ? 1.0 : 0.0);
  float yaw = h1.y;   // 沿河向的偏航在 place() 里再算
  float sc = type > 1.5 ? 118.0 : (type > 0.5 ? 88.0 : 76.0 + 14.0 * h2.x);
  inf = vec4(type, h2.x, yaw, sc);
  return true;
}
// 地块暖光晕与地面暗影
void lotEval(vec3 p, out vec3 glow, out float ao) {
  glow = vec3(0.0); ao = 0.0;
  vec2 cb = floor(p.xy / LOT - 0.5);
  float lp = litProb();
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 c; vec4 inf;
    if (!lotAt(cb + vec2(float(i), float(j)), c, inf)) continue;
    vec2 d = p.xy - c;
    float d2 = dot(d, d);
    float sg = inf.w * 0.55;
    ao += exp(-d2 / (2.0 * sg * sg * 0.8));
    if (inf.y > lp) continue;
    float fl = 0.9 + 0.1 * sin(uTime * 3.0 + inf.y * 40.0);
    float zz = (p.z - 26.0) / 48.0;
    glow += exp(-d2 / (2.0 * sg * sg) - zz * zz) * fl;
  }
  glow *= vec3(1.0, 0.64, 0.36) * 0.5;
}

// 水面上地块灯火的长倒影条纹：把水面点按倒影映射反推到岸上的对应点，再找亮着的地块
vec3 lotStreaks(vec3 p) {
  float aB = aBank(p.xy);
  if (aB > -3.0 || aB < -170.0) return vec3(0.0);
  float c = riverC(p.y), W = riverW(p.y);
  float sgn = p.x < c ? -1.0 : 1.0;
  float a = max((-aB - 3.0) / 0.55, 0.0);
  vec2 q = vec2(c + sgn * (W + a), p.y);
  vec2 cb = floor(q / LOT - 0.5);
  float lp = litProb(), acc = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 cc; vec4 inf;
    if (!lotAt(cb + vec2(float(i), float(j)), cc, inf) || inf.y > lp) continue;
    vec2 d = q - cc;
    float sg = inf.w * 0.5;
    acc += exp(-dot(d, d) / (2.0 * sg * sg));
  }
  float rip = 0.35 + 0.65 * smoothstep(0.2, 0.9, sin(p.y * 0.55 + uTime * 1.6 + vnoise(vec2(p.x * 0.05, p.y * 0.05)) * 6.0) * 0.5 + 0.5);
  return vec3(1.0, 0.64, 0.36) * acc * rip * exp(aB / 90.0) * 0.22;
}

// ---- 岸灯 ----
vec2 postPos(float k, float side) {
  float yc = (k + 0.5) * POSTD;
  return vec2(riverC(yc) + side * (riverW(yc) + 9.0), yc);
}
vec3 postGlow(vec3 p, float streak) {
  float a = aBank(p.xy);
  if (abs(a) > 64.0) return vec3(0.0);
  float side = p.x > riverC(p.y) ? 1.0 : -1.0;
  float k0 = floor(p.y / POSTD), lp = litProb();
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    float k = k0 + float(j);
    if (hash21(vec2(k, side)) > lp) continue;
    vec2 pc = postPos(k, side);
    vec3 br = bridgeInfo(pc.y);
    if (br.y > 0.5 && abs(br.x) < 50.0) continue;
    float fl = 0.88 + 0.12 * sin(uTime * 2.6 + k * 1.7);
    vec2 d = p.xy - pc;
    float zz = (p.z - 26.0) / 38.0;
    acc += vec3(exp(-dot(d, d) / (2.0 * 34.0 * 34.0) - zz * zz)) * fl;
    if (streak > 0.0) {
      vec2 e = p.xy - (pc + vec2(0.0, -22.0));
      float rip = 0.55 + 0.45 * sin(p.y * 0.8 + uTime * 2.2 + k * 3.0);
      acc += vec3(streak * exp(-e.x * e.x / (2.0 * 7.0 * 7.0) - e.y * e.y / (2.0 * 34.0 * 34.0)) * rip * fl);
    }
  }
  return acc * vec3(1.0, 0.62, 0.32) * 0.5;
}

// ---- 河灯 ----
bool lampAt(vec2 cell, out vec2 pos, out float rnd, out float k) {
  float sh = uTime * 14.0 * uP1.x / LAMPC;
  float n = floor(sh), fr = sh - n;
  vec2 id = vec2(cell.x, cell.y + n);
  vec2 h = hash22(id * 1.7 + 3.0), h3 = hash22(id + 31.7);
  rnd = h3.y;
  pos = vec2(cell.x, cell.y - fr) * LAMPC + (h - 0.5) * 44.0;
  pos.x += sin(uTime * 0.5 + h3.y * 30.0) * 5.0;
  float thr = 0.03 + 0.14 * uP0.z;
  k = clamp((thr - h3.x) / 0.02, 0.0, 1.0);
  if (k <= 0.0) return false;
  if (aBank(pos) > -36.0) return false;
  vec3 br = bridgeInfo(pos.y);
  if (br.y > 0.5 && abs(br.x) < 44.0) return false;
  return true;
}
vec3 lampGlow(vec3 p) {
  if (aBank(p.xy) > 14.0) return vec3(0.0);
  float sh = uTime * 14.0 * uP1.x / LAMPC;
  vec2 cb = floor(vec2(p.x / LAMPC, p.y / LAMPC + fract(sh)));
  vec3 acc = vec3(0.0);
  float zz = (p.z - 5.0) / 32.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 pos; float r, k;
    if (!lampAt(cb + vec2(float(i), float(j)), pos, r, k)) continue;
    vec2 d = p.xy - pos;
    float fl = 0.88 + 0.12 * sin(uTime * 4.0 + r * 40.0);
    acc += vec3(k * fl * exp(-dot(d, d) / (2.0 * 22.0 * 22.0) - zz * zz));
  }
  return acc * vec3(1.0, 0.66, 0.38) * 0.32;
}

vec3 warmLight(vec3 p) {
  vec3 g; float ao;
  float a = aBank(p.xy);
  vec3 w = vec3(0.0);
  if (a > -80.0) { lotEval(p, g, ao); w += g + postGlow(p, 0.0); }
  if (a < 14.0) w += lampGlow(p);
  return w;
}

vec3 shadeTerrain(vec3 p, vec3 n, float sunLit, vec3 dyn, out float mat) {
  mat = 0.0;
  float t = uTime, rain = uP0.x, moon = uP0.w, flow = uP1.x;
  float aB = aBank(p.xy);
  vec3 br = bridgeInfo(p.y);
  float bm = bridgeMask(p.xy);
  vec3 mc = sunCol() * sunLit + vec3(0.30, 0.33, 0.40) * (0.4 + 0.6 * n.z);

  if (p.z < 1.5 && aB < 0.5) {
    // ---------- 水面 ----------
    float vel = 18.0 * flow;
    vec2 wp = vec2(p.x, p.y + t * vel);
    float u = (p.x - riverC(p.y)) / riverW(p.y);
    float wn = fbm(wp * vec2(0.012, 0.03) + vec2(0.0, 2.0), 2);
    vec3 col = mix(hexc(0x111a24), hexc(0x07090d), smoothstep(0.0, 1.0, abs(u)) * 0.8 + 0.1 * wn);
    float rip = sin(wp.y * 0.55 + wn * 14.0 + sin(wp.x * 0.05) * 2.0);
    float ripl = smoothstep(0.85, 1.0, rip) * (0.4 + 0.6 * vnoise(wp * vec2(0.03, 0.08)));
    col += hexc(0x56657a) * ripl * 0.07;
    float sp = vnoise(vec2(wp.x * 0.09, wp.y * 0.35 + t * 0.6)) * vnoise(vec2(wp.x * 0.23 + 4.0, wp.y * 0.12 - t * 0.4));
    float sheen = smoothstep(0.30, 0.55, sp) * (1.0 - smoothstep(0.1, 1.0, abs(u + 0.25))) * moon;
    col += hexc(0xa9b4c4) * sheen * 0.09;
    col *= 1.0 - 0.5 * smoothstep(-36.0, 0.0, aB);
    col += hexc(0x6f92b6) * (1.0 - smoothstep(0.0, 3.0, abs(aB + 2.0))) * 0.05;
    col *= 1.0 - 0.5 * br.y * (1.0 - smoothstep(30.0, 48.0, abs(br.x)));
    // 灯火在水面上的碎光
    vec3 g; float ao;
    vec3 warm = vec3(0.0);
    if (aB > -80.0) { lotEval(vec3(p.xy, 0.0), g, ao); warm += g + postGlow(vec3(p.xy, 0.0), 1.0); }
    warm += lampGlow(vec3(p.xy, 0.0));
    col += lotStreaks(vec3(p.xy, 0.0));
    col += warm * (0.10 + 0.55 * ripl * vnoise(wp * vec2(0.1, 0.3)) + 0.3 * sheen);
    // 雨圈
    if (rain > 0.02) {
      vec2 rc = vec2(34.0);
      vec2 ri = floor(p.xy / rc);
      for (int j = 0; j <= 1; j++) for (int i = 0; i <= 1; i++) {
        vec2 ci = ri + vec2(float(i) - 0.5, float(j) - 0.5) + 0.5 - 0.5;
        vec2 h2 = hash22(ci * 1.3 + 5.0);
        float ph = fract(t * (0.6 + 0.4 * h2.x) + h2.y * 7.0);
        if (h2.x > rain * 0.9) continue;
        vec2 c = (ci + 0.5 + (h2 - 0.5) * 0.7) * rc;
        float dd = abs(length(p.xy - c) - ph * 14.0);
        col += hexc(0x8fb4d8) * (1.0 - smoothstep(0.0, 1.4, dd)) * (1.0 - ph) * 0.05;
      }
    }
    col += dyn * hexc(0x304860) * 3.0;
    mat = 1.0;
    return col;
  }

  vec3 alb;
  vec3 g; float ao;
  vec3 warm = vec3(0.0);
  lotEval(p, g, ao);
  warm += g + postGlow(p, 0.0);
  if (bm > 0.5 && p.z > 12.0) {
    // ---------- 拱桥 ----------
    float dxn = (p.x - riverC(p.y)) / (riverW(p.y) + 30.0);
    if (n.z > 0.6) {
      alb = mix(hexc(0x3a2f2a), hexc(0x52443a), vnoise(p.xy * 0.3)) * (0.75 + 0.25 * step(0.15, fract(p.x / 9.0)));
      if (abs(br.x) > 24.0) alb = hexc(0x3c4254) * (0.8 + 0.2 * step(0.5, fract(p.x / 12.0)));
    } else {
      alb = hexc(0x2c3444) * (0.8 + 0.2 * step(0.5, fract(p.z / 5.0)));
      float q = fract(dxn * 1.5 + 0.5) - 0.5;
      float archH = 15.0 * sqrt(max(0.0, 1.0 - q * q * 5.76));
      alb *= 1.0 - 0.85 * step(p.z, archH) * step(abs(dxn), 0.95);
    }
    mat = 5.0;
  } else {
    // ---------- 岸上 ----------
    float n1 = fbm(p.xy * 0.02, 3);
    alb = mix(hexc(0x0e1115), hexc(0x1b1f28), n1);
    float slab = step(0.07, fract(p.x / 13.0)) * step(0.07, fract(p.y / 13.0));
    alb *= 0.8 + 0.2 * slab;
    alb = mix(alb, hexc(0x3a3d46), (1.0 - smoothstep(10.0, 14.0, aB)) * 0.7);
    if (n.z < 0.7 && p.z < 19.0) {
      alb = hexc(0x30333c) * (0.7 + 0.3 * step(0.5, fract(p.z / 4.0)));
      alb *= mix(0.4, 1.0, smoothstep(0.0, 10.0, p.z));
    }
    alb *= 1.0 - 0.55 * ao;
  }
  vec3 col = alb * (mc * 1.5 + warm * 1.8 + dyn * 2.0);
  return col;
}

// ---- 雾：河面薄雾，被灯火照亮 ----
float fogDensity(vec3 p) {
  float a = aBank(p.xy);
  float over = (1.0 - smoothstep(-30.0, 20.0, a));
  float top = (1.0 - smoothstep(6.0, 120.0, p.z));
  // 薄雾保留两级噪声倍频，减少每条视线 24 次采样中的细碎纹理计算。
  float n = fbm(vec2(p.x * 0.006 + uTime * 0.012, p.y * 0.005 + p.z * 0.004), 2);
  float d = top * (0.3 + 1.4 * smoothstep(0.25, 0.75, n)) * (0.0016 + 0.0050 * over) * (0.3 + 1.4 * uP0.w);
  gWarm = (d > 1e-5 && p.z < 70.0) ? warmLight(p) : vec3(0.0);
  return d;
}
vec3 fogGlow(vec3 p) { return gWarm * 0.45; }

// ---- 模型着色（屋、灯笼、岸灯、河灯共用；aux 分段：<1 墙，1..2 瓦，2..3 灯笼，3 木，4+ 莲花灯瓣）----
vec3 shadeModel(vec3 wp, vec3 n, float aux, float rnd, float sunLit, vec3 dyn) {
  vec3 mc = sunCol() * sunLit + vec3(0.30, 0.33, 0.40) * (0.4 + 0.6 * n.z);
  if (aux >= 2.0 && aux < 3.0) {
    float on = step(rnd, litProb());
    float fl = 0.9 + 0.1 * sin(uTime * 3.0 + wp.x * 0.7 + wp.y * 0.3);
    vec3 e = vec3(1.0, 0.64, 0.32) * (0.30 + 0.18 * (aux - 2.0)) * fl;
    return mix(vec3(0.04, 0.02, 0.02) * (mc + dyn), e, on) + dyn * 0.05;
  }
  if (aux >= 4.0) {
    float f = aux - 4.0;
    vec3 alb = mix(vec3(0.20, 0.08, 0.06), vec3(0.75, 0.40, 0.28), f);
    float fl = 0.9 + 0.1 * sin(uTime * 4.0 + wp.x * 0.5);
    return alb * (mc * 0.8 + dyn * 2.0) + vec3(1.0, 0.55, 0.28) * 0.12 * fl * (1.0 - f * 0.6);
  }
  // 模型由自身檐灯提供柔和填充；rnd 与该实例灯笼的点亮判定一致。
  // 岸面、水面与体积雾仍计算周边灯火的空间溢光，倒影复用这一份模型着色。
  float zz = (wp.z - 26.0) / 48.0;
  float fl = 0.9 + 0.1 * sin(uTime * 3.0 + rnd * 40.0);
  vec3 warm = vec3(1.0, 0.62, 0.32) * (0.35 * step(rnd, litProb()) * exp(-zz * zz) * fl);
  vec3 alb;
  vec3 extra = vec3(0.0);
  if (aux >= 3.0) {
    alb = hexc(0x1a1214);
  } else if (aux >= 1.0) {
    float t = aux - 1.0;
    float rows = fract(t * 10.0);
    float tile = smoothstep(0.0, 0.3, rows) * (1.0 - smoothstep(0.7, 1.0, rows));
    alb = mix(hexc(0x101319), hexc(0x252b37), t) * (0.5 + 0.6 * tile) * (0.8 + 0.4 * fract(rnd * 53.7));
    float rd = smoothstep(0.90, 0.99, t);
    extra += vec3(0.04, 0.045, 0.055) * rd;
    // 蚀：霓虹沿脊线与檐口
    float corr = uP0.y;
    if (corr > 0.01) {
      float pick = step(fract(rnd * 97.31), corr * 0.85);
      float dash = step(0.3, vnoise(vec2(wp.x + wp.y, rnd * 50.0) * 0.12));
      vec3 neon = mix(hexc(0x3ff4ff), hexc(0xff3fbf), step(0.5, fract(rnd * 7.0)));
      float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + rnd * 20.0);
      extra += neon * (rd + 0.6 * (1.0 - smoothstep(0.0, 0.06, t))) * dash * pick * pulse * 0.45;
    }
  } else {
    alb = mix(hexc(0x1d1719), hexc(0x26242b), aux);
    // 亮着的窗格：沿墙分格，暖色低饱和
    vec2 tg = vec2(-n.y, n.x);
    float u = dot(wp.xy, tg) / 10.0;
    float cid = floor(u), fu = fract(u);
    float win = step(0.2, fu) * step(fu, 0.8) * step(0.26, aux) * step(aux, 0.80) * step(abs(n.z), 0.5)
              * step(hash21(vec2(cid, floor(rnd * 100.0))), litProb());
    float bars = 1.0 - 0.45 * (step(fract(u * 3.0), 0.12) + step(fract(aux * 6.0), 0.12));
    extra += vec3(1.0, 0.66, 0.36) * 0.36 * win * bars * (0.9 + 0.1 * sin(uTime * 2.0 + cid));
  }
  return alb * (mc * 1.5 + warm * 2.4 + dyn * 2.0) + extra;
}

// 倒影：越高越淡，被水波打碎；灯笼倒影更实
vec4 shadeReflect(vec3 col, vec2 wpt, vec3 wp) {
  float k = exp(-max(wp.z - 14.0, 0.0) / 110.0) * smoothstep(-130.0, -4.0, aBank(wpt));
  float rip = smoothstep(0.15, 0.7, vnoise(vec2(wpt.x * 0.05, wpt.y * 0.28 + uTime * 0.8)));
  float a = clamp(0.7 * k * (0.35 + 0.65 * rip), 0.0, 0.8);
  return vec4(col * vec3(0.6, 0.7, 0.9), a);
}
`;

// ─────────────────────────────────────────────────────────────── 程序化网格

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

class Mesh {
  a: number[] = [];
  vert(p: V3, n: V3, aux: number): void { this.a.push(p[0], p[1], p[2], n[0], n[1], n[2], aux); }
  /** 平面四边形，法线朝 out 一侧。 */
  quad(p0: V3, p1: V3, p2: V3, p3: V3, out: V3, aux: number | [number, number, number, number]): void {
    let n = norm(cross(sub(p1, p0), sub(p2, p0)));
    if (dot(n, out) < 0) n = [-n[0], -n[1], -n[2]];
    const ax = (i: number) => (typeof aux === 'number' ? aux : aux[i]);
    this.vert(p0, n, ax(0)); this.vert(p1, n, ax(1)); this.vert(p2, n, ax(2));
    this.vert(p0, n, ax(0)); this.vert(p2, n, ax(2)); this.vert(p3, n, ax(3));
  }
  /** 竖直四壁盒（无顶底），aux 从底 a0 渐变到顶 a1。 */
  walls(hx: number, hy: number, z0: number, z1: number, a0: number, a1: number): void {
    const c: [number, number][] = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = c[i], [x1, y1] = c[(i + 1) % 4];
      this.quad([x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1], [(y1 - y0), -(x1 - x0), 0], [a0, a0, a1, a1]);
    }
  }
  sphere(cx: number, cy: number, cz: number, rx: number, rz: number, a0: number, a1: number, seg = 8, rings = 5): void {
    const P = (i: number, j: number): [V3, V3, number] => {
      const th = (i / seg) * Math.PI * 2, ph = (j / rings) * Math.PI;
      const nx = Math.cos(th) * Math.sin(ph), ny = Math.sin(th) * Math.sin(ph), nz = Math.cos(ph);
      return [[cx + nx * rx, cy + ny * rx, cz + nz * rz], norm([nx / rx, ny / rx, nz / rz]), lerp(a1, a0, j / rings)];
    };
    for (let i = 0; i < seg; i++) for (let j = 0; j < rings; j++) {
      const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1);
      for (const q of [A, B, C, A, C, D]) this.vert(q[0], q[1], q[2]);
    }
  }
  cone(cx: number, cy: number, z0: number, z1: number, r: number, aux: number, seg = 6): void {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const l = Math.hypot(z1 - z0, r);
      const n = (a: number): V3 => [Math.cos(a) * (z1 - z0) / l, Math.sin(a) * (z1 - z0) / l, r / l];
      this.vert([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z0], n(a0), aux);
      this.vert([cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z0], n(a1), aux);
      this.vert([cx, cy, z1], n(am), aux);
    }
  }
  f32(): Float32Array { return new Float32Array(this.a); }
}

/** 庑殿顶（飞檐起翘 + 凹曲屋面）。t=0 檐口，t=1 屋脊；tmax<1 时顶部截平（供上层楼身落脚）。aux = 1 + 0.98·t。 */
function roof(m: Mesh, Lx: number, Ly: number, z0: number, H: number, U: number, tmax: number): number {
  const R = Lx - Ly;
  const faces = [
    { e0: [-Lx, -Ly], e1: [Lx, -Ly], r0: [-R, 0], r1: [R, 0], ns: 12 },
    { e0: [Lx, Ly], e1: [-Lx, Ly], r0: [R, 0], r1: [-R, 0], ns: 12 },
    { e0: [Lx, -Ly], e1: [Lx, Ly], r0: [R, 0], r1: [R, 0], ns: 6 },
    { e0: [-Lx, Ly], e1: [-Lx, -Ly], r0: [-R, 0], r1: [-R, 0], ns: 6 },
  ];
  const NT = 6;
  const zAt = (t: number, cf: number): number => z0 + H * Math.pow(t, 1.7) + U * cf;
  for (const f of faces) {
    const pts: V3[] = [];
    for (let i = 0; i <= f.ns; i++) for (let j = 0; j <= NT; j++) {
      const s = i / f.ns, t = (tmax * j) / NT;
      const ex = lerp(f.e0[0], f.e1[0], s), ey = lerp(f.e0[1], f.e1[1], s);
      const rx = lerp(f.r0[0], f.r1[0], s), ry = lerp(f.r0[1], f.r1[1], s);
      const cf = smooth(0.6, 1, Math.abs(2 * s - 1)) * Math.pow(1 - t, 2);
      const fl = 0.06 * cf;
      pts.push([lerp(ex, rx, t) + (ex / Lx) * Lx * fl, lerp(ey, ry, t) + (ey / Ly) * Ly * fl, zAt(t, cf)]);
    }
    const at = (i: number, j: number): V3 => pts[Math.min(f.ns, Math.max(0, i)) * (NT + 1) + Math.min(NT, Math.max(0, j))];
    const nrm = (i: number, j: number): V3 => {
      let n = norm(cross(sub(at(i + 1, j), at(i - 1, j)), sub(at(i, j + 1), at(i, j - 1))));
      if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
      return n;
    };
    for (let i = 0; i < f.ns; i++) for (let j = 0; j < NT; j++) {
      const q: [number, number][] = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i, j + 1]];
      for (const [a, b] of q) m.vert(at(a, b), nrm(a, b), 1 + (0.98 * tmax * b) / NT);
    }
    // 檐口立面（暗色木）
    for (let i = 0; i < f.ns; i++) {
      const p0 = at(i, 0), p1 = at(i + 1, 0);
      const d = 0.03;
      const out: V3 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0];
      m.quad(p0, p1, [p1[0], p1[1], p1[2] - d], [p0[0], p0[1], p0[2] - d], out, 3);
    }
  }
  const zt = zAt(tmax, 0);
  if (tmax < 1) {
    const hx = Lx - tmax * Ly, hy = Ly * (1 - tmax);
    m.quad([-hx, -hy, zt], [hx, -hy, zt], [hx, hy, zt], [-hx, hy, zt], [0, 0, 1], 1 + 0.98 * tmax);
  }
  return zt;
}

interface Tier { Lx: number; Ly: number; hx: number; hy: number; bh: number; H: number; U: number; tmax: number }

function building(tiers: Tier[], finial: boolean, lanternTiers: number): Float32Array {
  const m = new Mesh();
  const t0 = tiers[0];
  m.walls(t0.hx + 0.03, t0.hy + 0.03, 0, 0.03, 0.1, 0.2);   // 台基
  let z = 0.03;
  tiers.forEach((t, k) => {
    m.walls(t.hx, t.hy, z, z + t.bh, 0.0, 0.9);
    m.walls(t.hx + 0.008, t.hy + 0.008, z + t.bh - 0.035, z + t.bh, 3, 3);   // 额枋
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {   // 檐柱
      const cx = sx * t.hx, cy = sy * t.hy, w = 0.018;
      m.walls(w, w, z, z + t.bh, 3, 3);
      // 平移到角上：walls 以原点为中心，这里手动平移
      const n = m.a.length;
      for (let i = n - 4 * 6 * 7; i < n; i += 7) { m.a[i] += cx; m.a[i + 1] += cy; }
    }
    const ze = z + t.bh;
    const top = roof(m, t.Lx, t.Ly, ze, t.H, t.U, t.tmax);
    if (k < lanternTiers) {
      const n = Math.max(2, Math.round(t.Lx / 0.12));
      for (const sy of [-1, 1]) for (let i = 0; i <= n; i++) {
        const x = -t.Lx * 0.92 + (1.84 * t.Lx * i) / n;
        m.sphere(x, sy * t.Ly * 0.97, ze + t.U * smooth(0.6, 1, Math.abs(x) / t.Lx) - 0.06, 0.032, 0.042, 2.0, 2.9);
      }
    }
    z = top;
  });
  if (finial) {
    m.cone(0, 0, z, z + 0.32, 0.018, 3);
    m.sphere(0, 0, z + 0.1, 0.045, 0.05, 3, 3);
    m.sphere(0, 0, z + 0.2, 0.035, 0.04, 3, 3);
  }
  return m.f32();
}

const HOUSE = building([{ Lx: 0.52, Ly: 0.38, hx: 0.40, hy: 0.27, bh: 0.36, H: 0.26, U: 0.07, tmax: 1 }], false, 1);
const TOWER = building([
  { Lx: 0.52, Ly: 0.38, hx: 0.40, hy: 0.27, bh: 0.32, H: 0.20, U: 0.07, tmax: 0.5 },
  { Lx: 0.38, Ly: 0.28, hx: 0.27, hy: 0.19, bh: 0.26, H: 0.17, U: 0.06, tmax: 0.5 },
  { Lx: 0.27, Ly: 0.20, hx: 0.19, hy: 0.13, bh: 0.22, H: 0.16, U: 0.055, tmax: 1 },
], false, 2);
const PAGODA = building([0, 1, 2, 3, 4].map((i): Tier => {
  const f = Math.pow(0.84, i);
  return { Lx: 0.30 * f, Ly: 0.30 * f, hx: 0.125 * f, hy: 0.125 * f, bh: 0.20, H: 0.12 * f + 0.02, U: 0.045 * f, tmax: i === 4 ? 1 : 0.55 };
}), true, 5);

/** 河灯：莲花瓣 + 中心火苗。局部半径 ≈0.5。 */
function lotusMesh(): Float32Array {
  const m = new Mesh();
  const petal = (ang: number, r0: number, rm: number, rt: number, z0: number, zm: number, zt: number, wm: number) => {
    const P = (r: number, a: number, z: number): V3 => [Math.cos(a) * r, Math.sin(a) * r, z];
    const b0 = P(r0, ang - 0.15, z0), b1 = P(r0, ang + 0.15, z0);
    const m0 = P(rm, ang - wm, zm), m1 = P(rm, ang + wm, zm), tip = P(rt, ang, zt);
    m.quad(b0, b1, m1, m0, [0, 0, 1], [4.0, 4.0, 4.5, 4.5]);
    const n = norm(cross(sub(m1, m0), sub(tip, m0)));
    const s = n[2] < 0 ? -1 : 1;
    for (const [p, a] of [[m0, 4.5], [m1, 4.5], [tip, 4.98]] as [V3, number][]) m.vert(p, [n[0] * s, n[1] * s, n[2] * s], a);
  };
  for (let i = 0; i < 8; i++) petal((i / 8) * Math.PI * 2, 0.1, 0.32, 0.5, 0.03, 0.08, 0.11, 0.28);
  for (let i = 0; i < 8; i++) petal(((i + 0.5) / 8) * Math.PI * 2, 0.08, 0.22, 0.30, 0.08, 0.15, 0.27, 0.24);
  m.sphere(0, 0, 0.2, 0.12, 0.15, 2.2, 2.9);
  return m.f32();
}

/** 岸灯：细杆 + 灯笼 + 顶帽。高度 1。 */
function postMesh(): Float32Array {
  const m = new Mesh();
  m.walls(0.03, 0.03, 0, 0.74, 3, 3);
  m.walls(0.06, 0.06, 0, 0.05, 3, 3);
  m.sphere(0, 0, 0.86, 0.11, 0.15, 2.0, 2.9);
  m.cone(0, 0, 1.0, 1.14, 0.12, 3);
  return m.f32();
}

// ─────────────────────────────────────────────────────────────── 放置

const lotPlace = (type: number): string => `
bool place(vec2 c, out vec3 pos, out float sc, out float yaw, out float rnd) {
  vec2 ctr; vec4 inf;
  pos = vec3(c, 0.0); sc = 0.0; yaw = 0.0; rnd = 0.0;
  if (!lotAt(c / LOT, ctr, inf) || abs(inf.x - ${type}.0) > 0.5) return false;
  pos = vec3(ctr, groundH(ctr) - 0.5);
  float dc = (riverC(ctr.y + 4.0) - riverC(ctr.y - 4.0)) / 8.0;
  yaw = atan(1.0, dc);
  if (inf.x < 0.5 && inf.z > 0.62) yaw += 1.5708;
  sc = inf.w; rnd = inf.y;
  return true;
}`;

const LAMP_PLACE = `
bool place(vec2 c, out vec3 pos, out float sc, out float yaw, out float rnd) {
  vec2 p2; float r, k;
  pos = vec3(c, 0.0); sc = 0.0; yaw = 0.0; rnd = 0.0;
  if (!lampAt(c / LAMPC, p2, r, k)) return false;
  pos = vec3(p2, 0.6);
  sc = (14.0 + 5.0 * r) * k;
  yaw = uTime * 0.2 + r * 6.28;
  return true;
}`;

const POST_PLACE = `
bool place(vec2 c, out vec3 pos, out float sc, out float yaw, out float rnd) {
  float side = c.x < -100.0 ? -1.0 : 1.0;   // 两列格点：左岸 / 右岸
  float k = floor(c.y / POSTD);
  pos = vec3(c, 0.0); sc = 0.0; yaw = 0.0;
  rnd = hash21(vec2(k, side));
  vec2 pp = postPos(k, side);
  vec3 br = bridgeInfo(pp.y);
  if (br.y > 0.5 && abs(br.x) < 50.0) return false;
  pos = vec3(pp, groundH(pp) - 0.5);
  sc = 30.0;
  return true;
}`;

const SCENE: Bg3D = {
  glsl: GLSL,
  fogTop: 90,
  camS: 2400,
  models: [
    { mesh: HOUSE, cell: LOT, cols: 11, rows: 16, place: lotPlace(0), shade: '', reflect: true },
    { mesh: TOWER, cell: LOT, cols: 11, rows: 16, place: lotPlace(1), shade: '', reflect: true },
    { mesh: PAGODA, cell: LOT, cols: 11, rows: 16, place: lotPlace(2), shade: '', reflect: true },
    { mesh: postMesh(), cell: POST, cols: 2, rows: 28, place: POST_PLACE, shade: '', reflect: true },
    { mesh: lotusMesh(), cell: LAMPC, cols: 17, rows: 25, place: LAMP_PLACE, shade: '' },
  ],
};

export const BG_STAGE2: BgDef = {
  id: 'stage2',
  tint: 0x2a4a7a,
  params: { p0: [0.25, 0, 0.6, 0.5], p1: [1, 0, 0, 0] },
  scene3d: SCENE,
  fg: `
float rainL(vec2 b, float scale, float speed, float dens, float seed, float len) {
  vec2 q = vec2(b.x + b.y * 0.22, b.y) * scale;
  float c = floor(q.x);
  float h = hash21(vec2(c, seed));
  float h2 = hash21(vec2(c, seed + 13.0));
  float y = q.y * 0.03 / len + uTime * speed * (0.8 + 0.4 * h2) + h * 20.0;
  float f = fract(y);
  float lineX = abs(fract(q.x) - 0.5);
  float w = 0.06;
  float on = step(1.0 - dens, hash21(vec2(c, floor(y) + seed)));
  return on * (1.0 - smoothstep(0.0, w, lineX)) * smoothstep(0.0, 0.5, f) * (1.0 - smoothstep(0.5, 1.0, f));
}
void main() {
  vec2 b = vec2(vUv.x * PLAY_W, vUv.y * PLAY_H);
  float r = uP0.x;
  if (r < 0.01) { fragColor = vec4(0.0); return; }
  float a = rainL(b, 0.12, 1.7, 0.30 * r, 1.0, 1.0) * 0.5 + rainL(b, 0.07, 2.4, 0.35 * r, 2.0, 1.4) * 0.6;
  a = a * 0.32;
  fragColor = vec4(hexc(0xb8d0ea) * a, a);
}`,
};
