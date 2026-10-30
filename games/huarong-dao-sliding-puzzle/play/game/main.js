import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { v3 } from './src/v3.js';
import { setLogo, setLockup } from './src/brand.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel scrolls the Rules / How to Play / level list / About pages (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__hd = game; return game; };

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the title still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a torch-lit night pass: carved-lacquer blocks on a stone road in a black-lacquer tray) behind the kit canvas.
// Boots on the flat 2D art; three.js is fetched and the scene built after the first frames, then crossfades in. No WebGL,
// ?flat=1 or a lost context: the flat art stays. The presenter only reads state.
let presenter = null, inner = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#0f0606') };
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) { if (v3.on && presenter) presenter.pre(); g.render(ctx, view); if (v3.on && presenter) presenter.post(); },
});
const q = new URLSearchParams(location.search);
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
