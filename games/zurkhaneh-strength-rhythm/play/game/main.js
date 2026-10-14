import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createEngine } from './audio/engine.js';

const canvas = document.getElementById('game');
const q = new URLSearchParams(location.search);
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

// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'perform', piece: 4, advance: 24, play: true },
  3: { scene: 'play', mode: 'learn', piece: 1, advance: 12, play: true },
  4: { scene: 'play', mode: 'auto', piece: 3, advance: 8 },
  5: { scene: 'about' },
  6: { scene: 'result' },
  7: { scene: 'piece', piece: 3 },
  8: { scene: 'rules', page: 1 },
};
// 3D pit: quality is chosen once from the device (phones get the medium tier, weak devices the light one); `?no3d=1` or a missing
// WebGL context keeps the painted pit, and the game plays the same either way.
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 4) <= 2;
const touchy = navigator.maxTouchPoints > 0;
let presenter = { ok: false, wrap: (g) => g };
// Boot on the painted pit at once; the 3D layer is imported and built after the first frames, then swapped in (store shots and dev runs wait for it).
const wait3d = ['shot', 'scene', 'dev'].some((k) => q.has(k));
const load3d = async () => {
  try {
    const { createPresenter } = await import('./view3d/presenter.js');
    presenter = await createPresenter({ kitCanvas: canvas, quality: q.get('q') || (lowEnd ? 'low' : touchy ? 'medium' : 'high'), force2d: q.has('no3d') });
  } catch (e) { console.warn('3D layer unavailable; painted pit in use', e); }
  window.__zsr3d = presenter;
};
if (wait3d) await load3d();

const create = async (env) => {
  game = await createGame({ ...env, rhythm: engine });
  fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => game.setLicenses?.(t.split('\n').filter((l) => !/must show|fetch\(|vendor3d|public text|keep it/i.test(l)).join('\n'))).catch(() => {});
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__zsr = game;
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), piece: Number(q.get('piece') ?? 0), mode: q.get('mode') ?? 'perform', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), hint: q.has('hint'), freeze: q.has('freeze'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  if (wait3d) return presenter.ok ? presenter.wrap(game) : game;
  let cur = game;
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80)))).then(load3d).then(() => { if (presenter.ok) cur = presenter.wrap(game); });
  return new Proxy(game, { get: (_, k) => cur[k] });
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
