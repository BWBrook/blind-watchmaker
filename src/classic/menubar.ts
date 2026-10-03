import type { Rect } from '../engine/develop';
import type { Events } from './events';
import { CHECK, COMMAND } from './glyphs';
import { SCREEN_W, type Screen } from './screen';

export interface MenuItem {
  /** A function for items whose text changes (e.g. Initialize/Reinitialize Fossil Record). */
  label: string | (() => string);
  key?: string;
  enabled?: () => boolean;
  checked?: () => boolean;
  run?: () => void | Promise<void>;
}

export interface Menu {
  title: string;
  /** Draws a picture title (the Apple-menu position) centred on (x, y) instead of text. */
  icon?: (screen: Screen, x: number, y: number) => void;
  iconWidth?: number;
  items: (MenuItem | null)[];
}

export const BAR_H = 20;
const ITEM_H = 16;
const FIRST_X = 10;

interface Placed {
  menu: Menu;
  title: Rect;
}

export const itemText = (i: MenuItem) => (typeof i.label === 'function' ? i.label() : i.label);

export class MenuBar {
  private placed: Placed[] = [];
  /** Bumped by setMenus, so a command that swaps the bar does not un-highlight a stale title. */
  private generation = 0;

  constructor(
    private readonly screen: Screen,
    private readonly events: Events,
    private menus: Menu[],
  ) {
    this.layout();
  }

  setMenus(menus: Menu[]) {
    this.menus = menus;
    this.generation++;
    this.layout();
    this.draw();
  }

  private layout() {
    let x = FIRST_X;
    this.placed = this.menus.map((menu) => {
      const w = (menu.iconWidth ?? this.screen.textWidth(menu.title)) + 14;
      const p = { menu, title: { left: x, top: 0, right: x + w, bottom: BAR_H - 1 } };
      x += w;
      return p;
    });
  }

  draw() {
    const s = this.screen;
    s.fill({ left: 0, top: 0, right: SCREEN_W, bottom: BAR_H - 1 }, 0);
    s.fill({ left: 0, top: BAR_H - 1, right: SCREEN_W, bottom: BAR_H }, 1);
    for (const { menu, title } of this.placed) {
      if (menu.icon) menu.icon(s, (title.left + title.right) >> 1, 10);
      else s.text(menu.title, title.left + 7, 14);
    }
  }

  keyEquivalents(): Set<string> {
    const keys = new Set<string>();
    for (const m of this.menus) for (const i of m.items) if (i?.key) keys.add(i.key);
    return keys;
  }

  async handleKey(key: string): Promise<boolean> {
    for (const p of this.placed) {
      const item = p.menu.items.find((i) => i?.key === key);
      if (item && isEnabled(item)) {
        await this.runItem(p, item);
        return true;
      }
    }
    return false;
  }

  /** Modal menu tracking from a mouse-down in the bar: press-drag-release, or click to open and click an item. */
  async track(x: number) {
    let open = this.titleAt(x);
    if (!open) return;
    let drop = this.openMenu(open);
    let hi = -1;
    let sticky = !this.events.down;
    for (;;) {
      await this.events.tick();
      const { x: mx, y: my, down } = this.events;
      const over = my >= 0 && my < BAR_H ? this.titleAt(mx) : undefined;
      if (over && over !== open) {
        this.closeMenu(drop);
        open = over;
        drop = this.openMenu(open);
        hi = -1;
      }
      const item = this.itemAt(drop, mx, my);
      if (item !== hi) {
        if (hi >= 0) this.screen.invert(drop.rows[hi]);
        if (item >= 0) this.screen.invert(drop.rows[item]);
        hi = item;
      }
      if (!sticky) {
        if (down) continue;
        if (hi >= 0) return this.choose(open, drop, hi);
        if (over === open) {
          sticky = true;
          continue;
        }
        this.closeMenu(drop);
        return;
      }
      const e = this.events.next();
      if (e?.type === 'key' && e.key === 'Escape') {
        this.closeMenu(drop);
        return;
      }
      if (e?.type !== 'mouseDown') continue;
      const hitItem = this.itemAt(drop, e.x, e.y);
      if (hitItem >= 0) return this.choose(open, drop, hitItem);
      if (e.y < BAR_H && this.titleAt(e.x)) {
        sticky = false;
        continue;
      }
      this.closeMenu(drop);
      return;
    }
  }

  private async choose(p: Placed, drop: Drop, hi: number) {
    for (let k = 0; k < 3; k++) {
      this.screen.invert(drop.rows[hi]);
      await this.events.wait(2);
    }
    this.closeMenu(drop, true);
    const item = drop.items[hi]!;
    await this.runItem(p, item, true);
  }

  private async runItem(p: Placed, item: MenuItem, alreadyHilited = false) {
    if (!alreadyHilited) this.screen.invert(p.title);
    const generation = this.generation;
    try {
      await item.run?.();
    } finally {
      if (generation === this.generation) this.screen.invert(p.title);
    }
  }

  private titleAt(x: number): Placed | undefined {
    return this.placed.find((p) => x >= p.title.left && x < p.title.right);
  }

  private openMenu(p: Placed): Drop {
    const s = this.screen;
    s.invert(p.title);
    const items = p.menu.items;
    const hasKeys = items.some((i) => i?.key);
    const textW = Math.max(...items.map((i) => (i ? s.textWidth(itemText(i)) : 0)));
    const width = textW + 14 + 10 + (hasKeys ? 34 : 0);
    const left = Math.min(p.title.left, SCREEN_W - width - 3);
    const rect = { left, top: BAR_H - 1, right: left + width, bottom: BAR_H + items.length * ITEM_H + 1 };
    const saveRect = { left: rect.left, top: rect.top, right: rect.right + 1, bottom: rect.bottom + 1 };
    const saved = s.save(saveRect);
    s.fill(rect, 0);
    s.frame(rect);
    s.fill({ left: rect.right, top: rect.top + 2, right: rect.right + 1, bottom: rect.bottom + 1 }, 1);
    s.fill({ left: rect.left + 2, top: rect.bottom, right: rect.right + 1, bottom: rect.bottom + 1 }, 1);
    const rows: Rect[] = [];
    items.forEach((item, k) => {
      const top = BAR_H + k * ITEM_H;
      const row = { left: rect.left + 1, top, right: rect.right - 1, bottom: top + ITEM_H };
      rows.push(row);
      if (!item) {
        for (let x = row.left; x < row.right; x += 2) s.fill({ left: x, top: top + 8, right: x + 1, bottom: top + 9 }, 1);
        return;
      }
      s.text(itemText(item), row.left + 13, top + 12);
      if (item.checked?.()) s.glyph(CHECK, row.left + 2, top + 11);
      if (item.key) {
        const kx = row.right - 28;
        s.glyph(COMMAND, kx, top + 12);
        s.text(item.key, kx + 11, top + 12);
      }
      if (!isEnabled(item)) s.dim(row);
    });
    return { placed: p, rect, saveRect, saved, rows, items };
  }

  private closeMenu(d: Drop, keepTitle = false) {
    this.screen.restore(d.saveRect, d.saved);
    if (!keepTitle) this.screen.invert(d.placed.title);
  }

  private itemAt(d: Drop, x: number, y: number): number {
    if (x < d.rect.left || x >= d.rect.right || y < BAR_H) return -1;
    const k = Math.floor((y - BAR_H) / ITEM_H);
    const item = d.items[k];
    return item && isEnabled(item) ? k : -1;
  }
}

interface Drop {
  placed: Placed;
  rect: Rect;
  saveRect: Rect;
  saved: Uint8Array;
  rows: Rect[];
  items: (MenuItem | null)[];
}

const isEnabled = (i: MenuItem) => !!i.run && (i.enabled?.() ?? true);
