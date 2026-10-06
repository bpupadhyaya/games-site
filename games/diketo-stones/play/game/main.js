import { boot } from './kit/index.js';
import { createGame } from './src/game.js';
import { meta, host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

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
window.addEventListener('orientationchange', syncHost);
window.addEventListener('safeinsets', syncHost);

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// The kit has no wheel event: forward mouse-wheel / trackpad scrolling to the game (it queues it and applies it in update()).
boot({
  createGame: async (env) => {
    const game = await createGame(env);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); game.wheel?.((e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY) * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)))); }, { passive: false });
    if (env.config.dev) window.__dk = game;
    return game;
  },
  meta, canvas, background: '#000',
});
