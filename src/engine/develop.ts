import { div, type Genome, normalise, WORRY_MAX } from './genome';

export interface Line {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  thick: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Pic {
  genome: Genome;
  lines: Line[];
  margin: Rect;
}

export interface DevelopOptions {
  penSize?: number;
  engineering?: boolean;
}

const MAX_THICK = 8;

function plugIn(gene: number[]) {
  const [g1, g2, g3, g4, g5, g6, g7, g8] = gene;
  return {
    dx: [-g2, -g1, 0, g1, g2, g3, 0, -g3],
    dy: [g6, g5, g4, g5, g6, g7, g8, g7],
    order: gene[8],
  };
}

export function develop(genome: Genome, opts: DevelopOptions = {}): Pic {
  const g = normalise(genome);
  const penSize = opts.penSize ?? 1;
  const lines: Line[] = [];
  const m: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
  const picLine = (x0: number, y0: number, x1: number, y1: number, thick: number) => {
    if (lines.length >= WORRY_MAX) throw new Error('Biomorph too large');
    lines.push({ x0, y0, x1, y1, thick: Math.min(thick, MAX_THICK) });
  };

  let { dx, dy, order } = plugIn(g.gene);
  const extra = g.dgene[9] === 'swell' ? g.trickle : g.dgene[9] === 'shrink' ? -g.trickle : 0;
  const running = [...g.gene];
  let inc = 0;
  let oddOne = true;
  const here = { h: 0, v: 0 };

  const tree = (x: number, y: number, len: number, dir: number) => {
    if (dir < 0) dir += 8;
    if (dir >= 8) dir -= 8;
    const xn = x + div(len * dx[dir], g.trickle);
    const yn = y + div(len * dy[dir], g.trickle);
    m.left = Math.min(m.left, x, xn);
    m.right = Math.max(m.right, x, xn);
    m.top = Math.min(m.top, y, yn);
    m.bottom = Math.max(m.bottom, y, yn);
    const thick = g.dgene[8] === 'shrink' ? len : g.dgene[8] === 'swell' ? 1 + g.gene[8] - len : 1;
    picLine(x, y, xn, yn, thick * penSize);
    if (len > 1) {
      const [first, second] = oddOne ? [dir + 1, dir - 1] : [dir - 1, dir + 1];
      tree(xn, yn, len - 1, first);
      if (len < order) tree(xn, yn, len - 1, second);
    }
  };

  for (let seg = 1; seg <= g.segNo; seg++) {
    oddOne = seg % 2 === 1;
    if (seg > 1) {
      const oldV = here.v;
      here.v += div(g.segDist + inc, g.trickle);
      inc += extra;
      picLine(here.h, oldV, here.h, here.v, g.dgene[8] === 'shrink' ? g.gene[8] : 1);
      for (let j = 0; j < 8; j++) {
        if (g.dgene[j] === 'swell') running[j] += g.trickle;
        if (g.dgene[j] === 'shrink') running[j] -= g.trickle;
      }
      running[8] = Math.max(running[8], 1);
      ({ dx, dy, order } = plugIn(running));
    }
    tree(here.h, here.v, order, 2);
  }

  if (-m.left > m.right) m.right = -m.left;
  else m.left = -m.right;
  const up = -m.top;
  const down = m.bottom;
  if (g.spokes !== 'northOnly' || opts.engineering) {
    if (up > down) m.bottom = up;
    else m.top = -down;
  }
  if (g.spokes === 'radial') {
    const wid = m.right - m.left;
    const ht = m.bottom - m.top;
    if (wid > ht) {
      m.top = -div(wid, 2) - 1;
      m.bottom = div(wid, 2) + 1;
    } else {
      m.left = -div(ht, 2) - 1;
      m.right = div(ht, 2) + 1;
    }
  }
  return { genome: g, lines, margin: m };
}

/** Vertical offset that puts the bounding box's mid-height on the box centre (placement mode A). */
export const centringOffset = (pic: Pic): number =>
  pic.margin.top + div(pic.margin.bottom - pic.margin.top, 2);

type Copy = (a: number, b: number) => [number, number];

const copiesFor = (g: Genome): Copy[] => {
  const single = g.completeness === 'single';
  if (g.spokes === 'northOnly') return single ? [(a, b) => [a, b]] : [(a, b) => [a, b], (a, b) => [-a, b]];
  const ns: Copy[] = single
    ? [(a, b) => [a, b], (a, b) => [-a, -b]]
    : [(a, b) => [a, b], (a, b) => [-a, b], (a, b) => [a, -b], (a, b) => [-a, -b]];
  if (g.spokes === 'nSouth') return ns;
  const ew: Copy[] = single
    ? [(a, b) => [-b, a], (a, b) => [b, -a]]
    : [(a, b) => [b, a], (a, b) => [-b, a], (a, b) => [b, -a], (a, b) => [-b, -a]];
  return [...ns, ...ew];
};

/** Every line the original DrawPic strokes, in drawing order (each line then its mirror images), rooted at `place`. */
export function placedLines(pic: Pic, place: { h: number; v: number }): Line[] {
  const out: Line[] = [];
  const copies = copiesFor(pic.genome);
  for (const l of pic.lines) {
    for (const copy of copies) {
      const [a0, b0] = copy(l.x0, l.y0);
      const [a1, b1] = copy(l.x1, l.y1);
      out.push({ x0: place.h + a0, y0: place.v + b0, x1: place.h + a1, y1: place.v + b1, thick: l.thick });
    }
  }
  return out;
}
