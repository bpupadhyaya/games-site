import { boot } from './kit/index.js';
import { createGame } from './src/game.js';
import { meta, host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

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
window.addEventListener('orientationchange', syncHost);
window.addEventListener('safeinsets', syncHost);

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (lit stones on the swept yard, behind the transparent 2D canvas). The game boots at once on the flat 2D art; three.js is
// fetched afterwards. No WebGL, ?flat=1 or a lost context: the flat art stays. The presenter only reads what the 2D layer drew.
const q = new URLSearchParams(location.search);
let presenter = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#000') };   // read by the kit every frame
const wrap = (g) => Object.assign(Object.create(g), g, { render(ctx, view) {
  if (v3.on) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }   // a transparent fill does not clear
  g.render(ctx, view);
  if (presenter) presenter.post();
} });

// The kit has no wheel event: forward mouse-wheel / trackpad scrolling to the game (it queues it and applies it in update()).
boot({
  createGame: async (env) => {
    const game = await createGame(env);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); game.wheel?.((e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY) * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)))); }, { passive: false });
    if (env.config.dev) window.__dk = game;
    return wrap(game);
  },
  meta, canvas, background: bg,
});
if (q.has('dev')) Object.defineProperty(window, '__p3', { get: () => presenter });
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => { if (p.ok) presenter = p; })
    .catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));   // let the flat title paint and become interactive first
}
