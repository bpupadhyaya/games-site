import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

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
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
// Mouse wheel scrolls the reader, the menus and the button panel (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// The 3D court (web/view3d) draws behind the kit canvas. It loads in the background so the first frame (the title) never waits for WebGL;
// if it cannot load or WebGL is missing the game keeps its 2D court.
let presenter = null;
import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => { presenter = p && p.stage ? p : null; }).catch((e) => console.warn('3D court unavailable, using the 2D court', e));

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the screens read without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

const booted = boot({
  createGame: async (env) => {
    const game = await createGame(env);
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => game.setCredits?.(t)).catch(() => {});
    const draw = game.render.bind(game);
    game.render = (ctx, view) => { draw(ctx, view); if (presenter) { try { presenter.frame(game, ctx); } catch (e) { console.warn('3D frame failed', e); } } };
    return game;
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
});

booted.then((b) => { if (/[?&]dbg/.test(location.search)) window.__k = { ...b, get presenter() { return presenter || { ready: () => false, stage: null }; } }; });
