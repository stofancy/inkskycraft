import type { BgDef } from './header';
import { BG_LIB } from './lib';
import { SKY_WEATHER } from './weather';

// 沿用 V1 的纸色、墨吸收与纸纤维。云层以湿墨晕染轮廓铺开，远近分别滚动。
export const BG_STAGE1: BgDef = {
  id: 'stage1', scale: .65, tint: 0xb9a888,
  params: { p0: [0, .5, .35, 0], p1: [1, 1, 0, 0] },
  frag: BG_LIB + `
void main() {
  vec2 base = vUv * vec2(PLAY_W, PLAY_H);
  vec3 paperT = mix(hexc(0xf0eadc), hexc(0xf7e6c4), uP0.z);
  vec3 col = paperCol(base, paperT);
  vec3 inkT = hexc(0x3c4650);
  // 横向长笔形成云浪；三层有各自的尺度、漂移速度与墨色。
  for (int layer = 0; layer < 3; layer++) {
    float near = float(layer);
    vec2 p = base + vec2(uTime * (6.0 + near * 8.0), uScroll * (.09 + near * .13));
    float warp = fbm(p * .0025 + near * 17.0, 4);
    vec2 q = vec2(p.x * (.0026 + near * .0012), p.y * (.007 + near * .0025) + warp * 1.6 + sin(uTime * .10 + near * 2.0) * .18);
    float wet = fbm(q, 4);
    float curl = vnoise(q * 2.2 + vec2(wet * 3.0, 7.0));
    float bank = smoothstep(.31, .61, wet + curl * .12);
    float rim = exp(-abs(wet + curl * .12 - .43) * 28.0);
    float dry = vnoise(p * vec2(.12, .025));
    // 下方较浓，玩家能看到云海厚度；上方仍有连绵的淡墨云。
    float lower = mix(.6, 1.15, 1.0 - vUv.y);
    float density = (bank * (.16 + near * .07) + rim * (.07 + near * .05) * dry) * lower;
    col = absorb(col, inkT, density);
    float white = smoothstep(.54, .68, wet) * (.16 + near * .11);
    col = mix(col, paperT * 1.02, white);
  }
  fragColor = vec4(col, 1.0);
}
`,
  fg: SKY_WEATHER + `
void main() {
  vec2 base = vUv * vec2(PLAY_W, PLAY_H);
  vec3 tone = mix(hexc(0xd3d6cf), hexc(0xdfd5bd), uP0.z);
  fragColor = skyWeather(base, tone, hexc(0x343e45), 0.0, 0.0);
}
`,
};
