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
  2: { scene: 'play', mode: 'race', course: 1, advance: 20, play: true },
  3: { scene: 'play', mode: 'race', course: 5, advance: 40, play: true },
  4: { scene: 'courses' },
  5: { scene: 'about' },
  6: { scene: 'result', course: 1 },
  7: { scene: 'detail', course: 5 },
  8: { scene: 'rules', page: 1 },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__ilr = game;
    if (q.has('scene')) {
      game.dev.jump({ scene: q.get('scene'), course: Number(q.get('course') ?? 0), mode: q.get('mode') ?? 'race', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
    }
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the kit canvas). The game boots at once on the flat 2D art (a styled, interactive title in the first
// frame); the 3D lake builds in the background in small slices and then takes over with a short fade. With no WebGL, or if the context
// is lost, every screen keeps the flat 2D art.
let live = null, presenter = null;
const FLAT_BG = '#0c2a3a';
const bg = { toString: () => (live ? 'rgba(0,0,0,0)' : FLAT_BG) };   // the kit fills this every frame; read lazily so the switch is instant
const proxy = (g) => {
  const make = () => { live = presenter.wrap(g); return live; };
  return Object.assign({}, g, {
    update(dt, input) { return (live ?? g).update(dt, input); },
    render(ctx, view) { (live ?? g).render(ctx, view); },
    adopt(fade = true) { if (!live && presenter?.ok) { make(); if (!fade) return; canvas.style.transition = 'none'; canvas.style.opacity = '0.2'; requestAnimationFrame(() => { canvas.style.transition = 'opacity 320ms ease-out'; canvas.style.opacity = '1'; }); } },
  });
};
let gameProxy = null;
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
// Store-shot / scripted-scene runs need the 3D frame from the very first draw, so they wait for the presenter.
if (!q.has('flat') && (q.has('shot') || q.has('scene'))) { try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); } }
boot({ createGame: async (env) => { gameProxy = proxy(await create(env)); if (presenter?.ok) gameProxy.adopt(false); return gameProxy; }, meta, canvas, background: bg });
if (!q.has('flat') && !presenter) {
  createPresenter({ kitCanvas: canvas }).then((p) => { presenter = p; if (p.ok && gameProxy) gameProxy.adopt(); else if (p.ok) { const t = setInterval(() => { if (gameProxy) { clearInterval(t); gameProxy.adopt(); } }, 30); } })
    .catch((e) => console.warn('3D presenter unavailable', e));
}
