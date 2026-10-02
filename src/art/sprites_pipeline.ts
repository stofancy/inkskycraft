// P0 技术演示素材，复用曜雀原图的矩形切片；创意定稿交美术岗位。
import type { SpriteDef } from './types';

export const PIPELINE_SPRITES: SpriteDef[] = [
  { id: 'pipeline_enemy', w: 144, h: 144, image: 'art/companions/qingli.png', radius: 12, anchors: { muzzle: [0, 45] } },
  { id: 'pipeline_body', w: 70.4, h: 198, image: 'art/pipeline/bird-body.png', pivot: [-1.1, 29.7], radius: 18,
    anchors: { wingL: [-36.85, 5.5], tail: [0, 69.3], muzzle: [0, -110] } },
  { id: 'pipeline_wing', w: 212.3, h: 260.7, image: 'art/pipeline/bird-wing.png', pivot: [102.3, 45.1], radius: 0,
    anchors: { root: [0, 0], muzzle: [-110, 10] } },
  { id: 'pipeline_tail', w: 227.15, h: 227.15, image: 'art/pipeline/bird-tail.png', pivot: [-1.925, -113.575], radius: 0,
    anchors: { root: [0, 0] } },
];
