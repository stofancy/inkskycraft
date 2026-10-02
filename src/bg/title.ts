import type { BgDef } from './header';
import { BG_LIB } from './lib';

/**
 * 标题背景：月下水墨群山 + 缓缓流动的云海（电影感构图；标题文字在中上部，天空中央保持安静）。
 * uP0.x 月色/亮度 0..1（默认 0.8）；uP0.y 云雾浓度 0..1（默认 0.6）；uP0.z 视差偏移 -1..1（默认 0，鼠标/镜头微移可用）；
 * uP0.w 未使用；uP1..uP3 未使用。uScroll 忽略（云雾按 uTime 流动）。
 * 构图（v 为自下而上 0..1）：月亮在右上（x≈0.78,v≈0.78）；五层远近山峦顶线约在 v=0.52/0.44/0.36/0.26/0.14；
 * 最下缘近山与松影压暗，便于菜单文字。渲染分辨率 0.5，云雾与墨晕天然柔和。
 */
export const BG_TITLE: BgDef = {
  id: 'title',
  scale: 0.5,
  tint: 0x6b8caa,
  params: { p0: [0.8, 0.6, 0, 0] },
  frag: BG_LIB + `
float ridge1(float x, float seed, float pointy) {
  float s = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 4; i++) {
    float n = vnoise(vec2(x * f + seed, seed * 1.7 + float(i)));
    float r = mix(n, 1.0 - abs(2.0 * n - 1.0), pointy);
    s += a * r; a *= 0.68; f *= 2.3;
  }
  return s * 0.55;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  vec2 q = vec2((uv.x - 0.5) * aspect, uv.y);      // 以高度为 1 的坐标
  float t = uTime;
  float moonB = uP0.x, mistA = uP0.y;
  float px = uP0.z * 0.02;

  // 天空：上暗下亮的青灰，带宣纸纤维
  vec3 skyTop = hexc(0x0e1823), skyLow = hexc(0x5b7383);
  vec3 col = mix(skyLow, skyTop, smoothstep(0.35, 1.0, uv.y));
  // 月亮
  vec2 mc = vec2(0.28 * aspect * 1.0, 0.77);       // 相对屏幕中心偏右
  float md = length(q - mc);
  float moonR = 0.068;
  float disc = smoothstep(moonR, moonR - 0.004, md);
  vec3 moonC = mix(hexc(0xe9e4d2), hexc(0xcfd8d8), fbm(q * 9.0, 3));
  col += hexc(0xa8c0d0) * exp(-md * 7.0) * 0.32 * moonB + hexc(0x7d97ad) * exp(-md * 2.2) * 0.10 * moonB;
  col = mix(col, moonC * (0.9 + 0.3 * moonB), disc);
  // 月面墨晕（淡淡阴影）
  col = mix(col, col * 0.86, disc * smoothstep(0.35, 0.65, fbm(q * 14.0 + 3.0, 3)) * 0.6);
  // 月晕环
  col += hexc(0xb8ccd8) * smoothstep(0.012, 0.0, abs(md - moonR * 2.3)) * 0.04 * moonB;
  // 星
  vec2 sc = floor(uv * vec2(aspect, 1.0) * 70.0);
  vec2 sf = fract(uv * vec2(aspect, 1.0) * 70.0) - 0.5 - (hash22(sc + 5.0) - 0.5) * 0.6;
  float star = step(0.985, hash21(sc)) * smoothstep(0.12, 0.02, length(sf)) * smoothstep(0.55, 0.9, uv.y) * (0.5 + 0.5 * sin(t * 1.5 + hash21(sc + 3.0) * 20.0));
  col += hexc(0xdfe8f0) * star * 0.25 * smoothstep(0.24, 0.5, md);
  // 天空细云（横向流动的淡墨长条）
  float sk = fbm(vec2(q.x * 1.5 + t * 0.006, uv.y * 9.0) + 2.0, 4);
  col = mix(col, mix(skyLow, hexc(0xb5c6cf), 0.5), smoothstep(0.52, 0.8, sk) * 0.26 * smoothstep(0.40, 0.75, uv.y) * mistA);

  // 群山：由远及近 5 层
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float top = 0.55 - 0.10 * fi;
    float amp = 0.20 - 0.02 * fi;
    float freq = 0.9 + 0.32 * fi;
    float x = q.x + px * (fi + 1.0);
    float rd = top + amp * 2.3 * (ridge1(x * freq, 3.3 + fi * 7.1, 0.95 - 0.10 * fi) - 0.45);
    float dy = rd - uv.y;                       // >0 在山体内
    float inside = smoothstep(0.0, 0.0022, dy);
    if (inside <= 0.0) {
      // 山顶月光勾边（山外近脊处的一丝亮）
    }
    float depth = fi / 4.0;
    // 山体墨色：越近越浓越深
    vec3 farInk = hexc(0x7f95a3), nearInk = hexc(0x0b1116);
    vec3 ink = mix(farInk, nearInk, pow(depth, 0.85));
    // 云雾：横向缓流，越靠山脚越浓（山脚化入雾中）
    float flow = t * (0.004 + 0.003 * fi) * (fi < 2.0 ? 1.0 : -1.0);
    float mn = fbm(vec2(x * (1.3 + 0.2 * fi) + flow * 6.0, uv.y * (5.0 + fi)) + fi * 5.0, 4);
    vec3 mistC = mix(hexc(0xa5b8c3), hexc(0x4a5f6e), depth * 0.85) * (0.8 + 0.3 * moonB);
    float mf = smoothstep(0.03, 0.26 + 0.05 * fi, dy + 0.12 * (mn - 0.5)) * (1.0 - 0.85 * depth);
    float fade = 1.0 - mf;
    vec3 body = mix(ink, mistC, mf);
    // 皴：垂直笔触与干笔飞白
    float cun = vnoise(vec2(x * 95.0, uv.y * (6.0 + 3.0 * fi)) + fi * 11.0);
    float cun2 = vnoise(vec2(x * 210.0 + 3.0, uv.y * 24.0));
    float stroke = smoothstep(0.45, 0.8, cun * 0.65 + cun2 * 0.35);
    body *= 1.0 - 0.34 * stroke * smoothstep(0.16, 0.0, dy) * (0.5 + 0.5 * depth) - 0.10 * stroke * (1.0 - smoothstep(0.0, 0.3, dy)) * 0.0;
    // 山脊浓墨勾边 + 月光侧亮边
    float rim = smoothstep(0.014, 0.0, dy) * step(0.0, dy);
    body = mix(body, ink * 0.6, rim * 0.5 * (0.4 + 0.6 * stroke));
    float moonSide = smoothstep(0.55, 0.0, abs(x - mc.x));
    body += hexc(0xb8ccd8) * rim * 0.10 * moonSide * (1.0 - depth * 0.5) * moonB;
    // 松：近三层山脊上的点簇松影
    if (i >= 3 && i < 5) {
      float cw = 0.028 - 0.004 * (fi - 3.0);
      float ci = floor(x / cw);
      float tp = 0.0;
      for (int k = -1; k <= 1; k++) {
        float ck = ci + float(k);
        vec2 h = hash22(vec2(ck, fi * 3.0 + 1.0));
        if (h.x < 0.45) continue;
        float cx = (ck + 0.25 + 0.5 * h.y) * cw;
        float xr = ridge1(cx * freq, 3.3 + fi * 7.1, 0.95 - 0.10 * fi);
        float by = top + amp * 2.3 * (xr - 0.45) - 0.004;
        float H = (0.022 + 0.028 * h.y) * (1.0 + 0.6 * (fi - 3.0));
        float dyy = uv.y - by;
        float hw = cw * 0.42 * (1.0 - dyy / H) * (0.65 + 0.35 * cos(dyy / H * 22.0));
        tp = max(tp, step(0.0, dyy) * step(dyy, H) * step(abs(x - cx), hw));
        tp = max(tp, step(0.0, dyy) * step(dyy, H * 0.35) * step(abs(x - cx), 0.0010));
      }
      body = mix(body, ink * 0.55, tp);
      inside = max(inside, tp);
    }
    col = mix(col, body, inside);
    // 山间流云带：在这一层前方叠一层横向流雾
    float band = smoothstep(0.13, 0.0, abs(uv.y - (top - 0.06)));
    float bm = fbm(vec2(x * 2.2 - t * (0.010 + 0.006 * fi), uv.y * 14.0 + fi * 3.0), 4);
    float bmask = smoothstep(0.42, 0.72, bm) * band * mistA * (0.9 - 0.3 * depth);
    col = mix(col, mistC * 1.08, sat1(bmask) * 0.65);
  }
  // 最下缘压暗，托住菜单文字
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.22, uv.y));
  // 宣纸纤维与暗角
  float fib = vnoise(vec2(uv.x * aspect, uv.y) * vec2(350.0, 40.0)) * vnoise(vec2(uv.x * aspect, uv.y) * vec2(50.0, 300.0));
  col *= 0.94 + 0.10 * fib + 0.03 * vnoise(vec2(uv.x * aspect, uv.y) * 600.0);
  col *= 1.0 - 0.45 * pow(length(uv - 0.5) * 1.25, 2.4);
  fragColor = vec4(col, 1.0);
}`,
};
