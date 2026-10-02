// 按敌机类别统一放大：以玩家机身约 64 像素为基准，小杂鱼 1.1–1.3 倍、中型 1.6–2 倍、小头目 3 倍以上。
// 判定半径随 scaleX/scaleY 一起放大。带分件或场景挂件的敌机不在表内，另行处理。
export const ENEMY_SCALE:Record<string,number>={
 // 小杂鱼（目标约 70–85 px）
 e_hornet:1.5,e_sealbee:1.3,e_moth:1.2,e_lantern:1.5,e_lancer:1.4,e_tideshuttle:1.3,s3_node:1.3,
 // 中型（目标约 100–130 px）
 e_drum:1.8,e_kite:1.3,e_crane:1.7,e_rotor:2,e_turret:1.6,e_turtle:1.2,e_mirrorfish:1.15,
 // 小头目（目标 190 px 以上）
 'story_carrier-body':1.4,
};
