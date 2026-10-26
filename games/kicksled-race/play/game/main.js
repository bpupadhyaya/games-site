import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';
import { installResizeGuard } from './resizeguard.js';

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
const create = async (env) => { if (new URLSearchParams(window.location.search).has('shot')) env.config.shot = true; const game = await createGame(env); theGame = game; { const st = new URLSearchParams(window.location.search).get('stage'); if (st !== null && env.config.dev) game.stage(Number(st)); } if (env.config.dev) window.__kicksled = game; return game; };
document.addEventListener('visibilitychange', () => { if (document.hidden && theGame && theGame.suspend) theGame.suspend(); });
canvas.addEventListener('wheel', (e) => { if (!theGame) return; e.preventDefault(); theGame.wheel(e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1)); }, { passive: false });

// The Arcforge badge and lockup (see src/brand.js): optional, nothing breaks without them.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// ---- real 3D riders (presentation layer, platform/view3d) ---------------------------------------------------------------------
// src/art.js asks globalThis.__rider3d to draw each racer and keeps its 2D figure as the fallback (no WebGL2, a failed load, a lost context,
// or ?fig=2d). While the module loads the riders are simply not drawn yet (no flash of the fallback).
// Boot first, WebGL second (1.1.3): creating a WebGL2 context is a synchronous main-thread call that can take many seconds on a weak
// phone/emulator GPU, and it used to run here BEFORE boot(), so the canvas stayed unsized and the page looked dead. Now the 2D game
// boots and sizes its canvas first; the 3D layer starts after the first frames (see start3d below).
const start3d = () => {
  const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
  const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
  const gl2 = wantFig && hasWebGL2();
  if (gl2) {
    globalThis.__rider3d = { pending: true, draw: () => true };
    const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
    import('./view3d/riders.js')
      .then((m) => m.createRiders({ quality: weak ? 'low' : 'medium' }))
      .then((r) => { globalThis.__rider3d = r || null; if (r) r.preload('You', { jacket: '#2a8fd6', hat: '#d33b2f' }); })
      .catch((e) => { console.warn('3D riders unavailable, using the 2D picture', e); globalThis.__rider3d = null; });
  }
  // the lit 3D world behind the race (src/scene.js composites it; the flat 2D backdrop is the instant fallback and stays if this fails)
  if (gl2 && !/[?&]world=0/.test(globalThis.location.search)) {
    const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
    const idle = (fn) => (globalThis.requestIdleCallback ? globalThis.requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 400));
    idle(() => {
      import('./view3d/world.js')
        .then((m) => m.createWorld({ quality: weak ? 'low' : 'medium' }))
        .then(async (w) => { if (!w) return; await w.prepare('town'); globalThis.__world3d = w; for (const id of ['forest', 'lake', 'harbour']) { await new Promise((r) => setTimeout(r, 60)); await w.prepare(id); } })
        .catch((e) => { console.warn('3D world unavailable, using the 2D backdrop', e); globalThis.__world3d = null; });
    });
  }
};
{
  // the vendored 3D layer's licence text is shown with the About pages
  fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
    const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
  }).catch(() => {});
}

// Resize guard (1.1.3): see resizeguard.js.
installResizeGuard({ canvas, win: window }).burst();

// 3D starts only once the 2D game is up and two frames have been presented (and a short breather for the GPU process).
const after3dDelay = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 250))));
boot({ createGame: create, meta, canvas, background: '#0c2236' }).then(after3dDelay).then(start3d);
