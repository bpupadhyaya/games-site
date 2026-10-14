import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { addLicences } from './src/content.js';
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
// ?shot=1&scene=play|hint|auto|over|... puts a real scene on screen for store screenshots (no input needed).
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__sdk = game;
  const q = new URLSearchParams(window.location.search);
  if (q.has('shot') && q.has('scene')) {
    const sc = q.get('scene'), d = game.dev;
    if (q.get('season')) d.season(q.get('season'));
    if (q.get('zoom')) d.zoom(Number(q.get('zoom')));
    const lvl = Number(q.get('grade') ?? 2);
    if (sc === 'play') { d.start(lvl); d.progress(Number(q.get('n') ?? 6)); }
    else if (sc === 'hint') { d.start(lvl); d.progress(Number(q.get('n') ?? 5)); d.hint(); d.hintGo(); }
    else if (sc === 'over') { d.start(lvl); d.solveNow(); d.go('over'); }
    else if (sc === 'new') d.go('new');
    else if (sc === 'settings' || sc === 'stats') d.go(sc);
    else if (sc === 'about' || sc === 'rules' || sc === 'howto') d.doc(sc, Number(q.get('page') ?? 0));
    else if (sc === 'auto') d.auto();
  }
  return game;
};

fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => addLicences(t)).catch(() => {});
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const q0 = new URLSearchParams(window.location.search);
let presenter = { wrap: (g) => g, ok: false };
if (!q0.has('flat')) { try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); } }
if (q0.has('dev')) { window.__p3 = presenter; window.__v3 = v3; }
boot({ createGame: async (env) => presenter.wrap(await create(env)), meta, canvas, background: presenter.ok ? 'rgba(0,0,0,0)' : '#150f1c' });
