import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { setKanjiOk } from './src/view.js';
import { CJK } from './src/ui.js';
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

// A real 一 is a single bar (little ink height); a missing glyph draws a tall box. If the font is missing show digits.
function kanjiAvailable() {
  try {
    const c = document.createElement('canvas'); c.width = 80; c.height = 80;
    const x = c.getContext('2d', { willReadFrequently: true }); if (!x) return true;
    x.font = `48px ${CJK}`; x.textBaseline = 'middle'; x.fillStyle = '#000'; x.fillText('一', 8, 40);
    const d = x.getImageData(0, 0, 80, 80).data; let y0 = 80, y1 = -1, any = false;
    for (let y = 0; y < 80; y++) for (let xx = 0; xx < 80; xx++) if (d[(y * 80 + xx) * 4 + 3] > 80) { any = true; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return any && y1 - y0 < 16;
  } catch { return true; }
}
setKanjiOk(kanjiAvailable());

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (WebGL canvas behind the kit canvas). With no WebGL, or if the context is lost, every screen falls back to the flat 2D art.
const q = new URLSearchParams(location.search);
let presenter = { wrap: (g) => g, ok: false };
// Boot on the flat 2D art at once; the 3D layer is imported and built after the first frames, then swapped in (store shots and dev runs wait for it).
const wait3d = ['shot', 'scene', 'spec', 'dev'].some((k) => new URLSearchParams(location.search).has(k));
const load3d = async () => {
  if (new URLSearchParams(location.search).has('flat')) return;
  try { const { createPresenter } = await import('./view3d/presenter.js'); presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }
};
if (wait3d) await load3d();
if (q.has('dev')) { window.__p3 = presenter; window.__v3 = v3; }
const flatBg = '#0a0d24';
const background = { toString: () => (presenter.ok ? 'rgba(0,0,0,0)' : flatBg) };   // read by the kit every frame, so it turns clear when the 3D layer arrives
boot({ createGame: async (env) => {
  const raw = await create(env);
  if (wait3d) return presenter.wrap(raw);
  let cur = raw;
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80)))).then(load3d).then(() => { if (presenter.ok) cur = presenter.wrap(raw); });
  return new Proxy(raw, { get: (_, k) => cur[k] });
}, meta, canvas, background });
