import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';
import { gfx } from './src/bake.js';
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

// The board's carved relief is baked into a texture (src/bake.js); canvases are made here because web/src may not touch the DOM.
gfx.make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
let inner = null;
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__mehen = game; inner = wrapGame(game); return inner; };

// The themed Arcforge lockup (see src/brand.js): optional, the game works without it.
const af = new Image(); af.onload = () => setLockup(af); af.src = './brand/arcforge-lockup.png';

// 3D presenter (a limestone Mehen board with the snake carved in relief, on a scribe's bench in a lamp-lit tomb workshop, behind the kit
// canvas). The game boots at once on the flat 2D art (styled title in the first frame); three.js is fetched and the scene built after
// that, then crossfades in. No WebGL, ?flat=1 or a lost context: the flat art stays. The presenter only reads game state.
let presenter = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#120c07') };     // read by the kit every frame, so the switch is instant
function wrapGame(g) {
  return Object.assign(Object.create(g), g, {
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
}
boot({ createGame: create, meta, canvas, background: bg });
if (!new URLSearchParams(location.search).has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  // let the flat title paint and become interactive first
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  addAboutCredits(md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')).join(' '));
}).catch(() => {});
