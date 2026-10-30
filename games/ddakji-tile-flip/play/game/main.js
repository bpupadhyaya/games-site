import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { FX } from './src/art.js';
import { v3 } from './src/v3.js';
import { ABOUT } from './src/content.js';
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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
let presenter = null, inner = null, DEV = false;
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) {
    DEV = true; window.__dft = game; Object.defineProperty(window, '__p3', { get: () => presenter });
    const render = game.render.bind(game); let first = true;
    game.render = (ctx, view) => { if (first) { first = false; window.__dftFirstRender = performance.now(); } return render(ctx, view); };
  }
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9101: 'title', 9102: 'aim', 9103: 'flip', 9104: 'fold', 9105: 'collection', 9106: 'watch' };
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a hanok floor room with an oiled-paper mat and thick folded tiles), behind the kit canvas. The game boots at once on the
// flat 2D art; three.js is fetched and the scene built in small slices after the first frames, then it crossfades in. No WebGL or a
// lost context: the flat art stays / returns. The 3D camera is the game's own camera, so taps need no remapping.
const bg = { toString: () => (v3.on && v3.fade > 0.02 ? 'rgba(0,0,0,0)' : '#000') };      // read by the kit every frame, so the switch is instant
const wrap = (g) => {
  const render = g.render.bind(g);
  g.render = (ctx, view) => {
    if (v3.on && presenter) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); presenter.pre(); }
    render(ctx, view);
    if (v3.on && presenter) presenter.post();
  };
  return g;
};
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
{
  const q = new URLSearchParams(location.search);
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); if (DEV && q.has('flat')) return; presenter = p; p.attach(inner); };   // ?flat works only with the dev flag
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));   // let the flat title paint and become interactive first
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
setTimeout(() => fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  const p = [];
  for (const part of md.split(/\n\s*\n/)) { const t = part.trim(); if (t && !t.startsWith('#')) p.push(t.replace(/\s*\n\s*/g, ' ').replace(/[`*_]/g, '')); }
  if (p.length) ABOUT.push({ title: '3D graphics credits', p });
}).catch(() => {}), 400);
