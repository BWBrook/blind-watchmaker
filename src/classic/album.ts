import { clone, type Genome } from '../engine/genome';

export const ALBUM_PAGES = 4;
export const PER_PAGE = 15;
const CAPACITY = ALBUM_PAGES * PER_PAGE;

/**
 * The album: slots fill in order, page by page. Clear leaves a hole (null) that only Paste refills;
 * holes vanish when the album is saved and reloaded.
 */
export class Album {
  slots: (Genome | null)[] = [];
  dirty = false;

  get full() {
    return this.slots.length >= CAPACITY;
  }

  get pages() {
    return Math.ceil(this.slots.length / PER_PAGE);
  }

  get isEmpty() {
    return this.slots.length === 0;
  }

  members(): Genome[] {
    return this.slots.filter((g): g is Genome => g !== null);
  }

  /** Appends loaded biomorphs while there is room; returns how many fitted. */
  append(genomes: Genome[]): number {
    const room = Math.min(genomes.length, CAPACITY - this.slots.length);
    for (const g of genomes.slice(0, room)) this.slots.push(clone(g));
    return room;
  }

  clear(slot: number) {
    if (this.slots[slot]) {
      this.slots[slot] = null;
      this.dirty = true;
    }
  }

  isCleared(slot: number) {
    return slot >= 0 && slot < this.slots.length && this.slots[slot] === null;
  }

  paste(slot: number, g: Genome) {
    this.slots[slot] = clone(g);
    this.dirty = true;
  }

  reset() {
    this.slots = [];
    this.dirty = false;
  }
}
