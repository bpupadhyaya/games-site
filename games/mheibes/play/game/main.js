import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { loadHands } from './src/art.js';
import { v3 } from './src/v3.js';

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

// Dev / screenshot hook: ?shot=1&seed=N picks a preset (store/shots.json entry N); ?spec=<json> puts the game in any screen. Not reachable in production flows.
// Fists are numbered player * 2 + side (side 0 = left as seen). Players 0 1 2 across the back, 3 4 in front.
const q = new URLSearchParams(location.search);
const PRESETS = {
  1: { scene: 'title' },
  2: { scene: 'doc', doc: 'about' },
  3: { scene: 'play', ring: 5, performer: 2, team: [{ pers: 'open' }, { pers: 'steady' }, { pers: 'showman' }, { pers: 'jittery' }, { pers: 'open' }], stares: [{ p: 1, kind: 'calm' }, { p: 2, kind: 'tense' }], tell: { p: 3, kind: 'glance', side: 1 }, open: [0, 8], sel: 6, msg: 'That player glanced at the right fist. 2 stares left.' },
  4: { scene: 'play', round: 1, ring: 6, performer: 0, open: [], tell: { p: 4, kind: 'tense' }, msg: 'You are hiding. Your team is being read.' },
  5: { scene: 'doc', doc: 'rules', scroll: 700 },
  6: { scene: 'play', ring: 1, open: [0, 2, 4, 6, 8, 9], stares: [{ p: 0, kind: 'calm' }, { p: 2, kind: 'glance', side: 1 }], sel: 3, msg: 'Six fists are open. Bas the ring or Bat once more?' },
  7: { scene: 'auto', ring: 3, stares: [{ p: 1, kind: 'tense' }], hint: { p: 1 }, msg: 'Auto Play: the seeker is thinking. What would you do?' },
  8: { scene: 'lesson', lesson: 2, tell: { p: 1, kind: 'tense' } },
  9: { scene: 'play', ring: 7, open: [0, 1, 4], end: 'right', score: [5, 2] },
};
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__mh = game;
  if (!q.has('spec') && q.has('shot') && PRESETS[q.get('seed')]) game.devScene(PRESETS[q.get('seed')]);   // `arc shots`: seed N picks store shot N
  if (q.has('spec')) { try { game.devScene(JSON.parse(q.get('spec'))); } catch (e) { console.error(e); } }
  return game;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// 3D layer: the flat 2D game boots at once (first interactive frame needs no WebGL); the presenter module (three.js) is imported after,
// builds its scene in slices, compiles async and then crossfades in. No WebGL / context lost -> the 2D art keeps working.
let pres = null;
const withPresenter = (game) => Object.assign({}, game, {
  update(dt, input) { const p = input && input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null; return game.update(dt, input); },
  render(ctx, view) { if (v3.on && pres) pres.frame(game, ctx, view); else game.render(ctx, view); },
});
boot({ createGame: async (env) => withPresenter(await create(env)), meta, canvas, background: 'rgba(0,0,0,0)' });
loadHands();
window.__arcV3 = v3;   // read-only probe for the screenshot renderer: waits for v3.on
if (!q.has('flat')) {
  setTimeout(async () => {
    try {
      const mod = await import('./view3d/presenter.js');
      pres = await mod.createPresenter({ kitCanvas: canvas });
      if (q.has('dev')) window.__p3 = pres;
      await pres.init();
    } catch (e) { console.warn('3D presenter unavailable', e); v3.on = false; }
  }, 30);
}
