import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';

const app = await boot({ createGame, meta, canvas: document.getElementById('game'), background: '#06281f' });

// Screenshot verification only (used with ?shot=1, e.g. by `tools/arc shots` or a manual capture): optional
// &lang=en|zh and &scene=NAME force the tile-language pref and the current scene right after boot, so a specific
// screen can be captured deterministically. No effect for players (nothing sets these params in shipped links).
if (app?.game) {
  const params = new URLSearchParams(location.search);
  if (params.has('shot') && (params.has('lang') || params.has('scene'))) {
    const S = app.game.getState();
    if (params.has('lang')) S.prefs.lang = params.get('lang') === 'en' ? 'en' : 'zh';
    if (params.has('scene')) S.scene = params.get('scene');
  }
}
