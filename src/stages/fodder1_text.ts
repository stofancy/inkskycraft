// 第四稿只保留主线五位说话人；炮灰身份仍供战斗脚本使用。
export const FODDER_TEXT={
 周网:{},
 钱耗:{},
 老鸹:{},
 小铃:{},
 大牛:{},
 二牛:{},
 赵怂:{},
 吴领队:{},
 麻三:{},
 阿豆:{},
 老耿:{},
};
export type FodderName=keyof typeof FODDER_TEXT;
// 气泡上显示的名字。
export const FODDER_NAME:Record<FodderName,string>={周网:'线头',钱耗:'泥鳅',老鸹:'灰鹞',小铃:'哨子',大牛:'大锤',二牛:'二锤',赵怂:'蔫头',吴领队:'炮仗',麻三:'麻杆',阿豆:'二愣',老耿:'老篾'};
