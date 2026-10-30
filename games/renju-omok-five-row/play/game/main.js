import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo } from './src/brand.js';
import { newGame, applyMove } from './src/rules.js';
import { createThinker } from './src/engine.js';
import { v3 } from './src/v3.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
const AI_REF_MS = 5;   // time this test takes on a fast desktop; slower devices scale the search budget down by the ratio

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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => {
  const game = await createGame(env); if (env.config.dev) window.__rg = game;
  // Keep the screen smooth while the computer thinks: the search runs in slices of a fixed number of nodes per frame; this watches the
  // real frame time and shrinks or grows the slice (the answer never changes, only how long it takes).
  env.config.aiSlice = 500; let last = 0, avg = 16;
  const watch = (t) => { if (last) { const d = Math.min(100, t - last); avg = avg * 0.9 + d * 0.1; const s = env.config.aiSlice; env.config.aiSlice = d > 40 ? Math.max(150, Math.round(s * 0.6)) : avg > 22 ? Math.max(150, Math.round(s * 0.85)) : avg < 17.5 ? Math.min(4000, Math.round(s * 1.08)) : s; } last = t; requestAnimationFrame(watch); };
  requestAnimationFrame(watch);
  // One quick speed test a moment after the title appears: how fast does this device search? Slow phones get a proportionally smaller node
  // budget (the computer plays a little shallower but answers in about the same time). The test position and the reference time are fixed.
  setTimeout(() => {
    try {
      const g = newGame('gomoku'); for (const m of [112, 113, 98, 97, 126, 140, 110, 81, 129, 142]) applyMove(g, m);
      const rng = { int: () => 0, chance: () => false, next: () => 0 };
      let best = Infinity;
      for (let rep = 0; rep < 3; rep++) { const t0 = performance.now(), th = createThinker(g, 3, rng, { slice: 1e9, nodes: 6000 }); let r; do { r = th.step(); } while (r.move === undefined); best = Math.min(best, performance.now() - t0); }
      window.__aiBenchMs = best; env.config.aiScale = Math.max(0.2, Math.min(1, AI_REF_MS / best));
    } catch { /* keep the full budget */ }
  }, 1500);
  return game;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// 3D presenter (lit goban behind the kit canvas). The game boots at once on the flat 2D art (styled title in the first frame); the
// 3D layer (three.js) is fetched and built in small slices after that, then crossfades in. No WebGL, ?flat=1 or a lost context:
// the flat art stays. The presenter only reads game state.
const q = new URLSearchParams(location.search);
let presenter = null, inner = null;
const FLAT_BG = '#0b1116';
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : FLAT_BG) };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) { if (v3.on && presenter) presenter.pre(); g.render(ctx, view); if (v3.on && presenter) presenter.post(); },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); window.__v3on = true; };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  // let the flat title paint and become interactive first
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  ABOUT.push({ h: '3D graphics credits' });
  for (const part of md.split(/\n\s*\n/)) {
    const t = part.trim(); if (!t) continue;
    if (t.startsWith('#')) ABOUT.push({ h: t.replace(/^#+\s*/, '') }); else ABOUT.push({ p: t.replace(/\s*\n\s*/g, ' ').replace(/`/g, '') });
  }
}).catch(() => {});
