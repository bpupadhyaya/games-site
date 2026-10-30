import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host, layoutFor } from './src/layout.js';
import { setLogo } from './src/brand.js';
import { setLockup } from './src/ui.js';
import { v3 } from './src/v3.js';
import { RULES } from './src/content.js';

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
// Mouse wheel scrolls the Rules reader (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) { window.__gs = game; window.__gsLayout = () => layoutFor(meta.width, meta.height); }
  return game;
};

// The Arcforge badge and lockup (see src/brand.js, src/ui.js): optional, everything still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a lit 3D field behind the kit canvas). The game boots at once on the flat art (styled title in the first frame);
// three.js is fetched and the scene built in small slices after that, then crossfades in. No WebGL, ?flat=1 or a lost context:
// the flat art stays. The presenter only reads game state.
const q = new URLSearchParams(location.search);
let presenter = null, inner = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#000') };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    if (v3.on && presenter) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then(async (p) => {
    if (!p.ok) return;
    await p.ready;                                  // the hunters are real people: wait until they are loaded
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); window.__v3At = performance.now(); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  // let the flat title paint and become interactive first
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
// Credits for the 3D layer (three.js, view3d, the people models), shown at the end of the Rules reader.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  const body = md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, ''));
  RULES.push({ title: '3D graphics credits', lines: body });
}).catch(() => {});
