// 背景共享 GLSL：带导数的噪声、山脊、皴法纹理、纸纹、墨吸收。拼接在 BG_HEADER / FRAME_HEADER 之后使用。
export const BG_LIB = `
float sat1(float x) { return clamp(x, 0.0, 1.0); }
// 值噪声 + 解析导数：返回 (value, d/dx, d/dy)
vec3 noised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = hash21(i), b = hash21(i + vec2(1, 0)), c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y,
              du.x * ((b - a) + k * u.y), du.y * ((c - a) + k * u.x));
}
const mat2 M_FB = mat2(1.6, -1.2, 1.2, 1.6);
// fbm + 导数（导数为对 p 的偏导）
vec3 fbmd(vec2 p, int oct) {
  float a = 0.5, s = 0.0; vec2 d = vec2(0.0); mat2 m = mat2(1.0);
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    vec3 n = noised(m * p + float(i) * 7.31);
    s += a * n.x; d += a * (n.yz * m); m = M_FB * m; a *= 0.5;
  }
  return vec3(s, d);
}
// 山脊噪声（1-|2n-1|）+ 导数，山脊处尖锐
vec3 ridged(vec2 p, int oct) {
  float a = 0.5, s = 0.0; vec2 d = vec2(0.0); mat2 m = mat2(1.0);
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    vec3 n = noised(m * p + float(i) * 5.17);
    float t = 2.0 * n.x - 1.0;
    s += a * (1.0 - abs(t)); d += a * (-2.0 * sign(t) * (n.yz * m)); m = M_FB * m; a *= 0.5;
  }
  return vec3(s, d);
}
// 皴法笔触：沿坡向 g 拉长的条纹噪声，返回 0..1
float cun(vec2 p, vec2 g, float sc) {
  vec2 d = g / (length(g) + 1e-5);
  vec2 q = vec2(dot(p, d), dot(p, vec2(-d.y, d.x))) * sc;
  float a = vnoise(vec2(q.x * 0.03, q.y * 0.22));
  float b = vnoise(vec2(q.x * 0.07 + 5.0, q.y * 0.5));
  return a * 0.6 + b * 0.4;
}
// 宣纸：fp 为游戏区逻辑坐标（0..900,0..1200），返回线性颜色
vec3 paperCol(vec2 fp, vec3 tone) {
  float mott = fbm(fp * 0.012, 3);
  float fib = vnoise(fp * vec2(0.5, 2.3)) * vnoise(fp * vec2(2.1, 0.45));
  float grain = vnoise(fp * 1.7);
  float k = 0.93 + 0.10 * mott + 0.05 * fib + 0.03 * (grain - 0.5);
  return tone * k;
}
// 墨的吸收：c 为底色，t 为墨的透射色，d 为浓度
vec3 absorb(vec3 c, vec3 t, float d) { return c * pow(t, vec3(d)); }
`;
