// Geometry, as a function of the LIVE screen size (kit 1.7.1 fluid viewport: the short side is always 720 units, the long side follows
// the screen). Two coordinate worlds:
//   BOARD SPACE  the approved phone board, 720 wide, drawn once and reused: the board, the squares, the pieces and the trays beside it
//                live here (cellRect, squareAt, reservePos ...). It never changes with the screen.
//   SCREEN       everything else (header, dice tray, buttons, text pages), laid out per screen size by layoutFor(w, h).
// A board scene places the board block in the screen with a uniform scale `s` and, when the screen is wider than tall, a 90 degree
// turn (the long axis of the board then runs across the screen). `B.toScreen / B.toBoard` convert between the two worlds.
//   stack  portrait: header on top, the board, the dice tray, a button row at the bottom (the approved phone look when the screen is tall).
//   side   landscape / squarish: a panel on the left (status, message, dice tray, buttons), the board on the right.
// `layoutFor(w, h)` is cached by size + safe insets; a frame never recomputes it.
import { cellOf, PIECES, HOME } from './rules.js';

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AP_THINK_STEPS = [2, 5, 8, 10];
export const MIN_FONT = 22;                                   // virtual units: about 11 css px on the smallest phone
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// ---- board space (unchanged from the approved phone layout) ----------------------------------------------------------------
export const W = 720, H = 1560;
export const CW = 156, CH = 122, X0 = 126, YB = 1306, YT = YB - 8 * CH;     // board: x 126..594, y 330..1306
export const BLOCK = { w: 720, h: 1024, cx: 360, cy: 810 };                 // the board with its side trays: x 0..720, y 298..1322
export const cellRect = (lane, c) => ({ x: X0 + lane * CW, y: YB - (c + 1) * CH, w: CW, h: CH });
export const cellCenter = (lane, c) => ({ x: X0 + lane * CW + CW / 2, y: YB - c * CH - CH / 2 });
export const isPlayable = (lane, c) => lane === 1 || c <= 3 || c >= 6;      // the two pieces of the board and the bridge between them
export const squareAt = (side, p) => { const q = cellOf(side, p); return q ? cellCenter(q.lane, q.c) : null; };
export const PIECE_R = 40;
// Where pieces wait (beside their start block) and where borne-off pieces are stacked (beside the far block).
export const reservePos = (side, k) => ({ x: side === 0 ? 64 : W - 64, y: YB - 44 - k * 62 });
export const homePos = (side, k) => ({ x: (side === 0 ? 34 : W - 34) + (side === 0 ? 1 : -1) * (k % 2) * 46, y: YT + 34 + Math.floor(k / 2) * 56 });
export const RESERVE_RECT = (side) => ({ x: side === 0 ? 8 : W - 118, y: YB - 470, w: 110, h: 476 });
export const HOME_RECT = (side) => ({ x: side === 0 ? 8 : W - 118, y: YT - 4, w: 110, h: 250 });
// Which board cell a tap means (or null): { lane, c }. x, y in BOARD space.
export function cellNear(x, y) {
  if (x < X0 || x > X0 + 3 * CW || y < YT || y > YB) return null;
  const lane = Math.min(2, Math.floor((x - X0) / CW)), c = Math.min(7, Math.floor((YB - y) / CH));
  return isPlayable(lane, c) ? { lane, c } : null;
}
// The resting slot of every off-board piece of one side (null for pieces on the board): waiting pieces stack beside the
// start block, borne-off pieces beside the far block.
export function restSlots(pos, s) {
  const out = []; let w = 0, h = 0;
  for (let i = 0; i < PIECES; i++) out[i] = pos[i] === 0 ? reservePos(s, w++) : pos[i] === HOME ? homePos(s, h++) : null;
  return out;
}

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const L = { w, h, ins, land: w >= h };
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const pad = 14;
  L.pad = pad;
  L.wide = U.w >= U.h * 1.2;                                   // title / documents / results: art on one side, controls on the other
  L.lamp = L.wide ? null : { x: U.x1 - 74, y: Math.max(66, U.y0 + 56) };
  L.all = [];                                                   // every button rect of the last built screen is collected by the tests through these helpers

  // ================================================================================================================================
  // Board scenes: play / auto (Watch & Learn) / text (lesson, daily puzzle)
  // ================================================================================================================================
  const kinds = {};
  L.board = (kind) => kinds[kind] ?? (kinds[kind] = buildBoard(kind));
  const BTN_H = 72, TRAY_H = 104, GAP = 12, TOP_PILL = 40;

  // Header (status text + the two side chips) for a given area. sym: centre the title between two equal margins (portrait stack).
  function header(x0, x1, y0, kind, sym) {
    const back = ins.back > 0 && ins.l + L.backBox.w + 8 > x0 ? L.backBox : null;
    const lim = Math.max(back ? back.x + back.w + 8 - x0 : 20, sym ? 138 : 0);
    const tl = sym ? x0 + lim : (back ? x0 + lim : x0 + 20), tr = sym ? x1 - lim : x1 - 20;
    const o = { cx: (tl + tr) / 2, maxW: tr - tl, back };
    if (kind === 'text') {
      o.label = { x: o.cx, y: y0 + 26, size: 24 }; o.title = { x: o.cx, y: y0 + 70, size: 44 };
      const top = Math.max(y0 + 90, back ? back.y + back.h + 6 : 0);
      o.paraTop = top; o.bottom = top;                                       // the paragraph box is sized by the caller
    } else {
      o.title = { x: o.cx, y: y0 + 42, size: 44 }; o.sub = { x: o.cx, y: y0 + 72, size: 22 };
      const cy = sym ? y0 + 106 : Math.max(y0 + 106, back ? back.y + back.h + 28 : 0);
      const l0 = sym ? Math.max(x0 + 54, back ? back.x + back.w + 34 : 0) : x0 + 50;
      o.chips = { y: cy, lx: l0, rx: x1 - (l0 - x0), r: 22 };
      o.bottom = cy + 30;
    }
    return o;
  }

  function buttonsFor(kind, rect, rows) {                      // a button row (or grid) inside rect; returns named rects
    const g = 14, out = {};
    if (kind === 'play') {
      const bw = (rect.w - 2 * g) / 3;
      out.menu = R(rect.x, rect.y, bw, rect.h); out.undo = R(rect.x + bw + g, rect.y, bw, rect.h); out.hint = R(rect.x + 2 * (bw + g), rect.y, bw, rect.h);
    } else if (kind === 'auto') {
      if (rows === 2) {
        const bw = (rect.w - g) / 2, bh = (rect.h - g) / 2;
        out.apExit = R(rect.x, rect.y, bw, bh); out.apPause = R(rect.x + bw + g, rect.y, bw, bh);
        out.apDec = R(rect.x, rect.y + bh + g, bw, bh); out.apInc = R(rect.x + bw + g, rect.y + bh + g, bw, bh);
      } else {
        const bw = (rect.w - 3 * g) / 4;
        out.apExit = R(rect.x, rect.y, bw, rect.h); out.apPause = R(rect.x + bw + g, rect.y, bw, rect.h);
        out.apDec = R(rect.x + 2 * (bw + g), rect.y, bw, rect.h); out.apInc = R(rect.x + 3 * (bw + g), rect.y, bw, rect.h);
      }
    } else {
      const bw = (rect.w - g) / 3;
      out.menu = R(rect.x, rect.y, bw, rect.h); out.next = R(rect.x + bw + g, rect.y, rect.w - bw - g, rect.h);
    }
    return out;
  }

  function buildBoard(kind) {
    // ---- candidates: stack / side, upright / turned ------------------------------------------------------------------------
    const hy0 = Math.max(U.y0 + 10, TOP_PILL);                         // clear of the kit's "Preview m:ss" pill at the top centre
    const stackHdr = header(U.x0, U.x1, hy0, kind, true);
    let hdrH;
    if (kind === 'text') { stackHdr.paraH = 4 * 34 + 6; hdrH = stackHdr.paraTop + stackHdr.paraH - U.y0; }
    else hdrH = stackHdr.bottom - U.y0 + 6;
    const btnBlock = BTN_H + (kind === 'auto' ? 30 : 0);
    const fixed = hdrH + GAP + TRAY_H + GAP + btnBlock + GAP + 6;
    const cands = [];
    for (const rot of [false, true]) {
      const bw = rot ? BLOCK.h : BLOCK.w, bh = rot ? BLOCK.w : BLOCK.h;
      const availH = U.h - fixed;
      if (availH > 150) cands.push({ mode: 'stack', rot, s: Math.min((U.w - 12) / bw, availH / bh) });
      const sH = (U.y1 - pad - Math.max(U.y0 + pad, TOP_PILL)) / bh, pw = clamp(U.w - 3 * pad - bw * sH, 360, 560);
      cands.push({ mode: 'side', rot, s: Math.min(sH, (U.w - 3 * pad - pw) / bw), pw });
    }
    let best = cands.reduce((a, b) => (b.s > a.s ? b : a));
    if (best.rot) { const up = cands.filter((c) => !c.rot).reduce((a, b) => (b.s > a.s ? b : a)); if (up.s >= 0.94 * best.s) best = up; }
    const { mode, rot, s } = best;
    const B = { kind, mode, rot, s };
    const bwS = (rot ? BLOCK.h : BLOCK.w) * s, bhS = (rot ? BLOCK.w : BLOCK.h) * s;
    const place = (cx, cy) => {
      B.cx = cx; B.cy = cy;
      B.toScreen = (bx, by) => { const dx = bx - BLOCK.cx, dy = by - BLOCK.cy; return rot ? { x: cx - s * dy, y: cy + s * dx } : { x: cx + s * dx, y: cy + s * dy }; };
      B.toBoard = (sx, sy) => { const vx = (sx - cx) / s, vy = (sy - cy) / s; return rot ? { x: BLOCK.cx + vy, y: BLOCK.cy - vx } : { x: BLOCK.cx + vx, y: BLOCK.cy + vy }; };
      B.apply = (ctx) => { ctx.translate(cx, cy); if (rot) ctx.rotate(Math.PI / 2); ctx.scale(s, s); ctx.translate(-BLOCK.cx, -BLOCK.cy); };
      B.rect = R(cx - bwS / 2, cy - bhS / 2, bwS, bhS);
    };

    if (mode === 'stack') {
      const trW = Math.min(640, U.w - 24), trX = U.x0 + (U.w - trW) / 2;
      const btnY = U.y1 - 12 - BTN_H, trayY = btnY - (kind === 'auto' ? 30 : 0) - GAP - TRAY_H;
      B.hdr = stackHdr; B.hdrH = hdrH;
      const regionTop = U.y0 + hdrH + GAP, regionBot = trayY - GAP;
      place(U.x0 + U.w / 2, (regionTop + regionBot) / 2);
      B.tray = R(trX, trayY, trW, TRAY_H); B.trayTall = false;
      B.btn = buttonsFor(kind, R(trX, btnY, trW, BTN_H), 1);
      if (kind === 'auto') B.apLabel = { x: U.x0 + U.w / 2, y: btnY - 8 };
      if (kind === 'text') B.para = R(U.x0 + 20, stackHdr.paraTop, U.w - 40, stackHdr.paraH);
      else B.msg = { x: U.x0 + 24, w: U.w - 48, bottom: B.rect.y - 2, floor: stackHdr.bottom + 4 };
    } else {
      const P = B.panel = R(U.x0 + pad, U.y0 + pad, best.pw, U.h - 2 * pad);
      const hd = B.hdr = header(P.x, P.x + P.w, P.y, kind, false);
      // board area: the rest of the width, board centred
      const ax = P.x + P.w + pad, aw = U.x1 - pad - ax;
      place(ax + aw / 2, (Math.max(U.y0 + pad, TOP_PILL) + U.y1 - pad) / 2);
      // under the header: message zone, dice tray, buttons; free height is shared out as equal gaps
      const cw = P.w - 28, cx0 = P.x + 14, bottom = P.y + P.h - 6;
      const avail = bottom - hd.bottom;
      const gridRows = kind === 'auto' && !(cw >= 380 && avail < 430) ? 2 : 1, bh = kind === 'auto' && gridRows === 2 ? 56 : 62;
      const btnH = gridRows * bh + (gridRows - 1) * 14, lab = kind === 'auto' ? 30 : 0;
      const trayH = clamp(120 + (avail - btnH - lab - 120 - 70 - 3 * 12) * 0.5, 120, 176);
      if (kind === 'text') {
        const g = 12, y = bottom - btnH; B.btn = buttonsFor(kind, R(cx0, y, cw, btnH), gridRows);
        B.tray = R(cx0, y - g - trayH, cw, trayH); B.trayTall = true;
        hd.paraH = Math.max(80, B.tray.y - g - hd.paraTop); B.para = R(P.x + 14, hd.paraTop, P.w - 28, hd.paraH);
      } else {
        const mh = clamp(avail - btnH - lab - trayH - 3 * 10, 70, 124), g = Math.max(10, Math.min(34, (avail - btnH - lab - trayH - mh) / 3));
        const my = hd.bottom + g; B.msg = { x: P.x + 8, w: P.w - 16, top: my, bottom: my + mh, mid: my + mh / 2 };
        B.tray = R(cx0, my + mh + g, cw, trayH); B.trayTall = true;
        const y = B.tray.y + trayH + g + lab; B.btn = buttonsFor(kind, R(cx0, y, cw, btnH), gridRows);
        if (kind === 'auto') B.apLabel = { x: P.x + P.w / 2, y: y - 10 };
      }
    }
    return B;
  }

  // ---- the dice inside a tray rect: positions of the four dice and where the roll text goes ----------------------------------
  L.dice = (T, tall) => {
    if (tall) {                                          // tall tray (side panel): dice on top, text below
      const sp = Math.min(92, (T.w - 40) / 4), x0 = T.x + T.w / 2 - 1.5 * sp;
      return { c: [0, 1, 2, 3].map((k) => ({ x: x0 + k * sp, y: T.y + 46 })), size: 50, text: { x: T.x + T.w / 2, y: T.y + T.h - 40, align: 'center', big: false } };
    }
    const sp = Math.min(96, (T.w * 0.62) / 4), x0 = T.x + Math.min(72, T.w * 0.12), right = x0 + 3 * sp + 44;
    return { c: [0, 1, 2, 3].map((k) => ({ x: x0 + k * sp, y: T.y + T.h / 2 - 4 })), size: 50, text: { x: (right + T.x + T.w) / 2, y: T.y, align: 'center', big: true } };
  };

  // ================================================================================================================================
  // Title screen (also used for demo-limit and "preparing the puzzle")
  // ================================================================================================================================
  const titleCache = new Map();
  L.title = (hasSave) => { const k = hasSave ? 1 : 0; let o = titleCache.get(k); if (!o) { o = buildTitle(hasSave); titleCache.set(k, o); } return o; };
  function buildTitle(hasSave) {
    const T = { wide: L.wide, btn: {} };
    const nBig = 4 + (hasSave ? 1 : 0);
    const infoH = 112, lockW = Math.min(L.wide ? 540 : 560, Math.max((L.wide ? 0.28 : 0.35) * 720, 120 / Math.max(host.px, 1e-6))), lockH = Math.round(lockW * 327 / 1200) + 34;
    let colX, colW, colTop, colBottom;
    if (L.wide) {
      colW = clamp(U.w * 0.4, 480, 620); colX = U.x1 - colW - pad; colTop = U.y0 + pad; colBottom = U.y1 - pad;
      T.art = R(U.x0 + pad, U.y0 + pad, U.w - colW - 3 * pad, U.h - 2 * pad);
    } else {
      colW = Math.min(560, U.w - 40); colX = U.x0 + (U.w - colW) / 2;
      colBottom = U.y1 - pad; colTop = null;
    }
    const bw = Math.min(560, colW - (L.wide ? 24 : 0));
    const bx = L.wide ? colX + (colW - bw) / 2 : colX;
    const rowsEq = nBig + 1 + 1.64;
    let p;
    if (L.wide) p = clamp((colBottom - colTop - 18 - infoH - lockH) / rowsEq, 54, 76);
    else p = clamp((U.h - 24 - 430 - 18 - infoH - lockH) / rowsEq, 54, 76);
    const tp = Math.round(p * 0.9);
    const total = nBig * p + p + 6 + 2 * tp + 12 + infoH + lockH;
    const top = L.wide ? colTop + Math.max(0, (colBottom - colTop - total) / 2) : colBottom - total;
    let y = top;
    const names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'two', 'daily']);
    for (const n of names) { T.btn[n] = R(bx, y, bw, p - 10); y += p; }
    const g = 14, third = (bw - 2 * g) / 3;
    T.btn.about = R(bx, y, third, p - 10); T.btn.rules = R(bx + third + g, y, third, p - 10); T.btn.autoplay = R(bx + 2 * (third + g), y, third, p - 10);
    y += p + 6;
    const hw = (bw - g) / 2;
    T.btn.level = R(bx, y, hw, tp - 8); T.btn.sound = R(bx + hw + g, y, hw, tp - 8);
    T.btn.big = R(bx, y + tp, hw, tp - 8); T.btn.calm = R(bx + hw + g, y + tp, hw, tp - 8);
    y += 2 * tp + 12;
    T.info = { x: bx + bw / 2, blurb: y + 16, stats: y + 50, stars: y + 90 };
    T.col = R(bx, top, bw, total);
    if (L.wide) {
      T.lockup = { cx: bx + bw / 2, y: T.info.stars + 26, w: lockW };
    } else {
      T.art = R(U.x0 + pad, U.y0 + 8, U.w - 2 * pad, Math.max(0, top - lockH - 8 - (U.y0 + 8)));
      T.lockup = { cx: U.x0 + U.w / 2, y: T.info.stars + 26, w: lockW };
    }
    // the art block (title, tagline, emblem, dice) is drawn in natural units: x 0..720, y 118..800 (680 tall)
    const natH = 680, a = Math.min(1, T.art.w / 720, T.art.h / natH);
    T.a = Math.max(0.3, a); T.showDice = a > 0.55; T.compact = a < 0.62;      // a short art area gets the compact composition (one-line title, emblem)
    T.artX = T.art.x + T.art.w / 2 - 360 * T.a; T.artY = T.art.y + (T.art.h - natH * T.a) / 2 - 118 * T.a;
    return T;
  }
  // a single text line and a button below the art, for demo-limit and "preparing the puzzle"
  L.notice = () => {
    const T = L.title(false);
    const cx = T.col.x + T.col.w / 2, y0 = T.col.y;
    return { art: T, x: cx, y: y0 + 30, btn: R(T.col.x, y0 + 190, T.col.w, 72) };
  };

  // ================================================================================================================================
  // Reference pages (About / Rules): a scrolling body, text size A- / A+, Menu / Back / Next
  // ================================================================================================================================
  L.doc = (() => {
    const D = { wide: L.wide };
    const navH = 64, zw = 84, zh = 60;
    if (!L.wide) {
      const top = U.y0 + 10;
      D.titleY = top + 44; D.titleCx = U.x0 + U.w / 2;
      const lim = ins.back ? L.backBox.x + L.backBox.w + 8 - U.x0 : 20;
      D.titleMaxW = Math.max(180, U.w - 2 * Math.max(lim, zw * 2 + 40));
      D.zoomInc = R(U.x1 - 14 - zw, top, zw, zh); D.zoomDec = R(D.zoomInc.x - 12 - zw, top, zw, zh);
      const navW = Math.min(660, U.w - 28), navX = U.x0 + (U.w - navW) / 2, navY = U.y1 - 12 - navH;
      const nbw = (navW - 28) / 3;
      D.menu = R(navX, navY, nbw, navH); D.prev = R(navX + nbw + 14, navY, nbw, navH); D.next = R(navX + 2 * (nbw + 14), navY, nbw, navH);
      const artTop = top + zh + 10;
      const panelMin = 520, free = navY - 12 - artTop - panelMin;
      const artH = clamp(free, 0, 270);
      D.art = artH >= 120 ? { x: U.x0 + U.w / 2, y: artTop + artH / 2, r: Math.min(118, (artH - 20) / 2.3) } : null;
      const panelTop = D.art ? artTop + artH + 4 : artTop;
      D.panel = R(U.x0 + 24, panelTop, U.w - 48, navY - 12 - panelTop);
    } else {
      const lw = clamp(U.w * 0.24, 280, 360), lx = U.x0 + pad;
      const backBot = ins.back ? L.backBox.y + L.backBox.h + 6 : U.y0 + pad;
      D.titleCx = lx + lw / 2; D.titleY = Math.max(backBot + 36, U.y0 + 60); D.titleMaxW = lw - 12;
      D.zoomDec = R(lx + lw / 2 - zw - 6, U.y1 - pad - zh, zw, zh); D.zoomInc = R(lx + lw / 2 + 6, U.y1 - pad - zh, zw, zh);
      const artTop = D.titleY + 20, artBot = D.zoomDec.y - 12, artH = artBot - artTop;
      D.art = artH >= 120 ? { x: lx + lw / 2, y: artTop + artH / 2, r: Math.min(118, (artH - 16) / 2.3, (lw - 20) / 2.3) } : null;
      const rx = lx + lw + pad, rw = U.x1 - pad - rx;
      const navY = U.y1 - pad - navH, nbw = Math.min(220, (rw - 28) / 3), navW = 3 * nbw + 28, navX = rx + (rw - navW) / 2;
      D.menu = R(navX, navY, nbw, navH); D.prev = R(navX + nbw + 14, navY, nbw, navH); D.next = R(navX + 2 * (nbw + 14), navY, nbw, navH);
      D.panel = R(rx, U.y0 + pad, rw, navY - 12 - (U.y0 + pad));
    }
    const P = D.panel;
    D.pageTitleY = P.y + 62; D.divY = P.y + 84;
    D.body = R(P.x + 32, P.y + 22, P.w - 64, P.h - 22 - 46);   // ONE scrolling document: section headings live inside the scroll
    D.count = { x: P.x + P.w / 2, y: P.y + P.h - 14 };
    D.scrollbar = R(P.x + P.w - 22, D.body.y, 14, D.body.h);
    return D;
  })();

  // ================================================================================================================================
  // Result screens (game over, Auto Play complete): an overlay on the dimmed board
  // ================================================================================================================================
  L.result = (() => {
    const o = { wide: L.wide };
    if (!L.wide) {
      const natH = 850, a = Math.min(1, (U.h - 2 * pad) / natH);
      const oy = U.y0 + (U.h - natH * a) / 2 - 320 * a, ox = U.x0 + U.w / 2 - 360 * a;
      const P = (x, y) => ({ x: ox + x * a, y: oy + y * a });
      const rect = (x, y, w, h) => ({ x: ox + x * a, y: oy + y * a, w: w * a, h: h * a });
      Object.assign(o, { a, ox, oy, emblem: { ...P(360, 470), r: 130 * a }, won: { ...P(360, 720), size: 68 * a, maxW: U.w - 40 }, l1: P(360, 776), l2: P(360, 816), l3: P(360, 858), over: P(360, 660),
        again: rect(140, 900, 440, 96), back: rect(140, 1016, 440, 84), more: P(360, 1150), text: 1, group: 'one' });
    } else {
      const half = U.w / 2, a = Math.min(1, (U.h - 2 * pad) / 520, (half - 40) / 620);
      const rx = U.x0 + half + half / 2, ty = U.y0 + U.h / 2 - 250 * a;      // right column natural block: y 660..1170 (title ... more)
      const P = (x, y) => ({ x: rx + (x - 360) * a, y: ty + (y - 660) * a });
      const rect = (x, y, w, h) => ({ x: rx + (x - 360) * a, y: ty + (y - 660) * a, w: w * a, h: h * a });
      Object.assign(o, { a, emblem: { x: U.x0 + half / 2, y: U.y0 + U.h / 2 - 20, r: Math.min(130, (U.h - 2 * pad) / 3.2, half / 3) }, won: { ...P(360, 720), size: 68 * a, maxW: half - 40 }, l1: P(360, 776), l2: P(360, 816), l3: P(360, 858), over: P(360, 660),
        again: rect(140, 900, 440, 96), back: rect(140, 1016, 440, 84), more: P(360, 1150), text: 1, group: 'two' });
    }
    return o;
  })();

  return L;
}

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (k) => { const m = 44 / Math.max(host.px, 1e-6), lh = k.w * 327 / 1200, w = Math.max(k.w, m), h = Math.max(lh, m); return { x: Math.round(k.cx - w / 2), y: Math.round(k.y), w: Math.round(w), h: Math.round(h) }; };
