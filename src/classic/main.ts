import { App } from './app';
import { Events } from './events';
import { loadFonts, SCREEN_H, SCREEN_W, Screen } from './screen';
import './style.css';

await loadFonts();
const canvas = document.querySelector<HTMLCanvasElement>('#screen')!;
const screen = new Screen(canvas);
let app: App | undefined;
const events = new Events(screen, (key, meta) => app?.wantsKey(key, meta) ?? false);
app = new App(screen, events);

function fit() {
  const { clientWidth, clientHeight } = document.documentElement;
  const room = Math.min((clientWidth - 16) / SCREEN_W, (clientHeight - 56) / SCREEN_H);
  const scale = room >= 1 ? Math.floor(room) : Math.max(room, 0.3);
  canvas.style.width = `${SCREEN_W * scale}px`;
  canvas.style.height = `${SCREEN_H * scale}px`;
  app?.setScale(scale);
}
addEventListener('resize', fit);
fit();
app.run();
