import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setMeasureCtx } from './src/menus.js';
import * as MN from './src/menus.js';
import { setLogo, setLockup } from './src/brand.js';
import { ABOUT } from './src/content.js';

const canvas = document.getElementById('game');
const qs = new URLSearchParams(location.search);

// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px. The layout works in
// virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
try { setMeasureCtx(document.createElement('canvas').getContext('2d')); } catch { /* estimate */ }
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);

const wrap = (game) => { if (qs.has('dev')) { window.__game = game; window.__MN = MN; } return game; };
const shot = qs.has('shot');
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// The lit 3D trail is drawn in a WebGL canvas BEHIND the kit canvas (transparent: it keeps the HUD, the menus and every input).
// The game boots on the flat 2D art at once; the 3D presenter is built in slices in the background and crossfades in when ready.
// Without WebGL, or after a lost context, every screen keeps drawing the flat 2D trail.
let presenter = null, wrapped = null, theGame = null;
const attach = (p) => {
  if (!p || !p.stage) return;
  presenter = p;
  if (qs.has('dev')) window.__p3 = p;
  fetch('./vendor3d/LICENSES.md').then((r) => r.text()).then((t) => {
    const paras = t.split(/\n\s*\n/).map((x) => x.replace(/\n/g, ' ').trim()).filter((x) => x && !x.startsWith('#') && !/^Games that ship/.test(x));
    if (paras.length && !ABOUT.some((a) => a.title === '3D credits and licences')) ABOUT.push({ title: '3D credits and licences', p: paras });
  }).catch(() => {});
  if (theGame) wrapped = p.wrap(theGame);
};
const loadPresenter = async () => {
  if (qs.has('flat')) return;
  try { const { createPresenter } = await import('./view3d/presenter.js'); attach(await createPresenter({ kitCanvas: canvas })); } catch (e) { console.warn('3D presenter unavailable', e); }
};
const pending = loadPresenter();
if (shot) await pending;   // store screenshots are always the 3D scene
boot({
  createGame: async (env) => {
    const g = wrap(await createGame({ ...env, config: { ...env.config, dev: env.config.dev || qs.has('dev'), ...(shot ? { shot: true, shotSeed: qs.get('seed') } : {}) } }));
    theGame = g; if (presenter) wrapped = presenter.wrap(g);
    return { ...g, render(ctx, view) { (wrapped || g).render(ctx, view); } };
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
});
