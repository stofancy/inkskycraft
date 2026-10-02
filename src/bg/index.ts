import type { BgDef } from './header';
import { BG_STAGE1 } from './stage1';
import { BG_STAGE2 } from './stage2';
import { BG_STAGE3 } from './stage3';
import { BG_TITLE } from './title';
export { FRAME_FRAG } from './frame';

export const BACKGROUNDS: Record<string, BgDef> = {
  stage1: BG_STAGE1,
  stage2: BG_STAGE2,
  stage3: BG_STAGE3,
  title: BG_TITLE,
};
