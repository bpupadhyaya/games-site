import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo } from './src/brand.js';
import { GL } from './src/gl.js';
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
  2: { scene: 'play', mode: 'race', course: 0, advance: 12, play: true },
  3: { scene: 'play', mode: 'race', course: 3, advance: 22, play: true },
  4: { scene: 'courses' },
  5: { scene: 'about' },
  6: { scene: 'result', course: 1 },
  7: { scene: 'detail', course: 3 },
  8: { scene: 'rules', page: 1 },
  9: { scene: 'settings' },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__egr = game; window.__gl = GL;
    if (q.has('scene')) {
      game.dev.jump({ scene: q.get('scene'), course: Number(q.get('course') ?? 0), mode: q.get('mode') ?? 'race', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
    }
  }
  return game;
};

// The people are drawn in 3D (web/view3d) when WebGL2 and the assets are available; until then (or with ?nogl) the 2D figures play.
if (!q.has('nogl')) {
  createPresenter().then((p) => { if (p && p.ready_p) p.ready_p.then((ok) => { if (ok) GL.p = p; }); }).catch((e) => console.warn('3D layer unavailable', e && e.message, e && e.stack));
}

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

boot({ createGame: create, meta, canvas, background: '#1a1030' });
