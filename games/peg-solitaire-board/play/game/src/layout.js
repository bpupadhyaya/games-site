// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units; the long side follows the aspect, cap 2.4:1).
// layoutFor(w, h) returns every rectangle for that size and is cached by size + safe insets. Shapes:
//   portrait (phones and tablets): header, stats, message, board, captured-pegs tray, button bar.
//   wide (landscape): a card on the left (title, pegs left, tray, message), the board in the middle, a card of buttons on the right.
// Hit areas are exactly the rectangles that are drawn. Buttons are at least ~80 units tall (44 css px on a 360 px phone).
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

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
  const land = w >= h, L = { w, h, land, ins };
  L.BH = clamp(Math.round(50 / Math.max(0.3, ins.px)), 64, 88);   // button height: ~50 css px (44 css minimum), 64..88 units
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  L.backBox = ins.back ? R(ins.l, ins.t, Math.max(ins.back, 56) + 8, Math.max(ins.back, 56) + 8) : R(0, 0, 0, 0);
  L.mode = land ? 'wide' : h >= 1380 ? 'tall' : 'compact';
  L.pad = clamp(U.w * 0.035, 16, 40);
  const bar = L.bar = { h: L.BH, y: U.y1 - 14 - L.BH - Math.max(0, ins.b - 14) * 0 };
  L.play = buildPlay(L);
  L.title = buildTitle(L);
  L.select = buildSelect(L);
  L.doc = buildDoc(L);
  L.result = buildResult(L);
  L.settings = buildSettings(L);
  L.simple = buildSimple(L);
  return L;
}

// ---- play screen ---------------------------------------------------------------------------------------------------------------
function buildPlay(L) {
  const { w, h, U, ins } = L, P = {};
  const names = ['menu', 'undo', 'restart', 'hint', 'auto'];
  if (!L.land) {
    const pad = L.pad, top = Math.max(U.y0 + 10, 14), backBottom = ins.back ? L.backBox.y + L.backBox.h : 0;
    const barH = L.BH, barY = U.y1 - 14 - barH;
    const gap = 10, bw = (U.w - 2 * pad - gap * 4) / 5;
    P.btn = {}; names.forEach((n, i) => { P.btn[n] = R(U.x0 + pad + i * (bw + gap), barY, bw, barH); });
    P.autoBtn = { exit: R(U.x0 + pad, barY, (U.w - 2 * pad - 3 * gap) / 4, barH), pause: null, dec: null, inc: null };
    const aw = (U.w - 2 * pad - 3 * gap) / 4; ['exit', 'pause', 'dec', 'inc'].forEach((n, i) => { P.autoBtn[n] = R(U.x0 + pad + i * (aw + gap), barY, aw, barH); });
    // header: title row, three stat chips, message
    const titleY = top + 34, sub = titleY + 38;
    P.title = { x: w / 2, y: titleY, size: 40, maxW: w - 2 * (Math.max(backBottom ? L.backBox.w : 0, 0) + 24) };
    P.sub = { x: w / 2, y: sub, size: 24, maxW: P.title.maxW };
    const chipsY = Math.max(sub + (L.mode === 'tall' ? 22 : 14), backBottom + 6), chipH = L.mode === 'tall' ? 92 : 78, cg = 12, cw = (U.w - 2 * pad - 2 * cg) / 3;
    P.chips = [0, 1, 2].map((i) => R(U.x0 + pad + i * (cw + cg), chipsY, cw, chipH));
    const msgY = chipsY + chipH + 8, msgH = L.mode === 'tall' ? 84 : 56;
    P.msg = R(U.x0 + pad, msgY, U.w - 2 * pad, msgH);
    const trayH = L.mode === 'tall' ? 150 : 96;
    P.tray = R(U.x0 + pad, barY - 12 - trayH, U.w - 2 * pad, trayH);
    const top2 = msgY + msgH + 6, free = P.tray.y - 8 - top2, D = Math.min(U.w - 8, free);
    P.board = { cx: w / 2, cy: top2 + free / 2, D };
  } else if (U.w / U.h < 1.65) {
    // 4:3-ish landscape (iPad, windows): one card on the right holds everything, so the board gets the room of the missing left card
    const g = 14, cardTop = Math.max(U.y0 + 8, ins.back ? L.backBox.y + L.backBox.h + 4 : 0), cardH = U.y1 - 8 - cardTop, minC = 300;
    const D = Math.max(200, Math.min(U.h - 16, U.w - minC - 3 * g)), bx = U.x0 + g;
    P.board = { cx: bx + D / 2, cy: U.y0 + U.h / 2, D };
    P.left = null;
    const rx = bx + D + g, rw = Math.min(U.x1 - rx - g, 520);
    P.right = R(rx, cardTop, rw, cardH);
    const inner = rw - 28, cx = rx + rw / 2, cw = (inner - 20) / 3, BHs = L.BH;
    P.center = cx;
    P.title = { x: cx, y: cardTop + 50, size: 40, maxW: inner };
    P.sub = { x: cx, y: cardTop + 88, size: 23, maxW: inner };
    const cy = cardTop + 108;
    P.chips = [0, 1, 2].map((i) => R(rx + 14 + i * (cw + 10), cy, cw, 88));
    const names = ['menu', 'undo', 'restart', 'hint', 'auto'], gp = 10, grid2 = cardH < 720;
    P.btn = {};
    let btnTop;
    if (grid2) {                                 // short card: two columns of buttons (3 rows) keep every button at its full touch height
      const bh = BHs, bw2 = (clamp(inner, 200, 420) - gp) / 2, bx0 = rx + (rw - (2 * bw2 + gp)) / 2; btnTop = cardTop + cardH - 14 - (3 * bh + 2 * gp);
      names.forEach((n, i) => { const c = i % 2, r = Math.floor(i / 2); P.btn[n] = R(bx0 + (i === 4 ? 0 : c * (bw2 + gp)), btnTop + r * (bh + gp), i === 4 ? 2 * bw2 + gp : bw2, bh); });
    } else {
      const bh = clamp((cardH - 108 - 98 - 130 - 40 - 4 * gp) / 5, 56, BHs + 4), bw = clamp(inner, 120, 360), bxx = rx + (rw - bw) / 2; btnTop = cardTop + cardH - 14 - (5 * bh + 4 * gp);
      names.forEach((n, i) => { P.btn[n] = R(bxx, btnTop + i * (bh + gp), bw, bh); });
    }
    P.autoBtn = { exit: P.btn.menu, pause: P.btn.undo, dec: P.btn.restart, inc: P.btn.hint };
    const msgTop = cy + 98, msgH = Math.max(64, btnTop - 12 - msgTop);
    P.msg = R(rx + 10, msgTop, rw - 20, msgH); P.msgSize = rw < 330 ? 22 : 24;
    P.tray = R(0, 0, 0, 0); P.badge = null;
  } else {
    // landscape: two cards around a square board
    const g = 14, cardTop = Math.max(U.y0 + 8, ins.back ? L.backBox.y + L.backBox.h + 4 : 0), cardH = U.y1 - 8 - cardTop;
    const minL = 212, minR = 188;
    const D = Math.max(200, Math.min(U.h - 16, U.w - minL - minR - 4 * g));
    const side = Math.max(minL, Math.floor((U.w - D) / 2) - 2 * g);
    const lw = Math.min(side, 520), rw = Math.min(Math.max(minR, side - 12), 440);
    const bx = U.x0 + (U.w - D) / 2;
    P.board = { cx: bx + D / 2, cy: U.y0 + U.h / 2, D };
    P.left = R(U.x0 + g, cardTop, Math.max(minL - 10, Math.min(lw, bx - U.x0 - 2 * g)), cardH);
    const rightX = bx + D + g; P.right = R(rightX, cardTop, Math.max(minR - 10, Math.min(rw, U.x1 - rightX - g)), cardH);
    P.center = P.left.x + P.left.w / 2;
    const inner = P.left.w - 28;
    P.title = { x: P.center, y: P.left.y + 52, size: inner > 260 ? 40 : 34, maxW: inner };
    P.sub = { x: P.center, y: P.left.y + 90, size: 23, maxW: inner };
    const sy = P.left.y + 112, roomy = cardH >= 640 || inner < 250 && cardH >= 560, row3 = !roomy && inner >= 300;
    let statsBottom;
    if (row3) {                                  // short card, wide enough: the three stats side by side
      const cw = (inner - 20) / 3; P.chips = [0, 1, 2].map((i) => R(P.left.x + 14 + i * (cw + 10), sy, cw, 92)); statsBottom = sy + 92;
    } else {
      const big = roomy ? Math.min(150, Math.max(110, cardH * 0.17)) : 96, sm = roomy ? 84 : 76;
      P.chips = [R(P.left.x + 14, sy, inner, big), R(P.left.x + 14, sy + big + 10, (inner - 10) / 2, sm), R(P.left.x + 14 + (inner - 10) / 2 + 10, sy + big + 10, (inner - 10) / 2, sm)]; statsBottom = sy + big + 10 + sm;
    }
    const narrow = inner < 250, remaining = P.left.y + P.left.h - 10 - (statsBottom + 12), msgMin = narrow ? 150 : 110;
    P.msgSize = narrow ? 22 : 25;
    let msgH = remaining, trayH = 0;
    if (remaining - msgMin - 10 >= 64) { msgH = clamp(remaining * 0.46, msgMin, narrow ? 270 : 240); trayH = remaining - msgH - 10; }
    P.msg = R(P.left.x + 10, P.left.y + P.left.h - 10 - msgH, P.left.w - 20, msgH);
    P.tray = R(P.left.x + 14, statsBottom + 12, inner, trayH);
    // right card: five button slots (+ the brand mark when it fits)
    const bw = clamp(P.right.w - 28, 120, 340), bxx = P.right.x + (P.right.w - bw) / 2, pad = 14, badgeH = 120;
    let bh = L.BH + 4, gp = 14, avail = P.right.h - 2 * pad - badgeH;
    if (5 * bh + 4 * gp > avail) { bh = Math.max(L.BH - 8, Math.min(bh, (avail - 4 * gp) / 5)); }
    let showBadge = 5 * bh + 4 * gp <= avail;
    if (!showBadge) { avail = P.right.h - 2 * pad; bh = Math.max(L.BH - 8, Math.min(L.BH + 4, (avail - 4 * gp) / 5)); if (5 * bh + 4 * gp > avail) gp = Math.max(6, (avail - 5 * bh) / 4); }
    const y0 = P.right.y + pad + (avail - (5 * bh + 4 * gp)) / 2, slot = (i) => R(bxx, y0 + i * (bh + gp), bw, bh);
    P.btn = {}; names.forEach((n, i) => { P.btn[n] = slot(i); });
    P.autoBtn = { exit: slot(0), pause: slot(1), dec: slot(2), inc: slot(3) };
    P.badge = showBadge ? { cx: P.right.x + P.right.w / 2, bottom: P.right.y + P.right.h - 14, w: Math.min(190, P.right.w - 30) } : null;
  }
  return P;
}

// ---- title screen ------------------------------------------------------------------------------------------------------------------
// Rows are two columns (Continue spans both). Hero (logo + board) above in portrait, left in landscape; the Arcforge lockup sits bottom centre under the menu.
function buildTitle(L) {
  const { w, h, U, ins } = L;
  const mk = (hasSave) => {
    const three = !L.land && L.mode === 'compact';
    const names = three ? [['puzzles', 'classic', 'daily'], ['auto', 'howto', 'rules'], ['about', 'settings']] : [['puzzles', 'classic'], ['daily', 'auto'], ['howto', 'rules'], ['about', 'settings']];
    if (hasSave) names.unshift(['resume']);
    const T = { rows: {}, hero: null, card: null, lockup: null, lockupHit: null };
    const n = names.length, lockH = 56;
    const place = (x0, aw, y0, pitch, bh) => names.forEach((row, i) => { const y = y0 + i * pitch; if (row.length === 1) T.rows[row[0]] = R(x0, y, aw, bh); else { const k = row.length, cw = (aw - 12 * (k - 1)) / k; row.forEach((nm, c) => { T.rows[nm] = R(x0 + c * (cw + 12), y, cw, bh); }); } });
    if (!L.land) {
      const pitch = L.BH + (L.mode === 'tall' ? 14 : 12), bh = pitch - 12, rowsH = n * pitch - 12, lockY = U.y1 - 14 - lockH;
      const y0 = lockY - 14 - rowsH, aw = Math.min(U.w - 2 * L.pad, 640);
      place(U.x0 + (U.w - aw) / 2, aw, y0, pitch, bh);
      T.lockup = R(U.x0 + (U.w - 440) / 2, lockY, 440, lockH);
      const hy = Math.max(U.y0, ins.back ? L.backBox.y + L.backBox.h - 20 : U.y0) + 6; T.hero = R(U.x0, hy, U.w, y0 - 14 - hy);
    } else {
      const aw = clamp(w * 0.34, 400, 560), ax = U.x1 - aw - 20, pitch = Math.min(L.BH + 14, (U.h - 150) / n), bh = pitch - 12;
      const rowsH = n * pitch - 12, y0 = U.y0 + (U.h - rowsH - lockH - 22) / 2;
      place(ax + 18, aw - 36, y0, pitch, bh);
      T.card = R(ax, y0 - 18, aw, rowsH + 36 + lockH + 14);
      T.lockup = R(ax + (aw - 400) / 2, y0 + rowsH + 16, 400, lockH);
      T.hero = R(U.x0 + 10, U.y0 + 6, ax - U.x0 - 24, U.h - 12);
    }
    T.lockupHit = T.lockup;
    return T;
  };
  const c = [mk(false), mk(true)];
  return (hasSave) => c[hasSave ? 1 : 0];
}

// ---- Puzzles / Classic selection ----------------------------------------------------------------------------------------------------
function buildSelect(L) {
  const { w, h, U, ins } = L, S = {};
  const backY = U.y1 - 14 - L.BH;
  S.back = R(U.x0 + (U.w - Math.min(U.w - 2 * L.pad, 360)) / 2, backY, Math.min(U.w - 2 * L.pad, 360), L.BH);
  const top = Math.max(U.y0 + 10, ins.back ? L.backBox.y + L.backBox.h - 14 : 0);
  S.title = { x: w / 2, y: top + 52, size: 46 };
  // body area: wide screens put the board tabs in a column on the left and the grid on the right
  const bodyTop = top + 86, bodyBot = backY - 14;
  const gridCells = (area, count, minW, aspect, maxCols) => {
    let best = null;
    for (let cols = 1; cols <= maxCols; cols++) {
      const rows = Math.ceil(count / cols), gap = 12, cw = (area.w - gap * (cols - 1)) / cols, ch = (area.h - gap * (rows - 1)) / rows;
      const tw = Math.min(cw, ch * aspect), th = tw / aspect; if (tw < minW) continue;
      if (!best || tw > best.tw) best = { cols, rows, tw, th, gap };
    }
    best = best ?? { cols: 2, rows: Math.ceil(count / 2), tw: (area.w - 12) / 2, th: 90, gap: 12 };
    const gw = best.cols * best.tw + (best.cols - 1) * best.gap, gh = best.rows * best.th + (best.rows - 1) * best.gap;
    const x0 = area.x + (area.w - gw) / 2, y0 = area.y + (area.h - gh) / 2;
    return Array.from({ length: count }, (_, i) => { const r = Math.floor(i / best.cols), c = i % best.cols, inRow = Math.min(best.cols, count - r * best.cols), off = (best.cols - inRow) * (best.tw + best.gap) / 2; return R(x0 + c * (best.tw + best.gap) + off, y0 + r * (best.th + best.gap), best.tw, best.th); });
  };
  if (!L.land) {
    const tabs = 5, gap = 8, tw = (U.w - 2 * L.pad - gap * (tabs - 1)) / tabs;
    S.tabs = Array.from({ length: tabs }, (_, i) => R(U.x0 + L.pad + i * (tw + gap), bodyTop, tw, 84));
    S.info = R(U.x0 + L.pad, bodyTop + 94, U.w - 2 * L.pad, 56);
    S.grid = gridCells(R(U.x0 + L.pad, bodyTop + 160, U.w - 2 * L.pad, bodyBot - bodyTop - 160), 12, 120, 1.0, 4);
    S.cards = gridCells(R(U.x0 + L.pad, bodyTop + 8, U.w - 2 * L.pad, bodyBot - bodyTop - 8), 5, 150, 0.86, 3);
  } else {
    const tw = clamp(U.w * 0.2, 200, 300);
    S.tabs = Array.from({ length: 5 }, (_, i) => R(U.x0 + L.pad, bodyTop + i * ((bodyBot - bodyTop - 8) / 5), tw, (bodyBot - bodyTop - 8) / 5 - 10));
    const gx = U.x0 + L.pad + tw + 20;
    S.info = R(gx, bodyTop, U.x1 - gx - L.pad, 56);
    S.grid = gridCells(R(gx, bodyTop + 66, U.x1 - gx - L.pad, bodyBot - bodyTop - 66), 12, 110, 1.0, 6);
    S.cards = gridCells(R(U.x0 + L.pad, bodyTop + 8, U.w - 2 * L.pad, bodyBot - bodyTop - 8), 5, 150, 0.9, 5);
  }
  return S;
}

// ---- Rules / How to Play / About: one framed scrolling panel + a header with the text-size stepper + Back / Prev / Next ------------------------------
function buildDoc(L) {
  const { U, ins } = L;
  const top = Math.max(U.y0 + 10, ins.back ? L.backBox.y + L.backBox.h - 22 : 0) + 4;
  let panel, nav, barY = U.y1 - 14 - L.BH;
  if (L.land) {
    // landscape: the page keeps the full height; Menu / Previous / Next stack in a column on the right
    const nw = clamp(U.w * 0.2, 170, 250), g = 12;
    const pw = Math.min(U.w - 2 * 16 - nw - g, 1000), total = pw + g + nw, x0 = U.x0 + (U.w - total) / 2;
    panel = R(x0, top, pw, U.y1 - 12 - top);
    const bx = x0 + pw + g, by = panel.y + panel.h - 3 * L.BH - 2 * 14;
    nav = { back: R(bx, by, nw, L.BH), prev: R(bx, by + L.BH + 14, nw, L.BH), next: R(bx, by + 2 * (L.BH + 14), nw, L.BH) };
  } else {
    const pw = Math.min(U.w - 2 * Math.max(16, L.pad * 0.6), 980), px = U.x0 + (U.w - pw) / 2;
    panel = R(px, top, pw, barY - 12 - top);
    const nw = Math.min(250, (pw - 24) / 3), navX = U.x0 + (U.w - (3 * nw + 24)) / 2;
    nav = { back: R(navX, barY, nw, L.BH), prev: R(navX + nw + 12, barY, nw, L.BH), next: R(navX + 2 * (nw + 12), barY, nw, L.BH) };
  }
  const viewport = R(panel.x + 18, panel.y + 94, panel.w - 36 - 16, panel.h - 94 - 54);
  return {
    panel, viewport, nav,
    header: { dec: R(panel.x + panel.w - 18 - 96 - 10 - 96, panel.y + 12, 96, 66), inc: R(panel.x + panel.w - 18 - 96, panel.y + 12, 96, 66), titleX: panel.x + 24, titleY: panel.y + 58 },
    scrollbar: R(panel.x + panel.w - 28, viewport.y, 20, viewport.h), counterY: panel.y + panel.h - 20, textW: Math.min(viewport.w - 24, 860), cx: panel.x + panel.w / 2,
  };
}

// ---- result card (overlay) --------------------------------------------------------------------------------------------------------------
function buildResult(L) {
  const { U } = L, cw = Math.min(U.w - 2 * Math.max(16, L.pad), L.land ? 640 : 640), ch = Math.min(U.h - 40, L.land ? 560 : 600);
  const x = U.x0 + (U.w - cw) / 2, y = U.y0 + (U.h - ch) / 2, bw = cw - 56, BH = L.BH, by = y + ch - 56, tw = (bw - 24) / 3;
  return {
    card: R(x, y, cw, ch), stars: { cx: x + cw / 2, y: y + 110, r: ch < 540 ? 34 : 42 }, title: { x: x + cw / 2, y: y + 62, size: ch < 540 ? 44 : 50 },
    lines: { x: x + cw / 2, y: y + 188, size: 28, maxW: cw - 50 },
    primary: R(x + 28, by - 2 * BH - 14, bw, BH), second: R(x + 28, by - BH, tw, BH), third: R(x + 28 + tw + 12, by - BH, tw, BH), menu: R(x + 28 + 2 * (tw + 12), by - BH, tw, BH),
    more: { x: x + cw / 2, y: y + ch - 20 },
  };
}

// ---- settings --------------------------------------------------------------------------------------------------------------------------
function buildSettings(L) {
  const { w, U, ins } = L, backY = U.y1 - 14 - L.BH, top = Math.max(U.y0 + 10, ins.back ? L.backBox.y + L.backBox.h - 14 : 0);
  const names = ['sound', 'calm', 'targets', 'wood', 'pegs', 'text', 'reset'], cols = L.land ? 2 : 1, nrows = Math.ceil(names.length / cols);
  const aw = Math.min(U.w - 2 * L.pad, cols === 2 ? 1100 : 720), ax = U.x0 + (U.w - aw) / 2, y0 = top + 96, avail = backY - 14 - y0;
  const pitch = Math.min(132, avail / nrows), bh = pitch - 12, gap = 14, cw = (aw - gap * (cols - 1)) / cols;
  const out = { title: { x: w / 2, y: top + 52, size: 46 }, rows: {}, back: R(U.x0 + (U.w - Math.min(U.w - 2 * L.pad, 360)) / 2, backY, Math.min(U.w - 2 * L.pad, 360), L.BH), panel: R(ax - 12, y0 - 12, aw + 24, nrows * pitch + 12), pitch };
  names.forEach((n, i) => { const c = cols === 2 ? i % 2 : 0, r = cols === 2 ? Math.floor(i / 2) : i; out.rows[n] = R(ax + c * (cw + gap), y0 + r * pitch, cw, bh); });
  return out;
}

// ---- tiny screens: demo limit, loading ------------------------------------------------------------------------------------------------------
function buildSimple(L) {
  const { U } = L, bw = Math.min(U.w - 2 * L.pad, 460);
  return { back: R(U.x0 + (U.w - bw) / 2, U.y0 + U.h / 2 + 90, bw, L.BH), cx: U.x0 + U.w / 2, cy: U.y0 + U.h / 2 };
}
