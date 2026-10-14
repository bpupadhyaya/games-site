import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
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
  2: { scene: 'play', seats: ['human', 'cpu', null, null], progress: [[5, 14, 22, 0], [9, 19, 28, 3]], cur: 0, log: ['Cochineal lands on a corner stone and throws again.'] },
  3: { scene: 'play', seats: ['human', 'cpu', null, null], progress: [[6, 13, 21, 0], [10, 17, 29, 3]], cur: 0, throws: [3], throw: true, advance: 1.2 },
  4: { scene: 'setup' },
  5: { scene: 'rules', page: 4 },
  6: { scene: 'result' },
  7: { scene: 'about' },
  8: { scene: 'play', auto: true, progress: [[7, 15, 26, 0], [11, 21, 4, 31]], advance: 6 },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__patolli = game;
    if (q.has('scene')) {
      game.dev.jump({
        scene: q.get('scene'), page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), pause: q.has('pause'), auto: q.has('auto'),
        progress: q.has('progress') ? JSON.parse(q.get('progress')) : undefined, seats: q.has('seats') ? JSON.parse(q.get('seats')) : undefined,
        throws: q.has('throws') ? JSON.parse(q.get('throws')) : undefined, throw: q.has('throw'), cur: q.has('cur') ? Number(q.get('cur')) : undefined,
        pieces: q.has('pieces') ? Number(q.get('pieces')) : undefined, rules: q.has('rules') ? JSON.parse(q.get('rules')) : undefined,
      });
    }
  }
  return game;
};

const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
let live = null, presenter = null;
const FLAT_BG = '#0c1014';
const bg = { toString: () => (live ? 'rgba(0,0,0,0)' : FLAT_BG) };   // kit fills this every frame; read lazily so the switch is instant
const proxy = (g) => Object.assign({}, g, {
  update(dt, input) { return (live ?? g).update(dt, input); },
  render(ctx, view) { (live ?? g).render(ctx, view); },
  adopt(fade = true) { if (!live && presenter?.ok) { live = presenter.wrap(g); if (!fade) return; canvas.style.transition = 'none'; canvas.style.opacity = '0.2'; requestAnimationFrame(() => { canvas.style.transition = 'opacity 320ms ease-out'; canvas.style.opacity = '1'; }); } },
});
let gameProxy = null;
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
// Store-shot / scripted-scene runs need the 3D frame from the very first draw, so they wait for the presenter.
if (!q.has('flat') && (q.has('shot') || q.has('scene') || q.has('bare'))) { try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); } }
boot({ createGame: async (env) => { gameProxy = proxy(await create(env)); if (presenter?.ok) gameProxy.adopt(false); return gameProxy; }, meta, canvas, background: bg });
// Normal play: the game boots at once on the flat 2D art (styled interactive title in the first frame); the 3D scene builds in the
// background in small slices and takes over with a short fade. No WebGL / context lost: the flat art stays.
if (!q.has('flat') && !presenter) {
  createPresenter({ kitCanvas: canvas }).then((p) => { presenter = p; if (p.ok && gameProxy) gameProxy.adopt(); else if (p.ok) { const t = setInterval(() => { if (gameProxy) { clearInterval(t); gameProxy.adopt(); } }, 30); } })
    .catch((e) => console.warn('3D presenter unavailable', e));
}
