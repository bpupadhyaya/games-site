import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const canvas = document.getElementById('game');
const unitsPerPx = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const px = unitsPerPx(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// The Arcforge badge and the lockup (see src/brand.js): optional, the text credit still reads without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// Mouse wheel / trackpad scrolls menus and the Rules reader (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * unitsPerPx() * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Several fingers at once (two players on one phone): the kit input follows one pointer, so main.js keeps its own list of touches in
// virtual units (the same units as the kit's pointer: the short side is 720).
const touches = new Map();
const toV = (e) => { const r = canvas.getBoundingClientRect(), k = unitsPerPx(); return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; };
canvas.addEventListener('pointerdown', (e) => { touches.set(e.pointerId, toV(e)); }, true);
canvas.addEventListener('pointermove', (e) => { if (touches.has(e.pointerId)) touches.set(e.pointerId, toV(e)); }, true);
const endT = (e) => { touches.delete(e.pointerId); };
canvas.addEventListener('pointerup', endT, true); canvas.addEventListener('pointercancel', endT, true); canvas.addEventListener('lostpointercapture', endT, true);
const multi = { list: () => [...touches.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y })) };

// The 3D bout picture (web/view3d) draws behind the kit canvas. If it cannot load, or WebGL is missing, the game keeps its 2D picture.
let presenter = { ok: false, wrap: (g) => g };
try {
  if (/[?&]v3=0/.test(window.location.search)) throw new Error('3D picture switched off (v3=0)');
  const { createPresenter } = await import('./view3d/presenter.js');
  presenter = await createPresenter({ kitCanvas: canvas });
} catch (e) { window.__v3failed = true; console.warn('3D picture unavailable, using the 2D picture: ' + String((e && e.message) || e)); }

boot({
  createGame: async (env) => {
    const game = await createGame({ ...env, multi });
    // the 3D library's credits go to the end of About
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => { if (t) game.setCredits?.(t); }).catch(() => {});
    return presenter.wrap(game);
  },
  meta, canvas, background: presenter.ok ? 'rgba(0,0,0,0)' : '#07191b',
});
