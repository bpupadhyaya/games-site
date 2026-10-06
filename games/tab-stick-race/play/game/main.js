import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two fixed steps; it never reaches the simulation).
const clock = () => globalThis.performance.now();
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

// Arcforge pictures (optional: the game reads without them).
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({
  createGame: async (env) => {
    const game = await createGame({ ...env, clock });
    if (env.config.dev) window.__tab = game;
    // Mouse wheel / trackpad scrolls every text screen (touch drag and the arrow keys work too); the wheel distance is converted to
    // the game's virtual units.
    globalThis.addEventListener('wheel', (e) => {
      const k = canvas.clientWidth ? meta.width / canvas.clientWidth : 1;
      game.scrollBy(e.deltaY * (e.deltaMode === 1 ? 16 : 1) * k);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    return game;
  },
  meta, canvas, background: '#000',
});
