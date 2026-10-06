import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo } from './src/brand.js';
import { setLockup } from './src/menus.js';

// The 3D pitch (web/view3d) is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps the HUD, menus and input.
// If WebGL or the 3D files are unavailable the game keeps playing with its flat 2D pitch.
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
try {
  const { createPresenter } = await import('./view3d/presenter.js');
  presenter = await createPresenter({ kitCanvas: canvas });
} catch (e) { console.warn('3D pitch unavailable, using the 2D pitch', e); }

// Multi-touch hub: the kit hands the game ONE pointer, but football needs a stick and a button at the same time. Every pointer is tracked here
// with its own id; the game reads a snapshot (with press/release edges) once per tick. Drawing is not affected.
function createTouchHub(el) {
  const live = new Map();           // pointerId -> { id, x, y, down, pressed, released }
  const toVirtual = (cx, cy) => {
    // the kit's fluid mapping: meta.width x meta.height fills the canvas (bars only beyond the kit's maximum aspect)
    const r = el.getBoundingClientRect(); const s = Math.min(r.width / meta.width, r.height / meta.height) || 1;
    return { x: (cx - r.left - (r.width - meta.width * s) / 2) / s, y: (cy - r.top - (r.height - meta.height * s) / 2) / s };
  };
  const on = (type, f) => el.addEventListener(type, f, { passive: false });
  on('pointerdown', (e) => { const v = toVirtual(e.clientX, e.clientY); live.set(e.pointerId, { id: e.pointerId, x: v.x, y: v.y, down: true, pressed: true, released: false }); e.preventDefault(); });
  on('pointermove', (e) => { const t = live.get(e.pointerId); if (t) { const v = toVirtual(e.clientX, e.clientY); t.x = v.x; t.y = v.y; } });
  const up = (e) => { const t = live.get(e.pointerId); if (t) { const v = toVirtual(e.clientX, e.clientY); t.x = v.x; t.y = v.y; t.down = false; t.released = true; } };
  on('pointerup', up); on('pointercancel', up);
  const releaseAll = () => { for (const t of live.values()) { t.down = false; t.released = true; } };
  globalThis.addEventListener('blur', releaseAll);
  globalThis.addEventListener('resize', releaseAll); globalThis.addEventListener('orientationchange', releaseAll);
  let wheel = 0;
  on('wheel', (e) => { wheel += e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 600 : 1); e.preventDefault(); });
  return {
    releaseAll,
    takeWheel() { const w = wheel; wheel = 0; return w; },
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
  if (new URLSearchParams(location.search).has('dev')) { window.__game = game; window.__presenter = presenter; }      // dev only: lets the test harness read the state
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
