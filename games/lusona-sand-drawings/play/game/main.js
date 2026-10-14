import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { theme } from './src/ui.js';
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
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Developer/test hook (?dev=1 or the Developer toggle): expose the game for the layout and screenshot scripts.
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N): the seed picks a real screen via the dev hooks.
const SHOT_SCENES = {
  9302: (d) => d.doc('about', 0),
  9303: (d) => d.start(7),
  9304: (d) => { d.start(7); d.hint(); },
  9305: (d) => { d.start(5); d.auto(); },
  9306: (d) => { d.unlock(14); d.go('levels'); },
  9307: (d) => d.doc('rules', 1),
  9308: (d) => { d.start(3); d.solveNow(); d.skipOver(); },
};
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__sdk = game;
  if (new URLSearchParams(window.location.search).has('shot')) { const f = SHOT_SCENES[env.config.seed]; if (f) { f(game.dev); game.getState().sceneT = 1; } }
  return game;
};

loadCredits();
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const q = new URLSearchParams(window.location.search);
const lazy = createLazy3d({
  canvas, flatBg: '#140b06', eager: q.has('shot') || q.has('scene'), readyTimeout: 20000,
  load: async () => (q.has('flat') ? null : createPresenter({ kitCanvas: canvas, getLook: theme })),
});
await lazy.prepare();
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => lazy.presenter }); window.__v3 = v3; }
boot({ createGame: async (env) => lazy.wrap(await create(env)), meta, canvas, background: lazy.background });
lazy.start();
