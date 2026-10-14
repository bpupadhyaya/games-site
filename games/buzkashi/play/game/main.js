import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setMeasureCtx } from './src/menus.js';
import * as MN from './src/menus.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
const qs = new URLSearchParams(location.search);

// Multi-touch: the kit exposes one pointer, but riding needs one thumb on the field and another on Grab, Shield or Spur. This tracks every
// finger on the canvas (in the game's live virtual coordinates) and hands the game a read-only snapshot function. Input only.
const touches = new Map();
// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in
// virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
try { setMeasureCtx(document.createElement('canvas').getContext('2d')); } catch { /* estimate */ }
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

// css px on the canvas to the live virtual units of the fluid viewport (one scale for both axes, centred; meta.width/height are kept live by the kit)
const scaleNow = () => Math.min((canvas.clientWidth || 720) / meta.width, (canvas.clientHeight || 1280) / meta.height);
const virt = (e) => {
  const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280, r = canvas.getBoundingClientRect();
  const u = e.clientX - r.left, v = e.clientY - r.top, s = scaleNow();
  return { x: (u - W / 2) / s + meta.width / 2, y: (v - H / 2) / s + meta.height / 2 };
};
const onDown = (e) => { const p = virt(e); touches.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y, down: true, fresh: true, up: false }); };
const onMove = (e) => { const t = touches.get(e.pointerId); if (t) { const p = virt(e); t.x = p.x; t.y = p.y; } };
const onUp = (e) => { const t = touches.get(e.pointerId); if (t) { t.down = false; t.up = true; } };
canvas.addEventListener('pointerdown', onDown, true);
canvas.addEventListener('pointermove', onMove, true);
canvas.addEventListener('pointerup', onUp, true);
canvas.addEventListener('pointercancel', onUp, true);
const releaseAll = () => { for (const t of touches.values()) { t.down = false; t.up = true; } };
window.addEventListener('blur', releaseAll);
// a rotation or resize cleanly releases every held finger (the new layout puts the controls somewhere else)
window.addEventListener('resize', releaseAll);
window.addEventListener('orientationchange', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
// the game calls this once per tick: the live fingers plus those released since the last call, then the released ones are forgotten
const touchSnapshot = () => {
  const out = [];
  for (const t of touches.values()) { out.push({ ...t }); t.fresh = false; }
  for (const [k, t] of touches) if (t.up) touches.delete(k);
  return out;
};

// ---- the 3D field (presentation layer, platform/view3d: horse3d, crowd3d, scenery3d) -----------------------------------------------------
// The sim owns everything; src/scene.js asks globalThis.__field3d to render the whole field and blits it behind the HUD, and keeps its flat 2D
// drawing when the layer is missing (no WebGL2, a failed load, a lost context) or when opened with ?fig=2d.
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (qs.get('fig') !== '2d' && hasWebGL2()) {
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  const q = qs.get('q') || (weak ? 'low' : 'medium');
  Promise.all([import('./view3d/field3d.js'), import('./src/scene.js')])
    .then(([m, sc]) => m.createField3d({ quality: q, groundCanvas: sc.groundCanvas, base: new URL('./assets3d/', location.href).href, sceneryBase: new URL('./assets3d/scenery/', location.href).href }))
    .then((api) => { globalThis.__field3d = api || null; if (api) api.setQuality = api.setQuality.bind(api); })
    .catch((e) => { console.warn('3D field unavailable, using the flat picture', e); globalThis.__field3d = null; });
}
// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
}).catch(() => {});
const wrap = (game) => { if (qs.has('dev')) { window.__game = game; window.__MN = MN; } return game; };
const shot = qs.has('shot');
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
boot({
  createGame: async (env) => wrap(await createGame({
    ...env, touches: touchSnapshot,
    config: { ...env.config, dev: env.config.dev || qs.has('dev'), ...(shot ? { shot: true, shotSeed: qs.get('seed'), shotTicks: qs.get('ticks') } : {}) },
  })),
  meta, canvas, background: '#0a1020',
});
