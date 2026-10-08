import { boot } from './kit/index.js';
import { createGame, meta, wheelInput, host, touch } from './src/game.js';
import { setLogo } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';

const canvas = document.getElementById('game');

// Safe areas (notch, home indicator) and the host's floating back button, converted to virtual units (short side = 720).
const unit = () => 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
const syncHost = () => {
  const px = unit(), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * unit() * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Every finger is tracked on its own (the left thumb steers while the right one taps the drum). The kit still gets the
// primary pointer for menus; the race reads these raw events.
const toVirtual = (e) => {
  const cpu = meta.cssPerUnit || 1 / unit();
  const offX = (window.innerWidth - meta.width * cpu) / 2, offY = (window.innerHeight - meta.height * cpu) / 2;
  return { x: (e.clientX - offX) / cpu, y: (e.clientY - offY) / cpu };
};
const push = (type) => (e) => { touch.ev.push({ type, id: e.pointerId, ts: e.timeStamp, ...toVirtual(e) }); if (touch.ev.length > 64) touch.ev.splice(0, 32); };
touch.now = () => performance.now();
canvas.addEventListener('pointerdown', push('down'));
canvas.addEventListener('pointermove', push('move'));
canvas.addEventListener('pointerup', push('up'));
canvas.addEventListener('pointercancel', push('up'));

// Fonts load in the background; the canvas picks them up as soon as they arrive.
for (const f of ['800 40px "Barlow Condensed"', '600 20px "Barlow"', '800 20px "Barlow"']) document.fonts?.load(f).catch(() => {});
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

// 3D: quality is chosen once from the device (touch devices get the light tier: 22 skinned athletes x 4 boats is heavy for a mid phone); if WebGL is missing the presenter reports not ok and the 2D course view takes over.
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 4) <= 2;
const presenter = await createPresenter({ kitCanvas: canvas, quality: new URLSearchParams(location.search).get('q') || (lowEnd || navigator.maxTouchPoints > 0 ? 'low' : 'high') });
canvas.addEventListener('pointerdown', () => presenter.sfx?.unlock(), { once: true });
window.__dbr = { presenter };

const create = async (env) => {
  const game = await createGame(env);
  game.setGl(presenter.ok);
  fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => game.setLicenses(t.split('\n').filter((l) => !/must show|fetch\(|vendor3d|public text|keep it/i.test(l)).join('\n'))).catch(() => {});
  if (env.config.dev) window.__db = game;
  return presenter.ok ? presenter.wrap(game) : game;
};

boot({ createGame: create, meta, canvas, background: 'rgba(0,0,0,0)' });
