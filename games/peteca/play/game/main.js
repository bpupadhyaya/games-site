import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { FX } from './src/art.js';
import { hooks as figureHooks, LOOKS } from './src/figure.js';
// The 3D modules load on demand (dynamic import) so the 2D title is not held back by parsing the whole 3D module graph.
const createPeople = (...a) => import('./view3d/people.js').then((m) => m.createPeople(...a));
const createPresenter = (o) => import('./view3d/presenter.js').then((m) => m.createPresenter(o));
try { FX.soft = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches && (window.devicePixelRatio || 1) > 1.5); } catch { /* keep soft shadows */ }

const canvas = document.getElementById('game');
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
  if (env.config.dev) { window.__pt = game; window.__p3d = presenter; }
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9301: 'title', 9302: 'match', 9303: 'smash', 9304: 'doubles', 9305: 'rally', 9306: 'watch' };
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// The 3D scene (view3d presenter): beach, court, athletes, peteca, crowd. It draws in a WebGL canvas behind this transparent canvas.
// Without WebGL (or if it cannot load) the game keeps its 2D court and, when only the full scene fails, the off-screen 3D players.
let presenter = null;
// Store-shot / scripted runs wait for the full 3D scene before the first frame. Normal play boots at once on the 2D court; the 3D scene loads
// in the background and takes over (adopt) the moment it is ready. If it cannot load, the off-screen 3D players are used as before.
const SYNC3D = /[?&](shot|scene|bare)\b/.test(location.search), NOGL = /[?&]gl=0/.test(location.search);
const loadPeople = async () => {
  try {
    const looks = {}; LOOKS.forEach((L, i) => { looks[i] = L; });
    await Promise.race([createPeople(figureHooks, looks).then((h) => (h && h.ready) || null), new Promise((r) => setTimeout(r, 4000))]);
  } catch (e) { console.warn('3D players unavailable', e); }
};
let lateGame = null;
const lateWrap = (g) => { let inner = null; lateGame = Object.assign({}, g, { update(dt, i) { return (inner ?? g).update(dt, i); }, render(c, v) { (inner ?? g).render(c, v); }, adopt() { if (!inner && presenter) inner = presenter.wrap(g); } }); return lateGame; };
const lateBg = (flat) => ({ toString: () => (presenter && presenter.ready ? 'rgba(0,0,0,0)' : flat) });
if (SYNC3D || NOGL) {
  try {
    if (NOGL) throw new Error('3D scene switched off (?gl=0)');
    presenter = await createPresenter({ kitCanvas: canvas });
    if (presenter && presenter.ready_p) {
      // no timer in store-shot runs (their clock is virtual); a stuck load is given up after 25 s and the 3D layer is switched off for good
      const limit = /[?&]shot=1/.test(location.search) ? 0 : 25000;
      await Promise.race([presenter.ready_p.then(() => true).catch(() => false), ...(limit ? [new Promise((r) => setTimeout(() => r(false), limit))] : [])]);
      if (!presenter.ready) { presenter.abort && presenter.abort(); presenter = null; }
    }
  } catch (e) { console.warn('3D presenter unavailable', e); presenter = null; }
  if (!presenter) await loadPeople();
}

const wrapped = (env) => create(env).then((g) => (presenter ? presenter.wrap(g) : lateWrap(g)));
boot({ createGame: wrapped, meta, canvas, background: lateBg('#000') });
if (!SYNC3D && !NOGL) {
  createPresenter({ kitCanvas: canvas }).then(async (p) => {
    let ok = !!p;
    if (p && p.ready_p) {
      await Promise.race([p.ready_p.then(() => true).catch(() => false), new Promise((r) => setTimeout(() => r(false), 25000))]);
      ok = !!p.ready;
      if (!ok) p.abort && p.abort();
    }
    if (ok) { presenter = p; window.__p3d = p; if (lateGame) lateGame.adopt(); } else await loadPeople();
  }).catch(async (e) => { console.warn('3D presenter unavailable', e); await loadPeople(); });
}
