import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

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

// Dev / check scripts only (?dev=1 or the app's Developer toggle): expose the game object; the mouse wheel scrolls the menu lists.
let theGame = null;
// Store screenshots (?shot=1&ticks=N): N picks a scripted real scene, see game.shotScene. 0 = title, 1-5 = aim on course N-1,
// 11-15 = a disc rolling on course N-11, 21-25 = a finished practice match on course N-21, 31-35 = four discs already resting on course N-31.
const shotTicks = (() => { try { const q = new URLSearchParams(window.location.search); return q.has('shot') ? Number(q.get('ticks') ?? 0) : -1; } catch { return -1; } })();
// The 3D village (web/view3d) draws on a WebGL canvas BEHIND the transparent kit canvas. Without WebGL2, with ?nogl, on a lost context
// or while the assets are slow (more than 1.6 s) the illustrated 2D scope plays and the 3D layer takes over when it is ready.
let presenter = null;
try {
  const q0 = new URLSearchParams(location.search);
  if (!q0.has('nogl')) {
    presenter = await createPresenter({ kitCanvas: canvas });
    if (presenter && presenter.scene) await Promise.race([presenter.ready_p, new Promise((r) => setTimeout(r, q0.has('shot') ? 12000 : 1600))]);
  }
} catch (e) { console.warn('3D presenter unavailable', e); presenter = null; }
const has3d = !!(presenter && presenter.scene);
const create = async (env) => { const game = await createGame(env); theGame = game;
  if (shotTicks >= 1) { const kind = shotTicks >= 31 ? 'mid' : shotTicks >= 21 ? 'result' : shotTicks >= 11 ? 'roll' : 'aim'; game.shotScene(kind, shotTicks % 10 - 1); } if (env.config.dev) { window.__ulu = game; window.__presenter = presenter; const q1 = new URLSearchParams(location.search); if (q1.has('scene')) game.devJump(q1.get('scene'), { mode: q1.get('mode') || undefined, track: q1.get('track') || undefined, text: q1.has('text') ? Number(q1.get('text')) : undefined }); } return has3d ? presenter.wrap(game) : game; };
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: has3d ? 'rgba(0,0,0,0)' : '#0b2433' });
