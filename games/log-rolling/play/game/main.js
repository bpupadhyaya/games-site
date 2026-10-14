import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');
// The 3D pond (web/view3d) draws behind the transparent kit canvas. The flat 2D art and the title are interactive at once; the 3D layer
// loads in slices in the background and takes over with a short crossfade the moment it is ready (see view3d/presenter.js).
let presenter = null, gameRef = null;
const attach = () => { if (presenter && presenter.stage && gameRef && !gameRef.__wrapped3d) { gameRef.__wrapped3d = true; presenter.wrap(gameRef); } };
if (!new URLSearchParams(location.search).has('nogl')) {
  const start = () => createPresenter({ kitCanvas: canvas }).then((p) => { presenter = p; if (window.__dev3d) window.__presenter = p; attach(); }).catch((e) => console.warn('3D presenter unavailable', e));
  // let the first frame of the 2D title paint before the 3D layer starts importing
  requestAnimationFrame(() => setTimeout(start, 0));
}
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
  gameRef = game;
  if (env.config.dev) { window.__at = game; window.__dev3d = true; window.__presenter = presenter; }
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9401: 'title', 9402: 'play', 9403: 'kick', 9404: 'fall', 9405: 'river', 9406: 'watch', 9407: 'result', 9408: 'rules', 9409: 'howto', 9410: 'think', 9411: 'lake', 9412: 'rapids' };
  if (q.has('shot') && q.has('zoom')) game.getState().settings.textIdx = Math.max(0, Math.min(4, Number(q.get('zoom')) | 0));
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) { if (q.has('fa')) globalThis.__shotFallAt = Number(q.get('fa')); game.shotScene(sc); if (q.has('freeze')) game.getState().paused = true; } }
  attach();
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
