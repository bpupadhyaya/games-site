import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setMeasureCtx } from './src/menus.js';
import * as MN from './src/menus.js';
import { setLogo, setLockup } from './src/brand.js';

const canvas = document.getElementById('game');
const qs = new URLSearchParams(location.search);
// The arena is drawn in 3D in a WebGL canvas behind the kit canvas (transparent: HUD, menus and input stay on top). Without WebGL, or if the
// canvas context is lost, the flat top-down picture drawn by src/scene.js keeps the game fully playable.
let presenter = null;
try { if (!qs.has('flat')) { const { createPresenter } = await import('./view3d/presenter.js'); presenter = await createPresenter({ kitCanvas: canvas }); } } catch (e) { console.warn('3D presenter unavailable', String((e && e.stack) || e)); }

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in
// virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
try { setMeasureCtx(document.createElement('canvas').getContext('2d')); } catch { /* estimate */ }
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

const wrap = (game) => {
  if (qs.has('dev')) { window.__game = game; window.__MN = MN; }
  if (presenter && presenter.stage) { window.__presenter = presenter; return presenter.wrap(game); }
  return game;
};
const shot = qs.has('shot');
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
boot({ createGame: async (env) => wrap(await createGame({ ...env, config: { ...env.config, gl3d: () => !!(presenter && presenter.active && presenter.active()), dev: env.config.dev || qs.has('dev'), ...(shot ? { shot: true, shotSeed: qs.get('seed') } : {}) } })), meta, canvas, background: 'rgba(0,0,0,0)' });
