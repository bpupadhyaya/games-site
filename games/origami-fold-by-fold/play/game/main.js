import { boot } from './kit/index.js';
import { createGame, wheelInput } from './src/game.js';
import { meta, host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const unit = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const px = unit(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel scrolls the Rules / How to Play reader (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * unit() * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// 3D presenter (lit paper, hinoki desk, folding mat behind the kit canvas). The game boots at once on the software-3D 2D art; three.js loads
// after the first frames, then the scene takes over. No WebGL, ?flat=1 or a lost context: the 2D art stays. Read-only on the game.
const q = new URLSearchParams(location.search);
let presenter = null, inner = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#e6dbc3') };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    if (v3.on && presenter) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__og = game; return (inner = wrap(game)); };

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the title reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: bg });
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; 2D art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
