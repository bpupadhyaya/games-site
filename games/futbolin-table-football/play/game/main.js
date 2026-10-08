import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { attachTouches } from './src/touches.js';
import { setLogo, setLockup } from './src/brand.js';

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px (browsers: none).
// The layout works in virtual units (short side = 720), so convert with the current scale.
const canvas = document.getElementById('game');
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
attachTouches(canvas);
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
// The Arcforge badge and the themed lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const params = new URLSearchParams(location.search);
const shot = params.has('shot');
boot({
  createGame: async (env) => {
    const game = await createGame({ ...env, config: shot ? { ...env.config, shot: true, shotScene: params.get('scene') || '' } : env.config });
    if (params.has('dev')) window.__game = game;
    return game;
  },
  meta, canvas, background: '#1a0c05',
});
