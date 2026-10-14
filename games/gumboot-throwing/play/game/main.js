import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setMeasureCtx } from './src/menus.js';
import * as MN from './src/menus.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');
const qs = new URLSearchParams(location.search);

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

const wrap = (game) => { if (qs.has('dev')) { window.__game = game; window.__MN = MN; } return game; };
const shot = qs.has('shot');
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
// The 3D field (web/view3d) draws behind the transparent kit canvas. It never blocks the game: without WebGL2, with ?nogl, or while the assets
// load the 2D art plays, and the 3D layer takes over the moment it is ready (and again after a lost context is restored).
let presenter = null;
try {
  if (!qs.has('nogl')) {
    presenter = await createPresenter({ kitCanvas: canvas });
    if (presenter && presenter.stage) await Promise.race([presenter.ready_p, new Promise((r) => setTimeout(r, shot ? 20000 : 2500))]);
  }
} catch (e) { console.warn('3D presenter unavailable', e); presenter = null; }
const gl3 = !!(presenter && presenter.stage);
boot({
  createGame: async (env) => { const g = wrap(await createGame({ ...env, config: { ...env.config, dev: env.config.dev || qs.has('dev'), ...(shot ? { shot: true, shotSeed: qs.get('seed') } : {}) } })); return gl3 ? presenter.wrap(g) : g; },
  meta, canvas, background: gl3 ? 'rgba(0,0,0,0)' : '#0d2420',
});
if (gl3 && qs.has('dev')) window.__p3d = presenter;   // QA only
