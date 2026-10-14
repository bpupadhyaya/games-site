import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';
import { drawIcon } from './src/icon.js';
import { draw3d, drawScene3d } from './src/playview.js';

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
  2: { scene: 'play', mode: 'perform', routine: 1, advance: 15, play: true },
  3: { scene: 'play', mode: 'perform', routine: 3, advance: 12.6, play: true },
  4: { scene: 'routines' },
  5: { scene: 'about' },
  6: { scene: 'result', routine: 1 },
  7: { scene: 'detail', routine: 2 },
  8: { scene: 'rules', page: 1 },
};
// ---- real 3D performer (presentation layer, platform/view3d) -------------------------------------------------------------------
// The sim and the 2D picture own everything; src/playview.js and src/view.js ask globalThis.__figure3d to draw the performer and fall back to
// the 2D rig when it is missing (no WebGL2, a failed load, a lost context) or when the page is opened with ?fig=2d. While the module loads
// nothing is drawn for the performer (no flash of the fallback), so the first frame is not delayed by the 3D assets.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__figure3d = { pending: true, draw: () => true };
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  import('./view3d/performer.js')
    .then((m) => m.createPerformer({ quality: weak ? 'low' : 'medium' }))
    .then((w) => { globalThis.__figure3d = w || null; })
    .catch((e) => { console.warn('3D performer unavailable, using the 2D picture', e); globalThis.__figure3d = null; });
}
// The vendored 3D layer's licence text, shown with the other About pages.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) { ABOUT.blocks.push({ h: 'Credits: 3D people and tools' }); for (const q of paras.slice(2)) ABOUT.blocks.push({ p: q }); }
}).catch(() => {});

const create = async (env) => {
  if (env.config.dev && q.has('pose')) globalThis.__forcePose = q.get('pose');
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__mkb = game;
    if (q.has('scene')) {
      game.dev.jump({ scene: q.get('scene'), routine: Number(q.get('routine') ?? 0), mode: q.get('mode') ?? 'perform', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), freeze: q.has('freeze'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
    }
  }
  if (env.config.dev && q.has('icon')) {     // dev: render the store icon scene instead of the game (see src/icon.js)
    game.render = (ctx, view) => { ctx.clearRect(0, 0, view.width, view.height); drawIcon(ctx, view.width, view.height, draw3d, drawScene3d); };
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#120c24' });
