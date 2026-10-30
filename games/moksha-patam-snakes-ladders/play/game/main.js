import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
// In standalone builds there is no host back button (host.back stays 0): the game's own Menu / Exit buttons are the way out.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// 3D presenter (a painted cloth board with bamboo ladders and clay serpents on a dark teak table, behind the kit canvas). The game boots
// at once on the flat 2D art; three.js is fetched and the scene built after the first paint, then takes over the title / play / Watch &
// Learn screens. No WebGL, ?flat=1 or a lost context: the flat art is drawn exactly as before. The presenter only reads v3.
const q = new URLSearchParams(location.search);
let presenter = null, inner = null;
const bg = { toString: () => (v3.live ? 'rgba(0,0,0,0)' : '#130a06') };     // read by the kit every frame
const SCENES = { title: 1, play: 1, demo: 1 };
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    const st = g.getState(), on = !!(presenter && v3.ready && SCENES[st.scene]);
    v3.live = on; v3.clear();
    if (on) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
    g.render(ctx, view);
    if (presenter) presenter.canvas.style.visibility = on ? 'visible' : 'hidden';
    if (on) presenter.frame(performance.now());
  },
});

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = wrap(await createGame(env)); inner = game; if (env.config.dev) { window.__game = game; window.__v3 = v3; } return game; };

const load = (src, set) => { const i = new Image(); i.onload = () => set(i); i.src = src; };
load('./brand/arcforge-af.png', setLogo);
load('./brand/arcforge-lockup.png', setLockup);

boot({ createGame: create, meta, canvas, background: bg });
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    presenter = p; v3.ready = true; if (q.has('dev')) window.__p3 = p;
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  // let the flat title paint and become interactive first
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
