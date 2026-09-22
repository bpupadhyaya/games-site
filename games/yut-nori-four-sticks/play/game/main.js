import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// ?scene=N (or ?seed=9000+N) opens a fixed showcase scene for store screenshots; players never see it.
const q = new URLSearchParams(globalThis.location.search), seed = Number(q.get('seed') || 0);
const showcase = Number(q.get('scene') || (seed >= 9000 && seed < 9100 ? seed - 9000 : 0)) || 0;
boot({ createGame: (env) => createGame({ ...env, config: { ...env.config, showcase } }), meta, canvas: document.getElementById('game'), background: '#140d1c' });
