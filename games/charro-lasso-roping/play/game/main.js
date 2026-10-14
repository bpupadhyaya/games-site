import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

// Host safe areas (notch, home indicator) and the floating back button (hub builds only): the shell publishes window.__safeInsets in
// CSS px. The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
// In standalone builds there is no host back button (host.back stays 0): the game's own Menu / Leave buttons are the way out.
const short = () => Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const px = 720 / short(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
const cv = document.getElementById('game');
if (cv) cv.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / short()) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
const loadImg = (src, done) => { const im = new Image(); im.onload = () => done(im); im.src = src; };
loadImg('./brand/arcforge-af.png', setLogo);
loadImg('./brand/arcforge-lockup.png', setLockup);

// Store screenshots (`?shot=1&seed=<showcase seed>`) show real positions played by the real game code. Seeds 9001.. pick a position;
// the scene then ignores the random shot-mode "monkey" input so it stays put. Every other URL and every real player is unaffected.
const params = new URLSearchParams(globalThis.location.search);
const SHOWCASE_SEEDS = { 9001: 'trick', 9002: 'flower', 9003: 'ready', 9004: 'swing', 9005: 'flight', 9006: 'catch', 9007: 'autoplay', 9008: 'rules3', 9009: 'rules', 9010: 'settings', 9011: 'over', 9012: 'setup', 9013: 'result', 9014: 'how', 9015: 'about', 9016: 'title' };
const showcase = params.has('shot') ? SHOWCASE_SEEDS[Number(params.get('seed'))] : undefined;
const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

// ---- the 3D lienzo (presentation layer, platform/view3d): src/view.js drawArena() uses globalThis.__arena3d when ready, else its 2D art.
// Quality tiers: the arena is built at the device's tier; if that fails it is retried at 'low' and finally the 2D picture stays.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__arena3d = { pending: true };
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  const tier = (mem <= 2 || cores <= 3) ? 'low' : (mem >= 8 && cores >= 8 && Math.min(screen.width, screen.height) >= 700 ? 'high' : 'medium');
  const forced = (location.search.match(/[?&]q3d=(low|medium|high)/) || [])[1];
  const build = (q) => import('./view3d/arena.js').then((m) => m.createArena({ quality: q }));
  build(forced || tier)
    .catch((e) => { console.warn('3D arena failed at', tier, e); return tier === 'low' ? null : build('low'); })
    .then((a) => { globalThis.__arena3d = a || null; })
    .catch((e) => { console.warn('3D arena unavailable, using the 2D picture', e); globalThis.__arena3d = null; });
}

// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
}).catch(() => {});

const create = showcase
  ? async (env) => { env.config.showcase = showcase; const game = await createGame(env); return { ...game, update: (dt) => game.update(dt, idle), isPreviewExempt: () => true }; }
  : createGame;
const devCreate = async (env) => { const game = await create(env); if (env.config.dev) window.__game = game; return game; };

boot({ createGame: devCreate, meta, canvas: document.getElementById('game'), background: '#1c1b3a' });
