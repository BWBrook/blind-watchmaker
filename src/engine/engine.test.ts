import { describe, expect, it } from 'vitest';
import { centringOffset, develop } from './develop';
import { decodeRecords, encodeRecords } from './fileformat';
import { basicTree, chess, type Genome, insect } from './genome';
import { reproduce } from './mutate';
import zoos from './zoos.json';

const asRect = (m: { left: number; top: number; right: number; bottom: number }) => [m.left, m.top, m.right, m.bottom];

describe('develop matches the spec test vectors', () => {
  it.each([
    ['BasicTree', basicTree(), 129, [-37, -56, 37, 16], -20],
    ['Insect', insect(), 32, [-15, -15, 15, 21], 3],
    ['Chess', chess(), 64, [-15, -36, 15, 5], -16],
  ])('%s', (_, g, lines, margin, offset) => {
    const pic = develop(g);
    expect(pic.lines).toHaveLength(lines);
    expect(asRect(pic.margin)).toEqual(margin);
    expect(centringOffset(pic)).toBe(offset);
  });

  it('BasicTree starts with the worked lines', () => {
    expect(develop(basicTree()).lines.slice(0, 3)).toEqual([
      { x0: 0, y0: 0, x1: 0, y1: -11, thick: 7 },
      { x0: 0, y0: -11, x1: -6, y1: -21, thick: 6 },
      { x0: -6, y0: -21, x1: -17, y1: -21, thick: 5 },
    ]);
  });

  it('every zoo genome has segNo*2^(gene9-1) + segNo-1 lines', () => {
    for (const { genome } of zoos as { genome: Genome }[]) {
      const n = develop(genome).lines.length;
      expect(n).toBe(genome.segNo * 2 ** (genome.gene[8] - 1) + genome.segNo - 1);
    }
  });
});

it('40-byte records round-trip', () => {
  const genomes = (zoos as { genome: Genome }[]).map((z) => z.genome);
  const buf = encodeRecords(genomes);
  expect(buf.byteLength).toBe(genomes.length * 40);
  expect(decodeRecords(buf, 1000)).toEqual(genomes);
});

it('with every mutation switch off, only genes 1-9 change', () => {
  const off = {
    segmentation: false, gradient: false, asymmetry: false, radialSym: false,
    scalingFactor: false, mutationSize: false, mutationRate: false, taperingTwigs: false,
  };
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const parent = basicTree();
  for (let i = 0; i < 500; i++) {
    const { gene, ...rest } = reproduce(parent, off, rng);
    const { gene: pg, ...prest } = parent;
    expect(rest).toEqual(prest);
    gene.slice(0, 8).forEach((x, j) => expect(Math.abs(x - pg[j]) % parent.mutSize).toBe(0));
    expect(Math.abs(gene[8] - pg[8])).toBeLessThanOrEqual(1);
  }
});
