// 背景着色器契约。背景/前景/边框着色器的正文拼接在对应 HEADER 之后。

/** 通用 GLSL 工具（所有背景着色器可用）。 */
export const GLSL_COMMON = `
#define PLAY_W 900.0
#define PLAY_H 1200.0
#define PI 3.14159265
// sRGB 颜色（如设计稿里的十六进制）转线性空间。着色器输出必须是线性 HDR。
vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
vec3 hexc(int h) { return srgb(vec3(float((h >> 16) & 255), float((h >> 8) & 255), float(h & 255)) / 255.0); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// Dave Hoskins "hash without sine"：纯浮点、跨驱动稳定。输入宜为格点坐标（|p| < 1e5）。返回 0..1。
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * vnoise(p); p = rot(0.5) * p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

/**
 * 背景 / 前景着色器头。
 * - 背景输出 fragColor.rgb = 线性 HDR 颜色（alpha 忽略）。
 * - 前景（可选）输出预乘 alpha 的 RGBA，叠在背景景物之上、所有战斗对象之下（云雾、雨丝等）。
 *
 * 世界坐标：p = vec2(vUv.x * PLAY_W, vUv.y * PLAY_H + uScroll * layerSpeed)，y 向上。
 * uScroll 随时间增加，画面内容向下移动（玩家向上飞）。
 * 「地面层」必须以 layerSpeed = 1.0 滚动：地面敌人（坦克、船）按 uScroll 1:1 随地面移动。
 * 远景 < 1.0，地面与玩家之间的云层 > 1.0。
 */
export const BG_HEADER = `#version 300 es
precision highp float;
uniform vec2 uRes;      // 渲染目标像素尺寸（游戏区，3:4）
uniform float uTime;    // 秒（游戏时间，子弹时间下变慢）
uniform float uScroll;  // 累计滚动距离（游戏区单位）
uniform vec4 uP0;       // 关卡脚本可调参数，语义由各背景自行定义并写在文件头注释里
uniform vec4 uP1;
uniform vec4 uP2;
uniform vec4 uP3;
uniform float uBeat;    // 音乐拍相位 0..1（拍点处为 0），可用于轻微脉动
uniform float uFlash;   // 闪光强度 0..1（雷电、炸弹等），由游戏驱动
in vec2 vUv;            // 0..1，(0,0) = 左下
out vec4 fragColor;
` + GLSL_COMMON;

/**
 * 边框（游戏区左右两侧装饰面板）着色器头。整张画布都会执行，游戏区内部会被游戏画面覆盖。
 * 输出线性 HDR。
 */
export const FRAME_HEADER = `#version 300 es
precision highp float;
uniform vec2 uRes;      // 整个画布像素尺寸
uniform vec4 uPlay;     // 游戏区矩形 (x, y, w, h)，像素，原点左下
uniform float uTime;
uniform float uBeat;
uniform vec3 uTint;     // 关卡主题色（线性），用于边框氛围
uniform float uFlash;
in vec2 vUv;
out vec4 fragColor;
` + GLSL_COMMON;

import type { Bg3D } from '../gl/scene3d';

export type Vec4 = [number, number, number, number];

export interface BgDef {
  id: string;
  /** 背景片元着色器正文（拼接在 BG_HEADER 之后，需定义 main）。有 scene3d 时可省略。 */
  frag?: string;
  /**
   * 3D 背景实现（见 src/gl/scene3d.ts 文件头）。有它时 Renderer 走 3D 路径，frag 被忽略；
   * fg（前景层）仍按 2D 着色器叠加。scale 对 3D 无效（分辨率跟随画质档）。
   */
  scene3d?: Bg3D;
  /** 可选前景层正文，输出预乘 alpha。 */
  fg?: string;
  /** 背景渲染分辨率相对游戏区目标的比例，默认 1。重型光线步进可设 0.5~0.75。 */
  scale?: number;
  /** uP0..uP3 默认值。 */
  params?: { p0?: Vec4; p1?: Vec4; p2?: Vec4; p3?: Vec4 };
  /** 边框主题色（sRGB 十六进制 0xRRGGBB）。 */
  tint?: number;
}
