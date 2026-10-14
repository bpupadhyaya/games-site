import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { setHandSprite, setTableImage } from './src/art.js';

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
  2: { scene: 'play', mode: 'play', sel: 1, rounds: 3, phase: 'show', p: 3, c: 7, o: 4, oc: 7, at: 1.0, hold: true },
  3: { scene: 'play', mode: 'play', sel: 3, rounds: 5, phase: 'pick', throw: 2, call: 5, hint: false },
  4: { scene: 'rivals' },
  5: { scene: 'play', mode: 'auto', sel: 2, advance: 8 },
  6: { scene: 'result', sel: 1 },
  7: { scene: 'rules', page: 2 },
  8: { scene: 'play', mode: 'play', sel: 0, phase: 'count', at: 1.1, hold: true, throw: 4, call: 7 },
  9: { scene: 'about' },
  10: { scene: 'play', mode: 'play', sel: 4, rounds: 4, phase: 'show', p: 5, c: 8, o: 3, oc: 8, at: 1.0, hold: true },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__morra = game;
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), sel: Number(q.get('sel') ?? 0), mode: q.get('mode') ?? 'play', page: Number(q.get('page') ?? 0), rounds: Number(q.get('rounds') ?? 0), phase: q.get('phase') ?? undefined, advance: Number(q.get('adv') ?? 0), pause: q.has('pause'), hold: q.has('hold'), hint: q.has('hint') });
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
for (const side of ['y', 'r']) for (let k = 0; k < 4; k++) for (let n = 0; n < 6; n++) {
  const im = new Image(), key = `${side}${k}_${n}`; im.onload = () => setHandSprite(key, im); im.src = `./hands/h_${key}.webp`;
}
for (const k of ['p', 'l']) { const im = new Image(); im.onload = () => setTableImage(k, im); im.src = `./hands/table_${k}.webp`; }
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#140d1c' });
