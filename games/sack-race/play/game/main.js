import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');
// The 3D village green (web/view3d) draws behind the transparent kit canvas. It never blocks the game: the flat 2D art boots immediately, the 3D
// presenter is built in slices in the background (await tick() between them, shaders compiled async) and takes over, with a crossfade, when ready.
let presenter = null;
const wantGl = !new URLSearchParams(location.search).has('nogl');
// crossfade: render the 3D scene once under the flat art, fade the flat art out, then let the presenter take over the kit canvas (HUD only).
const crossfade = (p, done) => {
  try {
    p.frame(gameRef, {});
    canvas.style.transition = 'opacity 0.3s ease'; canvas.style.opacity = '0';
    setTimeout(() => { done(); canvas.style.transition = 'none'; canvas.style.opacity = '1'; }, 330);
  } catch { done(); }
};
let gameRef = null;
const startPresenter = async () => {
  try {
    const p = await createPresenter({ kitCanvas: canvas });
    if (!p || !p.stage) return;
    const ok = await p.ready_p;
    if (!ok || !gameRef) return;
    crossfade(p, () => { presenter = p; p.wrap(gameRef); window.__presenter = presenter; });
  } catch (e) { console.warn('3D presenter unavailable', e); }
};
// Two-thumb hopping: the newest finger wins (see src/pointerGuard.js). Registered on window in the capture phase, so it runs before the kit's listeners.
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
  if (env.config.dev) window.__sackrace = game;
  gameRef = game;
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9401: 'title', 9402: 'race', 9403: 'ruts', 9404: 'fall', 9405: 'clock', 9406: 'watch' };
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  if (wantGl) setTimeout(startPresenter, 0);
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
