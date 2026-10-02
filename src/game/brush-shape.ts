// 只识别横、竖；闭环由 Brush 优先处理，其余有效笔迹按墨刃结算。
import { segDist2 } from '../core/math';
export const BRUSH_FORMS=['横','竖'] as const;
export type BrushForm = typeof BRUSH_FORMS[number];
/** 读取旧测试设置时丢弃已删除或未知笔法。 */
export function filterBrushForms(value:unknown):BrushForm[]{return Array.isArray(value)?[...new Set(value.filter((v):v is BrushForm=>v==='横'||v==='竖'))]:[];}
export function identifyStroke(pts:number[]):BrushForm|null{
 if(pts.length<4)return null;
 // 用24单位间隔计算方向变化，避免高频手抖累积成折返；所有原始点仍检查30单位偏离。
 let length=0,lx=pts[0],ly=pts[1];
 for(let i=2;i<pts.length;i+=2){const d=Math.hypot(pts[i]-lx,pts[i+1]-ly);if(d>=24||i===pts.length-2){length+=d;lx=pts[i];ly=pts[i+1];}}
 if(length<40)return null;const end=pts.length-2,dx=pts[end]-pts[0],dy=pts[end+1]-pts[1],distance=Math.hypot(dx,dy);
 const straight=distance>=160&&length<=distance*1.2&&pts.every((_,i)=>i%2||segDist2(pts[i],pts[i+1],pts[0],pts[1],pts[end],pts[end+1])<=30**2);
 if(straight&&Math.abs(dy)<=Math.abs(dx)*Math.tan(Math.PI/9))return '横';
 if(straight&&Math.abs(dx)<=Math.abs(dy)*Math.tan(Math.PI/9))return '竖';
 return null;
}
