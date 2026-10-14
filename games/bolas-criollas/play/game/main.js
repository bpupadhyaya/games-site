import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { runScene, SCENES } from './src/shotscenes.js';
import { createPresenter } from './view3d/presenter.js';
import { createLazy3d } from './lazy3d.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
const qp0 = new URLSearchParams(window.location.search);

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
  const game = await createGame(env); theGame = game; if (env.config.dev) window.__bolas = game;
  // Store screenshots: `?shot=1&scene=<name>` replays a scripted player (src/shotscenes.js) so every picture is real, repeatable gameplay.
  // `tools/arc shots` only passes seed and ticks, so seeds 9001..9007 (ticks=0) select the scenes in SCENES order.
  const qp = new URLSearchParams(window.location.search), sd = Number(qp.get('seed'));
  const scene = qp.get('scene') || (sd >= 9001 && sd < 9001 + SCENES.length ? SCENES[sd - 9001] : null);
  if (scene && qp.has('shot')) { await Promise.resolve(); runScene(scene, game, env, meta); }
  return game;
};
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const lazy = createLazy3d({
  canvas, flatBg: '#150e36', eager: qp0.has('shot') || qp0.has('scene'), readyTimeout: 20000,
  load: async () => (qp0.has('flat') ? null : createPresenter({ kitCanvas: canvas })),
});
await lazy.prepare();
if (qp0.has('dev')) Object.defineProperty(window, '__p3', { get: () => lazy.presenter });
boot({ createGame: async (env) => lazy.wrap(await create(env)), meta, canvas, background: lazy.background });
lazy.start();

// About shows the 3D licence credits (three.js MIT, shared people and scenery licences) from the vendored LICENSES.md.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => {
  if (!t) return;
  const paras = t.split(/\n{2,}/).map((x) => x.replace(/[#*`>|-]+/g, ' ').replace(/\s+/g, ' ').trim()).filter((x) => x.length > 20);
  if (paras.length) ABOUT.push({ title: '3D credits', p: paras });
}).catch(() => {});
