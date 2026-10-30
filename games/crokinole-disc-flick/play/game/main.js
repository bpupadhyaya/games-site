import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
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
// 3D presenter (a walnut-rimmed maple board with brass pegs and lacquer discs on a red buffalo-plaid wool cloth, behind the kit canvas). The
// game boots at once on the flat 2D art; three.js is fetched and the scene built after the first paint. The 2D layer fills v3 while it draws
// the table (title attract, play, watch, result); the presenter only reads it. No WebGL, ?flat=1 or a lost context: the flat art as before.
const q = new URLSearchParams(location.search);
let presenter = null;
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    v3.clear();
    g.render(ctx, view);
    const on = !!(presenter && v3.ready && v3.table);
    if (presenter) presenter.canvas.style.visibility = on ? 'visible' : 'hidden';
    if (on) presenter.frame();
  },
});
const create = async (env) => { const game = wrap(await createGame(env)); if (env.config.dev) { window.__dft = game; window.__v3 = v3; } return game; };

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#000' });
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    presenter = p; v3.ready = true;
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
