import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { EXTRA_ABOUT } from './src/content.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// logic never reads it) and the game draws moving stones and the hand a fraction of a step ahead, which keeps motion smooth at 120 Hz.
const clock = () => globalThis.performance.now();
// The kit input does not carry the mouse wheel, so the shell collects it (in board units) for the document screens to scroll with.
const canvas = document.getElementById('game');
const wheel = { dy: 0 };
const unitsPerPx = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));   // the short side is always 720 virtual units
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheel.dy += e.deltaY * (e.deltaMode === 1 ? 32 : 1) * unitsPerPx(); }, { passive: false });

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units, so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const u = unitsPerPx(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * u : 0; host.r = s ? (s.right || 0) * u : 0; host.b = s ? (s.bottom || 0) * u : 0; host.l = s ? (s.left || 0) * u : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * u : 0; host.px = 1 / u;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// Arcforge pictures (see src/brand.js): optional, the game reads without them.
const load = (src, set) => { const im = new Image(); im.onload = () => set(im); im.src = src; };
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

// 3D presenter (a carved board on a coiled grass mat in a stone courtyard, behind the kit canvas). The game boots at once on the flat 2D art
// (styled title in the first frame); three.js is fetched and the scene built in small slices after that, then crossfades in. No WebGL or a
// lost context: the flat art stays. The presenter only draws what the 2D layer describes; the game never reads it.
let presenter = null, inner = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#000') };     // read by the kit every frame, so the switch is instant
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
// Developer tools only (the app's Developer toggle or ?dev=1): expose the game object for the QA scripts under dev/.
boot({ createGame: async (env) => { const g = await createGame({ ...env, clock, wheel }); if (env.config.dev) globalThis.__gabata = g; return (inner = wrap(g)); }, meta, canvas, background: bg });
const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
  if (!p.ok) return;
  const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(); if (new URLSearchParams(location.search).has('dev')) globalThis.__p3 = p; };
  go();
}).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
// let the flat title paint and become interactive first
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 450)));
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  EXTRA_ABOUT.push({ title: '3D graphics credits', body: md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')).join('\n\n') });
}).catch(() => {});
