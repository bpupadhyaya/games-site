import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { addAboutCredits } from './src/content.js';

// Store screenshots (`?shot=1&seed=<showcase seed>`) show real mid-race positions. Seeds 9001..9007 pick a position; the
// scene then ignores the random shot-mode "monkey" input so it stays put. Every other URL and every real player is unaffected.
// Host safe areas (notch, home indicator) and the floating back button (hub builds only): the shell publishes window.__safeInsets in
// CSS px. The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
// In standalone builds there is no host back button (host.back stays 0): the game's own Menu / Leave buttons are the way out.
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
const loadImg = (src, done) => { const im = new Image(); im.onload = () => done(im); im.src = src; };
loadImg('./brand/arcforge-af.png', setLogo);
loadImg('./brand/arcforge-lockup.png', setLockup);

const params = new URLSearchParams(globalThis.location.search);
const SHOWCASE_SEEDS = { 9001: 'hold', 9002: 'wind', 9003: 'bump', 9004: 'burrow', 9005: 'win', 9006: 'setup', 9007: 'autoplay', 9008: 'rules3', 9009: 'rules1', 9010: 'settings3', 9011: 'over' };
const showcase = params.has('shot') ? SHOWCASE_SEEDS[Number(params.get('seed'))] : undefined;
const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

const create = showcase
  ? async (env) => { env.config.showcase = showcase; const game = await createGame(env); return { ...game, update: (dt) => game.update(dt, idle), isPreviewExempt: () => true }; }
  : createGame;

// 3D presenter (felt trail on the steppe + the ankle bones on a rug, behind the kit canvas). The game boots at once on the flat 2D
// art (styled title in the first frame); three.js is fetched and the scene built after that, then crossfades in. No WebGL or a lost
// context: the flat art stays. The presenter only reads game state.
let presenter = null, inner = null, devOn = false;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#1a1206') };     // read by the kit every frame, so the switch is instant
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
const devCreate = async (env) => {
  const game = wrap(await create(env)); inner = game; devOn = Boolean(env.config.dev);
  if (devOn) { window.__game = game; window.__v3 = v3; Object.defineProperty(window, '__p3', { get: () => presenter }); }
  return game;
};
boot({ createGame: devCreate, meta, canvas: document.getElementById('game'), background: bg });
{
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: cv, dev: devOn })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  // let the flat title paint and become interactive first
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About.
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  addAboutCredits(md.split(/\n\s*\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#')).map((t) => t.replace(/\s*\n\s*/g, ' ').replace(/[`*]/g, '')).join(' '));
}).catch(() => {});
