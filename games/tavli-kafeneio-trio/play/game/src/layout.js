// Geometry for the LIVE screen size (kit 1.7 fluid viewport: the SHORT side is always 720 virtual units, the long side follows the
// screen). `setSize(w, h)` builds every rect once per size (cached) and publishes it as the live binding `L`; view.js and game.js
// read `L` each frame, so a rotation or a window resize simply re-lays everything out and the game state is untouched.
//
// THE BOARD is designed once, in "board space" B: a tall board, two columns of twelve points with the channel down the middle
// (point 24 bottom right, 13 top right, 12 top left, 1 bottom left), the two bear-off trays above and below it. The play screens
// draw that board through a transform (`L.bt`): scale `s`, and either as designed (rot 0) or turned a quarter to lie flat
// (rot 1: point 1 bottom right, 24 top right: the usual way a backgammon board is held landscape). The layout picks whichever
// fit gives the larger board. Positions of checkers/bar/trays are returned in SCREEN units; geometry in B stays below.
//   stack  portrait-ish: header (title, pips, message), the board, the dice tray, one row of four buttons.
//   side   landscape-ish: a wall-coloured status panel on the left (title, pips, message, dice, 2x2 buttons), the board on the right.
// Menus: `L.wide` (landscape or squarish) = two columns; otherwise one column that tightens on short portrait screens.
import { BAR, OFF } from './rules.js';
export { BAR, OFF };
export const BX0 = 8, BX1 = 712, BY0 = 206, BY1 = 1358;           // the board block in B (frame plus both trays)
export const FRAME = { x: 8, y: 262, w: 704, h: 1038 };          // outer edge of the wooden frame
export const IN = { x0: 34, x1: 686, y0: 288, y1: 1274 };         // the playing field
export const CH = { x0: 318, x1: 402, cx: 360 };                    // the channel (the bar in Portes)
export const SLOT = (IN.y1 - IN.y0) / 12;                           // height of one point
export const PLEN = 254;                                            // length of a point
export const D = 72, R = D / 2;                                     // checker diameter (at board scale 1)
export const MID = (IN.y0 + IN.y1) / 2;
export const TRAY = { opp: { x: 34, y: 214, w: 652, h: 44 }, me: { x: 34, y: 1306, w: 652, h: 44 } };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// `px` = css pixels per virtual unit, so text can be kept above ~11 css px. `back` is non-zero only when the host draws a back button.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R_ = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rd = (v) => Math.round(v);

// ---- the live layout -----------------------------------------------------------------------------------------------------------
export let L = null;
let cacheKey = '';
export function setSize(w, h) {
  w = Math.round(w * 100) / 100; h = Math.round(h * 100) / 100;
  const key = `${w}|${h}|${host.t}|${host.r}|${host.b}|${host.l}|${host.back}`;
  if (key === cacheKey && L) return L;
  cacheKey = key; L = build(w, h, key);
  return L;
}
export const layoutFor = setSize;

// where a point of B (bx, by) is on the screen
export function toScreen(bx, by) {
  const t = L.bt;
  return t.rot ? { x: t.ox + t.s * (by - BY0), y: t.oy + t.s * (BX1 - bx) } : { x: t.ox + t.s * (bx - BX0), y: t.oy + t.s * (by - BY0) };
}
// and back: a screen point as a point of B
export function toBoard(x, y) {
  const t = L.bt;
  return t.rot ? { x: BX1 - (y - t.oy) / t.s, y: BY0 + (x - t.ox) / t.s } : { x: BX0 + (x - t.ox) / t.s, y: BY0 + (y - t.oy) / t.s };
}
// canvas transform that draws in B (so the static art is painted in its own coordinates)
export function applyBoard(c) {
  const t = L.bt;
  if (t.rot) c.transform(0, -t.s, t.s, 0, t.ox - t.s * BY0, t.oy + t.s * BX1);
  else c.transform(t.s, 0, 0, t.s, t.ox - t.s * BX0, t.oy - t.s * BY0);
}

// where point idx (0..23) sits in B: which column, its vertical centre, where its checkers start and which way they stack
export function pointGeom(idx) {
  const pt = idx + 1, left = pt <= 12, slot = left ? 12 - pt : pt - 13;
  return { left, slot, y: IN.y0 + (slot + 0.5) * SLOT, edge: left ? IN.x0 : IN.x1, dir: left ? 1 : -1 };
}
// centre (screen) of the k-th checker (0 = base) of n on point idx. `pinned`: the base checker is pinned and the rest sit half over it.
export function stackB(idx, k, n, pinned = false) {
  const g = pointGeom(idx), room = PLEN - 6;
  const step = n <= 3 ? D + 1 : (room - D) / (n - 1);
  let off = k * step;
  if (pinned && k >= 1) {
    const s2 = n <= 4 ? D * 0.56 : ((room - D) / (n - 1)) * 0.75;
    off = s2 + (k - 1) * (n <= 4 ? D * 0.9 : (room - D - s2) / Math.max(1, n - 2));
  }
  return { x: g.edge + g.dir * (R + 3 + off), y: g.y };
}
export function stackPos(idx, k, n, pinned = false) { const b = stackB(idx, k, n, pinned); return toScreen(b.x, b.y); }
export function barPos(side, k, n) {
  const step = n <= 5 ? D + 2 : (MID - IN.y0 - 60 - D) / (n - 1), y0 = 6 + R;
  return toScreen(CH.cx, MID + (side === 0 ? 1 : -1) * (y0 + k * step));
}
export const offPos = (side, k) => toScreen(64 + k * 40, side === 0 ? TRAY.me.y + TRAY.me.h / 2 : TRAY.opp.y + TRAY.opp.h / 2);
export const trayCenter = (side) => { const T = side === 0 ? TRAY.me : TRAY.opp; return toScreen(T.x + T.w / 2, T.y + T.h / 2); };
// the bounding box (screen) of a B-space rect
export function boardRect(r) {
  const a = toScreen(r.x, r.y), b = toScreen(r.x + r.w, r.y + r.h);
  return R_(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
}
// which target a screen tap means: a point 0..23, BAR, OFF, or -1
export function targetAt(sx, sy) {
  const { x, y } = toBoard(sx, sy);
  if (inRect({ x: TRAY.me.x, y: TRAY.me.y - 6, w: TRAY.me.w, h: TRAY.me.h + 14 }, x, y)) return OFF;
  if (y < IN.y0 - 8 || y > IN.y1 + 8 || x < IN.x0 - 8 || x > IN.x1 + 8) return -1;
  if (x > CH.x0 - 4 && x < CH.x1 + 4) return BAR;
  const slot = Math.floor((y - IN.y0) / SLOT); if (slot < 0 || slot > 11) return -1;
  if (x < CH.cx) return 12 - slot - 1;
  return 13 + slot - 1;
}
export const titleRows = (hasSave) => L.titleFor(hasSave).rows;

// ---- building one layout -------------------------------------------------------------------------------------------------------
function build(w, h, key) {
  // st also keeps the title clear of the kit's preview badge (top centre, just below the safe inset)
  const sl = Math.max(host.l, 0), sr = Math.max(host.r, 0), st = Math.max(host.t, 0, w >= h * 1.1 ? 0 : host.t + 6 / Math.max(host.px, 0.3) + 1.7 * Math.max(16, 11.5 / Math.max(host.px, 0.3)) - 14), sb = Math.max(host.b, 0);
  const bk = host.back ? Math.ceil(host.back + 12) : 0;
  const k = clamp((h - 960) / 600, 0, 1);                           // 0 = short portrait (4:3), 1 = tall phone
  const lnd = w >= h * 1.1;
  const ux0 = sl + 10, ux1 = w - sr - 10, uy0 = st + 6, uy1 = h - sb - 8;
  const out = { key, w, h, sl, sr, st, sb, bk, k, wide: w >= h * 0.95, land: lnd, ux0, ux1, uy0, uy1 };

  // ---- play: pick the arrangement and the board turn that give the biggest board -------------------------------------------------
  const hH = rd(lerp(168, 192, k)), fH = rd(lerp(164, 190, k)), Pmin = 330;
  const cands = [];
  for (const rot of [0, 1]) {
    const bw0 = rot ? 1152 : 704, bh0 = rot ? 704 : 1152;
    const sA = Math.min(1.05, (ux1 - ux0) / bw0, (uy1 - st - hH - fH) / bh0);
    cands.push({ arr: 'stack', rot, s: sA, score: sA * (lnd ? 1 : 1.08) });
    const sB = Math.min(1.05, (ux1 - ux0 - Pmin - 14) / bw0, (uy1 - uy0) / bh0);
    cands.push({ arr: 'side', rot, s: sB, score: sB * (lnd ? 1.08 : 1) });
  }
  cands.sort((a, b) => b.score - a.score);
  const { arr, rot, s } = cands[0];
  const bwS = (rot ? 1152 : 704) * s, bhS = (rot ? 704 : 1152) * s;
  Object.assign(out, { arr, rot, s });
  const setBtns = (rects) => { out.btn = { menu: rects[0], undo: rects[1], hint: rects[2], pause: rects[3] }; out.abtn = { menu: rects[0], pause: rects[1], less: rects[2], more: rects[3] }; };
  const dice = { mode: 'row' };
  const hdr = {};
  if (arr === 'stack') {
    const free = Math.max(0, uy1 - st - hH - fH - bhS);
    const bx = (ux0 + ux1) / 2 - bwS / 2, by = st + hH + free * 0.4;
    out.board = R_(bx, by, bwS, bhS); out.bt = { s, rot, ox: bx, oy: by };
    const bY0 = st + lerp(118, 134, k), bH = lerp(54, 62, k);
    const labelW = Math.min(w - 2 * (sl + bk + 16), w - 40);
    Object.assign(hdr, { mode: 'stack', titleX: w / 2, titleY: st + lerp(50, 64, k), titleSize: rd(lerp(54, 62, k)), greekY: st + lerp(50, 64, k) + lerp(30, 34, k), greekSize: rd(lerp(22, 24, k)),
      pipX: w - sr - 22, pip1: st + lerp(34, 46, k), pip2: st + lerp(60, 74, k), pip3: st + lerp(80, 98, k), pipSize: rd(lerp(20, 22, k)),
      labelX: w / 2, labelY: st + lerp(106, 124, k), labelW, banner: R_(ux0 + 8, bY0, ux1 - ux0 - 16, bH) });
    out.wall = { x: 0, y: 0, w, h: rot ? by - 4 : by + 64 * s };
    const btnH = rd(lerp(58, 64, k)), bw = Math.min(ux1 - ux0 - 12, 700), gap = 10, one = (bw - 3 * gap) / 4, by2 = h - sb - 12 - btnH, bx2 = (ux0 + ux1) / 2 - bw / 2;
    setBtns([0, 1, 2, 3].map((i) => R_(bx2 + i * (one + gap), by2, one, btnH)));
    const dh = rd(lerp(84, 96, k)), dw = Math.min(600, ux1 - ux0 - 20), dy0 = by + bhS + (rot ? 10 : 0), dy = Math.min(dy0 + Math.max(0, by2 - dh - 24 - dy0) * 0.3, by2 - dh - 24);
    Object.assign(dice, { x: (ux0 + ux1) / 2 - dw / 2, y: dy, w: dw, h: dh, mode: 'row' });
  } else {
    // side: the wall-coloured status panel on the left, the board in what is left
    const extra = (ux1 - ux0) - (Pmin + 14 + bwS);
    const panelW = clamp(Pmin + extra * 0.55, Pmin, 500);
    const panelRight = sl + panelW;
    const by = (uy0 + uy1) / 2 - bhS / 2, bx = panelRight + 14 + (ux1 - panelRight - 14 - bwS) / 2;
    out.board = R_(bx, by, bwS, bhS); out.bt = { s, rot, ox: bx, oy: by };
    out.wall = { x: 0, y: 0, w: panelRight, h };
    const cx0 = sl + 16, cx1 = panelRight - 40, cw = cx1 - cx0, cxm = (cx0 + cx1) / 2;
    const y0 = bk ? Math.max(uy0, st + bk + 6) : uy0 + 6;
    const btnH = 56, gridY = h - sb - 14 - (2 * btnH + 10), bw2 = (cw - 10) / 2;
    setBtns([0, 1, 2, 3].map((i) => R_(cx0 + (i % 2) * (bw2 + 10), gridY + Math.floor(i / 2) * (btnH + 10), bw2, btnH)));
    const dh = 128, dyy = gridY - 12 - dh;
    Object.assign(dice, { x: cx0, y: dyy, w: cw, h: dh, mode: 'col' });
    const pipY = y0 + 78, labY = pipY + 78, banY = pipY + 124, banH = Math.max(70, dyy - 12 - banY);
    Object.assign(hdr, { mode: 'side', titleX: cxm, titleY: y0 + 46, titleSize: 46, greekY: y0 + 74, greekSize: 22, pipX: cx0, pipX2: cx1, pip1: pipY + 22, pip3: pipY + 46, pipSize: 22,
      labelX: cxm, labelY: labY, labelW: cw, labelWrap: true, banner: R_(cx0, banY, cw, banH) });
  }
  if (dice.mode === 'row') {
    dice.cy = dice.y + dice.h / 2; dice.rest = [dice.x + dice.w * 0.317, dice.x + dice.w * 0.567];
    dice.start = dice.x + dice.w * 0.85;
    dice.prompt = { x: dice.x + dice.w * 0.683, y: dice.cy - 4, y2: dice.cy + 22, align: 'left', maxW: dice.w * 0.3 - 6 };
    dice.mul = { x: dice.x + dice.w * 0.7, y: dice.cy + 8 };
    dice.think = { x: dice.x + dice.w / 2, y: dice.y + dice.h + 12, align: 'center' };
  } else {
    dice.cy = dice.y + 46; dice.rest = [dice.x + dice.w * 0.3, dice.x + dice.w * 0.62];
    dice.start = dice.x + dice.w * 0.9;
    dice.prompt = { x: dice.x + dice.w / 2, y: dice.y + dice.h - 36, y2: dice.y + dice.h - 14, align: 'center', maxW: dice.w - 24 };
    dice.mul = { x: dice.x + dice.w * 0.8, y: dice.cy + 8 };
    dice.think = { x: dice.x + dice.w / 2, y: dice.y + dice.h - 14, align: 'center' };
  }
  out.dice = dice; out.hdr = hdr;
  out.diceTap = R_(dice.x, dice.y - 6, dice.w, dice.h + 12);
  out.status = dice.think;
  const memo = new Map();
  out.titleFor = (hasSave) => { const kk = !!hasSave; if (!memo.has(kk)) memo.set(kk, titleLayout(out, kk)); return memo.get(kk); };
  out.setup = setupLayout(out);
  out.doc = docLayout(out);
  out.settings = settingsLayout(out);
  out.pause = pauseLayout(out);
  out.over = overLayout(out);
  out.demo = demoLayout(out);
  return out;
}

// ---- title ------------------------------------------------------------------------------------------------------------------------
function titleLayout(Lx, hasSave) {
  const { w, h, st, sb, k, ux0, ux1, uy0, uy1 } = Lx;
  const T = { rows: {}, tiles: [], wide: Lx.wide };
  const rowsH = { resume: 76, play: 92, auto: 78, small: 66, settings: 66 };
  if (!Lx.wide) {
    const cw = Math.min(ux1 - ux0, 620), cx = w / 2, rw = Math.min(cw, 520), rx = cx - rw / 2;
    const tS = lerp(94, 118, k), top = st + lerp(98, 152, k);
    Object.assign(T, { cx, titleSize: rd(tS), titleY: top, greekSize: rd(lerp(32, 38, k)), greekY: top + lerp(40, 48, k), meander: { x: cx - 170, y: top + lerp(52, 60, k), w: 340, h: 12 } });
    const gap = 14, tw = Math.min(212, (cw - 2 * gap) / 3), th = lerp(148, 176, k), ty = T.meander.y + lerp(26, 62, k);
    for (let i = 0; i < 3; i++) T.tiles.push(R_(cx - (tw * 3 + gap * 2) / 2 + i * (tw + gap), ty, tw, th));
    T.tileScale = th / 176;
    T.tag = { x: cx, y: ty + th + lerp(32, 62, k), w: cw - 20, size: rd(lerp(24, 26, k)) };
    let y = T.tag.y + lerp(30, 56, k); const g = rd(lerp(10, 16, k));
    const hh = (n) => rd(lerp(rowsH[n] * 0.86, rowsH[n], k));
    const row = (n, hn) => { T.rows[n] = R_(rx, y, rw, hn); y += hn + g; };
    if (hasSave) row('resume', hh('resume'));
    row('play', hh('play')); row('auto', hh('auto'));
    const third = (rw - 24) / 3, sh = hh('small');
    ['howto', 'rules', 'about'].forEach((n, i) => { T.rows[n] = R_(rx + i * (third + 12), y, third, sh); });
    y += sh + g; row('settings', hh('settings'));
    const lkW = Math.min(cw - 20, Math.max(0.35 * 720, 120 / Math.max(host.px, 1e-6))), lkH = lkW * 327 / 1200;
    T.lockup = R_(cx - lkW / 2, y + 6, lkW, lkH);                       // bottom-centre, directly under the last menu row
    T.stats = { x: cx, y: T.lockup.y + lkH + 38, w: cw - 20, size: 21 }; T.msg = { x: cx, y: T.stats.y + 40, w: cw - 20, size: 21 };
    // spread leftover height: nudge everything down a little when the screen is much taller than the content
    const bottom = h - sb - 10, push = Math.max(0, (bottom - (T.msg.y + 14)) * 0.45);
    if (push > 1) shiftTitle(T, push);
  } else {
    const gapC = 28, leftW = Math.min((ux1 - ux0) * 0.52, 700), rightW = ux1 - ux0 - leftW - gapC;
    const cxL = ux0 + leftW / 2, cxR = ux1 - rightW / 2, rw = Math.min(480, rightW - 20);
    const top = Math.max(uy0 + 84, st + 100);
    Object.assign(T, { cx: cxL, titleSize: 104, titleY: top, greekSize: 34, greekY: top + 42, meander: { x: cxL - 150, y: top + 54, w: 300, h: 11 } });
    const gap = 12, tw = Math.min(190, (leftW - 20 - 2 * gap) / 3), th = Math.min(160, (uy1 - uy0) * 0.22), ty = top + 82;
    for (let i = 0; i < 3; i++) T.tiles.push(R_(cxL - (tw * 3 + gap * 2) / 2 + i * (tw + gap), ty, tw, th));
    T.tileScale = th / 176;
    T.tag = { x: cxL, y: ty + th + 38, w: leftW - 20, size: 24 };
    const lkW0 = Math.max(0.28 * 720, 120 / Math.max(host.px, 1e-6)), lkH0 = lkW0 * 327 / 1200;
    const g = 12, hs = { resume: 70, play: 84, auto: 72, small: 62, settings: 62 };
    const total = (hasSave ? hs.resume + g : 0) + hs.play + g + hs.auto + g + hs.small + g + hs.settings + 90 + lkH0 + 14;
    let y = Math.max(uy0 + 4, (uy0 + uy1) / 2 - total / 2); const rx = cxR - rw / 2;
    const row = (n, hn) => { T.rows[n] = R_(rx, y, rw, hn); y += hn + g; };
    if (hasSave) row('resume', hs.resume);
    row('play', hs.play); row('auto', hs.auto);
    const third = (rw - 24) / 3;
    ['howto', 'rules', 'about'].forEach((n, i) => { T.rows[n] = R_(rx + i * (third + 12), y, third, hs.small); });
    y += hs.small + g; row('settings', hs.settings);
    const lkW = Math.min(rw, lkW0);
    T.lockup = R_(cxR - lkW / 2, y + 2, lkW, lkW * 327 / 1200); y += lkH0 + 14;
    T.stats = { x: cxR, y: y + 22, w: rightW - 20, size: 21 }; T.msg = { x: cxR, y: y + 58, w: rightW - 20, size: 21 };
  }
  return T;
}
function shiftTitle(T, dy) {
  const mv = (r) => { if (r) r.y += dy; };
  T.titleY += dy; T.greekY += dy; mv(T.meander); T.tiles.forEach(mv); T.tag.y += dy; Object.values(T.rows).forEach(mv); T.stats.y += dy; T.msg.y += dy; mv(T.lockup);
}

// ---- setup -------------------------------------------------------------------------------------------------------------------------
function panelFor(Lx, maxW, outerTitle) {
  const { w, h, st, sb, sl, sr, k } = Lx;
  const pw = Math.min(maxW, w - 2 * (Math.max(sl, sr) + 14));
  const top = outerTitle ? st + lerp(108, 250, k) : st + 8;
  return R_(w / 2 - pw / 2, top, pw, h - sb - 12 - top);
}
function setupLayout(Lx) {
  const { w, h } = Lx;
  const S = { modes: [], match: [], opp: [], levels: [], labels: {}, wide: Lx.wide };
  if (!Lx.wide) {
    const outer = h >= 1300;
    const P = panelFor(Lx, 664, outer); S.panel = P; S.outer = outer;
    const minY = Lx.bk ? Lx.st + Lx.bk + 6 : 0, pre = Math.max(0, minY - (P.y + 102));         // keep the first row clear of the host back button
    const nat = 1020, k2 = clamp((P.h - 40 - pre) / nat, 0.58, 1), q = (v) => v * k2;
    const x0 = P.x + 16, iw = P.w - 32; let y = P.y + q(26);
    S.heading = { x: w / 2, y: y + q(46), size: rd(Math.max(34, 56 * k2)) }; y += q(76); y = Math.max(y, minY);
    const cw = (iw - 10) / 2, ch = q(144);
    for (let i = 0; i < 4; i++) S.modes.push(R_(x0 + (i % 2) * (cw + 10), y + Math.floor(i / 2) * (ch + 10), cw, ch));
    S.modeScale = k2; S.showBlurb = ch >= 126;
    y += 2 * ch + 10 + q(28);
    S.labels.match = { x: x0, y: y + q(18) }; y += q(30);
    const bh = q(70);
    for (let i = 0; i < 2; i++) S.match.push(R_(x0 + i * (cw + 10), y, cw, bh)); y += bh + q(26);
    S.labels.opp = { x: x0, y: y + q(18) }; y += q(30);
    for (let i = 0; i < 2; i++) S.opp.push(R_(x0 + i * (cw + 10), y, cw, bh)); y += bh + q(26);
    S.labels.level = { x: x0, y: y + q(18) }; y += q(30);
    const lw = (iw - 3 * 8) / 4, lh = q(74);
    for (let i = 0; i < 4; i++) S.levels.push(R_(x0 + i * (lw + 8), y, lw, lh)); y += lh + q(16);
    S.hint = { x: w / 2, y: y + q(22), w: iw - 20, size: rd(Math.max(15, 22 * k2)), lh: rd(Math.max(19, 28 * k2)) }; y += q(62);
    S.start = R_(x0 + iw * 0.1, y, iw * 0.8, q(92)); y += q(92) + q(14);
    S.back = R_(x0 + iw * 0.1, y, iw * 0.8, q(72));
  } else {
    const gap = 26, P = panelFor(Lx, 1180, false); S.panel = P; S.outer = false;
    const x0 = P.x + 22, iw = P.w - 44, colW = (iw - gap) / 2, cxA = x0, cxB = x0 + colW + gap;
    const minY = Lx.bk ? Lx.st + Lx.bk + 6 : 0, pre = Math.max(0, minY - (P.y + 90));
    const nat = 520, k2 = clamp((P.h - 40 - pre) / nat, 0.62, 1), q = (v) => v * k2;
    let y = P.y + q(20);
    S.heading = { x: cxA + colW / 2, y: y + q(44), size: rd(Math.max(34, 54 * k2)) }; y += q(70); y = Math.max(y, minY);
    const cw = (colW - 10) / 2, ch = q(150);
    for (let i = 0; i < 4; i++) S.modes.push(R_(cxA + (i % 2) * (cw + 10), y + Math.floor(i / 2) * (ch + 10), cw, ch));
    S.modeScale = k2; S.showBlurb = ch >= 126;
    S.hint = { x: cxA + colW / 2, y: y + 2 * ch + 10 + q(40), w: colW - 20, size: rd(Math.max(15, 21 * k2)), lh: rd(Math.max(19, 27 * k2)) };
    let y2 = P.y + q(28);
    const rowH = q(64), gy = q(18), half = (colW - 10) / 2;
    S.labels.match = { x: cxB, y: y2 + q(18) }; y2 += q(30);
    for (let i = 0; i < 2; i++) S.match.push(R_(cxB + i * (half + 10), y2, half, rowH)); y2 += rowH + gy;
    S.labels.opp = { x: cxB, y: y2 + q(18) }; y2 += q(30);
    for (let i = 0; i < 2; i++) S.opp.push(R_(cxB + i * (half + 10), y2, half, rowH)); y2 += rowH + gy;
    S.labels.level = { x: cxB, y: y2 + q(18) }; y2 += q(30);
    const lw = (colW - 3 * 8) / 4;
    for (let i = 0; i < 4; i++) S.levels.push(R_(cxB + i * (lw + 8), y2, lw, rowH)); y2 += rowH + q(26);
    S.start = R_(cxB, y2, colW, q(84)); y2 += q(84) + q(12);
    S.back = R_(cxB, y2, colW, q(66));
  }
  return S;
}

// ---- reference pages (How to play, About, Rules) ----------------------------------------------------------------------------
function docLayout(Lx) {
  const { h, k } = Lx;
  const maxW = Lx.wide ? 1020 : 664, outer = !Lx.wide && h >= 1300;
  const P = panelFor(Lx, maxW, outer);
  const pad = Lx.wide ? 40 : 28, hdrH = rd(lerp(104, 124, k)), ftrH = rd(lerp(124, 134, k));
  const D_ = { panel: P, outer, pad };
  const btnW = 100, btnH = 56;
  D_.dec = R_(P.x + 22, P.y + 18, btnW, btnH); D_.inc = R_(P.x + P.w - 22 - btnW, P.y + 18, btnW, btnH);
  D_.title = { x: P.x + P.w / 2, y: P.y + 18 + 28, maxW: P.w - 2 * (btnW + 44), size: rd(lerp(46, 58, k)) };
  if (Lx.bk > 0 && P.x < Lx.sl + Lx.bk + 8) {            // the host's back button floats over the top-left of the card: A-/A+ both go right, the title sits between
    D_.inc = R_(P.x + P.w - 22 - btnW, P.y + 18, btnW, btnH); D_.dec = R_(D_.inc.x - btnW - 10, P.y + 18, btnW, btnH);
    const left = Math.max(P.x + 16, Lx.sl + Lx.bk + 8), right = D_.dec.x - 12;
    D_.title = { x: (left + right) / 2, y: P.y + 18 + 28, maxW: right - left, size: rd(lerp(46, 58, k)) };
  }
  D_.cap = { x: P.x + P.w / 2, y: P.y + 18 + btnH + 27 };
  D_.rule = { x0: P.x + 40, x1: P.x + P.w - 40, y: P.y + 18 + btnH + 36 };
  D_.body = R_(P.x + pad, P.y + hdrH, P.w - 2 * pad, P.h - hdrH - ftrH);
  D_.page = { x: P.x + P.w / 2, y: P.y + P.h - ftrH + 28 };
  const bw = (P.w - 56 - 16) / 2, by = P.y + P.h - 16 - 66;
  D_.back = R_(P.x + 28, by, bw, 66); D_.next = R_(P.x + 28 + bw + 16, by, bw, 66);
  return D_;
}

// ---- settings -----------------------------------------------------------------------------------------------------------------
function settingsLayout(Lx) {
  const { w, h } = Lx;
  const outer = !Lx.wide && h >= 1300;
  const P = panelFor(Lx, Lx.wide ? 1060 : 664, outer), S = { panel: P, outer, rows: {}, text: {}, wide: Lx.wide };
  const pad = 26;
  if (!Lx.wide) {
    const minY = Lx.bk ? Lx.st + Lx.bk + 6 : 0, pre = Math.max(0, minY - (P.y + 102));
    const nat = 880, k2 = clamp((P.h - 30 - pre) / nat, 0.6, 1), q = (v) => v * k2;
    const x0 = P.x + pad + 20, rw = P.w - 2 * (pad + 20); let y = P.y + q(22);
    S.heading = { x: w / 2, y: y + q(42), size: rd(Math.max(34, 56 * k2)) }; y += q(80); y = Math.max(y, minY);
    ['sound', 'calm', 'set', 'auto'].forEach((n) => { S.rows[n] = R_(x0, y, rw, q(88)); y += q(88) + q(18); });
    S.text = { dec: R_(x0, y, rw * 0.24, q(88)), mid: R_(x0 + rw * 0.26, y, rw * 0.48, q(88)), inc: R_(x0 + rw * 0.76, y, rw * 0.24, q(88)) }; y += q(88) + q(24);
    S.sample = { x: w / 2, y: y + q(34), w: rw }; y += q(80);
    S.line = { x: w / 2, y: y + q(10), w: rw };
    S.back = R_(P.x + P.w * 0.15, P.y + P.h - q(16) - q(72), P.w * 0.7, q(72));
    S.k2 = k2;
  } else {
    const minY = Lx.bk ? Lx.st + Lx.bk + 6 : 0, pre = Math.max(0, minY - (P.y + 96));
    const nat = 520, k2 = clamp((P.h - 30 - pre) / nat, 0.62, 1), q = (v) => v * k2;
    const colW = (P.w - 2 * pad - 30) / 2, xA = P.x + pad, xB = xA + colW + 30; let y = P.y + q(20);
    S.heading = { x: P.x + P.w / 2, y: y + q(42), size: rd(Math.max(34, 56 * k2)) }; y += q(76); y = Math.max(y, minY);
    ['sound', 'calm', 'set', 'auto'].forEach((n, i) => { S.rows[n] = R_(xA, y + i * (q(88) + q(16)), colW, q(88)); });
    let y2 = y;
    S.text = { dec: R_(xB, y2, colW * 0.24, q(88)), mid: R_(xB + colW * 0.26, y2, colW * 0.48, q(88)), inc: R_(xB + colW * 0.76, y2, colW * 0.24, q(88)) }; y2 += q(88) + q(28);
    S.sample = { x: xB + colW / 2, y: y2 + q(34), w: colW }; y2 += q(80);
    S.line = { x: xB + colW / 2, y: y2 + q(10), w: colW };
    S.back = R_(xB + colW * 0.1, P.y + P.h - q(16) - q(72), colW * 0.8, q(72));
    S.k2 = k2;
  }
  return S;
}

// ---- pause, result, demo limit ------------------------------------------------------------------------------------------------
function pauseLayout(Lx) {
  const { w, h, st, sb } = Lx;
  const pw = Math.min(600, w - 2 * (Math.max(Lx.sl, Lx.sr) + 14)), ph = Math.min(520, h - st - sb - 24), px = w / 2 - pw / 2, py = (h + st - sb) / 2 - ph / 2;
  const q = ph / 520, bx = px + pw * 0.1833, bw = pw * 0.6333;
  return { panel: R_(px, py, pw, ph), titleY: py + 100 * q, subY: py + 140 * q, size: rd(Math.max(44, 76 * q)), q,
    resume: R_(bx, py + 170 * q, bw, 96 * q), restart: R_(bx, py + 290 * q, bw, 80 * q), menu: R_(bx, py + 394 * q, bw, 80 * q) };
}
function overLayout(Lx) {
  const { w, h, st, sb } = Lx;
  if (!Lx.wide) {
    const pw = Math.min(640, w - 2 * (Math.max(Lx.sl, Lx.sr) + 12)), ph = Math.min(780, h - st - sb - 24), px = w / 2 - pw / 2, py = (h + st - sb) / 2 - ph / 2;
    const q = Math.min(1, ph / 780), bw = pw - 80;
    return { wide: false, panel: R_(px, py, pw, ph), titleX: w / 2, titleY: py + 90 * q, titleW: pw - 60, bodyX: w / 2, bodyY: py + 160 * q, bodyW: pw - 100, glyphX: w / 2, glyphMin: py + 300 * q, glyphMax: py + ph - 250 * q,
      again: R_(px + 40, py + ph - 220 * q, bw, 84 * q), menu: R_(px + 40, py + ph - 120 * q, bw / 2 - 8, 72 * q), share: R_(px + 40 + bw / 2 + 8, py + ph - 120 * q, bw / 2 - 8, 72 * q), more: { x: w / 2, y: py + ph - 22 * q }, q };
  }
  const pw = Math.min(980, w - 2 * (Math.max(Lx.sl, Lx.sr) + 14)), ph = Math.min(560, h - st - sb - 24), px = w / 2 - pw / 2, py = (h + st - sb) / 2 - ph / 2;
  const colR = Math.min(340, pw * 0.38), xR = px + pw - colR - 34, xL = px + 36, wL = xR - xL - 24;
  return { wide: true, panel: R_(px, py, pw, ph), titleY: py + 84, titleW: wL, titleX: xL + wL / 2, bodyX: xL + wL / 2, bodyY: py + 150, bodyW: wL, glyphMin: py + 300, glyphMax: py + ph - 60, glyphX: xR + colR / 2,
    again: R_(xR, py + ph - 250, colR, 84), menu: R_(xR, py + ph - 154, colR / 2 - 6, 70), share: R_(xR + colR / 2 + 6, py + ph - 154, colR / 2 - 6, 70), more: { x: xR + colR / 2, y: py + ph - 28 }, q: 1 };
}
function demoLayout(Lx) {
  const { w, h, st, sb } = Lx;
  const pw = Math.min(600, w - 2 * (Math.max(Lx.sl, Lx.sr) + 14)), ph = Math.min(460, h - st - sb - 24), px = w / 2 - pw / 2, py = (h + st - sb) / 2 - ph / 2;
  return { panel: R_(px, py, pw, ph), titleY: py + 90, bodyY: py + 160, bodyW: pw - 100, size: Math.min(26, ph / 17), button: R_(px + pw * 0.2, py + ph - 110, pw * 0.6, 76) };
}

setSize(720, 1560);

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (r) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(r.w, m), h = Math.max(r.h, m); return { x: Math.round(r.x + r.w / 2 - w / 2), y: Math.round(r.y), w: Math.round(w), h: Math.round(h) }; };
