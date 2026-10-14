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
const create = async (env) => { if (new URLSearchParams(window.location.search).has('shot')) env.config.shot = true; const game = await createGame(env); theGame = game; { const st = new URLSearchParams(window.location.search).get('stage'); if (st !== null && env.config.dev) game.stage(Number(st)); } if (env.config.dev) window.__billycart = game; return game; };
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// ---- real 3D carts, drivers and spectators (presentation layer, platform/view3d) -------------------------------------------------
// src/art.js asks globalThis.__cart3d to draw each cart and spectator and keeps its 2D drawing as the fallback (no WebGL2, a failed load,
// a lost context, or ?fig=2d). While the module loads the carts are simply not drawn yet (no flash of the fallback).
{
  const want3d = !/[?&]fig=2d/.test(globalThis.location.search);
  const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
  if (want3d && hasWebGL2()) {
    globalThis.__cart3d = { pending: true, drawCart: () => true, person: () => false };
    const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
    import('./view3d/carts.js')
      .then((m) => m.createCarts({ quality: weak ? 'low' : 'medium' }))
      .then((r) => { globalThis.__cart3d = r || null; if (r) r.preload('You', { shirt: '#f2b53f', helmet: '#d33b2f' }); })
      .catch((e) => { console.warn('3D carts unavailable, using the 2D picture', e); globalThis.__cart3d = null; });
  }
  // the vendored 3D layer's licence text is shown with the About pages
  fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
    const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
  }).catch(() => {});
}

boot({ createGame: create, meta, canvas, background: '#2b170a' });
