// 真言字形遮罩图集：仅存字形，厚度、亮边、碎裂与受光均实时绘制。
import { Program, type GL } from './util';
import { MantraWriting } from './mantra-writing';
import { MantraVolumes } from './mantra-volumes';
import { PLAY_W,PLAY_H, type WeaponColor } from '../types';
import { AURA_COLORS } from '../game/aura';
interface MantraManifest{defaultSequences:Record<string,string[]>;entries:{id:string;text:string;filename:string}[]}
const indexes=import.meta.glob('/public/art/lettering/mantra/index.json',{eager:true,import:'default'});
const manifest=Object.values(indexes)[0] as MantraManifest;
export const MANTRA_KEYS:Record<WeaponColor,string[]>={purple:manifest.defaultSequences['雷'],red:manifest.defaultSequences['朱'],blue:manifest.defaultSequences['青']};
const KEYS=[...MANTRA_KEYS.purple,...MANTRA_KEYS.red,...MANTRA_KEYS.blue];
const VS=`#version 300 es
layout(location=0) in vec2 corner;
layout(location=1) in vec4 pos;
layout(location=2) in vec4 style;
layout(location=3) in vec4 tint;
layout(location=4) in vec2 fx;
out vec2 uv;out vec4 col;out vec2 effects;flat out float layer;flat out float cell;flat out float rimScale;
void main(){vec2 q=corner*pos.z;float c=cos(pos.w),s=sin(pos.w);q=mat2(c,s,-s,c)*q;q.y*=.86;
 vec2 p=pos.xy+q+vec2(-1.8,2.7)*style.y;
 gl_Position=vec4(p.x/${PLAY_W.toFixed(1)}*2.-1.,1.-p.y/${PLAY_H.toFixed(1)}*2.,0,1);
 uv=(corner+.5+vec2(mod(style.x,8.),floor(style.x/8.)))/vec2(8.,3.);col=tint;effects=fx;layer=style.y;cell=style.x;rimScale=style.z;}
`;
const FS=`#version 300 es
precision highp float;uniform sampler2D mask;
in vec2 uv;in vec4 col;in vec2 effects;flat in float layer;flat in float cell;flat in float rimScale;out vec4 o;
void main(){vec4 texel=texture(mask,uv);float a=texel.a;if(a<.04)discard;
 float distance=texel.r*32.;
 float rim=1.-smoothstep(0.,max(.1,fwidth(distance)*2.*rimScale),distance);
 vec3 hue=col.rgb/max(max(col.r,col.g),col.b);
 vec3 c=layer>0.?mix(vec3(.004,.003,.002),hue,.3)*.065:vec3(.027,.023,.019);
 if(layer==0.){
  vec3 inner=mix(hue*1.3,vec3(1.7,1.65,1.5),smoothstep(.45,.85,texel.g));
  c=mix(c,inner,texel.g*.9);
  c=mix(c,col.rgb*1.15,rim);
 }
 c=mix(c,vec3(2.),effects.x);
 if(effects.y>0.){vec2 q=fract(uv*vec2(8.,3.)*9.);a*=smoothstep(.015,.08,min(q.x,q.y));}
 a*=col.a;o=vec4(c*a,a);}

`;
export interface MantraGlyph {key:string;x:number;y:number;size:number;rot:number;alpha:number;color:WeaponColor;flash?:boolean;fracture?:number;rim?:number;ghost?:boolean}
export class MantraGlyphs{
 private prog:Program;private vao:WebGLVertexArrayObject;private instances:WebGLBuffer;private texture:WebGLTexture;private canvas:HTMLCanvasElement;private count=0;
 private data=new Float32Array(512*14);private ctx:CanvasRenderingContext2D;
 readonly writing:MantraWriting;
 readonly volumes:MantraVolumes;
 source='loading';readonly errors:string[]=[];
 constructor(readonly gl:GL){
  this.writing=new MantraWriting(gl);this.volumes=new MantraVolumes(gl);
  this.prog=new Program(gl,VS,FS);this.vao=gl.createVertexArray()!;this.instances=gl.createBuffer()!;this.texture=gl.createTexture()!;
  this.canvas=document.createElement('canvas');this.canvas.width=2048;this.canvas.height=768;this.ctx=this.canvas.getContext('2d')!;
  gl.bindVertexArray(this.vao);const quad=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.5,.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,.5]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);
  for(const [loc,n,offset]of [[1,4,0],[2,4,4],[3,4,8],[4,2,12]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,56,offset*4);gl.vertexAttribDivisor(loc,1);}gl.bindVertexArray(null);
  this.upload();void this.load();
 }
 private upload():void{const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
 private async load():Promise<void>{
  try{
   const images=await Promise.all(KEYS.map(async id=>{
    const entry=manifest.entries.find(e=>e.id===id);
    if(!entry)throw Error('真言字图缺少 '+id);
    const img=new Image();img.src='/art/lettering/mantra/'+entry.filename;await img.decode();return img;
   }));
   images.forEach((img,i)=>{
    const cell=document.createElement('canvas');cell.width=cell.height=256;const ctx=cell.getContext('2d')!;ctx.drawImage(img,0,0,256,256);
    const image=ctx.getImageData(0,0,256,256);this.writing.load(KEYS[i],image);const data=image.data,dist=new Float32Array(256*256);
    for(let k=0;k<dist.length;k++)dist[k]=data[k*4+3]>24?1000:0;
    // 八邻域距离与笔腹脊线由正式遮罩生成，仅在资源加载时计算。
    for(let y=1;y<255;y++)for(let x=1;x<255;x++){const k=y*256+x;dist[k]=Math.min(dist[k],dist[k-1]+1,dist[k-256]+1,dist[k-257]+1.414,dist[k-255]+1.414);}
    for(let y=254;y>0;y--)for(let x=254;x>0;x--){const k=y*256+x;dist[k]=Math.min(dist[k],dist[k+1]+1,dist[k+256]+1,dist[k+257]+1.414,dist[k+255]+1.414);}
    const ridge=new Float32Array(dist.length);
    for(let y=2;y<254;y++)for(let x=2;x<254;x++){const k=y*256+x,d=dist[k];if(d<2)continue;
     for(const delta of [1,256,255,257])if(d>=dist[k-delta]&&d>=dist[k+delta]&&d>Math.min(dist[k-delta],dist[k+delta])+.2)ridge[k]=1;
    }
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){const k=y*256+x;let light=0;
     for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<256&&y+dy>=0&&y+dy<256)light=Math.max(light,ridge[k+dy*256+dx]*Math.exp(-(dx*dx+dy*dy)/2.4));
     data[k*4]=Math.min(255,dist[k]/32*255);data[k*4+1]=light*255;data[k*4+2]=0;
    }
    ctx.putImageData(image,0,0);this.ctx.drawImage(cell,i%8*256,Math.floor(i/8)*256);
   });
   this.upload();this.source='formal';
  }catch(e){this.errors.push(String(e));console.error('真言字形加载失败',e);}
 }

 add(g:MantraGlyph):void{const key=KEYS.indexOf(g.key);if(key<0)return;const color=AURA_COLORS[g.color];for(let layer=g.ghost?0:11;layer>=0;layer--){if(this.count>=512)return;const o=this.count++*14;this.data.set([g.x,g.y,g.size,g.rot,key,layer,g.rim??1,0,...color,g.alpha,g.flash?1:0,g.fracture??0],o);}}
 draw():void{this.volumes.draw();this.writing.draw();if(!this.count)return;const gl=this.gl;this.prog.use().tex('mask',this.texture);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,this.count*14));gl.drawArraysInstanced(gl.TRIANGLES,0,6,this.count);gl.bindVertexArray(null);this.count=0;}
 clear():void{this.count=0;this.writing.clear();this.volumes.clear();}
}
