import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setMeasureCtx } from './src/menus.js';
import * as MN from './src/menus.js';
import { ABOUT } from './src/content.js';
import { setLogo, setLockup } from './src/brand.js';

const canvas = document.getElementById('game');
const qs = new URLSearchParams(location.search);

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

// ---- the lane in real 3D: horse3d horse + rider, lance, crowd3d stands, scenery (presentation layer, platform/view3d) ----------------------------------
// src/scene.js draws globalThis.__lane3d under the HUD when it is ready and keeps the painted lane when the layer is missing (no WebGL2, a failed
// load, a lost context) or when the page is opened with ?fig=2d.
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (qs.get('fig') !== '2d' && hasWebGL2()) {
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  import('./view3d/lane3d.js')
    .then((mod) => mod.createLane3d({ quality: qs.get('q') || (weak ? 'low' : 'medium') }))
    .then((api) => { globalThis.__lane3d = api || null; })
    .catch((e) => { console.warn('3D lane unavailable, using the painted picture', e); globalThis.__lane3d = null; });
}
// The vendored 3D layer's licence text, shown on the About page (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D models and tools', p: paras.slice(2) });
}).catch(() => {});
const wrap = (game) => { if (qs.has('dev')) { window.__game = game; window.__MN = MN; } return game; };
const shot = qs.has('shot');
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
boot({ createGame: async (env) => wrap(await createGame({ ...env, config: { ...env.config, dev: env.config.dev || qs.has('dev'), ...(shot ? { shot: true, shotSeed: qs.get('seed') } : {}), ...(qs.has('bare') ? { iconShot: true } : {}) } })), meta, canvas, background: '#0b1630' });
