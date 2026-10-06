import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
// Standalone builds have no host back button: the game keeps its own way out (Menu / Pause -> Save and leave).
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== 0 && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel scrolls the reference pages (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// The Arcforge badge and the themed lockup (see src/brand.js): optional, the title still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

const app = await boot({ createGame, meta, canvas, background: '#06281f' });

// Screenshot verification only (used with ?shot=1, e.g. by `tools/arc shots` or a manual capture): optional
// &lang=en|zh, &scene=NAME and &page=N force the tile-language pref, the current scene and (for a paginated
// scene such as Rules/How/About) the page index right after boot, so a specific screen can be captured
// deterministically. No effect for players (nothing sets these params in shipped links).
if (app?.game) {
  const params = new URLSearchParams(location.search);
  if (params.has('shot') && (params.has('lang') || params.has('scene') || params.has('page'))) {
    const S = app.game.getState();
    if (params.has('lang')) S.prefs.lang = params.get('lang') === 'en' ? 'en' : 'zh';
    if (params.has('scene')) S.scene = params.get('scene');
    if (params.has('page')) S.page = parseInt(params.get('page'), 10) || 0;
  }
}

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts, and time the first frame.
if (app?.game && new URLSearchParams(location.search).has('dev')) {
  window.__mj = app.game; window.__mjdev = app.env?.config?.devHandles;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__firstFrame = performance.now(); }));
}
