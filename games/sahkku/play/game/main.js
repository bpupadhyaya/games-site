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
if (q0.has('dev') && q0.has('insets')) { const [t, r, b, l, back] = q0.get('insets').split(',').map(Number); window.__safeInsets = { top: t, right: r, bottom: b, left: l, back: !!back }; window.__hostBack = !!back; }
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px; host.dpr = Math.min(2, window.devicePixelRatio || 1);
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev / screenshot hook: ?shot=1&seed=N picks a preset from store/shots.json; ?spec=<json> puts the game in any screen. Never reachable in production flows.
const q = new URLSearchParams(location.search);
const PRESETS = {
  1: { scene: 'title' }, 2: { scene: 'doc', doc: 'about' }, 3: { scene: 'play', plies: 10, dice: [2, 3, 1, 0], sel: 'first' }, 4: { scene: 'play', plies: 16, dice: [3, 2, 2, 1], sel: 'first' },
  5: { scene: 'doc', doc: 'rules', scroll: 700 }, 6: { scene: 'auto', plies: 14 }, 7: { scene: 'play', plies: 24, dice: [1, 3, 0, 2], sel: 'first', wood: 'rowan' }, 8: { scene: 'doc', doc: 'how' },
};
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__sk = game;
  if (!q.has('spec') && q.has('shot') && PRESETS[q.get('seed')]) game.devScene(PRESETS[q.get('seed')]);
  if (q.has('spec')) { try { game.devScene(JSON.parse(q.get('spec'))); } catch (e) { console.error(e); } }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const lazy = createLazy3d({
  canvas, flatBg: '#070d1f', eager: q.has('shot') || q.has('scene'), readyTimeout: 20000,
  load: async () => (q.has('flat') ? null : createPresenter({ kitCanvas: canvas })),
});
await lazy.prepare();
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => lazy.presenter }); window.__v3 = v3; }
boot({ createGame: async (env) => lazy.wrap(await create(env)), meta, canvas, background: lazy.background });
lazy.start();
