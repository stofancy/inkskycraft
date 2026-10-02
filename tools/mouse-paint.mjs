// 旧巡游/截图脚本共用的真实鼠标事件笔画；不移动机体、不直接调用 Brush.resolve。
// points 是战场坐标；固定 60Hz。hold 供收笔前截图，之后调用 releaseStroke。
export async function paintStroke(page,points,{hold=false}={}){
 await page.evaluate(({points,hold})=>{
  const g=window.__game,w=g.world,r=g.r.playCss,c=document.querySelector('#gl');
  const pointer=(type,x,y)=>c.dispatchEvent(new MouseEvent(type,{clientX:r.x+x*r.w/900,clientY:r.y+y*r.h/1200,button:2,buttons:type==='mouseup'?0:2,bubbles:true}));
  const tick=()=>{g.input.poll();w.tick(1/60);};
  pointer('mousedown',...points[0]);tick();for(const point of points.slice(1)){pointer('pointermove',...point);tick();}
  if(!hold){pointer('mouseup',...points.at(-1));tick();}g.render();
 },{points,hold});
}
export async function releaseStroke(page){await page.evaluate(()=>{window.dispatchEvent(new MouseEvent('mouseup',{button:2,bubbles:true}));const g=window.__game;g.input.poll();g.world.tick(1/60);});}
export const mouseLine=(a,b,n=80)=>Array.from({length:n+1},(_,i)=>[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]);
