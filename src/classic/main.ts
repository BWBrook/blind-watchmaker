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
/** The manual opens as a pop-out window beside the program on wide screens, and as a tab elsewhere. */
document.querySelector<HTMLAnchorElement>('#manual-link')?.addEventListener('click', (e) => {
  const width = 620;
  if (window.screen.availWidth < 1100) return;
  e.preventDefault();
  const height = Math.min(window.screen.availHeight - 60, 960);
  const left = Math.max(0, Math.min(window.screen.availWidth - width, screenX + outerWidth));
  window.open((e.currentTarget as HTMLAnchorElement).href, 'watchmaker-manual', `popup,width=${width},height=${height},left=${left},top=40`)?.focus();
});

addEventListener('resize', fit);
fit();
app.run();
