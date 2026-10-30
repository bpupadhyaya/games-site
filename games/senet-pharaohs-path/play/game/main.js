import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ui } from './src/view.js';
import { v3 } from './src/v3.js';

const canvas = document.getElementById('game');
const unitsPerPx = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));   // the short side is always 720 virtual units

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units, so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const u = unitsPerPx(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * u : 0; host.r = s ? (s.right || 0) * u : 0; host.b = s ? (s.bottom || 0) * u : 0; host.l = s ? (s.left || 0) * u : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * u : 0; host.px = 1 / u;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// Mouse wheel and trackpad scrolling for the reference pages (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (e.deltaMode === 1 ? 32 : 1) * unitsPerPx(); }, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object and the drawn-button log for the layout check scripts.
// The lit 3D chamber (web/view3d) is built AFTER the flat title has painted, then fades in behind the transparent kit canvas.
// No WebGL2, ?flat=1, or a lost context: the flat 2D art simply stays (v3.on = false).
let presenter = null;
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) { window.__senet = game; window.__ui = ui; ui.on = true; }
  return Object.assign({}, game, { render(ctx, view) { game.render(ctx, view); if (v3.on && presenter) presenter.draw(); } });
};
const q = new URLSearchParams(location.search);
const start3d = () => {
  if (q.has('flat')) return;
  let n = 3; const step = () => (--n > 0 ? requestAnimationFrame(step) : setTimeout(load3d, 20)); requestAnimationFrame(step);
};
const load3d = async () => {
  try {
    const { createPresenter } = await import('./view3d/presenter.js');
    const p = await createPresenter({ kitCanvas: canvas });
    if (!p.ok) return;
    presenter = p; if (q.has('dev')) window.__p3 = p;
    p.adopt();
  } catch (e) { console.warn('Senet 3D unavailable; keeping the flat art', e); v3.on = false; }
};

// Arcforge pictures (see src/brand.js): optional, the game reads without them.
const load = (src, set) => { const im = new Image(); im.onload = () => set(im); im.src = src; };
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

const background = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#1a0d06') };   // the kit reads it every frame: transparent while the 3D chamber shows
await boot({ createGame: create, meta, canvas, background });
start3d();
