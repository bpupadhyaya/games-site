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
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Developer/test hook (?dev=1 or the Developer toggle): expose the game for the layout and screenshot scripts.
const create = async (env) => { const game = await createGame(env); if (env.config.dev) window.__sdk = game; return game; };

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter: the flat 2D art boots at once; the module loads and builds the WebGL scene in slices after the first frame,
// then v3.on flips. With ?flat (or no WebGL, or a lost context) every screen keeps drawing its 2D art.
const q = new URLSearchParams(location.search);
const lazyWrap = (game) => {
  if (q.has('flat')) return game;
  let wrapped = null;
  import('./view3d/presenter.js').then((m) => {
    const presenter = m.createPresenter({ kitCanvas: canvas });
    wrapped = presenter.wrap(game);
    if (q.has('dev')) { window.__p3 = presenter; window.__v3 = v3; }
  }).catch((e) => console.warn('3D presenter unavailable; flat 2D art', e));
  return Object.assign({}, game, {
    update: (dt, input) => (wrapped ?? game).update(dt, input),
    render: (ctx, view) => (wrapped ?? game).render(ctx, view),
  });
};

boot({ createGame: async (env) => lazyWrap(await create(env)), meta, canvas, background: 'rgba(0,0,0,0)' });
