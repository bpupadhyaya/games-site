import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The 3D court (web/view3d) draws behind the kit canvas; if it cannot load or WebGL is missing the game keeps its 2D court.
let presenter = { stage: null, wrap: (g) => g };
try {
  const { createPresenter } = await import('./view3d/presenter.js');
  presenter = await createPresenter({ kitCanvas: document.getElementById('game') });
} catch (e) { console.warn('3D court unavailable, using the 2D court', e); }

const booted = boot({
  createGame: async (env) => {
    const game = await createGame(env);
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => game.setCredits?.(t)).catch(() => {});
    return presenter.wrap(game);
  },
  meta, canvas: document.getElementById('game'), background: 'rgba(0,0,0,0)',
});

booted.then((b) => { if (/[?&]dbg/.test(location.search)) window.__k = { ...b, presenter }; });
