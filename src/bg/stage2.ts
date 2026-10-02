import type { BgDef } from './header';
import { RIVER } from './stage2-scroll';

// uP0.x：剧情揭开整幅太平画；uP3.x：横向世界镜头。所有画迹随世界坐标移动。
const SCROLL_INK = `
vec2 world() { return vUv * vec2(PLAY_W, PLAY_H) + vec2(uP3.x, uScroll); }
vec2 riverAt(float y) {
  return vec2(${RIVER.center}.0 + ${RIVER.a}.0 * sin(y * ${RIVER.fa}) + ${RIVER.b}.0 * sin(y * ${RIVER.fb} + .8) + ${RIVER.c}.0 * sin(y * ${RIVER.fc} + 2.),
    ${RIVER.width}.0 + 24. * sin(y * .0023 + .4) + 12. * sin(y * .0053));
}
// 错落的长裂口：弯曲裂缝、纤维齿边、亮卷边及卷边下的窄阴影。
float tornDistance(vec2 p) {
  float row = floor((p.y + 350.) / 2850.);
  float col = floor((p.x + 450.) / 1800.);
  vec2 center = vec2(450. + col * 1800. + (mod(row, 2.) * 2. - 1.) * 255., row * 2850. + 1400.);
  vec2 q = rot(.22 * (mod(row, 2.) * 2. - 1.)) * (p - center);
  q.x += 24. * sin(q.y * .015) + 10. * sin(q.y * .041);
  float shape = (abs(q.x) / 172. + pow(abs(q.y) / 300., 1.5) - 1.) * 115.;
  return shape + (vnoise(p * .075) - .5) * 13. + (vnoise(p * .23) - .5) * 4.;
}
vec3 realTown(vec2 p) {
  vec2 river = riverAt(p.y);
  float bank = abs(p.x - river.x) - river.y * .65;
  float n = fbm(p * .007, 3);
  vec3 col = mix(hexc(0xadb5b3), hexc(0xc8ccc5), n);
  col = mix(col, hexc(0x788d90), 1. - smoothstep(-16., 24., bank));
  // 墨瓦沿暗河成排，缺口让瓦脊和倒塌墙体露出纸白。
  vec2 town = p + vec2(25. + 21. * sin(floor(p.y / 126.) * 4.7), 0.);
  vec2 cell = floor(town / vec2(92., 126.));
  vec2 q = mod(town, vec2(92., 126.)) - vec2(46., 63.);
  float seed = hash21(cell);
  q = rot((seed - .5) * .4) * q;
  float roof = (1. - smoothstep(30., 33., abs(q.x))) * (1. - smoothstep(39. - abs(q.x) * .22, 42. - abs(q.x) * .22, abs(q.y)));
  roof *= smoothstep(12., 45., bank) * step(.18, seed);
  float broken = smoothstep(.28, .48, vnoise(p * .045 + cell));
  float tiles = (.5 + .5 * sin(q.x * .9 + vnoise(p * .1) * 2.)) * broken;
  vec3 tile = mix(hexc(0x66787a), hexc(0x929e9c), tiles * .22 + step(0., q.y) * .25);
  float wall = (1. - smoothstep(28., 31., abs(q.x))) * (1. - smoothstep(44., 47., abs(q.y + 5.))) * smoothstep(12., 45., bank) * step(.18, seed);
  col = mix(col, hexc(0xd2d2c5), wall * .65);
  col = mix(col, tile, roof * broken * (.65 + n * .3));
  float ridge = (1. - smoothstep(1., 2.5, abs(q.y))) * roof * broken;
  col = mix(col, hexc(0xd5d8cd), ridge * .6);
  return col;
}
vec4 tearLayer(vec2 p) {
  float d = tornDistance(p);
  float hole = 1. - smoothstep(-1.5, 1.5, d);
  float shadow = (1. - smoothstep(1., 15., d)) * (1. - hole);
  float curl = smoothstep(0., 2., d) * (1. - smoothstep(3., 9., d));
  vec3 edge = mix(hexc(0x8e8e7d), hexc(0xf5ead1), curl);
  vec3 color = mix(edge, realTown(p), hole);
  float reveal = clamp(uP0.x, 0., 1.);
  return vec4(mix(color, realTown(p), reveal), max(hole + shadow * .76, reveal));
}
`;

export const BG_STAGE2: BgDef = {
  id: 'stage2', tint: 0xc5bda4, params: { p0: [0, 0, 0, 0], p3: [0, 0, 0, 0] },
  frag: SCROLL_INK + `
void main() {
  vec2 p = world();
  vec2 river = riverAt(p.y);
  float d = abs(p.x - river.x) - river.y;
  float wash = fbm(p * .005, 3);
  float shore = smoothstep(-20., 75., d + (wash - .5) * 42.);
  float outer = smoothstep(80., 440., d);
  vec3 silk = mix(hexc(0xe8ddbe), hexc(0xf0e6cd), wash);
  vec3 water = mix(hexc(0xc2d7ce), hexc(0xd4dfcf), wash);
  vec3 col = mix(water, silk, shore);
  // 赭墨湿染只在两岸积聚，留出干净航道。
  col = mix(col, hexc(0xb9b29a), outer * (.18 + wash * .28));
  float shoreInk = exp(-abs(d - 12. + (wash - .5) * 45.) * .033);
  col = mix(col, hexc(0x8f9d8d), shoreInk * .20);
  float feather = fbm(vec2(p.x * .022, p.y * .007), 3);
  float dryBank = smoothstep(10., 160., d) * (1. - smoothstep(240., 560., d));
  col = mix(col, hexc(0xb3aa8c), dryBank * smoothstep(.36, .68, feather) * .16);
  float stroke = sin(p.y * .074 + sin(p.x * .034 + p.y * .008) * 2.8 + uTime * .26);
  float broken = smoothstep(.37, .63, vnoise(vec2(p.x * .022, p.y * .009 + uTime * .012)));
  float ripple = smoothstep(.95, .995, stroke) * broken * (1. - shore);
  col = mix(col, hexc(0x859f99), ripple * .13);
  // 绢的经纬只有很细的明暗起伏；按像素足迹衰减，避免缩放摩尔纹。
  vec2 weave = sin(p * vec2(2.8, 3.1));
  float thread = (weave.x + weave.y) * .0025 / max(1., max(fwidth(p.x), fwidth(p.y)));
  col += thread + (vnoise(p * .7) - .5) * .004;
  fragColor = vec4(col, 1.);
}
`,
  // 破口盖住同一世界位置的点缀物件；上层敌机、子弹不受遮罩影响。
  fg: SCROLL_INK + `
void main() {
  vec2 p = world();
  vec4 tear = tearLayer(p);
  float bank = abs(p.x - riverAt(p.y).x);
  float cloud = smoothstep(.50, .76, fbm(p * .002 + vec2(uTime * .008, 0.), 3));
  cloud *= smoothstep(200., 520., bank) * .23 * (1. - tear.a);
  float a = tear.a + cloud;
  fragColor = vec4(tear.rgb * tear.a + hexc(0xf4ecda) * cloud, a);
}
`,
};
