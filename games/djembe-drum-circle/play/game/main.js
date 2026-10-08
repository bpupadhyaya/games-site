import { boot } from './kit/index.js';
import { createGame, meta, drumInput, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo } from './src/brand.js';
import { createDrumKit } from './audio/drumkit.js';

const canvas = document.getElementById('game');
const q = new URLSearchParams(location.search);

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

// Mouse wheel scrolls the text pages (CSS px -> virtual units).
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Real multitouch: every finger that lands is its own strike, stamped with the browser's event time so the game can place it exactly.
const kit = createDrumKit();
const toVirtual = (e) => {
  const rect = canvas.getBoundingClientRect(), cpu = meta.cssPerUnit || Math.min(rect.width, rect.height) / 720;
  return { x: (e.clientX - rect.left - (rect.width - meta.width * cpu) / 2) / cpu, y: (e.clientY - rect.top - (rect.height - meta.height * cpu) / 2) / cpu };
};
canvas.addEventListener('pointerdown', (e) => {
  kit.unlock();
  const p = toVirtual(e), real = e.pointerType !== 'mouse' && e.pressure > 0 && e.pressure !== 0.5;
  drumInput.queue.push({ x: p.x, y: p.y, vel: real ? 0.55 + 0.45 * Math.min(1, e.pressure * 1.4) : 0.88, ts: e.timeStamp });
  if (drumInput.queue.length > 24) drumInput.queue.shift();
});
for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, () => kit.unlock(), { passive: true });

const create = async (env) => {
  const orig = env.audio.setMuted;
  env.audio.stroke = (voice, stroke, vel, delay) => kit.stroke(voice, stroke, vel, delay);
  env.audio.setMuted = (v) => { orig(v); kit.setMuted(v); };
  const game = await createGame(env);
  // Stamp each queued strike with its age: how long ago the finger landed, so the game can place it exactly in song time.
  const update = game.update;
  game.update = (dt, input) => {
    const now = performance.now();
    for (const h of drumInput.queue) if (h.age === undefined) h.age = Math.min(0.25, Math.max(0, (now - h.ts) / 1000));
    update(dt, input);
  };
  return game;
};

// The Arcforge badge (see src/brand.js): optional, the credit line still reads without it.
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';

boot({ createGame: create, meta, canvas, background: '#0b0507' });
