import type { BgDef } from './header';
import { BG_LIB } from './lib';

// 世界坐标云水与第一章共用高度场光照；中央四成保持淡亮，岸岛由精灵分层摆放。
export const BG_STAGE2: BgDef = {
  id: 'stage2', scale: .65, tint: 0xd7e3e6,
  params: { p0: [0, 0, 0, 0], p3: [0, 0, 0, 0] },
  frag: BG_LIB + `
void main() {
  vec2 base = vUv * vec2(PLAY_W, PLAY_H);
  base.x += uP3.x;
  float side = smoothstep(175., 390., abs(base.x - uP3.x - 450.));
  vec2 water = base + vec2(0., uScroll * .22);
  float bend = sin(water.y * .0021) * 48.;
  float channel = exp(-pow((base.x - uP3.x - 450. - bend) / 215., 2.));
  vec2 flow = vec2(water.x * .008, (water.y + uTime * 16.) * .0035);
  flow.x += (fbm(flow * .7, 3) - .5) * 1.4;
  float ripple = 1. - abs(fbm(flow, 3) * 2. - 1.);
  vec3 col = mix(hexc(0xcbdde7), hexc(0xe8eff0), fbm(water * .002, 3));
  col = mix(col, hexc(0xf5f4e7), smoothstep(.64, .94, ripple) * channel * .45);
  for (int l = 0; l < 3; l++) {
    float depth = float(l);
    vec2 p = base + vec2(uTime * (3. + depth * 3.), uScroll * (.07 + depth * .115));
    vec2 warp = vec2(fbm(p * .0021 + depth * 9., 3), fbm(p * .0021 + depth * 9. + 5.3, 3)) - .5;
    vec3 h = fbmd((p + warp * 170.) * (.0047 - depth * .0007), 3);
    float threshold = .37 + depth * .045;
    float cover = smoothstep(threshold, threshold + .18, h.x);
    cover *= mix(.34, 1., side) * (1. - channel * .25);
    float shade = clamp(dot(h.yz, vec2(.62, .78)) * 3., -1., 1.);
    vec3 cloud = mix(hexc(0xbdcfdf), hexc(0xfff7e7), clamp(.68 + shade * .5, 0., 1.));
    cloud = mix(cloud, hexc(0xffefd4), max(0., shade) * .14);
    col = mix(col, cloud, cover * .83);
  }
  // 真镇揭露时云水保持日光，只略微褪去暖色。
  col = mix(col, mix(col, hexc(0xe2edf0), .18), uP0.x);
  fragColor = vec4(col, 1.);
}
`,
  fg: `
void main() {
  vec2 p = vUv * vec2(PLAY_W, PLAY_H) + vec2(uP3.x, uScroll * .34);
  float side = smoothstep(185., 410., abs(vUv.x * PLAY_W - 450.));
  float mist = smoothstep(.43, .74, fbm(p * .003 + vec2(uTime * .006, 0.), 3));
  float reveal = sin(clamp(uP0.x, 0., 1.) * 3.14159);
  float alpha = mist * side * (.14 + reveal * .22);
  fragColor = vec4(hexc(0xf4f6ed) * alpha, alpha);
}
`,
};
