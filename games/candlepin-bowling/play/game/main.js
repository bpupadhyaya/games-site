import { boot } from './kit/index.js';
import { installResizeGuard } from './resizeguard.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

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

// Dev / check scripts only (?dev=1 or the app's Developer toggle): expose the game object; the mouse wheel scrolls the menu lists.
let theGame = null;
const create = async (env) => { const game = await createGame(env); theGame = game; if (env.config.dev) window.__candle = game; return game; };
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
// The kit boots at once (its resize handling, heartbeat and the flat 2D screens must not wait for WebGL: on slow / software-GL devices
// the 3D start-up blocks the main thread for many seconds and a rotation during it was lost). The presenter is created after boot and
// the game is routed through it as soon as it is ready; until then (and with no WebGL) the flat 2D art draws.
const none = { wrap: (g) => g, ok: false };
let bootDone; const booted = new Promise((r) => { bootDone = r; });
const presenterReady = booted.then(() => new Promise((r) => setTimeout(r, 800)))
  .then(() => createPresenter({ kitCanvas: canvas })).catch((e) => { console.warn('3D presenter unavailable', e); return none; });
// Resize guard (1.1.2): keeps canvas pixels == CSS box x dpr when a rotation lands while the page is busy; see resizeguard.js.
const guard = installResizeGuard({ canvas, win: window });
window.__canvasStale = guard.stale;
boot({
  createGame: async (env) => {
    const game = await create(env);
    let wrapped = null;
    presenterReady.then((p) => { if (p.ok) wrapped = p.wrap(game); });
    return Object.assign({}, game, {
      update: (dt, input) => (wrapped || game).update(dt, input),
      render: (ctx, view) => (wrapped || game).render(ctx, view),
    });
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
}).then(() => { guard.burst(); bootDone(); });
