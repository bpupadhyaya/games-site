import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

boot({ createGame, meta, canvas: document.getElementById('game'), background: '#000' });

// Mouse wheel and trackpad scrolling for the long text screens: the kit's input has no wheel, so the wheel is turned into a key press
// the game already understands (WheelUp / WheelDown, one press per notch).
document.getElementById('game').addEventListener('wheel', (e) => {
  e.preventDefault();
  const code = e.deltaY > 0 ? 'WheelDown' : 'WheelUp';
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}, { passive: false });
