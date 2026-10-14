import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
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
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Developer/test hook (?dev=1 or the Developer toggle): expose the game for the layout and screenshot scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__sdk = game;
  // Store screenshots: ?shot=1&scene=title|play|hint|auto|levels|about|howto|rules|settings|over|daily (&n=box number)
  const q = new URLSearchParams(location.search);
  // tools/arc shots renders store/shots.json as ?shot=1&seed=N (no scene): the seed picks the scripted moment.
  const bySeed = { 9401: ['title', 1], 9402: ['about', 1], 9403: ['play', 3], 9404: ['hint', 3], 9405: ['auto', 3], 9406: ['levels', 1], 1: ['levels', 1], 9407: ['rules', 1], 9408: ['over', 3] }[env.config.seed];
  const sc = q.get('scene') || (q.get('shot') && bySeed ? bySeed[0] : null);
  if (sc && q.get('shot')) {
    const n = Math.max(0, (parseInt(q.get('n') || String(bySeed ? bySeed[1] : 5), 10) || 5) - 1), d = game.dev;
    if (sc !== 'title') d.unlock(30);
    if (sc === 'play') d.start(n); else if (sc === 'hint') { d.start(n); d.hint(); } else if (sc === 'auto') { d.auto(); d.autoShow(); } else if (sc === 'levels') d.go('levels');
    else if (sc === 'about' || sc === 'howto' || sc === 'rules') d.doc(sc, 0); else if (sc === 'settings') d.go('settings');
    else if (sc === 'over') { d.start(n); d.solveNow(); d.skipOver(); } else if (sc === 'daily') d.daily();
  }
  return game;
};

const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
let presenter = { wrap: (g) => g, ok: false };
const q0 = new URLSearchParams(location.search);
if (!q0.has('flat')) { try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); } }
if (q0.has('dev') || q0.has('shot')) { window.__p3 = presenter; window.__v3 = v3; }
boot({ createGame: async (env) => presenter.wrap(await create(env)), meta, canvas, background: presenter.ok ? 'rgba(0,0,0,0)' : '#120807' });
