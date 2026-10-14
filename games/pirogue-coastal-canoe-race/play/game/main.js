import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

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
const q = new URLSearchParams(location.search);
// Boot flat immediately (the 2D art is a complete game); the WebGL presenter is built in the background and crossfades in.
let presenter = null;
const create = async (env) => {
  const game = await createGame(env); theGame = game; if (env.config.dev) window.__pirogue = game;
  if (!q.has('flat')) {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      if (presenter && presenter.ready) { presenter.render(ctx, view); return; }
      r(ctx, view);
    };
    game.__flatRender = r;
    setTimeout(async () => {
      try {
        const { createPresenter } = await import('./view3d/presenter.js');
        const p = await createPresenter({ kitCanvas: canvas });
        if (!p) return;
        const inner = { getState: game.getState, render: (c, v) => r(c, v) };
        p.wrap(inner);
        presenter = { ready: true, render: (c, v) => {
          // transparent canvas: the kit painted its background; clear it so the WebGL sea shows through
          const ct = c.getTransform(); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); if (v3.on) c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.restore(); void ct;
          inner.render(c, v);
        } };
        if (q.has('dev')) window.__p3 = p;
      } catch (e) { console.warn('3D presenter unavailable', e); }
    }, 60);
  }
  return game;
};
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#0a4a7c' });
