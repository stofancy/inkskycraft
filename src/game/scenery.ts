/** 关卡友方与场景精灵；没有受击、碰撞、奖励或敌人身份。 */
export interface Scenery {
 sprite:string; x:number; y:number; rot:number; sx:number; sy:number; alpha:number;
 owner?:{dead:boolean}; frame:number; fps:number; glow:number; layer:'ground'|'air'|'front'; dead:boolean;
 /** 由玩家真实落笔留下的场景墨迹，只有表现，不重复伤害或清弹。 */
 stroke?:{pts:number[];reveal:number};
}
