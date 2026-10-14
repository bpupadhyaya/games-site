import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');
let game = null;

// Host safe areas (notch, home indicator) and the floating back button, converted to virtual units (short side = 720).
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); });

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'solo', round: 4, run: true, advance: 12, until: 'pass', hold: true },
  3: { scene: 'play', mode: 'auto', round: 0, advance: 1 },
  4: { scene: 'play', mode: 'party', setup: { players: 3, startRound: 3 }, run: true, advance: 12, until: 'pass', hold: true },
  5: { scene: 'play', mode: 'solo', round: 8, run: true, advance: 14, untilX: -0.17, hold: true, score: 1240 },
  6: { scene: 'result' },
  7: { scene: 'setup', kind: 'party' },
  8: { scene: 'rules', page: 1 },
};
let presenter = null;
const flat = q.has('flat') || q.get('fig') === '2d';
if (!flat) { try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable, using the 2D beach', e); presenter = null; } }
if (presenter && !presenter.ok) presenter = null;
if (presenter && q.has('shot')) presenter.shot = true;
const create = async (env) => {
  game = await createGame(env);
  if (presenter) { game = presenter.wrap(game); if (q.has('dev')) window.__presenter = presenter; }
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__limbo = game;
    if (q.has('scene')) game.dev.jump({ scene: q.get('scene'), mode: q.get('mode') ?? 'solo', page: Number(q.get('page') ?? 0), round: q.has('round') ? Number(q.get('round')) : undefined, advance: Number(q.get('adv') ?? 0), until: q.get('until') ?? undefined, hold: q.has('hold'), untilX: q.has('ux') ? Number(q.get('ux')) : undefined, run: q.has('run'), noai: q.has('noai'), wobble: q.has('wobble') ? Number(q.get('wobble')) : undefined, lean: q.has('lean') ? Number(q.get('lean')) : undefined, pause: q.has('pause'), think: q.has('think'), kind: q.get('kind') ?? undefined, setup: q.has('players') ? { players: Number(q.get('players')), startRound: Number(q.get('start') ?? 0) } : undefined, pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ title: 'Credits: 3D people and tools', p: paras.slice(2) });
}).catch(() => {});

boot({ createGame: create, meta, canvas, background: presenter ? 'rgba(0,0,0,0)' : '#1a0a2e' });
