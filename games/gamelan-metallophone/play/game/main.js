import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createInstrumentEngine } from './audio/engine.js';
import { v3 } from './src/v3.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
const engine = createInstrumentEngine();
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
// The kit's input has ONE pointer; a rhythm game needs every finger. This listener is registered first, so it sees each pointer-down
// before the kit does: if the game used it (a strike) the kit never sees it, otherwise it falls through to the normal tap path.
canvas.addEventListener('pointerdown', (e) => {
  engine.unlock();
  if (!game || (gate && gate.previewMsLeft <= 0)) return;
  const p = toVirtual(e.clientX, e.clientY);
  if (game.touch(p.x, p.y, engine.eventAudioTime(e))) { e.stopImmediatePropagation(); e.preventDefault(); }
});
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => engine.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); });

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = { 1: { scene: 'title' }, 2: { scene: 'play', mode: 'perform', piece: 2, advance: 22, play: true }, 3: { scene: 'play', mode: 'learn', piece: 1, advance: 9, play: true }, 4: { scene: 'free' }, 5: { scene: 'about' }, 6: { scene: 'result' }, 7: { scene: 'piece', piece: 4 }, 8: { scene: 'rules', page: 1 }, 9: { scene: 'play', mode: 'auto', piece: 0, advance: 17 } };
const create = async (env) => {
  game = await createGame({ ...env, rhythm: engine });
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__gm = game; window.__gmEngine = engine;
    window.__gmCss = (vx, vy) => { const r = canvas.getBoundingClientRect(), scale = Math.min(canvas.width / meta.width, canvas.height / meta.height), k = r.width / canvas.width; return { x: r.left + (vx * scale + (canvas.width - meta.width * scale) / 2) * k, y: r.top + (vy * scale + (canvas.height - meta.height * scale) / 2) * k }; };
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), piece: Number(q.get('piece') ?? 0), mode: q.get('mode') ?? 'perform', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// 3D presenter (a gendèr-style metallophone and the gongs in a lamp-lit pendopo, behind the kit canvas). The game boots at once on the
// flat 2D art; three.js is fetched and the scene built in small slices after the first frames, then crossfades in. No WebGL, ?flat=1
// or a lost context: the flat art stays. The presenter only reads game state.
let presenter = null, inner = null;
const FLAT_BG = '#120807';
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : FLAT_BG) };       // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    if (v3.on && presenter) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
      presenter.pre();
    }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg }).then((b) => { gate = b.game; });
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); window.__v3At = performance.now(); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  ABOUT.push({ h: '3D graphics credits' }, ...md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => ({ p: t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '') })));
}).catch(() => {});
