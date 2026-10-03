import type { BgDef } from './header';
import { BG_LIB } from './lib';
import { SKY_WEATHER, SKY_RAYS } from './weather';

// 高空云海：右上暖金、背光处青蓝、远处蓝雾。三层云按各自滚速视差漂移，
// 中间一条云河（流向沿卷轴方向，带流动纹理）；中路对比压低，鲜艳与厚云放两侧。
export const BG_STAGE1: BgDef = {
  id: 'stage1', scale: .65, tint: 0xb9a888,
  params: { p0: [0, .5, .35, 0], p1: [1, 1, 0, 0] },
  frag: BG_LIB + `
const vec2 SUN = vec2(.62, .78);   // 朝向太阳（右上），y 向上
void main() {
  vec2 base = vUv * vec2(PLAY_W, PLAY_H);
  float xn = (base.x - 450.0) / 450.0;
  float side = smoothstep(.15, .85, abs(xn));       // 中路 0，两侧 1
  float calm = mix(.45, 1.0, side);                  // 中路明暗反差系数
  float sunk = smoothstep(.3, 1.0, (xn * .5 + .5) * .6 + vUv.y * .6);  // 右上暖光权重

  // 云河：中心线随世界纵向蜿蜒，流纹沿河向拉长并向下游缓流。
  float ry = base.y + uScroll * .22;
  float xc = 450.0 + sin(ry * .0042) * 95.0 + sin(ry * .0017 + 1.3) * 70.0;
  float wr = 125.0 + 35.0 * sin(ry * .0029 + .7);
  float d = (base.x - xc) / wr;
  float river = exp(-d * d * 1.5);
  float fy = ry + uTime * 20.0;
  // 宽缓的云雾沿航路流动，避免高频山脊白纹形成大理石状硬边。
  vec2 fq = vec2(d * .65, fy * .0025);
  float streak = smoothstep(.20, .78, fbm(fq + vec2(uTime * .015, 3.0), 3));

  vec3 col = mix(hexc(0xb3c6e0), hexc(0xdde6f1), fbm(base * .0022 + vec2(0., uScroll * .0002), 3));
  vec3 lit = hexc(0xfff7ea);
  vec3 gold = hexc(0xffcf7a);
  vec3 ink = hexc(0x5a7396);

  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float speed = .07 + fl * .115;
    float sc = .0050 - fl * .0008;
    vec2 p = base + vec2(uTime * (4.0 + fl * 7.0), uScroll * speed);
    vec2 w = vec2(fbm(p * .0021 + fl * 9.0, 3), fbm(p * .0021 + fl * 9.0 + 5.3, 3)) - .5;
    vec2 pp = (p + w * 190.0) * sc;
    vec3 h = fbmd(pp, 3);                       // 低阶高度场给大块明暗
    h.x += (fbm(pp * 2.6 + 7.7, 3) - .5) * .14;               // 高阶只加边缘碎形，不进光照
    float thr = .36 + fl * .06;
    float cover = smoothstep(thr, thr + .16, h.x);
    cover *= 1.0 - river * (l > 0 ? .85 : .6);
    if (l == 1) cover *= mix(.55, 1.0, side);
    if (l == 2) cover *= mix(.30, 1.0, side);
    // 云顶受光：高度场沿太阳方向的斜率。
    float shade = clamp(dot(h.yz, SUN) * 3.0, -1.0, 1.0) * calm;
    vec3 shadow = mix(hexc(0x9db4d8), hexc(0xb9c9e3), fl * .4);
    vec3 pc = mix(shadow, lit, sat1(.62 + .6 * shade));
    pc += gold * (sunk * .85 * sat1(shade * 1.4 + .3));
    pc = mix(pc, hexc(0xb4c6e0), (2.0 - fl) * .14);   // 远层偏蓝雾
    col = mix(col, pc, cover * (.75 + fl * .08));
    float rim = exp(-abs(h.x - thr - .05) * 38.0);
    col = absorb(col, ink, rim * .09 * calm);          // 湿墨晕边，保留水墨底子
    if (l == 0) {
      // 云河铺在远层之上、中近层之下
      vec3 bed = mix(hexc(0x93abd2), hexc(0xbccde6), .5 + .5 * sin(fy * .004));
      col = mix(col, bed, river * .35);
      col = mix(col, mix(hexc(0xffffff), gold, sunk * .35), streak * river * .18);
    }
  }
  col = mix(col, col * vec3(1.05, 1.0, .92), sunk * .4);
  col *= .93;
  col *= mix(1.0, paperCol(base, vec3(1.0)).x, .55);
  // 两侧提饱和，中路保持柔和
  float lum = dot(col, vec3(.2126, .7152, .0722));
  col = mix(vec3(lum), col, 1.0 + .15 * side);
  // uP2.x：两秒俯冲；云下亮度柔和过渡，保留云海明部。
  col = mix(col, mix(col, hexc(0xd8e0e5), .22) * 1.08, uP2.x);
  fragColor = vec4(col, 1.0);
}
`,
  fg: SKY_WEATHER + SKY_RAYS + `
void main() {
  vec2 base = vUv * vec2(PLAY_W, PLAY_H);
  vec4 wx = skyWeather(base, hexc(0xe4ebf3), hexc(0x3a4c66), 0.0, 0.0);
  vec4 rays = skyRays(base);
  vec4 layer = vec4(wx.rgb * (1.0 - rays.a) + rays.rgb, wx.a + rays.a * (1.0 - wx.a));
  float dive = uP2.x;
  if (dive > 0.0 && dive < 1.0) {
    // 中央云团沿两侧掀开，露出下方崖台；战斗对象保持在云层之上。
    float edge = abs(base.x - 450.0) - dive * 660.0;
    float billow = fbm(vec2(abs(base.x - 450.0) - dive * 700.0, base.y + dive * 520.0) * .008, 3);
    float cover = smoothstep(-150.0, 30.0, edge + billow * 170.0);
    cover *= smoothstep(0.0, .13, dive) * (1.0 - smoothstep(.8, 1.0, dive));
    vec3 cloud = mix(hexc(0xb3c9df), hexc(0xfff8e9), billow);
    layer = vec4(mix(layer.rgb, cloud, cover), layer.a + cover * (1.0-layer.a));
  }
  fragColor = layer;
}
`,
};
