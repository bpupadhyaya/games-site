import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

// The 3D layer loads in the background behind the menus; until it is ready (or if WebGL2 / the 3D assets are missing) the 2D figures are used.
const canvas = document.getElementById('game');
let presenter = { info: {}, wrap: (g) => g, ready: Promise.resolve() };
try {
  const mod = await import('./view3d/presenter.js');
  presenter = mod.createPresenter({ kitCanvas: canvas });
  presenter.ready.then(() => fetch('./vendor3d/LICENSES.md').then((r) => (r.status < 400 ? r.text() : '')).then((t) => {
    if (!t) return;
    presenter.info.credits = ['# 3D people and credits', ...t.split(/\n{2,}/).map((x) => x.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean)];
  }).catch(() => {}));
} catch (e) { console.warn('view3d unavailable; using the 2D figures', e); }
if (new URLSearchParams(location.search).has('dev3d')) globalThis.__view3d = presenter;
const booted = boot({
  createGame: async (env) => { env.view3d = presenter.info; return presenter.wrap(await createGame(env)); },
  meta, canvas, background: 'rgba(0,0,0,0)',
});
if (new URLSearchParams(location.search).has('dev3d')) booted.then((r) => { globalThis.__game = r.game; });
