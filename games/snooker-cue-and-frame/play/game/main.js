import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { setHost } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  setHost({ t: s ? (s.top || 0) * px : 0, r: s ? (s.right || 0) * px : 0, b: s ? (s.bottom || 0) * px : 0, l: s ? (s.left || 0) * px : 0, back: s && s.back !== false && window.__hostBack !== false ? 56 * px : 0, px: 1 / px });
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two updates and to budget the computer player's thinking; it never reaches the simulation).
const clock = () => globalThis.performance.now();
// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame({ ...env, clock }); if (env.config.dev) window.__sn = game; return game; };

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the game reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas: document.getElementById('game'), background: '#000' });
