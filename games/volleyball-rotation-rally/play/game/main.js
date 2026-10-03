import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D court.
const canvas = document.getElementById('game');
let presenter = null;
try { presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }
const wrap = (game) => {
  if (new URLSearchParams(location.search).has('dev')) window.__game = game;
  // leaving the app (or switching tabs) pauses a match in progress
  const away = () => { try { game.getState().requestPause(); } catch { /* not ready */ } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) away(); });
  window.addEventListener('pagehide', away);   // dev only: lets the test harness read the state
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = new URLSearchParams(location.search).has('shot');
boot({ createGame: async (env) => wrap(await createGame(shot ? { ...env, config: { ...env.config, shot: true } } : env)), meta, canvas, background: 'rgba(0,0,0,0)' });
