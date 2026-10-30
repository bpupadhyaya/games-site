import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const unitsPerPx = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const px = unitsPerPx(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', syncHost);
window.addEventListener('safeinsets', syncHost);

// The kit has no wheel event: collect mouse-wheel / trackpad movement here (converted to virtual units) and hand it to the game, which drains it each update.
let pending = 0;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const px = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * 600 : e.deltaY;
  pending += px * unitsPerPx();
}, { passive: false });
const wheel = { take() { const v = pending; pending = 0; return v; } };

// The Arcforge badge and the themed lockup (optional: the title still reads without them).
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout / resize check scripts.
const create = async (env) => { const game = await createGame({ ...env, wheel }); if (env.config.dev) window.__kl = game; return game; };

// 3D presenter (a granite doorstep in morning sun with the rice-flour line on it, behind the kit canvas). The game boots at once on the flat
// 2D art; three.js is fetched and the scene built in small slices after the first frames, then it crossfades in. No WebGL, ?flat=1 or a
// lost context: the flat art stays. The presenter only reads what view.js asks for (v3.want).
const q = new URLSearchParams(location.search);
let presenter = null, inner = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#000') };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, { render(ctx, view) { g.render(ctx, view); if (v3.on && presenter) presenter.post(); } });
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
  if (body.length) ABOUT.push({ title: '3D graphics credits', body });
}).catch(() => {}), 400);
