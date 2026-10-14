import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');

// The 3D lake (web/view3d) draws behind the transparent kit canvas. It never blocks the game: without WebGL2, with ?nogl, or while the
// assets load the 2D art plays, and the 3D layer takes over the moment it is ready (and again after a lost context is restored).
let presenter = null;
// Store-shot / scripted-scene runs wait for the 3D layer before the first frame. Normal play boots at once on the 2D art; the 3D presenter
// loads in the background and takes over (adopt) the moment it is ready.
const SYNC3D = /[?&](shot|scene|bare|pdb)\b/.test(location.search), NOGL = /[?&]nogl\b/.test(location.search);
let lateGame = null;
const lateWrap = (g) => { let inner = null; lateGame = Object.assign({}, g, { update(dt, i) { return (inner ?? g).update(dt, i); }, render(c, v) { (inner ?? g).render(c, v); }, adopt() { if (!inner && presenter && presenter.stage) inner = presenter.wrap(g); } }); return lateGame; };
const lateBg = (flat) => ({ toString: () => (presenter && presenter.stage && presenter.ready ? 'rgba(0,0,0,0)' : flat) });
const startLate3d = (opts) => {
  createPresenter(opts).then((p) => {
    if (!p || !p.stage) return;
    presenter = p; if (/[?&]dev\b/.test(location.search)) { window.__presenter = p; window.__p3d = p; }
    if (lateGame) lateGame.adopt();
  }).catch((e) => console.warn('3D presenter unavailable', e));
};
try {
  if (SYNC3D && !new URLSearchParams(location.search).has('nogl')) {
    presenter = await createPresenter({ kitCanvas: canvas });
    if (presenter && presenter.stage) await Promise.race([presenter.ready_p, new Promise((r) => setTimeout(r, new URLSearchParams(location.search).has('shot') ? 20000 : 2500))]);
  }
} catch (e) { console.warn('3D presenter unavailable', e); presenter = null; }
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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout and resize check scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__ss = game;
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9201: 'title', 9202: 'aim', 9203: 'fly', 9204: 'banner', 9205: 'collection', 9206: 'watch', 9207: 'result', 9208: 'rules', 9209: 'howto' };
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: async (env) => { const g = await create(env); return presenter && presenter.stage ? presenter.wrap(g) : lateWrap(g); }, meta, canvas, background: lateBg('#000') });
if (!SYNC3D && !NOGL && !presenter) startLate3d({ kitCanvas: canvas });
if (presenter && presenter.stage && new URLSearchParams(location.search).has('dev')) window.__p3d = presenter;   // QA only
