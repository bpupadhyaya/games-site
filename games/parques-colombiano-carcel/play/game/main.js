import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// Store screenshots (`?shot=1&seed=<showcase seed>`) show real mid-game positions. Seeds 9001..9005 pick a position; the
// scene then ignores the random shot-mode "monkey" input so it stays put. Every other URL and every real player is unaffected.
const params = new URLSearchParams(globalThis.location.search);
const SHOWCASE_SEEDS = { 9001: 'race', 9002: 'capture', 9003: 'pass', 9004: 'pair', 9005: 'win', 9006: 'setup' };
const showcase = params.has('shot') ? SHOWCASE_SEEDS[Number(params.get('seed'))] : undefined;
const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

const create = showcase
  ? async (env) => { env.config.showcase = showcase; const game = await createGame(env); return { ...game, update: (dt) => game.update(dt, idle), isPreviewExempt: () => true }; }
  : createGame;

boot({ createGame: create, meta, canvas: document.getElementById('game'), background: '#140a05' });
