import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The kit loop does not hand the draw call its sub-step fraction, so the shell supplies a display clock (drawing only: the game
// logic never reads it) and the game draws moving stones and the hand a fraction of a step ahead, which keeps motion smooth at 120 Hz.
const clock = () => globalThis.performance.now();
boot({ createGame: (env) => createGame({ ...env, clock }), meta, canvas: document.getElementById('game'), background: '#000' }).then((r) => {
  // Mouse wheel / trackpad scrolls the long text screens (Rules, How to Play, About, Settings at large text sizes).
  const canvas = document.getElementById('game');
  canvas?.addEventListener('wheel', (e) => { e.preventDefault(); r?.game?.wheel?.(e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY); }, { passive: false });
});
