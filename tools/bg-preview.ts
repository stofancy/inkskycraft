// 背景着色器预览。参数（URL query）：
//   id=stage1|stage2|stage3|title|frame   scroll=起始滚动  speed=滚动速度(单位/秒，默认60)
//   t=起始时间  anim=0 静止  fg=0 关闭前景  flash=0..1  beat=0..1
//   p0=a,b,c,d … p3=…  覆盖参数   h=画布 CSS 高度（默认窗口高）  bench=1 测性能
import { BG_HEADER, FRAME_HEADER, type BgDef, type Vec4 } from '../src/bg/header';
import { BACKGROUNDS, FRAME_FRAG } from '../src/bg/index';
import { Lights, Scene3D } from '../src/gl/scene3d';
import { FS_TRI_VS, Program, Target, fullscreen } from '../src/gl/util';
import { TONEMAP_GLSL } from '../src/gl/tonemap';

const q = new URLSearchParams(location.search);
const id = q.get('id') ?? 'stage1';
const num = (k: string, d: number) => (q.has(k) ? parseFloat(q.get(k)!) : d);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const info = document.getElementById('info')!;
const gl = canvas.getContext('webgl2', { antialias: false })!;
gl.getExtension('EXT_color_buffer_float');
const dpr = window.devicePixelRatio || 1;
const isFrame = id === 'frame';
const cssH = num('h', window.innerHeight);
const cssW = isFrame ? window.innerWidth : Math.round(cssH * 0.75);
canvas.style.width = cssW + 'px';
canvas.style.height = cssH + 'px';
canvas.width = Math.round(cssW * dpr);
canvas.height = Math.round(cssH * dpr);

const def: BgDef | undefined = BACKGROUNDS[id];
const hdr = new Target(gl, canvas.width, canvas.height, 'rgba16f');
const bgT = new Target(gl, canvas.width * (def?.scale ?? 1), canvas.height * (def?.scale ?? 1), 'rgba16f');
const s3 = def?.scene3d ? new Scene3D(gl, def.scene3d, q.get('quality') === 'high' ? 'high' : 'ultra') : null;
s3?.resize(canvas.width, canvas.height);
const lights = new Lights();
const bgProg = isFrame ? new Program(gl, FS_TRI_VS, FRAME_HEADER + FRAME_FRAG) : (s3 ? (null as unknown as Program) : new Program(gl, FS_TRI_VS, BG_HEADER + def!.frag));
const fgProg = !isFrame && def?.fg && q.get('fg') !== '0' ? new Program(gl, FS_TRI_VS, BG_HEADER + def.fg) : null;
const blit = new Program(gl, FS_TRI_VS, `#version 300 es
precision highp float; uniform sampler2D uTex; in vec2 vUv; out vec4 o;` + TONEMAP_GLSL + `
void main(){ vec3 c = texture(uTex, vUv).rgb; o = vec4(linearToSrgb(tonemapNeutral(c)), 1.0); }`);
const copy = new Program(gl, FS_TRI_VS, `#version 300 es
precision highp float; uniform sampler2D uTex; in vec2 vUv; out vec4 o; void main(){ o = texture(uTex, vUv); }`);

const parseV = (k: string, d?: Vec4): Vec4 => (q.has(k) ? (q.get(k)!.split(',').map(Number) as Vec4) : d ?? [0, 0, 0, 0]);
const P = [parseV('p0', def?.params?.p0), parseV('p1', def?.params?.p1), parseV('p2', def?.params?.p2), parseV('p3', def?.params?.p3)];
const tint = def?.tint ?? 0xd8391f;
const tintLin = [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255].map((v) => Math.pow(v / 255, 2.2));

function setCommon(p: Program, t: number, scroll: number, w: number, h: number) {
  p.set('uRes', w, h).set('uTime', t).set('uScroll', scroll).set('uFlash', num('flash', 0)).set('uBeat', num('beat', (t * 2) % 1));
  p.set('uP0', P[0]).set('uP1', P[1]).set('uP2', P[2]).set('uP3', P[3]);
}

function frame(t: number) {
  const scroll = num('scroll', 0) + t * num('speed', 60);
  if (isFrame) {
    hdr.bind();
    bgProg.use();
    setCommon(bgProg, t, scroll, hdr.w, hdr.h);
    const pw = hdr.h * 0.75;
    bgProg.set('uPlay', (hdr.w - pw) / 2, 0, pw, hdr.h).set('uTint', tintLin);
    fullscreen(gl);
  } else if (s3) {
    s3.render(hdr, { time: t, scroll, beat: num('beat', (t * 2) % 1), flash: num('flash', 0), params: P }, lights);
    lights.endFrame();
    if (fgProg) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      fgProg.use();
      setCommon(fgProg, t, scroll, hdr.w, hdr.h);
      fullscreen(gl);
      gl.disable(gl.BLEND);
    }
  } else {
    bgT.bind();
    bgProg.use();
    setCommon(bgProg, t, scroll, bgT.w, bgT.h);
    fullscreen(gl);
    hdr.bind();
    copy.use().tex('uTex', bgT.tex);
    fullscreen(gl);
    if (fgProg) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      fgProg.use();
      setCommon(fgProg, t, scroll, hdr.w, hdr.h);
      fullscreen(gl);
      gl.disable(gl.BLEND);
    }
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  blit.use().tex('uTex', hdr.tex);
  fullscreen(gl);
}

const t0 = num('t', 0);
if (q.get('bench') === '1') {
  const N = 120;
  const px = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // 强制等待 GPU 完成
  frame(t0);
  sync();
  const s = performance.now();
  for (let i = 0; i < N; i++) { frame(t0 + i / 60); sync(); }
  const ms = (performance.now() - s) / N;
  const msg = `bench ${id} ${canvas.width}x${canvas.height}: ${ms.toFixed(2)} ms/frame`;
  console.warn(msg);
  info.textContent = msg;
} else if (q.get('anim') === '0') {
  frame(t0);
} else {
  const start = performance.now();
  const loop = () => {
    frame(t0 + (performance.now() - start) / 1000);
    requestAnimationFrame(loop);
  };
  loop();
}
