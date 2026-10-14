import { createLazy3d } from './lazy3d.js';
import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { setCanvasFactory } from './src/art.js';
import { setLicenses } from './src/content.js';

const canvas = document.getElementById('game');

// Fingers. The kit's input has ONE pointer (used by every menu); the table itself can use several: two players each keep
// a finger on their own half. `touches` holds every finger currently down, in virtual units; the game reads it from
// input.touches (see the wrapper below). The guard hides second fingers from the kit so menus never see them.
const touches = new Map();
const guard = createPointerGuard();
const toVirtual = (e) => {
  const r = canvas.getBoundingClientRect(), cpu = meta.cssPerUnit || (r.width / meta.width) || 1;
  const ox = (r.width - meta.width * cpu) / 2, oy = (r.height - meta.height * cpu) / 2;
  return { x: (e.clientX - r.left - ox) / cpu, y: (e.clientY - r.top - oy) / cpu };
};
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
  window.addEventListener(type, (e) => {
    if (e.target !== canvas) return;
    if (type === 'pointerdown' || (type === 'pointermove' && touches.has(e.pointerId))) touches.set(e.pointerId, { id: e.pointerId, ...toVirtual(e) });
    else if (type === 'pointerup' || type === 'pointercancel') touches.delete(e.pointerId);
    if (!guard(type, e.pointerId, e.isPrimary)) e.stopPropagation();
  }, true);
}
window.addEventListener('blur', () => touches.clear());

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
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__dft = game;
  return { ...game, update(dt, input) { input.touches = [...touches.values()]; game.update(dt, input); } };
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { if (t) setLicenses(t); }).catch(() => {});

// Off-screen canvases for the table's still art (see src/art.js); the game draws directly where this is missing.
setCanvasFactory((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const qsL = new URLSearchParams(location.search);
const lazy = createLazy3d({
  canvas, flatBg: '#1a0d08', eager: qsL.has('shot') || qsL.has('scene'), readyTimeout: 20000,
  load: async () => { if (qsL.has('flat')) return null; const { createPresenter } = await import('./view3d/presenter.js'); return createPresenter({ kitCanvas: canvas }); },
});
await lazy.prepare();
boot({ createGame: async (env) => lazy.wrap(await create(env)), meta, canvas, background: lazy.background });
lazy.start();
