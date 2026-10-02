import { Ease, type EaseName } from './math';

/** 周期动画：phase 为弧度，period 为秒，正弦天然在端点减速。 */
export interface Oscillation { amplitude: number; period: number; phase?: number; center?: number; ease?: EaseName }
export interface BoneAnimation { rot?: Oscillation; x?: Oscillation; y?: Oscillation }

export function oscillate(track: Oscillation | undefined, time: number): number {
  if (!track) return 0;
  if (track.period <= 0) throw new Error('动画周期须大于 0');
  let wave = Math.sin(time * Math.PI * 2 / track.period + (track.phase ?? 0));
  if (track.ease) wave = Ease[track.ease]((wave + 1) / 2) * 2 - 1;
  return (track.center ?? 0) + track.amplitude * wave;
}
