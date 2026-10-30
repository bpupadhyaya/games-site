import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { v3 } from './src/v3.js';
import { ABOUT } from './src/content.js';

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

// Dev / screenshot hook: ?shot=1&seed=N picks a preset scene (store/shots.json); ?spec=<json> puts the game in any screen. Not reachable in production flows.
const q = new URLSearchParams(location.search);
const PRESETS = {
  1: { scene: 'title' }, 2: { scene: 'doc', doc: 'about' }, 3: { scene: 'play', n: 5, steps: 9 }, 4: { scene: 'play', n: 6, steps: 20, hint: true },
  5: { scene: 'doc', doc: 'rules', scroll: 1500 }, 6: { scene: 'play', n: 9, steps: 140 }, 7: { scene: 'auto', n: 5, steps: 9, hint: true }, 8: { scene: 'lesson', lesson: 4, steps: 1 }, 9: { scene: 'over', n: 5, moves: 21 },
};
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__rings = game;
  if (!q.has('spec') && q.has('shot') && PRESETS[q.get('seed')]) game.devScene(PRESETS[q.get('seed')]);   // `arc shots`: seed N picks store shot N (store/shots.json)
  if (q.has('spec')) { try { game.devScene(JSON.parse(q.get('spec'))); } catch (e) { console.error(e); } }
  return game;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D presenter (lamp-lit desk and the puzzle in real lit metal, behind the kit canvas). The game boots at once on the flat 2D art (styled
// title in the first frames); three.js is fetched and the scene built in small slices after that, then it crossfades in. No WebGL, ?flat=1
// or a lost context: the flat art stays. The presenter only reads game state.
let presenter = null, inner = null;
const FLAT_BG = '#0a0608';
const bg = { toString: () => (v3.on ? 'rgba(0,0,0,0)' : FLAT_BG) };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  render(ctx, view) { if (v3.on && presenter) presenter.pre(); g.render(ctx, view); if (v3.on && presenter) presenter.post(); },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(inner); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));   // let the flat title paint and become interactive first
}
// Credits for the 3D layer (three.js, view3d), shown at the end of About (fetched once the title is up).
setTimeout(() => fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md || ABOUT.some((s) => s.title === '3D graphics credits')) return;
  const items = [];
  for (const part of md.split(/\n\s*\n/)) {
    const t = part.trim(); if (!t) continue;
    if (t.startsWith('#')) items.push({ k: 'h', t: t.replace(/^#+\s*/, '') }); else items.push({ k: 'p', t: t.replace(/\s*\n\s*/g, ' ').replace(/`/g, '') });
  }
  ABOUT.push({ title: '3D graphics credits', items });
}).catch(() => {}), 400);
