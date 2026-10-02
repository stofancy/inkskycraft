// 泼墨大招的贴图精灵：朱雀翼、身、火羽、火墙。贴图在 public/art/vfx/bomb/，到位前不画。
import { PLAY_H, PLAY_W } from '../types';
import { Program, type GL } from './util';

export type BombTex = 'zhu-wing-l' | 'zhu-body' | 'zhu-feathers' | 'zhu-wall' | 'blue-body' | 'blue-head' | 'blue-wall' | 'blue-strip' | 'purple-taiji' | 'purple-gua' | 'purple-bolt';
const FILES: BombTex[] = ['zhu-wing-l', 'zhu-body', 'zhu-feathers', 'zhu-wall', 'blue-body', 'blue-head', 'blue-wall', 'blue-strip', 'purple-taiji', 'purple-gua', 'purple-bolt'];
/** 图集列行数；未列出的是单图。 */
const ATLAS: Partial<Record<BombTex, [number, number]>> = { 'zhu-feathers': [2, 2], 'purple-gua': [4, 2] };
const TILED: BombTex[] = ['zhu-wall', 'blue-wall', 'blue-strip'];

export interface BombSprite {
  tex: BombTex;
  x: number; y: number;       // 锚点的世界坐标
  w: number; h: number;       // 世界尺寸
  ax?: number; ay?: number;   // 锚点在贴图内的位置 0..1（默认 .5,.5）
  rot?: number; flip?: boolean;
  alpha: number;
  cell?: number;              // 2x2 图集的格号
  glow?: number;              // 额外加亮
  wob?: number;               // 火焰扭动强度
  scroll?: number;            // 横向滚动（火墙）
  seed?: number;
  clip?: number;              // 只画贴图上方 clip 比例（头颈）
  top?: boolean;              // 画在敌弹之上
  reveal?: number;            // 显现进度 0..1（沿笔画推进的遮罩）
  revMode?: 1 | 2;            // 1：翼，从右缘翼根向左；2：身，从胸口向头尾
  xwin?: [number, number];    // 只画贴图横向这一段（软边）
}

const VS = `#version 300 es
uniform vec4 uP;   // x y w h
uniform vec4 uQ;   // ax ay rot flip
uniform vec4 uC;   // 图集：u0 v0 du dv
out vec2 vUV;
void main(){
  vec2 c=vec2(float(gl_VertexID&1),float(gl_VertexID>>1));
  vec2 l=(c-uQ.xy)*uP.zw; if(uQ.w>.5)l.x=-l.x;
  float cs=cos(uQ.z),sn=sin(uQ.z);
  vec2 p=uP.xy+vec2(l.x*cs-l.y*sn,l.x*sn+l.y*cs);
  gl_Position=vec4(p.x/${PLAY_W.toFixed(1)}*2.-1.,1.-p.y/${PLAY_H.toFixed(1)}*2.,0,1);
  vUV=uC.xy+c*uC.zw;
}`;
const FS = `#version 300 es
precision highp float;
in vec2 vUV;uniform sampler2D uTex;
uniform vec4 uE; // alpha glow wob time
uniform vec4 uF; // 横向滚动 seed  图集u0 图集du
uniform float uClip;uniform float uMode;uniform vec4 uW; // reveal mode xa xb
out vec4 o;
float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
void main(){
  vec2 uv=vUV;
  float lu=(uv.x-uF.z)/uF.w;
  float wb=uE.z;
  vec2 d=vec2(noise(vec2(lu*7.,uv.y*7.)+vec2(uE.w*1.6,uF.y))-.5,noise(vec2(lu*7.+9.,uv.y*7.)-vec2(0.,uE.w*2.2+uF.y))-.5)*wb;
  uv+=d*vec2(uF.w,uF.w);
  uv.x=uF.z+fract((lu+uF.x))*uF.w;
  vec4 t=texture(uTex,uv);
  float la=max(t.a,.001);
  float l=dot(t.rgb/la,vec3(.3,.59,.11));
  // 按亮度重新上色：深绛红 → 朱红 → 橙 → 白黄
  vec3 r=mix(vec3(.10,.0,.012),vec3(.62,.05,.03),smoothstep(.0,.5,l));
  r=mix(r,vec3(1.05,.26,.06),smoothstep(.45,.75,l));
  r=mix(r,vec3(1.4,.85,.4),smoothstep(.8,.97,l));
  vec3 c=(uMode>.5?r*t.a:t.rgb)*(1.+uE.y);
  float flick=.92+.08*sin(uE.w*18.+uF.y*7.+lu*5.);
  float cl=uClip>0.?1.-smoothstep(uClip-.06,uClip,vUV.y):1.;
  if(uW.y>.5){
    float cv=uW.y<1.5?(1.-vUV.x):abs(vUV.y-.22)*1.25;
    float nz=noise(vUV*9.+uF.y*3.);
    float f=uW.x*1.25-cv+(nz-.5)*.18;
    float m=smoothstep(0.,.08,f);
    float front=exp(-pow(f/.07,2.))*(1.-smoothstep(.97,1.,uW.x));
    cl*=m;
    c+=vec3(1.5,.7,.2)*front*t.a*1.2;
  }
  if(uW.w>uW.z)cl*=smoothstep(uW.z-.02,uW.z+.06,vUV.x)*(1.-smoothstep(uW.w-.06,uW.w+.02,vUV.x));
  o=vec4(c*flick*uE.x*cl,t.a*uE.x*cl);
}`;

/** 带状网格：沿脊线铺贴图。每个脊点两个顶点（x y u v alpha），v 为 0 和 1。 */
export interface BombStrip { tex: BombTex; data: Float32Array; count: number; glow?: number; top?: boolean }
const SVS = `#version 300 es
layout(location=0) in vec4 a;layout(location=1) in float al;
out vec2 vUV;out float vA;
void main(){gl_Position=vec4(a.x/${PLAY_W.toFixed(1)}*2.-1.,1.-a.y/${PLAY_H.toFixed(1)}*2.,0,1);vUV=a.zw;vA=al;}`;
const SFS = `#version 300 es
precision highp float;
in vec2 vUV;in float vA;uniform sampler2D uTex;uniform float uG;out vec4 o;
void main(){vec4 t=texture(uTex,vUV);o=vec4(t.rgb*(1.+uG),t.a)*vA;}`;

export class BombSprites {
  private sprog: Program;
  private svao: WebGLVertexArrayObject;
  private svbo: WebGLBuffer;
  private strips: BombStrip[] = [];
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private tex = new Map<BombTex, WebGLTexture>();
  private list: BombSprite[] = [];
  constructor(readonly gl: GL) {
    this.prog = new Program(gl, VS, FS);
    this.vao = gl.createVertexArray()!;
    this.sprog = new Program(gl, SVS, SFS);
    this.svao = gl.createVertexArray()!; this.svbo = gl.createBuffer()!;
    gl.bindVertexArray(this.svao); gl.bindBuffer(gl.ARRAY_BUFFER, this.svbo);
    gl.bufferData(gl.ARRAY_BUFFER, 4 * 5 * 2 * 64, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 16);
    gl.bindVertexArray(null);
    for (const f of FILES) {
      const img = new Image();
      img.src = `/art/vfx/bomb/${f}.png`;
      img.decode().then(() => {
        const t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const rep = TILED.includes(f) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rep);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.tex.set(f, t);
      }).catch(() => { /* 贴图缺失时不画 */ });
    }
  }
  /** 全部贴图已就位。 */
  get ready(): boolean { return this.tex.size === FILES.length; }
  add(s: BombSprite): void { if (s.alpha > 0.01) this.list.push(s); }
  addStrip(s: BombStrip): void { if (s.count >= 2) this.strips.push(s); }
  clear(): void { this.list.length = 0; this.strips.length = 0; }
  private drawStrips(top: boolean): void {
    const gl = this.gl, keep: BombStrip[] = [];
    gl.bindVertexArray(this.svao); gl.bindBuffer(gl.ARRAY_BUFFER, this.svbo);
    const p = this.sprog.use();
    for (const st of this.strips) {
      if (!!st.top !== top) { keep.push(st); continue; }
      const t = this.tex.get(st.tex);
      if (!t) continue;
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, st.data, 0, st.count * 10);
      p.set('uG', st.glow ?? 0); p.tex('uTex', t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, st.count * 2);
    }
    this.strips = keep;
  }
  draw(time: number, top = false): void {
    const gl = this.gl;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (this.strips.length) this.drawStrips(top);
    if (!this.list.length) return;
    gl.bindVertexArray(this.vao);
    const p = this.prog.use();
    const keep: BombSprite[] = [];
    for (const s of this.list) {
      if (!!s.top !== top) { keep.push(s); continue; }
      const t = this.tex.get(s.tex);
      if (!t) continue;
      const cell = s.cell ?? -1, at = ATLAS[s.tex], atlas = !!at && cell >= 0;
      const cols = at ? at[0] : 1, rows = at ? at[1] : 1;
      const du = atlas ? 1 / cols : 1, dv = atlas ? 1 / rows : 1, u0 = atlas ? (cell % cols) * du : 0, v0 = atlas ? Math.floor(cell / cols) * dv : 0;
      p.set('uW', s.reveal ?? 1, s.reveal === undefined ? 0 : (s.revMode ?? 1), s.xwin ? s.xwin[0] : 0, s.xwin ? s.xwin[1] : 0).set('uClip', s.clip ?? 0).set('uMode', s.tex.startsWith('zhu') ? 1 : 0).set('uP', s.x, s.y, s.w, s.h).set('uQ', s.ax ?? .5, s.ay ?? .5, s.rot ?? 0, s.flip ? 1 : 0).set('uC', u0, v0, du, dv)
        .set('uE', s.alpha, s.glow ?? 0, s.wob ?? 0.012, time).set('uF', s.scroll ?? 0, s.seed ?? 0, u0, du);
      p.tex('uTex', t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    this.list = keep;
  }
}
