import type { BgDef } from './header';
import { BG_LIB } from './lib';

// 与前两章同档日光云海。uP0.z 沿用关卡的四段进度 0 / 1/3 / 2/3 / 1：
// 雷场的淡紫远云 → 雷公云峰 → 鲲的高空白云 → 鹏的金色晴空。
// uP0.x 的战斗变化和 uFlash 不压暗或闪白整屏；雷光只留在两侧远云里。
export const BG_STAGE3: BgDef = {
  id: 'stage3', scale: .65, tint: 0xc1bfdd,
  params: { p0: [0, .55, 0, 0], p1: [1, 1, 0, 0] },
  frag: BG_LIB + `
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  return length(p - a - ab * clamp(dot(p - a, ab) / dot(ab, ab), 0., 1.));
}
void main() {
  vec2 base = vUv * vec2(PLAY_W, PLAY_H);
  float progress = clamp(uP0.z, 0., 1.);
  float high = smoothstep(.34, .78, progress);
  float clearSky = smoothstep(.70, 1., progress);
  float storm = (1. - clearSky) * (.65 + .35 * sin(progress * PI));
  float side = smoothstep(180., 390., abs(base.x - 450.));
  float sun = smoothstep(.20, 1.05, vUv.x * .6 + vUv.y * .65);
  vec2 world = base + vec2(0., uScroll * .10);
  vec3 col = mix(hexc(0xc9d8e8), hexc(0xe2eaf1), fbm(world * .0022, 3));
  col = mix(col, hexc(0xeaf0f4), high * .25);
  vec3 daylight = mix(hexc(0xfff9f1), hexc(0xffefd3), clearSky * sun);

  // 三层云包用世界坐标跟随卷轴，云峰随升空逐段展开，中央四成降对比。
  for (int layer = 0; layer < 3; layer++) {
    float depth = float(layer);
    vec2 p = base + vec2(uTime * (3. + depth * 4.), uScroll * (.07 + depth * .115));
    vec2 warp = vec2(fbm(p * .0021 + depth * 9., 3), fbm(p * .0021 + depth * 9. + 5.3, 3)) - .5;
    float scale = (.0048 - depth * .0007) * (1. - high * .16);
    vec3 h = fbmd((p + warp * 185.) * scale, 3);
    float threshold = .36 + depth * .047;
    float cover = smoothstep(threshold, threshold + .17, h.x);
    cover *= mix(.26, 1., side);
    float shade = clamp(dot(h.yz, vec2(.62, .78)) * 3., -1., 1.);
    vec3 shadow = mix(hexc(0xabbdd9), hexc(0xc3d4e5), high);
    // 雷云成团留在远层，明部有淡紫边光，低明度只占两侧小块。
    float bank = smoothstep(.42, .66, fbm(p * .0019 + 18., 3)) * side * storm;
    shadow = mix(shadow, hexc(0xaaa7cd), bank * (layer == 0 ? .85 : .30));
    vec3 cloud = mix(shadow, daylight, clamp(.68 + shade * .52, 0., 1.));
    float rim = exp(-abs(h.x - threshold - .07) * 32.);
    cloud = mix(cloud, hexc(0xe8dfff), rim * bank * .48);
    cloud += hexc(0xffd797) * clearSky * sun * max(0., shade) * .16;
    col = mix(col, cloud, cover * .86);
  }

  // 一格远云内短促的分叉电光；闪动与位置固定在该格世界坐标内。
  vec2 far = base + vec2(uTime * 3., uScroll * .07);
  float row = floor(far.y / 520.);
  for (int k = 0; k < 2; k++) {
    float lane = float(k);
    float seed = hash21(vec2(row, lane + 7.));
    vec2 center = vec2(mix(115., 785., lane) + (seed - .5) * 70., (row + .5) * 520.);
    vec2 q = far - center;
    float cycle = mod(uTime + seed * 19., 7.5);
    float flash = exp(-cycle * 13.) * (.65 + .35 * cos(cycle * 46.)) * storm;
    if (flash > .015) {
      vec2 a = vec2(-54., 30.), b = vec2(-9., 5.), c = vec2(5., 20.), d = vec2(58., -26.);
      float dist = min(min(segmentDistance(q, a, b), segmentDistance(q, b, c)), segmentDistance(q, c, d));
      dist = min(dist, segmentDistance(q, b, vec2(-22., -26.)));
      float halo = exp(-dot(q / vec2(100., 70.), q / vec2(100., 70.)) * 2.);
      col += hexc(0xded0ff) * halo * flash * .24;
      col = mix(col, hexc(0xfffaff), exp(-dist * .6) * flash * .75);
    }
  }
  // 最后一段从右上透出暖金天光，云底仍是清亮蓝白。
  col = mix(col, hexc(0xffefd0), clearSky * sun * .23);
  col *= mix(1., paperCol(base, vec3(1.)).x, .32);
  fragColor = vec4(col, 1.);
}
`,
  fg: `
void main() {
  vec2 base = vUv * vec2(PLAY_W, PLAY_H);
  float progress = clamp(uP0.z, 0., 1.);
  float side = smoothstep(180., 425., abs(base.x - 450.));
  vec2 world = base + vec2(uTime * 7., uScroll * .34);
  float mist = smoothstep(.46, .76, fbm(world * .003, 3));
  float alpha = mist * side * .16;
  vec3 light = mix(hexc(0xf1f2ff), hexc(0xfff4df), smoothstep(.7, 1., progress));
  fragColor = vec4(light * alpha, alpha);
}
`,
};
