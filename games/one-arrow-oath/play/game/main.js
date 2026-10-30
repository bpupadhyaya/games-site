import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/ui/frame.js';
import { setLogo, setLockup } from './src/ui/brand.js';
import { v3 } from './src/v3.js';

const canvas = document.getElementById('game');
const short = () => Math.max(1, Math.min(window.innerWidth, window.innerHeight));

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / short();
  const s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0;
  host.r = s ? (s.right || 0) * px : 0;
  host.b = s ? (s.bottom || 0) * px : 0;
  host.l = s ? (s.left || 0) * px : 0;
  // the shell's translucent back button only exists in apps where the game is rotatable (insets present); 0 in a browser
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0;
  host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// Mouse wheel / trackpad scrolls the reader and the card grid (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  wheelInput.dy += e.deltaY * (720 / short()) * (e.deltaMode === 1 ? 16 : 1);
}, { passive: false });

// The Arcforge badge and the themed lockup (see src/ui/brand.js): optional, the game reads without them.
const load = (src, set) => {
  const img = new Image();
  img.onload = () => set(img);
  img.src = src;
};
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) {
    window.__oao = game;
    window.__oaoMeta = meta;
  }
  return game;
};

// 3D presenter (a night plateau of wind-towers behind the kit canvas, lit element constructs and the spirit bow, view3d/presenter.js). The
// game boots at once on the flat 2D art (styled title in the first frame); three.js is fetched and the scene built in small slices after
// that, then it crossfades in. No WebGL or a lost context: the flat art stays. The presenter only reads game state.
let presenter = null, inner = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#070b1c') };   // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    if (v3.on && presenter) {
      // the kit fills its background each frame; a transparent fill erases nothing, so clear the 2D layer here
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
      presenter.pre();
    }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
  if (!p.ok) return;
  const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
  go();
}).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
// let the flat title paint and become interactive first
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));

// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  v3.credits = md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')).join(' ');
}).catch(() => {});
