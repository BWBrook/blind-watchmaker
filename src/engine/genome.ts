export type Swell = 'swell' | 'same' | 'shrink';
export type Completeness = 'single' | 'double';
export type Spokes = 'northOnly' | 'nSouth' | 'radial';

export interface Genome {
  gene: number[];
  dgene: Swell[];
  segNo: number;
  segDist: number;
  completeness: Completeness;
  spokes: Spokes;
  trickle: number;
  mutSize: number;
  mutProb: number;
}

export const TRICKLE = 10;
export const WORRY_MAX = 4095;

export const twoToThe = (n: number): number => (n >= 0 && n <= 12 ? 2 ** n : 8192);

export const div = (a: number, b: number): number => Math.trunc(a / b);

export const pascalRound = (x: number): number => Math.sign(x) * Math.round(Math.abs(x));

export const overCap = (g: Genome): boolean => g.segNo * twoToThe(g.gene[8]) > WORRY_MAX;

export const clone = (g: Genome): Genome => ({ ...g, gene: [...g.gene], dgene: [...g.dgene] });

export function normalise(g: Genome): Genome {
  const n = clone(g);
  n.segNo = Math.max(n.segNo, 1);
  n.trickle = Math.max(n.trickle, 1);
  n.mutSize = Math.max(n.mutSize, 1);
  n.mutProb = Math.min(Math.max(n.mutProb, 1), 100);
  n.gene[8] = Math.max(n.gene[8], 1);
  while (overCap(n) && n.gene[8] > 1) n.gene[8] -= 1;
  while (overCap(n)) n.segNo -= 1;
  return n;
}

function makeGenes(gene: number[]): Genome {
  return {
    gene,
    dgene: Array<Swell>(10).fill('same'),
    segNo: 1,
    segDist: 150,
    completeness: 'double',
    spokes: 'northOnly',
    trickle: TRICKLE,
    mutSize: TRICKLE / 2,
    mutProb: 10,
  };
}

export function basicTree(): Genome {
  const g = makeGenes([-10, -20, -20, -15, -15, 0, 15, 15, 7]);
  g.segNo = 2;
  g.completeness = 'single';
  for (const j of [3, 4, 5, 8]) g.dgene[j] = 'shrink';
  g.trickle = 9;
  return g;
}

export function insect(): Genome {
  const T = TRICKLE;
  return makeGenes([T, T, -4 * T, T, -T, -2 * T, 8 * T, -4 * T, 6]);
}

export function chess(): Genome {
  const T = TRICKLE;
  return makeGenes([-T, 3 * T, -3 * T, -3 * T, T, -2 * T, 6 * T, -5 * T, 7]);
}
