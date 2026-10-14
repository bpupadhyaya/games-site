import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');
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

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// The 3D layer: a WebGL canvas behind the kit canvas. Until the dancers are loaded (or when WebGL is missing) the game draws
// its flat 2D scene, so it is always playable.
const presenter = await createPresenter({ kitCanvas: canvas });
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__chin = game;
  if (presenter.stage) { presenter.ready_p.then(() => game.set3d(!presenter.lost)).catch(() => {}); presenter.onLoss = (lost) => game.set3d(!lost); window.__chin3d = presenter; }
  fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => game.setLicenses(t)).catch(() => {});
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9301: 'title', 9302: 'dance', 9303: 'combo', 9304: 'watch', 9305: 'journal', 9306: 'round' };
  if (q.has('shot')) {
    const sc = q.get('scene') || SHOT_SCENES[env.config.seed];
    if (sc) {
      if (presenter.stage) await presenter.ready_p.catch(() => {});
      game.set3d(!!presenter.stage);
      game.shotScene(sc);
    }
  }
  return presenter.stage ? presenter.wrap(game) : game;
};

boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
