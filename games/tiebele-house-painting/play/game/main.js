import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { loadCredits } from './src/content.js';
import { v3 } from './src/v3.js';
import { createPresenter } from './view3d/presenter.js';
import { createLazy3d } from './lazy3d.js';

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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__gs = game; return game; };

// The Arcforge brand pictures (see src/brand.js): optional, the game looks right without them.
const load = (src, fn) => { const i = new Image(); i.onload = () => fn(i); i.src = src; };
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

loadCredits();

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const q = new URLSearchParams(window.location.search);
const lazy = createLazy3d({
  canvas, flatBg: '#4d2614', eager: q.has('shot') || q.has('scene'), readyTimeout: 20000,
  load: async () => (q.has('flat') ? null : createPresenter({ kitCanvas: canvas })),
});
await lazy.prepare();
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => lazy.presenter }); window.__v3 = v3; }
boot({ createGame: async (env) => lazy.wrap(await create(env)), meta, canvas, background: lazy.background });
lazy.start();
