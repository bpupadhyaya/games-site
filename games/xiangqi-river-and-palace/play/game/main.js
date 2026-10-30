import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { ABOUT } from './src/content.js';
import { inRect, layoutFor } from './src/layout.js';

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
// Mouse wheel scrolls the reader pages (How to play / About / Rules): CSS px -> virtual units.
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
let presenter = null, inner = null, DEV = false;
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) {
    DEV = true; window.__xq = game; Object.defineProperty(window, '__p3', { get: () => presenter });
    const render = game.render.bind(game); let first = true;
    game.render = (ctx, view) => { if (first) { first = false; window.__xqFirstRender = performance.now(); } return render(ctx, view); };
  }
  return game;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a slate table at night, the carved board and turned pieces, two paper lamps), behind the kit canvas. The game boots at once
// on the flat 2D art; three.js is fetched and the scene built in small slices after the first frames, then it crossfades in. No WebGL or a lost
// context: the flat art stays / returns. While the 3D board is up, pointer positions over the board are mapped through its camera back onto the
// board plane and then into the flat board space the game logic always used.
const BOARD_SCENES = new Set(['play', 'lesson', 'puzzle', 'autoplay']);
const kindOf = (sc) => (sc === 'lesson' ? 'lesson' : sc === 'puzzle' ? 'puzzle' : sc === 'autoplay' ? 'auto' : 'play');
let gesture = false;
const bg = { toString: () => (v3.on && v3.fade > 0.02 ? 'rgba(0,0,0,0)' : '#0f0605') };      // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  update(dt, input) {
    const p = input.pointer, st = g.getState();
    if (!(v3.on && presenter && v3.pick && v3.bl && BOARD_SCENES.has(st.scene)) || st.overOpen) { gesture = false; return g.update(dt, input); }
    const BL = layoutFor(meta.width, meta.height).board(kindOf(st.scene));
    if (p.pressed) gesture = inRect(BL.boardRect, p.x, p.y);
    let np = p;
    if (gesture && (p.down || p.pressed || p.released)) { const q = v3.pick(p.x, p.y); if (q) np = { ...p, x: BL.ox + q.x * BL.s, y: BL.oy + q.y * BL.s }; }
    if (!p.down && !p.pressed) gesture = false;
    return g.update(dt, np === p ? input : { ...input, pointer: np });
  },
  render(ctx, view) {
    if (v3.on && presenter) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); presenter.pre(); }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
{
  const q = new URLSearchParams(location.search);
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); if (DEV && q.has('flat')) return; presenter = p; p.attach(inner); };   // the ?flat toggle only works with the dev flag
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));   // let the flat title paint and become interactive first
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
setTimeout(() => fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  const body = [];
  for (const part of md.split(/\n\s*\n/)) { const t = part.trim(); if (t && !t.startsWith('#')) body.push(t.replace(/\s*\n\s*/g, ' ').replace(/[`*_]/g, '')); }
  if (body.length) ABOUT.push({ title: '3D graphics credits', items: body });
}).catch(() => {}), 400);
