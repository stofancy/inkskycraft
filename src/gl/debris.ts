// 实体爆炸碎片：不规则斜切甲片、金属断面、三轴翻滚与透视抛射。
import { PLAY_H, PLAY_W } from '../types';
import type { ExplosionPalette } from '../game/api';
import { Program, Target, FS_TRI_VS, fullscreen, type GL } from './util';

const MAX = 256, STRIDE = 13;
const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aLocal;
layout(location=3) in vec4 aInfo;
out vec3 vNormal;
out vec3 vWorld;
out vec3 vLocal;
flat out vec4 vInfo;
void main() {
  float w = 1050.0 - aPos.z;
  float near = 100.0, far = 4000.0;
  gl_Position = vec4(aPos.x * 2100.0 / ${PLAY_W.toFixed(1)}, aPos.y * 2100.0 / ${PLAY_H.toFixed(1)},
    (far + near) / (far - near) * w - 2.0 * far * near / (far - near), w);
  vNormal = aNormal; vWorld = aPos; vLocal = aLocal; vInfo = aInfo;
}`;
const FS = `#version 300 es
precision highp float;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uAmb;
in vec3 vNormal;
in vec3 vWorld;
in vec3 vLocal;
flat in vec4 vInfo;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main() {
  // 以覆盖率消散，保留每个甲片和断面之间的实体深度。
  if (hash(floor(gl_FragCoord.xy)) > vInfo.z) discard;
  vec3 N = normalize(vNormal), V = normalize(vec3(0.0,0.0,1050.0) - vWorld);
  vec3 L = normalize(uSun), H = normalize(L + V);
  float mat = vInfo.x, age = vInfo.y;
  vec3 base = vec3(0.022,0.028,0.033);
  float rough = 0.34;
  if (mat > 0.5 && mat < 1.5) { base = vec3(0.24,0.085,0.032); rough = 0.4; }
  if (mat > 1.5 && mat < 2.5) { base = vec3(0.52,0.31,0.075); rough = 0.23; }
  if (mat > 2.5) { base = vec3(0.055,0.19,0.17); rough = 0.47; }
  if(vInfo.w > 2.5 && vInfo.w < 3.5) {base=mat > 0.5 ? vec3(0.09,0.47,0.36) : vec3(0.015,0.12,0.09);rough=0.12;}
  if(vInfo.w > 3.5) {base=mat > 0.5 ? vec3(0.48,0.25,0.055) : vec3(0.085,0.02,0.15);rough=0.27;}
  float grain = hash(floor(vLocal.xy * 4.0));
  float scratch = pow(0.5 + 0.5 * sin(vLocal.x * 13.7 + sin(vLocal.y * 0.6)), 24.0);
  base *= 0.74 + grain * 0.4;
  base = mix(base, vec3(0.45,0.27,0.1), scratch * 0.15);
  float nl = max(dot(N,L),0.0), nv = max(dot(N,V),0.0);
  float nh = max(dot(N,H),0.0);
  float fres = pow(1.0-nv,5.0);
  float spec = pow(nh, mix(145.0,24.0,rough)) * (2.2 + 4.5 * (1.0-rough));
  vec3 specCol = mat < 0.5 ? vec3(0.52,0.62,0.68) : mix(base,vec3(1.0,0.9,0.63),0.4);
  vec3 lit = base * (uAmb * (0.55 + 0.4 * max(N.y,0.0)) + uSunCol * nl * 1.8);
  lit += specCol * uSunCol * spec + specCol * fres * 0.16;
  // 新鲜断面有短暂的赤金余热；漆面冷色天光保持暗部层次。
  float cut = step(0.5,mat) * (1.0-step(2.5,mat));
  vec3 heat = vInfo.w > 1.5 ? vec3(2.8,0.49,0.065) : vec3(1.7,0.32,0.045);
  if(vInfo.w > 2.5) heat=vInfo.w < 3.5 ? vec3(0.08,1.3,0.8) : vec3(1.0,0.13,1.7);
  lit += heat * exp(-age * 4.5) * (0.07 + cut * 0.35);
  lit += vec3(0.045,0.08,0.11) * pow(1.0-nv,2.0);
  o = vec4(lit,1.0);
}`;
const COMP = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 o;
void main() { o = texture(uTex,vUv); }`;

type V3 = [number, number, number];
interface Piece {
  t0: number; life: number; origin: V3; velocity: V3;
  rotation: V3; spin: V3; mesh: Float32Array; palette: number;
}

/** 封闭三角楔、狭长裂片和破甲片：窄倒角、厚断面及各自的真实面法线。 */
function mesh(rnd: () => number, size: number, thickness: number, material: number): Float32Array {
  const shape = rnd(), n = shape < 0.45 ? 3 : shape < 0.88 ? 4 : 5;
  const rings: V3[][] = [[], [], [], []];
  const stretch = n === 5 ? 0.42 + rnd() * 0.3 : 0.18 + rnd() * 0.3;
  const tilt = (rnd() - 0.5) * thickness * 0.9;
  // 局部镶金只落在一个窄倒角，漆面与铜质断面承担其余体块。
  const giltEdge = rnd() < 0.38 ? Math.floor(rnd() * n) : -1;
  for (let i = 0; i < n; i++) {
    const angle = i / n * Math.PI * 2 + (rnd() - 0.5) * 0.32;
    const radius = size * (0.65 + rnd() * 0.48);
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * stretch;
    rings[0].push([x * 0.96, y * 0.96, thickness * 0.5 + x / size * tilt]);
    rings[1].push([x, y, thickness * 0.27 + x / size * tilt]);
    rings[2].push([x * 0.96, y * 0.96, -thickness * 0.32]);
    rings[3].push([x * 0.94, y * 0.94, -thickness * 0.5]);
  }
  const data: number[] = [];
  const tri = (a: V3, b: V3, c: V3, mat: number) => {
    const ab = b.map((v,i) => v-a[i]), ac = c.map((v,i) => v-a[i]);
    const nx = ab[1]*ac[2]-ab[2]*ac[1], ny = ab[2]*ac[0]-ab[0]*ac[2], nz = ab[0]*ac[1]-ab[1]*ac[0];
    const d = Math.hypot(nx,ny,nz);
    for (const v of [a,b,c]) data.push(...v,nx/d,ny/d,nz/d,mat);
  };
  const top: V3 = [0,0,thickness*0.5], bottom: V3 = [0,0,-thickness*0.5];
  for (let i=0;i<n;i++) {
    const j=(i+1)%n;
    tri(top,rings[0][i],rings[0][j],material);
    tri(bottom,rings[3][j],rings[3][i],0);
    for (let r=0;r<3;r++) {
      const mat = r === 0 && i === giltEdge ? 2 : r === 2 ? 0 : 1;
      tri(rings[r][i],rings[r+1][i],rings[r+1][j],mat);
      tri(rings[r][i],rings[r+1][j],rings[r][j],mat);
    }
  }
  return new Float32Array(data);
}

export class DebrisSystem {
  sun: V3 = [-0.78,0.12,0.48];
  sunCol: V3 = [1.0,0.98,0.92];
  amb: V3 = [0.62,0.64,0.68];
  private prog: Program;
  private comp: Program;
  private target: Target;
  private depth: WebGLRenderbuffer;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private pieces: Piece[] = [];
  private data = new Float32Array(MAX * 120 * STRIDE);

  constructor(readonly gl: GL) {
    this.prog = new Program(gl,VS,FS);
    this.comp = new Program(gl,FS_TRI_VS,COMP);
    this.target = new Target(gl,8,8,'rgba16f');
    this.depth = gl.createRenderbuffer()!;
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);
    const sizes = [3,3,3,4], offsets = [0,3,6,9];
    for (let i=0;i<4;i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i,sizes[i],gl.FLOAT,false,STRIDE*4,offsets[i]*4);
    }
    gl.bindVertexArray(null);
  }

  /** scale=1 为普通敌机，按 sqrt(k) 增长；count 为实体甲片数量。 */
  spawn(time: number, x: number, y: number, scale: number, count: number, seed: number, palette: ExplosionPalette): void {
    let state = (Math.floor(seed * 4294967296) ^ 0x91a7) >>> 0;
    const rnd = () => { state = (Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296; };
    const s = Math.max(0.25,Math.min(5,scale)), amount = Math.max(0,Math.min(MAX,Math.round(count)));
    for (let i=0;i<amount;i++) {
      const large = s > 2 && i < Math.min(2,amount);
      const tier = large ? 1.65 : i < amount*0.35 ? 1.05 : 0.62;
      const size = (3.5+rnd()*3.5)*Math.pow(s,0.75)*tier;
      const angle = rnd()*Math.PI*2, speed = (180+rnd()*420)*Math.sqrt(s) / Math.sqrt(tier);
      const material = rnd() < 0.24 ? 1 : palette === 'neon' && rnd() < 0.16 ? 3 : 0;
      this.pieces.push({t0:time,life:1.6+rnd()*1.3,origin:[x-PLAY_W/2,PLAY_H/2-y,(rnd()-0.5)*18*s],
        velocity:[Math.cos(angle)*speed,Math.sin(angle)*speed,(rnd()-0.35)*240*Math.sqrt(s)],
        rotation:[rnd()*6.28,rnd()*6.28,rnd()*6.28],spin:[(rnd()-0.5)*11,(rnd()-0.5)*13,(rnd()-0.5)*9],
        mesh:mesh(rnd,size,size*(large ? 0.18+rnd()*0.12 : 0.06+rnd()*0.12),material),
        palette:palette === 'cyan' ? 3 : palette === 'violet' ? 4 : palette === 'fire' ? 2 : palette === 'ink' ? 0 : 1});
    }
    if(this.pieces.length>MAX) this.pieces.splice(0,this.pieces.length-MAX);
  }

  clear(): void { this.pieces.length=0; }

  /** 内部深度只控制碎块互相遮挡；结束时重新绑定 scene 并恢复深度、剔除与混合状态。 */
  draw(time: number, scene: Target): void {
    this.pieces=this.pieces.filter(p=>time-p.t0<p.life && time-p.t0>-0.5);
    if(!this.pieces.length) return;
    let offset=0;
    for(const p of this.pieces) {
      const age=time-p.t0;
      if(age<0) continue;
      const drag=(1-Math.exp(-1.05*age))/1.05;
      const center: V3=[p.origin[0]+p.velocity[0]*drag,p.origin[1]+p.velocity[1]*drag-92*age*age,p.origin[2]+p.velocity[2]*drag-36*age*age];
      const rx=p.rotation[0]+p.spin[0]*age, ry=p.rotation[1]+p.spin[1]*age, rz=p.rotation[2]+p.spin[2]*age;
      const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
      const m=[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx,sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx,-sy,cy*sx,cy*cx];
      const fade=Math.min(1,Math.max(0,(p.life-age)/0.5));
      for(let i=0;i<p.mesh.length;i+=7) {
        const x=p.mesh[i],y=p.mesh[i+1],z=p.mesh[i+2],nx=p.mesh[i+3],ny=p.mesh[i+4],nz=p.mesh[i+5];
        this.data[offset++]=center[0]+m[0]*x+m[1]*y+m[2]*z;
        this.data[offset++]=center[1]+m[3]*x+m[4]*y+m[5]*z;
        this.data[offset++]=center[2]+m[6]*x+m[7]*y+m[8]*z;
        this.data[offset++]=m[0]*nx+m[1]*ny+m[2]*nz;
        this.data[offset++]=m[3]*nx+m[4]*ny+m[5]*nz;
        this.data[offset++]=m[6]*nx+m[7]*ny+m[8]*nz;
        this.data[offset++]=x;this.data[offset++]=y;this.data[offset++]=z;
        this.data[offset++]=p.mesh[i+6];this.data[offset++]=age;this.data[offset++]=fade;this.data[offset++]=p.palette;
      }
    }
    if(!offset) return;
    const gl=this.gl, depthTest=gl.isEnabled(gl.DEPTH_TEST),cull=gl.isEnabled(gl.CULL_FACE),blend=gl.isEnabled(gl.BLEND);
    const depthMask=gl.getParameter(gl.DEPTH_WRITEMASK) as boolean,depthFunc=gl.getParameter(gl.DEPTH_FUNC) as number;
    const clearDepth=gl.getParameter(gl.DEPTH_CLEAR_VALUE) as number;
    const bs=gl.getParameter(gl.BLEND_SRC_RGB),bd=gl.getParameter(gl.BLEND_DST_RGB),as=gl.getParameter(gl.BLEND_SRC_ALPHA),ad=gl.getParameter(gl.BLEND_DST_ALPHA);
    const eq=gl.getParameter(gl.BLEND_EQUATION_RGB),aeq=gl.getParameter(gl.BLEND_EQUATION_ALPHA);
    if(this.target.w!==scene.w || this.target.h!==scene.h) {
      this.target.resize(scene.w,scene.h);
      gl.bindRenderbuffer(gl.RENDERBUFFER,this.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,scene.w,scene.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.target.fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.depth);
      gl.bindRenderbuffer(gl.RENDERBUFFER,null);
    }
    this.target.bind([0,0,0,0]);
    gl.depthMask(true);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
    this.prog.use().set('uSun',this.sun).set('uSunCol',this.sunCol).set('uAmb',this.amb);
    gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data,0,offset);
    gl.drawArrays(gl.TRIANGLES,0,offset/STRIDE);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);
    scene.bind();gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    this.comp.use().tex('uTex',this.target.tex);fullscreen(gl);
    gl.bindVertexArray(null);
    gl.depthMask(depthMask);gl.depthFunc(depthFunc);gl.clearDepth(clearDepth);
    if(depthTest) gl.enable(gl.DEPTH_TEST);else gl.disable(gl.DEPTH_TEST);
    if(cull) gl.enable(gl.CULL_FACE);else gl.disable(gl.CULL_FACE);
    gl.blendFuncSeparate(bs,bd,as,ad);gl.blendEquationSeparate(eq,aeq);
    if(blend) gl.enable(gl.BLEND);else gl.disable(gl.BLEND);
    scene.bind();
  }
}
