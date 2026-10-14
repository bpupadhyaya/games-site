import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
const dev = new URLSearchParams(location.search).has('dev');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in virtual
// units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const unitsPerPx = () => 720 / Math.max(1, Math.min(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight));
const syncHost = () => {
  const k = unitsPerPx(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * k : 0; host.r = s ? (s.right || 0) * k : 0; host.b = s ? (s.bottom || 0) * k : 0; host.l = s ? (s.left || 0) * k : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * k : 0; host.px = 1 / k;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// ---- the real 3D chute, rider and sled (presentation layer, platform/view3d) -------------------------------------------------------------
// The sim and the 2D chute own everything. The flat 2D picture is on screen from the first frame; the 3D scene is built in slices behind it
// (world3d.js: textures, track, rider, shader precompile, each after a frame) and fades in over it when ready. If WebGL2 is missing, the load
// fails, the context is lost or the page is opened with ?fig=2d, the 2D picture (with its 2D sled sprite) simply stays.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__luger = { pending: true, draw: () => true };
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  const start = async () => {
    const m = await import('./view3d/world3d.js');
    const world = await m.createWorld({ quality: weak ? 'low' : 'medium' });
    if (!world || !world.luger) throw new Error('no 3D world');
    const { buildTrack } = await import('./src/track.js');
    const T = buildTrack('village');
    await world.prepare({ T, s: 40, n: 0, v: 20, u: 0, t: 0, line: false, signs: [], lines: [], ruts: null, ghost: null, rider: { ph: 'run', pt: 9, lie: 1, u: 0, v: 20, ev: [] } });
    globalThis.__luger = null;
    globalThis.__world3d = world;
    if (dev) window.__w3 = world;
  };
  // let the title paint first, then build in slices
  setTimeout(() => start().catch((e) => { console.warn('3D scene unavailable, using the 2D picture', e); globalThis.__luger = null; globalThis.__world3d = null; }), 0);
}

// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
}).catch(() => {});

let live = null;
canvas.addEventListener('wheel', (e) => { if (live && live.wheel) { live.wheel((e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY) * unitsPerPx()); e.preventDefault(); } }, { passive: false });
const shot = new URLSearchParams(location.search).has('shot');
boot({
  createGame: async (env) => {
    const g = await createGame({ ...env, config: shot ? { ...env.config, shot: true } : env.config });
    live = g;
    if (dev) window.__game = g;
    return g;
  },
  meta, canvas, background: '#0d2236',
});
