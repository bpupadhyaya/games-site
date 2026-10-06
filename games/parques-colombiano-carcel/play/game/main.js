import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import * as LAYOUT from './src/layout.js';
import { host } from './src/layout.js';
import { screenButtons, screenLayout } from './src/ui.js';
import { setLogo, setLockup } from './src/brand.js';

// Store screenshots (`?shot=1&seed=<showcase seed>`) show real mid-game positions. Seeds 9001..9005 pick a position; the
// scene then ignores the random shot-mode "monkey" input so it stays put. Every other URL and every real player is unaffected.
const params = new URLSearchParams(globalThis.location.search);
const SHOWCASE_SEEDS = { 9001: 'race', 9002: 'capture', 9003: 'pass', 9004: 'pair', 9005: 'win', 9006: 'setup' };
const showcase = params.has('shot') ? SHOWCASE_SEEDS[Number(params.get('seed'))] : undefined;
const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
// Standalone builds have no host back button (host.back = 0); the game's own Pause -> Leave game / Menu path is always reachable.
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
// dev check pages can force insets / a back button without the shell: ?inset=t,r,b,l&back=1
if (params.has('inset')) { const [t, r, b, l] = params.get('inset').split(',').map(Number); window.__safeInsets = { top: t || 0, right: r || 0, bottom: b || 0, left: l || 0 }; syncHost(); }
else if (params.has('back')) { window.__safeInsets = { top: 0, right: 0, bottom: 0, left: 0 }; syncHost(); }

const create = showcase
  ? async (env) => { env.config.showcase = showcase; const game = await createGame(env); return { ...game, update: (dt) => game.update(dt, idle), isPreviewExempt: () => true }; }
  : async (env) => { const game = await createGame(env); if (env.config.dev) { window.__pq = game; window.__pqUI = { screenButtons, screenLayout, LAYOUT }; } return game; };

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas: document.getElementById('game'), background: '#140a05' });
