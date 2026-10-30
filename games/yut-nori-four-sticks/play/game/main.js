import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { ABOUT } from './src/text.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers and standalone apps: zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && !window.__noHostBack && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel / trackpad scrolls the About and How to play pages (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// ?scene=N (or ?seed=9000+N) opens a fixed showcase scene for store screenshots; players never see it.
const q = new URLSearchParams(globalThis.location.search), seed = Number(q.get('seed') || 0);
const showcase = Number(q.get('scene') || (seed >= 9000 && seed < 9100 ? seed - 9000 : 0)) || 0;

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame({ ...env, config: { ...env.config, showcase } }); if (env.config.dev || q.has('dev')) window.__yut = game; return game; };

// The Arcforge badge (src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lockup = new Image(); lockup.onload = () => setLockup(lockup); lockup.src = './brand/arcforge-lockup.png';

// 3D presenter (the mal-pan on an oiled-paper ondol floor, behind the kit canvas). The game boots at once on the flat 2D art (styled
// title in the first frame); three.js is fetched and the scene built in small slices after that, then crossfades in. No WebGL,
// ?flat=1 or a lost context: the flat art stays. The presenter only reads game state.
let presenter = null, inner = null;
const FLAT_BG = '#140d1c';
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : FLAT_BG) };     // read by the kit every frame, so the switch is instant
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
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); window.__v3At = performance.now(); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  // let the flat title paint and become interactive first
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  const body = md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, ''));
  body.forEach((p, i) => ABOUT.sections.push({ h: i ? '' : '3D graphics credits', p }));
}).catch(() => {});
