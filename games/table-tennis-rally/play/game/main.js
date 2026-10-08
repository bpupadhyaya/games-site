import { boot } from './kit/index.js';
import { createGame, meta, wheelInput, host } from './src/game.js';
import { setLogo } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');

// Safe areas (notch, home indicator) and the host's floating back button, converted to virtual units (short side = 720).
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Fonts load in the background; the canvas picks them up as soon as they arrive.
for (const f of ['800 40px "Barlow Condensed"', '600 20px "Barlow"', '800 20px "Barlow"']) document.fonts?.load(f).catch(() => {});
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// 3D: quality is chosen once from the device; if WebGL is missing the presenter reports not ok and the menus still work.
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 4) <= 2;
const presenter = await createPresenter({ kitCanvas: canvas, quality: lowEnd ? 'medium' : 'high' });
canvas.addEventListener('pointerdown', () => presenter.sfx?.unlock(), { once: true });
window.__ttr = { presenter };

const create = async (env) => {
  const game = await createGame(env);
  fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => game.setLicenses(t.split('\n').filter((l) => !/must show|fetch\(|vendor3d|public text|keep it/i.test(l)).join('\n'))).catch(() => {});
  if (env.config.dev) { window.__tt = game; }
  const wrapped = presenter.ok ? presenter.wrap(game) : game;
  const upd = wrapped.update.bind(wrapped);
  wrapped.update = (dt, input) => { upd(dt, input); presenter.sfx?.ambience(game.getState().scene === 'play' && !game.getState().paused); };
  return wrapped;
};

boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
