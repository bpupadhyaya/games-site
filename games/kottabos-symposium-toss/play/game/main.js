import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__gs = game; return game; };

// The Arcforge brand pictures (see src/brand.js): optional, the game looks right without them.
const load = (src, fn) => { const i = new Image(); i.onload = () => fn(i); i.src = src; };
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const q = new URLSearchParams(location.search);
let live = null, presenter = null;
const FLAT_BG = '#15100d';
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
boot({ createGame: async (env) => { gameProxy = proxy(await create(env)); if (presenter?.ok) gameProxy.adopt(false); return gameProxy; }, meta, canvas, background: bg });
// Normal play: the game boots at once on the flat 2D art (styled interactive title in the first frame); the 3D scene builds in the
// background in small slices and takes over with a short fade. No WebGL / context lost: the flat art stays.
if (!q.has('flat') && !presenter) {
  createPresenter({ kitCanvas: canvas }).then((p) => { presenter = p; if (p.ok && gameProxy) gameProxy.adopt(); else if (p.ok) { const t = setInterval(() => { if (gameProxy) { clearInterval(t); gameProxy.adopt(); } }, 30); } })
    .catch((e) => console.warn('3D presenter unavailable', e));
}
