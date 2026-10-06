import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps the HUD, menus and all input.
// Without WebGL the game keeps playing with its flat 2D ground. The shell also supplies a display clock (drawing only: used to blend between two
// fixed physics steps so motion is smooth at 60 and 120 Hz; it never reaches the simulation).
const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
let presenter = null;
try { presenter = createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }
if (params.has('dev')) window.__p3 = presenter;   // dev only: the 3D presenter for the test harness
const clock = () => globalThis.performance.now();
const wrap = (game) => {
  if (params.has('dev')) window.__game = game;   // dev only: lets the test harness read the state
  if (presenter) return presenter.wrap(game);
  return game;
};
const shot = params.has('shot');
// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in
// virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const short = Math.max(1, Math.min(window.innerWidth, window.innerHeight)), px = 720 / short, s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
// The Arcforge badge and the themed lockup (see src/brand.js): optional, the title screen still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
boot({
  createGame: async (env) => { if (presenter) await presenter.ready; return wrap(await createGame({ ...env, clock, config: shot ? { ...env.config, shot: true } : env.config })); },
  meta, canvas, background: 'rgba(0,0,0,0)',
});
