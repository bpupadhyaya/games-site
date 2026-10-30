import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
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

// Dev / check scripts only (?dev=1 or the app's Developer toggle): expose the game object; the mouse wheel scrolls the menu lists.
let theGame = null;
const create = async (env) => { const game = await createGame(env); theGame = game; if (env.config.dev) window.__jab = game; return game; };
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// 3D presenter (steel boules on a gravel pitch under plane trees, behind the kit canvas). The game boots at once on the flat 2D art;
// three.js is fetched and the scene built after the first frames, then takes over. No WebGL or a lost context: the 2D art stays.
let presenter = null;
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    if (v3.on && presenter) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); presenter.pre(); }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#1d130a') };   // read by the kit every frame, so the switch is instant
boot({ createGame: async (env) => wrap(await create(env)), meta, canvas, background: bg });
const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
  if (!p.ok) return;
  const go = () => { if (!theGame) return setTimeout(go, 30); presenter = p; p.attach(theGame); if (window.__jab) window.__p3 = p; };   // __p3: dev only (env.config.dev sets __jab)
  go();
}).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
// let the flat title paint and become interactive first, then build the scene in the background
window.addEventListener('load', () => setTimeout(() => requestAnimationFrame(() => setTimeout(start, 0)), 700));
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  addAboutCredits(md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')).join(' '));
}).catch(() => {});
