import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { addAboutCredits } from './src/content.js';

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
// Mouse wheel scrolls the menu lists (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
let presenter = null;
const create = async (env) => {
  const game = await createGame(env); if (env.config.dev) window.__tops = game;
  // The 3D layer (a lacquered dish and turned tops on a lamp-lit walnut table, behind this transparent canvas) is wrapped around render().
  return Object.assign(Object.create(game), game, {
    render(ctx, view) {
      if (presenter) presenter.pre();
      game.render(ctx, view);
      if (presenter) presenter.post();
    },
  });
};

// The Arcforge lockup and badge (see src/brand.js): optional, the title and result screens still read without them.
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// The kit fills the background each frame: transparent while the 3D table is showing, so nothing is erased over it.
const bg = { toString: () => (v3.on && v3.want ? 'rgba(0,0,0,0)' : '#1c0f08') };
boot({ createGame: create, meta, canvas, background: bg });

// 3D presenter: loaded after the flat title has painted. No WebGL, ?flat=1 or a lost context: the flat 2D art stays.
const q = new URLSearchParams(location.search);
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (p.ok) { presenter = p; p.attach(); }
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  addAboutCredits(md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')).join(' '));
}).catch(() => {});
