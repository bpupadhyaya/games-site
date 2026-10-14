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

// The 3D hall loads in the background: the 2D floor is on screen at once and the 3D one takes over when the people are ready.
let presenter = null, gameRef = null;
let waiting = !qs.has('no3d');
const doneWaiting = () => { waiting = false; gameRef?.setWait3d?.(false); };
setTimeout(doneWaiting, 6000);   // never keep the veil up for long: after that the 2D floor shows until the 3D one is ready
const attach = () => { if (presenter && presenter.ok && gameRef && !gameRef.__v3) { gameRef.__v3 = true; presenter.wrap(gameRef); } };
(qs.has('no3d') ? Promise.resolve(null) : createPresenter({ kitCanvas: canvas, quality: qs.get('q3d') || 'medium' })).then((p) => { presenter = p; attach(); doneWaiting(); }).catch((e) => { doneWaiting(); console.warn('3D hall unavailable', e); });
const wrap = (game) => { if (qs.has('dev')) { window.__game = game; window.__MN = MN; } gameRef = game; game.setWait3d?.(waiting); attach(); return game; };
const shot = qs.has('shot');
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
boot({ createGame: async (env) => wrap(await createGame({ ...env, config: { ...env.config, dev: env.config.dev || qs.has('dev'), ...(shot ? { shot: true, shotSeed: qs.get('seed') } : {}) } })), meta, canvas, background: 'rgba(0,0,0,0)' });
