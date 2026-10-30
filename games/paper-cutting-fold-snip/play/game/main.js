import { boot } from './kit/index.js';
import { createGame, wheelInput } from './src/game.js';
import { meta, host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { addAboutCredits } from './src/content.js';

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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
let presenter = null, inner = null, devOn = false;
const create = async (env) => {
  const game = await createGame(env);
  devOn = Boolean(env.config.dev);
  if (devOn) { window.__pc = game; window.__v3 = v3; Object.defineProperty(window, '__p3', { get: () => presenter, configurable: true }); }
  return game;
};

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the title reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a walnut desk, a printed cutting mat and the paper itself lit, with real shadows, behind the kit canvas). The game boots at
// once on the flat 2D art (styled title in the first frame); three.js is fetched and the scene built in small slices after that, then it
// crossfades in. No WebGL, ?flat=1 or a lost context: the flat art stays. The presenter only reads what the 2D layer describes (src/v3.js).
const q = new URLSearchParams(location.search);
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#170d0e') };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    v3.ctx = ctx; v3.base = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    if (v3.on && presenter) {
      // the kit fills its background each frame; a transparent fill erases nothing, so clear the 2D layer here
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
      presenter.pre();
    }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  // let the flat title paint and become interactive first
  // wait until the game exists and the flat title has painted twice, then give the main thread a breather before fetching three.js
  const when = () => { if (!inner) return setTimeout(when, 20); requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 120))); };
  when();
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  addAboutCredits(md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')).join(' '));
}).catch(() => {});
