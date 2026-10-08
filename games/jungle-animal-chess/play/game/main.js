import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

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

// Dev / screenshot hook: ?shot=1&seed=N picks store shot N (store/shots.json); ?spec=<JSON> puts the game in any screen. Not reachable in production flows.
const q = new URLSearchParams(location.search);
// Boards: digits 1-8 are Red animals, letters a-h Blue animals (a rat .. h elephant). 7 columns x 9 rows.
const CAPTURE = ['g.....f', '.c...b.', 'e...h..', '.......', '.......', '.......', '8.6c5.1', '.3...2.', '7.....7'];
const MIDGAME = ['g.....f', '.d.....', 'ec..h..', '.......', '.....a.', '.......', '86.4.51', '.3.....', '......7'];
const PRESETS = {
  1: { scene: 'title' }, 2: { scene: 'doc', doc: 'about' },
  3: { scene: 'play', board: MIDGAME, turn: 1, gone: [10, 2], lost: [0, 1, 1], moves: 22, sel: 43, hint: undefined },
  4: { scene: 'play', board: CAPTURE, turn: 1, gone: [9, 11, 12, 2, 4], lost: [0, 2, 3], play: [44, 45], animT: 0.5 },
  5: { scene: 'doc', doc: 'rules', scroll: 1500 }, 6: { scene: 'lesson', lesson: 4, sel: 43 }, 7: { scene: 'auto', plies: 12 }, 8: { scene: 'lesson', lesson: 2 },
};
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__jg = game;
  if (!q.has('spec') && q.has('shot') && PRESETS[q.get('seed')]) game.devScene(PRESETS[q.get('seed')]);   // `arc shots`: seed N picks store shot N (store/shots.json)
  if (q.has('spec')) { try { game.devScene(JSON.parse(q.get('spec'))); } catch (e) { console.error(e); } }
  return game;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#07140f' });
