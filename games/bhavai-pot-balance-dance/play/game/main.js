import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

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
  2: { scene: 'play', mode: 'dance', course: 0, advance: 14, play: true },
  3: { scene: 'play', mode: 'dance', course: 5, advance: 26, play: true },
  4: { scene: 'courses' },
  5: { scene: 'about' },
  6: { scene: 'result', course: 1 },
  7: { scene: 'detail', course: 3 },
  8: { scene: 'rules', page: 2 },
};
// ---- the 3D courtyard (presentation layer, platform/view3d) -------------------------------------------------------------------------
// The simulation and the 2D overlay own everything; the presenter (view3d/presenter.js) only reads state.v3 and draws the courtyard, the
// dancer, the pots and the band behind the transparent 2D canvas. ?no3d=1, no WebGL2 or a lost context keeps the painted courtyard.
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
const lowEnd = (navigator.hardwareConcurrency || 8) <= 3 || (navigator.deviceMemory || 4) <= 2;
let presenter = { ok: false, wrap: (g) => g };
// Boot first (the 2D title is interactive at once); the 3D courtyard is built after the first frames, in slices, and attached to the live game.
const attach3d = (g) => {
  if (q.has('no3d') || /[?&]fig=2d/.test(globalThis.location.search) || !hasWebGL2()) return;
  const go = async () => {
    try {
      const { createPresenter } = await import('./view3d/presenter.js');
      const p = await createPresenter({ kitCanvas: canvas, quality: q.get('q') || (lowEnd ? 'low' : 'medium') });
      if (p.ok) { presenter = p; globalThis.__bhv3d = p; p.wrap(g); }
    } catch (e) { console.warn('3D courtyard unavailable, using the painted one', e); }
  };
  setTimeout(go, 350);
};

// The vendored 3D layer's licence text, shown with the other About text (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) { ABOUT.blocks.push({ h: 'Credits: 3D people and tools' }); for (const q of paras.slice(2)) ABOUT.blocks.push({ p: q }); }
}).catch(() => {});

const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__bhv = game;
    if (q.has('scene')) {
      game.dev.jump({ scene: q.get('scene'), course: Number(q.get('course') ?? 0), mode: q.get('mode') ?? 'dance', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), play: q.has('play'), pause: q.has('pause'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined });
    }
  }
  attach3d(game);
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
