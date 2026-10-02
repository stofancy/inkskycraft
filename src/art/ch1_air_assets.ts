/** P4-08 正式素材契约：画布、安装锚点、状态段与投弹事件统一读入库元数据。 */
import type { SpriteDef } from './types';
import type { PlaybackSpec } from './playback';
interface SheetMeta {image:string;columns:number;rows:number;count:number;fps:number;runtimeSize:[number,number];pivot:[number,number];anchors:Record<string,[number,number]>;segments:Record<string,PlaybackSpec & {start:number}>}
const sheets=import.meta.glob('/public/art/enemies/ch1/{workship,bomber,net-pylon}/sheet.json',{eager:true,import:'default'});
const sheet=(kind:string)=>sheets[`/public/art/enemies/ch1/${kind}/sheet.json`] as SheetMeta;
const ship=sheet('workship'),bomber=sheet('bomber'),post=sheet('net-pylon');
export const CH1_AIR_ART = {
 ship:{atlas:'air_ship',...ship,stateSegments:{healthy:ship.segments.intact,smoke:ship.segments.smoke,leak:ship.segments.rightBagBroken,sinking:ship.segments.sinking}},
 post:{atlas:'air_net-post',...post},
 net:{atlas:'air_net',image:'art/textures/ch1/story/interception-net-tile.png',runtimeSize:[72,64] as const,tileStep:71},
 brokenNet:{atlas:'air_net-broken',image:'art/textures/ch1/story/interception-net-broken.png',runtimeSize:[640,64] as const},
 bomber:{atlas:'air_bomber',...bomber},
 bomb:{atlas:'air_bomb',image:'art/enemies/ch1/bomber/bomb.png',runtimeSize:[32,44] as const},
} as const;

/** P4-23 到货后在这里替换 sprite / tint；当前复用已入库机体。 */
export const CH1_FODDER_ART:Record<string,{sprite:string;tint:[number,number,number];asset?:Omit<SpriteDef,'id'>}>={
 周网:{sprite:'e_hornet',tint:[.65,.8,1]},钱耗:{sprite:'e_hornet',tint:[1,.85,.35]},
 老鸹:{sprite:'e_turret',tint:[.6,.7,.85]},小铃:{sprite:'e_crane',tint:[1,.4,.35]},
 大牛:{sprite:'e_turret',tint:[1,.85,.55]},二牛:{sprite:'e_turret',tint:[1,.4,.35]},
 赵怂:{sprite:'e_hornet',tint:[.8,.9,1]},吴领队:{sprite:CH1_AIR_ART.bomber.atlas,tint:[1,.45,.4]},
 麻三:{sprite:'e_hornet',tint:[.7,.75,.55]},阿豆:{sprite:'e_hornet',tint:[1,.9,.5]},老耿:{sprite:'e_mountainape',tint:[.8,.6,.35]},
};
/** 装饰的 atlas / 运行尺寸 / 图片路径也集中在此表；没有 image 时使用临时绘制。 */
export const CH1_DECOR_ART:Record<string,{sprite:string;w:number;h:number;image?:string;asset?:Omit<SpriteDef,'id'>}>={
 clothes:{sprite:'fodder_clothes',w:160,h:90},sign:{sprite:'fodder_sign',w:95,h:70},egret:{sprite:'fodder_egret',w:66,h:34},
 walkers:{sprite:'fodder_walkers',w:150,h:85},waterfall:{sprite:'fodder_waterfall',w:100,h:300},fisher:{sprite:'fodder_fisher',w:140,h:85},
 leaves:{sprite:'fodder_leaves',w:170,h:130},flag:{sprite:'fodder_flag',w:50,h:60},lamp:{sprite:'fodder_lamp',w:38,h:110},
 bell:{sprite:'fodder_bell',w:45,h:60},workers:{sprite:'fodder_workers',w:130,h:70},parachute:{sprite:'fodder_parachute',w:70,h:85},
 signal:{sprite:'fodder_signal',w:55,h:90},letter:{sprite:'fodder_letter',w:32,h:26},whiteFlag:{sprite:'fodder_whiteFlag',w:40,h:50},
};
