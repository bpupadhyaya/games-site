import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setMeasureCtx } from './src/menus.js';
import * as MN from './src/menus.js';
import { setLogo, setLockup } from './src/brand.js';
const createPresenter = (o) => import('./view3d/presenter.js').then((m) => m.createPresenter(o));   // 3D modules load on demand, off the title's critical path

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D field.
const canvas = document.getElementById('game');
const qs = new URLSearchParams(location.search);
let presenter = null;
// Store-shot / scripted-scene runs wait for the 3D layer before the first frame. Normal play boots at once on the flat 2D art; the 3D presenter
// loads in the background (its modules are a dynamic import) and takes over (adopt) the moment it is created.
const SYNC3D = /[?&](shot|scene|bare)\b/.test(location.search), NOGL = /[?&]nogl\b/.test(location.search);
let lateGame = null;
const lateWrap = (g, flatRender) => {
  const flat = flatRender ? Object.assign({}, g, { render: flatRender }) : g;
  let inner = null;
  lateGame = Object.assign({}, flat, { update(dt, i) { return (inner ?? flat).update(dt, i); }, render(c, v) { (inner ?? flat).render(c, v); }, adopt() { if (!inner && presenter && presenter.stage) inner = presenter.wrap(g); } });
  return lateGame;
};
const lateBg = (flat) => ({ toString: () => (presenter && presenter.stage && presenter.ready ? 'rgba(0,0,0,0)' : flat) });
const startLate3d = () => {
  createPresenter({ kitCanvas: canvas }).then((p) => {
    if (!p || !p.stage) return;
    presenter = p; if (/[?&]dev\b/.test(location.search)) window.__presenter = p;
    if (lateGame) lateGame.adopt();
  }).catch((e) => console.warn('3D presenter unavailable', e));
};
if (SYNC3D && !NOGL) { try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); } }

// Multi-touch: the kit exposes one pointer, but steering and the stroke need two thumbs. This tracks every finger on the canvas (in the
// game's virtual 720x1280 coordinates) and hands the game a read-only snapshot function. Drawing/input only; the simulation never sees it.
const touches = new Map();
// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in
// virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
try { setMeasureCtx(document.createElement('canvas').getContext('2d')); } catch { /* estimate */ }
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// css px on the canvas to the live virtual units of the fluid viewport (one scale for both axes, centred; meta.width/height are kept live by the kit)
const scaleNow = () => Math.min((canvas.clientWidth || 720) / meta.width, (canvas.clientHeight || 1280) / meta.height);
const virt = (e) => {
  const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280, r = canvas.getBoundingClientRect();
  const u = e.clientX - r.left, v = e.clientY - r.top, s = scaleNow();
  return { x: (u - W / 2) / s + meta.width / 2, y: (v - H / 2) / s + meta.height / 2 };
};
const onDown = (e) => { const p = virt(e); touches.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y, x0: p.x, y0: p.y, down: true, fresh: true, up: false }); };
const onMove = (e) => { const t = touches.get(e.pointerId); if (t) { const p = virt(e); t.x = p.x; t.y = p.y; } };
const onUp = (e) => { const t = touches.get(e.pointerId); if (t) { t.down = false; t.up = true; } };
canvas.addEventListener('pointerdown', onDown, true);
canvas.addEventListener('pointermove', onMove, true);
canvas.addEventListener('pointerup', onUp, true);
canvas.addEventListener('pointercancel', onUp, true);
const releaseAll = () => { for (const t of touches.values()) { t.down = false; t.up = true; } };
window.addEventListener('blur', releaseAll);
// a rotation or resize cleanly releases every held finger (the new layout puts the controls somewhere else)
window.addEventListener('resize', releaseAll);
window.addEventListener('orientationchange', releaseAll);
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
canvas.addEventListener('wheel', (e) => { wheelAcc += e.deltaY * (e.deltaMode === 1 ? 32 : 1) / scaleNow(); e.preventDefault(); }, { passive: false });
const takeWheel = () => { const v = wheelAcc; wheelAcc = 0; return v; };

const wrap = (game) => {
  if (qs.has('dev')) { window.__game = game; window.__MN = MN; }
  if (presenter && presenter.stage) { window.__presenter = presenter; return presenter.wrap(game); }
  const r = game.render.bind(game);
  return lateWrap(game, (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); });
};
const shot = qs.has('shot');
const clock = () => globalThis.performance.now();
// the Arcforge badge and the themed lockup (src/brand.js): optional, the title still reads without them
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
boot({ createGame: async (env) => wrap(await createGame({ ...env, touches: touchSnapshot, wheel: takeWheel, clock, config: { ...env.config, dev: env.config.dev || qs.has('dev'), ...(shot ? { shot: true, shotSeed: qs.get('seed') } : {}) } })), meta, canvas, background: lateBg('#000') });
if (!SYNC3D && !NOGL && !presenter) startLate3d();
