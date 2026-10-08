import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host, layoutFor } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { setCanvasFactory } from './src/art.js';
import { attachPen } from './src/pen.js';

const canvas = document.getElementById('game');
let game = null;
attachPen(canvas);
if (typeof OffscreenCanvas === 'undefined') setCanvasFactory((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });

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
  1: { scene: 'title', advance: 2.2 }, 2: { scene: 'practice', lesson: 'da', strokes: 2 }, 3: { scene: 'practice', lesson: 'bamboo', strokes: 5 }, 4: { scene: 'free' },
  5: { scene: 'about' }, 6: { scene: 'result', lesson: 'ren' }, 7: { scene: 'gallery' }, 8: { scene: 'rules', page: 2 }, 9: { scene: 'lessons' }, 10: { scene: 'practice', lesson: 'shan', strokes: 1, hint: true },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__ink = game;
    window.__inkCss = (vx, vy) => { const r = canvas.getBoundingClientRect(), scale = Math.min(canvas.width / meta.width, canvas.height / meta.height), k = r.width / canvas.width; return { x: r.left + (vx * scale + (canvas.width - meta.width * scale) / 2) * k, y: r.top + (vy * scale + (canvas.height - meta.height * scale) / 2) * k }; };
    window.__inkPaper = () => { const st = game.getState(), L = layoutFor(meta.width, meta.height, st.scene === 'free' ? 9 : st.ps && st.ps.mode === 'auto' ? 2 : 7, 0), P = L.play, a = window.__inkCss(P.paper.x, P.paper.y), b = window.__inkCss(P.paper.x + P.paper.w, P.paper.y + P.paper.h), t = L.play.tools.map((r) => window.__inkCss(r.x + r.w / 2, r.y + r.h / 2)); return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, tools: t, seals: P.seals.map((r) => window.__inkCss(r.x + r.w / 2, r.y + r.h / 2)) }; };
    window.__inkStone = () => { const G = layoutFor(meta.width, meta.height, 9, 0).grind.stone, c = window.__inkCss(G.x, G.y), e = window.__inkCss(G.x + G.rx, G.y + G.ry); return { x: c.x, y: c.y, rx: e.x - c.x, ry: e.y - c.y }; };
    if (q.has('scene')) {
      const jump = { scene: q.get('scene'), lesson: q.has('lesson') ? q.get('lesson') : undefined, strokes: q.has('strokes') ? Number(q.get('strokes')) : undefined, page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0), hint: q.has('hint'), pause: q.has('pause'), grind: q.has('grind'), scroll: q.has('scroll') ? Number(q.get('scroll')) : undefined, sealMode: q.has('seal'), pref: q.has('pref') ? JSON.parse(q.get('pref')) : undefined };
      game.dev.jump(jump);
    }
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

boot({ createGame: create, meta, canvas, background: '#0c1214' });
