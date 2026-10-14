import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

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
window.addEventListener('safeinsets', syncHost);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Developer/test hook (?dev=1 or the Developer toggle): expose the game for the layout and screenshot scripts.
const qs = new URLSearchParams(window.location.search);
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__sdk = game;
  if (qs.has('shot')) game.dev.shot(Number(qs.get('seed') ?? 1));   // store screenshots: a fixed showcase scene per seed
  return game;
};

const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// 3D presenter (WebGL canvas behind the kit canvas). The flat 2D art boots first and is fully interactive at once; the 3D scene is
// built in slices a moment later and cross-faded in. With no WebGL, or if the context is lost, every screen keeps the flat art.
async function start3d() {
  if (qs.has('flat')) return;
  try {
    if (!qs.has('shot')) await new Promise((r) => setTimeout(r, 350));
    const { createPresenter } = await import('./view3d/presenter.js');
    const p = await createPresenter({ kitCanvas: canvas, instant: qs.has('shot') });
    if (qs.has('dev')) { window.__p3 = p; window.__v3 = v3; }
  } catch (e) { console.warn('3D presenter unavailable', e); }
}
if (qs.has('shot')) await start3d();
boot({ createGame: create, meta, canvas, background: '#1d0f08' });
if (!qs.has('shot')) start3d();
