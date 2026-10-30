import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two fixed physics steps; it never reaches the simulation).
const clock = () => globalThis.performance.now();

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

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the text credit still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Mouse wheel / trackpad scrolls menus and the Rules reader (CSS px -> virtual units).
document.getElementById('game').addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// The lit 3D ice (view3d/presenter.js) sits behind the transparent kit canvas. The kit boots at once on the baked 2D sheet; the 3D layer
// is imported and built only after the first frames, then takes over the play screen. No WebGL, a failed import or a lost context keeps
// (or restores) the baked 2D sheet. Menus and pages are always the 2D canvas, so they paint their own opaque background.
let presenter = null, theGame = null;
const canvas = document.getElementById('game');
const start3d = () => {
  import('./view3d/presenter.js')
    .then((m) => m.createPresenter({ kitCanvas: canvas }))
    .then((p) => { if (p && p.ok) presenter = p; })
    .catch((e) => console.warn('3D ice unavailable; 2D sheet kept', e));
};
boot({
  createGame: async (env) => {
    const game = createGame({ ...env, clock });
    theGame = game;
    if (env.config.dev) window.__curling = game;
    if (env.config.dev) Object.defineProperty(window, '__p3', { get: () => presenter });
    return Object.assign({}, game, {
      render(ctx, view) {
        const st = game.getState();
        if (st.scene !== 'play') { ctx.fillStyle = '#08121f'; ctx.fillRect(0, 0, view?.width ?? 4000, view?.height ?? 4000); }
        game.render(ctx, view);
        if (presenter) presenter.frame(game.getState());
      },
    });
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
}).then(() => { const go = () => setTimeout(start3d, 350); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 900 }); else go(); });
void theGame;
