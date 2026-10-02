import type { SpriteDef } from './types';
import { PLAYER_SPRITES } from './sprites_player';
import { COMMON_SPRITES } from './sprites_common';
import { STAGE1_SPRITES } from './sprites_stage1';
import { STAGE2_SPRITES } from './sprites_stage2';
import { STAGE3_SPRITES } from './sprites_stage3';
import { companionSprites } from './sprites_companions';
import { stage1ExtraSprites } from './sprites_stage1_extra';
import { stage2ExtraSprites } from './sprites_stage2_extra';
import { stage3ExtraSprites } from './sprites_stage3_extra';
import { PIPELINE_SPRITES } from './sprites_pipeline';
import { FX_SPRITES } from './sprites_fx';
import { applyCh1Art } from './sprites_ch1_art';

export const ALL_SPRITES: SpriteDef[] = [
  ...PLAYER_SPRITES,
  ...COMMON_SPRITES,
  ...STAGE1_SPRITES,
  ...STAGE2_SPRITES,
  ...STAGE3_SPRITES,
  ...companionSprites,
  ...stage1ExtraSprites,
  ...stage2ExtraSprites,
  ...stage3ExtraSprites,
  ...PIPELINE_SPRITES,
  ...FX_SPRITES,
];
applyCh1Art(ALL_SPRITES);
