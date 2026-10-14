import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
// Two-thumb striding: the newest finger wins (see src/pointerGuard.js). Registered on window in the capture phase, so it runs before the kit's listeners.
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
  if (env.config.dev) window.__beachflags = game;
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9501: 'title', 9502: 'start', 9503: 'run', 9504: 'dive', 9505: 'grab', 9506: 'watch' };
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// ---- real 3D athletes (presentation layer, platform/view3d) -------------------------------------------------------------------------
// src/art.js paints every person with globalThis.__racers3d once it is ready and keeps its own 2D figures otherwise (no WebGL2, a failed
// load, a lost context, or ?fig=2d). The 3D layer only reads runner fields of the sim; it never writes back.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  import('./view3d/racers.js')
    .then((m) => m.createRacers({ quality: weak ? 'low' : 'medium', runners: 8, crowd: weak ? 6 : 10 }))
    .then((w) => { if (w) globalThis.__racers3d = w; })
    .catch((e) => { console.warn('3D athletes unavailable, using the 2D figures', e); globalThis.__racers3d = null; });
}
// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
}).catch(() => {});

boot({ createGame: create, meta, canvas, background: '#000' });
