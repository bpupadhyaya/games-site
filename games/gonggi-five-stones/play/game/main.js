import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo } from './src/brand.js';
import { setLockup } from './src/menus.js';
import { v3 } from './src/v3.js';
import { addCredits } from './src/content.js';

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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for layout/resize check scripts.
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__gg = game; return game; };

// The Arcforge badge and lockup (see src/brand.js, src/menus.js): optional, nothing breaks if they do not load.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Mouse wheel / trackpad scrolls menus and the Rules reader (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// 3D presenter (an ondol floor in lattice-window light, the bojagi cloth and five glossy pebbles, behind the kit canvas). The game boots
// at once on the flat 2D art; three.js is fetched and the scene built in small slices after the first frames, then it crossfades in.
// No WebGL, ?flat=1 or a lost context: the flat art stays. The presenter only reads what view.js hands it (v3.want + the overlay).
const q = new URLSearchParams(location.search);
let presenter = null, inner = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#06141a') };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, { render(ctx, view) { if (v3.on) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); } g.render(ctx, view); if (v3.on && presenter) presenter.post(); } });
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));   // let the flat title paint and become interactive first
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About (fetched once the title is up).
setTimeout(() => fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  const body = [];
  for (const part of md.split(/\n\s*\n/)) { const t = part.trim(); if (t && !t.startsWith('#')) body.push(t.replace(/\s*\n\s*/g, ' ').replace(/[`*_]/g, '')); }
  addCredits(body);
}).catch(() => {}), 400);
