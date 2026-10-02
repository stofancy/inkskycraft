// 泼墨专用体积片：局部火舌、墨烟、水雾与卷曲噪声层，同批提交。
import { Program, type GL } from './util';
import { PLAY_W, PLAY_H, type WeaponColor } from '../types';
import { RibbonBatch, RS } from './ribbons';
export const VOLUME_CAP = 256;
export enum MV { Fire, Smoke, Mist, Glow, Wave, Drop, Ink, WaterArm, Flash }
const COLORS: Record<WeaponColor, [number, number, number]> = {
 red: [2.1, .36, .025], blue: [.08, 1.5, 1.6], purple: [1.1, .18, 2.2],
};
const VS = `#version 300 es
layout(location=0) in vec4 shape;
layout(location=1) in vec4 style;
layout(location=2) in vec4 tint;
out vec2 q;flat out vec4 params;flat out vec4 col;
void main(){
 q=vec2(float(gl_VertexID&1),float(gl_VertexID>>1))*2.-1.;
 vec2 v=q*shape.zw;float c=cos(style.x),s=sin(style.x);
 vec2 p=shape.xy+vec2(v.x*c-v.y*s,v.x*s+v.y*c);
 gl_Position=vec4(p.x/${PLAY_W.toFixed(1)}*2.-1.,1.-p.y/${PLAY_H.toFixed(1)}*2.,0,1);
 params=style;col=tint;
}`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D smoke;uniform float smokeReady;
in vec2 q;flat in vec4 params;flat in vec4 col;out vec4 o;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){
 float time=params.y,seed=params.w;int k=int(params.z+.5);
 vec2 p=q;float r=length(q),a=0.;vec3 rgb=col.rgb;float alpha=col.a;
 if((k==1||k==6)&&smokeReady>.5){
  vec2 uv=q*.5+.5;
  uv+=vec2(sin(q.y*6.+time*3.+seed),cos(q.x*7.-time*2.+seed))*.024;
  vec4 texel=texture(smoke,uv);
  float detail=dot(texel.rgb,vec3(.299,.587,.114));
  a=texel.a*alpha;
  rgb=vec3(.003,.005,.007)+vec3(.16,.17,.18)*detail;
  rgb+=col.rgb*.018*detail;
  o=vec4(rgb*a,a);return;
 }
 // 旋转域扭曲形成翻卷纹理，边缘随时间改变；墨层使用实色透明混合。
 float ang=atan(q.y,q.x)+.7*sin(r*5.-time*3.+seed);
 vec2 curl=vec2(cos(ang),sin(ang))*r;
 vec2 warp=vec2(noise(curl*3.+seed+time*.5),noise(curl*3.-seed-time*.7))-.5;
 vec2 uv=curl*3.8+warp*1.7+seed;
 float n=noise(uv)*.56+noise(uv*2.1+time*.4)*.29+noise(uv*4.3)*.15;
 float edge=.69+.23*sin(ang*3.+seed)+.13*sin(ang*7.-time*2.+seed*2.);
 float envelope=1.-smoothstep(edge-.12,edge+.04,r);
 if(k==0){
  float spine=.25*sin(p.y*4.-time*7.+seed)*(1.-p.y)*.6;
  float width=.19+.38*(p.y*.5+.5)+.12*n;
  float flame=(1.-smoothstep(width*.35,width,abs(p.x-spine)))*envelope;
  float tongues=smoothstep(.2,.65,n+.17*sin(p.y*12.+time*6.));
  a=flame*(.55+.45*tongues)*alpha;
  float core=exp(-pow((p.x-spine)/width,2.)*12.)*smoothstep(-.3,.8,p.y)*tongues;
  rgb=mix(vec3(.30,.008,.002),col.rgb*.65,tongues)+vec3(2.4,1.3,.32)*core;
 }else if(k==1||k==6){
  a=envelope*(.8+.2*n)*alpha;
  float folds=smoothstep(.32,.65,n)*smoothstep(.85,.6,r);
  rgb=vec3(.004,.006,.009)+vec3(.045,.044,.048)*folds;
  // 只在墨团褶边透少量本色受光，笔腹保持深黑。
  rgb+=col.rgb*.027*pow(max(0.,n-.4)*2.,3.);
 }else if(k==2){
  a=envelope*(.15+.6*n)*alpha;
  rgb=col.rgb*(.25+.42*n)+vec3(.15,.25,.27)*pow(n,4.);
 }else if(k==3){a=exp(-r*r*7.)*alpha;rgb=col.rgb;}
 else if(k==4){
  float rim=exp(-pow((r-.7)*5.5,2.));
  a=rim*(.4+.6*n)*alpha;rgb=col.rgb*(.7+.5*n);
 }else if(k==5){
  a=(1.-smoothstep(.45,.85,r))*alpha;
  rgb=col.rgb*.65+vec3(.8,1.2,1.3)*exp(-dot(q+vec2(.2,.25),q+vec2(.2,.25))*22.);
 }else if(k==7){
  // 单条连续旋臂，中心留空，长尾从内卷向外；CPU 旋转与扩张。
  float theta=atan(q.y,q.x);theta=mod(theta+6.2831853,6.2831853);
  float target=.16+theta*.18;
  float width=.08+.12*theta/3.7;
  float ribbon=1.-smoothstep(width*.4,width,abs(r-target)+(.5-n)*.04);
  float ends=smoothstep(0.,.35,theta)*(1.-smoothstep(2.7,3.7,theta));
  a=ribbon*ends*alpha*(.35+.65*smoothstep(.2,.7,n));
  float crest=exp(-pow((r-target-width*.25)/.023,2.))*.6;
  rgb=mix(col.rgb*.03,col.rgb*.27,n)+vec3(.1,.35,.38)*crest;
 }else if(k==8){a=exp(-r*r*7.)*alpha;rgb=vec3(4.,3.8,4.3);}

 if(a<.003)discard;o=vec4(rgb*a,a*(k==3||k==8?0.:k==0?.48:1.));
}`;
export class MantraVolumes {
 private p:Program;private vao:WebGLVertexArrayObject;private vbo:WebGLBuffer;
 private data=new Float32Array(VOLUME_CAP*12);count=0;peak=0;
 private smoke:WebGLTexture;smokeReady=false;
 constructor(readonly gl:GL){
  this.smoke=gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D,this.smoke);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
  for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const image=new Image();image.src='/art/vfx/ink-smoke-v1.png';
  void image.decode().then(()=>{gl.bindTexture(gl.TEXTURE_2D,this.smoke);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);this.smokeReady=true;});
  this.p=new Program(gl,VS,FS);this.vao=gl.createVertexArray()!;this.vbo=gl.createBuffer()!;
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);
  for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,4,gl.FLOAT,false,48,i*16);gl.vertexAttribDivisor(i,1);}gl.bindVertexArray(null);
 }
 add(kind:MV,x:number,y:number,rx:number,ry:number,color:WeaponColor,alpha:number,time:number,seed=0,rot=0):void{
  if(alpha<=0||rx<=0||ry<=0||this.count>=VOLUME_CAP)return;
  const c=COLORS[color];
  this.data.set([x,y,rx,ry,rot,time,kind,seed,...c,alpha],this.count++*12);this.peak=Math.max(this.peak,this.count);
 }
 draw():void{if(!this.count)return;const gl=this.gl;this.p.use().tex('smoke',this.smoke).set('smokeReady',this.smokeReady?1:0);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,this.count*12));gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,this.count);gl.bindVertexArray(null);this.clear();}
 clear():void{this.count=0;}
}
// 宽辉光内嵌雷芯；分叉同样有厚度，几何末端收尖。
export function mantraBolt(b:RibbonBatch,pts:number[],width:number,alpha:number):void{
 b.strip(pts,Array.from({length:pts.length/2},(_,i)=>width*(i===pts.length/2-1?.08:.5+.5*Math.abs(Math.sin(i*2.7)))),RS.MantraLightning,1.05,.18,2.25,alpha);
}
