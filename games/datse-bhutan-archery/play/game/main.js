import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The kit has one pointer: a stray second finger must not move it. Only the primary pointer reaches the kit.
const canvas = document.getElementById('game');
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) canvas.addEventListener(type, (e) => { if (e.isPrimary === false) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

// The 3D valley (web/view3d) draws behind the kit canvas. The game boots at once on the painted flat valley (a styled, interactive title in the
// first frames); the 3D presenter loads in the background and takes over with a short crossfade once its people are ready. With no WebGL, or
// if the 3D layer fails to load, the game keeps its flat 2D view. Store-shot runs (?shot=1) wait for the 3D layer so their first frame is 3D.
const FLAT = { stage: null, wrap: (g) => g, busy: () => false, ready: () => false };
let presenter = null, adopted = false;
const loadPresenter = async () => {
  try { const { createPresenter } = await import('./view3d/presenter.js'); return await createPresenter({ kitCanvas: canvas }); }
  catch (e) { console.warn('3D view unavailable, using the flat view', e); return FLAT; }
};
if (/[?&]shot=/.test(location.search)) presenter = await loadPresenter();
function adopt(game, fade) {
  if (adopted || !game || !presenter) return;
  adopted = true;
  if (!presenter.stage) return;                                 // no WebGL: the flat view stays
  const go = () => {
    if (fade) {   // a snapshot of the last flat frame sits between the 3D canvas and the kit canvas and fades out: no pop from painted to 3D
      const snap = document.createElement('canvas'); snap.width = canvas.width; snap.height = canvas.height;
      snap.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:1;opacity:1;transition:opacity 420ms ease-out';
      try { snap.getContext('2d').drawImage(canvas, 0, 0); canvas.style.zIndex = '2'; canvas.parentElement.insertBefore(snap, canvas); } catch { /* the 3D just appears */ }
      requestAnimationFrame(() => requestAnimationFrame(() => { snap.style.opacity = '0'; setTimeout(() => snap.remove(), 520); }));
    }
    presenter.wrap(game); game.setHas3d?.(true);
  };
  if (presenter.ready()) go(); else { const t = setInterval(() => { if (presenter.ready()) { clearInterval(t); go(); } }, 40); }
}

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in
// virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const short = Math.max(1, Math.min(window.innerWidth, window.innerHeight)), px = 720 / short, s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

let theGame = null;
const booted = boot({
  createGame: async (env) => {
    const game = await createGame(env); theGame = game;
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => game.setCredits?.(t)).catch(() => {});
    adopt(game, false);
    return game;
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
});
if (!presenter) loadPresenter().then((p) => { presenter = p; adopt(theGame, true); });
booted.then((b) => { if (/[?&]dbg/.test(location.search)) window.__k = { ...b, get presenter() { return presenter || FLAT; }, game: theGame }; });
canvas.addEventListener('wheel', (e) => { if (theGame && theGame.scrollBy) { theGame.scrollBy(e.deltaY * (e.deltaMode === 1 ? 24 : 1) * 1.2 * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)))); e.preventDefault(); } }, { passive: false });
