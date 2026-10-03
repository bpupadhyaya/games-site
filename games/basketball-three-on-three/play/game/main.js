import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D court.
const canvas = document.getElementById('game');
let presenter = null;
try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }

// The kit has one pointer. The thumb controls need two fingers (stick + buttons), so this shell tracks every finger itself and hands the
// game a `touches` list; extra fingers are hidden from the kit so a stray second finger can never corrupt a menu tap.
const tracker = (() => {
  const live = new Map();          // pointerId -> touch
  let primary = null;
  const toV = (e) => {
    const r = canvas.getBoundingClientRect(), s = Math.min(r.width / 720, r.height / 1280);
    return { x: (e.clientX - r.left - r.width / 2) / s + 360, y: (e.clientY - r.top - r.height / 2) / s + 640 };
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
  let wheel = 0;
  on('wheel', (e) => { if (!onTarget(e)) return; const r = canvas.getBoundingClientRect(), sc = Math.min(r.width / 720, r.height / 1280); wheel += (e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 600 : 1)) / sc; e.preventDefault(); });
  return {
    takeWheel() { const w = wheel; wheel = 0; return w; },
    snapshot() { const now = performance.now(); return [...live.values()].map((t) => ({ ...t, pressed: t.pressed && now - t.t0 < 150 })); },
    afterUpdate() { for (const [id, t] of live) { t.pressed = false; if (t.released) live.delete(id); } },
  };
})();

const wrap = (game) => {
  const upd = game.update.bind(game);
  game.update = (dt, input) => { input.touches = tracker.snapshot(); input.wheel = tracker.takeWheel(); upd(dt, input); tracker.afterUpdate(); };
  if (new URLSearchParams(location.search).has('dev')) window.__game = game;   // dev only: lets the test harness read the state
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = new URLSearchParams(location.search).has('shot');
const shotRole = Number(new URLSearchParams(location.search).get('role') ?? 0) | 0;
boot({ createGame: async (env) => wrap(await createGame(shot ? { ...env, config: { ...env.config, shot: true, shotRole } } : env)), meta, canvas, background: 'rgba(0,0,0,0)' });
