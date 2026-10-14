import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setMeasureCtx } from './src/menus.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
const qs = new URLSearchParams(location.search);

// Multi-touch: the kit exposes one pointer, but steering and the action buttons need two thumbs. This tracks every finger on the canvas
// (in the game's virtual coordinates) and hands the game a read-only snapshot function. Drawing/input only; the simulation never sees it.
const touches = new Map();
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
try { setMeasureCtx(document.createElement('canvas').getContext('2d')); } catch { /* estimate */ }
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

const scaleNow = () => Math.min((canvas.clientWidth || 720) / meta.width, (canvas.clientHeight || 1280) / meta.height);
const virt = (e) => {
  const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280, r = canvas.getBoundingClientRect();
  const u = e.clientX - r.left, v = e.clientY - r.top, s = scaleNow();
  return { x: (u - W / 2) / s + meta.width / 2, y: (v - H / 2) / s + meta.height / 2 };
};
const onDown = (e) => { const p = virt(e); touches.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y, x0: p.x, y0: p.y, down: true, fresh: true, up: false }); };
const onMove = (e) => { const t = touches.get(e.pointerId); if (t) { const p = virt(e); t.x = p.x; t.y = p.y; } };
const onUp = (e) => { const t = touches.get(e.pointerId); if (t) { t.down = false; t.up = true; } };
canvas.addEventListener('pointerdown', onDown, true);
canvas.addEventListener('pointermove', onMove, true);
canvas.addEventListener('pointerup', onUp, true);
canvas.addEventListener('pointercancel', onUp, true);
const releaseAll = () => { for (const t of touches.values()) { t.down = false; t.up = true; } };
window.addEventListener('blur', releaseAll);
window.addEventListener('resize', releaseAll);
window.addEventListener('orientationchange', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
const touchSnapshot = () => {
  const out = [];
  for (const t of touches.values()) { out.push({ ...t }); t.fresh = false; }
  for (const [k, t] of touches) if (t.up) touches.delete(k);
  return out;
};

let wheelAcc = 0;
canvas.addEventListener('wheel', (e) => { wheelAcc += e.deltaY * (e.deltaMode === 1 ? 32 : 1) / scaleNow(); e.preventDefault(); }, { passive: false });
const takeWheel = () => { const v = wheelAcc; wheelAcc = 0; return v; };

// ---- real 3D horses and riders (presentation layer, platform/view3d) ---------------------------------------------------------------
// The sim and the 2D scene own everything; src/scene.js asks globalThis.__riders3d to render each rider into an atlas and blits it, and keeps
// its 2D horse rig when the layer is missing (no WebGL2, a failed load, a lost context) or when the page is opened with ?fig=2d.
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (qs.get('fig') !== '2d' && hasWebGL2()) {
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  const look = (kit, trim, horse) => ({ kit, trim, horse });
  import('./view3d/riders.js')
    .then((m) => m.createRiders({ quality: weak ? 'low' : 'medium', max: 8, looks: [look('#5a6b8c', '#f2c14e', '#3b2a22'), look('#c9772e', '#fff1cf', '#8a5a33')] }))
    .then((api) => {
      globalThis.__riders3d = api || null;
      // the real 3D pitch under the 2D canvas adopts the rider models (view3d/field3d.js); without it the atlas + painted pitch play
      if (api && !qs.has('field2d')) import('./view3d/field3d.js').then((fm) => { globalThis.__field3d = fm.createField3d({ kitCanvas: canvas, riders: api, quality: weak ? 'low' : 'medium' }); }).catch((e) => { console.warn('3D pitch unavailable, painted pitch stays', e); globalThis.__field3d = null; });
    })
    .catch((e) => { console.warn('3D riders unavailable, using the 2D picture', e); globalThis.__riders3d = null; });
  import('./view3d/stands.js')
    .then((m) => m.createStands({ quality: weak ? 'low' : 'medium', perTier: weak ? 26 : 36 }))
    .then((api) => { globalThis.__stands3d = api || null; })
    .catch((e) => { console.warn('3D stands unavailable, using the flat crowd', e); globalThis.__stands3d = null; });
}
// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
}).catch(() => {});
const shot = qs.has('shot');
const wrap = (game) => { if (qs.has('dev')) window.__game = game; return game; };
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
boot({ createGame: async (env) => wrap(await createGame({ ...env, touches: touchSnapshot, wheel: takeWheel, config: shot ? { ...env.config, shot: true } : env.config })), meta, canvas, background: '#0e1630' });
