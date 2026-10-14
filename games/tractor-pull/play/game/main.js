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
  if (env.config.dev) window.__tp = game;
  const q = new URLSearchParams(window.location.search);
  // Store screenshots (tools/arc shots renders store/shots.json as ?shot=1&seed=N): the seed picks the moment to show.
  const SHOT_SCENES = { 9301: 'title', 9302: 'aim', 9303: 'pull', 9304: 'banner', 9305: 'collection', 9306: 'watch', 9307: 'result', 9308: 'rules', 9309: 'howto' };
  if (q.has('shot') && q.has('text')) game.getState().settings.textIdx = Math.max(0, Math.min(4, Number(q.get('text')) | 0));
  if (q.has('shot')) { const sc = q.get('scene') || SHOT_SCENES[env.config.seed]; if (sc) game.shotScene(sc); }
  return game;
};

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// ---- the 3D pulling ground (presentation layer, platform/view3d): drawWorldState() uses globalThis.__track3d when ready, else the 2D art.
// The page boots on the flat 2D art at once; the 3D scene is built in slices afterwards and crossfaded in. Without WebGL2, or after a
// failed build, the 2D art stays. ?fig=2d forces it; ?q3d=low|medium|high forces a tier.
{
  const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
  const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
  if (wantFig && hasWebGL2()) {
    const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    const tier = (mem <= 2 || cores <= 3) ? 'low' : (mem >= 8 && cores >= 8 && Math.min(screen.width, screen.height) >= 700 ? 'high' : 'medium');
    const forced = (globalThis.location.search.match(/[?&]q3d=(low|medium|high)/) || [])[1];
    const build = (q) => import('./view3d/track3d.js').then((m) => m.createTrack3d({ quality: q }));
    // start after the first frames so the title paints and answers taps immediately
    const start = () => setTimeout(() => {
      build(forced || tier)
        .catch((e) => { console.warn('3D track failed at', tier, e); return tier === 'low' ? null : build('low'); })
        .then(async (a) => { if (a) { await a.compile(); a.readyAt = performance.now(); } globalThis.__track3d = a || null; })
        .catch((e) => { console.warn('3D track unavailable, using the 2D art', e); globalThis.__track3d = null; });
    }, 250);
    let n = 0; const waitFrames = () => { if (++n >= 4) start(); else requestAnimationFrame(waitFrames); };
    requestAnimationFrame(waitFrames);
  }
}
// The vendored 3D layer's licence text, shown with the About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D tools and people', p: paras.slice(2) });
}).catch(() => {});

boot({ createGame: create, meta, canvas, background: '#000' });
