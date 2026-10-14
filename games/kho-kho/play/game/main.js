import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/pages.js';

const canvas = document.getElementById('game');

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
// Mouse wheel scrolls the reader pages (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const qs = new URLSearchParams(window.location.search);
const create = async (env) => { const game = await createGame(qs.has('shot') ? { ...env, config: { ...env.config, shot: true, shotSeed: qs.get('seed') } } : env); if (env.config.dev) window.__game = game; return game; };

// The Arcforge badge and lockup (see src/brand.js): optional, the title screen still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// ---- real 3D people and court (presentation layer, platform/view3d) --------------------------------------------------------------
// src/view.js asks globalThis.__court3d to draw the court scene and falls back to its 2D picture when it is missing (no WebGL2, a failed load, a
// lost context) or when the page is opened with ?fig=2d. While the module loads the 2D court is shown without figures.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__court3d = { pending: true };
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  Promise.all([import('./view3d/court3d.js'), import('./src/art.js')])
    .then(([m, art]) => m.createCourt3D({ quality: weak ? 'low' : 'medium', courtImage: art.courtImage(2) }))
    .then((c) => { globalThis.__court3d = c || null; })
    .catch((e) => { console.warn('3D court unavailable, using the 2D picture', e); globalThis.__court3d = null; });
}
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ name: 'Credits: 3D people and tools', items: paras.slice(2).map((t) => ({ t })) });
}).catch(() => {});

boot({ createGame: create, meta, canvas, background: '#080b22' });
