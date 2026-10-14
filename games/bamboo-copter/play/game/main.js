import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { setFibre } from './src/ui.js';

const q0 = new URLSearchParams(window.location.search);
let presenter = { wrap: (g) => g, ok: false };
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
  if (q0.has('shot') && presenter.whenReady) await presenter.whenReady;   // store shots wait for the 3D layer
  const game = await createGame(env);
  if (env.config.dev) window.__bc = game;
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9301: 'title', 9302: 'aim', 9303: 'fly', 9304: 'banner', 9305: 'collection', 9306: 'watch', 9307: 'result', 9308: 'rules', 9309: 'howto' };
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc, q.has('sel') ? Number(q.get('sel')) : undefined); }
  return game;
};

// bamboo-fibre texture for panels and buttons (drawn once)
try {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); let sd = 7; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,230,0.5)' : 'rgba(0,20,0,0.5)'; g.globalAlpha = 0.06 + r() * 0.1; g.fillRect(r() * 96, 0, 0.6 + r() * 1.4, 96); }
  setFibre(c);
} catch { /* flat panels */ }

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a WebGL canvas behind the kit canvas). With no WebGL, a load failure or a lost context every screen uses the 2D art.
// Boot on the flat 2D art at once; the 3D layer is imported and built after the first frames, then swapped in (store shots and dev runs wait for it).
const wait3d = ['shot', 'scene', 'spec', 'dev'].some((k) => new URLSearchParams(location.search).has(k));
const load3d = async () => {
  if (new URLSearchParams(location.search).has('flat')) return;
  try { const { createPresenter } = await import('./view3d/presenter.js'); presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }
};
if (wait3d) await load3d();
if (q0.has('dev')) window.__p3 = presenter;
const flatBg = '#000';
const background = { toString: () => (presenter.ok ? 'rgba(0,0,0,0)' : flatBg) };   // read by the kit every frame, so it turns clear when the 3D layer arrives
boot({ createGame: async (env) => {
  const raw = await create(env);
  if (wait3d) return presenter.wrap(raw);
  let cur = raw;
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80)))).then(load3d).then(() => { if (presenter.ok) cur = presenter.wrap(raw); });
  return new Proxy(raw, { get: (_, k) => cur[k] });
}, meta, canvas, background });
