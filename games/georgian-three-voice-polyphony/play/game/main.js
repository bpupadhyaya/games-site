import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createChoirEngine } from './audio/engine.js';

const canvas = document.getElementById('game');
const engine = createChoirEngine();
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
// The kit's input has ONE pointer; a choir needs every finger (each finger is a voice). These listeners are registered first, so they
// see each pointer-down before the kit does: if the game used it (a finger on the ladder) the kit never sees that pointer, otherwise it
// falls through to the normal tap path (buttons).
const owned = new Set();
canvas.addEventListener('pointerdown', (e) => {
  engine.unlock();
  if (!game || (gate && gate.previewMsLeft <= 0)) return;
  const p = toVirtual(e.clientX, e.clientY);
  if (game.pdown(e.pointerId, p.x, p.y)) { owned.add(e.pointerId); e.stopImmediatePropagation(); e.preventDefault(); }
});
canvas.addEventListener('pointermove', (e) => {
  if (!owned.has(e.pointerId) || !game) return;
  const p = toVirtual(e.clientX, e.clientY);
  game.pmove(e.pointerId, p.x, p.y);
  e.stopImmediatePropagation(); e.preventDefault();
});
for (const ev of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(ev, (e) => { if (!owned.has(e.pointerId)) return; owned.delete(e.pointerId); if (game) game.pup(e.pointerId); e.stopImmediatePropagation(); e.preventDefault(); });
}
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => engine.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); else engine.unlock(); });

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'perform', piece: 2, parts: [false, true, true], advance: 13, play: true },
  3: { scene: 'play', mode: 'auto', piece: 1, advance: 9 },
  4: { scene: 'lab', advance: 3, play: true },
  5: { scene: 'about' },
  6: { scene: 'result' },
  7: { scene: 'songs' },
  8: { scene: 'rules', page: 5 },
};
const create = async (env) => {
  game = await createGame({ ...env, rhythm: engine });
  // Jumps wait a moment so the kit has fitted the view first (the layout depends on the live size).
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) setTimeout(() => game.dev.jump({ ...SHOT_SCENES[Number(q.get('seed'))], release: false }), 250);
  if (env.config.dev) {
    window.__voices = game; window.__voicesEngine = engine;
    window.__voicesCss = (vx, vy) => { const r = canvas.getBoundingClientRect(), scale = Math.min(canvas.width / meta.width, canvas.height / meta.height), k = r.width / canvas.width; return { x: r.left + (vx * scale + (canvas.width - meta.width * scale) / 2) * k, y: r.top + (vy * scale + (canvas.height - meta.height * scale) / 2) * k }; };
    window.__voicesNow = () => game.getState().pl && game.getState().pl.t;
    if (q.has('scene')) setTimeout(() => game.dev.jump({ scene: q.get('scene'), piece: Number(q.get('piece') ?? 0), mode: q.get('mode') ?? 'perform', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), scale: q.get('scale') ?? undefined, parts: q.has('parts') ? JSON.parse(q.get('parts')) : undefined, pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined, release: q.has('release') }), 250);
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter: the flat 2D art boots at once (first interactive title is the 2D art); once the browser is idle the presenter module is
// fetched and builds the lit scene in small slices, then crossfades in. With no WebGL, a failure or ?flat the 2D art simply stays.
let pres = null;
const late = (g) => {
  let wrapped = null;
  return Object.assign({}, g, {
    update(dt, input) { return (wrapped ?? g).update(dt, input); },
    render(ctx, view) { if (pres && !wrapped) wrapped = pres.wrap(g); return (wrapped ?? g).render(ctx, view); },
  });
};
const start3d = () => {
  if (q.has('flat')) return;
  import('./view3d/presenter.js').then((m) => { const p = m.createPresenter({ kitCanvas: canvas }); if (p.ok) pres = p; if (q.has('dev')) window.__p3 = p; })
    .catch((e) => console.warn('3D presenter unavailable; 2D art stays', e));
};
boot({ createGame: async (env) => late(await create(env)), meta, canvas, background: 'rgba(0,0,0,0)' }).then((b) => {
  gate = b.game;
  if (q.has('now3d')) start3d(); else (window.requestIdleCallback ? window.requestIdleCallback(start3d, { timeout: 900 }) : setTimeout(start3d, 300));
});
