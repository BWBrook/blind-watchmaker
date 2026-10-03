import type { Completeness, Genome, Spokes, Swell } from './genome';

/** Dawkins' 40-byte big-endian `person` record, as written by Save Biomorph, Save Album and the fossil record. */
export const RECORD_SIZE = 40;

const SWELL: Swell[] = ['swell', 'same', 'shrink'];
const COMPLETENESS: Completeness[] = ['single', 'double'];
const SPOKES: Spokes[] = ['northOnly', 'nSouth', 'radial'];

export function decodeRecords(buf: ArrayBuffer, max = 100): Genome[] {
  const v = new DataView(buf);
  const out: Genome[] = [];
  for (let o = 0; o + RECORD_SIZE <= buf.byteLength && out.length < max; o += RECORD_SIZE) {
    out.push({
      gene: Array.from({ length: 9 }, (_, i) => v.getInt16(o + 2 * i)),
      dgene: Array.from({ length: 10 }, (_, i) => SWELL[v.getUint8(o + 18 + i)] ?? 'same'),
      segNo: v.getInt16(o + 28),
      segDist: v.getInt16(o + 30),
      completeness: COMPLETENESS[v.getUint8(o + 32)] ?? 'double',
      spokes: SPOKES[v.getUint8(o + 33)] ?? 'northOnly',
      trickle: v.getInt16(o + 34),
      mutSize: v.getInt16(o + 36),
      mutProb: v.getInt16(o + 38),
    });
  }
  return out;
}

export function encodeRecords(genomes: Genome[]): ArrayBuffer {
  const buf = new ArrayBuffer(genomes.length * RECORD_SIZE);
  const v = new DataView(buf);
  genomes.forEach((g, k) => {
    const o = k * RECORD_SIZE;
    g.gene.forEach((x, i) => v.setInt16(o + 2 * i, x));
    g.dgene.forEach((s, i) => v.setUint8(o + 18 + i, SWELL.indexOf(s)));
    v.setInt16(o + 28, g.segNo);
    v.setInt16(o + 30, g.segDist);
    v.setUint8(o + 32, COMPLETENESS.indexOf(g.completeness));
    v.setUint8(o + 33, SPOKES.indexOf(g.spokes));
    v.setInt16(o + 34, g.trickle);
    v.setInt16(o + 36, g.mutSize);
    v.setInt16(o + 38, g.mutProb);
  });
  return buf;
}
