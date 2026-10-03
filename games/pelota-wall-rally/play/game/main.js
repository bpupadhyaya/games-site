import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D court. The kit loop does not hand the draw call its sub-step fraction, so the
// shell supplies a display clock (drawing only: the game uses it to blend between two fixed physics steps; it never reaches the simulation).
const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
let presenter = null;
try { if (!params.has('nogl')) presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }
const clock = () => globalThis.performance.now();
const wrap = (game) => {
  if (params.has('dev')) window.__game = game;
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = params.has('shot');
const shotOpts = { mode: params.get('mode') || '1v1', role: params.get('role') || 'back', equip: params.get('equip') || 'hand' };
boot({ createGame: async (env) => wrap(await createGame({ ...env, clock, config: shot ? { ...env.config, shot: true, shotOpts } : env.config })), meta, canvas, background: 'rgba(0,0,0,0)' });
