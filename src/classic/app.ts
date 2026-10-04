import { centringOffset, develop, type Line, placedLines, type Rect } from '../engine/develop';
import { basicTree, chess, clone, type Genome, insect, normalise } from '../engine/genome';
import { defaultFlags, engineer, hopefulMonster, type MutationFlags, reproduce } from '../engine/mutate';
import { Bitmap } from '../engine/raster';
import zoos from '../engine/zoos.json';
import { Album, PER_PAGE } from './album';
import { type CursorName, cursorCss } from './cursors';
import { alert, type DialogHost, help, plainBox } from './dialogs';
import { Disk } from './disk';
import { FossilRecord } from './fossils';
import { FossilWindow } from './fossilwindow';
import type { Events, MacEvent } from './events';
import { drawGeneBox, drawStrip, geneZone } from './genestrip';
import { Grid } from './grid';
import { HELP } from './helptext';
import { MacWindow } from './macwindow';
import { Pedigree } from './pedigree';
import { BAR_H, type Menu, MenuBar, type MenuItem } from './menubar';
import { SCREEN_H, SCREEN_W, type Screen } from './screen';
import { beep } from './sound';
import { getFile, putFile } from './standardfile';

type Mode =
  | 'preliminary'
  | 'breeding'
  | 'highlighting'
  | 'engineering'
  | 'randoming'
  | 'drifting'
  | 'albuming'
  | 'playingBack'
  | 'phyloging'
  | 'moving'
  | 'detaching'
  | 'killing';

const PEDIGREE_MODES: Mode[] = ['phyloging', 'moving', 'detaching', 'killing'];

/** Progressive drawing speed: placed lines per tick (the original was bound by 1980s hardware). */
const LINES_PER_TICK = 48;
const DRIFT_TICKS = 10;
const ENGINEERING_REPEAT_DELAY = 32;
const MAX_BOXES = 100;
/** Ticks between repeats while a scroll arrow or page area is held (TrackControl's action proc). */
const SCROLL_REPEAT_TICKS = 3;
/** Album Zoom: four page miniatures below a 15 px strip. */
const ZOOM_TOP = 15;

const inRect = (r: Rect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

const glide = (a: number, b: number) => (Math.abs(b - a) <= 20 ? b : a + Math.trunc((b - a) / 2));

export class App implements DialogHost {
  readonly win: MacWindow;
  readonly menubar: MenuBar;
  private mode: Mode = 'preliminary';
  private grid: Grid;
  private readonly albumGrid: Grid;
  private children: Genome[] = [];
  private special = 0;
  private flags: MutationFlags = defaultFlags();
  private penSize = 1;
  private sweep = false;
  private sweepSlot = 0;
  private lastDrift = 0;
  private hovered = -1;
  private anchors = { top: basicTree(), left: insect(), right: chess() };
  private readonly album = new Album();
  private albumPage = 0;
  /** The selected slot (Special) and whether its box is shown inverted (OldSpecial > 0). */
  private albumSel = -1;
  private albumHi = false;
  private copied: Genome | undefined;
  private lastWasCopy = false;
  private readonly disk = new Disk();
  private readonly fileNames = { album: 'Album', biomorph: 'Biomorph', fossils: 'Fossils' };
  private readonly fossils = new FossilRecord();
  private readonly fossilWindow: FossilWindow;
  private playback: { saveMode: Mode; first: Genome; shown: Genome; counter: number; under: Uint8Array } = {
    saveMode: 'breeding',
    first: basicTree(),
    shown: basicTree(),
    counter: 0,
    under: new Uint8Array(),
  };
  private fullMenus: Menu[] = [];
  private readonly pedigree: Pedigree;
  /** After the last Adam is shot there is no active biomorph (Special = 0) until one is made or chosen. */
  private bereft = false;
  private cursorScale = 1;
  private cursorName: CursorName | '' = '';

  constructor(
    readonly screen: Screen,
    readonly events: Events,
  ) {
    this.win = new MacWindow(screen);
    this.grid = new Grid(3, 5, this.win.width, this.win.height);
    this.albumGrid = new Grid(3, 5, this.win.width, this.win.height);
    this.fossilWindow = new FossilWindow(screen);
    this.pedigree = new Pedigree({
      events,
      win: this.win,
      penSize: () => this.penSize,
      flags: () => this.flags,
      cursorScale: () => this.cursorScale,
      drawSlowly: (lines, clip) => this.drawSlowly(lines, clip),
      activate: (g) => {
        this.children[this.special] = g;
        this.bereft = false;
      },
      setPointer: (css) => {
        this.events.setCursor(css);
        this.cursorName = '';
      },
    });
    this.fullMenus = this.menus();
    this.menubar = new MenuBar(screen, events, this.fullMenus);
  }

  wantsKey(key: string, meta: boolean): boolean {
    const k = key.toUpperCase();
    if (key === 'Escape' || key === 'Enter') return true;
    if (k === 'Q' && !meta) return false;
    return (meta || k.length === 1) && this.menubar.keyEquivalents().has(k);
  }

  setScale(scale: number) {
    this.cursorScale = Math.max(1, Math.round(scale));
    this.cursorName = '';
  }

  async run() {
    this.win.drawDesk();
    this.menubar.draw();
    this.setActive(basicTree());
    await this.doBreed();
    for (;;) {
      const e = this.events.next();
      try {
        if (e) await this.handle(e);
        else await this.idle();
      } catch (err) {
        console.error(err);
        await alert(this, 'Sorry, that biomorph is too large to draw, or some other problem occurred.');
      }
      await this.events.tick();
    }
  }

  private active(): Genome {
    return this.children[this.special];
  }

  private setActive(g: Genome) {
    this.bereft = false;
    this.children = Array(this.grid.n);
    this.children[this.grid.mid] = g;
    this.special = this.grid.mid;
  }

  // Drawing.

  private linesFor(g: Genome, at: { h: number; v: number }, recentre: boolean, engineering = false) {
    const pic = develop(g, { penSize: this.penSize, engineering });
    const place = recentre ? { h: at.h, v: at.v - centringOffset(pic) } : at;
    return { genome: pic.genome, lines: placedLines(pic, place), pic };
  }

  private drawNow(lines: Line[], clip: Rect) {
    for (const l of lines) this.win.line(l, clip);
  }

  private async drawSlowly(lines: Line[], clip: Rect) {
    for (let i = 0; i < lines.length; i++) {
      this.win.line(lines[i], clip);
      if (i % LINES_PER_TICK === LINES_PER_TICK - 1) await this.events.tick();
    }
  }

  private frameBoxes() {
    for (let k = 0; k < this.grid.n; k++) {
      this.win.frame(this.grid.box(k), this.mode === 'breeding' && k === this.grid.mid ? 3 : 1);
    }
  }

  private xorFrame(r: Rect, size: number) {
    const { left, top, right, bottom } = r;
    this.win.invert({ left, top, right, bottom: top + size });
    this.win.invert({ left, top: bottom - size, right, bottom });
    this.win.invert({ left, top: top + size, right: left + size, bottom: bottom - size });
    this.win.invert({ left: right - size, top: top + size, right, bottom: bottom - size });
  }

  // Event loop.

  private async handle(e: MacEvent) {
    if (e.type === 'key') {
      if (this.wantsKey(e.key, e.meta)) await this.menubar.handleKey(e.key.toUpperCase());
      return;
    }
    if (e.y < BAR_H) {
      await this.menubar.track(e.x);
      return;
    }
    if (this.mode === 'playingBack') {
      await this.playbackClick(e.x, e.y);
      return;
    }
    const p = this.win.local(e.x, e.y);
    if (!p) return;
    if (this.mode === 'breeding') {
      const k = this.grid.boxAt(p.x, p.y);
      if (k >= 0) await this.evolve(k);
      // Evolve writes the parent to the fossil record even when the click missed every box.
      else if (this.fossils.recording) this.fossils.append(this.active());
    } else if (this.mode === 'highlighting') {
      const k = this.grid.boxAt(p.x, p.y);
      if (k >= 0 && this.children[k]) {
        this.win.invert(this.grid.box(this.special));
        this.special = k;
        this.win.invert(this.grid.box(k));
      }
    } else if (this.mode === 'engineering') await this.engineerClick(p.x, p.y);
    else if (this.mode === 'randoming') await this.newMonster();
    else if (this.mode === 'albuming') this.selectSlot(p.x, p.y);
    else if (PEDIGREE_MODES.includes(this.mode)) await this.pedigreeClick(p.x, p.y);
  }

  private async pedigreeClick(x: number, y: number) {
    const f = this.pedigree.hit(x, y);
    if (!f) return;
    if (this.mode === 'phyloging') await this.pedigree.drawOut(f);
    else if (this.mode === 'moving') await this.pedigree.follow(f);
    else if (this.mode === 'detaching') this.pedigree.detach(f);
    else if (this.pedigree.shoot(f)) {
      this.mode = 'preliminary';
      this.bereft = true;
    }
    this.cursorName = '';
  }

  private async displayPedigree() {
    await this.pedigree.newAdam(this.active());
    this.mode = 'phyloging';
  }

  private async idle() {
    const p = this.win.local(this.events.x, this.events.y);
    this.adjustCursor(p);
    if (!p) return;
    if (this.mode === 'breeding' || this.mode === 'highlighting') {
      const k = this.grid.boxAt(p.x, p.y);
      if (k >= 0 && k !== this.hovered && this.children[k]) {
        this.hovered = k;
        drawStrip(this.win, this.children[k]);
      }
    }
    if (this.mode === 'drifting' && this.events.ticks - this.lastDrift >= (this.sweep ? 2 : DRIFT_TICKS)) {
      this.lastDrift = this.events.ticks;
      await this.driftStep();
    }
  }

  private adjustCursor(p: { x: number; y: number } | undefined) {
    let name: CursorName = 'arrow';
    if (this.mode === 'playingBack') name = 'arrow';
    else if (p) {
      if (this.mode === 'randoming') name = 'die';
      else if (this.mode === 'highlighting' || this.mode === 'albuming') name = 'block';
      else if (this.mode === 'phyloging') name = 'drawOut';
      else if (this.mode === 'moving') name = 'hand';
      else if (this.mode === 'detaching') name = 'scissors';
      else if (this.mode === 'killing') name = 'gun';
      else if (this.mode === 'engineering') {
        const z = geneZone(this.win, p.x, p.y);
        const graded = z && (z.box <= 9 || z.box === 11);
        name = !z
          ? 'syringe'
          : z.zone === 'left'
            ? 'left'
            : z.zone === 'right'
              ? 'right'
              : graded && z.zone === 'top'
                ? 'up'
                : graded && z.zone === 'bottom'
                  ? 'down'
                  : 'equals';
      } else name = 'cross';
    }
    if (name === this.cursorName) return;
    this.cursorName = name;
    this.events.setCursor(cursorCss(name, this.cursorScale));
  }

  // Breeding and the other operations.

  private async doBreed() {
    const parent = this.active();
    this.events.obscure();
    this.mode = 'breeding';
    this.setActive(parent);
    this.win.erase();
    this.frameBoxes();
    drawStrip(this.win, parent);
    const { genome, lines } = this.linesFor(parent, this.grid.centre(this.grid.mid), true);
    this.children[this.grid.mid] = genome;
    await this.drawSlowly(lines, this.grid.box(this.grid.mid));
    await this.evolve(this.grid.mid);
  }

  /** Bio:Evolve. The chosen biomorph glides to the centre, then each offspring follows a flash of umbilical cord. */
  private async evolve(j: number) {
    const ev = this.events;
    const grid = this.grid;
    const mid = grid.mid;
    const biz = grid.business();
    const { genome: parent, pic } = this.linesFor(this.children[j], grid.centre(j), true);
    const off = centringOffset(pic);
    const target = grid.centre(mid);
    let at = grid.centre(j);
    ev.obscure();
    const show = (clip: Rect) => {
      this.win.erase(biz);
      this.drawNow(placedLines(pic, { h: at.h, v: at.v - off }), clip);
    };
    show(grid.box(j));
    while (at.h !== target.h || at.v !== target.v) {
      await ev.tick();
      at = { h: glide(at.h, target.h), v: glide(at.v, target.v) };
      show(biz);
    }
    this.setActive(parent);
    show(grid.box(mid));
    this.frameBoxes();
    for (let k = 0; k < grid.n; k++) {
      if (k === mid) continue;
      const c = grid.centre(k);
      const cord = { x0: target.h, y0: target.v, x1: c.h, y1: c.v, thick: 1 };
      this.win.line(cord, biz, 'xor');
      await ev.wait(2);
      this.win.line(cord, biz, 'xor');
      const { genome, lines } = this.linesFor(reproduce(parent, this.flags), c, true);
      this.children[k] = genome;
      await this.drawSlowly(lines, grid.box(k));
    }
    this.hovered = -1;
    if (this.fossils.recording) this.fossils.append(parent);
  }

  private doHighlight() {
    if (this.mode === 'highlighting') return;
    this.mode = 'highlighting';
    this.win.invert(this.grid.box(this.special));
    drawStrip(this.win, this.active());
  }

  private async doEngineer() {
    const g = this.active();
    this.mode = 'engineering';
    this.win.erase();
    const { genome, lines } = this.linesFor(g, this.grid.centre(this.grid.mid), true, true);
    this.setActive(genome);
    drawStrip(this.win, genome);
    await this.drawSlowly(lines, this.grid.business());
  }

  private redrawEngineered() {
    const biz = this.grid.business();
    const { genome, lines } = this.linesFor(this.active(), this.grid.centre(this.grid.mid), true, true);
    this.children[this.grid.mid] = genome;
    this.win.erase(biz);
    this.drawNow(lines, biz);
  }

  private async engineerClick(x: number, y: number) {
    const ev = this.events;
    let hit = geneZone(this.win, x, y);
    if (!hit) {
      await alert(
        this,
        'The hypodermic is only for show. Move it up into the chromosome (the gene strip) and it will change into a pointer you can use. If in doubt, choose Help with current operation.',
        ['Okay'],
      );
      return;
    }
    let delay = ENGINEERING_REPEAT_DELAY;
    while (hit) {
      const { genome, redraw } = engineer(this.active(), hit.box, hit.zone);
      this.children[this.grid.mid] = genome;
      drawGeneBox(this.win, genome, hit.box);
      if (redraw) this.redrawEngineered();
      const until = ev.ticks + delay;
      delay = 1;
      do await ev.tick();
      while (ev.down && ev.ticks < until);
      if (!ev.down) return;
      const p = this.win.local(ev.x, ev.y);
      hit = p && geneZone(this.win, p.x, p.y);
    }
  }

  private async doMonster() {
    this.mode = 'randoming';
    await this.newMonster();
  }

  private async newMonster() {
    this.events.obscure();
    const g = hopefulMonster(this.active(), this.flags);
    this.win.erase();
    const { genome, lines } = this.linesFor(g, this.grid.centre(this.grid.mid), false);
    this.setActive(genome);
    await this.drawSlowly(lines, this.grid.business());
    drawStrip(this.win, genome);
  }

  private doDrift() {
    this.mode = 'drifting';
    this.sweepSlot = 0;
    this.lastDrift = 0;
    this.win.erase();
  }

  private async driftStep() {
    const g = this.active();
    if (!this.sweep) {
      const { genome, lines } = this.linesFor(g, { h: this.win.width >> 1, v: this.win.height >> 1 }, false);
      this.win.erase();
      this.drawNow(lines, this.win.bounds);
      this.children[this.special] = reproduce(genome, this.flags);
      return;
    }
    const n = this.grid.n;
    const k = this.sweepSlot;
    this.win.frame(this.grid.box((k + n - 1) % n), 3, 'white');
    this.win.erase(this.grid.box(k));
    this.win.frame(this.grid.box(k));
    const { genome, lines } = this.linesFor(g, this.grid.centre(k), true);
    await this.drawSlowly(lines, this.grid.box(k));
    this.children[this.special] = reproduce(genome, this.flags);
    this.sweepSlot = (k + 1) % n;
  }

  private async changeGrid(dr: number, dc: number) {
    const g = this.active();
    this.grid = new Grid(this.grid.rows + dr, this.grid.cols + dc, this.win.width, this.win.height);
    this.mode = 'preliminary';
    this.win.erase();
    this.frameBoxes();
    const { genome, lines } = this.linesFor(g, this.grid.centre(this.grid.mid), true);
    this.setActive(genome);
    await this.drawSlowly(lines, this.grid.box(this.grid.mid));
  }

  private changePen(d: number) {
    this.penSize += d;
    this.redrawEngineered();
  }

  // The album (Album unit).

  private drawAlbumPage(page: number) {
    const grid = this.albumGrid;
    this.win.erase();
    this.titleAlbumPage(page);
    for (let i = 0; i < PER_PAGE; i++) {
      const g = this.album.slots[page * PER_PAGE + i];
      if (g) this.drawNow(this.linesFor(g, grid.centre(i), true).lines, grid.box(i));
    }
  }

  private titleAlbumPage(page: number) {
    this.win.text(`Album Page ${page + 1}`, 200, 15, 'Chicago');
  }

  private hiliteSlot(on: boolean) {
    if (this.albumHi === on || this.albumSel < 0) return;
    this.win.invert(this.albumGrid.box(this.albumSel % PER_PAGE));
    this.albumHi = on;
  }

  /** UnCurtainPage: reveals a page in 8 px strips from the centre out; the last strip at each edge is erased. */
  private async curtain(page: number) {
    const before = this.win.save();
    this.drawAlbumPage(page);
    const after = this.win.save();
    this.win.restore(before);
    const h = this.win.height;
    const mid = this.win.width >> 1;
    let left = mid - 8;
    let step = 0;
    for (; left > 0; left -= 8, step++) {
      this.win.restore(after, { left, top: 0, right: left + 8, bottom: h });
      this.win.restore(after, { left: 2 * mid - left - 8, top: 0, right: 2 * mid - left, bottom: h });
      if (step % 4 === 3) await this.events.tick();
    }
    this.win.erase({ left, top: 0, right: left + 8, bottom: h });
    this.win.erase({ left: 2 * mid - left - 8, top: 0, right: 2 * mid - left, bottom: h });
    this.albumPage = page;
    this.albumHi = false;
  }

  /** TakeCare: the page becomes the album view; its last biomorph is the active one (not yet inverted). */
  private takeCare(page: number) {
    this.mode = 'albuming';
    this.albumPage = page;
    this.albumSel = Math.min((page + 1) * PER_PAGE, this.album.slots.length) - 1;
    this.albumHi = false;
    const g = this.album.slots[this.albumSel];
    if (g) this.setActive(g);
  }

  /** DoLoad + StickInAlbum: curtain in the current page, then draw each newcomer into the next slot. */
  private async albumLoad(genomes: Genome[]): Promise<number> {
    const first = this.album.slots.length;
    if (!this.album.isEmpty) await this.curtain(this.album.pages - 1);
    this.mode = 'albuming';
    const fitted = this.album.append(genomes);
    for (let slot = first; slot < first + fitted; slot++) {
      const page = Math.floor(slot / PER_PAGE);
      const k = slot % PER_PAGE;
      if (k === 0) {
        this.win.erase();
        this.titleAlbumPage(page);
      }
      const g = this.album.slots[slot]!;
      await this.drawSlowly(this.linesFor(g, this.albumGrid.centre(k), true).lines, this.albumGrid.box(k));
    }
    this.takeCare(this.album.pages - 1);
    this.hiliteSlot(true);
    if (fitted < genomes.length) beep();
    return fitted;
  }

  private async showAlbum() {
    if (this.album.pages > 1) {
      await this.zoom();
      return;
    }
    await this.curtain(0);
    this.takeCare(0);
    this.hiliteSlot(true);
  }

  /** Zoom's quadrants: the top pair starts 15 px down, so it is shorter than the bottom pair. */
  private quadrant(q: number): Rect {
    const midX = this.win.width >> 1;
    const midY = this.win.height >> 1;
    const left = q % 2 ? midX : 0;
    return q < 2
      ? { left, top: ZOOM_TOP, right: left + midX, bottom: midY }
      : { left, top: midY, right: left + midX, bottom: this.win.height };
  }

  /** Album:Zoom. Every page in miniature until a click; a 3 px XOR frame marks the page last pointed at. */
  private async zoom() {
    const ev = this.events;
    const shots: Uint8Array[] = [];
    for (let p = 0; p < this.album.pages; p++) {
      this.drawAlbumPage(p);
      shots.push(this.win.save());
    }
    this.win.erase();
    shots.forEach((shot, q) => this.win.blitScaled(shot, this.quadrant(q)));
    let current = -1;
    for (;;) {
      await ev.tick();
      const p = this.win.local(ev.x, ev.y);
      if (p) {
        this.events.setCursor(cursorCss(p.y < ZOOM_TOP ? 'arrow' : 'lens', this.cursorScale));
        this.cursorName = '';
        let q = [0, 1, 2, 3].findIndex((k) => inRect(this.quadrant(k), p.x, p.y));
        if (q < 0 && p.y >= ZOOM_TOP) q = 3;
        if (q >= 0 && q !== current && q < this.album.pages) {
          if (current >= 0) this.xorFrame(this.quadrant(current), 3);
          this.xorFrame(this.quadrant(q), 3);
          current = q;
        }
      }
      const e = ev.next();
      if (e?.type !== 'mouseDown' || current < 0) continue;
      const r = this.quadrant(current);
      this.drawAlbumPage(current);
      this.takeCare(current);
      // Emphasize applies GlobalToLocal to a point that is already local, so the pick lands 20 px higher.
      const at = this.win.local(2 * (e.x - MacWindow.LEFT - r.left), 2 * (e.y - MacWindow.TOP - r.top));
      if (at) this.selectSlot(at.x, at.y);
      return;
    }
  }

  /** Emphasize: invert the clicked slot (among those filled so far) and make it the active biomorph. */
  private selectSlot(x: number, y: number) {
    const k = this.albumGrid.boxAt(x, y);
    const slot = this.albumPage * PER_PAGE + k;
    if (k < 0 || slot >= this.album.slots.length) return;
    this.hiliteSlot(false);
    this.albumSel = slot;
    this.hiliteSlot(true);
    const g = this.album.slots[slot];
    if (g) this.setActive(g);
  }

  /** AddToAlbum: the page flashes up with the newcomer drawn in, then the previous screen returns. */
  private async addToAlbum() {
    if (this.album.full) {
      beep();
      return;
    }
    const before = this.win.save();
    const mode = this.mode;
    const g = this.active();
    await this.albumLoad([g]);
    this.album.dirty = true;
    this.setActive(g);
    this.win.restore(before);
    this.albumHi = false;
    this.mode = mode;
    if (mode === 'engineering') await this.doEngineer();
  }

  /** DoClear(TRUE): the slot is erased and left empty; the cleared biomorph stays active. */
  private clearSlot() {
    this.album.clear(this.albumSel);
    this.win.erase(this.albumGrid.box(this.albumSel % PER_PAGE));
    this.albumHi = false;
  }

  /** DoClear(FALSE): Paste the copied biomorph into the selected, cleared slot. */
  private async pasteSlot() {
    const g = this.copied!;
    const k = this.albumSel % PER_PAGE;
    this.album.paste(this.albumSel, g);
    this.win.erase(this.albumGrid.box(k));
    this.albumHi = false;
    await this.drawSlowly(this.linesFor(g, this.albumGrid.centre(k), true).lines, this.albumGrid.box(k));
    this.hiliteSlot(true);
    this.setActive(g);
  }

  /** Copy: the active biomorph goes on the clipboard as a picture, and is remembered for Paste. */
  private async copyBiomorph() {
    const g = this.active();
    this.copied = clone(g);
    this.lastWasCopy = true;
    const pic = develop(g, { penSize: this.penSize });
    const pad = 10;
    const m = pic.margin;
    const bm = new Bitmap(m.right - m.left + 2 * pad, m.bottom - m.top + 2 * pad);
    for (const l of placedLines(pic, { h: pad - m.left, v: pad - m.top })) bm.line(l);
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = bm.width * scale;
    canvas.height = bm.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let y = 0; y < bm.height; y++) {
      for (let x = 0; x < bm.width; x++) if (bm.bits[y * bm.width + x]) ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    try {
      const png = new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'),
      );
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    } catch {
      beep();
    }
  }

  private async loadToAlbum() {
    const file = await getFile(this, this.disk);
    if (!file) return;
    const valid = file.genomes.filter((g) => g.gene[8] >= 1).map(normalise);
    if (!valid.length) {
      await alert(this, `"${file.name}" does not contain any biomorphs.`);
      return;
    }
    if (!this.album.isEmpty) this.album.dirty = true;
    await this.albumLoad(valid);
    this.events.flush();
  }

  private async saveAlbum(): Promise<boolean> {
    const name = await putFile(this, this.disk, 'Save Album', this.fileNames.album, 'COLL', this.album.members());
    if (!name) return false;
    this.fileNames.album = name;
    this.album.dirty = false;
    return true;
  }

  private async saveBiomorph() {
    const name = await putFile(this, this.disk, 'Save Biomorph', this.fileNames.biomorph, 'BIOM', [this.active()]);
    if (name) this.fileNames.biomorph = name;
  }

  /** Offers to save unsaved album changes; false if the user cancelled. */
  private async albumSaved(): Promise<boolean> {
    if (!this.album.dirty) return true;
    const k = await alert(this, 'Save changes to Album before Closing?', ['Save', "Don't Save", 'Cancel'], 'caution');
    return k === 1 || (k === 0 && (await this.saveAlbum()));
  }

  private async closeAlbum() {
    if (!(await this.albumSaved())) return;
    this.album.reset();
    this.albumSel = -1;
    this.albumHi = false;
    this.albumPage = 0;
    this.mode = 'preliminary';
    this.win.erase();
  }

  private async quit() {
    if (!(await this.albumSaved())) return;
    if (this.fossils.unsaved) {
      const k = await alert(this, 'Save changes to Fossils before Quitting?', ['Save', "Don't Save", 'Cancel'], 'caution');
      if (k === 2 || (k === 0 && !(await this.saveFossils()))) return;
    }
    location.assign('../');
  }

  // The fossil record (Album unit: StartPlayBack, DoPlayBack, MyAction, ClosePlayBack).

  private async saveFossils(): Promise<boolean> {
    const name = await putFile(this, this.disk, 'Save Fossils', this.fileNames.fossils, 'FOSS', this.fossils.records);
    if (!name) return false;
    this.fileNames.fossils = name;
    this.fossils.unsaved = false;
    return true;
  }

  /** Asks before an existing record is thrown away; false if the user cancelled. */
  private async fossilsMayReset(): Promise<boolean> {
    if (!this.fossils.exist) return true;
    const k = await alert(this, 'Save changes to Fossils before Resetting?', ['Save', "Don't Save", 'Cancel'], 'caution');
    return k === 1 || (k === 0 && (await this.saveFossils()));
  }

  private async initializeFossils() {
    if (await this.fossilsMayReset()) this.fossils.reset();
  }

  private async loadAsFossils() {
    if (!(await this.fossilsMayReset())) return;
    this.fossils.reset();
    this.fossils.recording = false;
    const file = await getFile(this, this.disk);
    if (!file) return;
    const valid = file.genomes.filter((g) => g.gene[8] >= 1).map(normalise);
    if (!valid.length) {
      await alert(this, `"${file.name}" does not contain any biomorphs.`);
      return;
    }
    this.fossils.records = valid;
    this.startPlayback();
  }

  private get belowMenuBar(): Rect {
    return { left: 0, top: BAR_H, right: SCREEN_W, bottom: SCREEN_H };
  }

  /** StartPlayBack: the Fossils window opens on the newest fossil, under a reduced menu bar. */
  private startPlayback() {
    const n = this.fossils.records.length;
    this.menubar.setMenus(this.playbackMenus());
    this.playback.under = this.screen.save(this.belowMenuBar);
    this.playback.saveMode = this.mode;
    this.mode = 'playingBack';
    this.playback.counter = 0;
    this.playback.first = this.fossils.records[n - 1];
    this.fossilWindow.max = n - 1;
    this.fossilWindow.value = 0;
    this.fossilWindow.draw();
    this.showFossil();
  }

  /**
   * MyAction + Snapshot: the fossil `counter` steps below the newest, drawn whole with its root at the picture's
   * midpoint. Snapshot clips to the main window's businessPart, so the top 20 px of the picture never show.
   */
  private showFossil() {
    const fw = this.fossilWindow;
    const g = this.fossils.records[this.fossils.records.length - 1 - this.playback.counter];
    this.playback.shown = g;
    this.children[this.special] = g;
    const c = fw.content;
    const b = this.grid.business();
    const pic = fw.picture;
    const clip = {
      left: Math.max(pic.left, c.left + b.left),
      top: Math.max(pic.top, c.top + b.top),
      right: Math.min(pic.right, c.left + b.right),
      bottom: Math.min(pic.bottom, c.top + b.bottom),
    };
    this.screen.fill(clip, 0);
    for (const l of placedLines(develop(g, { penSize: this.penSize }), fw.midPoint)) this.screen.line(l, clip);
  }

  private redrawPlayback() {
    this.screen.restore(this.belowMenuBar, this.playback.under);
    this.fossilWindow.draw();
    this.showFossil();
  }

  private closePlayback(revert: boolean) {
    if (revert) this.children[this.special] = this.playback.first;
    this.screen.restore(this.belowMenuBar, this.playback.under);
    this.mode = this.playback.saveMode;
    this.events.flush();
    this.menubar.setMenus(this.fullMenus);
  }

  private async breedFromFossil() {
    this.playback.first = this.playback.shown;
    this.closePlayback(false);
    this.fossils.recording = false;
    await this.doBreed();
  }

  private step(dir: number): boolean {
    const counter = Math.min(Math.max(this.playback.counter + dir, 0), this.fossilWindow.max);
    if (counter === this.playback.counter) return false;
    this.playback.counter = counter;
    this.fossilWindow.value = counter;
    this.fossilWindow.drawScrollBar();
    this.showFossil();
    return true;
  }

  private async playbackClick(x: number, y: number) {
    const part = this.fossilWindow.partAt(x, y);
    if (part === 'drag') await this.dragFossilWindow(x, y);
    else if (part === 'goAway') {
      if (await this.trackGoAway()) this.closePlayback(true);
    } else if (part === 'grow') await this.growFossilWindow();
    else if (part === 'up' || part === 'down') await this.trackArrow(part);
    else if (part === 'pageUp' || part === 'pageDown') await this.trackPage(part);
    else if (part === 'thumb') await this.trackThumb(y);
  }

  private async trackArrow(part: 'up' | 'down') {
    const ev = this.events;
    const fw = this.fossilWindow;
    const dir = part === 'up' ? -1 : 1;
    let lit = true;
    fw.drawArrow(part, true);
    this.step(dir);
    let last = ev.ticks;
    while (ev.down) {
      await ev.tick();
      const inside = fw.partAt(ev.x, ev.y) === part;
      if (inside !== lit) {
        lit = inside;
        fw.drawArrow(part, lit);
      }
      if (lit && ev.ticks - last >= SCROLL_REPEAT_TICKS) {
        last = ev.ticks;
        if (this.step(dir)) fw.drawArrow(part, true);
      }
    }
    fw.drawArrow(part, false);
  }

  private async trackPage(part: 'pageUp' | 'pageDown') {
    const ev = this.events;
    const dir = part === 'pageUp' ? -1 : 1;
    this.step(dir);
    let last = ev.ticks;
    while (ev.down) {
      await ev.tick();
      if (ev.ticks - last >= SCROLL_REPEAT_TICKS && this.fossilWindow.partAt(ev.x, ev.y) === part) {
        last = ev.ticks;
        this.step(dir);
      }
    }
  }

  /** Dragging the scroll box moves a grey outline; the picture changes only when the button is released. */
  private async trackThumb(y: number) {
    const ev = this.events;
    const fw = this.fossilWindow;
    const thumb = fw.thumb;
    const grab = y - thumb.top;
    const [lo, hi] = fw.thumbLimits();
    const outline = (top: number) => ({ ...thumb, top, bottom: top + (thumb.bottom - thumb.top) });
    let top = thumb.top;
    this.screen.xorOutline(outline(top));
    while (ev.down) {
      await ev.tick();
      const next = Math.min(Math.max(ev.y - grab, lo), hi);
      if (next === top) continue;
      this.screen.xorOutline(outline(top));
      top = next;
      this.screen.xorOutline(outline(top));
    }
    this.screen.xorOutline(outline(top));
    top = Math.min(Math.max(ev.y - grab, lo), hi);
    this.playback.counter = fw.valueForThumb(top);
    fw.value = this.playback.counter;
    fw.drawScrollBar();
    this.showFossil();
  }

  private async trackGoAway(): Promise<boolean> {
    const ev = this.events;
    const fw = this.fossilWindow;
    let lit = true;
    fw.drawCloseBox(true);
    while (ev.down) {
      await ev.tick();
      const inside = fw.partAt(ev.x, ev.y) === 'goAway';
      if (inside !== lit) {
        lit = inside;
        fw.drawCloseBox(lit);
      }
    }
    fw.drawCloseBox(false);
    return fw.partAt(ev.x, ev.y) === 'goAway';
  }

  /** DragWindow: a grey outline of the window follows the pointer; the window moves on release. */
  private async dragFossilWindow(x: number, y: number) {
    const ev = this.events;
    const fw = this.fossilWindow;
    const st = fw.structure;
    const frame = { left: st.left, top: st.top, right: st.right - 1, bottom: st.bottom - 1 };
    const at = (dx: number, dy: number) => ({ left: frame.left + dx, top: frame.top + dy, right: frame.right + dx, bottom: frame.bottom + dy });
    let d = { x: 0, y: 0 };
    this.screen.xorOutline(at(0, 0));
    while (ev.down) {
      await ev.tick();
      const next = { x: ev.x - x, y: ev.y - y };
      if (next.x === d.x && next.y === d.y) continue;
      this.screen.xorOutline(at(d.x, d.y));
      d = next;
      this.screen.xorOutline(at(d.x, d.y));
    }
    this.screen.xorOutline(at(d.x, d.y));
    d = { x: ev.x - x, y: ev.y - y };
    if (!d.x && !d.y) return;
    fw.moveBy(d.x, d.y);
    this.redrawPlayback();
  }

  /** GrowWindow: an outline of the window and its scroll-bar lines follows the grow box; it resizes on release. */
  private async growFossilWindow() {
    const ev = this.events;
    const fw = this.fossilWindow;
    const c = fw.content;
    const image = (right: number, bottom: number) => {
      const s = this.screen;
      s.xorOutline({ left: c.left - 1, top: c.top - 19, right: right + 1, bottom: bottom + 1 });
      s.xorOutline({ left: c.left - 1, top: c.top - 1, right: right + 1, bottom: c.top });
      s.xorOutline({ left: right - 15, top: c.top, right: right - 14, bottom: bottom });
    };
    let corner = { x: c.right, y: c.bottom };
    image(corner.x, corner.y);
    while (ev.down) {
      await ev.tick();
      const next = { x: Math.max(ev.x, c.left + 50), y: Math.max(ev.y, c.top + 20) };
      if (next.x === corner.x && next.y === corner.y) continue;
      image(corner.x, corner.y);
      corner = next;
      image(corner.x, corner.y);
    }
    image(corner.x, corner.y);
    fw.resizeTo(Math.max(ev.x, c.left + 50), Math.max(ev.y, c.top + 20));
    this.redrawPlayback();
  }

  private playbackMenus(): Menu[] {
    const [apple] = this.fullMenus;
    const help = this.fullMenus[this.fullMenus.length - 1];
    return [
      apple,
      {
        title: 'Exit',
        items: [
          { label: 'Close Window', key: 'W', run: () => this.closePlayback(false) },
          { label: 'Breed from Current Fossil', key: 'B', run: () => this.breedFromFossil() },
          { label: 'Quit', key: 'Q', run: () => this.quit() },
        ],
      },
      help,
    ];
  }

  private async about() {
    const s = this.screen;
    const exhibits = (zoos as { source: string; genome: Genome }[]).filter((z) => z.source === 'Exhibition zoo');
    await plainBox(this, 462, 294, (r) => {
      const panel = { left: r.left + 92, top: r.top + 12, right: r.right - 92, bottom: r.bottom - 12 };
      s.frame(panel);
      const lines = [
        ['Blind Watchmaker', 'Chicago'],
        ['by Richard Dawkins', 'Chicago'],
        ['', ''],
        ['The 1986 biomorph program, as in', 'Geneva'],
        ['version 1.1 (1993), recreated for', 'Geneva'],
        ['the browser from the behaviour of', 'Geneva'],
        ["Dawkins' original Pascal source.", 'Geneva'],
        ['', ''],
        ['See The Blind Watchmaker (1986),', 'Geneva'],
        ['Norton, Longman and Penguin.', 'Geneva'],
        ['', ''],
        ['Chicago and Geneva pixel fonts by', 'Geneva'],
        ['Giles Booth (CC BY).', 'Geneva'],
      ] as const;
      lines.forEach(([t, f], i) => {
        if (!t) return;
        s.text(t, (panel.left + panel.right - s.textWidth(t, f)) >> 1, panel.top + 24 + i * 15, f);
      });
      [4, 21, 33, 46, 9, 27, 38, 55].forEach((idx, i) => {
        const cell = {
          left: i < 4 ? r.left + 4 : r.right - 88,
          top: r.top + 4 + (i % 4) * 71,
          right: i < 4 ? r.left + 88 : r.right - 4,
          bottom: r.top + 4 + (i % 4) * 71 + 71,
        };
        const pic = develop(exhibits[idx].genome);
        const place = { h: (cell.left + cell.right) >> 1, v: ((cell.top + cell.bottom) >> 1) - centringOffset(pic) };
        for (const l of placedLines(pic, place)) s.line(l, cell);
      });
    });
  }

  private async showHelp(topic: string) {
    const h = HELP[topic];
    if (h) await help(this, h.title, h.body);
  }

  // Menus.

  private menus(): Menu[] {
    const inAlbum = () => this.mode === 'albuming';
    const breedingish = () => ['breeding', 'highlighting', 'preliminary', 'drifting'].includes(this.mode);
    const flag = (label: string, key: keyof MutationFlags, enabled?: () => boolean): MenuItem => ({
      label,
      checked: () => this.flags[key],
      enabled,
      run: () => {
        this.flags[key] = !this.flags[key];
        if (key === 'segmentation' && !this.flags.segmentation) this.flags.gradient = false;
      },
    });
    const anchor = (label: string, corner: 'top' | 'left' | 'right'): MenuItem => ({
      label,
      run: () => {
        this.anchors[corner] = clone(this.active());
      },
    });
    const later = (label: string, key?: string): MenuItem => ({ label, key });
    const alive = () => !this.bereft;
    const inPedigree = () => PEDIGREE_MODES.includes(this.mode);
    const pedigreeMode = (label: string, key: string, mode: Mode): MenuItem => ({
      label,
      key,
      enabled: inPedigree,
      run: () => {
        this.mode = mode;
      },
    });
    const mirrors = (label: string, key: string, rays: number): MenuItem => ({
      label,
      key,
      enabled: () => this.mode === 'phyloging',
      checked: () => this.pedigree.rays === rays,
      run: () => {
        this.pedigree.rays = rays;
      },
    });
    /** Every command but Copy forgets that Copy was the last thing done (for Help). */
    const cmd = (item: MenuItem): MenuItem => ({
      ...item,
      run: item.run && (() => ((this.lastWasCopy = false), item.run!())),
    });
    const menus: Menu[] = [
      {
        title: 'Biomorph',
        iconWidth: 14,
        icon: (s, x, y) => {
          const pic = develop({ ...insect(), trickle: 30 });
          const place = { h: x, v: y - centringOffset(pic) };
          for (const l of placedLines(pic, place)) s.line(l);
        },
        items: [{ label: 'About Blind Watchmaker…', run: () => this.about() }, null],
      },
      {
        title: 'File',
        items: [
          { label: 'Load to Album…', key: 'L', enabled: () => !this.album.full, run: () => this.loadToAlbum() },
          { label: 'Load as Fossils…', key: 'O', run: () => this.loadAsFossils() },
          { label: 'Save Biomorph…', enabled: alive, run: () => this.saveBiomorph() },
          {
            label: 'Save Fossils…',
            key: 'F',
            enabled: () => this.fossils.exist,
            run: async () => void (await this.saveFossils()),
          },
          {
            label: 'Save Album…',
            key: 'S',
            enabled: () => this.album.members().length > 0,
            run: async () => void (await this.saveAlbum()),
          },
          {
            label: 'Close Album',
            key: 'W',
            enabled: () => !this.album.isEmpty && inAlbum(),
            run: () => this.closeAlbum(),
          },
          { label: 'Quit', key: 'Q', run: () => this.quit() },
        ],
      },
      {
        title: 'Edit',
        items: [
          later('Undo', 'Z'),
          null,
          later('Cut', 'X'),
          { label: 'Copy', key: 'C', enabled: alive, run: () => this.copyBiomorph() },
          {
            label: 'Paste',
            key: 'V',
            enabled: () => this.mode === 'albuming' && !!this.copied && this.album.isCleared(this.albumSel),
            run: () => this.pasteSlot(),
          },
          {
            label: 'Clear',
            enabled: () => this.mode === 'albuming' && !!this.album.slots[this.albumSel],
            run: () => this.clearSlot(),
          },
          null,
          {
            label: 'Highlight Biomorph',
            enabled: () => this.mode === 'breeding' || this.mode === 'highlighting',
            run: () => this.doHighlight(),
          },
          {
            label: 'Add Biomorph to Album',
            key: 'A',
            enabled: () =>
              ['highlighting', 'engineering', 'breeding', 'randoming', 'phyloging', 'moving', 'detaching'].includes(
                this.mode,
              ) && !this.album.full,
            run: () => this.addToAlbum(),
          },
          { label: 'Show Album', enabled: () => !this.album.isEmpty, run: () => this.showAlbum() },
        ],
      },
      {
        title: 'Operation',
        items: [
          { label: 'Breed', key: 'B', enabled: alive, run: () => this.doBreed() },
          { label: 'Drift', key: 'D', enabled: alive, run: () => this.doDrift() },
          { label: 'Engineering', key: 'E', enabled: alive, run: () => this.doEngineer() },
          { label: 'Hopeful Monster', key: 'M', run: () => this.doMonster() },
          {
            label: () => (this.fossils.exist ? 'Reinitialize Fossil Record' : 'Initialize Fossil Record'),
            key: 'I',
            run: () => this.initializeFossils(),
          },
          {
            label: 'Play Back Fossils',
            enabled: () => this.fossils.exist && this.mode === 'breeding',
            run: () => this.startPlayback(),
          },
          {
            label: 'Recording Fossils',
            key: 'R',
            enabled: () => this.fossils.exist,
            checked: () => this.fossils.recording,
            run: () => {
              this.fossils.recording = !this.fossils.recording;
            },
          },
          later('Triangle', 'T'),
        ],
      },
      {
        title: 'View',
        items: [
          {
            label: 'More Rows',
            enabled: () => breedingish() && (this.grid.rows + 2) * this.grid.cols <= MAX_BOXES,
            run: () => this.changeGrid(2, 0),
          },
          { label: 'Fewer Rows', enabled: () => breedingish() && this.grid.rows >= 3, run: () => this.changeGrid(-2, 0) },
          {
            label: 'More Columns',
            enabled: () => breedingish() && this.grid.rows * (this.grid.cols + 2) <= MAX_BOXES,
            run: () => this.changeGrid(0, 2),
          },
          {
            label: 'Fewer Columns',
            enabled: () => breedingish() && this.grid.cols >= 3,
            run: () => this.changeGrid(0, -2),
          },
          { label: 'Thicker Pen', enabled: () => this.mode === 'engineering', run: () => this.changePen(1) },
          {
            label: 'Thinner Pen',
            enabled: () => this.mode === 'engineering' && this.penSize > 1,
            run: () => this.changePen(-1),
          },
          {
            label: 'Drift Sweep',
            checked: () => this.sweep,
            run: () => {
              this.sweep = !this.sweep;
              this.sweepSlot = 0;
              if (this.mode === 'drifting') this.win.erase();
            },
          },
          anchor('Make top of triangle', 'top'),
          anchor('Make left of triangle', 'left'),
          anchor('Make right of triangle', 'right'),
        ],
      },
      {
        title: 'Mutations',
        items: [
          flag('Segmentation', 'segmentation'),
          flag('Gradient', 'gradient', () => this.flags.segmentation),
          flag('Asymmetry', 'asymmetry'),
          flag('Radial Sym', 'radialSym'),
          flag('Scaling Factor', 'scalingFactor'),
          flag('Mutation Size', 'mutationSize'),
          flag('Mutation Rate', 'mutationRate'),
          flag('Tapering twigs', 'taperingTwigs'),
        ],
      },
      {
        title: 'Pedigree',
        items: [
          { label: 'Display pedigree', key: '1', enabled: alive, run: () => this.displayPedigree() },
          null,
          pedigreeMode('Draw Out Offspring', '2', 'phyloging'),
          mirrors('No Mirrors', '3', 1),
          mirrors('Single Mirror', '4', 2),
          mirrors('Double Mirrors', '5', 4),
          null,
          pedigreeMode('Move', '6', 'moving'),
          pedigreeMode('Detach', '7', 'detaching'),
          pedigreeMode('Kill', '8', 'killing'),
        ],
      },
      {
        title: 'Help',
        items: [
          {
            label: 'Help with current operation',
            key: 'H',
            run: () => this.showHelp(this.lastWasCopy ? 'copy' : this.mode),
          },
          { label: 'Miscellaneous Help', run: () => this.showHelp('misc') },
        ],
      },
    ];
    return menus.map((m) =>
      m.title === 'Help' ? m : { ...m, items: m.items.map((i) => (i && i.label !== 'Copy' ? cmd(i) : i)) },
    );
  }
}
