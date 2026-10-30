import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { setScale } from './src/art.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  setScale((Math.min(window.innerWidth, window.innerHeight) / 720) * Math.min(window.devicePixelRatio || 1, 3));
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// Dev / check scripts only (?dev=1 or the app's Developer toggle): expose the game object; the mouse wheel scrolls the menu lists.
let theGame = null;
const create = async (env) => { const game = await createGame(env); theGame = game; if (env.config.dev) window.__bocce = game; return game; };
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// The lit 3D court (view3d/presenter.js) sits behind the transparent kit canvas. The kit boots at once on the baked 2D court; the
// 3D layer is imported and built only after the first frames (never before boot), then crossfades in. With no WebGL, a failed
// import or a lost context, the 2D court simply stays (and comes back on context loss).
let presenter = null;
const q = new URLSearchParams(location.search);
const start3d = () => {
  if (q.has('flat')) return;
  import('./view3d/presenter.js')
    .then((m) => m.createPresenter({ kitCanvas: canvas, getGame: () => theGame }))
    .then((p) => { if (p && p.ok) { presenter = p; if (theGame && theGame.getState && q.has('dev')) window.__p3 = p; } })
    .catch((e) => console.warn('3D court unavailable; 2D court kept', e));
};
boot({
  createGame: async (env) => {
    const game = await create(env);
    return Object.assign({}, game, {
      render(ctx, view) { game.render(ctx, view); if (presenter) presenter.frame(game.getState(), view); },
    });
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
}).then(() => { const go = () => setTimeout(start3d, q.has('now3d') ? 0 : 350); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 900 }); else go(); });
