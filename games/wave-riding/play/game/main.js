import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

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
  if (env.config.dev) window.__wr = game;
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9201: 'title', 9202: 'line', 9203: 'ride', 9204: 'tube', 9205: 'air', 9206: 'watch', 9207: 'result', 9208: 'rules', 9209: 'howto', 9210: 'collection', 9211: 'burst', 9212: 'paddle', 9213: 'banner', 9214: 'pause', 9215: 'settings' };
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  return game;
};

// ---- real 3D surfer (presentation layer, platform/view3d) --------------------------------------------------------------------------
// src/art.js drawRider() asks globalThis.__rider3d to draw the surfer and falls back to its 2D figure when it is missing (no WebGL2, a failed
// load, a lost context) or when the page is opened with ?fig=2d. While the module loads nothing is drawn for the rider.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__rider3d = { pending: true, draw: () => true };
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  import('./view3d/rider.js')
    .then((m) => m.createRider({ quality: weak ? 'low' : 'medium' }))
    .then((r) => { globalThis.__rider3d = r || null; })
    .catch((e) => { console.warn('3D surfer unavailable, using the 2D picture', e); globalThis.__rider3d = null; });
}

// The 3D sea (view3d/sea.js): sky, wave face, lip, whitewater and spray as a lit WebGL scene behind the rider. src/view.js falls back to the 2D art
// while it loads, when WebGL2 is missing, after a lost context, or with ?sea=2d.
const wantSea = !/[?&]sea=2d/.test(globalThis.location.search);
if (wantSea && hasWebGL2()) {
  globalThis.__sea3d = { pending: true };
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  import('./view3d/sea.js')
    .then((m) => { globalThis.__sea3d = m.createSea({ quality: weak ? 'low' : 'medium' }) || null; })
    .catch((e) => { console.warn('3D sea unavailable, using the 2D picture', e); globalThis.__sea3d = null; });
}

// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
}).catch(() => {});

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#000' });
