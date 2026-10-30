import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

const canvas = document.getElementById('game');
const q = new URLSearchParams(location.search);

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel / trackpad scrolls the Rules, About and Controls body (CSS px -> virtual units). One listener (it used to be registered twice).
canvas.addEventListener('wheel', (e) => {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (canvas.clientHeight || 800) : 1;
  wheelInput.dy += (e.deltaY * unit) * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)));
  e.preventDefault();
}, { passive: false });

// The Arcforge badge and themed lockup (src/brand.js): optional, the credit still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// Fast first screen: the game boots at once on its flat 2D art (styled, interactive title in the first frames). The 3D presenter
// (three.js) is imported and built only after the title has painted, in small slices, and then fades in behind the transparent
// 2D canvas. No WebGL, a failed import or a lost context: the flat 2D art simply stays (v3.on = false).
// ?flat=1 forces the 2D art; ?icon=1 renders the store icon from the 3D scene (developer tool, see STATUS.md).
let presenter = null, raw = null;
const background = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#182449') };   // the kit reads this every frame
const create = async (env) => {
  const game = await createGame(env);
  raw = game;
  if (env.config.dev) { window.__cg = game; window.__v3 = v3; }
  // The presenter only READS the state after each 2D frame; it never writes to the game.
  return { ...game, render: (ctx, view) => { game.render(ctx, view); if (presenter) presenter.frame(game.getState(), view); } };
};
boot({ createGame: create, meta, canvas, background });

const frames = (n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); requestAnimationFrame(step); });
if (!q.has('flat')) {
  (async () => {
    await frames(4);
    try {
      const { createPresenter } = await import('./view3d/presenter.js');
      for (let i = 0; i < 400 && !raw; i++) await new Promise((r) => setTimeout(r, 25));
      const p = await createPresenter({ kitCanvas: canvas, icon: q.has('icon'), getState: () => raw && raw.getState() });
      if (p && q.has('icon')) { p.renderStoreIcon(); return; }
      if (p) presenter = p;
    } catch (e) { console.warn('3D presenter unavailable; staying on the 2D art', e); }
  })();
}
