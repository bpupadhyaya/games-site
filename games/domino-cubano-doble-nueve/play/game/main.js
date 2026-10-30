import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
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
// Mouse wheel scrolls the Rules / How to Play pages (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev tools only (the app's Developer toggle, env.config.dev): expose the game object for the layout/resize check scripts.
let inner = null, presenter = null, devOn = false;
const create = async (env) => {
  const game = await createGame(env);
  devOn = Boolean(env.config.dev);
  if (devOn) window.__dom = game;
  const base = Object.create(game);
  // 3D table: the 2D layout plane is laid on the tilted table, so while a hand is on screen a touch is carried back from the screen to
  // the layout plane (v3.unproj) before the unchanged 2D hit tests see it. Buttons and overlay cards stay where they are drawn.
  const remap = (input) => {
    if (!v3.on || !v3.zone || !v3.unproj || !input.pointer) return input;
    const st = game.getState();
    if ((st.scene !== 'playing' && st.scene !== 'auto') || st.handResult || st.matchResult) return input;
    const z = v3.zone, p = input.pointer;
    if (p.x < z.x0 || p.x > z.x1 || p.y < z.y0 || p.y > z.y1) return input;
    const u = v3.unproj(p.x, p.y);
    if (!u || u[0] < z.x0 - 40 || u[0] > z.x1 + 40 || u[1] < z.y0 - 40 || u[1] > z.y1 + 40) return input;
    return { ...input, pointer: { ...p, x: u[0], y: u[1] } };
  };
  Object.assign(base, game, {
    update(dt, input) { return game.update(dt, remap(input)); },
    render(ctx, view) {
      if (v3.on && presenter) {
        // the kit fills its background each frame; a transparent fill erases nothing, so clear the 2D layer here
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
        presenter.pre();
      }
      game.render(ctx, view);
      if (v3.on && presenter) presenter.post();
    },
  });
  inner = base;
  return base;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// The kit reads the background every frame, so the switch to a transparent canvas is instant once the 3D table is alive.
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#170d10') };
boot({ createGame: create, meta, canvas, background: bg });

// 3D table (view3d/): the game boots at once on the flat 2D art (styled title in the first frame); three.js is fetched and the scene built
// after that, then crossfades in. No WebGL or a lost context: the flat art stays. The presenter only reads game state.
const start = () => {
  if (!inner) return setTimeout(start, 30);
  import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas, dev: devOn })).then((p) => {
    if (!p.ok) return;
    presenter = p; p.attach(inner);
    if (devOn) window.__p3 = p;
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
};
// let the flat title paint and become interactive first
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
