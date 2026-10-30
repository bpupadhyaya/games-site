import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { setHost } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { ABOUT } from './src/content.js';

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  setHost({ t: s ? (s.top || 0) * px : 0, r: s ? (s.right || 0) * px : 0, b: s ? (s.bottom || 0) * px : 0, l: s ? (s.left || 0) * px : 0, back: s && s.back !== false && window.__hostBack !== false ? 56 * px : 0, px: 1 / px });
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two updates and to budget the computer player's thinking; it never reaches the simulation).
const clock = () => globalThis.performance.now();
// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame({ ...env, clock }); if (env.config.dev) window.__sn = game; return game; };

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the game reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a club snooker table behind the kit canvas). The game boots at once on the flat 2D art; three.js is fetched and the scene
// built in small slices after that, then crossfades in. No WebGL, ?flat=1 or a lost context: the flat art stays.
const canvas = document.getElementById('game');
const q = new URLSearchParams(location.search);
let presenter = null, inner = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#000') };      // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    if (v3.on && presenter) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
    v3.cam = null;
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});
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
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  ABOUT.push({ title: '3D graphics credits', body: md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')) });
}).catch(() => {});
