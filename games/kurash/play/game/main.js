import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { setSprites } from './src/view.js';
const createPresenter = (o) => import('./view3d/presenter.js').then((m) => m.createPresenter(o));   // 3D modules load on demand, off the title's critical path

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const canvas = document.getElementById('game');
// The 3D scene (two real wrestlers, the hall and the mat) is drawn in a WebGL canvas behind the kit canvas, which stays transparent and keeps the
// HUD, the pull pad and every menu. Without WebGL2 (or if loading fails) the flat top-down art keeps playing.
const qs = new URLSearchParams(location.search);
let presenter = null;
// Store-shot / scripted-scene runs wait for the 3D layer before the first frame. Normal play boots at once on the flat 2D art; the 3D presenter
// loads in the background (its modules are a dynamic import) and takes over (adopt) the moment it is created.
const SYNC3D = /[?&](shot|scene|bare)\b/.test(location.search), NOGL = /[?&](flat|nogl)\b/.test(location.search);
let lateGame = null;
const lateWrap = (g, flatRender) => {
  const flat = flatRender ? Object.assign({}, g, { render: flatRender }) : g;
  let inner = null;
  lateGame = Object.assign({}, flat, { update(dt, i) { return (inner ?? flat).update(dt, i); }, render(c, v) { (inner ?? flat).render(c, v); }, adopt() { if (!inner && presenter && presenter.stage) inner = presenter.wrap(g); } });
  return lateGame;
};
const lateBg = (flat) => ({ toString: () => (presenter && presenter.stage && presenter.ready ? 'rgba(0,0,0,0)' : flat) });
const startLate3d = () => {
  createPresenter({ kitCanvas: canvas }).then((p) => {
    if (!p || !p.stage) return;
    presenter = p; if (/[?&]dev\b/.test(location.search)) window.__presenter = p;
    if (lateGame) lateGame.adopt();
  }).catch((e) => console.warn('3D presenter unavailable', e));
};
if (SYNC3D && !NOGL) { try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); } }
if (presenter && presenter.stage && qs.has('dev')) window.__presenter = presenter;
const unitsPerPx = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const px = unitsPerPx(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// The Arcforge badge and the lockup (see src/brand.js): optional, the text credit still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Pre-rendered pictures of the 3D wrestlers for the flat fallback (no WebGL2): optional, the old top-down figures still work.
{ // always loaded (a few KB): after a WebGL context loss mid-bout the flat view draws the same wrestlers
  const spr = { k0: {}, k1: {} }, load = (w, ps) => { const im = new Image(); im.onload = () => { spr[`k${w}`][ps] = im; setSprites(spr); }; im.src = `./brand/k${w}-${ps}.webp`; };
  for (const w of [0, 1]) for (const ps of ['stand', 'fall']) load(w, ps);
}

// Mouse wheel / trackpad scrolls menus and the Rules reader (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * unitsPerPx() * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Several fingers at once (two players on one phone): the kit input follows one pointer, so main.js keeps its own list of touches in
// virtual units (the same units as the kit's pointer: the short side is 720).
const touches = new Map();
const toV = (e) => { const r = canvas.getBoundingClientRect(), k = unitsPerPx(); return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; };
canvas.addEventListener('pointerdown', (e) => { touches.set(e.pointerId, toV(e)); }, true);
canvas.addEventListener('pointermove', (e) => { if (touches.has(e.pointerId)) touches.set(e.pointerId, toV(e)); }, true);
const endT = (e) => { touches.delete(e.pointerId); };
canvas.addEventListener('pointerup', endT, true); canvas.addEventListener('pointercancel', endT, true); canvas.addEventListener('lostpointercapture', endT, true);
const multi = { list: () => [...touches.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y })) };

const make = async (env) => { const g = createGame({ ...env, multi }); if (qs.has('dev')) window.__kurash = g; return presenter && presenter.stage ? presenter.wrap(g) : lateWrap(g); };
boot({ createGame: make, meta, canvas, background: lateBg('#071231') });
if (!SYNC3D && !NOGL && !presenter) startLate3d();
