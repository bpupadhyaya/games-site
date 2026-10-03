// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree. Virtual 720 x 1280, portrait.
export const W = 720;
export const H = 1280;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
export const estWidth = (text, px) => String(text).length * px * 0.54;
export function estLines(text, px, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const w of words) { const next = line ? `${line} ${w}` : w; if (line && estWidth(next, px) > maxW) { lines.push(line); line = w; } else line = next; }
  if (line) lines.push(line);
  return lines;
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// The play screen follows the text size: the scoreboard and the buttons grow, the 3D view takes what is left (never below VIEW_MIN).
export const PLAY = { key: '', hs: 1, fonts: {}, sb: { x: 0, y: 44, w: W, h: 84 }, info: { x: 14, y: 130, w: 692, h: 40 }, view: { x: 0, y: 176, w: W, h: 880 }, ctl: { x: 14, y: 1066, w: 692, h: 100 }, bar: { x: 14, y: 1196, w: 692, h: 68 }, think: { x: 14, y: 1196, w: 336, h: 68 }, menu: { x: 370, y: 1196, w: 336, h: 68 }, cols: 4, btnH: 100, scroll: { x: 14, y: 1066, w: 692, h: 100, contentH: 100 } };
export const VIEW_MIN = 300;
export function setPlayLayout(textIdx, nButtons = 4, infoLines = 1) {
  const idx = clampN(textIdx | 0, 0, TEXT_SCALES.length - 1);
  const key = `${idx}:${nButtons}:${infoLines}`;
  if (key === PLAY.key) return false;
  PLAY.key = key;
  const hs = TEXT_SCALES[idx];
  PLAY.hs = hs;
  const fn = Math.round(22 * Math.min(hs, 1.6)), fs = Math.round(56 * Math.min(hs, 1.5)), fi = Math.round(21 * Math.min(hs, 2.4)), fb = Math.round(24 * hs);
  PLAY.fonts = { name: Math.round(22 * Math.min(hs, 1.6)), score: Math.round(56 * Math.min(hs, 1.5)), info: fi, btn: fb, clock: Math.round(34 * Math.min(hs, 1.6)) };
  const sbH = Math.round(Math.max(84, fs * 0.95 + fn * 1.2 + 22));
  PLAY.sb = { x: 0, y: 44, w: W, h: sbH };
  const ih = Math.round(fi * 1.35 * infoLines + 8);
  PLAY.info = { x: 14, y: 44 + sbH + 4, w: 692, h: ih };
  const top = PLAY.info.y + ih + 4;
  const bh = Math.round(Math.max(68, fb * 1.1 + 30));
  PLAY.bar = { x: 14, y: 1264 - bh, w: 692, h: bh };
  PLAY.think = { x: 14, y: 1264 - bh, w: 336, h: bh }; PLAY.menu = { x: 370, y: 1264 - bh, w: 336, h: bh };
  const cols = hs <= 1.25 ? Math.max(1, Math.min(5, nButtons)) : hs <= 2 ? 2 : 1;
  PLAY.cols = cols;
  const btnH = Math.round(Math.max(96, fb * 1.15 + 36));
  PLAY.btnH = btnH;
  const rows = Math.ceil(nButtons / cols);
  let ch = rows * btnH + (rows - 1) * 10;
  const maxCtl = 1264 - bh - 10 - (top + VIEW_MIN);
  let visH = Math.min(ch, Math.max(btnH, maxCtl));
  const cy = 1264 - bh - 10 - visH;
  PLAY.ctl = { x: 14, y: cy, w: 692, h: visH };
  PLAY.scroll = { x: 14, y: cy, w: 692, h: visH, contentH: ch };
  PLAY.view = { x: 0, y: top, w: W, h: Math.max(VIEW_MIN, cy - 6 - top) };
  return true;
}
export function resetPlayLayout() { PLAY.key = ''; }
