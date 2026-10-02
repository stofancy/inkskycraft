// 本色墨迹沿骨架写出；落字时沿笔画溅出墨点和墨滴。
import { Program, type GL } from './util';
import { PLAY_W, PLAY_H, type WeaponColor } from '../types';
import { AURA_COLORS } from '../game/aura';
export const WRITING_POINTS = 96;
export const WRITE_TIME = .3;
export const HOLD_TIME = .2;
type Point = [number, number, number];
const VS = `#version 300 es
layout(location=0) in vec4 pos;
layout(location=1) in vec4 tint;
layout(location=2) in vec4 motion;
out vec2 uv;out vec2 droplet;out vec4 col;flat out float progress;flat out float spray;
void main(){
 vec2 corner=vec2(float(gl_VertexID&1),float(gl_VertexID>>1));
 vec2 cell=vec2(mod(motion.x,8.),floor(motion.x/8.));
 vec2 q=(corner-.5)*pos.z;
 float burst=max(0.,pos.w-${WRITE_TIME+HOLD_TIME});
 vec2 offset=vec2(0.);spray=motion.y>=0.?1.:0.;
 droplet=corner*2.-1.;
 if(spray>0.){
  float seed=motion.y*7.31+motion.x*2.7;
  float jitter=fract(sin(seed)*43758.5);
  vec2 dir=normalize(motion.zw+vec2(sin(seed),cos(seed))*.12+vec2(.001));
  offset=dir*burst*(140.+180.*jitter)+vec2(0.,burst*burst*240.);
  float stretch=1.+mod(motion.y,3.)*burst*9.;
  vec2 shape=droplet*pos.z*vec2(stretch,1.);
  q=dir*shape.x+vec2(-dir.y,dir.x)*shape.y;
 }
 vec2 p=pos.xy+q+offset;
 gl_Position=vec4(p.x/${PLAY_W.toFixed(1)}*2.-1.,1.-p.y/${PLAY_H.toFixed(1)}*2.,0,1);
 uv=(corner+cell)/vec2(8.,3.);col=tint;progress=clamp(pos.w/${WRITE_TIME},0.,1.);
}`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D mask;
in vec2 uv;in vec2 droplet;in vec4 col;flat in float progress;flat in float spray;out vec4 o;
float ink(vec2 p){vec4 t=texture(mask,p);return t.a*(1.-smoothstep(progress-.04,progress,t.r));}
void main(){
 vec3 hue=col.rgb/max(max(col.r,col.g),col.b);
 if(spray>0.){
  vec2 p=droplet;p.y/=1.-.3*p.x;
  float d=length(p),grain=.94+.06*sin(p.x*29.+p.y*37.);
  float body=(1.-smoothstep(.64,.95,d))*grain,core=exp(-d*d*9.);
  float a=body*col.a;
  o=vec4(mix(hue*.48,mix(hue*1.4,vec3(1.7),.5),core)*a,a);return;
 }
 vec4 m=texture(mask,uv);
 float reveal=1.-smoothstep(progress-.04,progress,m.r);
 vec2 dx=vec2(2.5/2048.,0.),dy=vec2(0.,2.5/768.);
 float around=max(max(ink(uv+dx),ink(uv-dx)),max(ink(uv+dy),ink(uv-dy)));
 float body=m.a*reveal,halo=around;
 if(body+halo<.005)discard;
 float edge=clamp(around-body,0.,1.)*(1.-smoothstep(.08,.32,m.a));
 vec3 pigment=mix(hue*.12,hue*1.05,m.b);
 pigment=mix(pigment,mix(hue*1.8,vec3(1.9,1.85,1.8),.5),m.g*.65);
 vec3 rgb=(pigment*body+hue*edge*.85)*col.a;
 o=vec4(rgb,max(body,halo*.28)*col.a);
}`;
export class MantraWriting {
 private paths=new Map<string,Point[]>();private cells=new Map<string,number>();
 private prog:Program;private vao:WebGLVertexArrayObject;private vbo:WebGLBuffer;
 private texture:WebGLTexture;private canvas:HTMLCanvasElement;private ctx:CanvasRenderingContext2D;private dirty=false;
 private data=new Float32Array(WRITING_POINTS*9*12);count=0;
 constructor(readonly gl:GL){
  this.prog=new Program(gl,VS,FS);this.vao=gl.createVertexArray()!;this.vbo=gl.createBuffer()!;this.texture=gl.createTexture()!;
  this.canvas=document.createElement('canvas');this.canvas.width=2048;this.canvas.height=768;this.ctx=this.canvas.getContext('2d')!;
  gl.bindTexture(gl.TEXTURE_2D,this.texture);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);
  for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,4,gl.FLOAT,false,48,i*16);gl.vertexAttribDivisor(i,1);}gl.bindVertexArray(null);
 }
 load(key:string,image:ImageData):void{
  // 遮罩细化成笔画骨架；从左上起笔，沿相邻骨架点走，笔腹宽度保留。
  const n=40,ink=new Uint8Array(n*n),dist=new Float32Array(n*n);
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){
   const px=Math.floor((x+.5)*image.width/n),py=Math.floor((y+.5)*image.height/n);
   ink[y*n+x]=image.data[(py*image.width+px)*4+3]>96?1:0;
  }
  for(let k=0;k<ink.length;k++)dist[k]=ink[k]?1000:0;
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const k=y*n+x;dist[k]=Math.min(dist[k],dist[k-1]+1,dist[k-n]+1,dist[k-n-1]+1.414,dist[k-n+1]+1.414);}
  for(let y=n-2;y>0;y--)for(let x=n-2;x>0;x--){const k=y*n+x;dist[k]=Math.min(dist[k],dist[k+1]+1,dist[k+n]+1,dist[k+n+1]+1.414,dist[k+n-1]+1.414);}
  const deltas=[-n,-n+1,1,n+1,n,n-1,-1,-n-1];
  for(let pass=0;pass<40;pass++){
   let removed=0;
   for(let half=0;half<2;half++){
    const drop:number[]=[];
    for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){
     const k=y*n+x;if(!ink[k])continue;const p=deltas.map(d=>ink[k+d]),sum=p.reduce((a,b)=>a+b,0);
     const turns=p.reduce((a,v,i)=>a+(!v&&p[(i+1)%8]?1:0),0);
     if(sum<2||sum>6||turns!==1)continue;
     if(half? p[0]*p[2]*p[6]||p[0]*p[4]*p[6]:p[0]*p[2]*p[4]||p[2]*p[4]*p[6])continue;
     drop.push(k);
    }
    for(const k of drop)ink[k]=0;removed+=drop.length;
   }
   if(!removed)break;
  }
  const path:Point[]=[];
  const visit=(k:number):void=>{if(!ink[k])return;ink[k]=0;path.push([(k%n+.5)/n-.5,(Math.floor(k/n)+.5)/n-.5,Math.max(1.1,dist[k])*.9/n]);
   for(const d of [1,n+1,n,n-1,-1,-n-1,-n,-n+1])if(k+d>=0&&k+d<ink.length&&ink[k+d])visit(k+d);
  };
  for(let k=0;k<ink.length;k++)if(ink[k])visit(k);
  const points=Array.from({length:Math.min(WRITING_POINTS,path.length)},(_,i)=>path[Math.floor(i*path.length/Math.min(WRITING_POINTS,path.length))]);
  this.paths.set(key,points);
  const index=this.cells.size;this.cells.set(key,index);
  // 加载时烘焙墨的浓淡、毛边和顺笔纤维；逐帧只采样同一张图集。
  const width=image.width,height=image.height,depth=new Float32Array(width*height);
  for(let k=0;k<depth.length;k++)depth[k]=image.data[k*4+3]>80?1000:0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const k=y*width+x;depth[k]=Math.min(depth[k],depth[k-1]+1,depth[k-width]+1,depth[k-width-1]+1.414,depth[k-width+1]+1.414);}
  for(let y=height-2;y>0;y--)for(let x=width-2;x>0;x--){const k=y*width+x;depth[k]=Math.min(depth[k],depth[k+1]+1,depth[k+width]+1,depth[k+width+1]+1.414,depth[k+width-1]+1.414);}
  const mask=new ImageData(image.width,image.height);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
   const k=(y*image.width+x)*4;mask.data[k+3]=image.data[k+3];if(!image.data[k+3])continue;
   const px=(x+.5)/image.width-.5,py=(y+.5)/image.height-.5;let nearest=0,distance=Infinity;
   for(let i=0;i<points.length;i++){const q=points[i],d=(px-q[0])**2+(py-q[1])**2;if(d<distance){distance=d;nearest=i;}}
   const q=points[nearest],next=points[Math.min(points.length-1,nearest+1)],prev=points[Math.max(0,nearest-1)];
   const tx=next[0]-prev[0],ty=next[1]-prev[1],length=Math.hypot(tx,ty)||1;
   const across=((px-q[0])*ty-(py-q[1])*tx)/length*width;
   const along=((px-q[0])*tx+(py-q[1])*ty)/length*width;
   const wet=.5+.25*Math.sin(x*.083+y*.051)+.25*Math.sin(x*.031-y*.067);
   const hash=Math.sin(x*127.1+y*311.7+index)*43758.5453,grain=hash-Math.floor(hash);
   const d=depth[y*width+x],fiber=Math.sin(across*1.4+Math.sin(along*.08)*.7);
   const dry=fiber>.86&&wet<.6&&d>2?.25:1;
   mask.data[k]=Math.round(nearest/Math.max(1,points.length-1)*248);
   mask.data[k+1]=Math.min(1,d/Math.max(2,q[2]*width*.8))**1.8*(.6+.4*wet)*255;
   mask.data[k+2]=(.25+.7*wet+.05*grain)*255;
   mask.data[k+3]*=dry*(d<3.5?.3+.7*grain:.92+.08*grain);
  }
  this.ctx.putImageData(mask,index%8*256,Math.floor(index/8)*256);this.dirty=true;
 }

 add(key:string,x:number,y:number,size:number,color:WeaponColor,age:number):void{
  const cell=this.cells.get(key);if(cell===undefined||age<0||age>.85)return;
  const burst=Math.max(0,age-WRITE_TIME-HOLD_TIME),hue=AURA_COLORS[color],alpha=burst>0?Math.pow(Math.max(0,1-burst/.35),2):.96;
  const points=this.paths.get(key)!;
  for(let i=0;i<(burst>0?points.length:1);i++){
   if(this.count>=WRITING_POINTS*9)break;
   const q=points[i];
   this.data.set(burst>0?
    [x+q[0]*size,y+q[1]*size,Math.max(1.5,Math.min(7,q[2]*size*.7)),age,...hue,alpha,cell,i,q[0],q[1]]:
    [x,y,size,age,...hue,alpha,cell,-1,0,0],this.count++*12);
  }
 }
 draw():void{
  if(!this.count)return;const gl=this.gl;
  if(this.dirty){gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);this.dirty=false;}
  this.prog.use().tex('mask',this.texture);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,this.count*12));gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,this.count);gl.bindVertexArray(null);this.clear();
 }
 clear():void{this.count=0;}
}
