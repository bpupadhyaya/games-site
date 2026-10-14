import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';
import { createLazy3d } from './lazy3d.js';
import { setArenaAspect } from './src/art.js';

const canvas = document.getElementById('game');
let game = null;

// The 3D court (web/view3d) is drawn behind the transparent kit canvas. It never blocks the game: without WebGL2, with ?nogl, or if the assets
// are slow (more than 1.6 s) the 2D art plays and the 3D layer takes over the moment it is ready.
const qs0 = new URLSearchParams(location.search);
const lazy = createLazy3d({
  canvas, flatBg: '#0e1730', eager: qs0.has('shot'), readyTimeout: qs0.has('shot') ? 12800 : 1600,
  load: async () => (qs0.has('nogl') ? null : createPresenter({ kitCanvas: canvas })),
  onAdopt: () => setArenaAspect(0.92),   // a shorter arena box than the oblique 2D court needs: the circle gets bigger on tall tablets
});
await lazy.prepare();

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
  2: { scene: 'play', sel: 0, advance: 9 },
  3: { scene: 'play', sel: 1, role: 'dodger', advance: 14 },
  4: { scene: 'venues' },
  11: { scene: 'play', auto: true, think: 'think' },
  6: { scene: 'result', sel: 0 },
  7: { scene: 'rules', page: 1 },
  8: { scene: 'play', sel: 2, role: 'ring', advance: 12 },
  9: { scene: 'about' },
  10: { scene: 'play', sel: 3, advance: 7 },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__cdb = game; Object.defineProperty(window, '__presenter', { get: () => lazy.presenter });
    if (q.has('scene')) {
      game.dev.jump({
        scene: q.get('scene'), sel: Number(q.get('sel') ?? 0), role: q.get('role') ?? 'dodger', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0),
        auto: q.has('auto'), pref: q.has('text') ? { textIdx: Number(q.get('text')) } : undefined, pause: q.has('pause'), until: q.get('until') ?? undefined, after: Number(q.get('after') ?? 0), nth: Number(q.get('nth') ?? 1), hold: q.has('hold'), hint: q.has('hint'), think: q.get('think') ?? undefined,
      });
    }
  }
  return lazy.wrap(game);
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: lazy.background });
lazy.start();
