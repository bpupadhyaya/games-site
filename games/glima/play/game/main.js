import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const canvas = document.getElementById('game');
// The 3D scene is drawn in a WebGL canvas behind the kit canvas (transparent). The game starts at once; the presenter loads in the
// background and the 2D picture (same scene, same camera) is shown until it is ready or when there is no WebGL.
let presenter = null;
const no3d = /[?&]no3d=1/.test(window.location.search);   // dev / test: force the 2D picture
const gl = { get on() { return !!(presenter && presenter.stage && presenter.on); }, get p3() { return presenter ? presenter.p3 : null; } };
if (!no3d) createPresenter({ kitCanvas: canvas }).then((p) => { presenter = p && p.stage ? p : null; }).catch((e) => console.warn('3D presenter unavailable', String((e && e.stack) || e)));
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

// Licence text of the 3D layer, shown in About (fetched, so the file stays the single source).
const credits = { text: '' };
try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok || r.status === 0 ? r.text() : '')).then((t) => { credits.text = t || ''; }).catch(() => {}); } catch { /* ignore */ }
const wrap = (game) => {
  const r = game.render.bind(game);
  game.render = (ctx, view) => { if (presenter) presenter.frame(game.getState(), view); r(ctx, view); };
  if (/[?&]dev=1/.test(window.location.search)) window.__glima = game;
  return game;
};
boot({ createGame: (env) => wrap(createGame({ ...env, multi, credits, gl })), meta, canvas, background: 'rgba(0,0,0,0)' });
