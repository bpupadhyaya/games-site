import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPointerGuard } from './src/pointerGuard.js';
import { host } from './src/layout.js';
import { setLockup } from './src/brand.js';

const canvas = document.getElementById('game');
// Haptics hook used by src/game.js (grab, bumps, lift, fault). A native shell can define window.__haptic first; browsers fall back to a short vibration.
if (!window.__haptic) {
  const PAT = { grab: 8, tok: 5, lift: [14, 30, 14], fault: [60, 40, 90] };
  window.__haptic = (kind) => { try { if (navigator.vibrate) navigator.vibrate(PAT[kind] || 8); } catch { /* none */ } };
}
// Ignore a second finger (see src/pointerGuard.js). Registered on window in the capture phase, so it runs before the kit's listeners.
const guard = createPointerGuard();
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
  window.addEventListener(type, (e) => { if (e.target === canvas && !guard(type, e.pointerId, e.isPrimary)) e.stopPropagation(); }, true);
}

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

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => { const game = await createGame(env); { const q0 = new URLSearchParams(location.search); if (q0.has('shot') && game.shotScene) game.shotScene(+q0.get('seed')); } if (env.config.dev) { window.__dft = game; const q = Object.fromEntries(new URLSearchParams(location.search)); if (q.scene && game.dev) game.dev.go(q); window.__css = (wx, wy) => { const b = game.dev.board(), k = innerWidth / b.W; return { x: (b.cx + wx * b.s) * k, y: (b.cy + wy * b.s) * k }; }; } return game; };

// The Arcforge lockup (see src/brand.js): optional, the title reads without it.
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#000' });
