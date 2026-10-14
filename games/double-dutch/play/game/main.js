import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

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
const q0 = q;
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'play', level: 3, advance: 12, play: true },
  3: { scene: 'play', mode: 'auto', level: 4, advance: 3 },
  4: { scene: 'levels' },
  5: { scene: 'about' },
  6: { scene: 'result', level: 2 },
  7: { scene: 'play', mode: 'play', level: 4, advance: 15, play: true },
  8: { scene: 'rules', page: 4 },
};
// The 3D street loads in the background: the 2D street is on screen at once and the 3D one fades in when it is ready.
let presenter = null;
const attach = () => { if (presenter && presenter.ok && game && !game.__v3) { game.__v3 = true; presenter.wrap(game); } };
(q0.has('no3d') ? Promise.resolve(null) : createPresenter({ kitCanvas: canvas, quality: q0.get('q3d') || 'medium' })).then((p) => { presenter = p; attach(); }).catch((e) => console.warn('3D street unavailable', e));
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__dd = game;
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), level: Number(q.get('level') ?? 0), mode: q.get('mode') ?? 'play', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), hint: q.has('hint'), hold: q.has('hold'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  attach();
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
