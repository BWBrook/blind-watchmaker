import type { Line, Rect } from './develop';

export type Pen = 'black' | 'white' | 'xor';

/** A 1-bit screen: 1 = black. Lines are drawn QuickDraw-style, stamping a square pen whose top-left sits on the path. */
export class Bitmap {
  readonly bits: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.bits = new Uint8Array(width * height);
  }

  fill(r: Rect, value: 0 | 1, clip?: Rect) {
    const c = intersect(r, clip ?? this.bounds());
    for (let y = c.top; y < c.bottom; y++) this.bits.fill(value, y * this.width + c.left, y * this.width + c.right);
  }

  frame(r: Rect, size = 1, clip?: Rect) {
    const { left, top, right, bottom } = r;
    this.fill({ left, top, right, bottom: top + size }, 1, clip);
    this.fill({ left, top: bottom - size, right, bottom }, 1, clip);
    this.fill({ left, top, right: left + size, bottom }, 1, clip);
    this.fill({ left: right - size, top, right, bottom }, 1, clip);
  }

  /** `exclude` lists rectangles the line must not touch (QuickDraw clipping to a region with holes). */
  line(l: Line, clip?: Rect, pen: Pen = 'black', exclude: Rect[] = []) {
    const c = intersect(clip ?? this.bounds(), this.bounds());
    const t = l.thick;
    const stamp = (x: number, y: number) => {
      if (exclude.some((r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) return;
      const x0 = Math.max(x, c.left);
      const x1 = Math.min(x + t, c.right);
      if (x0 >= x1) return;
      for (let yy = Math.max(y, c.top); yy < Math.min(y + t, c.bottom); yy++) {
        const row = yy * this.width;
        if (pen === 'xor') for (let xx = x0; xx < x1; xx++) this.bits[row + xx] ^= 1;
        else this.bits.fill(pen === 'black' ? 1 : 0, row + x0, row + x1);
      }
    };
    let x = l.x0;
    let y = l.y0;
    const dx = Math.abs(l.x1 - x);
    const dy = -Math.abs(l.y1 - y);
    const sx = x < l.x1 ? 1 : -1;
    const sy = y < l.y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      stamp(x, y);
      if (x === l.x1 && y === l.y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  bounds(): Rect {
    return { left: 0, top: 0, right: this.width, bottom: this.height };
  }
}

export const intersect = (a: Rect, b: Rect): Rect => ({
  left: Math.max(a.left, b.left),
  top: Math.max(a.top, b.top),
  right: Math.min(a.right, b.right),
  bottom: Math.min(a.bottom, b.bottom),
});
