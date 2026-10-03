import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// uses it to blend between two fixed steps; it never reaches the simulation).
const clock = () => globalThis.performance.now();
const canvas = document.getElementById('game');
boot({
  createGame: async (env) => {
    const game = await createGame({ ...env, clock });
    // Mouse wheel / trackpad scrolls every text screen (touch drag and the arrow keys work too); the wheel distance is converted to
    // the game's 720-wide screen units.
    globalThis.addEventListener('wheel', (e) => {
      const k = canvas.clientWidth ? meta.width / canvas.clientWidth : 1;
      game.scrollBy(e.deltaY * (e.deltaMode === 1 ? 16 : 1) * k);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    return game;
  },
  meta, canvas, background: '#000',
});
