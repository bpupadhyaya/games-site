import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

const canvas = document.getElementById('game');
// The kit has no wheel event: forward mouse-wheel / trackpad scrolling to the game (it queues it and applies it in update()).
boot({
  createGame: async (env) => {
    const game = await createGame(env);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); game.wheel?.(e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY); }, { passive: false });
    return game;
  },
  meta, canvas, background: '#000',
});
