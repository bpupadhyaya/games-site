import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { GL } from './src/glbridge.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');

// The 3D venue (web/view3d) draws behind the transparent kit canvas. It never blocks the game: without WebGL2, with ?nogl, or while the
// assets load the 2D art plays, and the 3D layer takes over the moment it is ready.
let presenter = null;
// Store-shot / scripted-scene runs wait for the 3D layer before the first frame. Normal play boots at once on the 2D art; the 3D presenter
// loads in the background and takes over (adopt) the moment it is ready.
const SYNC3D = /[?&](shot|scene|bare|pdb)\b/.test(location.search), NOGL = /[?&]nogl\b/.test(location.search);
let lateGame = null;
const lateWrap = (g) => { let inner = null; lateGame = Object.assign({}, g, { update(dt, i) { return (inner ?? g).update(dt, i); }, render(c, v) { (inner ?? g).render(c, v); }, adopt() { if (!inner && presenter && presenter.stage) inner = presenter.wrap(g); } }); return lateGame; };
const lateBg = (flat) => ({ toString: () => (presenter && presenter.stage && presenter.ready ? 'rgba(0,0,0,0)' : flat) });
const startLate3d = (opts) => {
  createPresenter(opts).then((p) => {
    if (!p || !p.stage) return;
    presenter = p; if (/[?&]dev\b/.test(location.search)) { window.__presenter = p; window.__p3d = p; }
    if (lateGame) lateGame.adopt();
  }).catch((e) => console.warn('3D presenter unavailable', e));
};
try {
  if (SYNC3D && !new URLSearchParams(location.search).has('nogl')) {
    presenter = await createPresenter({ kitCanvas: canvas });
    if (presenter && presenter.stage) await Promise.race([presenter.ready_p, new Promise((r) => setTimeout(r, new URLSearchParams(location.search).has('shot') ? 15000 : 1600))]);
  }
} catch (e) { console.warn('3D presenter unavailable', e); presenter = null; }

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
const create = async (env) => { if (new URLSearchParams(window.location.search).has('shot')) env.config.shot = true; const game = await createGame(env); theGame = game; { const st = new URLSearchParams(window.location.search).get('stage'); if (st !== null && env.config.dev) game.stage(Number(st)); } if (env.config.dev) window.__jukskei = game; return game; };
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: async (env) => { const g = await create(env); return presenter && presenter.stage ? presenter.wrap(g) : lateWrap(g); }, meta, canvas, background: 'rgba(0,0,0,0)' });
if (!SYNC3D && !NOGL && !presenter) startLate3d({ kitCanvas: canvas });
void GL;
if (presenter && presenter.stage && new URLSearchParams(location.search).has('dev')) window.__p3d = presenter;   // QA only
