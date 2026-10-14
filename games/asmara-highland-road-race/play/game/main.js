import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

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

// Dev / check scripts only (?dev=1 or the app's Developer toggle): expose the game object; the mouse wheel scrolls the menu lists.
let theGame = null;
const create = async (env) => { const game = await createGame(env); theGame = game; if (env.config.dev) window.__asmara = game; return game; };
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// Asphalt speckle tile for the road in src/view.js (a DOM canvas, so it is made here, not in web/src).
try {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 520; i++) {
    const light = rnd() > 0.5, a = 0.12 + rnd() * 0.3;
    g.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.4})`;
    g.beginPath(); g.arc(rnd() * 128, rnd() * 128, 0.5 + rnd() * 1.1, 0, Math.PI * 2); g.fill();
  }
  globalThis.__asphaltTile = c;
} catch { /* no speckle */ }

// ---- real 3D riders and bikes (presentation layer, platform/view3d) -------------------------------------------------------------------
// src/view.js draws every rider with globalThis.__riders3d when it is ready (installed here after the module loads) and keeps its own 2D rider
// otherwise (no WebGL2, a failed load, a lost context, or ?fig=2d).
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  import('./view3d/riders.js')
    .then((m) => m.createRiders({ quality: weak ? 'low' : 'medium', crowd: weak ? 6 : 14 }))
    .then((w) => { if (w) { w.max = w.riders.length; globalThis.__riders3d = w; } })
    .catch((e) => { console.warn('3D riders unavailable, using the 2D picture', e); globalThis.__riders3d = null; });
}

// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
}).catch(() => {});

boot({ createGame: create, meta, canvas, background: '#0b1424' });
