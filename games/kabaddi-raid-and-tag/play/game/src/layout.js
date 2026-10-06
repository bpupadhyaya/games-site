// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7.x): the virtual screen follows the real one. The SHORT side is always 720 units, the long side grows with the aspect:
// portrait is 720 wide x 960..1728 tall, landscape is 960..1728 wide x 720 tall. `W` and `H` are live ES-module bindings: game.js calls
// setSize(meta.width, meta.height) at the start of every update and render, and everything below is a pure function of that size,
// the host's safe-area insets and the text-size setting (rebuilt only when one of them changes).
//   portrait  scoreboard on top, the 3D view in the middle, coach line + button panel at the bottom (the approved phone look; taller
//             screens simply give the 3D view more height).
//   wide      landscape: scoreboard over the 3D view on the left, the coach line + button panel in a card on the right edge (thumbs).
// The play screen follows the text-size setting: at 300% the scoreboard stacks and the buttons become a single scrolling column.
import { FONT, FLOORPX } from './ui.js';

export let W = 720;
export let H = 1280;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
export const VIEW_MIN = 150;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
export const minFont = (n) => Math.max(n, Math.ceil(11 / Math.max(0.2, host.px)));

// Menus / pages / reader geometry (rebuilt by layoutScreens).
const R4 = (x, y, w, h) => ({ x, y, w, h });
export const READER = { top: R4(0, 0, 0, 0), panel: R4(0, 0, 0, 0), body: R4(0, 0, 0, 0), close: R4(0, 0, 0, 0), bar: R4(0, 0, 0, 0) };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: 580, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
// The column the menu screens (flow layouts) live in; twoPane (landscape title): art on the left, the button column on the right.
export const FLOW = { x: 40, w: 640, top: 0, bottom: 1280, twoPane: null };
export const CARD = { x: 60, w: 600, top: 70, bottom: 1210, panelX: 30, panelW: 660 };     // pause / think / lesson cards
export const isWide = () => W > H;

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
  key: '', hs: 1, stacked: false, wide: false,
  score: [{ x: 14, y: 48, w: 344, h: 112 }, { x: 362, y: 48, w: 344, h: 112 }],
  info: { x: 14, y: 166, w: 692, h: 30 },
  top: 200,                         // bottom of the scoreboard block
  view: { x: 0, y: 200, w: 720, h: 500 },
  tap: { x: 0, y: 0, w: 720, h: 700 },   // a tap here is the timing tap
  mini: { x: 458, y: 214, w: 248, h: 206 },
  gauges: { x: 14, y: 206, w: 440, h: 40 },
  coach: { x: 14, y: 704, w: 692, h: 70 },
  scroll: { x: 14, y: 780, w: 692, h: 380 },
  panel: { x: 0, y: 0, w: 0, h: 0 },     // the dark card behind the coach line and the buttons
  watchBar: { x: 20, y: 690, w: 680, h: 8 },
  toast: { x: 360, y: 690 },
  bottom: { y: 1180, h: 84 },
  think: { x: 14, y: 1180, w: 336, h: 84 },
  menu: { x: 370, y: 1180, w: 336, h: 84 },
  fonts: { name: 22, score: 60, info: 21, chip: 18, btn: 26, coach: 22, small: 20 },
  cols: 3, btnH: 78, miniOn: true, compact: false, bodyW: 692, bodyX: 14, infoTop: false,
};

const PLAY0 = JSON.parse(JSON.stringify(PLAY));
// Back to the module's initial geometry (a new game must not inherit the previous one's layout).
export function resetPlayLayout() { const f = JSON.parse(JSON.stringify(PLAY0)); for (const k of Object.keys(f)) PLAY[k] = f[k]; PLAY.key = ''; sizeKey = ''; }

let sizeKey = '';
// Called with the live virtual size at the start of every update and render. Rebuilds the screen geometry when the size or insets change.
export function setSize(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1280;
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(3)}`;
  if (key === sizeKey) return false;
  sizeKey = key; W = w; H = h; FLOORPX.v = minFont(0) + 1;
  layoutScreens();
  PLAY.key = '';                      // the play layout depends on the size too
  return true;
}
export const sizeNow = () => sizeKey;

function layoutScreens() {
  const wide = W > H, ins = host;
  const side = Math.max(ins.l, ins.r);
  // ---- menu column ----------------------------------------------------------------------------------------------------------
  if (!wide) {
    Object.assign(FLOW, { x: 40, w: W - 80, top: ins.t, bottom: H - ins.b, twoPane: null });
    Object.assign(CARD, { x: 60, w: W - 120, top: ins.t + 40, bottom: H - ins.b - 40, panelX: 30, panelW: W - 60 });
  } else {
    const w = Math.min(760, W - 2 * Math.max(40, side + 12));
    // two panes for the title: art on the left, the buttons in a column on the right
    const cw = Math.min(520, Math.round((W - ins.l - ins.r) * 0.42)), colX = W - ins.r - 24 - cw;
    Object.assign(FLOW, { x: Math.round((W - w) / 2), w, top: ins.t, bottom: H - ins.b, twoPane: { x: colX, w: cw, top: ins.t + 8, bottom: H - ins.b - 8, left: R4(ins.l, ins.t, colX - ins.l - 16, H - ins.t - ins.b) } });
    const pw = Math.min(660, W - 2 * Math.max(40, side + 12));
    Object.assign(CARD, { x: Math.round((W - pw) / 2) + 30, w: pw - 60, top: ins.t + 24, bottom: H - ins.b - 24, panelX: Math.round((W - pw) / 2), panelW: pw });
  }
  // ---- setup: Start / Back pinned to the bottom of the column ---------------------------------------------------------------------
  const pinH = 88, pinY = H - ins.b - pinH - 24;
  const sx = FLOW.x - 10, sw = FLOW.w + 20, startW = Math.round(sw * 0.66);
  SETUP_PINS.start = R4(sx, pinY, startW, pinH); SETUP_PINS.back = R4(sx + startW + 14, pinY, sw - startW - 14, pinH);
  // ---- reader (About / How to Play / Rules): one scrolling panel, text zoom row on top, Close at the bottom -----------------------------
  const mx = Math.max(16, side + 8);
  const pw = Math.min(900, W - 2 * mx), px = Math.round((W - pw) / 2);
  const topY = ins.t + 10, rowH = 60;
  const leftX = Math.max(px, ins.back ? ins.l + ins.back + 12 : 0);
  Object.assign(TEXT_DEC, { x: leftX, y: topY, w: 110, h: rowH });
  Object.assign(TEXT_INC, { x: px + pw - 110, y: topY, w: 110, h: rowH });
  const closeH = 76, closeY = H - ins.b - closeH - 14;
  READER.top = R4(leftX, topY, px + pw - leftX, rowH);
  READER.panel = R4(px, topY + rowH + 10, pw, closeY - 12 - (topY + rowH + 10));
  READER.body = R4(px + 28, READER.panel.y + 14, pw - 56 - 22, READER.panel.h - 28);   // 22: room for the scroll bar
  READER.bar = R4(px + pw - 26, READER.panel.y + 14, 14, READER.panel.h - 28);
  READER.close = R4(px, closeY, pw, closeH);
}

// The width of the button panel (landscape card) for a text size; portrait uses the full width.
export const panelWidth = (hs) => Math.round(hs >= 2 ? clampN(W * 0.44, 440, 640) : clampN(W * 0.36, 392, 600));
export function bodyBox(textIdx) {
  const hs = TEXT_SCALES[clampN(textIdx | 0, 0, TEXT_SCALES.length - 1)];
  if (W <= H) { const L = Math.max(14, host.l), Rr = W - Math.max(14, host.r); return { x: L, w: Rr - L, wide: false }; }
  const pw = panelWidth(hs), px = W - host.r - pw - 10;
  return { x: px + 12, w: pw - 24, wide: true };
}

// What the panel contains decides how tall it is, so the layout is rebuilt whenever the item count, the zoom or the screen size changes.
export function setPlayLayout(textIdx = 0, o = {}) {
  const idx = clampN(textIdx | 0, 0, TEXT_SCALES.length - 1);
  const items = o.items ?? 9, coachLines = o.coachLines ?? 2;
  const key = `${idx}:${Math.round(o.contentH ?? 0)}:${coachLines}:${o.watch ? 1 : 0}:${sizeKey}`;
  if (key === PLAY.key) return false;
  PLAY.key = key;
  const hs = TEXT_SCALES[idx], wide = W > H, ins = host;
  PLAY.hs = hs; PLAY.stacked = false; PLAY.compact = hs >= 2; PLAY.wide = wide;
  const fn = 22 * Math.min(hs, 2.2), fs = 60 * Math.min(hs, 1.75), fi = minFont(21) * Math.min(hs, 2.4), fc = minFont(18) * Math.min(hs, 2), fb = 26 * hs, fco = 22 * Math.min(hs, wide ? 1.5 : 2);
  Object.assign(PLAY.fonts, { name: fn, score: fs, info: fi, chip: fc, btn: fb, coach: fco, small: minFont(20) * Math.min(hs, 2) });
  const L = Math.max(14, ins.l), Rr = W - Math.max(14, ins.r), back = ins.back;
  const top0 = Math.max(48, ins.t + 8);
  const cols = hs <= 1.25 ? 3 : hs <= 2 ? 2 : 1;
  const dense = !wide && H < 1100;
  const btnH = Math.round(Math.max(dense ? 62 : 78, fb * 1.15 + 30));
  const bh = Math.round(Math.max(dense ? 68 : 84, fb * 1.15 + 34));
  PLAY.btnH = btnH;
  // ---- scoreboard + the one-line info -------------------------------------------------------------------------------------------
  const pw = wide ? panelWidth(hs) : 0;
  const panelX = wide ? W - ins.r - pw - 10 : 0;
  const areaL = L, areaR = wide ? panelX - 12 : Rr;          // the region the scoreboard spans
  const scoreH = PLAY.compact ? Math.round(Math.max(fn * 1.5, fs * 0.95) + 36) : Math.round(14 + fn * 1.25 + fs * 0.92 + 26);
  const ih = Math.round(fi * 1.3 + 6);
  let y = top0;
  // with a floating host back button the info line sits beside it (the button occupies the top-left corner) and the scoreboard goes below
  PLAY.infoTop = back > 0;
  if (PLAY.infoTop) {
    const bx = ins.l + back + 12;
    PLAY.info = { x: bx, y: ins.t + Math.max(0, (back - ih) / 2), w: Math.max(100, areaR - bx), h: ih };
    y = Math.max(top0, ins.t + back + 8);
  }
  const gap = 8, cw = Math.floor((areaR - areaL - gap) / 2);
  PLAY.score[0] = { x: areaL, y, w: cw, h: scoreH }; PLAY.score[1] = { x: areaL + cw + gap, y, w: cw, h: scoreH };
  y += scoreH + 6;
  if (!PLAY.infoTop) { PLAY.info = { x: areaL, y, w: areaR - areaL, h: ih }; y += ih + 4; }
  PLAY.top = y;
  PLAY.cols = cols;
  if (!wide) {
    // ---- portrait: bottom block built upward from the bottom edge ----------------------------------------------------------------
    const bodyX = L, bodyW = Rr - L;
    PLAY.bodyX = bodyX; PLAY.bodyW = bodyW;
    const by = H - ins.b - 16 - bh;
    PLAY.bottom = { y: by, h: bh };
    const half = Math.floor((bodyW - 20) / 2);
    PLAY.think = { x: bodyX, y: by, w: half, h: bh }; PLAY.menu = { x: bodyX + half + 20, y: by, w: half, h: bh };
    const rows = Math.ceil(items / cols);
    const gridH = o.contentH ?? (rows * btnH + (rows - 1) * 10);
    const coachH = Math.round(Math.max(66, coachLines * fco * 1.28 + 18));
    let scrollH = gridH, scrollTop = by - 10 - scrollH;
    const viewMin = hs >= 2 ? 300 : VIEW_MIN;
    const room = by - 10 - (PLAY.top + viewMin + coachH + 8);
    if (scrollH > room) { scrollH = Math.max(110, room); scrollTop = by - 10 - scrollH; }
    PLAY.scroll = { x: bodyX, y: scrollTop, w: bodyW, h: scrollH, contentH: gridH, gridH, stepH: 0 };
    PLAY.coach = { x: bodyX, y: scrollTop - 8 - coachH, w: bodyW, h: coachH };
    const vb = PLAY.coach.y - 6;
    PLAY.view = { x: 0, y: PLAY.top, w: W, h: Math.max(viewMin, vb - PLAY.top) };
    PLAY.tap = { x: 0, y: 0, w: W, h: PLAY.coach.y };
    PLAY.panel = { x: 0, y: PLAY.coach.y + 8, w: W, h: H - PLAY.coach.y - 8 };
    PLAY.watchBar = { x: PLAY.coach.x + 6, y: PLAY.coach.y - 14, w: PLAY.coach.w - 12, h: 8 };
    PLAY.miniOn = hs <= 2 && PLAY.view.h >= 330;
    const mh = Math.round(clampN(PLAY.view.h * 0.42, 150, 230)), mw = Math.round(mh * 1.2);
    PLAY.mini = { x: Rr - mw, y: PLAY.top + 46, w: mw, h: mh };
    PLAY.gauges = { x: bodyX, y: PLAY.top + 6, w: bodyW, h: Math.round(Math.max(36, fc * 1.9)) };
    PLAY.toast = { x: W / 2, y: PLAY.coach.y - 12 };
    return true;
  }
  // ---- landscape: the card on the right edge holds the coach line, the buttons and Think / Menu ----------------------------------
  const pt = Math.max(8, ins.t + 6), pb = Math.max(8, ins.b + 6);
  const pnl = { x: panelX, y: pt, w: pw, h: H - pt - pb };
  PLAY.panel = pnl;
  const ix = pnl.x + 12, iw = pnl.w - 24;
  PLAY.bodyX = ix; PLAY.bodyW = iw;
  const by = pnl.y + pnl.h - 12 - bh;
  PLAY.bottom = { y: by, h: bh };
  const half = Math.floor((iw - 12) / 2);
  PLAY.think = { x: ix, y: by, w: half, h: bh }; PLAY.menu = { x: ix + half + 12, y: by, w: half, h: bh };
  PLAY.cols = hs <= 1.25 ? 2 : 1;
  const coachH = Math.round(Math.max(66, coachLines * fco * 1.28 + 18));
  const coachY = pnl.y + 12 + (o.watch ? 34 : 0);
  PLAY.coach = { x: ix, y: coachY, w: iw, h: coachH };
  PLAY.watchBar = { x: ix + 6, y: pnl.y + 28, w: iw - 12, h: 8 };
  const sTop = coachY + coachH + 10, sBot = by - 10;
  const gridH = o.contentH ?? (Math.ceil(items / PLAY.cols) * btnH + (Math.ceil(items / PLAY.cols) - 1) * 10);
  const sH = Math.max(90, sBot - sTop);
  PLAY.scroll = { x: ix, y: sTop, w: iw, h: sH, contentH: gridH, gridH, stepH: 0 };
  const vw = pnl.x - 6, vy = PLAY.top, vh = Math.max(VIEW_MIN, H - ins.b - 8 - vy);
  PLAY.view = { x: 0, y: vy, w: vw, h: vh };
  PLAY.tap = { x: 0, y: 0, w: pnl.x, h: H };
  PLAY.miniOn = hs <= 2 && vw >= 800 && vh >= 330;
  const mh = Math.round(clampN(vh * 0.36, 140, 210)), mw = Math.round(mh * 1.2);
  PLAY.mini = { x: areaL, y: vy + vh - mh - 10, w: mw, h: mh };      // bottom-left: the raid itself happens in the middle and on the right
  PLAY.gauges = { x: areaL, y: PLAY.top + 6, w: areaR - areaL, h: Math.round(Math.max(36, fc * 1.9)) };
  PLAY.toast = { x: vw / 2, y: vy + vh - 14 };
  return true;
}
export { FONT };
