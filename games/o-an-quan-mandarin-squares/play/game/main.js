import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { addAboutCredits } from './src/content.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// logic never reads it) and the game draws moving stones and the hand a fraction of a step ahead, which keeps motion smooth at 120 Hz.
const clock = () => globalThis.performance.now();
const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const unit = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const u = unit(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * u : 0; host.r = s ? (s.right || 0) * u : 0; host.b = s ? (s.bottom || 0) * u : 0; host.l = s ? (s.left || 0) * u : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * u : 0; host.px = 1 / u;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// The Arcforge badge and themed lockup (see src/brand.js): optional, the game reads fine without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a red-brown clay board on a sedge mat on a village veranda, behind the kit canvas). The game boots at once on the flat
// 2D art (styled title in the first frame, interactive immediately); three.js is fetched and the scene built after that, then the
// UI fades over it. No WebGL or a lost context: the flat 2D art stays. The presenter only reads what the 2D layer hands it (src/v3.js).
let presenter = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#000') };      // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    if (v3.on && presenter) {
      // the kit fills its background each frame; a transparent fill erases nothing, so clear the 2D layer here
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
      presenter.pre();
    }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
let inner = null;
const create = async (env) => { const game = await createGame({ ...env, clock }); if (env.config.dev || /[?&]qa=1/.test(location.search)) window.__oq = game; inner = wrap(game); return inner; };

boot({ createGame: create, meta, canvas, background: bg }).then((r) => {
  // Mouse wheel / trackpad scrolls the long text screens (Rules, How to Play, About, Settings at large text sizes).
  canvas?.addEventListener('wheel', (e) => { e.preventDefault(); r?.game?.wheel?.((e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY) * unit()); }, { passive: false });
});
const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
  if (!p.ok) return;
  const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
  go();
}).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
// let the flat title paint and become interactive first
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));

// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  addAboutCredits(md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')).join(' '));
}).catch(() => {});
