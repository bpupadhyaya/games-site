import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { attachTouches } from './src/touches.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px (browsers: none).
// The layout works in virtual units (short side = 720), so convert with the current scale.
const canvas = document.getElementById('game');
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
attachTouches(canvas);
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
// The Arcforge badge and the themed lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const params = new URLSearchParams(location.search);
const shot = params.has('shot');

// 3D table (web/view3d): the game boots at once on its flat 2D art, then the WebGL scene is built once the title has painted and
// takes over behind the transparent kit canvas. ?flat keeps 2D; no WebGL or a lost context falls back to 2D by itself (src/v3.js).
// Store shots (?shot / ?scene) wait for the 3D scene before booting.
const background = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#1a0c05') };
let gameObj = null, presenter = null;
const adopt = () => { if (presenter && gameObj) presenter.attach(gameObj); };
async function load3d() {
  if (params.has('flat')) return;
  try { const { createPresenter } = await import('./view3d/presenter.js'); presenter = await createPresenter({ kitCanvas: canvas }); adopt(); if (params.has('dev')) window.__p3d = presenter; }
  catch (e) { console.warn('3D table unavailable; staying 2D', e); }
}
const eager = shot || params.has('scene');
if (eager) await load3d();
boot({
  createGame: async (env) => {
    const game = await createGame({ ...env, config: shot ? { ...env.config, shot: true, shotScene: params.get('scene') || '' } : env.config });
    if (params.has('dev')) window.__game = game;
    gameObj = game; adopt();
    return game;
  },
  meta, canvas, background,
});
if (!eager) { let n = 3; const tick = () => (n-- > 0 ? requestAnimationFrame(tick) : setTimeout(load3d, 250)); requestAnimationFrame(tick); }
