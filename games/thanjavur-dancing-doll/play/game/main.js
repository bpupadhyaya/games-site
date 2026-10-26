import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

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
  2: { scene: 'play', mode: 'play', level: 3, play: true, advance: 17 },
  3: { scene: 'play', mode: 'play', level: 9, play: true, advance: 12 },
  4: { scene: 'levels' },
  5: { scene: 'play', mode: 'practice', level: 1, tuned: false },
  6: { scene: 'result', level: 2 },
  7: { scene: 'detail', level: 6 },
  8: { scene: 'rules', page: 1 },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__tdd = game;
    if (q.has('scene')) {
      game.dev.jump({ scene: q.get('scene'), level: Number(q.get('level') ?? 0), mode: q.get('mode') ?? 'play', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), tuned: q.has('tuned'), pause: q.has('pause'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
    }
  }
  return game;
};

const load = (src, fn) => { const i = new Image(); i.onload = () => fn(i); i.src = src; };
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

// 3D presenter: boots flat 2D first (usable canvas immediately), then loads three.js + builds the lit 3D set in slices and crossfades it in.
// The heavy module graph and WebGL setup start only AFTER the kit has sized the canvas and drawn frames (a static import plus a top-level
// await ahead of boot() starved weak WebViews, so the canvas was not sized within 20 s). No WebGL, a failed build or a lost context
// leaves every screen on the flat 2D art. Store-screenshot runs (?shot) still bring 3D up before boot so the frozen frame has it.
let live = null;                       // the presenter-wrapped game, once 3D is ready
const FLAT = '#f4ddb0', CLEAR = 'rgba(0,0,0,0)';
let bg = FLAT;                         // the kit fills the canvas with String(background) each frame; transparent once 3D is up
const background = { toString: () => bg };
const make3d = async () => {
  if (q.has('flat')) return null;
  try {
    const { createPresenter } = await import('./view3d/presenter.js');
    const presenter = await createPresenter({ kitCanvas: canvas });
    if (q.has('dev')) { window.__p3 = presenter; window.__v3 = v3; }
    return presenter.ok ? presenter : null;
  } catch (e) { console.warn('3D presenter unavailable', e); return null; }
};
const attach3d = (presenter) => { if (!presenter || !game) return; live = presenter.wrap(game); bg = CLEAR; };
const early = q.has('shot') ? await make3d() : null;
const late = async (env) => {
  const g = await create(env);
  attach3d(early);
  return Object.assign({}, g, { update: (dt, input) => (live || g).update(dt, input), render: (ctx, view) => (live || g).render(ctx, view) });
};
boot({ createGame: late, meta, canvas, background }).then(() => {
  if (early) { setTimeout(() => early.build(), 0); return; }
  let n = 0; const wait = () => (++n < 4 ? requestAnimationFrame(wait) : setTimeout(async () => { const p = await make3d(); attach3d(p); if (p) p.build(); }, 400));
  requestAnimationFrame(wait);
});
