import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/ui/frame.js';
import { setLogo, setLockup } from './src/ui/brand.js';

const canvas = document.getElementById('game');
const short = () => Math.max(1, Math.min(window.innerWidth, window.innerHeight));

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / short();
  const s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0;
  host.r = s ? (s.right || 0) * px : 0;
  host.b = s ? (s.bottom || 0) * px : 0;
  host.l = s ? (s.left || 0) * px : 0;
  // the shell's translucent back button only exists in apps where the game is rotatable (insets present); 0 in a browser
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0;
  host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// Mouse wheel / trackpad scrolls the reader and the card grid (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  wheelInput.dy += e.deltaY * (720 / short()) * (e.deltaMode === 1 ? 16 : 1);
}, { passive: false });

// The Arcforge badge and the themed lockup (see src/ui/brand.js): optional, the game reads without them.
const load = (src, set) => {
  const img = new Image();
  img.onload = () => set(img);
  img.src = src;
};
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) {
    window.__oao = game;
    window.__oaoMeta = meta;
  }
  return game;
};

boot({ createGame: create, meta, canvas, background: '#070b1c' });
