import { SCREEN_H, SCREEN_W, type Screen } from './screen';

/** A Macintosh tick, 1/60.15 s. */
const TICK_MS = 1000 / 60.15;

export type MacEvent = { type: 'mouseDown'; x: number; y: number } | { type: 'key'; key: string; meta: boolean };

/**
 * A Toolbox-style event source: discrete events are queued and fetched one at a time by the main loop,
 * while the live mouse state can be polled from inside modal tracking loops (StillDown/GetMouse).
 */
export class Events {
  x = -1;
  y = -1;
  down = false;
  moved = false;
  touch = false;
  ticks = 0;
  /** While a dialog is up, every keystroke is claimed from the browser. Unmodified keys are always queued (type-ahead). */
  textInput = false;
  private queue: MacEvent[] = [];
  private cursor = '';
  private obscured = false;
  private hidden = false;
  private frameWaiters: (() => void)[] = [];

  constructor(
    private readonly screen: Screen,
    private readonly keyFilter: (key: string, meta: boolean) => boolean,
  ) {
    const canvas = screen.canvas;
    const locate = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      this.x = Math.floor(((e.clientX - r.left) / r.width) * SCREEN_W);
      this.y = Math.floor(((e.clientY - r.top) / r.height) * SCREEN_H);
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      this.touch = e.pointerType !== 'mouse';
      locate(e);
      this.down = true;
      this.queue.push({ type: 'mouseDown', x: this.x, y: this.y });
    });
    canvas.addEventListener('pointermove', (e) => {
      locate(e);
      this.moved = true;
      if (this.obscured && !this.hidden) {
        this.obscured = false;
        canvas.style.cursor = this.cursor;
      }
    });
    const up = (e: PointerEvent) => {
      locate(e);
      this.down = false;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => {
      if (!this.down && !this.touch) this.x = this.y = -1;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.altKey) return;
      const meta = e.metaKey || e.ctrlKey;
      if (document.activeElement instanceof HTMLInputElement && e.key !== 'Enter' && e.key !== 'Escape') return;
      const wanted = (this.textInput && !meta) || (!e.repeat && this.keyFilter(e.key, meta));
      if (wanted) e.preventDefault();
      if (wanted || (!meta && !e.repeat)) this.queue.push({ type: 'key', key: e.key, meta });
    });
    const tick = () => {
      const now = Math.floor(performance.now() / TICK_MS);
      if (now > this.ticks) {
        this.ticks = now;
        screen.present();
        const waiters = this.frameWaiters;
        this.frameWaiters = [];
        waiters.forEach((w) => w());
      }
      setTimeout(tick, Math.max(0, (this.ticks + 1) * TICK_MS - performance.now()));
    };
    tick();
  }

  setCursor(css: string) {
    this.cursor = css;
    if (!this.obscured && !this.hidden) this.screen.canvas.style.cursor = css;
  }

  /** HideCursor/ShowCursor: unlike obscure(), moving the mouse does not bring the pointer back. */
  hide() {
    this.hidden = true;
    this.screen.canvas.style.cursor = 'none';
  }

  show() {
    this.hidden = false;
    this.obscured = false;
    this.screen.canvas.style.cursor = this.cursor;
  }

  /** ObscureCursor: hide the pointer until the mouse next moves. */
  obscure() {
    this.obscured = true;
    this.screen.canvas.style.cursor = 'none';
  }

  /** FlushEvents: discard everything queued. */
  flush() {
    this.queue = [];
  }

  next(): MacEvent | undefined {
    return this.queue.shift();
  }

  /** Waits for the next screen refresh (one tick, ~1/60 s), presenting the screen first. */
  tick(): Promise<void> {
    return new Promise((resolve) => this.frameWaiters.push(resolve));
  }

  async wait(ticks: number) {
    for (let i = 0; i < ticks; i++) await this.tick();
  }
}
