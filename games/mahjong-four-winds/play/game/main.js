import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

const app = await boot({ createGame, meta, canvas: document.getElementById('game'), background: '#06281f' });

// Screenshot verification only (used with ?shot=1, e.g. by `tools/arc shots` or a manual capture): optional
// &lang=en|zh, &scene=NAME and &page=N force the tile-language pref, the current scene and (for a paginated
// scene such as Rules/How/About) the page index right after boot, so a specific screen can be captured
// deterministically. No effect for players (nothing sets these params in shipped links).
if (app?.game) {
  const params = new URLSearchParams(location.search);
  if (params.has('shot') && (params.has('lang') || params.has('scene') || params.has('page'))) {
    const S = app.game.getState();
    if (params.has('lang')) S.prefs.lang = params.get('lang') === 'en' ? 'en' : 'zh';
    if (params.has('scene')) S.scene = params.get('scene');
    if (params.has('page')) S.page = parseInt(params.get('page'), 10) || 0;
  }
}
