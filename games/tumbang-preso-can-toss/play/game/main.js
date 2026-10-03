import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two fixed physics steps; it never reaches the simulation).
const clock = () => globalThis.performance.now();
boot({ createGame: (env) => createGame({ ...env, clock }), meta, canvas: document.getElementById('game'), background: '#14100e' });
