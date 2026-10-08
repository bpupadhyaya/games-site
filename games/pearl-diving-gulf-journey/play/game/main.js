import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The kit has one pointer: a stray second finger must not move it. Only the primary pointer reaches the kit.
const canvas = document.getElementById('game');
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) canvas.addEventListener(type, (e) => { if (e.isPrimary === false) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

// The 3D sea (web/view3d) draws behind the kit canvas; if it cannot load or WebGL is missing the game keeps its flat 2D view.
let presenter = { stage: null, wrap: (g) => g, busy: () => false };
try {
  const { createPresenter } = await import('./view3d/presenter.js');
  presenter = await createPresenter({ kitCanvas: canvas });
} catch (e) { console.warn('3D view unavailable, using the flat view', e); }

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
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

let theGame = null;
const booted = boot({
  createGame: async (env) => {
    const game = await createGame(env); theGame = game; game.setHas3d?.(!!presenter.stage);
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => game.setCredits?.(t)).catch(() => {});
    return presenter.wrap(game);
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
});
booted.then((b) => { if (/[?&]dbg/.test(location.search)) window.__k = { ...b, presenter, game: theGame }; });
canvas.addEventListener('wheel', (e) => { if (theGame && theGame.scrollBy) { theGame.scrollBy(e.deltaY * (e.deltaMode === 1 ? 24 : 1) * 1.2 * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)))); e.preventDefault(); } }, { passive: false });
