import type { Renderer } from '../gl/renderer';

// 世界单位；GLSL 与岸边物件使用同一条河。uP3.x 留作横向镜头偏移。
export const RIVER = { center: 450, a: 150, b: 72, c: 28, fa: .0017, fb: .0039, fc: .0071, width: 124 };
export function scrollRiver(y: number): { x: number; width: number; slope: number } {
  const r = RIVER;
  return {
    x: r.center + r.a * Math.sin(y * r.fa) + r.b * Math.sin(y * r.fb + .8) + r.c * Math.sin(y * r.fc + 2),
    width: r.width + 24 * Math.sin(y * .0023 + .4) + 12 * Math.sin(y * .0053),
    slope: r.a * r.fa * Math.cos(y * r.fa) + r.b * r.fb * Math.cos(y * r.fb + .8) + r.c * r.fc * Math.cos(y * r.fc + 2),
  };
}

// Atlas 在启动时载入四件贴图；这里只提交精灵，没有每帧纹理或缓冲创建。
export function drawScrollTown(r: Renderer, scroll: number, reveal: number): void {
  const cameraX = r.bgParams[3][0];
  for (let row = Math.floor((scroll - 280) / 620); row <= Math.ceil((scroll + 1480) / 620); row++) {
    const wy = row * 620 + Math.sin(row * 4.1) * 95;
    const river = scrollRiver(wy), y = 1200 + scroll - wy;
    for (const side of [-1, 1]) {
      const x = river.x + side * (river.width + 146 + 24 * Math.sin(row * 2.3));
      if (Math.abs(x - 450) < 225 || x - cameraX < -220 || x - cameraX > 1120) continue;
      const willow = ((row + (side > 0 ? 1 : 0)) % 3 + 3) % 3 === 0;
      const variant = ((row % 2) + 2) % 2 ? 'houses-a' : 'houses-b';
      r.ground.add(`c2_scroll-${willow ? 'willow' : variant}`, {
        x: x - cameraX, y: y + side * 65, rot: willow ? row * .7 : Math.sin(row) * .1,
        alpha: .68 * (1 - reveal), sx: 1, sy: 1,
      });
    }
    // 河拐到侧边时才架桥；桥轴垂直于当地河流切线，两端伸入河岸。
    if (((row % 4) + 4) % 4 === 1 && Math.abs(river.x - 450) > 105) {
      r.ground.add('c2_scroll-bridge', { x: river.x - cameraX, y,
        rot: Math.atan(river.slope), sx: (river.width * 2 + 95) / 360, sy: .85, alpha: .62 * (1 - reveal) });
    }
  }
}
