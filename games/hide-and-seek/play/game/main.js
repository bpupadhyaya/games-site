import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';
import { KIDS } from './src/art.js';

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
  if (env.config.dev) window.__hs = game;
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9401: 'title', 9402: 'play', 9403: 'found', 9404: 'hide', 9405: 'places', 9406: 'watch', 9407: 'result', 9408: 'rules', 9409: 'howto', 9410: 'think' };
  if (q.has('shot') && q.has('zoom')) game.getState().settings.textIdx = Math.max(0, Math.min(4, Number(q.get('zoom')) | 0));
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// The 3D world (presentation layer, platform/view3d): the places, the hiding spots and the children are one lit WebGL scene
// (view3d/world.js) that src/view.js composites under the HUD. The 2D pictures are the fallback when it is missing (no WebGL2, a failed
// load, a lost context) or with ?fig=2d. While the module loads, the 2D picture is shown so the first frame is never delayed.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  const q = (/[?&]q=(low|medium|high)/.exec(globalThis.location.search) || [])[1];
  import('./view3d/world.js')
    .then((m) => m.createWorld({ quality: q || (weak ? 'low' : 'medium'), looks: KIDS }))
    .then((w) => { globalThis.__world3d = w || null; })
    .catch((e) => { console.warn('3D world unavailable, using the 2D picture', e && e.stack ? e.stack : e); globalThis.__world3d = null; });
}

// The vendored 3D layer's licence text, shown in About (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const sec = ABOUT[ABOUT.length - 1];
  if (paras.length > 2 && sec && sec.title === 'Pictures and credits') paras.slice(2).forEach((p) => sec.p.push(p));
}).catch(() => {});

boot({ createGame: create, meta, canvas, background: '#000' });
