import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// logic never reads it) and the game draws moving stones and the hand a fraction of a step ahead, which keeps motion smooth at 120 Hz.
const clock = () => globalThis.performance.now();
// The kit input does not carry the mouse wheel, so the shell collects it (in board units) for the document screens to scroll with.
const canvas = document.getElementById('game');
const wheel = { dy: 0 };
const unitsPerPx = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));   // the short side is always 720 virtual units
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheel.dy += e.deltaY * (e.deltaMode === 1 ? 32 : 1) * unitsPerPx(); }, { passive: false });

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units, so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const u = unitsPerPx(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * u : 0; host.r = s ? (s.right || 0) * u : 0; host.b = s ? (s.bottom || 0) * u : 0; host.l = s ? (s.left || 0) * u : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * u : 0; host.px = 1 / u;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// Arcforge pictures (see src/brand.js): optional, the game reads without them.
const load = (src, set) => { const im = new Image(); im.onload = () => set(im); im.src = src; };
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

boot({ createGame: (env) => createGame({ ...env, clock, wheel }), meta, canvas, background: '#000' });
