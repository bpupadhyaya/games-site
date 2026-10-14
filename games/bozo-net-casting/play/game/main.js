import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { setFisherRenderer, setScene3d } from './src/art.js';
import { createFisherRenderer } from './view3d/presenter.js';
import { createScene3d } from './view3d/scene.js';

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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout and resize check scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__bnc = game;
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9201: 'title', 9202: 'aim', 9203: 'swing', 9204: 'cast', 9205: 'banner', 9206: 'collection', 9207: 'watch', 9208: 'result', 9209: 'rules', 9210: 'howto' };
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// the 3D fisher loads in the background; until it is ready (or if it cannot run) the art layer draws its 2D figure
const q3 = new URLSearchParams(window.location.search);
const pickQ = () => { const m = q3.get('q3d'); if (m) return m; const n = navigator; const weak = (n.hardwareConcurrency && n.hardwareConcurrency <= 4) || (n.deviceMemory && n.deviceMemory <= 3); return weak ? 'low' : 'medium'; };
// the whole river is a 3D scene behind this transparent canvas; the old small 3D fisher is only used if the scene cannot start
createScene3d({ kitCanvas: canvas, quality: pickQ() }).then((s) => {
  if (s) { setScene3d(s); if (q3.has('dev')) window.__scene3d = s; return null; }
  return createFisherRenderer({ quality: q3.get('q3d') || 'medium' });
}).then((r) => { if (r) { setFisherRenderer(r); if (q3.has('dev')) window.__fisher3d = r; } }).catch((e) => { console.warn('3D river unavailable', e); });

boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
