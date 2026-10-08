import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { gfx } from './src/bake.js';

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

// The board's carved relief is baked into a texture (src/bake.js); canvases are made here because web/src may not touch the DOM.
gfx.make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__mehen = game; return game; };

// The themed Arcforge lockup (see src/brand.js): optional, the game works without it.
const af = new Image(); af.onload = () => setLockup(af); af.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#120c07' });
