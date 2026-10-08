import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { createPresenter } from './view3d/presenter.js';
import { createStudioAudio } from './audio/studio.js';
import { camFor, project } from './src/cam.js';

const canvas = document.getElementById('game');
const audio = createStudioAudio();
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
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => audio.unlock(), { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && game && !new URLSearchParams(location.search).has('shot')) game.autoPause(); });

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', ch: 4, secs: 21 },
  3: { scene: 'play', ch: 4, station: 4, frac: 2.5 },
  4: { scene: 'play', ch: 4, station: 5, glazed: true },
  5: { scene: 'result', ch: 4 },
  6: { scene: 'shelf', fill: [4, 5, 7, 0, 9, 1] },
  7: { scene: 'pick' },
  8: { scene: 'rules', page: 3 },
};
const create = async (env) => {
  game = await createGame(env);
  fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => game.setCredits(t)).catch(() => {});
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump({ ...SHOT_SCENES[Number(q.get('seed'))], shot: true });
  if (env.config.dev) {
    window.__pw = game;
    window.__pwCss = (X, Y) => { const g = game.getState().g3, cam = camFor(g.W, g.H, g.rect, g.box), p = project(cam, X, Y, 0), r = canvas.getBoundingClientRect(); return { x: r.left + p.x * r.width / g.W, y: r.top + p.y * r.height / g.H }; };
    if (q.has('scene')) {
      const j = { scene: q.get('scene') };
      for (const k of ['ch', 'secs', 'station', 'trad', 'page', 'i', 'frac']) if (q.has(k)) j[k] = Number(q.get(k));
      if (q.has('fill')) j.fill = q.get('fill').split(',').map(Number);
      for (const k of ['pause', 'hint', 'auto', 'glazed', 'save']) if (q.has(k)) j[k] = true;
      game.dev.jump(j);
    }
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lock = new Image(); lock.onload = () => setLockup(lock); lock.src = './brand/arcforge-lockup.png';

const touchDevice = (() => { try { return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1; } catch { return false; } })();
(async () => {
  const presenter = await createPresenter({ kitCanvas: canvas, quality: q.get('q') || (touchDevice ? 'medium' : 'high'), onFail: () => game && game.setGL(false) });
  let lastTouch = 0, lastChime = 0, lastBuzz = 0;
  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* no vibration here */ } };
  // Adaptive GPU cost: touch devices start on 'medium'; if the 3D view runs under about 38 fps for two seconds of play, step one tier down (never back up).
  let fpsLast = 0, fpsAcc = 0, fpsN = 0;
  const tiers = ['high', 'medium', 'low'];
  const watchFps = (now, playing) => {
    if (!presenter.stage || q.has('q')) return;
    const dt = fpsLast ? now - fpsLast : 0; fpsLast = now;
    if (!playing || dt <= 0 || dt > 250) { fpsAcc = 0; fpsN = 0; return; }
    fpsAcc += dt; fpsN += 1;
    if (fpsAcc >= 2000) { if (fpsAcc / fpsN > 26) { const i = tiers.indexOf(presenter.stage.quality); if (i >= 0 && i < tiers.length - 1) presenter.stage.setQuality(tiers[i + 1]); } fpsAcc = 0; fpsN = 0; }
  };
  const tick = (now) => {
    if (game) { watchFps(now, game.getState().scene === 'play' && !game.getState().paused); const s = game.getState(); audio.setMuted(!s.prefs.sound); audio.update(s.audio, { paused: s.paused, speed: s.ses ? s.ses.pot.spin / 6.4 : 1 });
      if (s.prefs.haptics) { if (s.audio.touch > 0.2 && lastTouch <= 0.2 && now - lastBuzz > 150) { buzz(6); lastBuzz = now; } if (s.audio.chime !== lastChime) buzz(24); }
      lastTouch = s.audio.touch; lastChime = s.audio.chime; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  boot({ createGame: async (env) => { const g = await create(env); if (!presenter.stage) g.setGL(false); return presenter.wrap(g); }, meta, canvas, background: 'rgba(0,0,0,0)' });
})();
