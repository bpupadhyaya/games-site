import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createEngine } from './audio/engine.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
const engine = createEngine();
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

// Browsers only start audio from a user gesture: unlock on the first pointer or key.
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => engine.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); });

const q = new URLSearchParams(location.search);
// ---- real 3D horo dancers (presentation layer, platform/view3d) -----------------------------------------------------------------
// src/art.js drawHoro asks globalThis.__bg3d to draw the chain and paints it itself whenever that is missing (no WebGL2, a failed load,
// a lost context, a slow device, while the models load); ?fig=2d forces the painted chain.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__bg3d = null;
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  globalThis.__bg3dReady = import('./view3d/horo.js')
    .then((m) => m.createHoro({ quality: weak ? 'low' : 'medium' }))
    .then((b) => { globalThis.__bg3d = b || null; })
    .catch((e) => { console.warn('3D dancers unavailable, using the painted ones', e); globalThis.__bg3d = null; });
}
// The vendored 3D layer's licence text, shown with the other About text (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) { ABOUT.push({ h: 'Credits: 3D people and tools' }); for (const q of paras.slice(2)) ABOUT.push({ p: q }); }
}).catch(() => {});
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'perform', piece: 2, advance: 14, play: true },
  3: { scene: 'play', mode: 'learn', piece: 1, advance: 9, play: true },
  4: { scene: 'play', mode: 'auto', piece: 3, advance: 8 },
  5: { scene: 'about' },
  6: { scene: 'result' },
  7: { scene: 'piece', piece: 4 },
  8: { scene: 'rules', page: 1 },
};
const create = async (env) => {
  game = await createGame({ ...env, rhythm: engine });
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__bar = game;
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), piece: Number(q.get('piece') ?? 0), mode: q.get('mode') ?? 'perform', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), hint: q.has('hint'), freeze: q.has('freeze'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#1a0a14' });
