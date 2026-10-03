// 朱弹和敌弹采用预乘实体色，亮芯局部加色。
import { PLAY_H, PLAY_W } from '../types';
import { Program, type GL } from './util';

export const BULLET_SHAPES = ['orb', 'rice', 'needle', 'star', 'ring', 'petal', 'big', 'crystal', 'flame'] as const;
export type BulletShape = (typeof BULLET_SHAPES)[number];

const VS = `#version 300 es
layout(location=0) in vec4 aA;  // x, y, angle, size
layout(location=1) in vec4 aB;  // shape, r, g, b
layout(location=2) in vec4 aC;  // age, alpha, seed, -
uniform vec2 uView;
out vec2 vP;
flat out vec4 vB;
flat out vec4 vC;
flat out float vTrail;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  float spawn = clamp(aA.w > 0.0 ? aC.x / 0.14 : 1.0, 0.0, 1.0);
  // 出生放大回弹：先胀到 1.8 倍，过冲收到 0.9 倍，再回到 1
  float grow = 1.0 + 0.8 * exp(-aC.x * 16.0) * cos(aC.x * 26.0);
  int sh = int(aB.x + 0.5) % 16;
  bool lng = sh == 1 || sh == 2 || sh == 5 || sh == 7 || sh == 8;
  float ext = (lng ? 3.4 : 3.0) * max(grow, 1.0);       // 四边形半径 = size * ext，留出光晕与符纹环
  vec2 unit = corner * ext;
  vec2 local = unit * aA.w;
  float c = cos(aA.z), s = sin(aA.z);
  vec2 p = aA.xy + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vP = unit;                      // 以 size 为单位的局部坐标，+x 为飞行方向
  vB = aB;
  vC = vec4(aC.x, aC.y * mix(0.25, 1.0, spawn), aC.z, grow);
  vTrail = aC.w;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vP;
flat in vec4 vB;
flat in vec4 vC;
flat in float vTrail;
uniform float uTime;
uniform float uIntensity;
out vec4 o;
float diamond(vec2 p,vec2 size) { return (abs(p.x)/size.x+abs(p.y)/size.y-1.0)*min(size.x,size.y); }
float star(vec2 p) {
  float a=atan(p.y,p.x),r=length(p);
  return r-(.78+.28*cos(a*5.0));
}
void main() {
  int shape = int(vB.x+.5);
  bool enemy = shape>=16;
  if(enemy)shape-=16;
  vec2 p=vP/(enemy?vC.w:1.0);
  vec3 col=vB.yzw;
  if(!enemy && shape==9) {
    // 短梭形亮芯与橙/青/紫软辉；alpha=0，在现有预乘混合中纯加色。
    vec2 q=vec2(p.x/2.4,p.y/.65);
    float body=exp(-dot(q,q)*2.4);
    float core=exp(-pow(p.x/2.0,2.0)*3.2-p.y*p.y*32.0);
    float halo=exp(-dot(q,q)*.85)*smoothstep(3.0,2.2,length(p));
    float tail=exp(-pow((p.x+1.7)/.8,2.0)*2.0-p.y*p.y*13.0)*.28;
    o=vec4((col*(body*.9+halo*.3+tail)+vec3(1.8,1.65,1.4)*core)*vC.y*uIntensity,0.0);
    return;
  }
  // 对称轮廓保留圆、椭圆、针、星、菱晶差异；所有敌弹取消黑边与长尾。
  float d;
  if(shape==1)d=(length(p/vec2(1.45,.62))-1.0)*.62;
  else if(shape==2)d=(length(p/vec2(2.3,.34))-1.0)*.34;
  else if(shape==3){float a=vC.x*3.0+vC.z*6.28;d=star(mat2(cos(a),-sin(a),sin(a),cos(a))*p);}
  else if(shape==4)d=length(p)-1.02;
  else if(shape==5)d=(length(vec2(p.x/1.25,p.y/(.7-.15*clamp(p.x,-1.0,1.0))))-1.0)*.6;
  else if(shape==7)d=diamond(p,vec2(1.3,.72));
  else if(shape==8)d=(length(p/vec2(1.7,.58))-1.0)*.58;
  else d=length(p)-1.0;
  float aa=max(fwidth(d),.015);
  float body=1.0-smoothstep(-aa,aa,d);
  float core=1.0-smoothstep(-.38,-.09,d);
  if(shape==2||shape==4)core=1.0-smoothstep(-.16,-.035,d);
  if(!enemy){o=vec4((col*(body+exp(-max(d,0.0)*4.0)*.3)+vec3(1.8)*core)*vC.y*uIntensity,0.0);return;}
  // 将 HDR 色板归一后转为线性色，淡云背景上保留饱和色与窄白芯。
  vec3 base=pow(clamp(col/max(1.0,max(col.r,max(col.g,col.b))),0.0,1.0),vec3(2.2));
  float edge=1.0-smoothstep(-aa*2.0,-aa*.5,d);
  vec2 coreP=p;
  if(shape==1||shape==5||shape==8)coreP/=vec2(1.3,.55);
  if(shape==2)coreP/=vec2(2.0,.28);
  if(shape==7)coreP/=vec2(1.1,.55);
  float white=exp(-dot(coreP,coreP)*24.0);
  vec3 color=mix(base*.48,base,edge);
  color=mix(color,vec3(1.0,.94,.78),white);
  o=vec4(color*body*vC.y,body*vC.y);

}`;

const FLOATS = 12;

export class BulletRenderer {
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  data = new Float32Array(8192 * FLOATS);
  count = 0;
  private cap = 0;
  intensity = 1.6;

  constructor(readonly gl: GL) {
    this.prog = new Program(gl, VS, FS);
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, FLOATS * 4, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
  }

  add(x: number, y: number, angle: number, size: number, shape: number, r: number, g: number, b: number, age: number, alpha: number, seed: number, speed = 0): void {
    if ((this.count + 1) * FLOATS > this.data.length) {
      const n = new Float32Array(this.data.length * 2);
      n.set(this.data);
      this.data = n;
    }
    const o = this.count++ * FLOATS, D = this.data;
    D[o] = x; D[o + 1] = y; D[o + 2] = angle; D[o + 3] = size;
    D[o + 4] = shape; D[o + 5] = r; D[o + 6] = g; D[o + 7] = b;
    D[o + 8] = age; D[o + 9] = alpha; D[o + 10] = seed; D[o + 11] = speed;
  }

  clear(): void {
    this.count = 0;
  }

  draw(time: number): void {
    if (!this.count) return;
    const gl = this.gl;
    const bytes = this.count * FLOATS * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (bytes > this.cap) {
      this.cap = Math.max(bytes, this.cap * 2);
      gl.bufferData(gl.ARRAY_BUFFER, this.cap, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * FLOATS);
    this.prog.use().set('uView', PLAY_W, PLAY_H).set('uTime', time).set('uIntensity', this.intensity);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }
}
