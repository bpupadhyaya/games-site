import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

// Host safe areas (notch, home indicator) and the floating back button (hub builds only): the shell publishes window.__safeInsets in
// CSS px. The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
// In standalone builds there is no host back button (host.back stays 0): the game's own Menu / Leave buttons are the way out.
const short = () => Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const px = 720 / short(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
const cv = document.getElementById('game');
if (cv) cv.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / short()) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
const loadImg = (src, done) => { const im = new Image(); im.onload = () => done(im); im.src = src; };
loadImg('./brand/arcforge-af.png', setLogo);
loadImg('./brand/arcforge-lockup.png', setLockup);

// Store screenshots (`?shot=1&seed=<showcase seed>`) show real positions played by the real game code. Seeds 9001.. pick a position;
// the scene then ignores the random shot-mode "monkey" input so it stays put. Every other URL and every real player is unaffected.
const params = new URLSearchParams(globalThis.location.search);
const SHOWCASE_SEEDS = { 9001: 'hold', 9002: 'field', 9003: 'now', 9004: 'stopped', 9005: 'nummer', 9006: 'batflight', 9007: 'autoplay', 9008: 'rules3', 9009: 'rules', 9010: 'settings', 9011: 'over', 9012: 'setup', 9013: 'ready', 9014: 'how', 9015: 'about', 9016: 'title', 9020: 'wind1', 9021: 'whip1', 9022: 'whip2', 9023: 'contact', 9024: 'follow', 9025: 'fieldstart', 9026: 'fieldwhip', 9027: 'fieldearly', 9030: 'icon', 9031: 'batthrow', 9032: 'batstop' };
const showcase = params.has('shot') ? SHOWCASE_SEEDS[Number(params.get('seed'))] : undefined;
const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

// The 3D meadow (web/view3d) draws behind the transparent kit canvas. It never blocks the game: without WebGL2, with ?nogl, or if its
// assets take longer than 1.6 s, the 2D art plays and the 3D layer takes over the moment it is ready.
let presenter = null;
// Store-shot / scripted-scene runs wait for the 3D layer before the first frame. Normal play boots at once on the 2D art; the 3D presenter
// loads in the background and takes over (adopt) the moment it is ready.
const SYNC3D = /[?&](shot|scene|bare|pdb)\b/.test(location.search), NOGL = /[?&]nogl\b/.test(location.search);
let lateGame = null;
const lateWrap = (g) => { let inner = null; lateGame = Object.assign({}, g, { update(dt, i) { return (inner ?? g).update(dt, i); }, render(c, v) { (inner ?? g).render(c, v); }, adopt() { if (!inner && presenter && presenter.stage) inner = presenter.wrap(g); } }); return lateGame; };
const lateBg = (flat) => ({ toString: () => (presenter && presenter.stage && presenter.ready ? 'rgba(0,0,0,0)' : flat) });
const startLate3d = (opts) => {
  createPresenter(opts).then((p) => {
    if (!p || !p.stage) return;
    presenter = p; if (/[?&]dev\b/.test(location.search)) { window.__presenter = p; window.__p3d = p; }
    if (lateGame) lateGame.adopt();
  }).catch((e) => console.warn('3D presenter unavailable', e));
};
try {
  if (SYNC3D && !params.has('nogl')) {
    presenter = await createPresenter({ kitCanvas: cv });
    if (presenter && presenter.stage) await Promise.race([presenter.ready_p, new Promise((r) => setTimeout(r, 1600))]);
  }
} catch (e) { console.warn('3D presenter unavailable', e && (e.stack || e.message)); presenter = null; }
const has3d = !!(presenter && presenter.stage);

const create = showcase
  ? async (env) => { env.config.showcase = showcase; const game = await createGame(env); return { ...game, update: (dt) => game.update(dt, idle), isPreviewExempt: () => true }; }
  : createGame;
const devCreate = async (env) => {
  const game = await create(env);
  if (env.config.dev) { window.__game = game; window.__presenter = presenter; }
  return presenter && presenter.stage ? presenter.wrap(game) : lateWrap(game);
};

boot({ createGame: devCreate, meta, canvas: cv, background: lateBg('#10301f') });
if (!SYNC3D && !NOGL && !presenter) startLate3d({ kitCanvas: cv });
