import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setCanvasFactory } from './src/ui.js';
setCanvasFactory(() => document.createElement('canvas'));
import { setLogo, setLockup } from './src/brand.js';
import { SHOT_SCENES, driveShot } from './shots.js';
import { createPresenter } from './view3d/presenter.js';
import { createLazy3d } from './lazy3d.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');

// The 3D scene is drawn in a WebGL canvas behind the kit canvas (transparent, it keeps the HUD, the menus and all input).
// If WebGL or the library is unavailable the game keeps playing with its flat 2D lane and board.
const qs0 = new URLSearchParams(location.search);
const lazy = createLazy3d({
  canvas, flatBg: '#0c1b2b', eager: qs0.has('shot'), readyTimeout: 20000,
  load: async () => createPresenter({ kitCanvas: canvas }),
});
await lazy.prepare();
// The 3D layer's credits and licences go on the About page (public text shipped with the layer).
fetch('./vendor3d/LICENSES.md').then((r) => r.text()).then((t) => {
  const paras = t.split(/\n\s*\n/).map((x) => x.replace(/\n/g, ' ').trim()).filter((x) => x && !x.startsWith('#') && !/^Games that ship/.test(x));
  if (paras.length) ABOUT.push({ title: '3D credits and licences', p: paras });
}).catch(() => {});
const dev0 = new URLSearchParams(location.search).has('dev');
if (dev0) Object.defineProperty(window, '__presenter', { get: () => lazy.presenter });

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
const create = async (env) => {
  const game0 = await createGame(env); theGame = game0; if (env.config.dev) window.__horseshoe = game0;
  const game = lazy.wrap(game0);
  // Store screenshots (?shot=1&seed=<n>): a scripted real-input run to a named moment, once, on the first update (the canvas has its
  // size by then). Without a known seed the kit's own seeded run applies.
  const q = new URLSearchParams(location.search), spec = q.has('shot') ? SHOT_SCENES[Number(q.get('seed'))] : null;
  if (!spec) return game;
  let done = false;
  return { ...game, update(dt, input) { if (!done) { done = true; driveShot(spec.scene, game, env.input, spec); } game.update(dt, input); } };
};
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: lazy.background });
lazy.start();
