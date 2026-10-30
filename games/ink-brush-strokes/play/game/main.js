import './src/safecanvas.js';
import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host, layoutFor } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { setCanvasFactory } from './src/art.js';
import { attachPen } from './src/pen.js';
import { v3 } from './src/v3.js';
import { ABOUT } from './src/content.js';

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

// 3D presenter (a scholar's desk by a paper window: felt mat, ink stone, brush, the sheet lit by daylight). The game boots at once on the flat
// 2D art; three.js is fetched and the scene built in small slices after the first frames, then it crossfades in. No WebGL, ?flat=1 or a lost
// context: the flat art stays. The presenter reads what the screens ask for (v3.want) and only maps pointer positions through its camera.
let presenter = null, inner = null, capt = false;
const bg = { toString: () => (v3.on && v3.fade > 0.02 ? 'rgba(0,0,0,0)' : '#0c1214') };     // read by the kit every frame, so the switch is instant
const wrap = (g) => Object.assign(Object.create(g), g, {
  update(dt, input) {
    const p = input.pointer;
    if (v3.on && presenter && v3.map.active && v3.map.to) {
      const sk = v3.map.skip && v3.map.skip.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      if (sk && !capt) return g.update(dt, input);
      if (p.pressed) capt = !!v3.map.to(p.x, p.y).inside; else if (!p.down) capt = false;
      const m = v3.map.to(p.x, p.y);
      if (p.down ? capt : m.inside) return g.update(dt, { ...input, pointer: { ...p, x: m.x, y: m.y } });
    } else capt = false;
    return g.update(dt, input);
  },
  render(ctx, view) { if (v3.on) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); } g.render(ctx, view); if (v3.on && presenter) presenter.post(); },
});
boot({ createGame: async (env) => (inner = wrap(await create(env))), meta, canvas, background: bg });
if (q.has('dev')) { Object.defineProperty(window, '__p3', { get: () => presenter }); window.__v3 = v3; }
if (!q.has('flat')) {
  const start = () => import('./view3d/presenter.js').then((m) => m.createPresenter({ kitCanvas: canvas })).then((p) => {
    if (!p.ok) return;
    const go = () => { if (!inner) return setTimeout(go, 30); presenter = p; p.attach(); };
    go();
  }).catch((e) => console.warn('3D presenter unavailable; flat art stays', e));
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 30)));   // let the flat title paint and become interactive first
}

// Credits for the 3D layer (three.js, view3d), shown at the end of About (fetched once the title is up).
setTimeout(() => fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((md) => {
  if (!md) return;
  const body = [];
  for (const part of md.split(/\n\s*\n/)) { const t = part.trim(); if (t && !t.startsWith('#')) body.push(t.replace(/\s*\n\s*/g, ' ').replace(/[`*_]/g, '')); }
  if (body.length) { ABOUT.push({ h: '3D graphics credits' }); for (const t of body) ABOUT.push({ p: t }); }
}).catch(() => {}), 400);
