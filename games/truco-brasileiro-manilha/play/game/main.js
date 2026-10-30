import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3, covers } from './src/v3.js';
import { ABOUT } from './src/rulesContent.js';

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
// Mouse wheel scrolls the long pages (CSS px -> virtual units); the game reads it through the pointer wheel hook if present.
// Dev tools only (?dev=1 or the app's Developer toggle): game.js exposes globalThis.__truco for the check scripts.

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the credit line still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (the botequim table behind the kit canvas, view3d/presenter.js). The game boots at once on the flat painted table (styled
// title in the first frame); three.js is fetched and the scene built in small slices after that, then it crossfades in. No WebGL,
// ?flat=1 or a lost context: the flat art stays. The presenter only reads game state.
const q = new URLSearchParams(location.search);
let presenter = null, inner = null;
const bg = { toString: () => (inner && covers(inner.getState().scene) ? 'rgba(0,0,0,0)' : '#06141a') };   // read by the kit every frame
const freeze = q.has('dev') ? () => window.__freeze === true : () => false;   // dev only: hold the clock for screenshot scripts
const wrap = (g) => Object.assign(Object.create(g), g, {
  update(dt, input) { if (!freeze()) g.update(dt, input); },
  render(ctx, view) {
    if (v3.on && presenter) presenter.pre();
    if (covers(g.getState().scene)) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }   // the kit only paints the (transparent) background, so wipe the old frame
    g.render(ctx, view); if (v3.on && presenter) presenter.post(); },
});
boot({ createGame: async (env) => (inner = wrap(await createGame(env))), meta, canvas, background: bg });
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));   // let the flat title paint and become interactive first
}

// Credits for the 3D layer (three.js, view3d), shown as the last section of the About reader.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  const lines = [];
  for (const part of md.split(/\n\s*\n/)) { const t = part.trim(); if (t) lines.push(t.replace(/^#+\s*/, '').replace(/\s*\n\s*/g, ' ').replace(/`/g, '')); }
  ABOUT.push({ title: 'Credits: 3D table', lines });
}).catch(() => {});
