import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The 3D pitch is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D pitch.
const canvas = document.getElementById('game');
const q = new URLSearchParams(location.search);
// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px (browsers: none).
// The layout works in virtual units (short side = 720), so convert with the current scale.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
let presenter = null;
try { const { createPresenter } = await import('./view3d/presenter.js'); presenter = await createPresenter({ kitCanvas: canvas, meta }); } catch (e) { console.warn('3D presenter unavailable', e); }

// Multi-touch: the kit hands the game one pointer; a running player needs a stick AND a button at the same time, so the shell also
// tracks every finger by id and gives the game one snapshot per fixed step (drawing and input only: nothing here reaches the simulation clock).
function createTouchPad(el) {
  const touches = new Map(), queue = [];
  const toV = (e) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { x: -1, y: -1 };
    const vw = meta.width || 720, vh = meta.height || 1280, s = Math.min(r.width / vw, r.height / vh);       // the kit's fluid virtual screen (live)
    return { x: (e.clientX - r.left - r.width / 2) / s + vw / 2, y: (e.clientY - r.top - r.height / 2) / s + vh / 2 };
  };
  const push = (type, e) => queue.push({ type, id: e.pointerId, ...toV(e), at: performance.now() });
  el.addEventListener('pointerdown', (e) => push('down', e));
  el.addEventListener('pointermove', (e) => { if (touches.has(e.pointerId) || queue.some((q2) => q2.id === e.pointerId)) push('move', e); });
  const up = (e) => push('up', e);
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  window.addEventListener('blur', () => { for (const id of touches.keys()) queue.push({ type: 'up', id, x: -1, y: -1, at: performance.now() }); });
  return {
    // rotation / resize: every held finger belongs to the old layout, so release them all (the next touch starts fresh)
    reset() { queue.length = 0; for (const t of touches.values()) { t.down = false; t.released = true; t.gone = true; } },
    snapshot() {
      const now = performance.now();
      for (const t of touches.values()) { t.pressed = false; t.released = false; }
      for (const ev of queue.splice(0)) {
        const fresh = now - ev.at < 160;
        if (ev.type === 'down') { const old = touches.get(ev.id); touches.set(ev.id, { id: ev.id, x: ev.x, y: ev.y, down: true, pressed: fresh, released: false, gone: false }); void old; }
        else if (ev.type === 'move') { const t = touches.get(ev.id); if (t) { t.x = ev.x; t.y = ev.y; } }
        else { const t = touches.get(ev.id); if (t) { t.x = ev.x >= 0 ? ev.x : t.x; t.y = ev.y >= 0 ? ev.y : t.y; t.down = false; t.released = true; t.gone = true; } }
      }
      const out = [...touches.values()].map((t) => ({ ...t }));
      for (const [id, t] of [...touches]) if (t.gone) touches.delete(id);
      return out;
    },
  };
}
const touchpad = createTouchPad(canvas);
// Mouse wheel / trackpad scroll for the long text pages (virtual units; consumed by the game once per frame)
const wheel = (() => {
  let acc = 0;
  canvas.addEventListener('wheel', (e) => { const r = canvas.getBoundingClientRect(); const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? r.height : 1; acc += e.deltaY * k * (720 / Math.max(1, Math.min(r.width, r.height))); acc = Math.max(-4000, Math.min(4000, acc)); e.preventDefault(); }, { passive: false });
  return { take() { const v = acc; acc = 0; return v; } };
})();

const wrap = (game) => {
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.autoPause?.(); });
  if (q.has('dev')) { window.__game = game; window.__presenter = presenter; }   // dev only: lets the test harness read the state
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = q.has('shot');
boot({ createGame: async (env) => wrap(await createGame({ ...env, touchpad: shot ? null : touchpad, wheel, config: shot ? { ...env.config, shot: true } : env.config })), meta, canvas, background: 'rgba(0,0,0,0)' });
