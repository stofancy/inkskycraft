// 天上场景的天气层：接回 V1/V2 的噪声薄雾、河雾与双层雨丝。
// 与浮石、夜航贴图叠合后，全部战斗对象继续画在天气上方。
export const SKY_WEATHER = `
// V1 山谷雾的横向漂移与 V2 薄雾的卷动；每层独立风速和翻卷相位。
float cloudVeil(vec2 base, float depth) {
  vec2 p = base + vec2(uTime * (16.0 + depth * 16.0), uScroll * (0.10 + depth * 0.18));
  vec2 q = p * vec2(0.0028 + depth * 0.0007, 0.0017 + depth * 0.0011) + depth * 11.0;
  float curl = vnoise(q * 1.7 + vec2(uTime * 0.035, -uTime * 0.024));
  float n = fbm(q + vec2(curl * 0.6, curl * 0.9), 3);
  return smoothstep(0.30, 0.70, n);
}

// V1/V2 第二幕 rainL：两组疏密、倾斜与速度不同的雨丝。
float rainL(vec2 b, float scale, float speed, float dens, float seed, float len) {
  vec2 q = vec2(b.x + b.y * 0.22, b.y) * scale;
  float c = floor(q.x);
  float h = hash21(vec2(c, seed));
  float h2 = hash21(vec2(c, seed + 13.0));
  float y = q.y * 0.03 / len + uTime * speed * (0.8 + 0.4 * h2) + h * 20.0;
  float f = fract(y);
  float lineX = abs(fract(q.x) - 0.5);
  float on = step(1.0 - dens, hash21(vec2(c, floor(y) + seed)));
  return on * (1.0 - smoothstep(0.0, 0.06, lineX)) * smoothstep(0.0, 0.5, f) * (1.0 - smoothstep(0.5, 1.0, f));
}

// 复用现有 hash22 格点分布：解析式风飘墨粒、尘埃、光斑，无逐帧生成或累积。
vec4 windSpecks(vec2 base, vec3 dust, vec3 ink) {
  vec3 col = vec3(0.0); float alpha = 0.0;
  for (int layer = 0; layer < 3; layer++) {
    float depth = float(layer);
    vec2 p = base + vec2(uTime * (13.0 + depth * 11.0), uTime * (5.0 + depth * 4.0) + uScroll * 0.08);
    float cell = 115.0 + depth * 32.0;
    vec2 grid = floor(p / cell);
    vec2 h = hash22(grid + depth * 31.7);
    vec2 center = (grid + 0.25 + 0.5 * h) * cell;
    center += vec2(sin(uTime * 0.7 + h.y * 30.0), cos(uTime * 0.5 + h.x * 30.0)) * 8.0;
    float r = length(p - center);
    float size = 0.9 + depth * 0.6;
    float a = (1.0 - smoothstep(size * 0.25, size * 2.6, r)) * step(0.64, h.x) * 0.18;
    // 接近格边前归零，避免切换格点时突然出现。
    a *= smoothstep(0.0, 0.1, fract(p.x / cell)) * (1.0 - smoothstep(0.9, 1.0, fract(p.x / cell)));
    col += (layer == 0 ? ink : dust) * a; alpha += a;
  }
  return vec4(col, alpha);
}

vec4 skyWeather(vec2 base, vec3 tone, vec3 ink, float wet, float rain) {
  float farCloud = cloudVeil(base, 0.0);
  float midCloud = cloudVeil(base, 1.0);
  float nearCloud = cloudVeil(base, 2.0);
  float a = farCloud * mix(0.09, 0.16, wet) + midCloud * mix(0.20, 0.32, wet) + nearCloud * mix(0.28, 0.40, wet);
  // V1 前景薄雾：偶尔飘过一团，透明度保持低；所有角色与弹幕随后绘制。
  float y = base.y + uScroll * 1.7;
  float n = fbm(vec2(base.x * 0.0028 + uTime * 0.02, y * 0.0017) + 11.0, 3);
  float passing = smoothstep(0.15, 0.85, sin(uTime * 0.24 + 0.8));
  a += smoothstep(0.52, 0.86, n) * 0.12 * passing;
  vec3 c = tone * a;
  vec4 dust = windSpecks(base, tone * 0.65, ink);
  c = c * (1.0 - dust.a) + dust.rgb; a = a + dust.a * (1.0 - a);
  float r = (rainL(base, 0.12, 1.7, 0.30 * rain, 1.0, 1.0) * 0.5
           + rainL(base, 0.07, 2.4, 0.35 * rain, 2.0, 1.4) * 0.6) * 0.12;
  c = c * (1.0 - r) + hexc(0xb8d0ea) * r;
  return vec4(c, a + r * (1.0 - a));
}
`;
