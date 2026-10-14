import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host, applyLayout } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
  applyLayout(meta.width, meta.height);
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel / trackpad scrolls the reading pages (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout / resize check scripts.
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__ch = game; return game; };

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the text credit still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
let presenter = { wrap: (g) => g, ok: false };
// Boot on the flat 2D art at once; the 3D layer is imported and built after the first frames, then swapped in (store shots and dev runs wait for it).
const wait3d = ['shot', 'scene', 'spec', 'dev'].some((k) => new URLSearchParams(location.search).has(k));
const load3d = async () => {
  if (new URLSearchParams(location.search).has('flat')) return;
  try { const { createPresenter } = await import('./view3d/presenter.js'); presenter = await createPresenter({ kitCanvas: canvas, meta }); } catch (e) { console.warn('3D presenter unavailable', e); }
};
if (wait3d) await load3d();
if (new URLSearchParams(location.search).has('dev')) window.__p3 = presenter;
if (new URLSearchParams(location.search).has('dev')) import('./src/v3.js').then((mod) => { window.__v3 = mod.v3; });
const flatBg = '#1d0610';
const background = { toString: () => (presenter.ok ? 'rgba(0,0,0,0)' : flatBg) };   // read by the kit every frame, so it turns clear when the 3D layer arrives
boot({ createGame: async (env) => {
  const raw = await create(env);
  if (wait3d) return presenter.wrap(raw);
  let cur = raw;
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80)))).then(load3d).then(() => { if (presenter.ok) cur = presenter.wrap(raw); });
  return new Proxy(raw, { get: (_, k) => cur[k] });
}, meta, canvas, background });
