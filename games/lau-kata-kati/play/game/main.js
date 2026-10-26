import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { createPresenter } from './view3d/presenter.js';
import { installResizeGuard } from './resizeguard.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const q0 = new URLSearchParams(location.search);
if (q0.has('dev') && q0.has('insets')) { const [t, r, b, l, back] = q0.get('insets').split(',').map(Number); window.__safeInsets = { top: t, right: r, bottom: b, left: l, back: !!back }; window.__hostBack = !!back; }   // dev: simulate a notch / the host back button
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px; host.dpr = Math.min(2, window.devicePixelRatio || 1);
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel scrolls the document screens (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev / screenshot hook: ?shot=1&scene=... (JSON in `spec`) puts the game in a given screen. Not reachable in production flows.
const q = new URLSearchParams(location.search);
const PRESETS = {
  1: { scene: 'title' }, 2: { scene: 'doc', doc: 'about' }, 3: { scene: 'play', plies: 10, sel: 13 }, 4: { scene: 'play', stones: { 14: 1, 12: 1, 13: 1, 15: 1, 17: 1, 18: 1, 11: 2, 2: 2, 3: 2, 4: 2, 6: 2, 7: 2, 8: 2, 9: 2 }, lost: [0, 3, 1], play: [14, 5], animT: 0.5 },
  5: { scene: 'doc', doc: 'rules', scroll: 900 }, 6: { scene: 'play', variant: 'forced', plies: 8, sel: 13, wood: 'madder' }, 7: { scene: 'auto', plies: 12 }, 8: { scene: 'lesson', lesson: 4 },
};
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__sg = game;
  if (!q.has('spec') && q.has('shot') && PRESETS[q.get('seed')]) game.devScene(PRESETS[q.get('seed')]);   // `arc shots`: seed N picks store shot N (store/shots.json)
  if (q.has('spec')) { try { game.devScene(JSON.parse(q.get('spec'))); } catch (e) { console.error(e); } }
  return game;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
let live = null, presenter = null;
const FLAT_BG = '#10050a';
const bg = { toString: () => (live ? 'rgba(0,0,0,0)' : FLAT_BG) };   // kit fills this every frame; read lazily so the switch is instant
const proxy = (g) => Object.assign({}, g, {
  update(dt, input) { return (live ?? g).update(dt, input); },
  render(ctx, view) { (live ?? g).render(ctx, view); },
  adopt(fade = true) { if (!live && presenter?.ok) { live = presenter.wrap(g); if (!fade) return; canvas.style.transition = 'none'; canvas.style.opacity = '0.2'; requestAnimationFrame(() => { canvas.style.transition = 'opacity 320ms ease-out'; canvas.style.opacity = '1'; }); } },
});
let gameProxy = null;
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
// Store-shot / scripted-scene runs need the 3D frame from the very first draw, so they wait for the presenter.
if (!q.has('flat') && (q.has('shot') || q.has('scene') || q.has('bare'))) { try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); } }
const guard = installResizeGuard({ canvas, win: window });   // re-dispatches resize when canvas pixels != CSS box x dpr (missed rotation)
boot({ createGame: async (env) => { gameProxy = proxy(await create(env)); if (presenter?.ok) gameProxy.adopt(false); return gameProxy; }, meta, canvas, background: bg }).then(() => guard.burst());
// Normal play: the game boots at once on the flat 2D art (styled interactive title in the first frame); the 3D scene builds in the
// background in small slices and takes over with a short fade. No WebGL / context lost: the flat art stays.
if (!q.has('flat') && !presenter) {
  createPresenter({ kitCanvas: canvas }).then((p) => { presenter = p; if (p.ok && gameProxy) gameProxy.adopt(); else if (p.ok) { const t = setInterval(() => { if (gameProxy) { clearInterval(t); gameProxy.adopt(); } }, 30); } })
    .catch((e) => console.warn('3D presenter unavailable', e));
}
