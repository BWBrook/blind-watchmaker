import { centringOffset, develop, placedLines } from '../engine/develop';
import { basicTree, chess, clone, type Genome, insect, type Swell } from '../engine/genome';
import { Bitmap } from '../engine/raster';
import zoos from '../engine/zoos.json';

/**
 * Biomorph illustrations drawn by the recreation's own engine, so every figure is exactly what the program draws.
 *
 *   <canvas data-bm="basicTree" data-set="segNo=1;dgene=same" data-box="101x100">
 *   <div class="bm-series" data-bm="basicTree" data-series="g9:1,2,3,4,5,6" data-box="101x100"></div>
 *
 * data-bm: basicTree | insect | chess | zoo:<file name>:<index>.  data-set: g1..g9, segNo, segDist, trickle,
 * mutSize, mutProb, completeness, spokes, dgene (all ten), d1..d10.  data-box: a breeding box to centre in.
 */

const NAMED: Record<string, () => Genome> = { basicTree, insect, chess };

function baseGenome(spec: string): Genome {
  if (spec.startsWith('zoo:')) {
    const [, source, index] = spec.split(':');
    const hit = (zoos as { source: string; index: number; genome: Genome }[]).find(
      (z) => z.source === source && z.index === Number(index),
    );
    if (!hit) throw new Error(`No zoo genome ${spec}`);
    return clone(hit.genome);
  }
  return NAMED[spec]();
}

function applySet(g: Genome, set: string | undefined): Genome {
  for (const part of (set ?? '').split(';').filter(Boolean)) {
    const [key, value] = part.split('=').map((s) => s.trim());
    const n = Number(value);
    if (/^g[1-9]$/.test(key)) g.gene[Number(key.slice(1)) - 1] = n;
    else if (/^d([1-9]|10)$/.test(key)) g.dgene[Number(key.slice(1)) - 1] = value as Swell;
    else if (key === 'dgene') g.dgene = Array<Swell>(10).fill(value as Swell);
    else if (key === 'completeness' || key === 'spokes') Object.assign(g, { [key]: value });
    else Object.assign(g, { [key]: n });
  }
  return g;
}

/** Draws g as the program would in a breeding box (or snugly, without a box), in black on white. */
function draw(canvas: HTMLCanvasElement, g: Genome, box: string | undefined, scale: number) {
  const pic = develop(g);
  let w: number;
  let h: number;
  let place: { h: number; v: number };
  if (box) {
    [w, h] = box.split('x').map(Number);
    place = { h: w >> 1, v: (h >> 1) - centringOffset(pic) };
  } else {
    const pad = 6;
    const m = pic.margin;
    w = m.right - m.left + 2 * pad + 8;
    h = m.bottom - m.top + 2 * pad + 8;
    place = { h: pad - m.left, v: pad - m.top };
  }
  const bm = new Bitmap(w, h);
  for (const l of placedLines(pic, place)) bm.line(l);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * scale}px`;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const px = new Uint32Array(img.data.buffer);
  for (let i = 0; i < bm.bits.length; i++) px[i] = bm.bits[i] ? 0xff000000 : 0xffffffff;
  ctx.putImageData(img, 0, 0);
}

function render(el: HTMLElement) {
  const scale = Number(el.dataset.scale ?? 1);
  const base = applySet(baseGenome(el.dataset.bm!), el.dataset.set);
  if (el instanceof HTMLCanvasElement) {
    draw(el, base, el.dataset.box, scale);
    return;
  }
  const [field, values] = el.dataset.series!.split(':');
  for (const v of values.split(',')) {
    const fig = document.createElement('figure');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${el.dataset.label ?? field} = ${v}`);
    draw(canvas, applySet(clone(base), `${field}=${v}`), el.dataset.box, scale);
    const cap = document.createElement('figcaption');
    cap.textContent = `${el.dataset.label ?? field} ${v}`;
    fig.append(canvas, cap);
    el.append(fig);
  }
}

document.querySelectorAll<HTMLElement>('[data-bm]').forEach(render);
