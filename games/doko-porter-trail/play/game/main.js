import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { DOCS } from './src/content.js';
import { createPresenter } from './view3d/presenter.js';

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
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Screenshot and layout scripts: ?scene=name[:arg[:arg]] puts the game in a real moment (see applyScene). With ?shot=1 and no
// ?scene the seed picks the moment, so the store screenshot tool (which passes seed and ticks) can show different screens.
const params = new URLSearchParams(window.location.search);
const SHOT_SEEDS = { 1: 'title', 2: 'play:5:70', 3: 'bridge', 4: 'hint:4:30', 5: 'auto', 6: 'journey', 7: 'over', 8: 'steps', 9: 'rules:2' };
function applyScene(game, spec) {
  const [name, a, b] = spec.split(':'), d = game.dev;
  if (params.has('text')) d.setPrefs({ textIdx: Number(params.get('text')) });
  if (params.has('assist')) d.setPrefs({ assist: params.get('assist') === '1' });
  if (name === 'journey') d.go('journey');
  else if (name === 'howto' || name === 'rules' || name === 'about') d.doc(name, Number(a ?? 0));
  else if (name === 'settings') d.go('settings');
  else if (name === 'play') { d.trail(Number(a ?? 0)); d.toX(Number(b ?? 0)); }
  else if (name === 'bridge') { d.trail(5); d.toX(25.5); }
  else if (name === 'steps') { d.trail(4); d.toX(38); }
  else if (name === 'hint') { d.trail(Number(a ?? 4)); d.toX(Number(b ?? 30)); d.hint(); }
  else if (name === 'auto') { d.auto(); d.fast(25); }
  else if (name === 'over') { d.trail(Number(a ?? 3)); d.toX(30); d.end('arrived'); }
  else if (name === 'lost') { d.trail(Number(a ?? 3)); d.toX(30); d.end('lost'); }
  else if (name === 'long') { d.long(); d.toX(Number(a ?? 40)); }
  else if (name === 'spill') { d.trail(Number(a ?? 4)); d.toX(Number(b ?? 30)); d.poke({ a: 0.56 }); d.fast(0.4); }
  else if (name === 'pause') { d.trail(Number(a ?? 2)); d.toX(Number(b ?? 20)); d.pause?.(); }
}
// Developer/test hook (?dev=1 or the Developer toggle): expose the game for the layout and screenshot scripts.
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev) window.__sdk = game;
  const spec = params.get('scene') ?? (params.has('shot') ? SHOT_SEEDS[Number(params.get('seed'))] : null);
  if (spec && !env.config.demo) applyScene(game, spec);
  return game;
};

// ---- the 3D scene (web/view3d): hillside, trail and porter behind the transparent kit canvas. Without WebGL2 (or after a lost context)
// src/mode3d.js says so and the 2D scene in src/scene.js is drawn exactly as before. ?fig=2d forces the 2D picture.
let presenter = null;
if (!/[?&]fig=2d/.test(window.location.search)) {
  try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }
}
if (presenter && window.__dev3d !== false && new URLSearchParams(window.location.search).has('dev')) window.__presenter = presenter;
const wrap = (g) => (presenter && presenter.stage ? presenter.wrap(g) : g);

// The 3D layer's licence text, shown with the other credits (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const pg = DOCS.about.pages.find((x) => x.title === 'Credits');
  if (pg && paras.length > 1) { pg.blocks.push({ h: 'Credits: 3D people and tools' }); for (const q of paras.slice(2)) pg.blocks.push({ p: q }); }
}).catch(() => {});

const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

boot({ createGame: async (env) => wrap(await create(env)), meta, canvas, background: 'rgba(0,0,0,0)' });
