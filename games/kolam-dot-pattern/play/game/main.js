import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The kit has no wheel event: collect mouse-wheel / trackpad movement here and hand it to the game, which drains it each update.
const canvas = document.getElementById('game');
let pending = 0;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const px = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * 600 : e.deltaY;
  pending += px;
}, { passive: false });
const wheel = { take() { const v = pending; pending = 0; return v; } };

boot({ createGame: (env) => createGame({ ...env, wheel }), meta, canvas, background: '#000' });
