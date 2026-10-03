import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D field.
const canvas = document.getElementById('game');
const qs = new URLSearchParams(location.search);
let presenter = null;
try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }

// Multi-touch: the kit exposes one pointer, but steering and the stroke need two thumbs. This tracks every finger on the canvas (in the
// game's virtual 720x1280 coordinates) and hands the game a read-only snapshot function. Drawing/input only; the simulation never sees it.
const touches = new Map();
const virt = (e) => {
  const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280, r = canvas.getBoundingClientRect();
  const u = e.clientX - r.left, v = e.clientY - r.top, s = Math.min(W / 720, H / 1280);
  return { x: (u - W / 2) / s + 360, y: (v - H / 2) / s + 640 };
};
const onDown = (e) => { const p = virt(e); touches.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y, x0: p.x, y0: p.y, down: true, fresh: true, up: false }); };
const onMove = (e) => { const t = touches.get(e.pointerId); if (t) { const p = virt(e); t.x = p.x; t.y = p.y; } };
const onUp = (e) => { const t = touches.get(e.pointerId); if (t) { t.down = false; t.up = true; } };
canvas.addEventListener('pointerdown', onDown, true);
canvas.addEventListener('pointermove', onMove, true);
canvas.addEventListener('pointerup', onUp, true);
canvas.addEventListener('pointercancel', onUp, true);
window.addEventListener('blur', () => { for (const t of touches.values()) { t.down = false; t.up = true; } });
document.addEventListener('visibilitychange', () => { if (document.hidden) for (const t of touches.values()) { t.down = false; t.up = true; } });
// the game calls this once per tick: it returns the live fingers plus those that were released since the last call, then forgets the released ones
const touchSnapshot = () => {
  const out = [];
  for (const t of touches.values()) { out.push({ ...t }); t.fresh = false; }
  for (const [k, t] of touches) if (t.up) touches.delete(k);
  return out;
};

// mouse wheel / trackpad for the text readers (virtual pixels, read and cleared once per tick)
let wheelAcc = 0;
canvas.addEventListener('wheel', (e) => { const s = Math.min((canvas.clientWidth || 720) / 720, (canvas.clientHeight || 1280) / 1280); wheelAcc += e.deltaY * (e.deltaMode === 1 ? 32 : 1) / s; e.preventDefault(); }, { passive: false });
const takeWheel = () => { const v = wheelAcc; wheelAcc = 0; return v; };

const wrap = (game) => {
  if (qs.has('dev')) window.__game = game;
  if (presenter && presenter.stage) { window.__presenter = presenter; return presenter.wrap(game); }
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = qs.has('shot');
const clock = () => globalThis.performance.now();
boot({ createGame: async (env) => wrap(await createGame({ ...env, touches: touchSnapshot, wheel: takeWheel, clock, config: shot ? { ...env.config, shot: true, shotSeed: qs.get('seed') } : env.config })), meta, canvas, background: 'rgba(0,0,0,0)' });
