import type { Line, Rect } from '../engine/develop';
import type { Pen } from '../engine/raster';
import { BAR_H } from './menubar';
import { type FontName, SCREEN_H, SCREEN_W, type Screen } from './screen';

/** The borderless main window filling the screen below the menu bar; all drawing is in its local coordinates. */
export class MacWindow {
  static readonly LEFT = 2;
  static readonly TOP = BAR_H;
  readonly width = SCREEN_W - 4;
  readonly height = SCREEN_H - BAR_H - 2;

  constructor(private readonly screen: Screen) {}

  get bounds(): Rect {
    return { left: 0, top: 0, right: this.width, bottom: this.height };
  }

  /** Desk pattern in the margins, the window's 1 px frame, and the Mac's rounded screen corners. */
  drawDesk() {
    const s = this.screen;
    s.pattern({ left: 0, top: BAR_H, right: SCREEN_W, bottom: SCREEN_H });
    s.frame({ left: MacWindow.LEFT - 1, top: BAR_H - 1, right: SCREEN_W - 1, bottom: SCREEN_H - 1 });
    this.erase();
    roundCorners(s);
  }

  local(x: number, y: number): { x: number; y: number } | undefined {
    const lx = x - MacWindow.LEFT;
    const ly = y - MacWindow.TOP;
    return lx >= 0 && ly >= 0 && lx < this.width && ly < this.height ? { x: lx, y: ly } : undefined;
  }

  private g(r: Rect): Rect {
    return { left: r.left + MacWindow.LEFT, top: r.top + MacWindow.TOP, right: r.right + MacWindow.LEFT, bottom: r.bottom + MacWindow.TOP };
  }

  private clip(r?: Rect): Rect {
    const b = this.bounds;
    const c = r ?? b;
    return this.g({
      left: Math.max(c.left, 0),
      top: Math.max(c.top, 0),
      right: Math.min(c.right, b.right),
      bottom: Math.min(c.bottom, b.bottom),
    });
  }

  /** The window's whole content, for off-screen composition (pages, curtains, zoom). */
  save(): Uint8Array {
    return this.screen.save(this.g(this.bounds));
  }

  restore(data: Uint8Array, part: Rect = this.bounds) {
    this.screen.restorePart(this.g(this.bounds), data, this.clip(part));
  }

  blitScaled(data: Uint8Array, dest: Rect) {
    this.screen.blitScaled(this.g(this.bounds), data, this.g(dest));
  }

  erase(r: Rect = this.bounds) {
    this.screen.fill(this.clip(r), 0);
  }

  /** QuickDraw FrameRect: the frame lies inside the rectangle. */
  frame(r: Rect, size = 1, pen: 'black' | 'white' = 'black') {
    const c = this.clip();
    const { left, top, right, bottom } = this.g(r);
    const v = pen === 'black' ? 1 : 0;
    this.screen.fill({ left, top, right, bottom: top + size }, v, c);
    this.screen.fill({ left, top: bottom - size, right, bottom }, v, c);
    this.screen.fill({ left, top, right: left + size, bottom }, v, c);
    this.screen.fill({ left: right - size, top, right, bottom }, v, c);
  }

  invert(r: Rect) {
    this.screen.invert(this.clip(r));
  }

  line(l: Line, clip?: Rect, pen: Pen = 'black', exclude: Rect[] = []) {
    const dx = MacWindow.LEFT;
    const dy = MacWindow.TOP;
    const l2 = { ...l, x0: l.x0 + dx, y0: l.y0 + dy, x1: l.x1 + dx, y1: l.y1 + dy };
    this.screen.line(l2, this.clip(clip), pen, exclude.map((r) => this.g(r)));
  }

  grab(r: Rect): Uint8Array {
    return this.screen.grab(this.g(r));
  }

  put(r: Rect, data: Uint8Array) {
    this.screen.put(this.g(r), data, this.clip());
  }

  /** The window-local point under a global one, whether or not it is inside the window. */
  toLocal(x: number, y: number) {
    return { x: x - MacWindow.LEFT, y: y - MacWindow.TOP };
  }

  text(t: string, x: number, y: number, font: FontName = 'Geneva', clip?: Rect) {
    this.screen.text(t, x + MacWindow.LEFT, y + MacWindow.TOP, font, this.clip(clip));
  }

  glyph(g: string[], x: number, baseline: number, clip?: Rect) {
    this.screen.glyph(g, x + MacWindow.LEFT, baseline + MacWindow.TOP, this.clip(clip));
  }

  textWidth(t: string, font: FontName = 'Geneva') {
    return this.screen.textWidth(t, font);
  }
}

function roundCorners(s: Screen) {
  const r = 5;
  for (let i = 0; i < r; i++) {
    const w = r - Math.round(Math.sqrt(r * r - (r - i - 0.5) ** 2));
    for (const [x, y] of [
      [0, i],
      [SCREEN_W - w, i],
      [0, SCREEN_H - 1 - i],
      [SCREEN_W - w, SCREEN_H - 1 - i],
    ]) s.fill({ left: x, top: y, right: x + w, bottom: y + 1 }, 1);
  }
}
