// 目录与脚本共用ID；第一章直接定位手写剧情事件。
import { Serpent, Sparrow } from './stage1_boss';
import { Mirage } from './stage2_boss';
import { Leigong } from './stage3_leigong';
import { Kun, Peng } from './stage3_boss';
export interface TestCheckpoint { id: string; label: string; phases?: number; scroll: number }
export const waveCheckpoint = (i:number) => `W${String(i+1).padStart(2,'0')}`;
const wave = (id:string,i:number):TestCheckpoint => ({ id,label:id.startsWith('E')?`${id} · 现有段落`:`${id} · 遭遇${i+1}`,scroll:i*8.2*60 });
export const TEST_CHECKPOINTS: Record<number,TestCheckpoint[]> = {
  1: [{id:'start',label:'关卡开场',scroll:4300},
    ...['出港','第一波','屏障','劫机','喘息','大场面','急行','关前'].map((label,i)=>({id:`S${i+1}`,label:`S${i+1} · ${label}`,scroll:[4300,4500,5000,5300,6000,10600,11200,12000][i]})),
    {id:'SERPENT',label:'纸龙 · 中Boss',phases:Serpent.boss!.phases,scroll:9000},{id:'SPARROW',label:'铜雀 · Boss',phases:Sparrow.boss!.phases,scroll:12000}],
  2: [{id:'start',label:'关卡开场',scroll:0},...['灯河夜航','护送云梭·下游','打灭假航灯','屿长说来历','闸楼炮大场面','镜鱼突袭','急行横扫','云闸前九灯','蜃','章末'].map((label,i)=>({id:`C2.P${i+1}`,label:`C2.P${i+1} · ${label}`,scroll:i*2400})),
    {id:'MIRAGE',label:'蜃 · Boss',phases:Mirage.boss!.phases,scroll:24000}],
  3: [{id:'start',label:'关卡开场',scroll:0},...Array.from({length:48},(_,i)=>wave(waveCheckpoint(i),i)),
    {id:'LEIGONG',label:'雷公 · 中Boss',phases:Leigong.boss!.phases,scroll:13000},
    {id:'KUN',label:'鲲 · Boss',phases:Kun.boss!.phases,scroll:26000},{id:'PENG',label:'鹏 · Boss',phases:Peng.boss!.phases,scroll:26000}],
  4: [{id:'KUN',label:'鲲 · 现有终战',phases:Kun.boss!.phases,scroll:26000},{id:'PENG',label:'鹏 · 现有终战',phases:Peng.boss!.phases,scroll:26000}],
};
