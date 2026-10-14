// Screen geometry: every rectangle lives here so game.js (hit-testing) and view.js (drawing) never disagree.
//
// FLUID LAYOUT (kit 1.7+): the virtual screen follows the real one: its SHORT side is always 720 units, the long side grows with
// the aspect ratio. `applyLayout(w, h)` recomputes everything from the live size and `host` (safe areas and the host's floating
// back button). Results are cached by size, so calling it every frame is free. Exports are objects that are updated IN PLACE,
// so the other modules always read the current geometry.
//
// Shapes:
//   portrait   header, opponent plate, board, player plate, rule strip, message, button bar (whatever fits, in that priority).
//   landscape  the board on the left, ONE card on the right holding the header buttons, both plates, rule strip, message and
//              the buttons in a 2 x 2 grid. The group is centred when the screen is wider than it needs.
// The top-left corner stays clear of the host's floating back button (`host.back`).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_TIME = 2;
import { v3 } from './v3.js';
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the back button in virtual units (main.js keeps this current; browsers: zeros). `px` = css pixels per unit.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };

export let W = 720, H = 1560;
export let SQ = 78, FRAME = 26, GRID = 624, GX = 0, GY = 0;
const R = (x, y, w, h) => ({ x, y, w, h });
const put = (t, r) => Object.assign(t, r);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mkr = () => R(0, 0, 0, 0);

export const BOARD = mkr(), HDR = { menu: mkr(), sound: mkr(), title: mkr() };
export const PLATE_TOP = mkr(), PLATE_BOT = mkr(), INFO = mkr(), MSG = mkr();
export const BTN = { undo: mkr(), hint: mkr(), threat: mkr(), end: mkr() };
export const AUTO = { exit: mkr(), pause: mkr(), dec: mkr(), val: mkr(), inc: mkr(), well: mkr() };
export const LEARN_BAR = { menu: mkr(), hint: mkr(), reset: mkr(), next: mkr() };
export const TITLE_SOUND = mkr();
export const LIMIT = { panel: mkr(), btn: mkr() };
export const TEXT_DEC = mkr(), TEXT_INC = mkr(), REF_BACK = mkr(), REF_NEXT = mkr(), REF_PANEL = mkr();
export const SETTINGS_BACK = mkr(), SETTINGS_TITLE = mkr();
export const RESULT = { panel: mkr(), dec: mkr(), inc: mkr(), title: mkr(), art: mkr(), sub: mkr(), again: mkr(), menu: mkr(), chipsLabel: mkr(), chips: { x: 0, y: 0, w: 0, h: 0, ch: 64 }, land: false };
export const SIBLINGS = [
  { slug: 'chess-royal-sixty-four', title: 'Chess' },
  { slug: 'makruk-thai-chess-tutor', title: 'Makruk' },
  { slug: 'xiangqi-river-and-palace', title: 'Xiangqi' },
  { slug: 'shogi-generals-and-drops', title: 'Shogi' },
];
// the History screen: six piece tabs, two small boards (ancient / modern), a caption under each
export const HIST = { tabs: [mkr(), mkr(), mkr(), mkr(), mkr(), mkr()], A: { x: 0, y: 0, S: 40, F: 14 }, B: { x: 0, y: 0, S: 40, F: 14 }, capA: mkr(), capB: mkr(), labA: mkr(), labB: mkr(), back: mkr(), menu: mkr(), side: false, cols: false };
// 3D stage: the foreshortened board needs less height than its square rect; the rest goes to the plates and cards.
export const STAGE_K = 0.9;
const stageK = () => (v3.on ? STAGE_K : 1);
export const LAY = { land: false, ins: { t: 0, r: 0, b: 0, l: 0, back: 0 }, U: { x0: 0, y0: 0, x1: 720, y1: 1560, w: 720, h: 1560 }, backBox: mkr(), key: '', level: 0, info: false };

// square <-> screen. `flip` shows Vermilion at the bottom (board turned 180 degrees).
export function squareXY(s, flip) {
  let f = s & 7, r = s >> 3;
  if (flip) { f = 7 - f; r = 7 - r; }
  return { x: GX + f * SQ, y: GY + (7 - r) * SQ };
}
export function squareCentre(s, flip) { if (v3.on && v3.sq) return v3.sq(s); const q = squareXY(s, flip); return { x: q.x + SQ / 2, y: q.y + SQ / 2 }; }
export function squareAt(x, y, flip) {
  if (v3.on && v3.pick) return v3.pick(x, y);
  if (x < GX || x >= GX + GRID || y < GY || y >= GY + GRID) return -1;
  let f = Math.floor((x - GX) / SQ), r = 7 - Math.floor((y - GY) / SQ);
  if (flip) { f = 7 - f; r = 7 - r; }
  return r * 8 + f;
}
// the same for one of the two History boards
export function histSquareAt(b, x, y) {
  const gx = b.x + b.F, gy = b.y + b.F;
  if (x < gx || x >= gx + b.S * 8 || y < gy || y >= gy + b.S * 8) return -1;
  return (7 - Math.floor((y - gy) / b.S)) * 8 + Math.floor((x - gx) / b.S);
}
export function histSquareCentre(b, s) { return { x: b.x + b.F + (s & 7) * b.S + b.S / 2, y: b.y + b.F + (7 - (s >> 3)) * b.S + b.S / 2 }; }

const setSize = (B) => {
  SQ = Math.max(24, Math.floor(B / (8 + 2 * 0.34))); FRAME = Math.round(SQ * 0.34); GRID = SQ * 8;
  put(BOARD, R(0, 0, GRID + FRAME * 2, GRID + FRAME * 2));
};
const placeBoard = (x, y) => { BOARD.x = Math.round(x); BOARD.y = Math.round(y); GX = BOARD.x + FRAME; GY = BOARD.y + FRAME; };

// Split `r` into the rects of a button row / grid. rows: [[key, weight], ...] per row.
function grid(out, x, y, w, h, rows, gap) {
  const n = rows.length, rh = (h - gap * (n - 1)) / n;
  rows.forEach((row, i) => {
    const tw = row.reduce((s, c) => s + c[1], 0), cw = w - gap * (row.length - 1);
    let cx = x;
    for (const [k, wt] of row) { const bw = (cw * wt) / tw; out[k] = R(cx, y + i * (rh + gap), bw, rh); cx += bw + gap; }
  });
}

let lastKey = '';
export function applyLayout(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1560;
  const ins = { t: Math.round(host.t), r: Math.round(host.r), b: Math.round(host.b), l: Math.round(host.l), back: Math.round(host.back) };
  const key = `${w}x${h}|${ins.t},${ins.r},${ins.b},${ins.l},${ins.back}|${v3.on ? 1 : 0}|${Math.round(host.px * 100)}`;
  if (key === lastKey) return false;
  lastKey = key; W = w; H = h;
  const land = w > h, U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bk = ins.back ? Math.max(ins.back, 48) : 0;
  Object.assign(LAY, { land, ins, U, key }); put(LAY.backBox, bk ? R(ins.l, ins.t, bk + 8, bk + 8) : R(0, 0, 0, 0));
  if (land) landscape(w, h, ins, U, bk); else portrait(w, h, ins, U, bk);
  common(w, h, ins, U, bk);
  return true;
}

function portrait(w, h, ins, U, bk) {
  const tap = Math.ceil(46 / Math.max(0.3, host.px));
  const hx0 = bk ? ins.l + bk + 14 : ins.l + 16, hy = ins.t + 14, hh = clamp(tap, 64, 90), SF = stageK();
  put(HDR.menu, R(hx0, hy, 124, hh)); put(HDR.sound, R(w - hh - 16 - ins.r, hy, hh, hh));
  put(HDR.title, R(HDR.menu.x + 132, hy, HDR.sound.x - 8 - (HDR.menu.x + 132), hh));
  const needGh = bk ? ins.t + bk + 8 + 6 - (hy + hh) : 0, gh = Math.max(14, needGh);
  const bottom = h - ins.b - 14, top = hy + hh + gh;
  const Bmax = Math.min(720, w - 20 - ins.l - ins.r), g0 = 12;
  // heights [min, pref, max]; the board is sized first, then whatever is left is handed out in priority order
  const it = { plate: [60, 82, 100], msg: [100, 136, 176], bar: [Math.max(72, tap + 4), 96, 116], info: [0, 108, 132] };
  const cur = { plate: it.plate[0], msg: it.msg[0], bar: it.bar[0], info: 0 };
  const used = () => 2 * cur.plate + cur.msg + cur.bar + cur.info + g0 * (cur.info ? 5 : 4);
  const B = clamp((bottom - top - used()) / SF, 260, Bmax);
  let spare = bottom - top - B * SF - used();
  const raise = (k, to) => { const d = Math.min(spare, to - cur[k]); if (d > 0) { cur[k] += d; spare -= d; } };
  if (spare >= it.info[1] + g0) { cur.info = it.info[1]; spare -= it.info[1] + g0; }
  raise('msg', it.msg[1]); raise('bar', it.bar[1]);
  { const d = Math.min(spare / 2, it.plate[1] - cur.plate); if (d > 0) { cur.plate += d; spare -= 2 * d; } }
  raise('info', it.info[2]); raise('msg', it.msg[2]); raise('bar', it.bar[2]);
  const gaps = cur.info ? 5 : 4, g = g0 + Math.min(10, Math.max(0, spare / gaps)); spare = Math.max(0, spare - (g - g0) * gaps);
  LAY.info = cur.info > 0;
  let y = top + spare * 0.2;
  const px = 14 + ins.l, pw = w - 28 - ins.l - ins.r;
  put(PLATE_TOP, R(px, y, pw, cur.plate)); y += cur.plate + g;
  setSize(B); const vis = BOARD.h * SF; placeBoard((w - BOARD.w) / 2, y - (BOARD.h - vis) / 2); y += vis + g;
  put(PLATE_BOT, R(px, y, pw, cur.plate)); y += cur.plate + g;
  put(INFO, R(px, y, pw, cur.info)); if (cur.info) y += cur.info + g;
  put(MSG, R(px, y, pw, cur.msg)); y += cur.msg + g;
  const bH = cur.bar;
  const bo = {}; grid(bo, px, y, pw, bH, [[['undo', 1], ['hint', 1], ['threat', 1], ['end', 1]]], 12);
  for (const k of Object.keys(BTN)) put(BTN[k], bo[k]);
  const ao = {}; grid(ao, px, y, pw, bH, [[['exit', 1], ['pause', 1.5], ['dec', 0.62], ['val', 1.1], ['inc', 0.62]]], 0);
  // Exit and Pause are separate buttons; the three think-time pieces sit together in one stepper well
  { const gp = 12, tot = pw - gp * 2, wx = tot * 0.2 / 1, wp = tot * 0.3, ws = tot - wx - wp, sx = px + wx + gp + wp + gp, sh = bH;
    const sb = Math.min(sh * 0.8, ws * 0.28);
    put(AUTO.exit, R(px, y, wx, bH)); put(AUTO.pause, R(px + wx + gp, y, wp, bH));
    put(AUTO.dec, R(sx + 6, y + (sh - sb) / 2, sb, sb)); put(AUTO.inc, R(sx + ws - 6 - sb, y + (sh - sb) / 2, sb, sb));
    put(AUTO.val, R(sx + sb + 10, y, ws - sb * 2 - 20, sh)); AUTO.well = R(sx, y, ws, sh); }
  void ao;
  const lo = {}; grid(lo, px, y, pw, bH, [[['menu', 1], ['hint', 1.2], ['reset', 1], ['next', 1.2]]], 12);
  for (const k of Object.keys(LEARN_BAR)) put(LEARN_BAR[k], lo[k]);
}

function landscape(w, h, ins, U, bk) {
  const M = 12, TOPPAD = 30, Pmin = 300, Pmax = 470, SF = stageK();
  const B = clamp(Math.min((U.h - 2 * M - TOPPAD) / SF, U.w - Pmin - 3 * M), 260, 900);
  setSize(B);
  const vis = BOARD.h * SF, availH = U.h - TOPPAD - M;
  const pw = clamp(U.w - BOARD.w - 3 * M, Pmin, Pmax), group = BOARD.w + M + pw;
  const gx = U.x0 + Math.max(M, (U.w - group) / 2);
  const sty = U.y0 + TOPPAD + Math.max(0, (availH - vis) / 2);
  placeBoard(gx, sty - (BOARD.h - vis) / 2);
  const rx = BOARD.x + BOARD.w + M, y1 = U.y1 - M;
  let y = sty;
  const hh = Math.max(56, Math.min(64, Math.ceil(46 / Math.max(0.3, host.px))));
  put(HDR.menu, R(rx, y, (pw - 10) / 2, hh)); put(HDR.sound, R(rx + (pw - 10) / 2 + 10, y, (pw - 10) / 2, hh));
  put(HDR.title, R(rx, y, 0, 0));
  y += hh + 10;
  const bot = Math.min(y1, sty + vis), gridH = clamp((bot - y) * 0.27, 120, 168), g = 8;
  const rest = bot - y - gridH - g * 4, wts = [{ k: 'pt', p: 78, m: 58 }, { k: 'pb', p: 78, m: 58 }, { k: 'i', p: 92, m: 0 }, { k: 'm', p: 140, m: 90 }];
  let tot = wts.reduce((s, c) => s + c.p, 0), hs;
  if (tot <= rest) hs = wts.map((c) => c.p + (c.k === 'm' ? Math.min(rest - tot, 60) : 0));
  else {
    const withoutInfo = wts.filter((c) => c.k !== 'i'), tot2 = withoutInfo.reduce((s, c) => s + c.p, 0);
    const k = clamp(rest / tot2, 0.6, 1);
    hs = wts.map((c) => (c.k === 'i' ? 0 : Math.max(c.m, c.p * k)));
  }
  LAY.info = hs[2] > 0;
  put(PLATE_TOP, R(rx, y, pw, hs[0])); y += hs[0] + g;
  put(PLATE_BOT, R(rx, y, pw, hs[1])); y += hs[1] + g;
  put(INFO, R(rx, y, pw, hs[2])); if (hs[2]) y += hs[2] + g;
  put(MSG, R(rx, y, pw, Math.max(60, bot - gridH - g - y))); y = bot - gridH;
  const bo = {}; grid(bo, rx, y, pw, gridH, [[['undo', 1], ['hint', 1]], [['threat', 1], ['end', 1]]], 8);
  for (const k of Object.keys(BTN)) put(BTN[k], bo[k]);
  { const rh = (gridH - g) / 2, e = Math.min(rh, pw * 0.2);
    put(AUTO.exit, R(rx, y, (pw - g) * 0.36, rh)); put(AUTO.pause, R(rx + (pw - g) * 0.36 + g, y, (pw - g) * 0.64, rh));
    const wy = y + rh + g; AUTO.well = R(rx, wy, pw, rh);
    put(AUTO.dec, R(rx + 6, wy + (rh - e) / 2, e, e)); put(AUTO.inc, R(rx + pw - 6 - e, wy + (rh - e) / 2, e, e)); put(AUTO.val, R(rx + e + 10, wy, pw - 2 * e - 20, rh)); }
  const lo = {}; grid(lo, rx, y, pw, gridH, [[['menu', 1], ['hint', 1.2]], [['reset', 1], ['next', 1.2]]], 8);
  for (const k of Object.keys(LEARN_BAR)) put(LEARN_BAR[k], lo[k]);
}

function common(w, h, ins, U, bk) {
  const land = LAY.land;
  put(TITLE_SOUND, land ? R(w - ins.r - clamp(w * 0.5, 520, 780) - 138, ins.t + 18, 120, 62) : R(w - 138 - ins.r, ins.t + 18, 120, 62));
  const lw = Math.min(w - 80, 640), lp = R(Math.round((w - lw) / 2), 0, lw, 520);
  lp.y = Math.round(Math.max(U.y0 + 10, (h - lp.h) / 2 - (land ? 0 : 60)));
  put(LIMIT.panel, lp); put(LIMIT.btn, R(lp.x + 60, lp.y + 390, lp.w - 120, 90));

  // reference pages: header row (A- / % / A+), scrolling panel, Back / Next
  const rowY = ins.t + 16, rowH = 62, px0 = bk ? ins.l + bk + 16 : ins.l + 20, px1 = w - ins.r - 20;
  const pw = land ? Math.min(U.w - 56, 1000) : w - 40 - ins.l - ins.r, panelX = land ? Math.round((w - pw) / 2) : 20 + ins.l;
  const hx0 = Math.max(land ? panelX : px0, px0), hx1 = land ? panelX + pw : px1;
  put(TEXT_DEC, R(hx0, rowY, 130, rowH)); put(TEXT_INC, R(hx1 - 130, rowY, 130, rowH));
  const navH = land ? 74 : 96, pad = land ? 12 : 40, navY = h - ins.b - pad - navH, nbw = land ? Math.min(330, (pw - 16) / 2) : (w - 40 - 16 - ins.l - ins.r) / 2;
  const nx = land ? (w - (nbw * 2 + 16)) / 2 : 20 + ins.l;
  put(REF_BACK, R(nx, navY, nbw, navH)); put(REF_NEXT, R(nx + nbw + 16, navY, nbw, navH));
  const py = rowY + rowH + 12;
  put(REF_PANEL, R(panelX, py, pw, navY - 14 - py));

  const sbH = land ? 74 : 96, spad = land ? 12 : 40;
  put(SETTINGS_BACK, land ? R((w - 420) / 2, h - ins.b - spad - sbH, 420, sbH) : R(40 + ins.l, h - ins.b - spad - sbH, w - 80 - ins.l - ins.r, sbH));
  put(SETTINGS_TITLE, R(0, ins.t + 36, w, 80));
  resultLayout(w, h, ins, U, land);
  histLayout(w, h, ins, U, land, bk);
}

// ---- History: tabs + two boards + one caption -------------------------------------------------------------------------------------
// textScale (1..3) is the player's text zoom: the caption panel grows with it and the boards give way.
export let HIST_TEXT = 1;
export function setHistText(sc) { if (sc !== HIST_TEXT) { HIST_TEXT = sc; lastKey = ''; applyLayout(W, H); } }
function histLayout(w, h, ins, U, land, bk) {
  const hy = ins.t + 14, hx0 = bk ? ins.l + bk + 14 : ins.l + 16;
  put(HIST.menu, R(hx0, hy, 128, 58));
  const sideLeft = U.x0 + 14, innerW = U.w - 28, labH = 38, g = 8, sc = Math.min(HIST_TEXT, 2.6);
  const frameK = 2 * 0.34 + 8;
  const S = (b) => Math.max(14, Math.floor(b / frameK)), put2 = (o, x, y, s) => { o.S = s; o.F = Math.round(s * 0.34); o.x = x; o.y = y; };
  const bwOf = (s) => s * 8 + 2 * Math.round(s * 0.34);
  const backH = land ? 66 : 90;
  // candidate C (landscape): tabs share the top row with Menu, the boards sit side by side on the left, the caption on the right
  const tabsRowX = HIST.menu.x + HIST.menu.w + 10, tabsRowW = U.x1 - 14 - tabsRowX;
  let layout = 'stack';
  const topA = hy + 58 + 12;                                  // below Menu, tabs on their own row
  const tabH = 62, tg = 6;
  const backYa = h - ins.b - (land ? 12 : 30) - backH;
  const topB = topA + tabH + 12, availA = backYa - 12 - topB;
  const capHa = clamp((land ? 210 : 270) * sc * 0.85, 160, availA * (land ? 0.5 : 0.55));
  const areaA = availA - capHa - g;
  const sideBoard = Math.min((innerW - 14) / 2, areaA - labH), stackBoard = Math.min(innerW, (areaA - 2 * labH - g) / 2);
  let best = Math.max(sideBoard, stackBoard);
  layout = sideBoard >= stackBoard ? 'side' : 'stack';
  // C
  const topC = hy + 58 + 10, tabHC = 54, backYc = h - ins.b - 12 - backH, boardsTop = hy + 30 + 54 + 12;
  const availC = backYc - 12 - boardsTop - labH - 4;
  const capWc = clamp(300 * Math.min(sc, 1.8), 300, innerW * 0.5);
  const cBoard = Math.min(availC, (innerW - capWc - 14 - 14) / 2);
  if (land && cBoard > best * 1.02) layout = 'cols';
  void topC; void tabHC;
  if (layout === 'cols') {
    const tw = (tabsRowW - tg * 5) / 6;
    HIST.tabs.forEach((t, i) => put(t, R(tabsRowX + i * (tw + tg), hy + 30, tw, 54)));
    const s = S(cBoard), bw = bwOf(s), x0 = sideLeft, y0 = boardsTop + Math.max(0, (availC - bw) / 2);
    put(HIST.labA, R(x0, y0, bw, labH)); put2(HIST.A, x0, y0 + labH + 4, s);
    put(HIST.labB, R(x0 + bw + 14, y0, bw, labH)); put2(HIST.B, x0 + bw + 14, y0 + labH + 4, s);
    const cx = x0 + bw * 2 + 14 + 14, cw = U.x1 - 14 - cx;
    put(HIST.capA, R(cx, boardsTop, cw, backYc - 12 - boardsTop));
    put(HIST.back, R(cx, backYc, cw, backH));
    HIST.side = true; HIST.cols = true;
  } else {
    HIST.cols = false;
    const tw = (innerW - tg * 5) / 6;
    HIST.tabs.forEach((t, i) => put(t, R(sideLeft + i * (tw + tg), topA, tw, tabH)));
    put(HIST.back, R(land ? (w - 420) / 2 : 40 + ins.l, backYa, land ? 420 : w - 80 - ins.l - ins.r, backH));
    HIST.side = layout === 'side';
    const bottomCap = backYa - 12, caph = capHa;
    put(HIST.capA, R(sideLeft, bottomCap - caph, innerW, caph));
    if (HIST.side) {
      const s = S(sideBoard), bw = bwOf(s), gap = 14, x0 = sideLeft + (innerW - (bw * 2 + gap)) / 2, y0 = topB + Math.max(0, (areaA - labH - bw) / 2);
      put(HIST.labA, R(x0, y0, bw, labH)); put2(HIST.A, x0, y0 + labH, s);
      put(HIST.labB, R(x0 + bw + gap, y0, bw, labH)); put2(HIST.B, x0 + bw + gap, y0 + labH, s);
    } else {
      const s = S(stackBoard), bw = bwOf(s), x0 = sideLeft + (innerW - bw) / 2, free = Math.max(0, areaA - 2 * (labH + bw) - g), y0 = topB + free / 2;
      put(HIST.labA, R(x0, y0, bw, labH)); put2(HIST.A, x0, y0 + labH, s);
      const y1 = y0 + labH + bw + g;
      put(HIST.labB, R(x0, y1, bw, labH)); put2(HIST.B, x0, y1 + labH, s);
    }
  }
  put(HIST.capB, HIST.capA);
}

// the settings rows (9, the last is Restore purchase)
export const SETTINGS_ROWS = 9;
export function SETTINGS_ROW(i, tall = false) {
  const ins = LAY.ins;
  if (LAY.land) {
    const pw = Math.min(LAY.U.w - 56, 1100), x0 = (W - pw) / 2, cw = (pw - 16) / 2;
    const top = ins.t + 96, bot = SETTINGS_BACK.y - 12, pitch = Math.min(130, (bot - top) / Math.ceil(SETTINGS_ROWS / 2)), rh = pitch - 12;
    return R(x0 + (i % 2) * (cw + 16), top + Math.floor(i / 2) * pitch, cw, rh);
  }
  const top = (tall ? 112 : 130) + ins.t, bot = SETTINGS_BACK.y - 14, nat = tall ? 168 : 128, pitch = Math.min(nat, (bot - top + 12) / SETTINGS_ROWS), rh = pitch * 0.9;
  return R(40 + ins.l, top + i * pitch, W - 80 - ins.l - ins.r, rh);
}
export const settingsTall = (textIdx) => textIdx >= 3 && !LAY.land && (SETTINGS_BACK.y - 14 - 112 - LAY.ins.t + 12) / SETTINGS_ROWS >= 156;

function resultLayout(w, h, ins, U, land) {
  RESULT.land = land;
  if (!land) {
    const pH = Math.min(1100, h - ins.t - ins.b - 60), pw = w - 80 - ins.l - ins.r;
    const P = R(40 + ins.l, Math.max(ins.t + 16, Math.min(150 + Math.max(0, (h - 1560) / 2), h - ins.b - 16 - pH)), pw, pH);
    put(RESULT.panel, P);
    const f = Math.min(1, pH / 1100);
    put(RESULT.inc, R(P.x + P.w - 114, P.y + 18, 96, 66)); put(RESULT.dec, R(P.x + P.w - 114 - 106, P.y + 18, 96, 66));
    put(RESULT.title, R(P.x + 50, P.y + 84 * f, P.w - 100, 160 * f));
    put(RESULT.art, R(P.x, P.y + 250 * f, P.w, 200 * f));
    put(RESULT.sub, R(P.x + 45, P.y + 460 * f, P.w - 90, 210 * f));
    const bh = Math.max(76, 90 * f), by = P.y + 680 * f;
    put(RESULT.again, R(P.x + 40, by, P.w - 80, bh)); put(RESULT.menu, R(P.x + 40, by + bh + 12, P.w - 80, bh));
    const cy = by + 2 * bh + 12 + 60 * f;
    put(RESULT.chipsLabel, R(P.x, cy - 36, P.w, 28)); put(RESULT.chips, R(P.x + 20, cy, P.w - 40, 64 * 2 + 14)); RESULT.chips.ch = 64;
    return;
  }
  const pw = Math.min(U.w - 40, 1040), P = R(Math.round((w - pw) / 2), U.y0 + 12, pw, U.h - 24);
  put(RESULT.panel, P);
  put(RESULT.inc, R(P.x + P.w - 114, P.y + 14, 96, 64)); put(RESULT.dec, R(P.x + P.w - 114 - 106, P.y + 14, 96, 64));
  const lw = Math.round(P.w * 0.44), rx = P.x + lw + 10, rw = P.w - lw - 36;
  put(RESULT.title, R(P.x + 30, P.y + 40, lw - 40, 130));
  put(RESULT.art, R(P.x + 20, P.y + 180, lw - 20, Math.max(150, P.h - 210)));
  const bh = 74, chipsH = 2 * 64 + 10, bottom = P.y + P.h - 18;
  const chipsY = bottom - chipsH, labelY = chipsY - 34, menuY = labelY - 12 - bh, againY = menuY - 10 - bh, subY = P.y + 88;
  put(RESULT.sub, R(rx, subY, rw, Math.max(60, againY - 14 - subY)));
  put(RESULT.again, R(rx, againY, rw, bh)); put(RESULT.menu, R(rx, menuY, rw, bh));
  put(RESULT.chipsLabel, R(rx, labelY, rw, 28)); put(RESULT.chips, R(rx, chipsY, rw, chipsH)); RESULT.chips.ch = 64;
}
export const chipRect = (i) => { const c = RESULT.chips, gap = 10, cw = (c.w - gap) / 2; return R(c.x + (i % 2) * (cw + gap), c.y + Math.floor(i / 2) * (c.ch + gap), cw, c.ch); };

// ---- title screen --------------------------------------------------------------------------------------------------------------
// `tall` (text size 250 / 300 %): taller buttons and a wide How to Play row so the big text has room.
const titleCache = new Map();
export function titleRows(hasSaved, tall = false) {
  const key = `${LAY.key}|${hasSaved ? 1 : 0}|${tall ? 1 : 0}`;
  let rows = titleCache.get(key);
  if (!rows) { rows = buildTitle(!!hasSaved, !!tall); titleCache.set(key, rows); if (titleCache.size > 24) titleCache.delete(titleCache.keys().next().value); }
  return rows;
}
const LOCK_AR = 327 / 1200, LOCK_W = 250;
// Tap zone of the title lockup (>= 44 css px each way; sideways and downward only, never into the buttons above).
export function lockHit(rows) {
  const c = rows.lock; if (!c) return null; const m = 44 / Math.max(0.05, host.px), w = Math.max(c.w, m), y = c.y - 2;
  return R(c.x - w / 2, y, w, Math.max(c.w * LOCK_AR + 2, Math.min(m, H - y)));
}
function buildTitle(hasSaved, tall) {
  const land = LAY.land, ins = LAY.ins, U = LAY.U;
  const colW = land ? clamp(W * 0.44, 480, 700) : W, bw = Math.min(620, colW - 56);
  const colX = land ? W - ins.r - colW + (colW - bw) / 2 : (W - bw) / 2;
  const base = tall
    ? { gap: 12, resume: 74, play: 124, two: 100, watch: 100, level: 96, small: 82 }
    : { gap: 14, resume: 78, play: 108, two: 88, watch: 88, level: 82, small: 78 };
  const rowsH = (k) => {
    let n = 0, s = 0; const add = (v) => { s += v * k; n++; };
    if (hasSaved) add(base.resume); add(base.play); add(base.two); add(base.watch); add(base.level); add(base.small); if (tall) add(base.small);
    return s + base.gap * k * (n - 1);
  };
  const bkB = ins.back ? Math.max(ins.back, 48) + 14 : 0, heroTop0 = land ? 0 : Math.max(ins.t > 0 ? ins.t + 6 : 0, bkB ? ins.t + bkB - 70 : 0);
  let kk = 1, heroH = 620, y0;
  if (!land) {
    const bottom = H - ins.b - 12 - (Math.min(LOCK_W, W - 80) * LOCK_AR + 14);
    for (const k of [1.22, 1.12, 1, 0.94, 0.88, 0.82, 0.76, 0.7]) { kk = k; heroH = bottom - rowsH(k) - 18 - heroTop0; if (heroH >= (k > 1 ? 560 : 420)) break; }
    heroH = clamp(heroH, 300, 640); y0 = heroTop0 + heroH + 12;
  } else {
    const avail = U.h - 24 - (Math.min(LOCK_W, bw) * LOCK_AR + 14);
    for (const k of [1, 0.92, 0.84, 0.76, 0.68, 0.6]) { kk = k; if (rowsH(k) <= avail) break; }
    y0 = U.y0 + 12 + Math.max(0, (avail - rowsH(kk)) / 2);
  }
  const gap = base.gap * kk, half = (bw - gap) / 2, third = (bw - gap * 2) / 3, rows = {}, hh = (v) => v * kk;
  let y = y0;
  if (hasSaved) { rows.resume = R(colX, y, bw, hh(base.resume)); y += hh(base.resume) + gap; }
  rows.play = R(colX, y, bw, hh(base.play)); y += hh(base.play) + gap;
  rows.two = R(colX, y, half, hh(base.two)); rows.learn = R(colX + half + gap, y, half, hh(base.two)); y += hh(base.two) + gap;
  rows.watch = R(colX, y, half, hh(base.watch)); rows.history = R(colX + half + gap, y, half, hh(base.watch)); y += hh(base.watch) + gap;
  rows.level = R(colX, y, half, hh(base.level)); rows.era = R(colX + half + gap, y, half, hh(base.level)); y += hh(base.level) + gap;
  if (tall) {
    rows.settings = R(colX, y, half, hh(base.small)); rows.howto = R(colX + half + gap, y, half, hh(base.small)); y += hh(base.small) + gap;
    rows.rules = R(colX, y, half, hh(base.small)); rows.about = R(colX + half + gap, y, half, hh(base.small)); rows.bottom = y + hh(base.small);
  } else {
    const q = (bw - gap * 3) / 4;
    rows.settings = R(colX, y, q, hh(base.small)); rows.howto = R(colX + (q + gap), y, q, hh(base.small));
    rows.rules = R(colX + (q + gap) * 2, y, q, hh(base.small)); rows.about = R(colX + (q + gap) * 3, y, q, hh(base.small)); rows.bottom = y + hh(base.small);
  }
  rows.k = kk; rows.land = land;
  if (!land) {
    rows.hero = R(0, 0, W, heroTop0 + heroH); rows.heroScale = heroH / 620; rows.heroCx = W / 2; rows.heroTop = heroTop0;
    const lw = Math.min(LOCK_W, W - 80);
    rows.lock = { x: W / 2, y: rows.bottom + 12, w: lw };
  } else {
    const hw = W - colW - ins.r;
    rows.hero = R(0, 0, hw, H); rows.heroScale = clamp(Math.min((hw - ins.l - 30) / 720, (H - ins.t - ins.b - 24) / 640), 0.3, 1.25);
    rows.heroCx = ins.l + (hw - ins.l) / 2; rows.heroTop = Math.max(ins.t + 4, (H - ins.b - 640 * rows.heroScale) / 2, bkB ? ins.t + bkB - 70 * rows.heroScale : 0);
    rows.lock = { x: colX + bw / 2, y: rows.bottom + 12, w: Math.min(LOCK_W, bw) };
  }
  return rows;
}
applyLayout(720, 1560);
