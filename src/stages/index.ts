import type { StageDef } from './types';
import { STAGE1 } from './stage1';
import { STAGE2 } from './stage2';
import { STAGE3 } from './stage3';
import { TEST_STAGE } from './test';

/** 正式关卡按顺序排列。 */
export const STAGES: StageDef[] = [STAGE1, STAGE2, STAGE3];
export { TEST_STAGE };
