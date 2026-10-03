import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// logic never reads it) and the game draws moving stones and the hand a fraction of a step ahead, which keeps motion smooth at 120 Hz.
const clock = () => globalThis.performance.now();
// The kit input does not carry the mouse wheel, so the shell collects it (in board units) for the document screens to scroll with.
const canvas = document.getElementById('game');
const wheel = { dy: 0 };
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheel.dy += e.deltaY * (e.deltaMode === 1 ? 32 : 1) * (720 / (canvas.clientWidth || 720)); }, { passive: false });
boot({ createGame: (env) => createGame({ ...env, clock, wheel }), meta, canvas, background: '#000' });
