import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { setCanvasFactory } from './src/art.js';
import { v3 } from './src/v3.js';

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
let theGame = null;
const create = async (env) => { const game = await createGame(env); theGame = game; if (env.config.dev) { window.__dft = game; window.__v3 = v3; } return game; };

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Off-screen canvases for the pond's still backdrop (see src/view.js); the game draws directly where this is missing.
setCanvasFactory((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });

// The lit 3D pond (view3d/presenter.js) sits behind the transparent kit canvas. The kit boots at once on the painted 2D pond;
// the 3D layer is imported and built only after the first frames (never before boot), then crossfades in. With no WebGL, a
// failed import or a lost context the painted 2D pond simply stays (and comes back on context loss).
let presenter = null;
const q = new URLSearchParams(location.search);
const start3d = () => {
  if (q.has('flat')) return;
  import('./view3d/presenter.js')
    .then((m) => m.createPresenter({ kitCanvas: canvas }))
    .then((p) => { if (p && p.ok) { presenter = p; if (q.has('dev')) window.__p3 = p; } })
    .catch((e) => console.warn('3D pond unavailable; 2D pond kept', e));
};
boot({
  createGame: async (env) => {
    const game = await create(env);
    return Object.assign({}, game, {
      render(ctx, view) { v3.frame = null; game.render(ctx, view); if (presenter) presenter.frame(v3.frame, game.getState()); },
    });
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
}).then(() => { const go = () => setTimeout(start3d, q.has('now3d') ? 0 : 350); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 900 }); else go(); });
