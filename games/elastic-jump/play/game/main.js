import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');
let game = null;
// The 3D scene is drawn in a WebGL canvas behind the kit canvas (transparent: HUD, menus and input). Without WebGL the 2D scene plays on.
let presenter = null;
try { if (!new URLSearchParams(location.search).has('nogl')) presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }

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
  1: { scene: 'title', hold: true },
  2: { scene: 'play', mode: 'play', level: 3, advance: 14.06, play: true, hold: true },
  3: { scene: 'play', mode: 'auto', level: 1, advance: 10.4, hold: true },
  4: { scene: 'levels', hold: true },
  5: { scene: 'about', hold: true },
  6: { scene: 'result', level: 2, hold: true },
  7: { scene: 'prep', level: 4, hold: true },
  8: { scene: 'rules', page: 1, hold: true },
};
if (presenter && presenter.stage && q.has('shot')) { presenter.shot = true; presenter.demoOffset = 2.3; }
const create = async (env) => {
  game = await createGame(env);
  if (presenter && presenter.stage) { game = presenter.wrap(game); if (q.has('dev')) window.__presenter = presenter; }
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__ej = game;
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), level: Number(q.get('level') ?? 0), mode: q.get('mode') ?? 'play', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), hint: q.has('hint'), hold: q.has('hold'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: presenter && presenter.stage ? 'rgba(0,0,0,0)' : '#14204a' });
