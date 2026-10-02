import { PAPER_DECOY } from './sprites_skills';
import { SKY_SPRITES } from './sprites_sky';
import { CH1_FODDER_SPRITES } from './sprites_ch1_fodder';
import { CH2_STORY_SPRITES } from './ch2_story_assets';
import { CH1_AIR_SPRITES } from './sprites_ch1_air';
import { STORY_SPRITES } from './sprites_ch1_story';
import { LETTER_SPRITES } from './lettering';
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
import { CH1_BOSS_SPRITES } from './sprites_boss_ch1';
import { applyCh2Art } from './sprites_ch2_art';
import { applyCh1Art } from './sprites_ch1_art';

const SKILL_PARTS:SpriteDef[]=['chaifa','tishen','zhongpao','shenying','bilei'].map(id=>({id:`skill_part_${id}`,w:48,h:48,image:`art/icons/skills/${id}.png`}));
export const ALL_SPRITES: SpriteDef[] = [
  PAPER_DECOY, ...SKY_SPRITES, ...SKILL_PARTS, ...STORY_SPRITES, ...CH1_FODDER_SPRITES, ...CH1_AIR_SPRITES, ...CH2_STORY_SPRITES,
  ...PLAYER_SPRITES,
  ...['red','blue','purple'].map(color=>({...PLAYER_SPRITES[0],id:`player_body_${color}`})),
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
  ...CH1_BOSS_SPRITES,
  ...LETTER_SPRITES,
];
applyCh1Art(ALL_SPRITES);applyCh2Art(ALL_SPRITES);
