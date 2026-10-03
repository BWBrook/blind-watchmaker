import type { Rect } from '../engine/develop';
import type { Genome } from '../engine/genome';
import {
  alert,
  type Button,
  type DialogHost,
  drawButton,
  drawDialogFrame,
  inside,
  placeDialog,
  trackButton,
} from './dialogs';
import { DISK_NAME, type Disk, type DiskFile, download, type FileType, upload } from './disk';
import type { Glyph } from './glyphs';

type Volume = 'disk' | 'computer';

const VOLUME_NAME: Record<Volume, string> = { disk: DISK_NAME, computer: 'Your computer' };

const FLOPPY: Glyph = [
  '############',
  '#.#......#.#',
  '#.#......#.#',
  '#.########.#',
  '#..........#',
  '#.########.#',
  '#.#......#.#',
  '#.#......#.#',
  '############',
];

const ROW_H = 16;
const ROWS = 7;
const DOUBLE_CLICK_TICKS = 30;
const MAX_NAME = 31;

const offset = (r: Rect, d: Rect): Rect => ({
  left: d.left + r.left,
  top: d.top + r.top,
  right: d.left + r.right,
  bottom: d.top + r.bottom,
});

function drawVolume(host: DialogHost, vol: Volume, x: number, baseline: number, width: number) {
  const s = host.screen;
  s.fill({ left: x, top: baseline - 13, right: x + width, bottom: baseline + 4 }, 0);
  s.glyph(FLOPPY, x, baseline);
  s.text(VOLUME_NAME[vol], x + 17, baseline);
}

/** SFGetFile: choose a Dawkins file from the disk, or from the user's computer via Drive. */
export async function getFile(host: DialogHost, disk: Disk): Promise<{ name: string; genomes: Genome[] } | undefined> {
  const { screen: s, events: ev } = host;
  const d = placeDialog(372, 152);
  const saved = s.save(d);
  const list = offset({ left: 14, top: 14, right: 202, bottom: 14 + 2 + ROWS * ROW_H }, d);
  const textArea = { left: list.left + 1, top: list.top + 1, right: list.right - 16, bottom: list.bottom - 1 };
  const upArrow = { left: list.right - 16, top: list.top, right: list.right, bottom: list.top + 16 };
  const downArrow = { left: list.right - 16, top: list.bottom - 16, right: list.right, bottom: list.bottom };
  const btn = (label: string, top: number): Button => ({ label, rect: offset({ left: 244, top, right: 334, bottom: top + 20 }, d) });
  const eject = btn('Eject', 38);
  const drive = btn('Drive', 64);
  const open = btn('Open', 96);
  const cancel = btn('Cancel', 124);
  let vol: Volume = 'disk';
  let files: DiskFile[] = disk.list();
  let sel = files.length ? 0 : -1;
  let top = 0;
  let lastClick = { tick: -100, row: -1 };

  const canOpen = () => vol === 'computer' || sel >= 0;
  const drawList = () => {
    s.fill(list, 0);
    s.frame(list);
    if (vol === 'computer') {
      s.text('Click Open to choose a', textArea.left + 6, textArea.top + 20, 'Geneva');
      s.text('file on your computer.', textArea.left + 6, textArea.top + 34, 'Geneva');
    } else {
      files.slice(top, top + ROWS).forEach((f, i) => {
        const y = textArea.top + i * ROW_H;
        s.text(f.name, textArea.left + 4, y + 12, 'Chicago', textArea);
        if (top + i === sel) s.invert({ left: textArea.left, top: y, right: textArea.right, bottom: y + ROW_H });
      });
    }
    s.frame({ left: upArrow.left, top: list.top, right: list.right, bottom: list.bottom });
    if (files.length > ROWS && vol === 'disk') {
      s.pattern({ left: upArrow.left + 1, top: upArrow.bottom, right: upArrow.right - 1, bottom: downArrow.top });
      for (const [r, up] of [
        [upArrow, true],
        [downArrow, false],
      ] as const) {
        s.fill({ left: r.left + 1, top: r.top + 1, right: r.right - 1, bottom: r.bottom - 1 }, 0);
        s.frame(r);
        for (let i = 0; i < 5; i++) {
          const y = up ? r.top + 5 + i : r.bottom - 6 - i;
          s.fill({ left: r.left + 3 + i, top: y, right: r.right - 3 - i, bottom: y + 1 }, 1);
        }
      }
    }
  };
  const drawButtons = () => {
    drawButton(s, eject, false, false);
    drawButton(s, drive, false);
    drawButton(s, open, true, canOpen());
    drawButton(s, cancel, false);
    drawVolume(host, vol, d.left + 214, d.top + 26, 150);
  };
  const reveal = () => {
    if (sel < top) top = sel;
    if (sel >= top + ROWS) top = sel - ROWS + 1;
  };
  const redraw = () => {
    drawList();
    drawButtons();
  };

  drawDialogFrame(s, d);
  redraw();
  ev.textInput = true;
  try {
    for (;;) {
      await ev.tick();
      const e = ev.next();
      if (!e) continue;
      let choose = false;
      if (e.type === 'key') {
        if (e.key === 'Escape') return undefined;
        if (e.key === 'Enter') choose = canOpen();
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && files.length && vol === 'disk') {
          sel = Math.min(Math.max(sel + (e.key === 'ArrowDown' ? 1 : -1), 0), files.length - 1);
          reveal();
          drawList();
        }
      } else if (inside(textArea, e.x, e.y) && vol === 'disk') {
        const row = top + Math.floor((e.y - textArea.top) / ROW_H);
        if (row < files.length) {
          choose = row === lastClick.row && ev.ticks - lastClick.tick <= DOUBLE_CLICK_TICKS;
          lastClick = { tick: ev.ticks, row };
          sel = row;
          drawList();
          drawButtons();
        }
      } else if (inside(upArrow, e.x, e.y) || inside(downArrow, e.x, e.y)) {
        const dir = inside(upArrow, e.x, e.y) ? -1 : 1;
        top = Math.min(Math.max(top + dir, 0), Math.max(files.length - ROWS, 0));
        drawList();
      } else if (inside(drive.rect, e.x, e.y) && (await trackButton(host, drive))) {
        vol = vol === 'disk' ? 'computer' : 'disk';
        files = vol === 'disk' ? disk.list() : [];
        sel = files.length ? 0 : -1;
        top = 0;
        redraw();
      } else if (inside(cancel.rect, e.x, e.y) && (await trackButton(host, cancel))) return undefined;
      else if (inside(open.rect, e.x, e.y) && canOpen()) choose = await trackButton(host, open);
      if (!choose) continue;
      if (vol === 'disk') return { name: files[sel].name, genomes: files[sel].genomes };
      const picked = await upload();
      if (picked) return picked;
    }
  } finally {
    ev.textInput = false;
    s.restore(d, saved);
  }
}

/**
 * A real (invisible) text input laid over the canvas field, so typing, pasting, accents and phone keyboards all work;
 * the dialog draws its contents in Chicago.
 */
function textField(canvas: HTMLCanvasElement, field: Rect, value: string): HTMLInputElement {
  const r = canvas.getBoundingClientRect();
  const k = r.width / canvas.width;
  const input = document.createElement('input');
  Object.assign(input, { value, maxLength: MAX_NAME, autocomplete: 'off', spellcheck: false });
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('aria-label', 'File name');
  Object.assign(input.style, {
    position: 'fixed',
    left: `${r.left + field.left * k}px`,
    top: `${r.top + field.top * k}px`,
    width: `${(field.right - field.left) * k}px`,
    height: `${(field.bottom - field.top) * k}px`,
    fontSize: '16px',
    opacity: '0',
    pointerEvents: 'none',
    border: '0',
    padding: '0',
  });
  document.body.append(input);
  input.focus({ preventScroll: true });
  input.select();
  return input;
}

/** SFPutFile: name a file and save it to the disk, or (after Drive) download it to the user's computer. */
export async function putFile(
  host: DialogHost,
  disk: Disk,
  prompt: string,
  defaultName: string,
  type: FileType,
  genomes: Genome[],
): Promise<string | undefined> {
  const { screen: s, events: ev } = host;
  const d = placeDialog(352, 108);
  const saved = s.save(d);
  const field = offset({ left: 12, top: 32, right: 184, bottom: 52 }, d);
  const btn = (label: string, rect: Rect): Button => ({ label, rect: offset(rect, d) });
  const save = btn('Save', { left: 14, top: 76, right: 84, bottom: 96 });
  const cancel = btn('Cancel', { left: 104, top: 76, right: 174, bottom: 96 });
  const eject = btn('Eject', { left: 230, top: 36, right: 320, bottom: 56 });
  const drive = btn('Drive', { left: 230, top: 62, right: 320, bottom: 82 });
  let vol: Volume = 'disk';
  const input = textField(s.canvas, field, defaultName);
  let name = defaultName;
  let selectAll = true;
  let caretOn = true;
  let caretTick = ev.ticks;

  const canSave = () => name.trim().length > 0;
  const sync = (): boolean => {
    const v = input.value.replace(/:/g, '').slice(0, MAX_NAME);
    if (v !== input.value) input.value = v;
    const all = !!v && input.selectionStart === 0 && input.selectionEnd === v.length;
    const changed = v !== name || all !== selectAll;
    name = v;
    selectAll = all;
    return changed;
  };
  const drawField = () => {
    s.fill(field, 0);
    s.frame(field);
    const inner = { left: field.left + 1, top: field.top + 1, right: field.right - 1, bottom: field.bottom - 1 };
    s.text(name, field.left + 4, field.top + 15, 'Chicago', inner);
    const w = s.textWidth(name);
    if (selectAll) s.invert({ left: field.left + 3, top: field.top + 2, right: field.left + 5 + w, bottom: field.bottom - 2 });
    else if (caretOn) s.fill({ left: field.left + 4 + w, top: field.top + 3, right: field.left + 5 + w, bottom: field.bottom - 3 }, 1, inner);
  };
  const drawButtons = () => {
    drawButton(s, save, true, canSave());
    drawButton(s, cancel, false);
    drawButton(s, eject, false, false);
    drawButton(s, drive, false);
    drawVolume(host, vol, d.left + 206, d.top + 24, 140);
  };

  drawDialogFrame(s, d);
  s.text(prompt, d.left + 12, d.top + 24);
  drawField();
  drawButtons();
  try {
    for (;;) {
      await ev.tick();
      if (sync()) {
        caretOn = true;
        caretTick = ev.ticks;
        drawField();
        drawButtons();
      } else if (ev.ticks - caretTick >= 30 && !selectAll) {
        caretOn = !caretOn;
        caretTick = ev.ticks;
        drawField();
      }
      const e = ev.next();
      if (!e) continue;
      let commit = false;
      if (e.type === 'key') {
        if (e.key === 'Escape') return undefined;
        commit = e.key === 'Enter' && canSave();
      } else if (inside(field, e.x, e.y)) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(input.value.length, input.value.length);
      } else if (inside(drive.rect, e.x, e.y) && (await trackButton(host, drive))) {
        vol = vol === 'disk' ? 'computer' : 'disk';
        drawButtons();
      } else if (inside(cancel.rect, e.x, e.y) && (await trackButton(host, cancel))) return undefined;
      else if (inside(save.rect, e.x, e.y) && canSave()) commit = await trackButton(host, save);
      if (!commit) continue;
      const fileName = name.trim();
      if (vol === 'computer') {
        download(fileName, genomes);
        return fileName;
      }
      const existing = disk.find(fileName);
      if (existing?.locked) {
        await alert(host, `"${existing.name}" is locked. Please choose another name.`);
        continue;
      }
      if (existing && (await alert(host, `Replace existing "${existing.name}"?`, ['Cancel', 'Replace'], 'caution')) !== 1) {
        continue;
      }
      disk.write(fileName, type, genomes);
      return fileName;
    }
  } finally {
    input.remove();
    s.restore(d, saved);
  }
}
