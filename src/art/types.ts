/**
 * 图片或程序化精灵定义。启动时加载、绘制进 WebGL 纹理图集。
 *
 * 绘制约定：
 * - ctx 已变换：画布原点 = 矩形中心，1 单位 = 1 游戏区单位（游戏区 900x1200）。
 *   运行时原点由 pivot 决定，默认位于矩形中心。
 *   精灵范围为 [-w/2, w/2] x [-h/2, h/2]，超出部分会被裁掉。
 * - 朝向：玩家机头朝上（-y）；敌人与 Boss 默认机头朝下（+y，朝向玩家）。
 * - draw 画本体（带透明度的颜色）；glow 在黑底上画自发光部分，颜色即发光色，
 *   渲染器会以 HDR 强度叠加并产生泛光。glow 只画真正发光的部分（引擎、核心、霓虹缝）。
 * - 需要左右镜像的部件（翼、壳）只画左半件，渲染时用 scaleX=-1 得到右半件。
 */
import type { PlaybackSpec } from './playback';

export interface SpriteSheet extends PlaybackSpec {
  image: string;
  columns: number;
  rows: number;
}

export interface SpriteDef {
  id: string;
  w: number;
  h: number;
  /** 动画帧数，默认 1。draw/glow 会按帧分别调用。 */
  frames?: number;
  /** 同源 public/art 路径；数组为序列帧。加载失败时使用 draw。 */
  image?: string | string[];
  /** 启动烘焙时的调色，运行时复用图集。 */
  imageFilter?: string;
  /** 单张分镜，等格按行播放。可用 sheet.mjs 输出的对齐图和元数据。 */
  sheet?: SpriteSheet;
  /** 图片每帧在矩形内的缩放，默认 1。 */
  imageScale?: number[];
  /** 此精灵的最低烘焙密度（像素/逻辑单位），用于保留小机体原图细节。 */
  textureScale?: number;
  /** 原点相对图片矩形中心的位置，逻辑单位。挂点坐标均相对这个原点。 */
  pivot?: [number, number];
  draw?(ctx: CanvasRenderingContext2D, frame: number): void;
  glow?(ctx: CanvasRenderingContext2D, frame: number): void;
  /**
   * 命名挂点（精灵本地坐标，未镜像状态）：炮口、炮塔座、部件连接点、引擎喷口等。
   * 关卡脚本用它来对齐弹幕发射点和部件位置。
   */
  anchors?: Record<string, [number, number]>;
  /** 碰撞半径建议值（单位）。 */
  radius?: number;
  /** 换美术时保留原精灵的碰撞遮罩。 */
  maskSource?: SpriteDef;
}
