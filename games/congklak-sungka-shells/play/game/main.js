import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

boot({ createGame, meta, canvas: document.getElementById('game'), background: '#182449' });
