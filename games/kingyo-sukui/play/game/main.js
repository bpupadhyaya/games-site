import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { createPresenter } from './view3d/presenter.js';
import { createLazy3d } from './lazy3d.js';

const canvas = document.getElementById('game');
v3.makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// Ignore a second finger (see src/pointerGuard.js). Registered on window in the capture phase, so it runs before the kit's listeners.
const guard = createPointerGuard();
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
  window.addEventListener(type, (e) => { if (e.target === canvas && !guard(type, e.pointerId, e.isPrimary)) e.stopPropagation(); }, true);
}

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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout and resize check scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__ks = game;
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9301: 'title', 9302: 'play', 9303: 'lift', 9304: 'tear', 9305: 'collection', 9306: 'watch', 9307: 'result', 9308: 'rules', 9309: 'howto', 9310: 'think' };
  if (q.has('shot') && q.has('zoom')) game.getState().settings.textIdx = Math.max(0, Math.min(4, Number(q.get('zoom')) | 0));
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the transparent kit canvas). No WebGL, or a lost context: every screen falls back to the flat art.
const lazy = createLazy3d({
  canvas, flatBg: '#000', eager: new URLSearchParams(location.search).has('shot'), readyTimeout: 20000,
  load: async () => (new URLSearchParams(location.search).has('flat') ? null : createPresenter({ kitCanvas: canvas })),
});
await lazy.prepare();
if (new URLSearchParams(location.search).has('dev')) Object.defineProperty(window, '__p3', { get: () => lazy.presenter });
boot({ createGame: async (env) => lazy.wrap(await create(env)), meta, canvas, background: lazy.background });
lazy.start();
