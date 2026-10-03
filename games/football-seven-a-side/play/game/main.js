import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The 3D pitch (web/view3d) is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps the HUD, menus and input.
// If WebGL or the 3D files are unavailable the game keeps playing with its flat 2D pitch.
const canvas = document.getElementById('game');
let presenter = null;
try {
  const { createPresenter } = await import('./view3d/presenter.js');
  presenter = await createPresenter({ kitCanvas: canvas });
} catch (e) { console.warn('3D pitch unavailable, using the 2D pitch', e); }

// Multi-touch hub: the kit hands the game ONE pointer, but football needs a stick and a button at the same time. Every pointer is tracked here
// with its own id; the game reads a snapshot (with press/release edges) once per tick. Drawing is not affected.
function createTouchHub(el) {
  const live = new Map();           // pointerId -> { id, x, y, down, pressed, released }
  const toVirtual = (cx, cy) => {
    const r = el.getBoundingClientRect(); const s = Math.min(r.width / meta.width, r.height / meta.height);
    return { x: (cx - r.left - r.width / 2) / s + meta.width / 2, y: (cy - r.top - r.height / 2) / s + meta.height / 2 };
  };
  const on = (type, f) => el.addEventListener(type, f, { passive: false });
  on('pointerdown', (e) => { const v = toVirtual(e.clientX, e.clientY); live.set(e.pointerId, { id: e.pointerId, x: v.x, y: v.y, down: true, pressed: true, released: false }); e.preventDefault(); });
  on('pointermove', (e) => { const t = live.get(e.pointerId); if (t) { const v = toVirtual(e.clientX, e.clientY); t.x = v.x; t.y = v.y; } });
  const up = (e) => { const t = live.get(e.pointerId); if (t) { const v = toVirtual(e.clientX, e.clientY); t.x = v.x; t.y = v.y; t.down = false; t.released = true; } };
  on('pointerup', up); on('pointercancel', up);
  globalThis.addEventListener('blur', () => { for (const t of live.values()) { t.down = false; t.released = true; } });
  return {
    snapshot() {
      const out = [];
      for (const [id, t] of [...live]) {
        out.push({ id: t.id, x: t.x, y: t.y, down: t.down, pressed: t.pressed, released: t.released });
        t.pressed = false;
        if (t.released) live.delete(id);
      }
      return out;
    },
  };
}
const hub = createTouchHub(canvas);

const wrap = (game) => {
  if (new URLSearchParams(location.search).has('dev')) window.__game = game;      // dev only: lets the test harness read the state
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = new URLSearchParams(location.search).has('shot');
boot({
  createGame: async (env) => {
    const raw = await createGame({ ...env, touches: hub, config: shot ? { ...env.config, shot: true } : env.config });
    // leaving the app mid-match opens the pause menu, so coming back never drops you into a live ball
    document.addEventListener('visibilitychange', () => { if (document.hidden) raw.autoPause?.(); });
    return wrap(raw);
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
});
