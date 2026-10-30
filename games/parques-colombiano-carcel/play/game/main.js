import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { ABOUT } from './src/content.js';
import * as LAYOUT from './src/layout.js';
import { host } from './src/layout.js';
import { screenButtons, screenLayout } from './src/ui.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';

// Store screenshots (`?shot=1&seed=<showcase seed>`) show real mid-game positions. Seeds 9001..9005 pick a position; the
// scene then ignores the random shot-mode "monkey" input so it stays put. Every other URL and every real player is unaffected.
const params = new URLSearchParams(globalThis.location.search);
const SHOWCASE_SEEDS = { 9001: 'race', 9002: 'capture', 9003: 'pass', 9004: 'pair', 9005: 'win', 9006: 'setup' };
const showcase = params.has('shot') ? SHOWCASE_SEEDS[Number(params.get('seed'))] : undefined;
const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
// Standalone builds have no host back button (host.back = 0); the game's own Pause -> Leave game / Menu path is always reachable.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
const cv = document.getElementById('game');
if (cv) cv.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// dev check pages can force insets / a back button without the shell: ?inset=t,r,b,l&back=1
if (params.has('inset')) { const [t, r, b, l] = params.get('inset').split(',').map(Number); window.__safeInsets = { top: t || 0, right: r || 0, bottom: b || 0, left: l || 0 }; syncHost(); }
else if (params.has('back')) { window.__safeInsets = { top: 0, right: 0, bottom: 0, left: 0 }; syncHost(); }

const create = showcase
  ? async (env) => { env.config.showcase = showcase; const game = await createGame(env); return { ...game, update: (dt) => game.update(dt, idle), isPreviewExempt: () => true }; }
  : async (env) => { const game = await createGame(env); if (env.config.dev) { window.__pq = game; window.__pqUI = { screenButtons, screenLayout, LAYOUT }; } return game; };

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a lacquered parques board on a mochila cloth, behind the kit canvas). The game boots at once on the flat 2D art (styled
// title in the first frame); three.js is fetched and the scene built in small slices after that, then crossfades in. No WebGL, ?flat=1 or
// a lost context: the flat art stays. The presenter only reads game state.
let presenter = null, inner = null;
const FLAT_BG = '#140a05';
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : FLAT_BG) };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) {
    if (v3.on && presenter) {
      // the kit fills its background each frame; a transparent fill erases nothing, so clear the 2D layer here
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
      presenter.pre();
    }
    g.render(ctx, view);
    if (v3.on && presenter) presenter.post();
  },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas: document.getElementById('game'), background: bg });
if (params.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!params.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: document.getElementById('game') })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); window.__v3At = performance.now(); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  // let the flat title paint and become interactive first
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 450)));
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  ABOUT.push({ h: '3D graphics credits', p: md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')) });
}).catch(() => {});
