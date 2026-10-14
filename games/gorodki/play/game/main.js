import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';
import { createLazy3d } from './lazy3d.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two fixed physics steps; it never reaches the simulation).
const clock = () => globalThis.performance.now();
// Short vibration pulses where the web view allows them (Android browsers and web views; iOS web views ignore the call).
const haptic = (ms) => { try { if (globalThis.navigator && (!globalThis.navigator.userActivation || globalThis.navigator.userActivation.hasBeenActive) && typeof globalThis.navigator.vibrate === 'function') globalThis.navigator.vibrate(ms); } catch { /* no vibration here */ } };
let live = null;
const canvas = document.getElementById('game');

// The 3D town (web/view3d) draws behind the transparent kit canvas. It never blocks the game: without WebGL2, with ?nogl, or while the
// assets load the 2D art plays, and the 3D layer takes over the moment it is ready (and again after a lost context is restored).
const qs0 = new URLSearchParams(location.search);
const lazy = createLazy3d({
  canvas, flatBg: '#16243a', eager: qs0.has('shot'), readyTimeout: qs0.has('shot') ? 20000 : 2500,
  load: async () => (qs0.has('nogl') ? null : createPresenter({ kitCanvas: canvas })),
});
await lazy.prepare();

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// Mouse wheel and trackpad scrolling for the long reading screens and menus (the kit only forwards pointer and key input).
// CSS px -> virtual units.
canvas.addEventListener('wheel', (e) => {
  if (!live || typeof live.wheel !== 'function') return;
  e.preventDefault();
  live.wheel(e.deltaY * (e.deltaMode === 1 ? 24 : 1) * 1.6 * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))));
}, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout / resize check scripts.
const create = async (env) => { live = await createGame({ ...env, clock, haptic }); if (env.config.dev) window.__gk = live; return live; };

// The Arcforge badge (see src/brand.js): optional, the game reads fine without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
// The themed lockup (this game's colours); the drawn lockup stays as the fallback until it loads.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: async (env) => lazy.wrap(await create(env)), meta, canvas, background: lazy.background });
lazy.start();
if (new URLSearchParams(location.search).has('dev')) Object.defineProperty(window, '__p3d', { get: () => lazy.presenter });   // QA only
