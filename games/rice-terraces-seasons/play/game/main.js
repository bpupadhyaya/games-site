import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The 3D hillside is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps the HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D picture.
const canvas = document.getElementById('game');
let presenter = null;
try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }
const dev = new URLSearchParams(location.search).has('dev');
if (presenter && dev) window.__presenter = presenter;

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in virtual
// units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const unitsPerPx = () => 720 / Math.max(1, Math.min(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight));
const syncHost = () => {
  const k = unitsPerPx(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * k : 0; host.r = s ? (s.right || 0) * k : 0; host.b = s ? (s.bottom || 0) * k : 0; host.l = s ? (s.left || 0) * k : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * k : 0; host.px = 1 / k;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

let live = null;
canvas.addEventListener('wheel', (e) => { if (live && live.wheel) { live.wheel((e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY) * unitsPerPx()); e.preventDefault(); } }, { passive: false });
const wrap = (game) => {
  live = game;
  if (dev) window.__game = game;   // dev only: lets the test harness read the state
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = new URLSearchParams(location.search).has('shot');
boot({ createGame: async (env) => wrap(await createGame({ ...env, config: shot ? { ...env.config, shot: true } : env.config })), meta, canvas, background: 'rgba(0,0,0,0)' });
