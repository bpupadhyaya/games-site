import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
let game = null;

// Host safe areas (notch, home indicator) and the floating back button, converted to virtual units (short side = 720).
const unit = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const px = unit(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); });

// Two-player play on one screen: the kit's pointer follows one finger, so every touch is also forwarded here with its id.
const forward = (type) => (e) => { if (game?.multi) game.multi(type, e.pointerId, e.clientX * unit(), e.clientY * unit()); };
canvas.addEventListener('pointerdown', forward('down'));
canvas.addEventListener('pointerup', forward('up'));
canvas.addEventListener('pointercancel', forward('up'));

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'solo', level: 0, advance: 13, play: true },
  3: { scene: 'play', mode: 'solo', level: 3, advance: 22, play: true },
  4: { scene: 'levels' },
  5: { scene: 'about' },
  6: { scene: 'result', level: 1 },
  7: { scene: 'detail', level: 2 },
  8: { scene: 'rules', page: 0 },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__nlt = game;
    { const u0 = game.update.bind(game); game.update = (dt, inp) => u0(dt * (window.__slowK ?? 1), inp); }   // tester: slow motion for motion strips (dev only)
    if (q.has('scene')) {
      game.dev.jump({ scene: q.get('scene'), level: Number(q.get('level') ?? 0), mode: q.get('mode') ?? 'solo', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
    }
  }
  return game;
};

// Real 3D girls (presentation layer, platform/view3d). The sim and the 2D picture own everything; src/playview.js asks globalThis.__girls3d to draw
// the pair and falls back to the 2D figures when it is missing (no WebGL2, a failed load, a lost context) or with ?fig=2d. While the module
// loads nothing is drawn for the pair, so the first frame is not delayed by the 3D assets.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__girls3d = { pending: true, draw: () => true };
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  Promise.all([import('./view3d/girls.js'), import('./src/figure.js')])
    .then(([m, fg]) => m.createGirls({ quality: weak ? 'low' : 'medium', outfits: fg.OUTFITS.slice(0, 2) }))
    .then((g) => { globalThis.__girls3d = g || null; })
    .catch((e) => { console.warn('3D girls unavailable, using the 2D picture', e); globalThis.__girls3d = null; });
}

// The vendored 3D layer's licence text, shown in About (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) { ABOUT.blocks.push({ h: 'Credits: 3D people and tools' }); paras.slice(2).forEach((p) => ABOUT.blocks.push({ p })); }
}).catch(() => {});

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#16203a' });
