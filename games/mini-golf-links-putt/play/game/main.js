import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

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

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the text credit still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Mouse wheel / trackpad scrolls menus and the Rules reader (CSS px -> virtual units).
document.getElementById('game').addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// 3D presenter (a lit diorama of the hole behind the kit canvas). The game boots at once on the flat 2D art; three.js is fetched and the
// scene built after that. No WebGL, ?flat=1 or a lost context: the flat art stays. The presenter only reads game state.
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#07180f') };     // read by the kit every frame, so the switch is instant
let inner = null, presenter = null;
const create = async (env) => {
  const game = await createGame(env); inner = game;
  return Object.assign(Object.create(game), game, {
    render(ctx, view) {
      if (v3.on && presenter) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); presenter.pre(); }
      game.render(ctx, view);
      if (v3.on && presenter) presenter.post();
    },
  });
};
boot({ createGame: create, meta, canvas: document.getElementById('game'), background: bg });
if (!new URLSearchParams(location.search).has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: document.getElementById('game') })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
