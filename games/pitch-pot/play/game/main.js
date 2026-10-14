import { createLazy3d } from './lazy3d.js';
import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { setVaseImg } from './src/art.js';

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

// The 3D pavilion (web/view3d) draws behind the kit canvas; if it cannot load or WebGL is missing the game keeps its flat 2D art.
const qsP = new URLSearchParams(location.search);
const lazy = createLazy3d({
  canvas, flatBg: 'rgba(0,0,0,0)', eager: qsP.has('shot') || qsP.has('scene'), readyTimeout: 20000,
  load: async () => { const { createPresenter } = await import('./view3d/presenter.js'); return createPresenter({ kitCanvas: canvas }); },
  onAdopt: (p, g) => { g.setHas3d?.(!!p.stage); },
});
await lazy.prepare();

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev || /[?&]dbg/.test(location.search)) { window.__gs = game; Object.defineProperty(window, '__pres', { get: () => lazy.presenter }); }
  game.setHas3d?.(false);
  fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => game.setCredits?.(t)).catch(() => {});
  return lazy.wrap(game);
};

// The Arcforge brand pictures (see src/brand.js): optional, the game looks right without them.
const load = (src, fn) => { const i = new Image(); i.onload = () => fn(i); i.src = src; };
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);
load('./brand/vase.png', setVaseImg);

boot({ createGame: create, meta, canvas, background: lazy.background });
lazy.start();
