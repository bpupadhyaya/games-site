import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// logic never reads it) and the game draws moving stones and the hand a fraction of a step ahead, which keeps motion smooth at 120 Hz.
const clock = () => globalThis.performance.now();
const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const unit = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const u = unit(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * u : 0; host.r = s ? (s.right || 0) * u : 0; host.b = s ? (s.bottom || 0) * u : 0; host.l = s ? (s.left || 0) * u : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * u : 0; host.px = 1 / u;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// The Arcforge badge and themed lockup (see src/brand.js): optional, the game reads fine without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame({ ...env, clock }); if (env.config.dev || /[?&]qa=1/.test(location.search)) window.__oq = game; return game; };

boot({ createGame: create, meta, canvas, background: '#000' }).then((r) => {
  // Mouse wheel / trackpad scrolls the long text screens (Rules, How to Play, About, Settings at large text sizes).
  canvas?.addEventListener('wheel', (e) => { e.preventDefault(); r?.game?.wheel?.((e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY) * unit()); }, { passive: false });
});
