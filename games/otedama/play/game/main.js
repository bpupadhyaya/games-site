import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { setLicenses } from './src/content.js';
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
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'perform', routine: 3, advance: 12.5, play: true },
  3: { scene: 'play', mode: 'perform', routine: 5, advance: 14.2, play: true },
  4: { scene: 'routines' },
  5: { scene: 'about' },
  6: { scene: 'result', routine: 3 },
  7: { scene: 'detail', routine: 7 },
  8: { scene: 'rules', page: 1 },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__otd = game;
    if (q.has('scene')) {
      game.dev.jump({ scene: q.get('scene'), routine: Number(q.get('routine') ?? 0), mode: q.get('mode') ?? 'perform', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
    }
  }
  return game;
};

fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { if (t) setLicenses(t); }).catch(() => {});
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// The 3D performer loads in the background; until it is ready (or if it never is) the 2D hands are drawn.
if (!q.has('no3d')) createPresenter().then((p) => { window.__v3 = p; }).catch(() => {});

boot({ createGame: create, meta, canvas, background: '#0a1030' });
