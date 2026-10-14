import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createTrioEngine } from './audio/engine.js';
import { createPresenter } from './view3d/presenter.js';
import { v3 } from './src/v3.js';

const canvas = document.getElementById('game');
const engine = createTrioEngine();
let game = null, gate = null;

// Host safe areas (notch, home indicator) and the floating back button, converted to virtual units (short side = 720).
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// Client coordinates -> virtual units (the same mapping the kit's fluid view uses).
const toVirtual = (cx, cy) => {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: -1, y: -1 };
  const k = canvas.width / rect.width, px = (cx - rect.left) * k, py = (cy - rect.top) * k;
  const scale = Math.min(canvas.width / meta.width, canvas.height / meta.height);
  return { x: (px - (canvas.width - meta.width * scale) / 2) / scale, y: (py - (canvas.height - meta.height * scale) / 2) / scale };
};
// The kit's input has ONE pointer; an ensemble game needs every finger (a thumb on the bellows while another plays a button). These
// listeners are registered first, so each pointer event reaches the game before the kit: if the game used it the kit never sees it,
// otherwise it falls through to the normal tap path (menus, pause, hint).
const used = new Set();
canvas.addEventListener('pointerdown', (e) => {
  engine.unlock();
  if (!game || (gate && gate.previewMsLeft <= 0)) return;
  const p = toVirtual(e.clientX, e.clientY);
  if (game.pointer('down', e.pointerId, p.x, p.y, engine.eventAudioTime(e))) { used.add(e.pointerId); canvas.setPointerCapture?.(e.pointerId); e.stopImmediatePropagation(); e.preventDefault(); }
});
canvas.addEventListener('pointermove', (e) => {
  if (!game || !used.has(e.pointerId)) return;
  const p = toVirtual(e.clientX, e.clientY);
  game.pointer('move', e.pointerId, p.x, p.y, engine.eventAudioTime(e));
  e.stopImmediatePropagation();
});
const release = (e) => {
  if (!game || !used.has(e.pointerId)) return;
  used.delete(e.pointerId);
  const p = toVirtual(e.clientX, e.clientY);
  game.pointer('up', e.pointerId, p.x, p.y, engine.eventAudioTime(e));
  e.stopImmediatePropagation();
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => engine.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); });

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'take', seat: 'acc', piece: 1, advance: 14, play: true },
  3: { scene: 'play', mode: 'take', seat: 'caja', piece: 0, advance: 10, play: true },
  4: { scene: 'play', mode: 'live', piece: 4, advance: 16, play: true },
  5: { scene: 'about' },
  6: { scene: 'result', mode: 'take', seat: 'acc', piece: 0 },
  7: { scene: 'piece', piece: 3 },
  8: { scene: 'rules', page: 1 },
  9: { scene: 'play', mode: 'auto', piece: 2, advance: 11 },
};
const create = async (env) => {
  game = await createGame({ ...env, rhythm: engine });
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__vt = game; window.__vtEngine = engine;
    window.__vtCss = (vx, vy) => { const r = canvas.getBoundingClientRect(), scale = Math.min(canvas.width / meta.width, canvas.height / meta.height), k = r.width / canvas.width; return { x: r.left + (vx * scale + (canvas.width - meta.width * scale) / 2) * k, y: r.top + (vy * scale + (canvas.height - meta.height * scale) / 2) * k }; };
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), piece: Number(q.get('piece') ?? 0), mode: q.get('mode') ?? 'take', seat: q.get('seat') ?? 'acc', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), hint: q.has('hint'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// 3D presenter: the flat 2D art is interactive immediately; the WebGL scene is built in slices afterwards and crossfaded in.
// No WebGL / a lost context -> every screen keeps drawing with the 2D art.
let presenter = null;
const wrapped = (g) => ({
  ...g,
  update(dt, input) { const p = input?.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null; return g.update(dt, input); },
  render(ctx, view) { if (presenter && v3.on) presenter.render(g, ctx, view); else g.render(ctx, view); },
});
boot({ createGame: async (env) => wrapped(await create(env)), meta, canvas, background: 'rgba(0,0,0,0)' }).then((b) => { gate = b.game; });
if (!q.has('flat')) {
  const start = async () => {
    try {
      const p = await createPresenter({ kitCanvas: canvas });
      if (p.ok) { presenter = p; if (q.has('dev')) window.__p3 = p; }
    } catch (e) { console.warn('3D presenter unavailable', e); v3.on = false; }
  };
  setTimeout(start, 60);
}
