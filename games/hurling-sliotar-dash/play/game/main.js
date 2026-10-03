import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps the HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D pitch.
const canvas = document.getElementById('game');
let presenter = null;
try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }

// Real-time play needs two fingers at once (stick + a button). The kit's input has one pointer, so the shell tracks every touch itself and hands
// the list to the game once per tick; each finger is bound by the game to the control it started on (see src/controls.js).
const clock = () => globalThis.performance.now();
const touches = new Map();
const toVirtual = (e) => {
  const r = canvas.getBoundingClientRect();
  const s = Math.min(r.width / meta.width, r.height / meta.height);
  return { x: (e.clientX - r.left - r.width / 2) / s + meta.width / 2, y: (e.clientY - r.top - r.height / 2) / s + meta.height / 2 };
};
canvas.addEventListener('pointerdown', (e) => { touches.set(e.pointerId, { id: e.pointerId, ...toVirtual(e), seen: false }); });
canvas.addEventListener('pointermove', (e) => { const t = touches.get(e.pointerId); if (t) Object.assign(t, toVirtual(e)); });
const lift = (e) => { const t = touches.get(e.pointerId); if (!t) return; if (t.seen) touches.delete(e.pointerId); else t.ending = true; };
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);
const snapshot = () => {
  const list = [];
  for (const [id, t] of touches) { list.push({ id: t.id, x: t.x, y: t.y }); t.seen = true; if (t.ending) touches.delete(id); }
  return list;
};

const wrap = (game) => {
  if (new URLSearchParams(location.search).has('dev')) window.__game = game;   // dev only: lets the test harness read the state
  const upd = game.update.bind(game);
  game.update = (dt, input) => { game.setTouches(snapshot()); upd(dt, input); };
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = new URLSearchParams(location.search).has('shot');
boot({ createGame: async (env) => wrap(await createGame({ ...env, clock, config: shot ? { ...env.config, shot: true } : env.config })), meta, canvas, background: 'rgba(0,0,0,0)' });
