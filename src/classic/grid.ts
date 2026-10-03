import type { Rect } from '../engine/develop';
import { STRIP_H } from './genestrip';

/** Box layout below the gene strip, following SetUpBoxes; k is 0-based, row-major. */
export class Grid {
  constructor(
    readonly rows: number,
    readonly cols: number,
    readonly width: number,
    readonly height: number,
  ) {}

  get n() {
    return this.rows * this.cols;
  }

  /** The centre box (MidBox = NBoxes DIV 2 + 1, 1-based). */
  get mid() {
    return this.n >> 1;
  }

  get boxW() {
    return Math.floor(this.width / this.cols);
  }

  get boxH() {
    return Math.floor((this.height - STRIP_H) / this.rows);
  }

  box(k: number): Rect {
    const left = this.boxW * (k % this.cols);
    const top = STRIP_H + this.boxH * Math.floor(k / this.cols);
    return { left, top, right: left + this.boxW, bottom: top + this.boxH };
  }

  centre(k: number) {
    const b = this.box(k);
    return { h: b.left + (this.boxW >> 1), v: b.top + (this.boxH >> 1) };
  }

  /** The union of all boxes (QuickDraw's "businessPart"). */
  business(): Rect {
    return { left: 0, top: STRIP_H, right: this.boxW * this.cols, bottom: STRIP_H + this.boxH * this.rows };
  }

  boxAt(x: number, y: number): number {
    const b = this.business();
    if (x < b.left || x >= b.right || y < b.top || y >= b.bottom) return -1;
    return Math.floor((y - STRIP_H) / this.boxH) * this.cols + Math.floor(x / this.boxW);
  }
}
