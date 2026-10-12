import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPlatform, loadWordData, armKb } from './platform.js';
import { installMirror } from './a11y-dom.js';

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
// Mouse wheel scrolls the Rules reader (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev tools only (?dev=1 or the app's Developer toggle): expose the game object for the layout/resize check scripts.
const create = async (env) => {
  env.wg = createPlatform(env);                       // speech, file export, links and the database; the game works without any of it
  // The dictionary sheet joins the browser history while it is open, so the back gesture / browser Back closes it (and nothing else).
  let gameRef = null;
  env.sheetHook = (open) => { try { if (open) history.pushState({ wgSheet: 1 }, ''); else if (history.state && history.state.wgSheet) history.back(); } catch { /* no history in this host */ } };
  window.addEventListener('popstate', () => { try { gameRef?.back(); } catch { /* ignore */ } });
  window.__wgBack = () => Boolean(gameRef?.back());   // a native shell can call this first on its back gesture: true means the sheet closed
  armKb(Boolean(env.config.demo));   // until the word data has loaded the dictionary sheet shows Loading (kb.ensure)
  const game = await createGame(env); gameRef = game;
  if (env.config.dev) window.__wg = game;
  try { installMirror({ canvas, game, meta }); } catch { /* the game does not depend on the screen-reader layer */ }
  requestAnimationFrame(() => setTimeout(() => loadWordData(env.wg, Boolean(env.config.demo)), 60));   // word data loads after the first frame
  return game;
};

// The Arcforge badge and themed lockup (see src/brand.js): optional, the credit line still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#050f18' });
