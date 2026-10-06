// Screen geometry: every rectangle in one place so game.js (hit-testing) and view.js (drawing) never disagree.
//
// FLUID LAYOUT (kit 1.7.x): the virtual screen follows the real one: the SHORT side is always 720 units, the long side grows with
// the aspect ratio. `applyLayout(w, h)` recomputes everything below from the live size (and `host`, the safe areas + the host's
// floating back button) and is cached by size, so calling it every frame is free. The exports are live bindings / objects that
// are updated IN PLACE, so game.js and view.js always read the current geometry.
//
// Shapes:
//   portrait  (w < h): header, plates, board, count strip, message, button bar. 720 x 1560 is the approved phone look; shorter
//             screens (16:9 phones, tablets) drop the info strip and tighten the gaps, the board shrinks only as far as it must.
//   wide      (landscape, usable width >= 1100): a left card (plates, count strip, message), the board in the middle, a right card
//             (Menu, Sound and the buttons, stacked).
//   wide1     (landscape, narrower: 4:3 tablets, split windows): the board on the right and ONE card on the left that holds
//             everything (Menu / Sound beside the back button, plates, count, message, a 2-column button grid).
// The top-left corner is kept clear of the host's floating back button (`host.back`, in virtual units).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_TIME = 2;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the back button in virtual units (main.js keeps this current; browsers: zeros). `px` = css pixels per virtual unit.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };

export let W = 720, H = 1560;
export let SQ = 78, FRAME = 30, GRID = 624, GX = 0, GY = 0;
export let PIECE_K = 0.74; // sprite units -> pixels
export let BAR_Y = 0, BAR_H = 108;
const R = (x, y, w, h) => ({ x, y, w, h });
const put = (t, r) => Object.assign(t, r);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mk = () => R(0, 0, 0, 0);

export const BOARD = mk(), HDR = { menu: mk(), sound: mk() };
export const PLATE_TOP = mk(), PLATE_BOT = mk(), COUNT = mk(), MSG = mk(), INFO_STRIP = mk(), PROMO_BANNER = mk();
export const BTN = { undo: mk(), hint: mk(), threat: mk(), end: mk() };
export const AUTO = { exit: mk(), pause: mk(), dec: mk(), val: mk(), inc: mk() };
export const LEARN_BAR = { menu: mk(), hint: mk(), reset: mk(), next: mk() };
export const TITLE_SOUND = mk();
export const LIMIT = { panel: mk(), btn: mk() };
export const TEXT_DEC = mk(), TEXT_INC = mk(), REF_BACK = mk(), REF_NEXT = mk(), REF_PANEL = mk();
export const SETTINGS_BACK = mk(), SETTINGS_TITLE = mk();
export const RESULT = { panel: mk(), dec: mk(), inc: mk(), title: mk(), art: mk(), sub: mk(), again: mk(), menu: mk(), chipsLabel: mk(), chips: { x: 0, y: 0, w: 0, h: 0, ch: 64 }, land: false };
export const SIBLINGS = [
  { slug: 'xiangqi-river-and-palace', title: 'Xiangqi' },
  { slug: 'shogi-generals-and-drops', title: 'Shogi' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'chess-royal-sixty-four', title: 'Chess' },
];
// Layout facts the drawing code needs.
export const LAY = { land: false, wide: false, wide1: false, level: 0, ins: { t: 0, r: 0, b: 0, l: 0, back: 0 }, U: { x0: 0, y0: 0, x1: 720, y1: 1560, w: 720, h: 1560 }, backBox: mk(), key: '' };

// square <-> screen. `flip` shows Ruby at the bottom (board turned 180 degrees).
export function squareXY(s, flip) {
  let f = s & 7, r = s >> 3;
  if (flip) { f = 7 - f; r = 7 - r; }
  return { x: GX + f * SQ, y: GY + (7 - r) * SQ };
}
export function squareCentre(s, flip) { const q = squareXY(s, flip); return { x: q.x + SQ / 2, y: q.y + SQ / 2 }; }
// the point where a piece stands (bottom centre of its square)
export function squareFoot(s, flip) { const q = squareXY(s, flip); return { x: q.x + SQ / 2, y: q.y + SQ - 8 }; }
export function squareAt(x, y, flip) {
  if (x < GX || x >= GX + GRID || y < GY || y >= GY + GRID) return -1;
  let f = Math.floor((x - GX) / SQ), r = 7 - Math.floor((y - GY) / SQ);
  if (flip) { f = 7 - f; r = 7 - r; }
  return r * 8 + f;
}

// Stack `items` ({k, pref, min}) top to bottom in [y0, y1]; when they do not fit, shrink toward `min`, then uniformly.
function flow(x, y0, y1, w, items, gap) {
  const out = {}, n = items.length, avail = y1 - y0 - gap * (n - 1), sum = (a) => a.reduce((s, v) => s + v, 0);
  let hs = items.map((i) => i.pref);
  if (sum(hs) > avail) {
    const slack = sum(items.map((i) => i.pref - i.min)), need = sum(hs) - avail;
    if (slack >= need) hs = items.map((i) => i.pref - (slack ? (i.pref - i.min) * (need / slack) : 0));
    else { const f = avail / Math.max(1, sum(items.map((i) => i.min))); hs = items.map((i) => i.min * Math.max(0.5, f)); }
  }
  let y = y0;
  items.forEach((it, i) => { out[it.k] = R(x, y, w, hs[i]); y += hs[i] + gap; });
  return out;
}
// Place rows of buttons ([[key, weight], ...] per row) in a box; rows share the height (capped at `pref`), the content is centred.
function rowsIn(out, x, y0, y1, w, rows, gap, pref, min) {
  const n = rows.length, h = clamp((y1 - y0 - gap * (n - 1)) / n, min, pref), total = n * h + gap * (n - 1);
  let y = y0 + Math.max(0, (y1 - y0 - total) / 2);
  for (const row of rows) {
    const tw = row.reduce((s, c) => s + c[1], 0), cw = w - gap * (row.length - 1);
    let cx = x;
    for (const [k, wt] of row) { const bw = (cw * wt) / tw; out[k] = R(cx, y, bw, h); cx += bw + gap; }
    y += h + gap;
  }
}
const setSize = (B) => {
  SQ = Math.max(24, Math.floor(B / (8 + 2 * (30 / 78)) + 1e-6)); FRAME = Math.round(SQ * (30 / 78)); GRID = SQ * 8; PIECE_K = 0.74 * (SQ / 78);
  const bs = GRID + FRAME * 2; put(BOARD, R(0, 0, bs, bs));
};
const placeBoard = (x, y) => { BOARD.x = Math.round(x); BOARD.y = Math.round(y); GX = BOARD.x + FRAME; GY = BOARD.y + FRAME; };

let lastKey = '';
export function applyLayout(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1560;
  const ins = { t: Math.round(host.t), r: Math.round(host.r), b: Math.round(host.b), l: Math.round(host.l), back: Math.round(host.back) };
  const key = `${w}x${h}|${ins.t},${ins.r},${ins.b},${ins.l},${ins.back}`;
  if (key === lastKey) return false;
  lastKey = key;
  W = w; H = h;
  const land = w > h || h < w * 1.2, U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bk = ins.back ? Math.max(ins.back, 48) : 0;
  const backBox = bk ? R(ins.l, ins.t, bk + 8, bk + 8) : R(0, 0, 0, 0);
  Object.assign(LAY, { land, ins, U, key, wide: false, wide1: false, level: 0 }); put(LAY.backBox, backBox);
  if (!land) portrait(w, h, ins, U, bk); else landscape(w, h, ins, U, bk, backBox);
  common(w, h, ins, U, bk);
  return true;
}

// ---- play screens: portrait ---------------------------------------------------------------------------------------
function portrait(w, h, ins, U, bk) {
  const hx0 = bk ? ins.l + bk + 16 : ins.l + 18, hy = ins.t + 18;
  put(HDR.menu, R(hx0, hy, 120, 62)); put(HDR.sound, R(w - 138 - ins.r, hy, 120, 62));
  const levels = [
    { plate: 70, count: 104, msg: 130, bar: 108, info: 44, g: 16, gh: 24 },
    { plate: 70, count: 104, msg: 130, bar: 108, info: 0, g: 16, gh: 24 },
    { plate: 70, count: 96, msg: 112, bar: 100, info: 0, g: 12, gh: 18 },
    { plate: 66, count: 92, msg: 100, bar: 92, info: 0, g: 10, gh: 12 },
    { plate: 62, count: 88, msg: 92, bar: 86, info: 0, g: 8, gh: 8 },
  ];
  const bottom = h - ins.b - 14, hdrEnd = hy + 62, needGh = bk ? ins.t + bk + 8 + 6 - hdrEnd : 0;
  for (const l of levels) l.gh = Math.max(l.gh, needGh);
  const fixed = (lv) => hdrEnd + lv.gh + lv.plate + lv.g + lv.g + lv.plate + lv.g + lv.count + (lv.g - 2) + lv.msg + lv.g + lv.bar + (lv.info ? lv.g + lv.info : 0);
  const bMax = Math.min(684, w - 36);
  let pick = levels.length - 1;
  for (let i = 0; i < levels.length; i++) { if (bottom - fixed(levels[i]) >= bMax - 1 || i === levels.length - 1) { pick = i; break; } }
  const lv = levels[pick], B = Math.max(300, Math.min(bMax, bottom - fixed(lv)));
  LAY.level = pick;
  const slack = Math.max(0, bottom - fixed(lv) - B), shift = Math.min(slack, Math.max(0, h - 1560)) / 2;   // spare height beyond the approved 720 x 1560 look goes above the board
  let y = hdrEnd + lv.gh + shift;
  const px = 18 + ins.l, pw = w - 36 - ins.l - ins.r;
  put(PLATE_TOP, R(px, y, pw, lv.plate)); y += lv.plate + lv.g;
  setSize(B); placeBoard((w - BOARD.w) / 2, y); y += BOARD.h + lv.g;
  put(PLATE_BOT, R(px, y, pw, lv.plate)); y += lv.plate + lv.g;
  put(COUNT, R(px, y, pw, lv.count)); y += lv.count + (lv.g - 2);
  put(MSG, R(24 + ins.l, y, w - 48 - ins.l - ins.r, lv.msg)); y += lv.msg + lv.g;
  BAR_Y = y; BAR_H = lv.bar; y += lv.bar + lv.g;
  put(INFO_STRIP, R(24 + ins.l, y, w - 48 - ins.l - ins.r, lv.info));
  const bx = 24 + ins.l, bw = w - 48 - ins.l - ins.r, g4 = 14, b4 = (bw - g4 * 3) / 4;
  const slot4 = (i) => R(bx + i * (b4 + g4), BAR_Y, b4, BAR_H);
  put(BTN.undo, slot4(0)); put(BTN.hint, slot4(1)); put(BTN.threat, slot4(2)); put(BTN.end, slot4(3));
  // Watch & Learn: Exit, Pause/Resume, think time - / value / +  (the approved proportions, spread over the bar)
  const f = bw / 672, ax = (v) => bx + (v - 24) * f;
  put(AUTO.exit, R(ax(24), BAR_Y, 150 * f, BAR_H)); put(AUTO.pause, R(ax(188), BAR_Y, 196 * f, BAR_H)); put(AUTO.dec, R(ax(398), BAR_Y, 100 * f, BAR_H));
  put(AUTO.val, R(ax(498), BAR_Y, 98 * f, BAR_H)); put(AUTO.inc, R(ax(596), BAR_Y, 100 * f, BAR_H));
  const l4 = (bw - 14 * 3) / 630, wl = [150, 150, 150, 180].map((v) => v * l4);
  let lx = bx; ['menu', 'hint', 'reset', 'next'].forEach((k, i) => { put(LEARN_BAR[k], R(lx, BAR_Y, wl[i], BAR_H)); lx += wl[i] + 14; });
  put(PROMO_BANNER, R(BOARD.x + 60, BOARD.y + BOARD.h / 2 - 60, BOARD.w - 120, 120));
}

// ---- play screens: landscape ----------------------------------------------------------------------------------------
function landscape(w, h, ins, U, bk, backBox) {
  const M = 12, wide = U.w >= 1100;
  LAY.wide = wide; LAY.wide1 = !wide;
  const Pmin = 300;
  const TOPPAD = 30, B = Math.max(260, Math.min(U.h - 2 * M - TOPPAD, wide ? U.w - 2 * Pmin - 4 * M : U.w - Pmin - 3 * M));
  setSize(B);
  const by = U.y0 + TOPPAD + (U.h - TOPPAD - BOARD.h) / 2;
  const sets = (set, o, keys) => { for (const k of keys) put(set[k], o[k]); };
  if (wide) {
    placeBoard(U.x0 + (U.w - BOARD.w) / 2, by);
    const lx = U.x0 + M, lw = BOARD.x - M - lx, rx = BOARD.x + BOARD.w + M, rw = U.x1 - M - rx, y1 = U.y1 - M;
    const topBelowBack = bk ? Math.max(U.y0 + M, backBox.y + backBox.h + 6) : U.y0 + M;
    const f = flow(lx, topBelowBack, y1, lw, [{ k: 'pt', pref: 108, min: 96 }, { k: 'pb', pref: 108, min: 96 }, { k: 'c', pref: 104, min: 84 }, { k: 'm', pref: 150, min: 96 }, { k: 'i', pref: 36, min: 0 }], 10);
    put(PLATE_TOP, f.pt); put(PLATE_BOT, f.pb); put(COUNT, f.c); put(MSG, f.m); put(INFO_STRIP, f.i);
    const rowY = U.y0 + M, rowH = 62, half = (rw - 10) / 2;
    put(HDR.menu, R(rx, rowY, half, rowH)); put(HDR.sound, R(rx + half + 10, rowY, half, rowH));
    const y0 = rowY + rowH + 14, o1 = {}, o2 = {}, o3 = {};
    rowsIn(o1, rx, y0, y1, rw, [[['undo', 1]], [['hint', 1]], [['threat', 1]], [['end', 1]]], 12, 110, 64); sets(BTN, o1, ['undo', 'hint', 'threat', 'end']);
    rowsIn(o2, rx, y0, y1, rw, [[['exit', 1]], [['pause', 1]], [['dec', 1], ['val', 1.3], ['inc', 1]]], 12, 110, 64); sets(AUTO, o2, ['exit', 'pause', 'dec', 'val', 'inc']);
    rowsIn(o3, rx, y0, y1, rw, [[['hint', 1]], [['reset', 1]], [['next', 1]]], 12, 110, 64); sets(LEARN_BAR, o3, ['hint', 'reset', 'next']); put(LEARN_BAR.menu, HDR.menu);
  } else {
    placeBoard(U.x1 - M - BOARD.w, by);
    const lx = U.x0 + M, lw = BOARD.x - M - lx, y1 = U.y1 - M;
    const rowY = U.y0 + M, rowH = 56, mx = bk ? backBox.x + backBox.w + 6 : lx, bw2 = clamp((lx + lw - mx - 8) / 2, 64, 130);
    put(HDR.menu, R(mx, rowY, bw2, rowH)); put(HDR.sound, R(mx + bw2 + 8, rowY, bw2, rowH));
    const top = Math.max(rowY + rowH + 8, bk ? backBox.y + backBox.h + 4 : 0), gridH = 2 * 72 + 8;
    const f = flow(lx, top, y1 - gridH - 8, lw, [{ k: 'pt', pref: 100, min: 80 }, { k: 'pb', pref: 100, min: 80 }, { k: 'c', pref: 96, min: 76 }, { k: 'm', pref: 130, min: 90 }], 8);
    put(PLATE_TOP, f.pt); put(PLATE_BOT, f.pb); put(COUNT, f.c); put(MSG, f.m); put(INFO_STRIP, R(lx, 0, lw, 0));
    const gy0 = y1 - gridH, o1 = {}, o2 = {}, o3 = {};
    rowsIn(o1, lx, gy0, y1, lw, [[['undo', 1], ['hint', 1]], [['threat', 1], ['end', 1]]], 8, 72, 56); sets(BTN, o1, ['undo', 'hint', 'threat', 'end']);
    rowsIn(o2, lx, gy0, y1, lw, [[['exit', 1], ['pause', 1.3]], [['dec', 1], ['val', 1.4], ['inc', 1]]], 8, 72, 56); sets(AUTO, o2, ['exit', 'pause', 'dec', 'val', 'inc']);
    rowsIn(o3, lx, gy0, y1, lw, [[['hint', 1], ['reset', 1]], [['next', 1]]], 8, 72, 56); sets(LEARN_BAR, o3, ['hint', 'reset', 'next']); put(LEARN_BAR.menu, HDR.menu);
  }
  BAR_Y = BTN.undo.y; BAR_H = BTN.undo.h;
  put(PROMO_BANNER, R(BOARD.x + 40, BOARD.y + BOARD.h / 2 - 50, BOARD.w - 80, 100));
}

// ---- everything else: title sound, demo limit, reference pages, settings, result ------------------------------------
function common(w, h, ins, U, bk) {
  const land = LAY.land;
  put(TITLE_SOUND, land ? R(w - ins.r - clamp(w * 0.5, 520, 780) - 138, ins.t + 18, 120, 62) : R(w - 138 - ins.r, ins.t + 18, 120, 62));
  const lw = Math.min(w - 80, 640), lp = R(Math.round((w - lw) / 2), 0, lw, 520);
  lp.y = Math.round(Math.max(U.y0 + 10, (h - lp.h) / 2 - (land ? 0 : 60)));
  put(LIMIT.panel, lp); put(LIMIT.btn, R(lp.x + 60, lp.y + 390, lp.w - 120, 90));

  // reference pages: header row (A- / % / A+), scrolling panel, page line, Back / Next
  const rowY = ins.t + 18, rowH = 64, px0 = bk ? ins.l + bk + 16 : ins.l + 20, px1 = w - ins.r - 20;
  const pw = land ? Math.min(U.w - 56, 1000) : w - 56 - ins.l - ins.r, panelX = land ? Math.round((w - pw) / 2) : 28 + ins.l;
  const hx0 = Math.max(land ? panelX : px0, px0), hx1 = land ? panelX + pw : px1;
  put(TEXT_DEC, R(hx0, rowY, 130, rowH)); put(TEXT_INC, R(hx1 - 130, rowY, 130, rowH));
  const navH = land ? 80 : 104, pad = land ? 14 : 46, navY = h - ins.b - pad - navH, nbw = land ? Math.min(330, (pw - 16) / 2) : (w - 40 - 16 - ins.l - ins.r) / 2;
  const nx = land ? (w - (nbw * 2 + 16)) / 2 : 20 + ins.l;
  put(REF_BACK, R(nx, navY, nbw, navH)); put(REF_NEXT, R(nx + nbw + 16, navY, nbw, navH));
  const py = rowY + rowH + 12;
  put(REF_PANEL, R(panelX, py, pw, navY - 14 - py));

  const sbH = land ? 80 : 104, spad = land ? 14 : 46;
  put(SETTINGS_BACK, land ? R((w - 420) / 2, h - ins.b - spad - sbH, 420, sbH) : R(40 + ins.l, h - ins.b - spad - sbH, w - 80 - ins.l - ins.r, sbH));
  put(SETTINGS_TITLE, R(0, ins.t + 40, w, 80));
  resultLayout(w, h, ins, U, land);
}
// the settings rows (7), `tall` = text size 250 / 300 % (portrait only; landscape rows are always the compact kind)
export function SETTINGS_ROW(i, tall = false) {
  const ins = LAY.ins;
  if (LAY.land) {
    const pw = Math.min(LAY.U.w - 56, 1100), x0 = (W - pw) / 2, cw = (pw - 16) / 2;
    const top = ins.t + 96, bot = SETTINGS_BACK.y - 12, pitch = Math.min(130, (bot - top) / 4), rh = pitch - 12;
    return R(x0 + (i % 2) * (cw + 16), top + Math.floor(i / 2) * pitch, cw, rh);
  }
  const top = (tall ? 118 : 140) + ins.t, bot = SETTINGS_BACK.y - 16, nat = tall ? 182 : 138, pitch = Math.min(nat, (bot - top + (tall ? 14 : 20)) / 7), rh = pitch * (tall ? 168 / 182 : 118 / 138);
  return R(40 + ins.l, top + i * pitch, W - 80 - ins.l - ins.r, rh);
}
export const SETTINGS_ROWS = 7;
// the tall settings rows (big text) only when the screen has the room for them; otherwise the compact rows are used
export const settingsTall = (textIdx) => textIdx >= 3 && !LAY.land && (SETTINGS_BACK.y - 16 - 118 - LAY.ins.t + 14) / 7 >= 172;

function resultLayout(w, h, ins, U, land) {
  RESULT.land = land;
  if (!land) {
    const pH = Math.min(1180, h - ins.t - ins.b - 60), pw = w - 80 - ins.l - ins.r;
    const P = R(40 + ins.l, Math.max(ins.t + 16, Math.min(150 + Math.max(0, (h - 1560) / 2), h - ins.b - 16 - pH)), pw, pH);
    put(RESULT.panel, P);
    const f = Math.min(1, pH / 1180);
    put(RESULT.inc, R(P.x + P.w - 114, P.y + 18, 96, 66)); put(RESULT.dec, R(P.x + P.w - 114 - 106, P.y + 18, 96, 66));
    put(RESULT.title, R(P.x + 50, P.y + 84 * f, P.w - 100, 170 * f));
    put(RESULT.art, R(P.x, P.y + 260 * f, P.w, 210 * f));
    put(RESULT.sub, R(P.x + 45, P.y + 480 * f, P.w - 90, 230 * f));
    const bh = Math.max(76, 92 * f), by = P.y + 725 * f;
    put(RESULT.again, R(P.x + 40, by, P.w - 80, bh)); put(RESULT.menu, R(P.x + 40, by + bh + 12, P.w - 80, bh));
    const cy = by + 2 * bh + 12 + 62 * f;
    put(RESULT.chipsLabel, R(P.x, cy - 36, P.w, 28)); put(RESULT.chips, R(P.x + 20, cy, P.w - 40, 64 * 2 + 14)); RESULT.chips.ch = 64;
    return;
  }
  const pw = Math.min(U.w - 40, 1040), P = R(Math.round((w - pw) / 2), U.y0 + 12, pw, U.h - 24);
  put(RESULT.panel, P);
  put(RESULT.inc, R(P.x + P.w - 114, P.y + 14, 96, 64)); put(RESULT.dec, R(P.x + P.w - 114 - 106, P.y + 14, 96, 64));
  const lw = Math.round(P.w * 0.44), rx = P.x + lw + 10, rw = P.w - lw - 36;
  put(RESULT.title, R(P.x + 30, P.y + 40, lw - 40, 130));
  put(RESULT.art, R(P.x + 20, P.y + 180, lw - 20, Math.max(150, P.h - 210)));
  const bh = 76, chipsH = 2 * 64 + 10, bottom = P.y + P.h - 18;
  const chipsY = bottom - chipsH, labelY = chipsY - 34, menuY = labelY - 12 - bh, againY = menuY - 10 - bh, subY = P.y + 88;
  put(RESULT.sub, R(rx, subY, rw, Math.max(60, againY - 14 - subY)));
  put(RESULT.again, R(rx, againY, rw, bh)); put(RESULT.menu, R(rx, menuY, rw, bh));
  put(RESULT.chipsLabel, R(rx, labelY, rw, 28)); put(RESULT.chips, R(rx, chipsY, rw, chipsH)); RESULT.chips.ch = 64;
}
export const chipRect = (i) => { const c = RESULT.chips, gap = 10, cw = (c.w - gap) / 2; return R(c.x + (i % 2) * (cw + gap), c.y + Math.floor(i / 2) * (c.ch + gap), cw, c.ch); };

// ---- title screen ----------------------------------------------------------------------------------------------------
// `tall` (text size 250% and 300%): taller buttons and a wide How to Play row, so the big text has room.
const titleCache = new Map();
export function titleRows(hasSaved, tall = false) {
  const key = `${LAY.key}|${hasSaved ? 1 : 0}|${tall ? 1 : 0}`;
  let rows = titleCache.get(key);
  if (!rows) { rows = buildTitle(!!hasSaved, !!tall); titleCache.set(key, rows); if (titleCache.size > 24) titleCache.delete(titleCache.keys().next().value); }
  return rows;
}
const LOCK_AR = 327 / 1200, LOCK_W = 260;
// Tap zone of the title lockup (>= 44 css px each way; sideways and downward only, never into the buttons above).
export function lockHit(rows) {
  const c = rows.lock; if (!c) return null; const m = 44 / Math.max(0.05, host.px), w = Math.max(c.w, m), y = c.y - 2;
  return R(c.x - w / 2, y, w, Math.max(c.w * LOCK_AR + 2, Math.min(m, H - y)));
}
function buildTitle(hasSaved, tall) {
  const land = LAY.land, ins = LAY.ins, U = LAY.U;
  const colW = land ? clamp(W * 0.5, 520, 780) : W, bw = Math.min(620, colW - 60);
  const colX = land ? W - ins.r - colW + (colW - bw) / 2 : (W - bw) / 2;
  const base = tall ? { gap: 12, resume: 78, play: 134, two: 108, watch: 108, level: 100, howto: 84, rules: 84 } : { gap: 16, resume: 84, play: 112, two: 92, watch: 92, level: 84, howto: 84 };
  const rowsH = (k) => {
    let n = 0, s = 0; const add = (v) => { s += v * k; n++; };
    if (hasSaved) add(base.resume); add(base.play); add(base.two); add(base.watch); add(base.level); add(base.howto); if (tall) add(base.rules);
    return s + base.gap * k * (n - 1);
  };
  const bkB = ins.back ? Math.max(ins.back, 48) + 14 : 0, heroTop0 = land ? 0 : Math.max(ins.t > 0 ? ins.t + 6 : 0, bkB ? ins.t + bkB - 74 : 0);
  let kk = 1, heroH = 640, y0;
  if (!land) {
    const bottom = H - ins.b - 14 - (Math.min(LOCK_W, W - 80) * LOCK_AR + 14);
    for (const k of [1, 0.94, 0.88, 0.82, 0.76]) { kk = k; heroH = bottom - rowsH(k) - 22 - heroTop0; if (heroH >= 440) break; }
    heroH = clamp(heroH, 300, 640); y0 = heroTop0 + heroH + 14;
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
  rows.watch = R(colX, y, half, hh(base.watch)); rows.settings = R(colX + half + gap, y, half, hh(base.watch)); y += hh(base.watch) + gap;
  rows.level = R(colX, y, half, hh(base.level)); rows.side = R(colX + half + gap, y, half, hh(base.level)); y += hh(base.level) + gap;
  if (tall) {
    rows.howto = R(colX, y, bw, hh(base.howto)); y += hh(base.howto) + gap;
    rows.rules = R(colX, y, half, hh(base.rules)); rows.about = R(colX + half + gap, y, half, hh(base.rules)); rows.bottom = y + hh(base.rules);
  } else {
    rows.howto = R(colX, y, third, hh(base.howto)); rows.rules = R(colX + third + gap, y, third, hh(base.howto)); rows.about = R(colX + (third + gap) * 2, y, third, hh(base.howto)); rows.bottom = y + hh(base.howto);
  }
  rows.k = kk; rows.land = land;
  if (!land) {
    rows.hero = R(0, 0, W, heroTop0 + heroH); rows.heroScale = heroH / 640; rows.heroCx = W / 2; rows.heroTop = heroTop0;
    const lw = Math.min(LOCK_W, W - 80), lb = rows.bottom + 12 + lw * LOCK_AR;
    rows.lock = { x: W / 2, y: rows.bottom + 12, w: lw };
    rows.tip = !tall && lb + 18 + 112 + 56 <= H - ins.b ? R(Math.max(50, (W - 620) / 2), lb + 18, 620, 112) : null;
    rows.footY = Math.min(H - ins.b - 16, (rows.tip ? rows.tip.y + rows.tip.h : lb) + 46); rows.footX = W / 2;
  } else {
    const hw = W - colW - ins.r;
    rows.hero = R(0, 0, hw, H); rows.heroScale = clamp(Math.min((hw - ins.l - 40) / 720, (H - ins.t - ins.b - 24 - 80) / 640), 0.3, 1.25);
    rows.heroCx = ins.l + (hw - ins.l) / 2; rows.heroTop = Math.max(ins.t + 4, (H - ins.b - (640 * rows.heroScale + 84)) / 2, bkB ? ins.t + bkB - 74 * rows.heroScale : 0);
    rows.lock = { x: colX + bw / 2, y: rows.bottom + 12, w: Math.min(LOCK_W, bw) };
    rows.tip = null; rows.footY = H - ins.b - 16; rows.footX = rows.heroCx;
  }
  return rows;
}
applyLayout(720, 1560);
