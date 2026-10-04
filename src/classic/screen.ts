import type { Line, Rect } from '../engine/develop';
import { Bitmap, intersect, type Pen } from '../engine/raster';
import type { Glyph } from './glyphs';
import chicagoUrl from './fonts/ChiKareGo2.woff2?url';
import genevaUrl from './fonts/FindersKeepers.woff2?url';

export type FontName = 'Chicago' | 'Geneva';

const FONT_CSS: Record<FontName, string> = { Chicago: '16px Chicago12', Geneva: '16px Geneva9' };

export async function loadFonts() {
  const faces = [new FontFace('Chicago12', `url(${chicagoUrl})`), new FontFace('Geneva9', `url(${genevaUrl})`)];
  for (const f of faces) document.fonts.add(await f.load());
}

export const SCREEN_W = 512;
export const SCREEN_H = 342;

/** The whole Mac screen as one 1-bit framebuffer, blitted to a canvas that CSS scales with nearest-neighbour sampling. */
export class Screen {
  readonly bitmap = new Bitmap(SCREEN_W, SCREEN_H);
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly scratch = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  private dirty = true;

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    this.ctx = canvas.getContext('2d')!;
    this.image = this.ctx.createImageData(SCREEN_W, SCREEN_H);
  }

  present() {
    if (!this.dirty) return;
    const px = new Uint32Array(this.image.data.buffer);
    const bits = this.bitmap.bits;
    for (let i = 0; i < bits.length; i++) px[i] = bits[i] ? 0xff000000 : 0xffffffff;
    this.ctx.putImageData(this.image, 0, 0);
    this.dirty = false;
  }

  fill(r: Rect, value: 0 | 1, clip?: Rect) {
    this.bitmap.fill(r, value, clip);
    this.dirty = true;
  }

  frame(r: Rect, size = 1, clip?: Rect) {
    this.bitmap.frame(r, size, clip);
    this.dirty = true;
  }

  line(l: Line, clip?: Rect, pen: Pen = 'black', exclude: Rect[] = []) {
    this.bitmap.line(l, clip, pen, exclude);
    this.dirty = true;
  }

  /** The pixels of r (0 where r leaves the screen). */
  grab(r: Rect): Uint8Array {
    const bm = this.bitmap;
    const w = r.right - r.left;
    const out = new Uint8Array(w * (r.bottom - r.top));
    for (let y = Math.max(r.top, 0); y < Math.min(r.bottom, bm.height); y++) {
      for (let x = Math.max(r.left, 0); x < Math.min(r.right, bm.width); x++) out[(y - r.top) * w + x - r.left] = bm.bits[y * bm.width + x];
    }
    return out;
  }

  /** CopyBits a grabbed image back into r, clipped. */
  put(r: Rect, data: Uint8Array, clip?: Rect) {
    const bm = this.bitmap;
    const c = intersect(intersect(r, clip ?? bm.bounds()), bm.bounds());
    const w = r.right - r.left;
    for (let y = c.top; y < c.bottom; y++) {
      for (let x = c.left; x < c.right; x++) bm.bits[y * bm.width + x] = data[(y - r.top) * w + x - r.left];
    }
    this.dirty = true;
  }

  /** 50% grey: QuickDraw's "gray" pattern, black where x+y is even. */
  pattern(r: Rect) {
    const bm = this.bitmap;
    const c = intersect(r, bm.bounds());
    for (let y = c.top; y < c.bottom; y++) {
      for (let x = c.left; x < c.right; x++) bm.bits[y * bm.width + x] = (x + y) & 1 ? 0 : 1;
    }
    this.dirty = true;
  }

  /** Dims whatever is drawn in r, as the Menu Manager does for disabled items. */
  dim(r: Rect) {
    const bm = this.bitmap;
    const c = intersect(r, bm.bounds());
    for (let y = c.top; y < c.bottom; y++) {
      for (let x = c.left; x < c.right; x++) if ((x + y) & 1) bm.bits[y * bm.width + x] = 0;
    }
    this.dirty = true;
  }

  invert(r: Rect) {
    const bm = this.bitmap;
    const c = intersect(r, bm.bounds());
    for (let y = c.top; y < c.bottom; y++) {
      for (let x = c.left; x < c.right; x++) bm.bits[y * bm.width + x] ^= 1;
    }
    this.dirty = true;
  }

  /** XORs a dotted grey outline, as DragWindow, GrowWindow and thumb dragging draw. */
  xorOutline(r: Rect) {
    const bm = this.bitmap;
    const plot = (x: number, y: number) => {
      if (x >= 0 && y >= 0 && x < bm.width && y < bm.height && !((x + y) & 1)) bm.bits[y * bm.width + x] ^= 1;
    };
    for (let x = r.left; x < r.right; x++) {
      plot(x, r.top);
      plot(x, r.bottom - 1);
    }
    for (let y = r.top + 1; y < r.bottom - 1; y++) {
      plot(r.left, y);
      plot(r.right - 1, y);
    }
    this.dirty = true;
  }

  save(r: Rect): Uint8Array {
    const bm = this.bitmap;
    const w = r.right - r.left;
    const out = new Uint8Array(w * (r.bottom - r.top));
    for (let y = r.top; y < r.bottom; y++) {
      out.set(bm.bits.subarray(y * bm.width + r.left, y * bm.width + r.right), (y - r.top) * w);
    }
    return out;
  }

  restore(r: Rect, data: Uint8Array) {
    const bm = this.bitmap;
    const w = r.right - r.left;
    for (let y = r.top; y < r.bottom; y++) bm.bits.set(data.subarray((y - r.top) * w, (y - r.top + 1) * w), y * bm.width + r.left);
    this.dirty = true;
  }

  /** Copies part of a buffer captured by save(from) back to the screen. */
  restorePart(from: Rect, data: Uint8Array, part: Rect) {
    const bm = this.bitmap;
    const w = from.right - from.left;
    const c = intersect(part, from);
    for (let y = c.top; y < c.bottom; y++) {
      const src = (y - from.top) * w + (c.left - from.left);
      bm.bits.set(data.subarray(src, src + c.right - c.left), y * bm.width + c.left);
    }
    this.dirty = true;
  }

  /** CopyBits with scaling: shrinks a buffer captured by save(from) into dest by sampling, as srcCopy does. */
  blitScaled(from: Rect, data: Uint8Array, dest: Rect) {
    const bm = this.bitmap;
    const sw = from.right - from.left;
    const sh = from.bottom - from.top;
    const dw = dest.right - dest.left;
    const dh = dest.bottom - dest.top;
    for (let y = 0; y < dh; y++) {
      const sy = Math.floor((y * sh) / dh);
      for (let x = 0; x < dw; x++) {
        bm.bits[(dest.top + y) * bm.width + dest.left + x] = data[sy * sw + Math.floor((x * sw) / dw)];
      }
    }
    this.dirty = true;
  }

  textWidth(text: string, font: FontName = 'Chicago'): number {
    this.scratch.font = FONT_CSS[font];
    return Math.round(this.scratch.measureText(text).width);
  }

  /** Draws text with its baseline at y. Pixel fonts at 16px land exactly on the pixel grid, so thresholding is lossless. */
  text(text: string, x: number, y: number, font: FontName = 'Chicago', clip?: Rect, pen: Pen = 'black') {
    if (!text) return;
    const w = this.textWidth(text, font) + 2;
    const h = 16;
    const asc = 12;
    const s = this.scratch;
    if (s.canvas.width < w || s.canvas.height < h) {
      s.canvas.width = Math.max(s.canvas.width, w);
      s.canvas.height = h;
    }
    s.clearRect(0, 0, s.canvas.width, s.canvas.height);
    s.font = FONT_CSS[font];
    s.fillStyle = '#000';
    s.fillText(text, 0, asc);
    const data = s.getImageData(0, 0, w, h).data;
    this.blit(x, y - asc, w, h, (i) => data[i * 4 + 3] >= 128, clip, pen);
  }

  glyph(g: Glyph, x: number, baseline: number, clip?: Rect, pen: Pen = 'black') {
    const w = g[0].length;
    this.blit(x, baseline - g.length + 1, w, g.length, (i) => g[Math.floor(i / w)][i % w] === '#', clip, pen);
  }

  private blit(x: number, y: number, w: number, h: number, on: (i: number) => boolean, clip: Rect | undefined, pen: Pen) {
    const bm = this.bitmap;
    const c = intersect(clip ?? bm.bounds(), bm.bounds());
    for (let yy = 0; yy < h; yy++) {
      const py = y + yy;
      if (py < c.top || py >= c.bottom) continue;
      for (let xx = 0; xx < w; xx++) {
        const px = x + xx;
        if (px < c.left || px >= c.right || !on(yy * w + xx)) continue;
        const i = py * bm.width + px;
        bm.bits[i] = pen === 'xor' ? bm.bits[i] ^ 1 : pen === 'black' ? 1 : 0;
      }
    }
    this.dirty = true;
  }

  frameRound(r: Rect, radius: number, size = 1) {
    for (let k = 0; k < size; k++) {
      const rr = { left: r.left + k, top: r.top + k, right: r.right - k, bottom: r.bottom - k };
      const rad = Math.max(radius - k, 0);
      const { left, top, right, bottom } = rr;
      this.fill({ left: left + rad, top, right: right - rad, bottom: top + 1 }, 1);
      this.fill({ left: left + rad, top: bottom - 1, right: right - rad, bottom }, 1);
      this.fill({ left, top: top + rad, right: left + 1, bottom: bottom - rad }, 1);
      this.fill({ left: right - 1, top: top + rad, right, bottom: bottom - rad }, 1);
      for (let i = 0; i < rad; i++) {
        const dy = rad - i - 0.5;
        const dx = Math.round(rad - Math.sqrt(rad * rad - dy * dy));
        const prev = i === 0 ? rad : Math.round(rad - Math.sqrt(rad * rad - (dy + 1) * (dy + 1)));
        const from = Math.min(dx, prev);
        for (let x = from; x <= Math.max(dx, prev - 1, from); x++) {
          for (const [px, py] of [
            [left + x, top + i],
            [right - 1 - x, top + i],
            [left + x, bottom - 1 - i],
            [right - 1 - x, bottom - 1 - i],
          ]) this.fill({ left: px, top: py, right: px + 1, bottom: py + 1 }, 1);
        }
      }
    }
  }
}
