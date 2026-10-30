import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

const canvas = document.getElementById('game');

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
let isDev = false;
const create = async (env) => { const game = await createGame(env); isDev = !!env.config.dev; if (isDev) window.__gs = game; return game; };

// The Arcforge brand pictures (see src/brand.js): optional, the game looks right without them.
const load = (src, fn) => { const i = new Image(); i.onload = () => fn(i); i.src = src; };
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

// The lit 3D backyard (view3d/presenter.js) sits behind the transparent kit canvas. The kit boots at once on the 2D yard; the 3D layer is
// imported and built only after the first frames (never before boot), then cross-fades in. With no WebGL, a failed import or a lost
// context the 2D yard simply stays (and comes back on context loss).
let presenter = null;
const start3d = () => {
  import('./view3d/presenter.js')
    .then((m) => m.createPresenter({ kitCanvas: canvas }))
    .then((p) => { if (p && p.ok) { presenter = p; if (isDev) window.__p3 = p; } })
    .catch((e) => console.warn('3D yard unavailable; 2D yard kept', e));
};
boot({
  createGame: async (env) => {
    const game = await create(env);
    return Object.assign({}, game, { render(ctx, view) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore(); game.render(ctx, view); if (presenter) presenter.frame(); } });
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
}).then(() => { const go = () => setTimeout(start3d, 350); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 900 }); else go(); });
