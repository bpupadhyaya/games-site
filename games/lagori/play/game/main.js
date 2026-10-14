import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

const canvas = document.getElementById('game');
// The 3D street court (web/view3d) draws behind the transparent kit canvas. It never blocks the game: without WebGL2, with ?nogl, or if
// the assets are slow (more than 1.6 s) the 2D art plays and the 3D layer takes over the moment it is ready.
let presenter = null;
let has3d = false;
const qs0 = new URLSearchParams(location.search);
// Boot on the flat 2D art at once; the 3D layer is imported and built after the first frames, then swapped in (store shots and dev runs wait for it).
const wait3d = ['shot', 'scene', 'spec', 'dev'].some((k) => qs0.has(k));
const load3d = async () => {
  try {
    if (qs0.has('nogl')) return;
    const { createPresenter } = await import('./view3d/presenter.js');
    presenter = await createPresenter({ kitCanvas: canvas });
    if (presenter && presenter.stage) await Promise.race([presenter.ready_p, new Promise((r) => setTimeout(r, qs0.has('shot') || !wait3d ? 12000 : 1600))]);
  } catch (e) { console.warn('3D presenter unavailable', e); presenter = null; }
  has3d = !!(presenter && presenter.stage);
  host.gl = has3d;
};
if (wait3d) await load3d();

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
// Mouse wheel scrolls the reader pages (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) { window.__game = game; window.__presenter = presenter; }
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): `scene` stages a moment through the real engine.
  const q = new URLSearchParams(window.location.search);
  if (q.has('shot') || q.has('scene')) { const SHOT = { 9301: 'title', 9302: 'strike', 9303: 'flight', 9304: 'rebuild', 9305: 'field', 9306: 'dodge', 9307: 'watch' }; const sc = q.get('scene') || SHOT[env.config.seed]; if (sc) game.shotScene(sc); }
  if (wait3d) return has3d ? presenter.wrap(game) : game;
  let cur = game;
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80)))).then(load3d).then(() => { if (has3d) cur = presenter.wrap(game); });
  return new Proxy(game, { get: (_, k) => cur[k] });
};

// The Arcforge badge and lockup (see src/brand.js): optional, the title screen still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: { toString: () => (has3d ? 'rgba(0,0,0,0)' : '#1a0d22') } });   // read every frame: clear once the 3D layer arrives
