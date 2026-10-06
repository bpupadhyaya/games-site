import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// Store screenshots (`?shot=1&seed=<showcase seed>`) show real mid-race positions. Seeds 9001..9007 pick a position; the
// scene then ignores the random shot-mode "monkey" input so it stays put. Every other URL and every real player is unaffected.
// Host safe areas (notch, home indicator) and the floating back button (hub builds only): the shell publishes window.__safeInsets in
// CSS px. The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
// In standalone builds there is no host back button (host.back stays 0): the game's own Menu / Leave buttons are the way out.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
const cv = document.getElementById('game');
if (cv) cv.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
const loadImg = (src, done) => { const im = new Image(); im.onload = () => done(im); im.src = src; };
loadImg('./brand/arcforge-af.png', setLogo);
loadImg('./brand/arcforge-lockup.png', setLockup);

const params = new URLSearchParams(globalThis.location.search);
const SHOWCASE_SEEDS = { 9001: 'hold', 9002: 'wind', 9003: 'bump', 9004: 'burrow', 9005: 'win', 9006: 'setup', 9007: 'autoplay', 9008: 'rules3', 9009: 'rules1', 9010: 'settings3', 9011: 'over' };
const showcase = params.has('shot') ? SHOWCASE_SEEDS[Number(params.get('seed'))] : undefined;
const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

const create = showcase
  ? async (env) => { env.config.showcase = showcase; const game = await createGame(env); return { ...game, update: (dt) => game.update(dt, idle), isPreviewExempt: () => true }; }
  : createGame;

const devCreate = async (env) => { const game = await create(env); if (env.config.dev) window.__game = game; return game; };
boot({ createGame: devCreate, meta, canvas: document.getElementById('game'), background: '#1a1206' });
