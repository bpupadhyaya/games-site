import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';
import { host } from './src/layout.js';
import { setLogo } from './src/brand.js';
import { setLockup } from './src/menus.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D court.
const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in
// virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros. host.px = css px per virtual unit.
const syncHost = () => {
  const short = Math.max(1, Math.min(window.innerWidth, window.innerHeight)), px = 720 / short, s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

let presenter = null;
try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }

const wrap = (game) => {
  if (new URLSearchParams(location.search).has('dev')) { window.__game = game; window.__presenter = presenter; }   // dev only: lets the test harness read the state
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
boot({ createGame: async (env) => wrap(await createGame(env)), meta, canvas, background: 'rgba(0,0,0,0)' });
