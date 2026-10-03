import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two fixed physics steps; it never reaches the simulation).
const clock = () => globalThis.performance.now();
// Mouse wheel for the scrolling text screens: the page only collects the distance; the game reads and clears it.
const wheel = { dy: 0 };
window.addEventListener('wheel', (e) => { e.preventDefault(); wheel.dy += e.deltaY * (e.deltaMode === 1 ? 40 : 1) * 1.2; }, { passive: false });
boot({ createGame: (env) => createGame({ ...env, clock, wheel }), meta, canvas: document.getElementById('game'), background: '#000' });
