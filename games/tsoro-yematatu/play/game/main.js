import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { createPresenter } from './view3d/presenter.js';
import { createLazy3d } from './lazy3d.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const q0 = new URLSearchParams(location.search);
if (q0.has('dev') && q0.has('insets')) { const [t, r, b, l, back] = q0.get('insets').split(',').map(Number); window.__safeInsets = { top: t, right: r, bottom: b, left: l, back: !!back }; window.__hostBack = !!back; }   // dev: simulate a notch / the host back button
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px; host.dpr = Math.min(2, window.devicePixelRatio || 1);
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel scrolls the document screens (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev / screenshot hook: ?shot=1&seed=N picks a preset (store/shots.json entry N); ?spec=<json> puts the game in any screen. Not reachable in production flows.
const q = new URLSearchParams(location.search);
// Boards: points are 0 top, 1 upper left, 2 centre, 3 upper right, 4 bottom left, 5 bottom middle, 6 bottom right (classic).
const PRESETS = {
  1: { scene: 'title' }, 2: { scene: 'doc', doc: 'about' },
  3: { scene: 'play', stones: { 0: 1, 3: 1, 4: 2, 6: 2 }, placed: [2, 2], turn: 1, moves: 4, last: { from: -1, to: 6, kind: 'drop', side: 2 }, msg: 'River can make a line on the bottom middle point. Block it, or make your own first.' },
  4: { scene: 'play', stones: { 0: 1, 1: 1, 5: 1, 2: 2, 3: 2, 6: 2 }, placed: [3, 3], turn: 1, sel: 5, moves: 9 },
  5: { scene: 'doc', doc: 'rules', scroll: 700 },
  6: { scene: 'play', variant: 'tens', stones: { 0: 1, 3: 1, 8: 2, 9: 2, 4: 2 }, placed: [2, 3], turn: 1, moves: 5, hint: [-1, 1] },
  7: { scene: 'auto', plies: 7 },
  8: { scene: 'lesson', lesson: 3 },
  9: { scene: 'over', stones: { 0: 1, 1: 1, 4: 1, 2: 2, 3: 2, 5: 2 }, placed: [3, 3], turn: 2, moves: 11, winLine: [0, 1, 4], winner: 1 },
};
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__ts = game;
  if (!q.has('spec') && q.has('shot') && PRESETS[q.get('seed')]) game.devScene(PRESETS[q.get('seed')]);   // `arc shots`: seed N picks store shot N
  if (q.has('spec')) { try { game.devScene(JSON.parse(q.get('spec'))); } catch (e) { console.error(e); } }
  return game;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const lazy = createLazy3d({
  canvas, flatBg: '#061110', eager: q.has('shot') || q.has('scene') || q.has('spec'), readyTimeout: 20000,
  load: async () => (q.has('flat') ? null : createPresenter({ kitCanvas: canvas })),
});
await lazy.prepare();
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => lazy.presenter }); window.__v3 = v3; }
boot({ createGame: async (env) => lazy.wrap(await create(env)), meta, canvas, background: lazy.background });
lazy.start();
