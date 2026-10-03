import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The kit has one pointer: a stray second finger must not move it. Only the primary pointer reaches the kit.
const canvas = document.getElementById('game');
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) canvas.addEventListener(type, (e) => { if (e.isPrimary === false) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

// The 3D field (web/view3d) draws behind the kit canvas; if it cannot load or WebGL is missing the game keeps its flat 2D field.
let presenter = { stage: null, wrap: (g) => g };
try {
  const { createPresenter } = await import('./view3d/presenter.js');
  presenter = await createPresenter({ kitCanvas: canvas });
} catch (e) { console.warn('3D field unavailable, using the 2D field', e); }

const booted = boot({
  createGame: async (env) => {
    const game = await createGame(env);
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => game.setCredits?.(t)).catch(() => {});
    return presenter.wrap(game);
  },
  meta, canvas, background: 'rgba(0,0,0,0)',
});
booted.then((b) => { if (/[?&]dbg/.test(location.search)) window.__k = { ...b, presenter }; });
