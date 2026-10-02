// 把 SpriteDef（图片或 Canvas2D 绘制）烘焙进两张 TEXTURE_2D_ARRAY：本体（sRGB，预乘 alpha）与发光层。
import type { SpriteDef } from '../art/types';
import { drawSprite, loadSpriteImages, spriteFrames } from '../art/images';
import type { GL } from './util';

export interface SpriteFrame { layer: number; u0: number; v0: number; u1: number; v1: number }
export interface SpriteInfo {
  id: string;
  w: number;
  h: number;
  pivot: [number, number];
  frames: SpriteFrame[];
  anchors: Record<string, [number, number]>;
  radius: number;
  glow: boolean;
  /** 粗粒度碰撞遮罩：格边长 MASK_CELL 逻辑单位，行优先，格 (i,j) 覆盖 [-w/2+i*C, ...)×[-h/2+j*C, ...)；多帧取并集。 */
  mask: Uint8Array;
  maskW: number;
  maskH: number;
  /** 实心格到精灵中心的最大距离（逻辑单位）。 */
  maskR: number;
}

export const MASK_CELL = 4;
const MASK_ALPHA = 90;

/** 从本体 alpha 生成/合并碰撞遮罩（纹理中心 = 精灵原点）。 */
function bakeMask(info: SpriteInfo, data: Uint8ClampedArray, pw: number, ph: number, scale: number): void {
  const { maskW, maskH, w, h, mask } = info;
  for (let cj = 0; cj < maskH; cj++) {
    const y0 = Math.max(0, Math.round(ph / 2 + (-h / 2 + cj * MASK_CELL) * scale));
    const y1 = Math.min(ph, Math.max(y0 + 1, Math.round(ph / 2 + (-h / 2 + (cj + 1) * MASK_CELL) * scale)));
    for (let ci = 0; ci < maskW; ci++) {
      if (mask[cj * maskW + ci]) continue;
      const x0 = Math.max(0, Math.round(pw / 2 + (-w / 2 + ci * MASK_CELL) * scale));
      const x1 = Math.min(pw, Math.max(x0 + 1, Math.round(pw / 2 + (-w / 2 + (ci + 1) * MASK_CELL) * scale)));
      let solid = false;
      for (let y = y0; y < y1 && !solid; y++) {
        for (let x = x0, k = (y * pw + x0) * 4 + 3; x < x1; x++, k += 4) {
          if (data[k] >= MASK_ALPHA) { solid = true; break; }
        }
      }
      if (!solid) continue;
      mask[cj * maskW + ci] = 1;
      // 格最远角到中心的距离
      const fx = Math.max(Math.abs(-w / 2 + ci * MASK_CELL - info.pivot[0]), Math.abs(-w / 2 + (ci + 1) * MASK_CELL - info.pivot[0]));
      const fy = Math.max(Math.abs(-h / 2 + cj * MASK_CELL - info.pivot[1]), Math.abs(-h / 2 + (cj + 1) * MASK_CELL - info.pivot[1]));
      info.maskR = Math.max(info.maskR, Math.hypot(fx, fy));
    }
  }
}

const MISSING: SpriteDef = {
  id: '__missing',
  w: 40,
  h: 40,
  draw(ctx) {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(-20, -20, 40, 40);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, -20); ctx.lineTo(20, 20); ctx.moveTo(20, -20); ctx.lineTo(-20, 20);
    ctx.stroke();
  },
};

export class Atlas {
  readonly map = new Map<string, SpriteInfo>();
  albedo!: WebGLTexture;
  glow!: WebGLTexture;
  private warned = new Set<string>();

  constructor(readonly gl: GL) {}

  /** 烘焙全部精灵。scale = 纹理像素/逻辑单位。onProgress(0..1)。 */
  async build(defs: SpriteDef[], scale: number, onProgress?: (p: number) => void): Promise<void> {
    const gl = this.gl;
    const PAD = 12;
    const list = [...defs.filter((d) => !d.id.startsWith('preview_')), MISSING];
    const images = await loadSpriteImages(list);
    type Job = { def: SpriteDef; frame: number; pw: number; ph: number; x: number; y: number; layer: number };
    const jobs: Job[] = [];
    for (const def of list) {
      const n = spriteFrames(def);
      if (!Number.isInteger(n) || n < 1) throw new Error(`精灵 ${def.id} 帧数无效`);
      for (let f = 0; f < n; f++) {
        jobs.push({ def, frame: f, pw: Math.ceil(def.w * scale) + PAD * 2, ph: Math.ceil(def.h * scale) + PAD * 2, x: 0, y: 0, layer: 0 });
      }
    }
    // 货架式装箱：按高度降序
    const maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 4096);
    const order = jobs.slice().sort((a, b) => b.ph - a.ph);
    let layer = 0, x = 0, y = 0, rowH = 0;
    for (const j of order) {
      if (j.pw > maxTex || j.ph > maxTex) throw new Error(`精灵 ${j.def.id} 超出图集尺寸`);
      if (x + j.pw > maxTex) { x = 0; y += rowH; rowH = 0; }
      if (y + j.ph > maxTex) { layer++; x = 0; y = 0; rowH = 0; }
      j.x = x; j.y = y; j.layer = layer;
      x += j.pw;
      rowH = Math.max(rowH, j.ph);
    }
    const layers = layer + 1;
    const levels = Math.floor(Math.log2(maxTex)) + 1;
    const mk = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.SRGB8_ALPHA8, maxTex, maxTex, layers);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      if (aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
      return t;
    };
    this.albedo = mk();
    this.glow = mk();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    let last = performance.now();
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      if (canvas.width < j.pw || canvas.height < j.ph) {
        canvas.width = Math.max(canvas.width, j.pw);
        canvas.height = Math.max(canvas.height, j.ph);
      }
      let info = this.map.get(j.def.id);
      if (!info) {
        const mw = Math.ceil(j.def.w / MASK_CELL), mh = Math.ceil(j.def.h / MASK_CELL);
        info = {
          id: j.def.id, w: j.def.w, h: j.def.h, pivot: j.def.pivot ?? [0, 0], frames: [], anchors: j.def.anchors ?? {},
          radius: j.def.radius ?? Math.min(j.def.w, j.def.h) * 0.4, glow: !!j.def.glow,
          mask: new Uint8Array(mw * mh), maskW: mw, maskH: mh, maskR: 0,
        };
        this.map.set(j.def.id, info);
      }
      for (const kind of ['albedo', 'glow'] as const) {
        const fn = kind === 'albedo' ? j.def.draw : j.def.glow;
        if (kind === 'glow' && !fn) continue;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        ctx.clearRect(0, 0, j.pw, j.ph);
        if (kind === 'glow') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, j.pw, j.ph); }
        ctx.save();
        ctx.setTransform(scale, 0, 0, scale, j.pw / 2, j.ph / 2);
        ctx.beginPath();
        ctx.rect(-j.def.w / 2, -j.def.h / 2, j.def.w, j.def.h);
        ctx.clip();
        try {
          if (kind === 'albedo') drawSprite(ctx, j.def, j.frame, images);
          else fn!.call(j.def, ctx, j.frame);
        } catch (e) {
          console.error(`精灵 ${j.def.id} 绘制失败`, e);
        }
        ctx.restore();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, kind === 'albedo' ? this.albedo : this.glow);
        const img = ctx.getImageData(0, 0, j.pw, j.ph);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, j.x, j.y, j.layer, j.pw, j.ph, 1, gl.RGBA, gl.UNSIGNED_BYTE, img);
        if (kind === 'albedo') bakeMask(info, img.data, j.pw, j.ph, scale);
      }
      info.frames[j.frame] = {
        layer: j.layer,
        u0: (j.x + PAD) / maxTex, v0: (j.y + PAD) / maxTex,
        u1: (j.x + j.pw - PAD) / maxTex, v1: (j.y + j.ph - PAD) / maxTex,
      };
      if (performance.now() - last > 30) {
        onProgress?.(i / jobs.length);
        await new Promise((r) => setTimeout(r, 0));
        last = performance.now();
      }
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (const t of [this.albedo, this.glow]) {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    }
    onProgress?.(1);
  }

  get(id: string): SpriteInfo {
    const s = this.map.get(id);
    if (s) return s;
    if (!this.warned.has(id)) {
      this.warned.add(id);
      console.warn(`缺少精灵: ${id}`);
    }
    return this.map.get('__missing')!;
  }

  has(id: string): boolean {
    return this.map.has(id);
  }
}
