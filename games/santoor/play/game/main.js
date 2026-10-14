import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host, layoutFor } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';
import { createSantoorEngine } from './audio/engine.js';
import { v3 } from './src/v3.js';
import { paintRoom } from './src/art.js';

const canvas = document.getElementById('game');
const engine = createSantoorEngine();
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
// The kit's input has ONE pointer; a two-mallet instrument needs every finger (two hands strike while a third holds a roll). These listeners are
// registered first, so they see each pointer-down before the kit does: if the game used it (a touch on the board) the kit never
// sees that pointer, otherwise it falls through to the normal tap path (buttons).
const owned = new Set();
canvas.addEventListener('pointerdown', (e) => {
  engine.unlock();
  if (!game || (gate && gate.previewMsLeft <= 0)) return;
  const p = toVirtual(e.clientX, e.clientY);
  if (game.pdown(e.pointerId, p.x, p.y, engine.eventAudioTime(e))) { owned.add(e.pointerId); e.stopImmediatePropagation(); e.preventDefault(); }
});
canvas.addEventListener('pointermove', (e) => {
  if (!owned.has(e.pointerId) || !game) return;
  const p = toVirtual(e.clientX, e.clientY);
  game.pmove(e.pointerId, p.x, p.y, engine.eventAudioTime(e));
  e.stopImmediatePropagation(); e.preventDefault();
});
for (const ev of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(ev, (e) => { if (!owned.has(e.pointerId)) return; owned.delete(e.pointerId); if (game) game.pup(e.pointerId); e.stopImmediatePropagation(); e.preventDefault(); });
}
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => engine.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); });

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = { 1: { scene: 'title' }, 2: { scene: 'play', mode: 'perform', piece: 3, advance: 17, play: true }, 3: { scene: 'play', mode: 'learn', piece: 0, advance: 7 }, 4: { scene: 'free', strike: [4, 7, 9, 12] }, 5: { scene: 'about' }, 6: { scene: 'result' }, 7: { scene: 'piece', piece: 4 }, 8: { scene: 'rules', page: 1 } };
const create = async (env) => {
  game = await createGame({ ...env, rhythm: engine });
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__santoor = game; window.__santoorEngine = engine;
    window.__santoorCss = (vx, vy) => { const r = canvas.getBoundingClientRect(), scale = Math.min(canvas.width / meta.width, canvas.height / meta.height), k = r.width / canvas.width; return { x: r.left + (vx * scale + (canvas.width - meta.width * scale) / 2) * k, y: r.top + (vy * scale + (canvas.height - meta.height * scale) / 2) * k }; };
    window.__santoorPt = (scene, n) => layoutFor(meta.width, meta.height)[scene].inst.pt(n);
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), piece: Number(q.get('piece') ?? 0), mode: q.get('mode') ?? 'perform', page: Number(q.get('page') ?? 0), strike: q.has('strike') ? JSON.parse(q.get('strike')) : undefined, advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), scale: q.get('scale') ?? undefined, pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a WebGL canvas behind the kit canvas). The flat 2D title boots and is interactive FIRST; the scene is built afterwards in
// slices and cross-faded in. With no WebGL, or if the context is lost, every screen keeps drawing the flat 2D art.
let presenter = null;
const wrapGame = (g) => Object.assign({}, g, {
  update(dt, input) { const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null; return g.update(dt, input); },
  render(ctx, view) {
    if (!v3.on || !presenter) { g.render(ctx, view); return; }
    v3.reset();
    v3.base = ctx.getTransform();
    ctx.clearRect(-8, -8, view.width + 16, view.height + 16);      // the kit's transparent background fill does not clear
    g.render(ctx, view);
    try { presenter.present(view); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
  },
});
async function startPresenter() {
  if (q.has('flat')) return;
  try {
    const p = await createPresenter({ kitCanvas: canvas });
    if (!p.ok) return;
    presenter = p;
    try { const rs = document.createElement('canvas'); rs.width = Math.round(meta.width / 2); rs.height = Math.round(meta.height / 2); const rg = rs.getContext('2d'); rg.scale(0.5, 0.5); paintRoom(rg, meta.width, meta.height); document.documentElement.style.background = `#0a1519 url(${rs.toDataURL('image/jpeg', 0.7)}) center / cover`; } catch { /* plain fade */ }
    p.activate();
    setTimeout(() => { document.documentElement.style.background = ''; }, 1000);
    if (q.has('dev')) { window.__p3 = p; }
  } catch (e) { console.warn('3D presenter unavailable', e); }
}
if (q.has('dev')) window.__v3 = v3;
const bgObj = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#0a1519') };
if (q.has('shot')) await startPresenter();                       // store screenshots want the 3D scene in the first frame
boot({ createGame: async (env) => wrapGame(await create(env)), meta, canvas, background: bgObj }).then((b) => { gate = b.game; });
if (!q.has('shot')) setTimeout(startPresenter, 0);
