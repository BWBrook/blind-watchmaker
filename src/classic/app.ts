import { centringOffset, develop, type Line, placedLines, type Rect } from '../engine/develop';
import { encodeRecords } from '../engine/fileformat';
import { basicTree, chess, clone, type Genome, insect } from '../engine/genome';
import { defaultFlags, engineer, hopefulMonster, type MutationFlags, reproduce } from '../engine/mutate';
import zoos from '../engine/zoos.json';
import { type CursorName, cursorCss } from './cursors';
import { alert, type DialogHost, help, plainBox } from './dialogs';
import type { Events, MacEvent } from './events';
import { drawGeneBox, drawStrip, geneZone, STRIP_H } from './genestrip';
import { HELP } from './helptext';
import { MacWindow } from './macwindow';
import { BAR_H, type Menu, MenuBar, type MenuItem } from './menubar';
import type { Screen } from './screen';

type Mode = 'preliminary' | 'breeding' | 'highlighting' | 'engineering' | 'randoming' | 'drifting';

/** Progressive drawing speed: placed lines per tick (the original was bound by 1980s hardware). */
const LINES_PER_TICK = 48;
const DRIFT_TICKS = 10;
const ENGINEERING_REPEAT_DELAY = 32;
const MAX_BOXES = 100;

const glide = (a: number, b: number) => (Math.abs(b - a) <= 20 ? b : a + Math.trunc((b - a) / 2));

export class App implements DialogHost {
  readonly win: MacWindow;
  readonly menubar: MenuBar;
  private mode: Mode = 'preliminary';
  private rows = 3;
  private cols = 5;
  private breedGrid = { rows: 3, cols: 5 };
  private children: Genome[] = [];
  private special = 0;
  private flags: MutationFlags = defaultFlags();
  private penSize = 1;
  private sweep = false;
  private sweepSlot = 0;
  private lastDrift = 0;
  private hovered = -1;
  private anchors = { top: basicTree(), left: insect(), right: chess() };
  private cursorScale = 1;
  private cursorName: CursorName | '' = '';

  constructor(
    readonly screen: Screen,
    readonly events: Events,
  ) {
    this.win = new MacWindow(screen);
    this.menubar = new MenuBar(screen, events, this.menus());
  }

  wantsKey(key: string, meta: boolean): boolean {
    const k = key.toUpperCase();
    if (k === 'ESCAPE' || k === 'ENTER') return true;
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

  // Geometry (window-local), following SetUpBoxes.

  private get nBoxes() {
    return this.rows * this.cols;
  }

  private get mid() {
    return this.nBoxes >> 1;
  }

  private get boxW() {
    return Math.floor(this.win.width / this.cols);
  }

  private get boxH() {
    return Math.floor((this.win.height - STRIP_H) / this.rows);
  }

  private box(k: number): Rect {
    const left = this.boxW * (k % this.cols);
    const top = STRIP_H + this.boxH * Math.floor(k / this.cols);
    return { left, top, right: left + this.boxW, bottom: top + this.boxH };
  }

  private centre(k: number) {
    const b = this.box(k);
    return { h: b.left + (this.boxW >> 1), v: b.top + (this.boxH >> 1) };
  }

  private business(): Rect {
    return { left: 0, top: STRIP_H, right: this.boxW * this.cols, bottom: STRIP_H + this.boxH * this.rows };
  }

  private boxAt(x: number, y: number): number {
    const b = this.business();
    if (x < b.left || x >= b.right || y < b.top || y >= b.bottom) return -1;
    return Math.floor((y - STRIP_H) / this.boxH) * this.cols + Math.floor(x / this.boxW);
  }

  private active(): Genome {
    return this.children[this.special];
  }

  private setActive(g: Genome) {
    this.children = Array(this.nBoxes);
    this.children[this.mid] = g;
    this.special = this.mid;
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
    for (let k = 0; k < this.nBoxes; k++) this.win.frame(this.box(k), this.mode === 'breeding' && k === this.mid ? 3 : 1);
  }

  // Event loop.

  private async handle(e: MacEvent) {
    if (e.type === 'key') {
      await this.menubar.handleKey(e.key);
      return;
    }
    if (e.y < BAR_H) {
      await this.menubar.track(e.x);
      return;
    }
    const p = this.win.local(e.x, e.y);
    if (!p) return;
    if (this.mode === 'breeding') {
      const k = this.boxAt(p.x, p.y);
      if (k >= 0) await this.evolve(k);
    } else if (this.mode === 'highlighting') {
      const k = this.boxAt(p.x, p.y);
      if (k >= 0 && this.children[k]) {
        this.win.invert(this.box(this.special));
        this.special = k;
        this.win.invert(this.box(k));
      }
    } else if (this.mode === 'engineering') await this.engineerClick(p.x, p.y);
    else if (this.mode === 'randoming') await this.newMonster();
  }

  private async idle() {
    const p = this.win.local(this.events.x, this.events.y);
    this.adjustCursor(p);
    if (!p) return;
    if (this.mode === 'breeding' || this.mode === 'highlighting') {
      const k = this.boxAt(p.x, p.y);
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
    if (p) {
      if (this.mode === 'randoming') name = 'die';
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

  // Operations.

  private async doBreed() {
    const parent = this.active();
    this.events.obscure();
    this.mode = 'breeding';
    ({ rows: this.rows, cols: this.cols } = this.breedGrid);
    this.setActive(parent);
    this.win.erase();
    this.frameBoxes();
    drawStrip(this.win, parent);
    const { genome, lines } = this.linesFor(parent, this.centre(this.mid), true);
    this.children[this.mid] = genome;
    await this.drawSlowly(lines, this.box(this.mid));
    await this.evolve(this.mid);
  }

  /** Bio:Evolve. The chosen biomorph glides to the centre, then each offspring follows a flash of umbilical cord. */
  private async evolve(j: number) {
    const ev = this.events;
    const mid = this.mid;
    const biz = this.business();
    const { genome: parent, pic } = this.linesFor(this.children[j], this.centre(j), true);
    const off = centringOffset(pic);
    const target = this.centre(mid);
    let at = this.centre(j);
    ev.obscure();
    const show = (clip: Rect) => {
      this.win.erase(biz);
      this.drawNow(placedLines(pic, { h: at.h, v: at.v - off }), clip);
    };
    show(this.box(j));
    while (at.h !== target.h || at.v !== target.v) {
      await ev.tick();
      at = { h: glide(at.h, target.h), v: glide(at.v, target.v) };
      show(biz);
    }
    this.setActive(parent);
    show(this.box(mid));
    this.frameBoxes();
    for (let k = 0; k < this.nBoxes; k++) {
      if (k === mid) continue;
      const c = this.centre(k);
      const cord = { x0: target.h, y0: target.v, x1: c.h, y1: c.v, thick: 1 };
      this.win.line(cord, biz, 'xor');
      await ev.wait(2);
      this.win.line(cord, biz, 'xor');
      const { genome, lines } = this.linesFor(reproduce(parent, this.flags), c, true);
      this.children[k] = genome;
      await this.drawSlowly(lines, this.box(k));
    }
    this.hovered = -1;
  }

  private doHighlight() {
    if (this.mode === 'highlighting') return;
    this.mode = 'highlighting';
    this.win.invert(this.box(this.special));
    drawStrip(this.win, this.active());
  }

  private async doEngineer() {
    const g = this.active();
    this.mode = 'engineering';
    this.win.erase();
    const { genome, lines } = this.linesFor(g, this.centre(this.mid), true, true);
    this.setActive(genome);
    drawStrip(this.win, genome);
    await this.drawSlowly(lines, this.business());
  }

  private redrawEngineered() {
    const biz = this.business();
    const { genome, lines } = this.linesFor(this.active(), this.centre(this.mid), true, true);
    this.children[this.mid] = genome;
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
      this.children[this.mid] = genome;
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
    const { genome, lines } = this.linesFor(g, this.centre(this.mid), false);
    this.setActive(genome);
    await this.drawSlowly(lines, this.business());
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
    const n = this.nBoxes;
    const k = this.sweepSlot;
    this.win.frame(this.box((k + n - 1) % n), 3, 'white');
    this.win.erase(this.box(k));
    this.win.frame(this.box(k));
    const { genome, lines } = this.linesFor(g, this.centre(k), true);
    await this.drawSlowly(lines, this.box(k));
    this.children[this.special] = reproduce(genome, this.flags);
    this.sweepSlot = (k + 1) % n;
  }

  private async changeGrid(dr: number, dc: number) {
    const g = this.active();
    this.rows += dr;
    this.cols += dc;
    this.breedGrid = { rows: this.rows, cols: this.cols };
    this.mode = 'preliminary';
    this.win.erase();
    this.frameBoxes();
    const { genome, lines } = this.linesFor(g, this.centre(this.mid), true);
    this.setActive(genome);
    await this.drawSlowly(lines, this.box(this.mid));
  }

  private changePen(d: number) {
    this.penSize += d;
    this.redrawEngineered();
  }

  private saveBiomorph() {
    const blob = new Blob([encodeRecords([this.active()])], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'biomorph.biom';
    a.click();
    URL.revokeObjectURL(a.href);
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
    return [
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
          later('Load to Album…', 'L'),
          later('Load as Fossils…', 'O'),
          { label: 'Save Biomorph…', run: () => this.saveBiomorph() },
          later('Save Fossils…', 'F'),
          later('Save Album…', 'S'),
          later('Close Album', 'W'),
          { label: 'Quit', key: 'Q', run: () => location.assign('../') },
        ],
      },
      {
        title: 'Edit',
        items: [
          later('Undo', 'Z'),
          null,
          later('Cut', 'X'),
          later('Copy', 'C'),
          later('Paste', 'V'),
          later('Clear'),
          null,
          {
            label: 'Highlight Biomorph',
            enabled: () => this.mode === 'breeding' || this.mode === 'highlighting',
            run: () => this.doHighlight(),
          },
          later('Add Biomorph to Album', 'A'),
          later('Show Album'),
        ],
      },
      {
        title: 'Operation',
        items: [
          { label: 'Breed', key: 'B', run: () => this.doBreed() },
          { label: 'Drift', key: 'D', run: () => this.doDrift() },
          { label: 'Engineering', key: 'E', run: () => this.doEngineer() },
          { label: 'Hopeful Monster', key: 'M', run: () => this.doMonster() },
          later('Initialize Fossil Record', 'I'),
          later('Play Back Fossils'),
          later('Recording Fossils', 'R'),
          later('Triangle', 'T'),
        ],
      },
      {
        title: 'View',
        items: [
          {
            label: 'More Rows',
            enabled: () => breedingish() && (this.rows + 2) * this.cols <= MAX_BOXES,
            run: () => this.changeGrid(2, 0),
          },
          { label: 'Fewer Rows', enabled: () => breedingish() && this.rows >= 3, run: () => this.changeGrid(-2, 0) },
          {
            label: 'More Columns',
            enabled: () => breedingish() && this.rows * (this.cols + 2) <= MAX_BOXES,
            run: () => this.changeGrid(0, 2),
          },
          { label: 'Fewer Columns', enabled: () => breedingish() && this.cols >= 3, run: () => this.changeGrid(0, -2) },
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
          later('Display pedigree', '1'),
          null,
          later('Draw Out Offspring', '2'),
          later('No Mirrors', '3'),
          later('Single Mirror', '4'),
          later('Double Mirrors', '5'),
          null,
          later('Move', '6'),
          later('Detach', '7'),
          later('Kill', '8'),
        ],
      },
      {
        title: 'Help',
        items: [
          { label: 'Help with current operation', key: 'H', run: () => this.showHelp(this.mode) },
          { label: 'Miscellaneous Help', run: () => this.showHelp('misc') },
        ],
      },
    ];
  }
}
