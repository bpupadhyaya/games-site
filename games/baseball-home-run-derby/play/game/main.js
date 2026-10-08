import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The 3D layer loads in the background behind the menus; until it is ready (or if WebGL2 / the 3D assets are missing) the 2D ballpark is used.
const canvas = document.getElementById('game');
let presenter = { info: {}, wrap: (g) => g, ready: Promise.resolve() };
try {
  const mod = await import('./view3d/presenter.js');
  presenter = mod.createPresenter({ kitCanvas: canvas });
  presenter.ready.then(() => fetch('./vendor3d/LICENSES.md').then((r) => (r.status < 400 ? r.text() : '')).then((t) => {
    if (!t) return;
    presenter.info.credits = ['# 3D people and credits', ...t.split(/\n{2,}/).map((x) => x.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean)];
  }).catch(() => {}));
} catch (e) { console.warn('view3d unavailable; using the 2D ballpark', e); }
const dev = new URLSearchParams(location.search).has('dev3d');
if (dev) globalThis.__view3d = presenter;

const syncHost = () => {
  const short = Math.max(1, Math.min(window.innerWidth, window.innerHeight)), px = 720 / short, s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

const booted = boot({
  createGame: async (env) => { env.view3d = presenter.info; return presenter.wrap(await createGame(env)); },
  meta, canvas, background: 'rgba(0,0,0,0)',
});
if (dev) booted.then((r) => { globalThis.__game = r.game; globalThis.__loop = r.loop; });
