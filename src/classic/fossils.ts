import { clone, type Genome } from '../engine/genome';

/**
 * The fossil record (the original's temporary "Fossil History" file): the parent chosen at every generation of
 * breeding while recording is on, oldest first. Recording starts off; Initialize Fossil Record turns it on.
 */
export class FossilRecord {
  records: Genome[] = [];
  recording = false;
  unsaved = false;

  get exist() {
    return this.records.length > 0;
  }

  append(g: Genome) {
    this.records.push(clone(g));
    this.unsaved = true;
  }

  /** ResetFossils: empty the record and start recording. */
  reset() {
    this.records = [];
    this.unsaved = false;
    this.recording = true;
  }
}
