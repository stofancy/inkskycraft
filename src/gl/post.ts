// 后处理：HDR 泛光（13 点降采样 + 帐篷升采样链）、冲击波扭曲、色差、子弹时间水墨化、
// 暗角、纸纹颗粒、闪白、震屏，最后 PBR Neutral 色调映射输出到画布。
import { PLAY_H, PLAY_W } from '../types';
import { TONEMAP_GLSL } from './tonemap';
import { FS_TRI_VS, Program, Target, fullscreen, type GL } from './util';

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
`;

const DOWN = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold; // <0 表示不做阈值
vec3 s(vec2 uv) { return texture(uSrc, uv).rgb; }
void main() {
  vec2 t = uTexel;
  vec3 a = s(vUv + t * vec2(-2, 2)), b = s(vUv + t * vec2(0, 2)), c = s(vUv + t * vec2(2, 2));
  vec3 d = s(vUv + t * vec2(-2, 0)), e = s(vUv), f = s(vUv + t * vec2(2, 0));
  vec3 g = s(vUv + t * vec2(-2, -2)), h = s(vUv + t * vec2(0, -2)), i = s(vUv + t * vec2(2, -2));
  vec3 j = s(vUv + t * vec2(-1, 1)), k = s(vUv + t * vec2(1, 1)), l = s(vUv + t * vec2(-1, -1)), m = s(vUv + t * vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uThreshold >= 0.0) {
    float br = max(col.r, max(col.g, col.b));
    float knee = 0.6;
    float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    col *= w;
    col = min(col, vec3(40.0));
  }
  o = vec4(col, 1.0);
}`;

const UP = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uRadius;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 c = texture(uSrc, vUv).rgb * 4.0;
  c += (texture(uSrc, vUv + vec2(-t.x, 0)).rgb + texture(uSrc, vUv + vec2(t.x, 0)).rgb + texture(uSrc, vUv + vec2(0, t.y)).rgb + texture(uSrc, vUv + vec2(0, -t.y)).rgb) * 2.0;
  c += texture(uSrc, vUv + vec2(-t.x, t.y)).rgb + texture(uSrc, vUv + vec2(t.x, t.y)).rgb + texture(uSrc, vUv + vec2(-t.x, -t.y)).rgb + texture(uSrc, vUv + vec2(t.x, -t.y)).rgb;
  o = vec4(c / 16.0, 1.0);
}`;

const COMPOSITE = HEAD + TONEMAP_GLSL + `
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec4 uWaves[16];   // x y（单位, y 向下） 半径 强度
uniform float uWaveW[16];  // 环宽
uniform int uWaveN;
uniform float uBloomStr;
uniform float uCA;
uniform float uFlash;
uniform vec3 uFlashCol;
uniform float uInkMode;    // 子弹时间水墨化 0..1
uniform float uVignette;
uniform float uTime;
uniform vec2 uShake;       // 单位
uniform float uZoom;
uniform float uExposure;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uSat;
uniform vec2 uRes;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec2 world = vec2(PW, PH);
  vec2 uv = (vUv - 0.5) / uZoom + 0.5 + uShake / world * vec2(1.0, -1.0);
  vec2 wp = vec2(uv.x, 1.0 - uv.y) * world;
  vec2 off = vec2(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uWaveN) break;
    vec4 w = uWaves[i];
    vec2 d = wp - w.xy;
    float r = length(d);
    float x = (r - w.z) / uWaveW[i];
    float prof = x * exp(-x * x * 2.0);
    off += (d / max(r, 1.0)) * prof * w.w;
  }
  uv += off / world * vec2(1.0, -1.0);
  vec2 cdir = (uv - 0.5);
  float ca = uCA * (0.4 + dot(cdir, cdir) * 3.0);
  vec3 col;
  col.r = texture(uScene, uv + cdir * ca).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - cdir * ca).b;
  vec3 bloom = texture(uBloom, uv).rgb;
  col += bloom * uBloomStr;
  col *= uExposure;
  // 调色
  col = col * uGain + uLift * (1.0 - col);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSat);
  // 子弹时间：世界褪成墨色，只留朱红
  if (uInkMode > 0.0) {
    float redness = clamp((col.r - max(col.g, col.b)) / max(col.r, 1e-3), 0.0, 1.0);
    vec3 inkTone = mix(vec3(0.02, 0.018, 0.016), vec3(0.93, 0.88, 0.78), smoothstep(0.0, 1.0, pow(lum, 0.8)));
    vec3 keep = mix(inkTone, col, smoothstep(0.35, 0.8, redness));
    col = mix(col, keep, uInkMode * 0.88);
  }
  col += uFlashCol * uFlash;
  // 暗角
  vec2 vq = vUv - 0.5;
  col *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(vq * vec2(1.0, 0.9)) * 1.25);
  vec3 outc = linearToSrgb(tonemapNeutral(max(col, vec3(0.0))));
  // 纸纹颗粒 + 抖动去色带
  float g = hash(floor(vUv * uRes) + fract(uTime) * 91.0) - 0.5;
  outc += g * (1.5 / 255.0 + 0.012 * (1.0 - lum));
  o = vec4(outc, 1.0);
}`.replace('vec2(PW, PH)', `vec2(${PLAY_W.toFixed(1)}, ${PLAY_H.toFixed(1)})`);

export interface Wave { x: number; y: number; r: number; strength: number; width: number }

export class Post {
  private pDown: Program;
  private pUp: Program;
  private pComp: Program;
  private chain: Target[] = [];
  private waveBuf = new Float32Array(64);
  private waveW = new Float32Array(16);
  bloomStr = 0.09;
  threshold = 0.95;
  ca = 0;
  flash = 0;
  flashCol: [number, number, number] = [1, 0.95, 0.85];
  inkMode = 0;
  vignette = 0.35;
  shake: [number, number] = [0, 0];
  zoom = 1;
  exposure = 1;
  lift: [number, number, number] = [0, 0, 0];
  gain: [number, number, number] = [1, 1, 1];
  sat = 1;
  waves: Wave[] = [];

  constructor(readonly gl: GL) {
    this.pDown = new Program(gl, FS_TRI_VS, DOWN);
    this.pUp = new Program(gl, FS_TRI_VS, UP);
    this.pComp = new Program(gl, FS_TRI_VS, COMPOSITE);
  }

  resize(w: number, h: number, levels = 7): void {
    let cw = Math.max(1, w >> 1), ch = Math.max(1, h >> 1);
    for (let i = 0; i < levels; i++) {
      if (!this.chain[i]) this.chain[i] = new Target(this.gl, cw, ch, 'rgba16f');
      else this.chain[i].resize(cw, ch);
      cw = Math.max(1, cw >> 1);
      ch = Math.max(1, ch >> 1);
    }
    this.chain.length = levels;
  }

  private bloom(scene: Target): Target {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    let src: Target = scene;
    for (let i = 0; i < this.chain.length; i++) {
      const dst = this.chain[i];
      dst.bind();
      this.pDown.use().set('uTexel', 1 / src.w, 1 / src.h).set('uThreshold', i === 0 ? this.threshold : -1).tex('uSrc', src.tex);
      fullscreen(gl);
      src = dst;
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.chain.length - 2; i >= 0; i--) {
      const s = this.chain[i + 1], d = this.chain[i];
      d.bind();
      this.pUp.use().set('uTexel', 1 / s.w, 1 / s.h).set('uRadius', 1).tex('uSrc', s.tex);
      fullscreen(gl);
    }
    gl.disable(gl.BLEND);
    return this.chain[0];
  }

  /** 把 scene 后处理后画到当前帧缓冲的视口 (x,y,w,h)（像素，原点左下）。 */
  render(scene: Target, time: number, vx: number, vy: number, vw: number, vh: number): void {
    const gl = this.gl;
    const bloom = this.bloom(scene);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vx, vy, vw, vh);
    const n = Math.min(16, this.waves.length);
    for (let i = 0; i < n; i++) {
      const w = this.waves[i];
      this.waveBuf.set([w.x, w.y, w.r, w.strength], i * 4);
      this.waveW[i] = w.width;
    }
    this.pComp.use()
      .set('uWaves', this.waveBuf).set('uWaveW', this.waveW).set('uWaveN', n)
      .set('uBloomStr', this.bloomStr).set('uCA', this.ca).set('uFlash', this.flash).set('uFlashCol', this.flashCol)
      .set('uInkMode', this.inkMode).set('uVignette', this.vignette).set('uTime', time)
      .set('uShake', this.shake).set('uZoom', this.zoom).set('uExposure', this.exposure)
      .set('uLift', this.lift).set('uGain', this.gain).set('uSat', this.sat).set('uRes', vw, vh)
      .tex('uScene', scene.tex).tex('uBloom', bloom.tex);
    fullscreen(gl);
  }
}
