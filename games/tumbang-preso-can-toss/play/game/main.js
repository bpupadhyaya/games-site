import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two fixed physics steps; it never reaches the simulation).
const clock = () => globalThis.performance.now();
// Short vibration pulses where the web view allows them (Android browsers and web views; iOS web views ignore the call).
const haptic = (ms) => { try { if (globalThis.navigator && typeof globalThis.navigator.vibrate === 'function') globalThis.navigator.vibrate(ms); } catch { /* no vibration here */ } };
let live = null;
const canvas = document.getElementById('game');
// Mouse wheel and trackpad scrolling for the long reading screens and menus (the kit only forwards pointer and key input).
canvas.addEventListener('wheel', (e) => {
  if (!live || typeof live.wheel !== 'function') return;
  e.preventDefault();
  live.wheel(e.deltaY * (e.deltaMode === 1 ? 24 : 1) * 1.6);
}, { passive: false });
boot({ createGame: async (env) => { live = await createGame({ ...env, clock, haptic }); return live; }, meta, canvas, background: '#14100e' });
