import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
let game = null;

// Host safe areas (notch, home indicator) and the floating back button, converted to virtual units (short side = 720).
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); });

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'perform', advance: 4.6, play: true },
  3: { scene: 'play', mode: 'perform', act: 3, advance: 7.4, play: true },
  4: { scene: 'play', mode: 'auto', advance: 3 },
  5: { scene: 'about' },
  6: { scene: 'result' },
  7: { scene: 'setup' },
  8: { scene: 'rules', page: 1 },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__ft = game;
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), mode: q.get('mode') ?? 'perform', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), think: q.has('think'), drag: q.has('drag') ? Number(q.get('drag')) : undefined, dx: Number(q.get('dx') ?? 0), act: q.has('act') ? Number(q.get('act')) : undefined, setup: q.has('fig') ? { fig: q.get('fig'), ens: Number(q.get('ens') ?? 1), speedIdx: Number(q.get('speed') ?? 1) } : undefined, pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  return game;
};

const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// ---- the 3D show (presentation layer, platform/view3d) -----------------------------------------------------------------------------
// The sim and the 2D scene own everything; src/playview.js and src/view.js hand globalThis.__show3d a frame of positions and it draws the piazza,
// crowd, musicians, bearers and silk flags into one WebGL canvas that is composited under the 2D HUD. When it is missing (no WebGL2, a failed
// load, a lost context) the 2D picture is drawn; ?fig=2d forces that. While the module loads, flags and bearers are simply not drawn (no flash).
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__show3d = { pending: true };
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  const want = q.get('q');
  import('./view3d/show.js')
    .then((m) => m.createShow({ quality: want === 'low' || want === 'medium' || want === 'high' ? want : weak ? 'low' : 'medium' }))
    .then((b) => { globalThis.__show3d = b || null; })
    .catch((e) => { console.warn('3D show unavailable, using the 2D picture', e); globalThis.__show3d = null; });
}
// The vendored 3D layer's licence text, shown with the other About text (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) { ABOUT.push({ h: 'Credits: 3D people and tools' }); for (const q of paras.slice(2)) ABOUT.push({ p: q }); }
}).catch(() => {});

boot({ createGame: create, meta, canvas, background: '#16284f' });
