import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host, layoutFor } from './src/layout.js';
import { setLockup, setBadge } from './src/brand.js';
import { gfx } from './src/art.js';
import { setLicenses } from './src/content.js';
import { createPresenter } from './view3d/presenter.js';

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
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// The 3D scene sits behind the (transparent) kit canvas; without WebGL the 2D stand-in is drawn instead.
const presenter = await createPresenter({ kitCanvas: canvas });
gfx.has3d = !!presenter.stage;

const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) { window.__ss = game; window.__ssLayout = () => layoutFor(meta.width, meta.height); }
  return presenter.stage ? presenter.wrap(game) : game;
};

fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then(setLicenses).catch(() => {});
const load = (src, f) => { const i = new Image(); i.onload = () => f(i); i.src = src; };
load('./brand/arcforge-lockup.png', setLockup);
load('./brand/arcforge-af.png', setBadge);

boot({ createGame: create, meta, canvas, background: presenter.stage ? 'rgba(0,0,0,0)' : '#04141a' });
