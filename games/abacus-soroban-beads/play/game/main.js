import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3, isDesk } from './src/v3.js';
import { ABOUT } from './src/content.js';

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
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Developer/test hook (?dev=1 or the Developer toggle): expose the game for the layout and screenshot scripts.
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__sdk = game; return game; };

const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// 3D presenter (a lit soroban on a lacquered desk, behind the kit canvas). The game boots at once on the flat 2D art; three.js is fetched
// and the scene built in small slices after that. No WebGL or a lost context: the flat art stays. The presenter only reads game state.
let presenter = null, inner = null;
const FLAT_BG = '#0d0709';
const bg = { toString: () => (v3.on && inner && isDesk(inner.getState().scene) ? 'rgba(0,0,0,0)' : FLAT_BG) };   // read by the kit every frame
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    const desk = v3.on && presenter && isDesk(g.getState().scene);
    if (desk) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
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
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
// Credits for the 3D layer (three.js), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  ABOUT.pages.push({ title: '3D graphics credits', body: md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => ({ p: t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '') })) });
}).catch(() => {});
