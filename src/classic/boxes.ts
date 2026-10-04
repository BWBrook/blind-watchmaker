import type { Rect } from '../engine/develop';

export const inRect = (r: Rect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

export const inset = (r: Rect, d: number): Rect => ({
  left: r.left + d,
  top: r.top + d,
  right: r.right - d,
  bottom: r.bottom - d,
});

export const centreOf = (r: Rect) => ({ h: r.left + ((r.right - r.left) >> 1), v: r.top + ((r.bottom - r.top) >> 1) });

/** AtLeast: grow the box by 3 px, then widen it to whole bytes (multiples of 8) on both sides. */
export function atLeast(r: Rect): Rect {
  const o = inset(r, -3);
  while (o.left % 8) o.left -= 1;
  while (o.right % 8) o.right += 1;
  return o;
}

/** OwnCursor's CopyBits: the part `r` of a 1-bit image `width` pixels wide, sampled into 16 x 16. */
export function shrink16(bits: Uint8Array, width: number, r: Rect): Uint8Array {
  const w = r.right - r.left;
  const h = r.bottom - r.top;
  const out = new Uint8Array(256);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      out[y * 16 + x] = bits[(r.top + Math.floor((y * h) / 16)) * width + r.left + Math.floor((x * w) / 16)];
    }
  }
  return out;
}
