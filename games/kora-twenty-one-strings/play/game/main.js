import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createStringEngine } from './audio/engine.js';

const canvas = document.getElementById('game');
const engine = createStringEngine();
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
// The kit's input has ONE pointer; a string instrument needs every finger. This listener is registered first, so it sees each pointer-down
// before the kit does: if the game used it (a pluck) the kit never sees it, otherwise it falls through to the normal tap path.
canvas.addEventListener('pointerdown', (e) => {
  engine.unlock();
  if (!game || (gate && gate.previewMsLeft <= 0)) return;
  const p = toVirtual(e.clientX, e.clientY);
  if (game.touch(p.x, p.y, engine.eventAudioTime(e), e.pointerId)) { e.stopImmediatePropagation(); e.preventDefault(); }
});
// Free play: sliding a finger across the strings plucks each one it crosses.
canvas.addEventListener('pointermove', (e) => {
  if (!game || !e.buttons && e.pointerType === 'mouse') return;
  const p = toVirtual(e.clientX, e.clientY);
  game.drag(p.x, p.y, engine.eventAudioTime(e), e.pointerId);
});
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, (e) => { if (game) game.release(e.pointerId); }, true);
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => engine.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); });

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = { 1: { scene: 'title' }, 2: { scene: 'play', mode: 'perform', piece: 5, advance: 22, play: true }, 3: { scene: 'play', mode: 'auto', piece: 5, advance: 14 }, 4: { scene: 'free', advance: 6, play: true }, 5: { scene: 'about' }, 6: { scene: 'result' }, 7: { scene: 'piece', piece: 4 }, 8: { scene: 'rules', page: 2 }, 9: { scene: 'play', mode: 'learn', piece: 1, advance: 9, play: true } };
const create = async (env) => {
  game = await createGame({ ...env, rhythm: engine });
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__kora = game; window.__koraEngine = engine;
    window.__koraCss = (vx, vy) => { const r = canvas.getBoundingClientRect(), scale = Math.min(canvas.width / meta.width, canvas.height / meta.height), k = r.width / canvas.width; return { x: r.left + (vx * scale + (canvas.width - meta.width * scale) / 2) * k, y: r.top + (vy * scale + (canvas.height - meta.height * scale) / 2) * k }; };
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), piece: Number(q.get('piece') ?? 0), mode: q.get('mode') ?? 'perform', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#120c20' }).then((b) => { gate = b.game; });
