import { decodeRecords, encodeRecords } from '../engine/fileformat';
import type { Genome } from '../engine/genome';
import zoos from '../engine/zoos.json';

/** Finder file types used by the original: a single biomorph, an album (collection), a fossil record. */
export type FileType = 'BIOM' | 'COLL' | 'FOSS';

export interface DiskFile {
  name: string;
  type: FileType;
  genomes: Genome[];
  locked: boolean;
}

export const DISK_NAME = 'Blind Watchmaker';
const STORAGE_KEY = 'blind-watchmaker:disk';

const toBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;

function builtIns(): DiskFile[] {
  const bySource = new Map<string, Genome[]>();
  for (const z of zoos as { source: string; genome: Genome }[]) {
    bySource.set(z.source, [...(bySource.get(z.source) ?? []), z.genome]);
  }
  return [...bySource].map(([name, genomes]) => ({
    name,
    type: genomes.length > 1 ? 'COLL' : 'BIOM',
    genomes,
    locked: true,
  }));
}

/**
 * The floppy in the drive: Dawkins' own files (locked) plus whatever the user saves, kept in this browser.
 * Without browser storage the user's files last only for the session.
 */
export class Disk {
  private readonly locked = builtIns();
  private saved = new Map<string, { type: FileType; data: string }>();

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.saved = new Map(Object.entries(JSON.parse(raw)));
    } catch {
      this.saved = new Map();
    }
  }

  list(): DiskFile[] {
    const mine = [...this.saved].map(([name, f]) => ({
      name,
      type: f.type,
      genomes: decodeRecords(fromBase64(f.data)),
      locked: false,
    }));
    return [...this.locked, ...mine].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  find(name: string): DiskFile | undefined {
    return this.list().find((f) => f.name.toLowerCase() === name.toLowerCase());
  }

  write(name: string, type: FileType, genomes: Genome[]) {
    this.saved.set(name, { type, data: toBase64(encodeRecords(genomes)) });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.saved)));
    } catch {
      // Storage blocked or full: the file stays on the disk for this session only.
    }
  }
}

/** Saves records to the user's computer as a download. */
export function download(name: string, genomes: Genome[]) {
  const blob = new Blob([encodeRecords(genomes)], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Opens the browser's file chooser and reads Dawkins-format records; resolves to undefined if cancelled. */
export function upload(): Promise<{ name: string; genomes: Genome[] } | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, genomes: decodeRecords(await file.arrayBuffer()) } : undefined);
    });
    input.addEventListener('cancel', () => resolve(undefined));
    input.click();
  });
}
