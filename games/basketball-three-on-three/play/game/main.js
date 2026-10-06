import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';
import { host } from './src/layout.js';
import { setLogo } from './src/brand.js';
import { setLockup } from './src/menus.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D court.
const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in
// virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros. host.px = css px per virtual unit.
const syncHost = () => {
  const short = Math.max(1, Math.min(window.innerWidth, window.innerHeight)), px = 720 / short, s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// The Arcforge badge and the themed lockup: optional, everything still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

let presenter = null;
try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }

// The kit has one pointer. The thumb controls need two fingers (stick + buttons), so this shell tracks every finger itself and hands the
// game a `touches` list; extra fingers are hidden from the kit so a stray second finger can never corrupt a menu tap.
const tracker = (() => {
  const live = new Map();          // pointerId -> touch
  let primary = null;
  // css pixels -> virtual units, the same mapping the kit uses (the fluid viewport: meta.width x meta.height fills the canvas)
  const toV = (e) => {
    const r = canvas.getBoundingClientRect(), s = Math.min(r.width / meta.width, r.height / meta.height) || 1;
    return { x: (e.clientX - r.left - (r.width - meta.width * s) / 2) / s, y: (e.clientY - r.top - (r.height - meta.height * s) / 2) / s };
  };
  const onTarget = (e) => e.target === canvas;
  const on = (type, fn) => globalThis.addEventListener(type, fn, { capture: true, passive: false });
  on('pointerdown', (e) => {
    if (!onTarget(e)) return;
    const v = toV(e);
    live.set(e.pointerId, { id: e.pointerId, x: v.x, y: v.y, pressed: true, down: true, released: false, t0: performance.now() });
    if (primary === null) primary = e.pointerId; else e.stopImmediatePropagation();
    e.preventDefault();
  });
  on('pointermove', (e) => {
    const t = live.get(e.pointerId); if (!t) return;
    const v = toV(e); t.x = v.x; t.y = v.y;
    if (e.pointerId !== primary) e.stopImmediatePropagation();
  });
  const up = (e) => {
    const t = live.get(e.pointerId); if (!t) return;
    const v = toV(e); t.x = v.x; t.y = v.y; t.down = false; t.released = true;
    if (e.pointerId !== primary) e.stopImmediatePropagation(); else primary = null;
  };
  on('pointerup', up); on('pointercancel', up);
  globalThis.addEventListener('blur', () => { for (const t of live.values()) { t.down = false; t.released = true; } primary = null; });
  // a rotation / resize releases every finger cleanly: their coordinates no longer mean the same place on the new layout
  const releaseAll = () => { for (const t of live.values()) { t.down = false; t.released = true; } primary = null; };
  globalThis.addEventListener('resize', releaseAll); globalThis.addEventListener('orientationchange', releaseAll);
  let wheel = 0;
  on('wheel', (e) => { if (!onTarget(e)) return; const r = canvas.getBoundingClientRect(), sc = Math.min(r.width / meta.width, r.height / meta.height) || 1; wheel += (e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 600 : 1)) / sc; e.preventDefault(); });
  return {
    takeWheel() { const w = wheel; wheel = 0; return w; },
    snapshot() { const now = performance.now(); return [...live.values()].map((t) => ({ ...t, pressed: t.pressed && now - t.t0 < 150 })); },
    afterUpdate() { for (const [id, t] of live) { t.pressed = false; if (t.released) live.delete(id); } },
  };
})();

const wrap = (game) => {
  const upd = game.update.bind(game);
  game.update = (dt, input) => {
    // kit >= 1.8.1 makes input.wheel a read-only { dx, dy } getter: hand the game a view of the input with our own touches and wheel instead of assigning onto it
    const w = tracker.takeWheel(), kw = input.wheel, dy = w || (kw && kw.dy) || 0;
    upd(dt, Object.create(input, { touches: { value: tracker.snapshot() }, wheel: { value: { dx: 0, dy } } }));
    tracker.afterUpdate();
  };
  if (new URLSearchParams(location.search).has('dev')) { window.__game = game; window.__presenter = presenter; }   // dev only: lets the test harness read the state
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = new URLSearchParams(location.search).has('shot');
const shotRole = Number(new URLSearchParams(location.search).get('role') ?? 0) | 0;
boot({ createGame: async (env) => wrap(await createGame(shot ? { ...env, config: { ...env.config, shot: true, shotRole } } : env)), meta, canvas, background: 'rgba(0,0,0,0)' });
