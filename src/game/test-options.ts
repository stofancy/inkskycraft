// 测试菜单与玩法岗位的接入契约。未实装项由 capabilities 控制置灰。
import type { CompanionKind } from './companion';
export type BrushMethod = '横' | '竖' | '点' | '折' | '钩' | '撇捺';
export interface TestRunOptions {
  chapter: number;
  checkpoint: string;
  bossPhase: number;
  god: boolean;
  fullInk: boolean;
  fullBombs: boolean;
  brushPower: 1 | 2 | 3;
  brushMethods: BrushMethod[];
  bombGrowth: { blankRadius: boolean; blankDuration: boolean; extraDragon: boolean; stampField: boolean };
  companions: CompanionKind[];
  passives: string[];
}
export const TEST_CAPABILITIES = { brushPower: false, brushMethods: false, bombGrowth: false };
export function defaultTestOptions(): TestRunOptions {
  return { chapter: 1, checkpoint: 'start', bossPhase: 1, god: false, fullInk: false, fullBombs: false,
    brushPower: 1, brushMethods: [], bombGrowth: { blankRadius: false, blankDuration: false, extraDragon: false, stampField: false },
    companions: [], passives: [] };
}
