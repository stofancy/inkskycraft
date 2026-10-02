// 重炮与火油共用的局部体积特效。程序、VAO 和折射缓冲随 Renderer 初始化一次。
import { PLAY_W, PLAY_H } from '../types';
import { Program, Target, type GL } from './util';

export const EV = { Fire: 0, Water: 1, Bolt: 2, Sword: 3, Arc: 4 } as const;
interface Effect { kind:number;x:number;y:number;w:number;h:number;t:number;alpha:number;power:number;seed:number;angle:number;ground:boolean }
const VS = `#version 300 es
uniform vec4 uRect;
uniform float uAngle;
out vec2 q;
void main(){
 q=vec2(float(gl_VertexID&1),float(gl_VertexID>>1))*2.-1.;
 vec2 p=q*uRect.zw*.5;
 p=mat2(cos(uAngle),sin(uAngle),-sin(uAngle),cos(uAngle))*p+uRect.xy;
 gl_Position=vec4(p.x/${PLAY_W}. *2.-1.,1.-p.y/${PLAY_H}. *2.,0,1);
}`;
const FS = `#version 300 es
precision highp float;
in vec2 q;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uTime,uAlpha,uPower,uSeed;
uniform int uKind;
out vec4 o;
// 与第三章云海同源的三维值噪声；沿深度积分，亮部保留褶皱与暗面。
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return noise(p)*.57+noise(p*2.03+vec3(3.1,1.7,5.3))*.29+noise(p*4.11+7.)*.14;}
float jag(float y,float seed){float p=y*13.,i=floor(p);return mix(hash(vec3(i,seed,2)),hash(vec3(i+1.,seed,2)),fract(p))-.5;}
float path(float y,float seed){return jag(y,seed)*.22+jag(y*2.7,seed+7.)*.055;}
void main(){
 vec2 uv=gl_FragCoord.xy/uRes;
 vec3 body=vec3(0),emit=vec3(0);float a=0.,heat=0.;
 float edge=1.-smoothstep(.88,1.,max(abs(q.x),abs(q.y)));
 float t=uTime,sd=uSeed;
 if(uKind==0){
  float trans=1.;vec3 col=vec3(0);
  for(int i=0;i<7;i++){
   float z=-.75+float(i)*.25;
   vec3 p=vec3(q.x,q.y,z);
   // 火区的下沿停在判定范围，上部火舌向上抽卷。
   float height=clamp((.64-q.y)/1.5,0.,1.);
   float n=fbm(vec3(p.x*4.5,p.y*3.+t*2.6,p.z*3.+sd));
   float curl=sin(p.y*5.+n*5.-t*3.)*.12*height;
   float envelope=1.-length(vec3((p.x+curl)*1.15,(p.y+.02)*1.08,p.z*.9));
   float d=max(0.,envelope-(1.-n)*(.65+height*.45));
   float density=smoothstep(0.,.12,d)*.66;
   float grain=fbm(vec3((p.x+curl)*11.,p.y*8.+t*4.,p.z*5.+sd));
   float hot=clamp(d*1.15+pow(grain,3.)*1.65,0.,1.);
   vec3 c=mix(vec3(.13,.012,.003),vec3(.95,.12,.008),smoothstep(.0,.4,hot));
   c=mix(c,vec3(2.9,1.05,.10),smoothstep(.3,.72,hot));
   c=mix(c,vec3(3.3,2.5,1.15),smoothstep(.68,1.,hot));
   c*=.30+.70*smoothstep(.28,.72,grain);
   col+=trans*density*c;trans*=1.-density;
  }
  a=min(1.,(1.-trans)*1.30)*edge;
  body=vec3(.09,.018,.008)*a;
  emit=col*edge*(.65+uPower*.38);
  heat=(1.-smoothstep(.6,.96,length(q*vec2(1.,.9))))*.55;
 }else if(uKind==1){
  // 深石青水墨压住外缘，密集亮流绕过前后两面。
  float yy=(q.y+1.)*.5;
  float grain=noise(vec3(q.y*36.,q.x*48.,t*.8));
  float width=(.10+.62*pow(1.-yy,.72))*(.98+grain*.04);
  float x=q.x+sin(q.y*3.5-t*2.)*.055;
  float d=abs(x)/width;
  if(d<1.){
   float z=sqrt(max(0.,1.-d*d));
   float theta=atan(x/width,z);
   float ripple=sin(theta*8.+q.y*31.-t*6.)*.11+sin(theta*17.-q.y*47.+t*9.)*.045;
   float phase=q.y*28.+t*8.+sin(q.y*11.-t*3.)*.26+ripple;
   float front=abs(sin((phase+theta)*.5));
   float back=abs(sin((phase+3.14159-theta)*.5));
   float flow=exp(-front*front*19.);
   float core=exp(-front*front*150.);
   float farFlow=exp(-back*back*130.)*.38;
   float filaments=exp(-pow(abs(sin((phase+theta+.28+ripple)*.5)),2.)*850.);
   float rim=exp(-pow((d-.94)*27.,2.));
   float film=(1.-smoothstep(.65,1.,d))*.10;
   float inkRim=smoothstep(.70,.92,d)*(1.-smoothstep(.96,1.,d));
   float inkFlow=exp(-front*front*8.);
   a=clamp(.38+inkRim*.54+inkFlow*.24,0.,.96)*edge;
   body=mix(vec3(.025,.13,.20),vec3(.055,.30,.37),z*.68)*a;
   float glints=.65+.35*sin(theta*29.+q.y*73.-t*14.);
   emit=(vec3(.18,.65,.76)*(flow*.85+farFlow+film)
        +vec3(1.15,1.85,1.95)*(core*(.90+.45*z)+filaments*.48)*glints
        +vec3(.10,.32,.38)*rim*.10)*edge*uPower;
  }
  float mist=exp(-pow((d-1.02)*7.,2.))*.14;
  emit+=vec3(.38,.65,.68)*mist*edge*(.55+.45*noise(vec3(q*18.,t)));
  // 水花沿外沿切向飞出；椭圆液滴和淡雾随水流上扬。
  for(int k=0;k<18;k++){
   float f=float(k),age=fract(t*.65+f*.618),side=mod(f,2.)*2.-1.;
   float sy=.8-fract(f*.381+t*.19)*1.65;
   float sw=.10+.62*pow(clamp((1.-sy)*.5,0.,1.),.72);
   vec2 p=q-vec2(side*(sw+age*.15)-sin(sy*3.5-t*2.)*.055,sy);
   p.x+=p.y*side*.65;
   float drop=exp(-dot(p*vec2(210.,80.),p*vec2(210.,80.)));
   float spray=exp(-dot(p*vec2(42.,23.),p*vec2(42.,23.)))*.08;
   emit+=vec3(.65,1.0,1.05)*(drop+spray)*(1.-age)*edge;
  }
 }else if(uKind==2){
  float y=(q.y+1.)*.5;
  float seed=sd+floor(t*18.);
  float mainX=path(y,seed);
  float dist=abs(q.x-mainX);
  for(int k=0;k<6;k++){
   float f=float(k),start=.14+f*.108;
   float u=(y-start)/(.20+hash(vec3(f,sd,1))*.24);
   float side=mod(f,2.)<1.?-1.:1.;
   float xx=path(start,seed)+side*u*(.28+.25*hash(vec3(f,sd,7)))+jag(u,seed+f+3.)*.11;
   if(u>0.&&u<1.)dist=min(dist,abs(q.x-xx)*1.55);
  }
  float core=1.-smoothstep(.006,.018,dist);
  float sheath=exp(-dist*dist*1700.);
  a=(1.-smoothstep(.028,.060,dist))*.85*edge;
  body=vec3(.075,.028,.13)*a;
  emit=(vec3(.36,.10,.62)*sheath+vec3(2.3,1.9,2.65)*core)*edge*uPower;
  heat=sheath*.28;
 }else if(uKind==3){
  // 菱形截面的长剑：白亮中脊、双刃高光、细护手，剑气向柄后渐淡。
  float y=q.y*1.35+.35,xx=abs(q.x);
  float bladeWidth=.17*clamp((y+.97)/.35,0.,1.)*(1.-.22*smoothstep(-.62,.43,y));
  float blade=(1.-smoothstep(bladeWidth-.009,bladeWidth+.009,xx))*step(-.97,y)*step(y,.43);
  float guard=(1.-smoothstep(.018,.043,abs(y-.45-xx*.16)))*(1.-smoothstep(.43,.51,xx));
  float handle=(1.-smoothstep(.025,.045,xx))*step(.47,y)*(1.-smoothstep(.73,.78,y));
  float spine=exp(-q.x*q.x*800.)*blade;
  float bevel=exp(-pow((xx-bladeWidth+.016)*145.,2.))*blade;
  float facet=clamp(1.-xx/max(.001,bladeWidth),0.,1.);
  float tail=clamp((y-.15)/1.55,0.,1.);
  float wake=exp(-q.x*q.x/(.009+tail*.075))*pow(1.-tail,2.)*smoothstep(.15,.5,y);
  float thread=exp(-pow((xx-.07-tail*.16-sin(y*13.-t*9.)*.012)*95.,2.))*pow(1.-tail,2.)*smoothstep(.3,.65,y);
  float outline=(1.-smoothstep(bladeWidth+.014,bladeWidth+.032,xx))*step(-.99,y)*step(y,.44);
  float darkEdge=smoothstep(bladeWidth-.055,bladeWidth-.018,xx);
  a=max(outline*.94,max(guard,handle)*.82)*edge;
  body=mix(vec3(.07,.38,.44),vec3(.018,.10,.16),darkEdge)*a;
  emit=(vec3(.22,.74,.84)*blade*(.22+.40*facet)*(1.-darkEdge*.85)
       +vec3(2.0,2.55,2.65)*(spine*1.1+bevel*.32)
       +vec3(.55,1.05,1.12)*(guard*.65+handle*.45)
       +vec3(.16,.46,.51)*(wake*.70+thread*.35))*edge*uPower;
 }else{
  // 地面放射状电弧：不闭合，弧端逐渐碎成飞白。
  float rad=length(q),ang=atan(q.y,q.x),dist=1.;
  for(int k=0;k<9;k++){
   float f=float(k),axis=f*6.283185/9.+sd;
   vec2 p=mat2(cos(axis),-sin(axis),sin(axis),cos(axis))*q;
   float bend=jag(p.x*2.,f+sd+floor(t*9.))*.24*sin(p.x*3.14);
   if(p.x>.03&&p.x<.84)dist=min(dist,abs(p.y-bend));
  }
  float core=1.-smoothstep(.003,.013,dist);
  float shell=exp(-dist*dist*1600.);
  a=shell*.8*edge;
  body=vec3(.045,.018,.07)*a;
  emit=(vec3(.28,.09,.46)*shell+vec3(1.8,1.4,2.1)*core)*edge*(1.-smoothstep(.30,.88,rad))*uPower;
 }
 // 折射背景来自本层绘制前的快照；暗边常规混合，亮芯以预乘加色叠加。
 a*=uAlpha;emit*=uAlpha;
 float warp=heat*edge*uAlpha;
 vec2 offset=vec2(noise(vec3(q*7.,t*3.))-.5,noise(vec3(q.yx*9.,t*2.+11.))-.5)*warp*5./uRes;
 vec3 behind=texture(uScene,clamp(uv+offset,vec2(0),vec2(1))).rgb;
 float veil=warp*.22;
 o=vec4(body*uAlpha+emit+behind*veil*(1.-a),a+veil*(1.-a));
}`;

export class ElementalVfx {
 private readonly prog:Program;
 private readonly vao:WebGLVertexArrayObject;
 private readonly snapshot:Target;
 private readonly effects:Effect[]=[];
 private count=0;
 constructor(readonly gl:GL){
  this.prog=new Program(gl,VS,FS);
  this.vao=gl.createVertexArray()!;
  this.snapshot=new Target(gl,4,4,'rgba16f');
 }
 resize(w:number,h:number):void{this.snapshot.resize(w,h);}
 add(kind:number,x:number,y:number,w:number,h:number,t:number,alpha=1,power=1,seed=0,angle=0,ground=false):void{
  if(alpha<=0||w<=0||h<=0)return;
  const e=this.effects[this.count]??(this.effects[this.count]={kind,x,y,w,h,t,alpha,power,seed,angle,ground});
  Object.assign(e,{kind,x,y,w,h,t,alpha,power,seed,angle,ground});this.count++;
 }
 draw(scene:Target,ground:boolean):void{
  let present=false;for(let i=0;i<this.count;i++)if(this.effects[i].ground===ground){present=true;break;}
  if(!present)return;
  const gl=this.gl;
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,scene.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,this.snapshot.fbo);
  gl.blitFramebuffer(0,0,scene.w,scene.h,0,0,scene.w,scene.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  scene.bind();gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.bindVertexArray(this.vao);
  this.prog.use().tex('uScene',this.snapshot.tex).set('uRes',scene.w,scene.h);
  for(let i=0;i<this.count;i++){const e=this.effects[i];if(e.ground!==ground)continue;
   this.prog.set('uRect',e.x,e.y,e.w,e.h).set('uKind',e.kind).set('uTime',e.t).set('uAlpha',e.alpha).set('uPower',e.power).set('uSeed',e.seed).set('uAngle',e.angle);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
 }
 clear():void{this.count=0;}
}
