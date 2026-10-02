// 目录与脚本共用ID；第一章E编号暂落在旧遭遇，P3-05重做时保留这些ID。
import { Serpent, Sparrow } from './stage1_boss';
import { Pagoda, Mirage } from './stage2_boss';
import { Leigong } from './stage3_leigong';
import { Kun, Peng } from './stage3_boss';
export interface TestCheckpoint { id: string; label: string; phases?: number; scroll: number }
const firstAliases: Record<number,string> = { 0:'E01',4:'E02',8:'E03',12:'E04',16:'E05',20:'E06',24:'E07',36:'E08',40:'E09',44:'E10' };
export const stage1Checkpoint = (i:number) => firstAliases[i] ?? `W${String(i+1).padStart(2,'0')}`;
export const waveCheckpoint = (i:number) => `W${String(i+1).padStart(2,'0')}`;
const wave = (id:string,i:number):TestCheckpoint => ({ id,label:id.startsWith('E')?`${id} · 现有段落`:`${id} · 遭遇${i+1}`,scroll:i*8.2*60 });
export const TEST_CHECKPOINTS: Record<number,TestCheckpoint[]> = {
  1: [{id:'start',label:'关卡开场',scroll:0},...Array.from({length:48},(_,i)=>wave(stage1Checkpoint(i),i)),
    {id:'SERPENT',label:'纸龙 · 中Boss',phases:Serpent.boss!.phases,scroll:18000},{id:'SPARROW',label:'铜雀 · Boss',phases:Sparrow.boss!.phases,scroll:25000}],
  2: [{id:'start',label:'关卡开场',scroll:0},...Array.from({length:64},(_,i)=>wave(waveCheckpoint(i),i)),
    {id:'PAGODA',label:'宝塔 · 中Boss',phases:Pagoda.boss!.phases,scroll:19000},{id:'MIRAGE',label:'蜃 · Boss',phases:Mirage.boss!.phases,scroll:30000}],
  3: [{id:'start',label:'关卡开场',scroll:0},...Array.from({length:48},(_,i)=>wave(waveCheckpoint(i),i)),
    {id:'LEIGONG',label:'雷公 · 中Boss',phases:Leigong.boss!.phases,scroll:13000},
    {id:'KUN',label:'鲲 · Boss',phases:Kun.boss!.phases,scroll:26000},{id:'PENG',label:'鹏 · Boss',phases:Peng.boss!.phases,scroll:26000}],
  4: [{id:'KUN',label:'鲲 · 现有终战',phases:Kun.boss!.phases,scroll:26000},{id:'PENG',label:'鹏 · 现有终战',phases:Peng.boss!.phases,scroll:26000}],
};
