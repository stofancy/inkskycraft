// 局部毁伤、羽刃与武器装甲：有厚度的三角面与铜、玉、电蚀材质。
import { PLAY_H, PLAY_W } from '../types';
import { Program, type GL, type Target } from './util';
type RGB = [number,number,number];
const VS = `#version 300 es
layout(location=0) in vec3 aP;
layout(location=1) in vec3 aN;
layout(location=2) in vec4 aC;
out vec3 N; out vec4 C;
void main(){ gl_Position=vec4(aP.x/${PLAY_W / 2}.0-1.0,1.0-aP.y/${PLAY_H / 2}.0,aP.z/1000.0,1.0); N=aN; C=aC; }`;
const FS = `#version 300 es
precision highp float;
in vec3 N; in vec4 C; out vec4 o;
void main(){ vec3 n=normalize(N); float d=max(dot(n,normalize(vec3(-0.5,-0.4,0.8))),0.0); float s=pow(max(dot(n,normalize(vec3(-0.25,-0.2,1.0))),0.0),48.0); vec3 c=C.rgb*(0.32+1.05*d)+vec3(0.65,0.43,0.19)*s*0.7; o=vec4(c*C.a,C.a); }`;
export class ImpactSystem {
  private p: Program; private vao: WebGLVertexArrayObject; private vbo: WebGLBuffer; private data: number[]=[];
  constructor(readonly gl: GL){ this.p=new Program(gl,VS,FS); this.vao=gl.createVertexArray()!;this.vbo=gl.createBuffer()!;gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo); for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,i===2?4:3,gl.FLOAT,false,40,i===2?24:i*12);}gl.bindVertexArray(null); }
  clear():void { this.data.length=0; }
  private tri(a:number[],b:number[],c:number[],col:RGB,alpha:number):void{const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const l=Math.hypot(...n)||1;for(const p of[a,b,c])this.data.push(...p,...n.map(x=>x/l),...col,alpha);}
  feather(x:number,y:number,angle:number,size:number,palette:'red'|'blue'|'purple'='red',alpha=1):void{
    const c:RGB=palette==='red'?[0.82,0.09,0.022]:palette==='blue'?[0.04,0.55,0.44]:[0.33,0.055,0.55];
    const cs=Math.cos(angle),sn=Math.sin(angle);const p=(a:number,b:number,z:number)=>[x+a*cs-b*sn,y+a*sn+b*cs,z];
    const tip=p(0,-size,0),tail=p(0,size*0.6,0),l=p(-size*.21,size*.08,0),r=p(size*.21,size*.08,0),ridge=p(0,-size*.05,-4);
    this.tri(tip,l,ridge,c,alpha);this.tri(l,tail,ridge,c.map(v=>v*.58) as RGB,alpha);this.tri(tip,ridge,r,c.map(v=>v*1.3) as RGB,alpha);this.tri(ridge,tail,r,[.58,.27,.055],alpha);
    this.tri(tip,p(-size*.035,size*.04,-4.2),ridge,[1.15,.51,.12],alpha);
  }
  armor(x:number,y:number,power:number,palette:'red'|'blue'|'purple',bank:number,alpha=1):void{
    for(let i=0;i<Math.ceil(power/2);i++)for(const side of[-1,1])this.feather(x+side*(13+i*4),y+12+i*5,side*(.38+i*.1)+bank*.15,8+i*1.2,palette,alpha);
    this.feather(x,y-9,bank*.08,10+power*.55,palette,alpha);
  }
  scar(x:number,y:number,angle:number,size:number,palette:'red'|'blue'|'purple'|'ink'|'companion'|'neutral',heat:number,alpha:number):void{
    const c:RGB=palette==='blue'?[.018,.23+heat*.4,.18+heat*.35]:palette==='purple'?[.17+heat*.5,.035,.24+heat*.65]:palette==='red'?[.22+heat*.9,.055+heat*.17,.018]:[.035,.025,.02];
    const cs=Math.cos(angle),sn=Math.sin(angle),p=(a:number,b:number,z:number)=>[x+a*cs-b*sn,y+a*sn+b*cs,z];
    this.tri(p(-size,-1.5,0),p(size,0,0),p(0,3,-1),[.025,.018,.015],alpha);
    this.tri(p(-size*.9,-.4,-1),p(size*.88,.4,-1),p(-size*.15,1.2,-2),c,alpha);
    if(palette==='purple')this.tri(p(0,0,-1),p(size*.3,-size*.5,-1),p(size*.2,-size*.15,-2),c,alpha);
    if(palette==='blue')this.tri(p(-size*.2,0,-1),p(-size*.4,-size*.4,-1),p(-size*.05,-size*.23,-3),c,alpha);
  }
  /** 青玉裂片、朱色笔芒、紫色折雷；拒伤用灰金断弧，寿命与范围均短促。 */
  hit(x:number,y:number,source:'red'|'blue'|'purple'|'ink'|'companion'|'neutral',age:number,blocked:boolean,alpha=1):void {
    const duration=blocked?.22:.18;
    if(age<0||age>=duration)return;
    const t=age/duration,fade=(1-t)*alpha;
    const line=(a:number[],b:number[],w:number,c:RGB)=>{
      const d=Math.hypot(b[0]-a[0],b[1]-a[1])||1,dx=-(b[1]-a[1])/d*w,dy=(b[0]-a[0])/d*w;
      this.tri([a[0]+dx,a[1]+dy,-2],[b[0]+dx,b[1]+dy,-2],[a[0]-dx,a[1]-dy,-2],c,fade);
      this.tri([b[0]+dx,b[1]+dy,-2],[b[0]-dx,b[1]-dy,-2],[a[0]-dx,a[1]-dy,-2],c,fade);
    };
    if(blocked){
      const r=10+t*7;
      for(let i=0;i<12;i++){
        if(i%4===3)continue;
        const a=i*Math.PI/6,b=a+.31;
        line([x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(b)*r,y+Math.sin(b)*r],1.1,[.72,.62,.37]);
      }
      return;
    }
    if(source==='purple'){
      for(const side of[-1,1]){
        const pts=[[x,y],[x+side*9,y-5],[x+side*5,y-11],[x+side*(16+9*t),y-16],[x+side*13,y-23-5*t]];
        for(let i=1;i<pts.length;i++)line(pts[i-1],pts[i],1.4,[1.15,.22,2]);
      }
      line([x,y],[x+5,y+12+7*t],1.2,[.85,.16,1.6]);
    }else if(source==='blue'){
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2+.35,r=6+t*16,cx=x+Math.cos(a)*r,cy=y+Math.sin(a)*r;
        const p=(u:number,v:number,z:number)=>[cx+u*Math.cos(a)-v*Math.sin(a),cy+u*Math.sin(a)+v*Math.cos(a),z];
        this.tri(p(-5,-2,0),p(7,0,0),p(0,4,-3),[.05,1.15,.9],fade);
        this.tri(p(-5,-2,0),p(0,-3,-1),p(7,0,0),[.32,1.9,1.55],fade);
      }
    }else{
      const c:RGB=source==='red'?[1.85,.20,.04]:[.3,.16,.05];
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5-.8,len=15+10*t;
        const p=(r:number,d:number)=>[x+Math.cos(a)*r-Math.sin(a)*d,y+Math.sin(a)*r+Math.cos(a)*d,-2];
        this.tri(p(3,-1.8),p(len,0),p(7,2.6),c,fade);
        this.tri(p(3,-.4),p(len*.8,0),p(6,.5),[2,.65,.16],fade*.8);
      }
    }
  }
  draw(_time:number,scene:Target):void{if(!this.data.length)return;const gl=this.gl;scene.bind();gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);const depth=gl.isEnabled(gl.DEPTH_TEST),cull=gl.isEnabled(gl.CULL_FACE);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);this.p.use();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.data),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,this.data.length/10);gl.bindVertexArray(null);if(depth)gl.enable(gl.DEPTH_TEST);if(cull)gl.enable(gl.CULL_FACE);}
}
