import { BG_LIB } from './lib';

/**
 * 边框：游戏区两侧装饰面板（uPlay 为游戏区矩形，像素）。
 * 深色墨漆底 + 宣纸纤维、缓慢上升的墨雾（带关卡主题色 uTint）、靠游戏区一侧的双层金线、
 * 金线外一条暗金「回」纹带；金线随 uBeat 轻微脉动；整体亮度很低，便于 HUD 文字叠放。
 */
export const FRAME_FRAG = BG_LIB + `
void main() {
  vec2 px = vUv * uRes;
  float u = uPlay.w / 900.0;                 // 像素 / 逻辑单位
  vec2 lp = px / u;                          // 逻辑坐标（纹理不随窗口尺寸变粗细）
  float xl = uPlay.x, xr = uPlay.x + uPlay.w;
  float dEdge = px.x < xl ? xl - px.x : px.x - xr;   // 到游戏区边缘的外向距离（像素）
  float du = dEdge / u;                              // 逻辑单位
  float panelW = max(xl, 1.0);
  float s = clamp(dEdge / panelW, 0.0, 1.0);         // 0 靠近游戏区，1 靠近画布边缘

  // 墨漆底
  vec3 col = mix(hexc(0x100e10), hexc(0x070607), smoothstep(0.0, 1.0, s));
  float fib = vnoise(lp * vec2(0.8, 0.05)) * 0.6 + vnoise(lp * vec2(2.4, 0.12)) * 0.4;
  col *= 0.75 + 0.5 * fib;
  col += vec3(0.012) * vnoise(lp * 1.9);

  // 墨雾（缓慢上升）
  float m1 = fbm(vec2(lp.x * 0.0045, lp.y * 0.0030 - uTime * 0.025) + 4.0, 4);
  float m2 = fbm(vec2(lp.x * 0.0090 + 9.0, lp.y * 0.0055 - uTime * 0.045), 3);
  float mist = smoothstep(0.42, 0.85, m1) * (0.5 + 0.5 * m2);
  col += (uTint * 0.9 + vec3(0.012, 0.011, 0.010)) * mist * 0.30 * (1.0 - 0.5 * s);
  col += hexc(0xd8c8a8) * smoothstep(0.55, 0.9, m1 * m2 * 1.6) * 0.035;

  // 回纹带（暗金）
  float band = smoothstep(14.0, 18.0, du) * smoothstep(46.0, 42.0, du);
  vec2 c = vec2((fract(lp.y / 26.0) - 0.5) * 2.0, (du - 30.0) / 13.0);
  float cheb = max(abs(c.x), abs(c.y));
  float lines = smoothstep(0.10, 0.02, abs(cheb - 0.86)) + smoothstep(0.10, 0.02, abs(cheb - 0.52)) + smoothstep(0.12, 0.02, abs(cheb - 0.16));
  vec3 gold = hexc(0xc9a24a);
  col += gold * lines * band * 0.055 * (0.7 + 0.6 * fib);
  col *= 1.0 - band * 0.25 * step(0.9, cheb) ;

  // 金线（双层）+ 外晕，拍点脉动
  float pulse = 1.0 + 0.35 * pow(1.0 - uBeat, 3.0);
  float w1 = 1.6 * u, w2 = 0.9 * u;
  float g1 = smoothstep(w1, w1 * 0.4, abs(dEdge - 4.0 * u));
  float g2 = smoothstep(w2, w2 * 0.4, abs(dEdge - 10.0 * u));
  float gl = exp(-max(dEdge - 4.0 * u, 0.0) / (16.0 * u)) * 0.5;
  float inside = step(xl, px.x) * step(px.x, xr);
  vec3 goldL = hexc(0xe0b95a) * (0.55 + 0.45 * vnoise(vec2(lp.y * 0.08, 3.0)));
  col += (goldL * g1 * 0.55 + gold * g2 * 0.22 + gold * gl * 0.05) * pulse * (1.0 - inside);
  // 游戏区内侧留一点暗色，避免露底时突兀
  col = mix(col, vec3(0.004), inside);
  fragColor = vec4(col, 1.0);
}`;
