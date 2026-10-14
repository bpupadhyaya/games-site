import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { GL } from './src/gl.js';
import { createPresenter } from './view3d/presenter.js';
import { createLazy3d } from './lazy3d.js';

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
const create = async (env) => { const game = await createGame(env); if (env.config.dev) { window.__sdk = game; Object.defineProperty(window, '__k3d', { get: () => lazy.presenter }); window.__GL = GL; } return game; };

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// The 3D scene (view3d presenter): street corner, the storyteller's box, cards, storyteller, children. It draws in a WebGL canvas behind this
// transparent canvas. Without WebGL (or if it cannot load, or ?gl=0) the game keeps its 2D scene.
const lazy = createLazy3d({
  canvas, flatBg: '#0d0818', eager: /[?&]shot=1/.test(location.search), usable: (p) => !!p, ready: () => null,
  load: async () => {
    if (/[?&]gl=0/.test(location.search)) return null;
    const p = await createPresenter({ kitCanvas: canvas });
    if (!p || !p.ready_p) return null;
    // no timer in store-shot runs (their clock is virtual); a stuck load is given up after 25 s and the 3D layer is switched off for good
    const limit = /[?&]shot=1/.test(location.search) ? 0 : 25000;
    await Promise.race([p.ready_p.then(() => true).catch(() => false), ...(limit ? [new Promise((r) => setTimeout(() => r(false), limit))] : [])]);
    if (!p.ready) { p.abort && p.abort(); return null; }
    return p;
  },
});
await lazy.prepare();
boot({ createGame: (env) => create(env).then((g) => lazy.wrap(g)), meta, canvas, background: lazy.background });
lazy.start();
