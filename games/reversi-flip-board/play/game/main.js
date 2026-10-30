import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { addAboutCredits } from './src/content.js';

const canvas = document.getElementById('game');

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const q0 = new URLSearchParams(location.search);
if (q0.has('dev') && q0.has('insets')) { const [t, r, b, l, back] = q0.get('insets').split(',').map(Number); window.__safeInsets = { top: t, right: r, bottom: b, left: l, back: !!back }; window.__hostBack = !!back; }   // dev: simulate a notch / the host back button
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px; host.dpr = Math.min(2, window.devicePixelRatio || 1);
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
// Mouse wheel scrolls the document screens (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev / screenshot hook: ?shot=1&scene=... (JSON in `spec`) puts the game in a given screen. Not reachable in production flows.
const q = new URLSearchParams(location.search);
const FLIPPING = ['........', '........', '..B.B.B.', '...WWW..', '.BWW.W..', '....W...', '....B...', '........'];
const PRESETS = {
  1: { scene: 'title', t: 1.8 }, 2: { scene: 'doc', doc: 'about' }, 3: { scene: 'play', plies: 17 }, 4: { scene: 'play', board: FLIPPING, turn: 1, play: 36, animT: 0.42, hints: 'counts' },
  5: { scene: 'doc', doc: 'rules', scroll: 900 }, 6: { scene: 'play', variant: 'mini', plies: 9, cloth: 'midnight', style: 'coral', hints: 'counts' }, 7: { scene: 'auto', plies: 14 }, 8: { scene: 'lesson', lesson: 2 },
};
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__rv = game;
  if (!q.has('spec') && q.has('shot') && PRESETS[q.get('seed')]) game.devScene(PRESETS[q.get('seed')]);   // `arc shots`: seed N picks store shot N (store/shots.json)
  if (q.has('spec')) { try { game.devScene(JSON.parse(q.get('spec'))); } catch (e) { console.error(e); } }
  return game;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (a limestone board with a zellige border on a rug in a sunlit courtyard, behind the kit canvas). The game boots at once on
// the flat 2D art (styled title in the first frame); three.js is fetched and the scene built after that, then crossfades in. No WebGL,
// ?flat=1 or a lost context: the flat art stays. The presenter only reads game state.
let presenter = null, inner = null;
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : '#050b0e') };     // read by the kit every frame, so the switch is instant
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
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); window.__v3At = performance.now(); };
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
