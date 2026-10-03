import type { Rect } from '../engine/develop';
import type { Glyph } from './glyphs';
import { BAR_H } from './menubar';
import { SCREEN_H, SCREEN_W, type Screen } from './screen';

/** Window Manager / Control Manager part codes for the Fossils window. */
export type Part = 'drag' | 'goAway' | 'grow' | 'up' | 'down' | 'pageUp' | 'pageDown' | 'thumb' | 'content';

const SB = 16;
const TITLE_H = 19;
const MIN_W = 50;
const MIN_H = 20;

const UP: Glyph = [
  '......#......',
  '.....#.#.....',
  '....#...#....',
  '...#.....#...',
  '..#.......#..',
  '.#.........#.',
  '####.....####',
  '...#.....#...',
  '...#.....#...',
  '...#######...',
];

const UP_FILLED: Glyph = UP.map((row) => {
  const first = row.indexOf('#');
  const last = row.lastIndexOf('#');
  return row.slice(0, first) + '#'.repeat(last - first + 1) + row.slice(last + 1);
});

const flip = (g: Glyph): Glyph => [...g].reverse();

const inRect = (r: Rect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

/** The "Fossils" document window: title bar, close box, a vertical scroll bar and a grow box. Global coordinates. */
export class FossilWindow {
  /** The content rectangle; created at (52,90)-(460,290) on a 512 x 342 screen. */
  content: Rect = { left: 52, top: 90, right: 460, bottom: 290 };
  value = 0;
  max = 0;

  constructor(private readonly screen: Screen) {}

  /** Everything the window covers, shadow included. */
  get structure(): Rect {
    const c = this.content;
    return { left: c.left - 1, top: c.top - TITLE_H, right: c.right + 2, bottom: c.bottom + 2 };
  }

  get scrollBar(): Rect {
    const c = this.content;
    return { left: c.right - (SB - 1), top: c.top - 1, right: c.right + 1, bottom: c.bottom + 1 - (SB - 1) };
  }

  /** PlayBackRect: the content less the scroll bar and the (empty) horizontal scroll-bar strip. */
  get picture(): Rect {
    const c = this.content;
    return { left: c.left, top: c.top, right: c.right - SB - 1, bottom: c.bottom - SB - 1 };
  }

  get midPoint() {
    const p = this.picture;
    return { h: p.left + ((p.right - p.left) >> 1), v: p.top + ((p.bottom - p.top) >> 1) };
  }

  private get closeBox(): Rect {
    const c = this.content;
    return { left: c.left + 8, top: c.top - 15, right: c.left + 19, bottom: c.top - 4 };
  }

  private get upArrow(): Rect {
    const s = this.scrollBar;
    return { left: s.left, top: s.top, right: s.right, bottom: s.top + SB };
  }

  private get downArrow(): Rect {
    const s = this.scrollBar;
    return { left: s.left, top: s.bottom - SB, right: s.right, bottom: s.bottom };
  }

  private get growBox(): Rect {
    const c = this.content;
    return { left: c.right - (SB - 1), top: c.bottom - (SB - 1), right: c.right + 1, bottom: c.bottom + 1 };
  }

  thumbTop(value = this.value): number {
    const track = this.downArrow.top - this.upArrow.bottom - SB;
    return this.upArrow.bottom + (this.max > 0 ? Math.round((value * track) / this.max) : 0);
  }

  get thumb(): Rect {
    const s = this.scrollBar;
    const top = this.thumbTop();
    return { left: s.left, top, right: s.right, bottom: top + SB };
  }

  /** The control value for a thumb dragged so that its top sits at y. */
  valueForThumb(y: number): number {
    const track = this.downArrow.top - this.upArrow.bottom - SB;
    return track > 0 ? Math.round(((y - this.upArrow.bottom) * this.max) / track) : 0;
  }

  thumbLimits(): [number, number] {
    return [this.upArrow.bottom, this.downArrow.top - SB];
  }

  partAt(x: number, y: number): Part | undefined {
    const c = this.content;
    if (inRect(this.closeBox, x, y)) return 'goAway';
    if (inRect({ left: c.left - 1, top: c.top - TITLE_H, right: c.right + 1, bottom: c.top - 1 }, x, y)) return 'drag';
    if (inRect(this.growBox, x, y)) return 'grow';
    if (inRect(this.scrollBar, x, y)) {
      if (this.max <= 0) return 'content';
      if (inRect(this.upArrow, x, y)) return 'up';
      if (inRect(this.downArrow, x, y)) return 'down';
      const t = this.thumb;
      if (y < t.top) return 'pageUp';
      if (y >= t.bottom) return 'pageDown';
      return 'thumb';
    }
    return inRect(c, x, y) ? 'content' : undefined;
  }

  /** Frame, title bar, shadow, grow icon and scroll bar; the picture area is left blank. */
  draw() {
    const s = this.screen;
    const c = this.content;
    const st = this.structure;
    s.fill({ left: st.left, top: st.top, right: st.right - 1, bottom: st.bottom - 1 }, 0);
    s.frame({ left: c.left - 1, top: c.top - TITLE_H, right: c.right + 1, bottom: c.bottom + 1 });
    s.fill({ left: st.right - 1, top: st.top + 1, right: st.right, bottom: st.bottom }, 1);
    s.fill({ left: st.left + 1, top: st.bottom - 1, right: st.right, bottom: st.bottom }, 1);
    s.fill({ left: c.left, top: c.top - 1, right: c.right, bottom: c.top }, 1);
    for (let y = c.top - 15; y <= c.top - 5; y += 2) s.fill({ left: c.left + 1, top: y, right: c.right - 1, bottom: y + 1 }, 1);
    const box = this.closeBox;
    s.fill({ left: box.left - 1, top: box.top - 1, right: box.right + 1, bottom: box.bottom + 1 }, 0);
    s.frame(box);
    const title = 'Fossils';
    const tw = s.textWidth(title);
    const tx = c.left + ((c.right - c.left - tw) >> 1);
    s.fill({ left: tx - 6, top: c.top - 17, right: tx + tw + 6, bottom: c.top - 2 }, 0);
    s.text(title, tx, c.top - 5);
    s.fill({ left: c.left, top: c.bottom - SB + 1, right: c.right, bottom: c.bottom - SB + 2 }, 1);
    this.drawGrowIcon();
    this.drawScrollBar();
  }

  private drawGrowIcon() {
    const s = this.screen;
    const g = this.growBox;
    s.fill(g, 0);
    s.frame(g);
    s.frame({ left: g.left + 4, top: g.top + 4, right: g.left + 13, bottom: g.top + 13 });
    s.fill({ left: g.left + 3, top: g.top + 3, right: g.left + 9, bottom: g.top + 9 }, 0);
    s.frame({ left: g.left + 3, top: g.top + 3, right: g.left + 9, bottom: g.top + 9 });
  }

  drawScrollBar() {
    const s = this.screen;
    const sb = this.scrollBar;
    s.fill(sb, 0);
    s.frame(sb);
    this.drawArrow('up', false);
    this.drawArrow('down', false);
    const track = { left: sb.left + 1, top: this.upArrow.bottom, right: sb.right - 1, bottom: this.downArrow.top };
    if (this.max <= 0) return;
    s.pattern(track);
    const t = this.thumb;
    s.fill(t, 0);
    s.frame(t);
  }

  drawArrow(which: 'up' | 'down', pressed: boolean) {
    const s = this.screen;
    const r = which === 'up' ? this.upArrow : this.downArrow;
    s.fill(r, 0);
    s.frame(r);
    const glyph = pressed ? UP_FILLED : UP;
    s.glyph(which === 'up' ? glyph : flip(glyph), r.left + 2, which === 'up' ? r.top + 12 : r.top + 13);
  }

  /** The close box drawn as pressed (TrackGoAway's highlight). */
  drawCloseBox(pressed: boolean) {
    const s = this.screen;
    const b = this.closeBox;
    s.fill({ left: b.left + 1, top: b.top + 1, right: b.right - 1, bottom: b.bottom - 1 }, 0);
    if (!pressed) return;
    const cx = (b.left + b.right) >> 1;
    const cy = (b.top + b.bottom) >> 1;
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
    ]) {
      s.line({ x0: cx + dx * 2, y0: cy + dy * 2, x1: cx + dx * 4, y1: cy + dy * 4, thick: 1 });
    }
  }

  /** Moves the content rectangle by (dx, dy), keeping the title bar below the menu bar and on screen. */
  moveBy(dx: number, dy: number) {
    const c = this.content;
    const w = c.right - c.left;
    const h = c.bottom - c.top;
    const left = Math.min(Math.max(c.left + dx, 4 - w), SCREEN_W - 4);
    const top = Math.min(Math.max(c.top + dy, BAR_H + TITLE_H), SCREEN_H - 4);
    this.content = { left, top, right: left + w, bottom: top + h };
  }

  resizeTo(right: number, bottom: number) {
    const c = this.content;
    this.content = {
      ...c,
      right: Math.min(Math.max(right, c.left + MIN_W), SCREEN_W - 5 + c.left),
      bottom: Math.min(Math.max(bottom, c.top + MIN_H), SCREEN_H - 10 + c.top),
    };
  }
}
