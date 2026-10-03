import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps the HUD, menus and all input.
// Without WebGL the game keeps playing with its flat 2D ground. The shell also supplies a display clock (drawing only: used to blend between two
// fixed physics steps so motion is smooth at 60 and 120 Hz; it never reaches the simulation).
const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
let presenter = null;
try { presenter = createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }
const clock = () => globalThis.performance.now();
const wrap = (game) => {
  if (params.has('dev')) window.__game = game;   // dev only: lets the test harness read the state
  if (presenter) return presenter.wrap(game);
  return game;
};
const shot = params.has('shot');
boot({
  createGame: async (env) => { if (presenter) await presenter.ready; return wrap(await createGame({ ...env, clock, config: shot ? { ...env.config, shot: true } : env.config })); },
  meta, canvas, background: 'rgba(0,0,0,0)',
});
