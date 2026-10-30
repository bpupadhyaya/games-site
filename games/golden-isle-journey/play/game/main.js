import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/frame.js';
import { setLogo, setLockup } from './src/brand.js';
import { installResizeGuard } from './resizeguard.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The game works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const cssToUnits = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const px = cssToUnits(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel scrolls the reading pages and the road (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * cssToUnits() * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the title reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game for the layout / resize check scripts.
// The lit 3D layer (0.3.0, view3d/presenter.js): the game boots on its painted backdrops; a few frames later the presenter
// is imported, and the real sky / sea / golden island fade in behind the transparent canvas. No WebGL2, ?flat=1 or a lost
// context: the painted backdrops simply stay (src/v3.js).
let presenter = null, game3d = null;
const create = async (env) => {
  const game = await createGame(env); if (env.config.dev) window.__gij = game;
  const render = game.render.bind(game);
  game.render = (ctx, view) => { render(ctx, view); if (presenter) presenter.frame(); };
  game3d = game;
  return game;
};
const want3d = !/[?&]flat=1/.test(location.search);
function load3d(n = 0) {
  if (n < 3) return requestAnimationFrame(() => load3d(n + 1));   // first painted frames before any 3D work
  import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas, getGame: () => game3d }))
    .then((p) => { presenter = p; if (p && new URLSearchParams(location.search).has('dev')) window.__gij3d = p; })
    .catch((e) => console.warn('3D layer skipped', e));
}

// Resize guard (0.2.6): see resizeguard.js. Re-checks every frame and on every viewport signal, and once the game has booted.
const guard = installResizeGuard({ canvas, win: window });
window.__gijCanvasStale = guard.stale;   // read-only probe for the layout check scripts

boot({ createGame: create, meta, canvas, background: '#0a0410' }).then(() => { guard.burst(); if (want3d) load3d(); });
