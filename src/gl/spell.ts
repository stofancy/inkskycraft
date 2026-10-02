// 泼墨施法演出的屏幕层：墨色暗角、字（火焰遮罩）、立绘笔触与招式名、火墙。
// 全部程序化绘制。字形遮罩暂用系统字体；public/art/lettering/mantra/ 下出现 zhu/que/li/huo/chi.png 后自动换上毛笔字。
import { PLAY_H, PLAY_W } from '../types';
import { BombSprites } from './bomb-sprites';
import { FS_TRI_VS, Program, fullscreen, type GL } from './util';

/** 三色招式：0 朱、1 青、2 紫。字形遮罩、招式名、边光色、暗底色。 */
export const SPELL_THEMES = [
  { text: '朱雀离火敕', files: ['zhu', 'que', 'li', 'huo', 'chi'], title: '离火·朱雀', rim: [2.3, .38, .07], ink: [.018, .013, .012], grad: ['#fff6d8', '#ffd067', '#ff7a2a'], edge: '#6a0f08' },
  { text: '青龙坎水敕', files: ['qing', 'long', 'kan', 'shui', 'chi'], title: '坎水·青龙', rim: [.2, 1.5, 2.0], ink: [.006, .02, .03], grad: ['#f0ffff', '#8fe8ff', '#2aa6d8'], edge: '#06324a' },
  { text: '紫微震雷敕', files: ['zi', 'wei', 'zhen', 'lei', 'chi'], title: '震雷·紫微', rim: [1.4, .5, 2.6], ink: [.02, .01, .035], grad: ['#fbf4ff', '#d3a8ff', '#8a4de0'], edge: '#2a0f52' },
] as const;
/** 立绘笔触的位置：中心线、半高、招式名所在的横向范围。 */
export const STROKE = { cy: 400, half: 92, titleX0: 470, titleX1: 892, faceX: 250 };

const COMMON = `
float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
uniform float uTheme;
vec3 ramp(float h){
  if(uTheme>1.5){
    vec3 c=mix(vec3(.04,.012,.08),vec3(.7,.2,1.5),smoothstep(.06,.45,h));
    c=mix(c,vec3(1.9,1.0,2.9),smoothstep(.42,.75,h));
    return mix(c,vec3(3.2,2.9,3.4),smoothstep(.8,1.05,h));
  }
  if(uTheme>.5){
    vec3 c=mix(vec3(.01,.07,.11),vec3(.04,.62,.95),smoothstep(.06,.45,h));
    c=mix(c,vec3(.4,1.6,1.9),smoothstep(.4,.75,h));
    return mix(c,vec3(2.4,3.0,3.1),smoothstep(.8,1.05,h));
  }
  vec3 c=mix(vec3(.6,.045,.01),vec3(1.9,.3,.03),smoothstep(.08,.4,h));
  c=mix(vec3(.05,.008,.006),c,smoothstep(0.,.16,h));
  c=mix(c,vec3(2.6,1.1,.16),smoothstep(.3,.62,h));
  c=mix(c,vec3(3.,2.3,.9),smoothstep(.6,.85,h));
  return mix(c,vec3(3.3,3.1,2.7),smoothstep(.85,1.05,h));
}
vec3 darkc(){return uTheme>1.5?vec3(.03,.008,.06):uTheme>.5?vec3(.004,.028,.045):vec3(.055,.007,.004);}
`;

const GLYPH_VS = `#version 300 es
uniform vec4 uA[8];uniform vec4 uB[8];uniform vec4 uC[8];
out vec2 vUv;flat out vec4 vA;flat out vec4 vB;flat out vec4 vC;
void main(){
  vec2 corner=vec2(float(gl_VertexID&1),float(gl_VertexID>>1))*2.-1.;
  vec4 A=uA[gl_InstanceID],B=uB[gl_InstanceID];
  vec2 q=corner*A.z*.75;
  q+=B.xy*dot(q,B.xy)*(B.z-1.);
  vec2 p=A.xy+q;
  gl_Position=vec4(p.x/${PLAY_W.toFixed(1)}*2.-1.,1.-p.y/${PLAY_H.toFixed(1)}*2.,0,1);
  vUv=corner*.5+.5;vA=A;vB=B;vC=uC[gl_InstanceID];
}`;

const GLYPH_FS = `#version 300 es
precision highp float;
uniform sampler2D uMask;uniform float uTime;
in vec2 vUv;flat in vec4 vA;flat in vec4 vB;flat in vec4 vC;out vec4 o;
${COMMON}
float M(vec2 g){if(g.x<0.||g.x>1.||g.y<0.||g.y>1.)return 0.;return texture(uMask,vec2((vA.w+g.x)/5.,g.y)).a;}
void main(){
  vec2 g=(vUv-.5)*1.5+.5;
  float seed=vC.w,T=uTime;
  float body=M(g);
  float r1=.035;
  float b=body+M(g+vec2(r1,0))+M(g-vec2(r1,0))+M(g+vec2(0,r1))+M(g-vec2(0,r1))+M(g+vec2(r1,r1)*.7)+M(g-vec2(r1,r1)*.7)+M(g+vec2(r1,-r1)*.7)+M(g-vec2(r1,-r1)*.7);
  b/=9.;
  float r2=.1;
  float gw=(M(g+vec2(r2,0))+M(g-vec2(r2,0))+M(g+vec2(0,r2))+M(g-vec2(0,r2))+M(g+vec2(r2,r2)*.7)+M(g-vec2(r2,r2)*.7)+M(g+vec2(r2,-r2)*.7)+M(g-vec2(r2,-r2)*.7)+body*2.)/10.;
  float n1=fbm(vec2(g.x*4.,g.y*4.-T*2.8)+seed*7.);
  float n2=fbm(vec2(g.x*8.+4.,g.y*8.-T*5.)+seed*3.);
  float lick=0.;
  for(int i=1;i<=5;i++){float h=float(i)*.03*(.5+1.5*n1);lick=max(lick,M(g+vec2((n2-.5)*.05,h))*(1.-float(i)*.17));}
  float flame=max(body,lick*smoothstep(.2,.65,n2+.2+vC.x*.2));
  float heat=clamp(pow(b,2.2)*.95+(n2-.5)*.5+vC.x*.08,0.,1.1);
  float flameF=flame;
  if(uTheme>.5&&uTheme<1.5){
    // 水光：沿笔画横向流动的焦散纹，边缘深青、中心亮青白
    float w1=fbm(vec2(g.x*5.-T*2.2,g.y*6.+T*.9)+seed*5.),w2=fbm(vec2(g.x*11.+T*3.,g.y*9.-T*1.3)+seed);
    float caus=pow(smoothstep(.45,.8,w1*.65+w2*.45),1.6);
    heat=clamp(pow(b,2.0)*.7+caus*.55+vC.x*.1,0.,1.1);
    flameF=body;
  } else if(uTheme>1.5){
    // 电光：深紫笔画里跳动的亮电弧
    float fq=floor(T*18.);
    float e1=fbm(g*7.+vec2(fq*3.1,fq*1.7)+seed*4.);
    float arc=exp(-pow((e1-.5)*13.,2.));
    float e2=fbm(g*13.+vec2(fq*5.3,-fq*2.1)+seed);
    arc=max(arc,exp(-pow((e2-.5)*17.,2.))*.7);
    heat=clamp(.16+pow(b,2.)*.28+arc*(.55+.5*b)+vC.x*.12,0.,1.15);
    flameF=body;
  }
  heat=mix(heat*.55,heat,body);
  vec3 col=ramp(heat);
  {
    // 字身是深色浓墨（朱：深绛红，青：深墨蓝，紫：深墨紫），边缘与笔画外的光才是亮色
    float inner=smoothstep(.4,.85,b);
    vec3 edge=uTheme<.5?vec3(1.0,.16,.05):uTheme<1.5?vec3(.25,.85,1.2):vec3(.75,.4,1.5);
    vec3 deep=uTheme<.5?vec3(.3,.025,.03):uTheme<1.5?vec3(.015,.06,.2):vec3(.1,.025,.2);
    vec3 crim=mix(edge,deep,inner)*(1.+heat*.7);
    col=mix(col,crim,smoothstep(.2,.7,b)*body);
  }
  col=mix(col,vec3(3.4,3.0,2.4)*mix(vec3(1.),vec3(.8,.9,1.),step(.5,uTheme)),vC.y);
  float a=flameF*smoothstep(vC.z,vC.z+.25,n2*1.1+.1);
  float dk=max(smoothstep(.06,.3,b),smoothstep(.04,.4,gw)*.9);
  vec3 dark=darkc();
  float al=vB.w;
  o=vec4((col*a+dark*dk*(1.-a))*al,(a+dk*(1.-a))*al);
}`;

const QUAD_VS = `#version 300 es
uniform vec4 uRect;out vec2 vW;
void main(){
  vec2 c=vec2(float(gl_VertexID&1),float(gl_VertexID>>1));
  vec2 p=mix(uRect.xy,uRect.zw,c);vW=p;
  gl_Position=vec4(p.x/${PLAY_W.toFixed(1)}*2.-1.,1.-p.y/${PLAY_H.toFixed(1)}*2.,0,1);
}`;

const STROKE_FS = `#version 300 es
precision highp float;
uniform vec4 uS;      // 笔锋 x、退场 0..1、整体透明、立绘平移
uniform vec4 uBand;   // 中心 y、半高、脸中心 x、立绘缩放
uniform vec4 uTitle;  // 招式名矩形
uniform float uWide;uniform sampler2D uPortrait;uniform sampler2D uTitleTex;uniform float uTime;uniform vec3 uRim;uniform vec3 uInk;
in vec2 vW;out vec4 o;
${COMMON}
vec3 lin(vec4 t){return pow(t.rgb/max(t.a,.001),vec3(2.2));}
void main(){
  vec2 p=vW;
  float ex=uS.y;
  p.y-=ex*ex*260.*(.35+noise(vec2(p.x*.03,3.)));
  float dy=p.y-uBand.x;
  float low=fbm(vec2(p.x*.006,2.3));
  float halfH=uBand.y*(.78+.5*low);
  float fib=noise(vec2(p.x*.018,p.y*.7));
  float fib2=noise(vec2(p.x*.06,p.y*.4+9.));
  float d=halfH-abs(dy)+(fib-.5)*30.+(fib2-.5)*10.;
  d-=(1.-smoothstep(-40.,130.,p.x))*halfH*.9;
  float hn=(fib-.5)*210.+(fib2-.5)*40.;
  float hd=uS.x-p.x+hn;
  float painted=smoothstep(-4.,10.,hd);
  float dry=smoothstep(0.,170.,hd);
  float gap=smoothstep(.34,.5,noise(vec2(p.x*.03,p.y*.9)));
  float cov=smoothstep(-.5,2.5,d)*painted*mix(gap,1.,dry);
  float thr=.2+ex*.65;float keep=smoothstep(thr-.06,thr,fbm(p*.03+7.));
  cov*=keep;
  float dd=min(d,hd);
  float rim=exp(-dd*dd/90.)*step(-14.,dd)*keep;
  vec3 ink=uInk;
  vec2 pu=vec2((p.x-(uBand.z-285.*uBand.w+uS.w))/uBand.w/512.,(195.+(p.y-uBand.x)/uBand.w)/512.);
  float pa=0.;vec3 pc=vec3(0.);
  if(uWide>.5){pu=vec2((p.x+50.)/950.,(p.y-(uBand.x-158.5))/317.);}
  if(pu.x>0.&&pu.x<1.&&pu.y>0.&&pu.y<1.){vec4 t=texture(uPortrait,pu);pa=t.a;pc=lin(t)*(uWide>.5?1.:1.15);}
  vec3 col=mix(ink,pc,pa);
  vec2 tu=(p-uTitle.xy)/(uTitle.zw-uTitle.xy);
  if(tu.x>0.&&tu.x<1.&&tu.y>0.&&tu.y<1.){vec4 t=texture(uTitleTex,tu);col=mix(col,lin(t)*1.5,t.a);}
  float al=uS.z*(1.-ex*.5);
  o=vec4((col*cov+uRim*rim*.8)*al,cov*al);
}`;

const WALL_FS = `#version 300 es
precision highp float;
uniform vec4 uWall;   // 前沿 y、衰减长度、整体透明、左右横扫相位（青）
uniform float uTime;
in vec2 vW;out vec4 o;
${COMMON}
void main(){
  bool water=uTheme>.5&&uTheme<1.5;
  float tilt=water?sin(uWall.w)*.1*(vW.x-450.):0.;
  float d0=vW.y-uWall.x-tilt;
  if(d0<-130.||d0>uWall.y*5.){o=vec4(0.);return;}
  float n,m;
  if(water){n=fbm(vec2(vW.x*.014-uTime*2.6,vW.y*.02+uTime*1.1));m=fbm(vec2(vW.x*.05-uTime*5.,vW.y*.04));}
  else{n=fbm(vec2(vW.x*.028,vW.y*.011+uTime*3.));m=fbm(vec2(vW.x*.09,vW.y*.02+uTime*5.));}
  float d=d0+(n-.5)*60.;
  float I=exp(-max(d,0.)/uWall.y)*smoothstep(-40.,8.,d);
  float f=I*(.45+n*.9+(m-.5)*.5);
  float a=smoothstep(.22,.6,f)*uWall.z;
  float dk=smoothstep(.04,.45,f)*.8*uWall.z;
  vec3 col=ramp(min(f*1.05,.9));
  if(water){
    float foam=smoothstep(-18.,4.,d)*(1.-smoothstep(4.,34.,d))*(.5+.8*m);
    col=mix(col,vec3(2.2,3.0,3.2),clamp(foam,0.,1.)*.85);
    a=max(a,clamp(foam,0.,1.)*.8*uWall.z);
  }
  o=vec4(col*a+darkc()*dk*(1.-a),a+dk*(1.-a));
}`;

const VIGNETTE_FS = `#version 300 es
precision highp float;
uniform float uAmt;in vec2 vUv;out vec4 o;
void main(){
  float r=length((vUv-.5)*vec2(1.,.82))*1.6;
  float a=uAmt*smoothstep(.4,1.0,r);
  o=vec4(vec3(.012,.008,.007)*a,a);
}`;

export interface GlyphDraw { cell: number; x: number; y: number; size: number; dx: number; dy: number; stretch: number; alpha: number; heat: number; flash: number; spread: number }
export interface StrokeDraw { head: number; exit: number; alpha: number; slide: number }
export interface WallDraw { head: number; len: number; alpha: number; sweep?: number }
export interface TaijiDraw { x: number; y: number; r: number; rot: number; alpha: number }

const TAIJI_FS = `#version 300 es
precision highp float;
uniform vec4 uT; // x y r rot
uniform vec2 uA; // alpha time
in vec2 vW;out vec4 o;
void main(){
  vec2 p=vW-uT.xy;float c=cos(uT.w),s=sin(uT.w);p=vec2(p.x*c+p.y*s,-p.x*s+p.y*c);
  float R=uT.z,r=length(p);
  if(r>R*1.5){o=vec4(0.);return;}
  float q=r/R;
  // 太极：右半白、左半深紫，上下各一个小半圆互换，各带一个对色小点
  float yang=p.x>0.?1.:0.;
  float upper=length(p-vec2(0.,-R*.5))-R*.5, lower=length(p-vec2(0.,R*.5))-R*.5;
  float v=yang;
  if(upper<0.)v=1.;
  if(lower<0.)v=0.;
  if(length(p-vec2(0.,-R*.5))<R*.14)v=0.;
  if(length(p-vec2(0.,R*.5))<R*.14)v=1.;
  float body=1.-smoothstep(R-1.5,R,r);
  vec3 white=vec3(1.7,1.55,2.1),dark=vec3(.05,.012,.1);
  vec3 col=mix(dark,white,v);
  float rim=exp(-pow((r-R)/(R*.06),2.));
  float glow=exp(-max(r-R,0.)/(R*.28))*(1.-body);
  vec3 em=vec3(1.5,.55,2.8)*(rim*1.2+glow*.7);
  float al=uA.x;
  o=vec4((col*body+em)*al,body*al);
}`;

export class SpellLayer {
  vignette = 0;
  /** 0 朱、1 青、2 紫：由 Mantra 在施法开始时设定。 */
  theme = 0;
  glyphs: GlyphDraw[] = [];
  stroke: StrokeDraw | null = null;
  wall: WallDraw | null = null;
  taiji: TaijiDraw | null = null;
  readonly sprites: BombSprites;
  private progGlyph: Program;
  private progStroke: Program;
  private progWall: Program;
  private progVig: Program;
  private progTaiji: Program;
  private vao: WebGLVertexArrayObject;
  private portraitTex: WebGLTexture;
  /** 整幅横幅立绘（1536x512）：ult-zhu/blue/purple.png，缺文件时回退到旧立绘。 */
  private ultTex: WebGLTexture[] = [];
  private ultOk = [false, false, false];
  private titleTex: WebGLTexture[] = [];
  private masks: { canvas: HTMLCanvasElement; tex: WebGLTexture; loaded: Set<number>; lastTry: number }[] = [];
  private A = new Float32Array(32);
  private B = new Float32Array(32);
  private C = new Float32Array(32);
  /** 当前字形遮罩来源：每字 'font' 或 'brush'（按主题 0..2 各 5 字）。 */
  readonly source: string[][] = SPELL_THEMES.map(t => t.files.map(() => 'font'));

  constructor(readonly gl: GL) {
    this.sprites = new BombSprites(gl);
    this.progGlyph = new Program(gl, GLYPH_VS, GLYPH_FS);
    this.progStroke = new Program(gl, QUAD_VS, STROKE_FS);
    this.progWall = new Program(gl, QUAD_VS, WALL_FS);
    this.progVig = new Program(gl, FS_TRI_VS, VIGNETTE_FS);
    this.progTaiji = new Program(gl, QUAD_VS, TAIJI_FS);
    this.vao = gl.createVertexArray()!;
    this.portraitTex = gl.createTexture()!;
    SPELL_THEMES.forEach((_, i) => {
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 256;
      const m = { canvas, tex: gl.createTexture()!, loaded: new Set<number>(), lastTry: -1e9 };
      this.masks.push(m);
      this.paintFontMasks(i);
      this.upload(m.tex, canvas, true);
      const tt = gl.createTexture()!; this.titleTex.push(tt); this.paintTitle(i, tt);
    });
    // 立绘异步加载，未到时画 1x1 透明。
    this.upload(this.portraitTex, null, false);
    const img = new Image();
    img.src = '/art/portraits/xiaoman/smug.png';
    img.decode().then(() => this.upload(this.portraitTex, img, false)).catch((e) => console.warn('立绘加载失败', e));
    ['zhu', 'blue', 'purple'].forEach((n, i) => {
      const t = gl.createTexture()!; this.ultTex.push(t); this.upload(t, null, false);
      const im = new Image(); im.src = `/art/portraits/xiaoman/ult-${n}.png`;
      im.decode().then(() => { this.upload(t, im, true); this.ultOk[i] = true; }).catch(() => { /* 缺图沿用旧立绘 */ });
    });
    this.refreshBrushMasks();
  }

  private upload(tex: WebGLTexture, src: TexImageSource | null, mip: boolean): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    if (mip && src) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip && src ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private paintFontMasks(t: number): void {
    const m = this.masks[t], ctx = m.canvas.getContext('2d')!, text = SPELL_THEMES[t].text;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 214px "Noto Serif CJK SC","Songti SC","InkskyFangsong",serif';
    for (let i = 0; i < 5; i++) if (!m.loaded.has(i)) {
      ctx.clearRect(i * 256, 0, 256, 256);
      ctx.fillText(text[i], i * 256 + 128, 136);
    }
  }

  private paintTitle(t: number, tex: WebGLTexture): void {
    const th = SPELL_THEMES[t];
    const c = document.createElement('canvas'); c.width = 600; c.height = 200;
    const ctx = c.getContext('2d')!;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 112px "Noto Serif CJK SC","Songti SC","InkskyFangsong",serif';
    ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = th.edge;
    ctx.strokeText(th.title, 300, 104);
    const g = ctx.createLinearGradient(0, 40, 0, 160);
    g.addColorStop(0, th.grad[0]); g.addColorStop(.55, th.grad[1]); g.addColorStop(1, th.grad[2]);
    ctx.fillStyle = g; ctx.fillText(th.title, 300, 104);
    this.upload(tex, c, false);
  }

  /** 毛笔字贴图出现后换上；每 20 秒最多重试一次。 */
  refreshBrushMasks(): void {
    const now = performance.now();
    SPELL_THEMES.forEach((th, t) => {
      const m = this.masks[t];
      if (m.loaded.size === 5 || now - m.lastTry < 20000) return;
      m.lastTry = now;
      th.files.forEach(async (name, i) => {
        if (m.loaded.has(i)) return;
        try {
          const img = new Image();
          img.src = `/art/lettering/mantra/${name}.png`;
          await img.decode();
          m.loaded.add(i); this.source[t][i] = 'brush';
          const ctx = m.canvas.getContext('2d')!;
          ctx.clearRect(i * 256, 0, 256, 256);
          ctx.drawImage(img, i * 256, 0, 256, 256);
          this.upload(m.tex, m.canvas, true);
        } catch { /* 文件还没有，沿用系统字体遮罩 */ }
      });
    });
  }

  addGlyph(g: GlyphDraw): void { if (this.glyphs.length < 8) this.glyphs.push(g); }

  drawBack(time: number): void {
    const gl = this.gl;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (this.vignette > 0.002) { this.progVig.use().set('uAmt', this.vignette); fullscreen(gl); }
    if (this.wall) {
      const w = this.wall;
      this.progWall.use().set('uRect', 0, w.head - 80 - (this.theme === 1 ? 170 : 0), PLAY_W, PLAY_H).set('uWall', w.head, w.len, w.alpha, w.sweep ?? 0).set('uTime', time).set('uTheme', this.theme);
      gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    this.wall = null;
    this.vignette = 0;
  }

  drawGlyphs(time: number): void {
    const gl = this.gl;
    this.sprites.draw(time);
    if (this.taiji) {
      const t = this.taiji, R = t.r * 1.5;
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.progTaiji.use().set('uRect', t.x - R, t.y - R, t.x + R, t.y + R).set('uT', t.x, t.y, t.r, t.rot).set('uA', t.alpha, time);
      gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.taiji = null;
    }
    const n = this.glyphs.length;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const g = this.glyphs[i];
      this.A.set([g.x, g.y, g.size, g.cell], i * 4);
      this.B.set([g.dx, g.dy, g.stretch, g.alpha], i * 4);
      this.C.set([g.heat, g.flash, g.spread, g.cell * 1.7 + 0.3], i * 4);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.progGlyph.use().set('uA', this.A).set('uB', this.B).set('uC', this.C).set('uTime', time).set('uTheme', this.theme).tex('uMask', this.masks[this.theme].tex);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    this.glyphs.length = 0;
  }

  drawTop(time: number): void {
    this.sprites.draw(time, true);
    const s = this.stroke;
    if (!s) return;
    const gl = this.gl, B = STROKE, th = SPELL_THEMES[this.theme];
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.progStroke.use()
      .set('uRect', 0, B.cy - 190, PLAY_W, B.cy + 330)
      .set('uS', s.head, s.exit, s.alpha, s.slide).set('uBand', B.cy, B.half, B.faceX, 1.2)
      .set('uTitle', B.titleX0, B.cy - 70, B.titleX1, B.cy + 70).set('uTime', time)
      .set('uWide', this.ultOk[this.theme] ? 1 : 0).set('uRim', th.rim[0], th.rim[1], th.rim[2]).set('uInk', th.ink[0], th.ink[1], th.ink[2]).set('uTheme', this.theme)
      .tex('uPortrait', this.ultOk[this.theme] ? this.ultTex[this.theme] : this.portraitTex).tex('uTitleTex', this.titleTex[this.theme]);
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.stroke = null;
  }

  clear(): void { this.vignette = 0; this.glyphs.length = 0; this.stroke = null; this.wall = null; this.taiji = null; this.sprites.clear(); }
}
