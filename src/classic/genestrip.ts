import type { Genome } from '../engine/genome';
import type { Zone } from '../engine/mutate';
import { BULLET } from './glyphs';
import type { MacWindow } from './macwindow';

export const STRIP_H = 20;
export const GENE_BOXES = 16;

export const geneWidth = (win: MacWindow) => Math.floor(win.width / GENE_BOXES);

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

const COMPLETENESS = { single: 'Asym', double: 'Bilat' };
const SPOKES = { northOnly: 'Single', nSouth: 'UpDn', radial: 'Radial' };

/** Draws gene box j (1..16) of the "chromosome" strip for genome g. */
export function drawGeneBox(win: MacWindow, g: Genome, j: number) {
  const w = geneWidth(win);
  const r = { left: w * (j - 1), top: 0, right: w * j, bottom: STRIP_H };
  win.erase(r);
  win.frame(r);
  const inner = { left: r.left + 1, top: 1, right: r.right - 1, bottom: STRIP_H - 1 };
  const centred = (t: string) => win.text(t, r.left + ((w - win.textWidth(t)) >> 1), 14, 'Geneva', inner);
  if (j <= 9) centred(String(g.gene[j - 1]));
  else if (j === 12) centred(COMPLETENESS[g.completeness]);
  else if (j === 13) centred(SPOKES[g.spokes]);
  else {
    const v = { 10: g.segNo, 11: g.segDist, 14: g.trickle, 15: g.mutSize, 16: g.mutProb }[j]!;
    win.text(signed(v), r.left + 7, 14, 'Geneva', inner);
  }
  const grad = j <= 9 ? g.dgene[j - 1] : j === 11 ? g.dgene[9] : 'same';
  if (grad === 'swell') win.glyph(BULLET, r.left + 2, 5, inner);
  if (grad === 'shrink') win.glyph(BULLET, r.left + 2, 17, inner);
}

export function drawStrip(win: MacWindow, g: Genome) {
  for (let j = 1; j <= GENE_BOXES; j++) drawGeneBox(win, g, j);
}

/** Which gene box and which third of it a local point falls in (Engineering's click zones). */
export function geneZone(win: MacWindow, x: number, y: number): { box: number; zone: Zone } | undefined {
  const w = geneWidth(win);
  if (y < 0 || y >= STRIP_H || x < 0 || x >= w * GENE_BOXES) return undefined;
  const box = Math.floor(x / w) + 1;
  const left = w * (box - 1);
  const third = Math.floor(w / 3);
  if (x < left + third) return { box, zone: 'left' };
  if (x > left + w - third) return { box, zone: 'right' };
  const v = Math.floor(STRIP_H / 3);
  return { box, zone: y < v ? 'top' : y > STRIP_H - v ? 'bottom' : 'middle' };
}
