import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { flatPoint } from './src/scene.js';
import { PIN_Z0 } from './src/phys.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;   // px: css pixels per virtual unit
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the credit line still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout / resize check scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) {
    DEV = true;
    window.__kg = game;
    Object.defineProperty(window, '__p3', { get: () => presenter });
    const render = game.render.bind(game); let first = true;
    game.render = (ctx, view) => { if (first) { first = false; window.__kgFirstRender = performance.now(); } return render(ctx, view); };
  }
  return game;
};

// 3D presenter (a German inn's skittle alley: lantern light, maple lane, turned pins). The game boots at once on the flat 2D art; three.js is fetched and
// the scene built in small slices after the first frames, then it fades in. No WebGL, ?flat=1 or a lost context: the flat art stays / returns. While the 3D
// scene is up, pointer positions over the lane are mapped through its camera back onto the lane, then into the flat layout the game logic always used.
let presenter = null, inner = null, gesture = null, DEV = false;
const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const bg = { toString: () => (v3.on && v3.fade > 0.02 ? 'rgba(0,0,0,0)' : '#000') };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  update(dt, input) {
    const p = input.pointer, act = v3.on && presenter && v3.map.active && v3.map.to && v3.want && v3.xf;
    if (!act) { gesture = null; return g.update(dt, input); }
    if (p.pressed) {
      gesture = null;
      if (inRect(v3.want.rect, p.x, p.y) && !(v3.map.skip || []).some((r) => inRect(r, p.x, p.y))) { const q = v3.map.to(p.x, p.y); if (q.inside) gesture = { zref: q.z < 6.1 ? 0 : PIN_Z0, y0: null }; }
    }
    let np = p;
    if (gesture && (p.down || p.pressed || p.released)) {
      const q = v3.map.to(p.x, p.y), f = v3.xf, fp = flatPoint(clampN(q.x, -1.3, 1.3), clampN(q.z, 0, 22.3), gesture.zref);
      if (gesture.y0 === null) gesture.y0 = fp.y;
      const fy = gesture.zref === 0 ? gesture.y0 + (fp.y - gesture.y0) * 1.7 : fp.y;   // a flick up the tilted lane covers little screen: lengthen it so it matches the old flick distance
      np = { ...p, x: f.vx + fp.x * f.s, y: f.vy + fy * f.s };
    }
    if (!p.down && !p.pressed) gesture = null;
    return g.update(dt, np === p ? input : { ...input, pointer: np });
  },
  render(ctx, view) {
    v3.want = null; v3.map.active = false; v3.map.skip = null;
    if (v3.on) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
{
  const q = new URLSearchParams(location.search);
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); if (DEV && q.has('flat')) return; presenter = p; if (DEV && q.has('tier')) p.setTier(Number(q.get('tier'))); p.attach(); };   // dev toggles (?flat, ?tier) only work with the dev flag
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));   // let the flat title paint and become interactive first
}

// Credits for the 3D layer (three.js, view3d), shown at the end of About (fetched once the title is up).
setTimeout(() => fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  const body = [];
  for (const part of md.split(/\n\s*\n/)) { const t = part.trim(); if (t && !t.startsWith('#')) body.push(t.replace(/\s*\n\s*/g, ' ').replace(/[`*_]/g, '')); }
  if (body.length) ABOUT.push({ title: '3D graphics credits', p: body });
}).catch(() => {}), 400);

// Mouse wheel / trackpad scrolls menus and the Rules reader (CSS px -> virtual units).
document.getElementById('game').addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

