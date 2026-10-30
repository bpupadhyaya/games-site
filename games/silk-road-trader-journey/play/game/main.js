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
  2: { scene: 'journey', ph: 'city', tab: 'trade', city: 5, day: 52, silver: 830, silk: 9, paper: 4, news: 1 },
  3: { scene: 'journey', ph: 'travel', city: 3, to: 4, tday: 5, scroll: 1600, day: 38 },
  4: { scene: 'journey', ph: 'event', city: 2, to: 3, ev: 'bandits', day: 24 },
  5: { scene: 'journey', ph: 'event', city: 4, to: 5, ev: 'horsefair', day: 44, hintEv: 1 },
  6: { scene: 'map', city: 5, day: 52 },
  7: { scene: 'journal', tab: 'people' },
  8: { scene: 'rules', page: 3 },
  9: { scene: 'lesson', ph: 'city', city: 1, day: 7, stage: 'reveal', tab: 'trade' },
  10: { scene: 'journey', ph: 'city', tab: 'road', city: 4, day: 41 },
  11: { scene: 'journey', ph: 'event', city: 4, to: 5, ev: 'snow', day: 47, alt: 1, pace: 'steady' },
  12: { scene: 'result', city: 8, day: 99, silver: 2300 },
};
const create = async (env) => {
  game = await createGame(env);
  // The lit 3D road (web/view3d) draws behind this canvas once it is ready; until then, and without WebGL2, the flat painting shows.
  const render2d = game.render; let last = performance.now();
  game.render = (ctx, view) => {
    v3.scene = null; render2d(ctx, view);
    v3.vw = meta.width; v3.vh = meta.height; v3.cssPerUnit = meta.cssPerUnit;
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    if (presenter) presenter.draw(dt);
  };
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__srt = game;
    if (q.has('scene')) game.dev.jump(JSON.parse(q.get('scene')));
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

v3.kitCanvas = canvas;
let presenter = null;
boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
// Boot on the flat painting; build the 3D layer after the first painted frames, then cross-fade (v3.fade) into it.
if (!q.has('flat') && typeof requestAnimationFrame === 'function') {
  let frames = 0;
  const later = () => { if (++frames < 4) { requestAnimationFrame(later); return; }
    import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas, getState: () => game?.getState() ?? {} }))
      .then((p) => { if (p) { presenter = p; v3.on = true; v3.fade = 0; if (q.has('dev')) window.__srt3d = p; if (q.has('dev') && q.has('icon')) iconMode(); } })
      .catch((e) => console.warn('3D layer unavailable, keeping the painted scenes', e)); };
  requestAnimationFrame(later);
}

// Offline only (dev builds): ?dev=1&icon=1 renders the store icon composition from the game's own 3D scene (polish/make-icon.mjs).
function iconMode() {
  let t = 0;
  game.render = (ctx) => { t += 1 / 60; ctx.clearRect(0, 0, meta.width, meta.height); v3.vw = meta.width; v3.vh = meta.height; v3.cssPerUnit = meta.cssPerUnit; v3.fade = 1;
    v3.scene = { rect: { x: 0, y: 0, w: meta.width, h: meta.height }, spec: { icon: true, biome: 'dunes', time: 'dusk', seed: 11, caravan: { n: 2, dir: -1, still: true, kind: 'bactrian', loads: [['silk', 'silk'], ['spice', 'glass']] } }, t: 20 + t };
    presenter.draw(1 / 60); };
}
