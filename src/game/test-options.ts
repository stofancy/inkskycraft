// 测试菜单与玩法岗位的接入契约。未实装项由 capabilities 控制置灰。
import type { WeaponColor } from '../types';
import type { CompanionKind } from './companion';
import { SKILL_IDS, type SkillId } from './skills';
import { BRUSH_FORMS, type BrushForm } from './brush-shape';
import { TALENTS } from './progression';
export type BrushMethod = BrushForm;
export interface TestRunOptions {
  bombColor:WeaponColor;
  inkScore:Record<WeaponColor,number>;
  chapter: number;
  checkpoint: string;
  bossPhase: number;
  god: boolean;
  allSkills?: boolean;
  fullInk: boolean;
  fullBombs: boolean;
  brushPower: 1 | 2 | 3;
  brushMethods: BrushMethod[];
  skills:SkillId[];
  companions: CompanionKind[];
  passives: string[];
}
export const TEST_CAPABILITIES = { brushPower: true, brushMethods: true };
// 制作人 10-02：测试模式默认能开的全开，需要时再手动关。
export function defaultTestOptions(): TestRunOptions {
  return { bombColor:'red',inkScore:{red:3,blue:3,purple:3},chapter: 1, checkpoint: 'start', bossPhase: 1, god: true, allSkills:true, fullInk: true, fullBombs: true,
    brushPower: 3, brushMethods: [...BRUSH_FORMS], skills:[...SKILL_IDS],
    companions: ['chiyan','laodun'], passives: TALENTS.map(t=>t.id) };
}
