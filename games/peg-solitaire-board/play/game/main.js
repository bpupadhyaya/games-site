import { boot } from './kit/index.js';
import { createGame, meta, wheelInput } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo } from './src/brand.js';

const canvas = document.getElementById('game');
// Host safe areas (notch, home indicator) and the floating back button: the shell publishes window.__safeInsets in CSS px.
// The layout works in virtual units (short side = 720), so convert with the current scale. Browsers: no insets, zeros.
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelInput.dy += e.deltaY * (720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight))) * (e.deltaMode === 1 ? 16 : 1); }, { passive: false });

// Dev / store-screenshot hooks (?dev=1 or ?shot=1): ?scene=<name> jumps to a screen, window.__pg exposes the game for the check scripts.
const q = new URLSearchParams(location.search);
// `tools/arc shots` passes only ?shot=1&seed=N&ticks=0: the seed picks which real screen to photograph (see store/shots.json).
const SHOT_PLAN = {
  1: 'scene=title', 2: 'scene=puzzle&board=english&n=5&after=pick', 3: 'scene=classic&board=english&after=mid&k=9', 4: 'scene=about&n=0',
  5: 'scene=puzzles&board=english', 6: 'scene=rules&n=1', 7: 'scene=classic&board=french', 8: 'scene=puzzle&board=english&n=1&after=result',
  9: 'scene=puzzle&board=triangle&n=7&after=pick', 10: 'scene=howto&n=0', 11: 'scene=auto&after=autosteps&k=7',
};
if (q.has('shot') && !q.has('scene') && SHOT_PLAN[q.get('seed')]) for (const [k, v] of new URLSearchParams(SHOT_PLAN[q.get('seed')])) q.set(k, v);
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev || q.has('shot')) {
    window.__pg = game;
    const d = game.debug, S = d.S, sc = q.get('scene');
    if (q.has('zoom')) S.textScaleIdx = Number(q.get('zoom'));
    if (q.get('wood')) S.wood = q.get('wood'); if (q.get('pegs')) S.pegs = q.get('pegs'); if (q.get('calm')) S.calm = true;
    const board = q.get('board') || 'english', n = Number(q.get('n') || 0);
    if (sc === 'puzzle') d.startPuzzle(board, n);
    else if (sc === 'classic') d.startClassic(board);
    else if (sc === 'daily') d.startDaily();
    else if (sc === 'auto') d.startAuto();
    else if (sc === 'puzzles') { S.scene = 'puzzles'; S.tab = Math.max(0, ['triangle', 'english', 'french', 'diamond', 'cross'].indexOf(board)); }
    else if (sc === 'classics') S.scene = 'classic';
    else if (sc === 'settings') S.scene = 'settings';
    else if (sc === 'rules' || sc === 'howto' || sc === 'about') { d.openDoc(sc); S.docPage = n; }
    if (q.has('after')) d.script(q.get('after'), Number(q.get('k') || 8));
    if (q.has('shot')) S.sceneT = 5;
  }
  return game;
};
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
boot({ createGame: create, meta, canvas, background: '#06160f' });
