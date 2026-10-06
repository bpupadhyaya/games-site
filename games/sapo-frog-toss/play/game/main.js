import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two fixed physics steps; it never reaches the simulation).
const clock = () => globalThis.performance.now();
// Mouse wheel for the scrolling text screens: the page only collects the distance; the game reads and clears it.
const wheel = { dy: 0 };
window.addEventListener('wheel', (e) => { e.preventDefault(); wheel.dy += e.deltaY * (e.deltaMode === 1 ? 40 : 1) * 1.2; }, { passive: false });

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

// The Arcforge pictures (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lockup = new Image(); lockup.onload = () => setLockup(lockup); lockup.src = './brand/arcforge-lockup.png';

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = (env) => { const game = createGame({ ...env, clock, wheel }); if (env.config.dev) window.__sapo = game; return game; };
boot({ createGame: create, meta, canvas: document.getElementById('game'), background: '#000' });
