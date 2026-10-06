import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D court. The kit loop does not hand the draw call its sub-step fraction, so the
// shell supplies a display clock (drawing only: the game uses it to blend between two fixed physics steps; it never reaches the simulation).
const canvas = document.getElementById('game');
// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px (browsers: none).
// The layout works in virtual units (short side = 720), so convert with the current scale.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
// The Arcforge badge and the themed lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const params = new URLSearchParams(location.search);
let presenter = null;
try { if (!params.has('nogl')) presenter = await createPresenter({ kitCanvas: canvas, meta }); } catch (e) { console.warn('3D presenter unavailable', e); }
const clock = () => globalThis.performance.now();
const wrap = (game) => {
  if (params.has('dev')) { window.__game = game; window.__presenter = presenter; }
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = params.has('shot');
const shotOpts = { mode: params.get('mode') || '1v1', role: params.get('role') || 'back', equip: params.get('equip') || 'hand' };
boot({ createGame: async (env) => wrap(await createGame({ ...env, clock, config: shot ? { ...env.config, shot: true, shotOpts } : env.config })), meta, canvas, background: 'rgba(0,0,0,0)' });
