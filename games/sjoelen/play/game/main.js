import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { setCanvasFactory } from './src/art.js';
import { v3 } from './src/v3.js';

const canvas = document.getElementById('game');
// The still board is baked once into an offscreen canvas (see src/art.js).
setCanvasFactory((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
// Ignore a second finger (see src/pointerGuard.js). Registered on window in the capture phase, so it runs before the kit's listeners.
const guard = createPointerGuard();
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
  window.addEventListener(type, (e) => { if (e.target === canvas && !guard(type, e.pointerId, e.isPrimary)) e.stopPropagation(); }, true);
}

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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const qs0 = new URLSearchParams(location.search);
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__dft = game;
  if (qs0.has('spec') && env.config.dev) { try { game.devScene(JSON.parse(qs0.get('spec'))); } catch (e) { console.error(e); } }
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const q = new URLSearchParams(location.search);
let presenter = { wrap: (g) => g, ok: false };
// Boot on the flat 2D art at once; the 3D layer is imported and built after the first frames, then swapped in (store shots and dev runs wait for it).
const wait3d = ['shot', 'scene', 'spec', 'dev'].some((k) => new URLSearchParams(location.search).has(k));
const load3d = async () => {
  if (new URLSearchParams(location.search).has('flat')) return;
  try { const { createPresenter } = await import('./view3d/presenter.js'); presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }
};
if (wait3d) await load3d();
if (q.has('dev')) { window.__p3 = presenter; window.__v3 = v3; }
const flatBg = '#000';
const background = { toString: () => (presenter.ok ? 'rgba(0,0,0,0)' : flatBg) };   // read by the kit every frame, so it turns clear when the 3D layer arrives
boot({ createGame: async (env) => {
  const raw = await create(env);
  if (wait3d) return presenter.wrap(raw);
  let cur = raw;
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80)))).then(load3d).then(() => { if (presenter.ok) cur = presenter.wrap(raw); });
  return new Proxy(raw, { get: (_, k) => cur[k] });
}, meta, canvas, background });
