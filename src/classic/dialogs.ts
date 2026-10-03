import type { Rect } from '../engine/develop';
import type { Events } from './events';
import { BAR_H } from './menubar';
import { type FontName, SCREEN_H, SCREEN_W, type Screen } from './screen';

export interface DialogHost {
  screen: Screen;
  events: Events;
}

const LINE_H = 16;

export function wrap(screen: Screen, text: string, width: number, font: FontName = 'Chicago'): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && screen.textWidth(next, font) > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export function placeDialog(w: number, h: number): Rect {
  const left = (SCREEN_W - w) >> 1;
  const top = Math.max(BAR_H + 7, Math.floor((SCREEN_H - h) / 3));
  return { left, top, right: left + w, bottom: top + h };
}

export function drawDialogFrame(s: Screen, r: Rect) {
  s.fill(r, 0);
  s.frame(r);
  s.frame({ left: r.left + 3, top: r.top + 3, right: r.right - 3, bottom: r.bottom - 3 }, 2);
}

export interface Button {
  label: string;
  rect: Rect;
}

export function drawButton(s: Screen, b: Button, isDefault: boolean, enabled = true) {
  s.fill(b.rect, 0);
  s.frameRound(b.rect, 8);
  const tw = s.textWidth(b.label);
  s.text(b.label, (b.rect.left + b.rect.right - tw) >> 1, b.rect.top + 14);
  if (!enabled) s.dim(buttonFace(b.rect));
  if (isDefault) {
    const r = b.rect;
    s.frameRound({ left: r.left - 4, top: r.top - 4, right: r.right + 4, bottom: r.bottom + 4 }, 12, 3);
  }
}

export const inside = (r: Rect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

const buttonFace = (r: Rect): Rect => ({ left: r.left + 1, top: r.top + 1, right: r.right - 1, bottom: r.bottom - 1 });

/** Runs a modal dialog until a button is clicked (or Return pressed for the default). Restores the screen afterwards. */
async function modal(host: DialogHost, rect: Rect, buttons: Button[], defaultIndex: number, anyClick = false): Promise<number> {
  const cancel = buttons.findIndex((b) => b.label === 'Cancel');
  const ev = host.events;
  for (;;) {
    await ev.tick();
    const e = ev.next();
    if (!e) continue;
    if (e.type === 'key') {
      if (e.key === 'Escape' && cancel >= 0) return cancel;
      if ((e.key === 'Enter' || e.key === 'Escape') && (defaultIndex >= 0 || anyClick)) return Math.max(defaultIndex, 0);
      continue;
    }
    if (anyClick) return 0;
    const k = buttons.findIndex((b) => inside(b.rect, e.x, e.y));
    if (k >= 0 && inside(rect, e.x, e.y) && (await trackButton(host, buttons[k]))) return k;
  }
}

/** TrackControl for a push button: inverted while the pointer is inside; true if released inside. */
export async function trackButton(host: DialogHost, b: Button): Promise<boolean> {
  const { screen: s, events: ev } = host;
  let lit = true;
  s.invert(buttonFace(b.rect));
  while (ev.down) {
    await ev.tick();
    const now = inside(b.rect, ev.x, ev.y);
    if (now !== lit) {
      s.invert(buttonFace(b.rect));
      lit = now;
    }
  }
  if (lit) s.invert(buttonFace(b.rect));
  return lit;
}

/** A System 6 alert: wrapped text and a row of buttons, the first being the default. Returns the chosen index. */
/** A caution icon (triangle and exclamation mark), 32 x 32, drawn for this recreation. */
function drawCaution(s: Screen, x: number, y: number) {
  const edge = (x0: number, y0: number, x1: number, y1: number) => s.line({ x0, y0, x1, y1, thick: 2 });
  edge(x + 15, y + 1, x + 1, y + 29);
  edge(x + 15, y + 1, x + 29, y + 29);
  edge(x + 1, y + 29, x + 29, y + 29);
  s.fill({ left: x + 14, top: y + 10, right: x + 18, bottom: y + 21 }, 1);
  s.fill({ left: x + 14, top: y + 23, right: x + 18, bottom: y + 27 }, 1);
}

/** A System 6 alert: wrapped text and a row of buttons, the first being the default. Returns the chosen index. */
export async function alert(
  host: DialogHost,
  text: string,
  buttons: string[] = ['OK'],
  icon?: 'caution',
): Promise<number> {
  const s = host.screen;
  const width = 382;
  const textLeft = icon ? 68 : 20;
  const lines = wrap(s, text, width - textLeft - 20);
  const h = Math.max(24 + lines.length * LINE_H, icon ? 52 : 0) + 44;
  const rect = placeDialog(width, h);
  const saved = s.save(rect);
  drawDialogFrame(s, rect);
  if (icon) drawCaution(s, rect.left + 20, rect.top + 14);
  lines.forEach((l, i) => s.text(l, rect.left + textLeft, rect.top + 26 + i * LINE_H));
  let right = rect.right - 22;
  const placed: Button[] = buttons.map((label) => {
    const w = Math.max(58, s.textWidth(label) + 20);
    const b = { label, rect: { left: right - w, top: rect.bottom - 34, right, bottom: rect.bottom - 14 } };
    right -= w + 16;
    return b;
  });
  placed.forEach((b, i) => drawButton(s, b, i === 0));
  const k = await modal(host, rect, placed, 0);
  s.restore(rect, saved);
  return k;
}

/** The tall help dialog: a capitalised title, paragraphs, and an OK button at the bottom centre. */
export async function help(host: DialogHost, title: string, paragraphs: string[]) {
  const s = host.screen;
  const rect = placeDialog(430, 310);
  const saved = s.save(rect);
  drawDialogFrame(s, rect);
  let y = rect.top + 26;
  s.text(title, (rect.left + rect.right - s.textWidth(title)) >> 1, y);
  y += LINE_H + 6;
  for (const p of paragraphs) {
    for (const l of wrap(s, p, 430 - 44)) {
      s.text(l, rect.left + 22, y);
      y += LINE_H;
    }
    y += 6;
  }
  const bw = 70;
  const cx = (rect.left + rect.right) >> 1;
  const ok = { label: 'OK', rect: { left: cx - bw / 2, top: rect.bottom - 36, right: cx + bw / 2, bottom: rect.bottom - 16 } };
  drawButton(s, ok, true);
  await modal(host, rect, [ok], 0);
  s.restore(rect, saved);
}

/** A plain box drawn by `paint`, dismissed by any click or key. */
export async function plainBox(host: DialogHost, w: number, h: number, paint: (r: Rect) => void) {
  const s = host.screen;
  const rect = placeDialog(w, h);
  const saved = s.save(rect);
  s.fill(rect, 0);
  s.frame(rect);
  paint(rect);
  await modal(host, rect, [], -1, true);
  s.restore(rect, saved);
}
