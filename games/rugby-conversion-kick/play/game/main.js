import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';

// The 3D stadium is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D picture.
const canvas = document.getElementById('game');
const q = new URLSearchParams(location.search);
// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px (browsers: none).
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('orientationchange', () => setTimeout(syncHost, 200));
window.addEventListener('safeinsets', syncHost);
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';
let presenter = null;
try { const { createPresenter } = await import('./view3d/presenter.js'); presenter = await createPresenter({ kitCanvas: canvas, meta }); } catch (e) { console.warn('3D presenter unavailable', e); }

// Mouse wheel / trackpad scroll for the long text pages (virtual units; consumed by the game once per frame)
const wheel = (() => {
  let acc = 0;
  canvas.addEventListener('wheel', (e) => { const r = canvas.getBoundingClientRect(); const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? r.height : 1; acc += e.deltaY * k * (720 / Math.max(1, Math.min(r.width, r.height))); acc = Math.max(-4000, Math.min(4000, acc)); e.preventDefault(); }, { passive: false });
  return { take() { const v = acc; acc = 0; return v; } };
})();

const haptic = (kind, ms) => { try { if (window.ArcforgeHaptics && window.ArcforgeHaptics.pulse) window.ArcforgeHaptics.pulse(kind); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no haptics */ } };
const wrap = (game) => {
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.autoPause?.(); });
  if (q.has('dev')) { window.__game = game; window.__presenter = presenter; }   // dev only: lets the test harness read the state
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = q.has('shot');

const devCfg = q.has('dev') ? { dev: true, devScene: q.get('scene') || '', devText: q.has('tx') ? +q.get('tx') : null } : {};
boot({ createGame: async (env) => wrap(await createGame({ ...env, wheel, haptic, config: shot ? { ...env.config, ...devCfg, shot: true, shotKind: q.get('kind') || 'ready', shotAt: +q.get('at') || 2, nohud: q.has('nohud') } : { ...env.config, ...devCfg } })), meta, canvas, background: 'rgba(0,0,0,0)' });
