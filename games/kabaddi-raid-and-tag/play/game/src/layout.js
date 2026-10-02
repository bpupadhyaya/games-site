// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree. Virtual 720 x 1280, portrait.
// Nothing important within 40 px of the top/bottom edge, and the top-centre strip (y < 44) is left free for the preview badge.
// The play screen follows the text-size setting: at 100% it is the compact layout, at 300% the scoreboard stacks and the buttons
// become a single scrolling column, and the 3D view takes whatever is left in between (never below VIEW_MIN).
import { FONT } from './ui.js';

export const W = 720;
export const H = 1280;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
export const VIEW_MIN = 150;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// Menus / pages / settings reader geometry.
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };

// Rough text metrics, identical in update and render so the rectangles never differ (drawing shrinks a label that is too wide).
export const estWidth = (text, px) => String(text).length * px * 0.54;
export function estLines(text, px, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && estWidth(next, px) > maxW) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export const PLAY = {
  key: '', hs: 1, stacked: false,
  score: [{ x: 14, y: 48, w: 344, h: 112 }, { x: 362, y: 48, w: 344, h: 112 }],
  info: { x: 14, y: 166, w: 692, h: 30 },
  top: 200,                         // bottom of the scoreboard block
  view: { x: 0, y: 200, w: W, h: 500 },
  mini: { x: 458, y: 214, w: 248, h: 206 },
  gauges: { x: 14, y: 206, w: 440, h: 40 },
  coach: { x: 14, y: 704, w: 692, h: 70 },
  scroll: { x: 14, y: 780, w: 692, h: 380 },
  bottom: { y: 1180, h: 84 },
  think: { x: 14, y: 1180, w: 336, h: 84 },
  menu: { x: 370, y: 1180, w: 336, h: 84 },
  fonts: { name: 22, score: 60, info: 21, chip: 18, btn: 26, coach: 22, small: 20 },
  cols: 3, btnH: 78, miniOn: true, compact: false,
};

const PLAY0 = JSON.parse(JSON.stringify(PLAY));
// Back to the module's initial geometry (a new game must not inherit the previous one's layout).
export function resetPlayLayout() { const f = JSON.parse(JSON.stringify(PLAY0)); for (const k of Object.keys(f)) PLAY[k] = f[k]; PLAY.key = ''; }

// What the panel contains decides how tall it is, so the layout is rebuilt whenever the item count or the zoom changes.
export function setPlayLayout(textIdx = 0, o = {}) {
  const idx = clampN(textIdx | 0, 0, TEXT_SCALES.length - 1);
  const items = o.items ?? 9, wide = !!o.wideItems, coachLines = o.coachLines ?? 2;
  const key = `${idx}:${Math.round(o.contentH ?? 0)}:${coachLines}:${o.watch ? 1 : 0}`;
  if (key === PLAY.key) return false;
  PLAY.key = key;
  const hs = TEXT_SCALES[idx];
  PLAY.hs = hs; PLAY.stacked = false; PLAY.compact = hs >= 2;
  const fn = 22 * Math.min(hs, 2.2), fs = 60 * Math.min(hs, 1.75), fi = 21 * Math.min(hs, 2.4), fc = 18 * Math.min(hs, 2), fb = 26 * hs, fco = 22 * Math.min(hs, 2);
  Object.assign(PLAY.fonts, { name: fn, score: fs, info: fi, chip: fc, btn: fb, coach: fco, small: 20 * Math.min(hs, 2) });
  // scoreboard
  let y = 48;
  {
    const h = PLAY.compact ? Math.round(Math.max(fn * 1.5, fs * 0.95) + 36) : Math.round(14 + fn * 1.25 + fs * 0.92 + 26);
    PLAY.score[0] = { x: 14, y, w: 344, h }; PLAY.score[1] = { x: 362, y, w: 344, h };
    y += h + 6;
  }
  const infoLines = 1;
  const ih = Math.round(fi * 1.3 * infoLines + 6);
  PLAY.info = { x: 14, y, w: 692, h: ih };
  y += ih + 4;
  PLAY.top = y;
  // bottom block, built upward from the bottom edge
  const bh = Math.round(Math.max(84, fb * 1.15 + 34));
  const by = 1264 - bh;
  PLAY.bottom = { y: by, h: bh };
  PLAY.think = { x: 14, y: by, w: 336, h: bh }; PLAY.menu = { x: 370, y: by, w: 336, h: bh };
  const cols = hs <= 1.25 ? 3 : hs <= 2 ? 2 : 1;
  PLAY.cols = cols;
  const btnH = Math.round(Math.max(78, fb * 1.15 + 30));
  PLAY.btnH = btnH;
  const rows = Math.ceil(items / cols);
  const gridH = o.contentH ?? (rows * btnH + (rows - 1) * 10);
  const stepH = 0;
  const coachH = Math.round(Math.max(66, coachLines * fco * 1.28 + 18));
  let scrollH = gridH + stepH;
  const maxPanel = hs >= 2 ? Math.round(H * 0.6) : 700;
  let scrollTop = by - 10 - scrollH;
  const coachY = scrollTop - 8 - coachH;
  // never let the panel eat the view: past the limit the button area scrolls
  const viewMin = hs >= 2 ? 300 : VIEW_MIN;
  const room = by - 10 - (PLAY.top + viewMin + coachH + 8);
  if (scrollH > room) { scrollH = Math.max(110, room); scrollTop = by - 10 - scrollH; }
  PLAY.scroll = { x: 14, y: scrollTop, w: 692, h: scrollH, contentH: gridH + stepH, gridH, stepH };
  PLAY.coach = { x: 14, y: scrollTop - 8 - coachH, w: 692, h: coachH };
  const vb = PLAY.coach.y - 6;
  PLAY.view = { x: 0, y: PLAY.top, w: W, h: Math.max(viewMin, vb - PLAY.top) };
  PLAY.miniOn = hs <= 2 && PLAY.view.h >= 330;
  const mh = Math.round(clampN(PLAY.view.h * 0.42, 150, 230)), mw = Math.round(mh * 1.2);
  PLAY.mini = { x: W - 14 - mw, y: PLAY.top + 46, w: mw, h: mh };
  PLAY.gauges = { x: 14, y: PLAY.top + 6, w: W - 28, h: Math.round(Math.max(36, fc * 1.9)) };
  return true;
}
export { FONT };
