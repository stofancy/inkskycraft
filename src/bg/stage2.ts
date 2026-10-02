// 保留 Chapter2 的正式夜航贴图，接回 V1 河雾和 V2 薄雾、双层细雨。
import type { BgDef } from './header';
import { SKY_WEATHER } from './weather';
export const BG_STAGE2: BgDef = {
  id: 'stage2', tint: 0x2a4a7a, params: { p0: [0, 0, .35, .5] },
  frag: `
void main() {
  vec2 p = vUv * vec2(PLAY_W, PLAY_H);
  float n = fbm(p * .003 + vec2(uTime * .018, uScroll * .001), 3);
  fragColor = vec4(hexc(0x07111e) * (0.5 + n), 1.0);
}
`,
  fg: SKY_WEATHER + `
void main() {
  vec2 base = vUv * vec2(PLAY_W, PLAY_H);
  // V1 河雾移到云面上，低饱和冷色把蜃海的潮湿感留在景物层。
  fragColor = skyWeather(base, hexc(0x607d89), hexc(0x182b38), 1.0, 0.22);
}
`,
};
