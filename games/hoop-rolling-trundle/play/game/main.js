import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');
let game = null;
// The 3D children and hoops (web/view3d) draw on a transparent canvas above the kit canvas (no input). Without WebGL2, with ?nogl, on a
// lost context, or when the assets are slow (more than 1.6 s) the illustrated 2D figures play and the 3D layer takes over when ready.
let presenter = null;
// Store-shot / scripted-scene runs wait for the 3D layer before the first frame. Normal play boots at once on the 2D art; the 3D presenter
// loads in the background and takes over (adopt) the moment it is ready.
const SYNC3D = /[?&](shot|scene|bare|pdb)\b/.test(location.search), NOGL = /[?&]nogl\b/.test(location.search);
let lateGame = null;
const lateWrap = (g) => { let inner = null; lateGame = Object.assign({}, g, { update(dt, i) { return (inner ?? g).update(dt, i); }, render(c, v) { (inner ?? g).render(c, v); }, adopt() { if (!inner && presenter && presenter.stage) inner = presenter.wrap(g); } }); return lateGame; };
const lateBg = (flat) => ({ toString: () => (presenter && presenter.stage && presenter.ready ? 'rgba(0,0,0,0)' : flat) });
const startLate3d = (opts) => {
  createPresenter(opts).then((p) => {
    if (!p || !p.stage) return;
    presenter = p; if (/[?&]dev\b/.test(location.search)) { window.__presenter = p; window.__p3d = p; }
    if (lateGame) lateGame.adopt();
  }).catch((e) => console.warn('3D presenter unavailable', e));
};
try {
  if (SYNC3D && !new URLSearchParams(location.search).has('nogl')) {
    presenter = await createPresenter({ kitCanvas: canvas });
    if (presenter && presenter.stage) await Promise.race([presenter.ready_p, new Promise((r) => setTimeout(r, new URLSearchParams(location.search).has('shot') ? 12000 : 1600))]);
  }
} catch (e) { console.warn('3D presenter unavailable', e); presenter = null; }
const has3d = !!(presenter && presenter.stage);

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
  2: { scene: 'play', mode: 'race', course: 0, advance: 14, play: true },
  3: { scene: 'play', mode: 'race', course: 2, advance: 30, play: true },
  4: { scene: 'courses' },
  5: { scene: 'about' },
  6: { scene: 'result', course: 1 },
  7: { scene: 'detail', course: 3 },
  8: { scene: 'rules', page: 1 },
  9: { scene: 'play', mode: 'race', course: 3, advance: 46, play: true },
  10: { scene: 'play', mode: 'auto', course: 5, advance: 3 },
  11: { scene: 'play', mode: 'race', course: 4, advance: 52, play: true },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__htr = game;
    if (q.has('scene')) {
      game.dev.jump({ scene: q.get('scene'), course: Number(q.get('course') ?? 0), mode: q.get('mode') ?? 'race', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
    }
  }
  if (env.config.dev) window.__presenter = presenter;
  return presenter && presenter.stage ? presenter.wrap(game) : lateWrap(game);
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: lateBg('#0d1b26') });
if (!SYNC3D && !NOGL && !presenter) startLate3d({ kitCanvas: canvas });
