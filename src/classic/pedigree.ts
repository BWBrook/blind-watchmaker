import { centringOffset, develop, type Line, placedLines, type Rect } from '../engine/develop';
import type { Genome } from '../engine/genome';
import { type MutationFlags, reproduce } from '../engine/mutate';
import { cursorCss, imageCursorCss } from './cursors';
import type { Events } from './events';
import type { MacWindow } from './macwindow';
import { SCREEN_H, SCREEN_W } from './screen';
import { beep } from './sound';

/** A pedigree member (the original's `Full`): its box, a snapshot of the box, and its family links. */
export interface Full {
  genome: Genome;
  surround: Rect;
  centre: { h: number; v: number };
  parent?: Full;
  children: Full[];
  snap: Uint8Array;
}

export interface PedigreeHost {
  readonly events: Events;
  readonly win: MacWindow;
  penSize(): number;
  flags(): MutationFlags;
  cursorScale(): number;
  drawSlowly(lines: Line[], clip: Rect): Promise<void>;
  /** Child[special] := ...: the box last touched becomes the active biomorph. */
  activate(g: Genome): void;
  setPointer(css: string): void;
}

const inRect = (r: Rect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;
const meets = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const inset = (r: Rect, d: number): Rect => ({ left: r.left + d, top: r.top + d, right: r.right - d, bottom: r.bottom - d });
const centreOf = (r: Rect) => ({ h: r.left + ((r.right - r.left) >> 1), v: r.top + ((r.bottom - r.top) >> 1) });

/** AtLeast: grow the box by 3 px, then widen it to whole bytes (multiples of 8) on both sides. */
function atLeast(r: Rect): Rect {
  const o = inset(r, -3);
  while (o.left % 8) o.left -= 1;
  while (o.right % 8) o.right += 1;
  return o;
}

/** Radiate: the drag point, its reflection through the centre, and the two quarter turns. */
function radiate(c: { h: number; v: number }, goal: { x: number; y: number }, rays: number) {
  const dx = goal.x - c.h;
  const dy = goal.y - c.v;
  return [
    { h: c.h + dx, v: c.v + dy },
    { h: c.h - dx, v: c.v - dy },
    { h: c.h - dy, v: c.v + dx },
    { h: c.h + dy, v: c.v - dx },
  ].slice(0, rays);
}

/**
 * The Pedigree unit. Boxes stack like windows (`stack`, front first, is the original's SpecialFull/Next list);
 * lines join each box's centre to its parent's and are clipped out of every box; Adams have a double border.
 */
export class Pedigree {
  stack: Full[] = [];
  roots: Full[] = [];
  rays = 1;

  constructor(private readonly host: PedigreeHost) {}

  get isEmpty() {
    return this.stack.length === 0;
  }

  hit(x: number, y: number): Full | undefined {
    return this.stack.find((f) => inRect(f.surround, x, y));
  }

  isRoot(f: Full) {
    return this.roots.includes(f);
  }

  private get boxes() {
    return this.stack.map((f) => f.surround);
  }

  private markIf(f: Full) {
    if (this.isRoot(f)) this.host.win.frame(inset(f.surround, 1));
  }

  private redevelop(f: Full) {
    this.host.win.put(f.surround, f.snap);
    this.markIf(f);
  }

  private bringToFront(f: Full) {
    this.stack.splice(this.stack.indexOf(f), 1);
    this.stack.unshift(f);
  }

  /** LocalLines: f to its parent and to each child, hidden behind every box. */
  private localLines(f: Full, pen: 'black' | 'white' | 'xor' = 'black', at = f.centre) {
    const ends = [...(f.parent ? [f.parent] : []), ...f.children];
    for (const o of ends) {
      this.host.win.line({ x0: at.h, y0: at.v, x1: o.centre.h, y1: o.centre.v, thick: 1 }, undefined, pen, this.boxes);
    }
  }

  /** Erase, then every box from its snapshot and every line between them (DrawWholeLot + AllLines). */
  redrawAll() {
    const win = this.host.win;
    win.erase();
    for (const f of this.stack) {
      if (f.parent) win.line({ x0: f.centre.h, y0: f.centre.v, x1: f.parent.centre.h, y1: f.parent.centre.v, thick: 1 });
    }
    for (const f of [...this.stack].reverse()) this.redevelop(f);
  }

  /** PhylogNew: a new Adam, drawn at the centre of the screen, on top of any pedigrees already there. */
  async newAdam(g: Genome) {
    const { win } = this.host;
    win.erase();
    const pic = develop(g, { penSize: this.host.penSize() });
    const origin = { h: SCREEN_W >> 1, v: SCREEN_H >> 1 };
    const off = centringOffset(pic);
    const m = pic.margin;
    await this.host.drawSlowly(placedLines(pic, { h: origin.h, v: origin.v - off }), win.bounds);
    const surround = atLeast({
      left: origin.h + m.left,
      top: origin.v + m.top - off,
      right: origin.h + m.right,
      bottom: origin.v + m.bottom - off,
    });
    win.frame(surround);
    win.frame(inset(surround, 1));
    const adam: Full = { genome: pic.genome, surround, centre: centreOf(surround), children: [], snap: win.grab(surround) };
    this.roots.push(adam);
    this.stack.unshift(adam);
    this.redrawAll();
  }

  /** SpawnOne: a mutant child of `parent`, born in a fresh framed box at `here`, kept inside the window. */
  private async spawnOne(parent: Full, here: { h: number; v: number }) {
    const { win } = this.host;
    const pic = develop(reproduce(parent.genome, this.host.flags()), { penSize: this.host.penSize() });
    const m = pic.margin;
    const s = atLeast({ left: here.h + m.left, top: here.v + m.top, right: here.h + m.right, bottom: here.v + m.bottom });
    const height = s.bottom - s.top;
    let widthBytes = Math.trunc((s.right - s.left) / 8);
    if (widthBytes % 2) widthBytes += 1;
    const width = widthBytes * 8;
    let voffset = 0;
    if (s.top < 0) {
      voffset = -s.top;
      s.top = 0;
      s.bottom = height;
    }
    if (s.bottom > win.height) {
      voffset = win.height - s.bottom;
      s.bottom = win.height;
      s.top = win.height - height;
    }
    if (s.left < 0) {
      s.left = 0;
      s.right = width;
    }
    if (s.right > win.width) {
      s.right = win.width;
      s.left = win.width - width;
    }
    win.erase(s);
    win.frame(s);
    const centre = centreOf(s);
    await this.host.drawSlowly(placedLines(pic, { h: centre.h, v: here.v + voffset }), win.bounds);
    const child: Full = { genome: pic.genome, surround: s, centre, parent, children: [], snap: win.grab(s) };
    parent.children.push(child);
    this.stack.unshift(child);
    this.host.activate(child.genome);
  }

  /** OwnCursor: the box, shrunk to 16 x 16, becomes the pointer (the cross if the box is too small). */
  private boxPointer(f: Full): string {
    const r = inset(f.surround, 2);
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    const scale = this.host.cursorScale();
    if (w <= 16 || h <= 16) return cursorCss('cross', scale);
    const img = this.host.win.grab(r);
    const bits = new Uint8Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) bits[y * 16 + x] = img[Math.floor((y * h) / 16) * w + Math.floor((x * w) / 16)];
    }
    return imageCursorCss(bits, scale);
  }

  /** DrawOutFrom: drag umbilical cords out of a box; on release a child is born at the end of each. */
  async drawOut(f: Full) {
    const { events: ev, win } = this.host;
    if (this.stack.slice(0, this.stack.indexOf(f)).some((o) => meets(o.surround, f.surround))) this.redevelop(f);
    this.bringToFront(f);
    this.host.setPointer(this.boxPointer(f));
    const mouse = () => {
      const p = win.toLocal(ev.x, ev.y);
      return { x: p.x, y: Math.max(p.y, 0) };
    };
    while (ev.down && inRect(f.surround, mouse().x, mouse().y)) await ev.tick();
    win.frame(f.surround);
    this.markIf(f);
    this.host.activate(f.genome);
    if (ev.down) {
      const cords = (goal: { x: number; y: number }) => {
        for (const p of radiate(f.centre, goal, this.rays)) {
          win.line({ x0: f.centre.h, y0: f.centre.v, x1: p.h, y1: p.v, thick: 1 }, undefined, 'xor', this.boxes);
        }
      };
      let at = mouse();
      let shown: { x: number; y: number } | undefined = at;
      cords(at);
      while (ev.down) {
        await ev.tick();
        const next = mouse();
        if (next.x === at.x && next.y === at.y) continue;
        await ev.tick();
        if (shown) cords(shown);
        await ev.tick();
        shown = inRect(f.surround, next.x, next.y) ? undefined : next;
        if (shown) cords(shown);
        at = next;
      }
      at = mouse();
      if (shown) cords(shown);
      if (!inRect(f.surround, at.x, at.y)) {
        const ends = radiate(f.centre, at, this.rays);
        for (let j = ends.length - 1; j >= 0; j--) {
          this.host.setPointer(cursorCss('dot', this.host.cursorScale()));
          await this.spawnOne(f, ends[j]);
        }
      }
    }
    this.localLines(f);
  }

  /** FollowMouse: the box (and its lines) follows the pointer; everything is repaired when it is dropped. */
  async follow(f: Full) {
    const { events: ev, win } = this.host;
    this.bringToFront(f);
    this.host.activate(f.genome);
    this.localLines(f, 'white');
    win.erase(f.surround);
    const background = win.save();
    const w = f.surround.right - f.surround.left;
    const h = f.surround.bottom - f.surround.top;
    const start = win.toLocal(ev.x, ev.y);
    const offset = { h: f.centre.h - start.x, v: f.centre.v - start.y };
    const show = () => {
      win.put(f.surround, f.snap);
      this.localLines(f, 'xor');
    };
    show();
    ev.obscure();
    let last = start;
    while (ev.down) {
      await ev.tick();
      const p = win.toLocal(ev.x, ev.y);
      if (!inRect(win.bounds, p.x, p.y) || (p.x === last.x && p.y === last.y)) continue;
      if (p.y > 100) await ev.tick();
      win.restore(background);
      f.centre = { h: p.x + offset.h, v: p.y + offset.v };
      const left = f.centre.h - (w >> 1);
      const top = f.centre.v - (h >> 1);
      f.surround = { left, top, right: left + w, bottom: top + h };
      show();
      last = p;
    }
    this.redrawAll();
  }

  /** Detach: cut the line to the parent (a white pen that spares only the two boxes); the box becomes an Adam. */
  detach(f: Full) {
    const parent = f.parent;
    if (!parent) {
      beep();
      return;
    }
    const line = { x0: f.centre.h, y0: f.centre.v, x1: parent.centre.h, y1: parent.centre.v, thick: 1 };
    this.host.win.line(line, undefined, 'white', [f.surround, parent.surround]);
    parent.children.splice(parent.children.indexOf(f), 1);
    f.parent = undefined;
    this.roots.push(f);
    this.markIf(f);
  }

  /** Shoot: f and all its descendants go; true if that was the last Adam. */
  shoot(f: Full): boolean {
    const doomed = new Set<Full>();
    const collect = (x: Full) => {
      doomed.add(x);
      x.children.forEach(collect);
    };
    collect(f);
    if (f.parent) f.parent.children.splice(f.parent.children.indexOf(f), 1);
    this.stack = this.stack.filter((x) => !doomed.has(x));
    this.roots = this.roots.filter((x) => !doomed.has(x));
    this.redrawAll();
    return this.roots.length === 0;
  }
}
