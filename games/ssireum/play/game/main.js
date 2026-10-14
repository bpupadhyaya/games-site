import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

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

// ---- real 3D wrestlers (presentation layer, platform/view3d) -----------------------------------------------------------------
// The sim and the 2D picture own everything; src/view.js asks globalThis.__figure3d to draw the pair and falls back to its 2D rig when it is
// missing (no WebGL2, a failed load, a lost context) or when the page is opened with ?fig=2d. While the module loads nothing is drawn for the
// pair (no flash of the fallback), so the first frame is not delayed by the 3D assets.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__figure3d = { pending: true, draw: () => true };
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  import('./view3d/wrestlers.js')
    .then((m) => m.createWrestlers({ quality: weak ? 'low' : 'medium' }))
    .then((w) => { globalThis.__figure3d = w || null; })
    .catch((e) => { console.warn('3D wrestlers unavailable, using the 2D picture', e); globalThis.__figure3d = null; });
}

// Side-view pictures of the same 3D wrestlers (hold, and the four falls), drawn by the flat view when the 3D layer is unavailable or its
// WebGL context is lost mid-bout: [x, y, w, h] in design world units. Optional: the 2D rig still works without them.
{
  const boxes = {"hold": [260, 151, 200, 303], "f0p": [272, 64, 220, 389], "f0m": [112, 64, 380, 377], "f1p": [218, 82, 237, 372], "f1m": [218, 82, 386, 387]}, spr = {};
  for (const k of Object.keys(boxes)) { const im = new Image(); im.onload = () => { spr[k] = { im, x: boxes[k][0], y: boxes[k][1], w: boxes[k][2], h: boxes[k][3] }; globalThis.__figureSprites = spr; }; im.src = `./brand/s-${k}.webp`; }
}

// The baked picture of the same 3D world (crowd, ring, scenery) per ring, for the 2D fallback: [x, y, w, h] in design world units.
{
  const bg = { danoh: [-300, -90, 1320, 590], moon: [-300, -90, 1320, 590], court: [-300, -90, 1320, 590] }, store = {};
  for (const id of Object.keys(bg)) { const im = new Image(); im.onload = () => { store[id] = { im, x: bg[id][0], y: bg[id][1], w: bg[id][2], h: bg[id][3] }; globalThis.__ringBackdrops = store; }; im.src = `./brand/bg-${id}.webp`; }
}

// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
}).catch(() => {});

boot({ createGame: (env) => { const g = createGame({ ...env, multi }); if (/[?&]dev=1/.test(location.search)) window.__ssireum = g; return g; }, meta, canvas, background: '#140b05' });
