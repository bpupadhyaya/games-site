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
  1: 'scene=title', 2: 'scene=play&mode=classic&after=rolled&k=2', 3: 'scene=play&mode=classic&after=lift&k=2', 4: 'scene=play&mode=classic&after=hint&k=1',
  5: 'scene=play&mode=tall&after=mid&k=4', 6: 'scene=play&mode=classic&after=shut', 7: 'scene=rules&n=2', 8: 'scene=play&mode=duel&after=rolled&k=2',
  9: 'scene=howto&n=0', 10: 'scene=auto&after=rolled&k=2', 11: 'scene=about&n=0',
};
if (q.has('shot') && !q.has('scene') && SHOT_PLAN[q.get('seed')]) for (const [k, v] of new URLSearchParams(SHOT_PLAN[q.get('seed')])) q.set(k, v);
const create = async (env) => {
  const game = await createGame(env);
  if (env.config.dev || q.has('shot')) {
    window.__pg = game;
    const d = game.debug, S = d.S, sc = q.get('scene');
    if (q.has('zoom')) S.textScaleIdx = Number(q.get('zoom'));
    if (q.get('box')) S.boxKey = q.get('box'); if (q.get('tiles')) S.tileKey = q.get('tiles'); if (q.has('calm')) S.calm = true;
    const n = Number(q.get('n') || 0);
    if (sc === 'play') d.startMode(q.get('mode') || 'classic');
    else if (sc === 'auto') d.startAuto();
    else if (sc === 'settings') S.scene = 'settings';
    else if (sc === 'rules' || sc === 'howto' || sc === 'about') { d.openDoc(sc); S.docPage = n; }
    if (q.has('after')) d.script(q.get('after'), Number(q.get('k') || 4));
    if (q.has('shot')) { S.sceneT = 5; S.t = 1.3; }
  }
  return game;
};
const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
boot({ createGame: create, meta, canvas, background: '#1d0b0e' });
