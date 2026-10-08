// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows
// the aspect ratio, capped at 2.4:1). Every screen asks for its rectangles here; drawing (view.js) and hit-testing (game.js) share them.
//   stack  tall screens (portrait phones and tablets): header, seat plates, the board, throw tray + message, two rows of buttons.
//   wide   landscape and nearly square screens: a card on the left (title, plates, tray + message), the board, and a card of buttons on
//          the right; on narrower landscape screens the buttons move into the left card.
// Safe areas and the host's floating back button come from `host` (main.js keeps it current; browsers: all zero).
export const SCREEN = { width: 720, height: 1560 };
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // virtual units; px = css pixels per virtual unit

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = Math.round;
export const isWide = (w, h) => h < w * 1.1;

function common(w, h) {
  const ins = { ...host };
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bs = ins.back ? Math.max(ins.back, 56) : 0;
  const backBox = bs ? R(ins.l, ins.t, bs + 10, bs + 10) : R(0, 0, 0, 0);
  return { ins, U, backBox };
}
const insKey = () => `${round(host.t)},${round(host.r)},${round(host.b)},${round(host.l)},${round(host.back)}`;
const memo = (fn) => {
  const cache = new Map();
  return (...a) => {
    const key = `${a.join('|')}|${insKey()}`;
    let v = cache.get(key);
    if (!v) { v = fn(...a); cache.set(key, v); if (cache.size > 60) cache.delete(cache.keys().next().value); }
    return v;
  };
};

const gridCols = (n) => (n <= 3 ? n : n === 4 ? 2 : 3);
export const TOOL_IDS = ['nudgeM', 'nudgeP', 'think', 'pause', 'pass', 'throw'];

// Splits a status rectangle into the throw tray and the message area.
function splitStatus(st, stack) {
  if (stack) {
    const tw = clamp(st.w * 0.46, 200, 420);
    return { sticks: R(st.x + 10, st.y + 8, tw, st.h - 16), msg: R(st.x + tw + 20, st.y + 8, st.w - tw - 30, st.h - 16) };
  }
  const th = clamp(st.h * 0.4, 84, 150);
  return { sticks: R(st.x + 10, st.y + 8, st.w - 20, th), msg: R(st.x + 10, st.y + th + 14, st.w - 20, Math.max(40, st.h - th - 22)) };
}

// ------------------------------------------------------------------------------------------------------------ play
// scale = the text-zoom step (1 to 3): the HUD grows with it, the board does not. n = seats.
export const playFrame = memo((w, h, scale, n) => {
  w = round(w); h = round(h); n = n || 3;
  const { ins, U, backBox } = common(w, h);
  const k = clamp((scale - 1) / 2, 0, 1);
  const F = { w, h, U, backBox, wide: isWide(w, h), mode: '', n };
  const cols = gridCols(n), rows = Math.ceil(n / cols);
  if (!F.wide) {
    F.mode = 'stack';
    const cmp = h < 1350;
    const topY = Math.max(22, ins.t + 8);
    F.pause = R(U.x1 - 16 - 84, topY, 84, 78);
    const reserve = Math.max(120, backBox.w ? backBox.x + backBox.w + 8 : 0, w - F.pause.x + 8);
    F.titleBox = { x: reserve, y: topY, w: w - 2 * reserve, h: 54 };
    F.badge = { x: round(w / 2), y: topY + 56, align: 'center' };
    const top = topY + 90;
    const x0 = U.x0 + 20, cw = U.w - 40;
    if (h < w * 1.52) {
      // tablets in portrait (about 4:3): the throw tray and the buttons share one row under the board so the board gets the full width
      const gapC = 12, bottomC = h - Math.max(22, ins.b + 8);
      const chipC = round((cols === n ? 82 : 66) + 40 * k);
      const platesC = rows * chipC + (rows - 1) * 8;
      const rowH = round(Math.min(220, Math.max(150, (bottomC - top - platesC) * 0.27)) + 40 * k);
      const sideC = clamp(bottomC - top - platesC - rowH - gapC * 2, 240, Math.min(cw, 860));
      const totC = platesC + gapC + sideC + gapC + rowH;
      const yC = round(top + Math.max(0, (bottomC - top - totC) * 0.35));
      const chipWC = (cw - 10 * (cols - 1)) / cols;
      F.plates = Array.from({ length: n }, (_, i) => R(x0 + (i % cols) * (chipWC + 10), yC + Math.floor(i / cols) * (chipC + 8), chipWC, chipC));
      const bY = yC + platesC + gapC;
      F.board = { x: round(U.x0 + (U.w - sideC) / 2), y: bY, side: round(sideC) };
      const rowY = bY + sideC + gapC + Math.round(sideC * 0.035);
      const rH = rowH - Math.round(sideC * 0.035);
      const stW = round(cw * 0.45);
      F.status = R(x0, rowY, stW, rH);
      Object.assign(F, splitStatus(F.status, false));
      const bx = x0 + stW + 12, bwid = cw - stW - 12, gg = 8, c3 = (bwid - 2 * gg) / 3, bh = (rH - gg) / 2;
      const cell = (r, c, span = 1) => R(bx + c * (c3 + gg), rowY + r * (bh + gg), c3 * span + gg * (span - 1), bh);
      F.tools = { nudgeM: cell(0, 0), nudgeP: cell(0, 1), think: cell(0, 2), pause: cell(1, 0), pass: cell(1, 1), throw: cell(1, 2) };
      F.auto = { slower: cell(0, 0), faster: cell(0, 1), exit: cell(1, 0), pause: cell(1, 1, 2) };
      F.cards = [];
      F.pauseTop = F.pause;
      return F;
    }
    // components shrink (down to ~72%) on screens that are not tall enough to give the board the full width
    let f = 1, chipH, platesH, toolH, toolsH, toolY, statusH, gap, bottom, side;
    for (;;) {
      chipH = round(((cols === n ? (cmp ? 92 : 104) : cmp ? 76 : 86) + 56 * k) * f);
      platesH = rows * chipH + (rows - 1) * 10;
      toolH = round(((cmp ? 80 : 92) + 40 * k) * f);
      toolsH = toolH * 2 + 12;
      toolY = h - Math.max(26, ins.b + 10) - toolsH;
      statusH = round(((cmp ? 150 : 190) + 120 * k) * f);
      gap = cmp ? 12 : 16;
      bottom = toolY - gap;
      side = clamp(bottom - top - platesH - statusH - gap * 3, 240, Math.min(cw, 860));
      if (side >= Math.min(cw, 860) - 4 || f <= 0.72) break;
      f = Math.max(0.72, f - 0.04);
    }
    // spare height (a wide-ish portrait screen) goes to the status card
    const used = platesH + side + statusH + gap * 3;
    statusH += Math.min(160, Math.max(0, bottom - top - used - 8) * 0.7);
    const total = platesH + gap + side + gap + statusH;
    const y0 = round(top + Math.max(0, (bottom - top - total) * 0.4));
    const chipW = (cw - 10 * (cols - 1)) / cols;
    F.plates = Array.from({ length: n }, (_, i) => R(x0 + (i % cols) * (chipW + 10), y0 + Math.floor(i / cols) * (chipH + 10), chipW, chipH));
    const boardY = y0 + platesH + gap;
    F.board = { x: round(U.x0 + (U.w - side) / 2), y: boardY, side: round(side) };
    F.status = R(x0, boardY + side + gap + Math.round(side * 0.035), cw, statusH - Math.round(side * 0.035));
    Object.assign(F, splitStatus(F.status, true));
    const g = 12, rowW = cw - 2 * g;
    const wA = rowW / 3;
    const A = (i) => R(x0 + i * (wA + g), toolY, wA, toolH);
    const bw = [0.78, 0.78, 1.44], tot = bw[0] + bw[1] + bw[2];
    const Bx = (i) => R(x0 + (bw.slice(0, i).reduce((s, v) => s + v, 0) * rowW) / tot + i * g, toolY + toolH + 12, (bw[i] * rowW) / tot, toolH);
    F.tools = { nudgeM: A(0), nudgeP: A(1), think: A(2), pause: Bx(0), pass: Bx(1), throw: Bx(2) };
    F.auto = { slower: A(0), faster: A(1), exit: Bx(0), pause: R(Bx(1).x, Bx(1).y, Bx(2).x + Bx(2).w - Bx(1).x, toolH) };
    F.cards = [];
    F.pauseTop = F.pause;
    return F;
  }
  // ---- wide
  F.mode = 'wide';
  const g = 14, mg = 14, y0 = U.y0 + 12, Hh = Math.max(300, U.h - 24), AW = U.w - 2 * mg;
  const three = AW - Hh - 2 * g >= 2 * 270;
  let bs, leftW, rightW = 0, gx;
  if (three) {
    bs = Hh - 10; const rem = AW - bs - 2 * g; leftW = rightW = clamp(rem / 2, 270, 520);
    gx = U.x0 + (U.w - (bs + 2 * g + leftW + rightW)) / 2;
  } else {
    bs = clamp(Math.min(Hh - 10, AW - g - 320), 260, Hh); leftW = clamp(AW - g - bs, 320, 560);
    gx = U.x0 + (U.w - (leftW + g + bs)) / 2;
  }
  const left = R(gx, y0, leftW, Hh);
  F.board = { x: round(gx + leftW + g), y: round(y0 + (Hh - bs) / 2), side: round(bs) };
  const right = three ? R(F.board.x + bs + g, y0, rightW, Hh) : null;
  F.cards = right ? [left, right] : [left];
  F.three = three;
  const backOver = backBox.w && backBox.x + backBox.w > left.x && backBox.y < y0 + 90;
  const hx = backOver ? Math.max(left.x + 8, backBox.x + backBox.w + 4) : left.x + 10;
  const hh = backOver ? Math.max(82, backBox.y + backBox.h - y0 + 2) : 82;
  F.titleBox = { x: hx, y: y0 + 2, w: left.x + left.w - 10 - hx, h: hh - 38 };
  F.badge = { x: round(left.x + left.w / 2), y: y0 + hh - 34, align: 'center' };
  const inset = 10, innerX = left.x + inset, innerW = left.w - 2 * inset;
  const btnH = round(66 + 22 * k);
  const gridH = three ? 0 : 3 * btnH + 2 * 8;
  const pcols = innerW >= 420 && n > 2 ? 2 : (n > 4 && innerW >= 300 ? 2 : 1);
  const prows = Math.ceil(n / pcols);
  let plateH = round(76 + 30 * k);
  const yp = y0 + hh + 2;
  const avail = left.y + left.h - (yp) - gridH - (gridH ? 10 : 0);
  // keep at least 190 for the tray and the message
  while (plateH > 50 && prows * (plateH + 8) > avail - 190) plateH -= 4;
  const chipW = (innerW - 8 * (pcols - 1)) / pcols;
  F.plates = Array.from({ length: n }, (_, i) => R(innerX + (i % pcols) * (chipW + 8), yp + Math.floor(i / pcols) * (plateH + 8), chipW, plateH));
  const sy = yp + prows * (plateH + 8) + 2, sb = left.y + left.h - gridH - (gridH ? 8 : 4);
  F.status = R(innerX, sy, innerW, Math.max(110, sb - sy));
  Object.assign(F, splitStatus(F.status, false));
  if (gridH) {
    const gy = left.y + left.h - gridH - 6, cw3 = (innerW - 16) / 3;
    const cell = (r, c) => R(innerX + c * (cw3 + 8), gy + r * (btnH + 8), cw3, btnH);
    F.tools = { nudgeM: cell(0, 0), nudgeP: cell(0, 1), think: cell(0, 2), pause: cell(1, 0), pass: cell(1, 1), throw: cell(2, 0) };
    F.tools.throw = R(innerX, gy + 2 * (btnH + 8), innerW, btnH);
    F.auto = { slower: cell(0, 0), faster: cell(0, 1), exit: cell(1, 0), pause: R(innerX + cw3 + 8, gy + (btnH + 8), 2 * cw3 + 8, btnH) };
  } else {
    const bw = clamp(right.w - 24, 160, 380), bx = right.x + (right.w - bw) / 2;
    const gp = 10, bh = clamp((right.h - 5 * gp - 24) / 6, 62, 120);
    const y1 = right.y + (right.h - (6 * bh + 5 * gp)) / 2;
    const slot = (i) => R(bx, y1 + i * (bh + gp), bw, bh);
    F.tools = { throw: slot(0), nudgeM: slot(1), nudgeP: slot(2), think: slot(3), pass: slot(4), pause: slot(5) };
    F.auto = { pause: slot(0), slower: slot(1), faster: slot(2), exit: slot(3) };
  }
  F.pauseTop = F.tools.pause;
  return F;
});

// ------------------------------------------------------------------------------------------------------------ documents
// nav: previous / next buttons; start: a Start button (setup). Returns the panel, the scrolling body, the zoom controls and the bar.
export const docFrame = memo((w, h, nav, start) => {
  w = round(w); h = round(h);
  const { ins, U, backBox } = common(w, h);
  const F = { w, h, U, nav: !!nav, start: !!start, wide: isWide(w, h) };
  const pad = 24;
  if (!F.wide) {
    const topY = Math.max(16, ins.t + 8), topH = 76, barH = 84;
    const barY = h - Math.max(24, ins.b + 8) - barH;
    F.zoomInc = R(U.x1 - pad - 84, topY, 84, topH);
    F.zoomPct = R(F.zoomInc.x - 12 - 120, topY, 120, topH);
    F.zoomDec = R(F.zoomPct.x - 12 - 84, topY, 84, topH);
    const lb = Math.max(U.x0 + pad, backBox.w ? backBox.x + backBox.w + 6 : 0);
    F.counter = nav ? { x: (lb + F.zoomDec.x - 8) / 2, y: topY + topH / 2 + 9, size: 26 } : null;
    const py = topY + topH + 10;
    F.panel = R(U.x0 + pad, py, U.w - 2 * pad, barY - 10 - py);
    const bw = 170, x0 = U.x0 + pad, cw = U.w - 2 * pad;
    F.back = R(x0, barY, bw, barH);
    if (nav) { const aw = (cw - bw - 28) / 2; F.prev = R(x0 + bw + 14, barY, aw, barH); F.next = R(x0 + bw + 14 + aw + 14, barY, aw, barH); }
    else if (start) F.start = R(x0 + bw + 14, barY, cw - bw - 14, barH);
  } else {
    const rw = clamp(U.w * 0.24, 220, 320), g = 14;
    const panelW = Math.min(U.w - 2 * g - rw - g, 1100);
    const gx = U.x0 + (U.w - (rw + g + panelW)) / 2;
    const overBack = backBox.w && gx < backBox.x + backBox.w + 6;
    let y = overBack ? backBox.y + backBox.h + 8 : U.y0 + 14;
    if (nav) { F.counter = { x: gx + rw / 2, y: y + 26, size: 26 }; y += 42; } else F.counter = null;
    F.zoomDec = R(gx, y, 66, 66); F.zoomInc = R(gx + rw - 66, y, 66, 66); F.zoomPct = R(gx + 74, y, rw - 148, 66);
    y += 78;
    if (nav) { F.prev = R(gx, y, rw, 72); y += 82; F.next = R(gx, y, rw, 72); y += 82; }
    else if (start) { F.start = R(gx, y, rw, 84); y += 94; }
    F.back = R(gx, U.y1 - 14 - 72, rw, 72);
    F.panel = R(gx + rw + g, U.y0 + 14, panelW, U.h - 28);
  }
  F.region = R(F.panel.x + 24, F.panel.y + 24, F.panel.w - 48, F.panel.h - 48);
  return F;
});

// ------------------------------------------------------------------------------------------------------------ title
// The attract art is designed on a 720 x 770 canvas (title text, then a 400 board); it is scaled and placed here.
// Tap zone of the Arcforge lockup: at least 44 x 44 css px, grown sideways/downwards only (never up into the menu).
export const creditHit = (r) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(r.w, m), h = Math.max(r.h, m); return R(r.x + r.w / 2 - w / 2, r.y, w, h); };
export const ART_H = 770;
export const titleFrame = memo((w, h) => {
  w = round(w); h = round(h);
  const { ins, U, backBox } = common(w, h);
  const F = { w, h, wide: isWide(w, h), U, backBox };
  const lock = { w: 250, h: 68 };
  if (!F.wide) {
    const bottom = h - Math.max(14, ins.b + 6);
    const s = clamp((h - (h < 1450 ? 480 : 560) - lock.h - ins.t * 0.5) / ART_H, 0.42, 1);
    F.art = { x: (w - 720 * s) / 2, y: ins.t * 0.5, s };
    const my = F.art.y + ART_H * s + 14;
    F.lock = R((w - lock.w) / 2, bottom - lock.h, lock.w, lock.h);
    const mw = Math.min(672, U.w - 48);
    F.menu = R(U.x0 + (U.w - mw) / 2, my, mw, Math.max(120, F.lock.y - 6 - my));
    F.compact = h < 1450;
  } else {
    const g = 14, leftW = clamp(U.w * 0.46, 380, 760);
    const s = clamp(Math.min((leftW - 20) / 700, (U.h - 16) / ART_H), 0.4, 1.15);
    const mw = Math.min(560, U.w - leftW - 2 * g - 14);
    const gx = U.x0 + (U.w - (leftW + g + mw)) / 2;
    F.art = { x: gx + (leftW - 720 * s) / 2, y: U.y0 + (U.h - ART_H * s) / 2, s };
    const mx = gx + leftW + g;
    F.lock = R(mx + (mw - lock.w) / 2, U.y1 - 12 - lock.h, lock.w, lock.h);
    F.menu = R(mx, U.y0 + 14, mw, Math.max(120, F.lock.y - 8 - (U.y0 + 14)));
    F.compact = true;
  }
  return F;
});

// ------------------------------------------------------------------------------------------------------------ overlays
// The card for pause / result / summary / demo limit. Wide screens get two columns (words left, buttons right).
export const overlayArea = memo((w, h) => {
  w = round(w); h = round(h);
  const { U } = common(w, h);
  const wide = isWide(w, h);
  const cardW = wide ? Math.min(U.w - 40, 1040) : Math.min(620, U.w - 40);
  return { wide, w: cardW, cx: U.x0 + U.w / 2, cy: U.y0 + U.h / 2, maxH: Math.max(300, U.h - 28) };
});
