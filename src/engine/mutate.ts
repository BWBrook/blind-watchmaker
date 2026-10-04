import { clone, type Genome, overCap, pascalRound, type Spokes, type Swell, twoToThe, WORRY_MAX } from './genome';

export type Rng = () => number;

export interface MutationFlags {
  segmentation: boolean;
  gradient: boolean;
  asymmetry: boolean;
  radialSym: boolean;
  scalingFactor: boolean;
  mutationSize: boolean;
  mutationRate: boolean;
  taperingTwigs: boolean;
}

export const defaultFlags = (): MutationFlags => ({
  segmentation: true,
  gradient: true,
  asymmetry: true,
  radialSym: true,
  scalingFactor: true,
  mutationSize: false,
  mutationRate: false,
  taperingTwigs: true,
});

/** Mac `RandInt`: uniform on 1..n. */
export const randInt = (rng: Rng, n: number): number => 1 + Math.floor(rng() * n);

const sign = (rng: Rng) => (randInt(rng, 2) === 2 ? 1 : -1);

/** Dawkins' test `RandInt(100) < n`, so a stated n% is really (n-1)%. */
const hit = (rng: Rng, n: number) => randInt(rng, 100) < n;

const randSwell = (rng: Rng, s: Swell): Swell =>
  s !== 'same' ? 'same' : randInt(rng, 2) === 1 ? 'shrink' : 'swell';

export function reproduce(parent: Genome, flags: MutationFlags, rng: Rng = Math.random): Genome {
  const c = clone(parent);
  if (flags.mutationRate && hit(rng, c.mutProb)) {
    do c.mutProb += sign(rng);
    while (c.mutProb < 1 || c.mutProb > 100);
  }
  for (let j = 0; j < 8; j++) if (hit(rng, c.mutProb)) c.gene[j] += sign(rng) * c.mutSize;
  if (hit(rng, c.mutProb)) {
    c.gene[8] = Math.max(c.gene[8] + sign(rng), 1);
    if (overCap(c)) c.gene[8] -= 1;
  }
  if (flags.segmentation && hit(rng, c.mutProb)) {
    const d = sign(rng);
    c.segNo += d;
    if (d > 0 && overCap(c)) c.segNo -= 1;
  }
  c.segNo = Math.max(c.segNo, 1);
  const half = Math.trunc(c.mutProb / 2);
  if (flags.gradient && flags.segmentation && c.segNo > 1) {
    for (let j = 0; j < 8; j++) if (hit(rng, half)) c.dgene[j] = randSwell(rng, c.dgene[j]);
    if (hit(rng, half)) c.dgene[9] = randSwell(rng, c.dgene[9]);
  }
  if (flags.taperingTwigs && hit(rng, c.mutProb)) c.dgene[8] = randSwell(rng, c.dgene[8]);
  if (flags.segmentation && c.segNo > 1 && hit(rng, c.mutProb)) c.segDist += sign(rng);
  if (flags.asymmetry && hit(rng, half)) c.completeness = c.completeness === 'single' ? 'double' : 'single';
  if (flags.radialSym && hit(rng, half)) {
    c.spokes = c.spokes !== 'nSouth' ? 'nSouth' : sign(rng) === 1 ? 'radial' : 'northOnly';
  }
  if (flags.scalingFactor && hit(rng, c.mutProb)) c.trickle = Math.max(c.trickle + sign(rng), 1);
  if (flags.mutationSize && hit(rng, c.mutProb)) c.mutSize = Math.max(c.mutSize + sign(rng), 1);
  return c;
}

const MAX_TRIES = 100;

export function hopefulMonster(from: Genome, flags: MutationFlags, rng: Rng = Math.random): Genome {
  const g = clone(from);
  if (flags.segmentation) {
    g.segNo = randInt(rng, 6);
    g.segDist = randInt(rng, 20);
  } else {
    g.segNo = 1;
    g.segDist = 1;
  }
  g.completeness = flags.asymmetry && randInt(rng, 100) < 50 ? 'single' : 'double';
  g.spokes = 'northOnly';
  if (flags.radialSym) {
    const r = randInt(rng, 100);
    g.spokes = r < 33 ? 'radial' : r < 66 ? 'nSouth' : 'northOnly';
  }
  if (flags.scalingFactor) {
    g.trickle = 1 + Math.trunc(randInt(rng, 100) / 10);
    if (g.trickle > 1) g.mutSize = Math.trunc(g.trickle / 2);
  }
  for (let j = 0; j < 8; j++) {
    let factor: number;
    do {
      g.gene[j] = g.mutSize * (randInt(rng, 19) - 10);
      g.dgene[j] = flags.gradient && flags.segmentation ? randSwell(rng, g.dgene[j]) : 'same';
      factor = g.dgene[j] === 'same' ? 0 : 1;
    } while (Math.abs(g.gene[j] * g.segNo * factor) > 9 * g.trickle);
  }
  let tries = 0;
  do {
    g.dgene[8] = flags.taperingTwigs ? randSwell(rng, g.dgene[8]) : 'same';
    g.dgene[9] = flags.gradient && flags.segmentation ? randSwell(rng, g.dgene[8]) : 'same';
    if (++tries > MAX_TRIES) g.dgene[9] = 'same';
  } while (g.dgene[9] !== 'same' && Math.abs(g.segDist * g.segNo) > 100);
  do g.gene[8] = randInt(rng, 6);
  while (g.gene[8] <= 1);
  return g;
}

/** Gene-bar boxes 1..16 and the click zone within a box. */
export type Zone = 'left' | 'right' | 'top' | 'middle' | 'bottom';

const RUNG: Record<'top' | 'middle' | 'bottom', Swell> = { top: 'swell', middle: 'same', bottom: 'shrink' };

/** Engineering edit of one gene box. Returns the edited genome and whether the original would redraw it. */
export function engineer(from: Genome, box: number, zone: Zone): { genome: Genome; redraw: boolean } {
  const g = clone(from);
  const side = zone === 'left' ? -1 : zone === 'right' ? 1 : 0;
  const rung = side === 0 ? RUNG[zone as 'top' | 'middle' | 'bottom'] : undefined;
  if (box >= 1 && box <= 8) {
    if (rung) g.dgene[box - 1] = rung;
    else g.gene[box - 1] += side * g.mutSize;
  } else if (box === 9) {
    if (rung) g.dgene[8] = rung;
    else {
      g.gene[8] += side;
      if (side > 0 && overCap(g)) g.gene[8] -= 1;
    }
  } else if (box === 10 && side) {
    g.segNo += side;
    if (side > 0 && overCap(g)) g.segNo -= 1;
  } else if (box === 11) {
    if (rung) g.dgene[9] = rung;
    else g.segDist += side * g.trickle;
  } else if (box === 12 && side) {
    g.completeness = side < 0 ? 'single' : 'double';
  } else if (box === 13) {
    g.spokes = side < 0 ? 'northOnly' : side > 0 ? 'radial' : 'nSouth';
  } else if (box === 14 && side) {
    g.trickle = Math.max(g.trickle + side, 1);
  } else if (box === 15 && side) {
    g.mutSize = Math.max(g.mutSize + side, 1);
  } else if (box === 16 && side) {
    g.mutProb = Math.min(Math.max(g.mutProb + side, 1), 100);
  }
  const redraw = !(g.gene[8] > 12 || g.gene[8] < 1 || g.segNo < 1 || box >= 15);
  g.gene[8] = Math.max(g.gene[8], 1);
  g.segNo = Math.max(g.segNo, 1);
  return { genome: g, redraw };
}

const SWELL_ORD: Swell[] = ['swell', 'same', 'shrink'];
const SPOKES_ORD: Spokes[] = ['northOnly', 'nSouth', 'radial'];
const clampTo = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

/**
 * Triangle's weights for point m, measured from the left corner b, for a screen `screenHeight` pixels high
 * (k = round(200 * H / 340): 201 on a 512 x 342 screen). r1 weights the top anchor, r2 the left, r3 the right.
 * Points outside the triangle extrapolate.
 */
export function triangleWeights(
  b: { h: number; v: number },
  m: { h: number; v: number },
  screenHeight: number,
): [number, number, number] {
  const k = pascalRound((200 * screenHeight) / 340);
  const x = m.h - b.h;
  const y = b.v - m.v;
  return [y / k, (k - x - y / 2) / k, (x - y / 2) / k];
}

/** Triangle `Concoct`: weighted blend of three genomes (weights need not be in 0..1). */
export function concoct(r: [number, number, number], a: Genome, b: Genome, c: Genome): Genome {
  const w = (f: (g: Genome) => number) => pascalRound(r[0] * f(a) + r[1] * f(b) + r[2] * f(c));
  const g = clone(a);
  g.segNo = Math.max(1, w((x) => x.segNo));
  g.segDist = w((x) => x.segDist);
  g.completeness = clampTo(w((x) => (x.completeness === 'single' ? 0 : 1)), 0, 1) ? 'double' : 'single';
  g.spokes = SPOKES_ORD[clampTo(w((x) => SPOKES_ORD.indexOf(x.spokes)), 0, 2)];
  for (let j = 0; j < 9; j++) g.gene[j] = w((x) => x.gene[j]);
  if (g.segNo * twoToThe(g.gene[8]) > WORRY_MAX) g.gene[8] -= 1;
  g.gene[8] = Math.max(g.gene[8], 1);
  g.trickle = w((x) => x.trickle);
  g.mutSize = w((x) => x.mutSize);
  g.mutProb = clampTo(w((x) => x.mutProb), 1, 100);
  for (let j = 0; j < 10; j++) g.dgene[j] = SWELL_ORD[clampTo(w((x) => SWELL_ORD.indexOf(x.dgene[j])), 0, 2)];
  return g;
}
