// Geometry as a pure function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side
// follows the aspect ratio). Every screen asks for its rectangles here; drawing (view.js) and hit-testing (game.js) share them.
//   stack  tall screens (portrait phones and tablets): header, two player plates, board, status, button bar. At 720 x 1560 this is
//          the approved phone look.
//   wide   landscape (and nearly square) screens: a card on the left (title, plates, status), the board, and a card of buttons on
//          the right; on narrower landscape screens the buttons move into the left card.
// Safe areas and the host's floating back button come from `host` (main.js keeps it current; browsers: all zero).
export const SCREEN = { width: 720, height: 1560 };
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // virtual units; px = css pixels per virtual unit
export const TOOLBAR_IDS = ['undo', 'think', 'restart'];

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

// ------------------------------------------------------------------------------------------------------------ play
// scale = the text-zoom step (1 to 3): the HUD grows with it, the board does not.
export const playFrame = memo((w, h, scale) => {
  w = round(w); h = round(h);
  const { ins, U, backBox } = common(w, h);
  const k = clamp((scale - 1) / 2, 0, 1);
  const F = { w, h, U, backBox, wide: isWide(w, h), mode: '' };
  const cmp = h < 1350;
  if (!F.wide) {
    F.mode = 'stack';
    const topY = Math.max(22, ins.t + 8);
    F.pause = R(U.x1 - 16 - 84, topY, 84, 78);
    const reserve = Math.max(120, backBox.w ? backBox.x + backBox.w + 8 : 0, w - F.pause.x + 8);
    F.titleBox = { x: reserve, y: topY, w: w - 2 * reserve, h: 78 };
    const top = topY + 94;
    const chipH = round((cmp ? 88 : 104) + 70 * k);
    let statusH = round((cmp ? 120 : 150) + 150 * k);
    const toolH = round((cmp ? 92 : 112) + 74 * k);
    const toolY = h - Math.max(28, ins.b + 10) - toolH;
    const bottom = toolY - 18, gap = cmp ? 14 : 18;
    const x0 = U.x0 + 24, cw = U.w - 48;
    const side = clamp(bottom - top - chipH - statusH - gap * 2 - 24, 240, Math.min(cw, 800));
    statusH += Math.min(120, Math.max(0, round((bottom - top - (chipH + side + statusH + gap * 2) - 24) * 0.6)));
    const total = chipH + gap + side + gap + statusH;
    const y0 = round(top + (bottom - top - total) * 0.45);
    const boardY = y0 + chipH + gap;
    const chipW = (cw - 12) / 2;
    F.chips = [R(x0, y0, chipW, chipH), R(x0 + chipW + 12, y0, chipW, chipH)];
    F.board = { x: round(U.x0 + (U.w - side) / 2), y: boardY, side };
    F.status = R(x0, boardY + side + gap, cw, statusH);
    const bw = (cw - 32) / 3;
    F.tool = [0, 1, 2].map((i) => R(x0 + i * (bw + 16), toolY, bw, toolH));
    const aw = 130, ag = 14;
    F.auto = {
      exit: R(x0, toolY, aw, toolH), slower: R(x0 + aw + ag, toolY, aw, toolH),
      pause: R(x0 + 2 * (aw + ag), toolY, cw - 3 * aw - 3 * ag, toolH), faster: R(x0 + cw - aw, toolY, aw, toolH),
    };
    F.cards = [];
    return F;
  }
  // ---- wide
  F.mode = 'wide';
  const g = 14, mg = 14, y0 = U.y0 + 12, Hh = Math.max(300, U.h - 24), AW = U.w - 2 * mg;
  const three = AW - Hh - 2 * g >= 2 * 280;
  let bs, leftW, rightW = 0, gx;
  if (three) {
    bs = Hh; const rem = AW - bs - 2 * g; leftW = rightW = clamp(rem / 2, 280, 500);
    gx = U.x0 + (U.w - (bs + 2 * g + leftW + rightW)) / 2;
  } else {
    bs = clamp(Math.min(Hh, AW - g - 300), 260, Hh); leftW = clamp(AW - g - bs, 300, 520);
    gx = U.x0 + (U.w - (leftW + g + bs)) / 2;
  }
  const left = R(gx, y0, leftW, Hh);
  F.board = { x: round(gx + leftW + g), y: round(y0 + (Hh - bs) / 2), side: round(bs) };
  const right = three ? R(F.board.x + bs + g, y0, rightW, Hh) : null;
  F.cards = right ? [left, right] : [left];
  F.three = three;
  // header: the title sits to the right of the host's back button when that overlaps the card
  const backOver = backBox.w && backBox.x + backBox.w > left.x && backBox.y < y0 + 90;
  const hx = backOver ? Math.max(left.x + 8, backBox.x + backBox.w + 4) : left.x + 10;
  const hh = backOver ? Math.max(78, backBox.y + backBox.h - y0 + 2) : 78;
  F.titleBox = { x: hx, y: y0 + 2, w: left.x + left.w - 10 - hx, h: hh - 4 };
  const inset = 10, innerX = left.x + inset, innerW = left.w - 2 * inset;
  const hasGrid = !three;
  const btnH = round(78 + 26 * k);
  const gridH = 2 * btnH + 10;
  let plateH = round(92 + 44 * k);
  const yp = y0 + hh + 4;
  const reserveBottom = hasGrid ? gridH + 12 : 0;
  while (plateH > 70 && left.y + left.h - reserveBottom - (yp + 2 * plateH + 20) < 130) plateH -= 6;
  F.chips = [R(innerX, yp, innerW, plateH), R(innerX, yp + plateH + 10, innerW, plateH)];
  const sy = yp + 2 * plateH + 20, sb = left.y + left.h - reserveBottom;
  F.status = R(innerX, sy, innerW, Math.max(80, sb - sy));
  if (hasGrid) {
    const gy = left.y + left.h - gridH, cw2 = (innerW - 10) / 2;
    const cell = (r, c) => R(innerX + c * (cw2 + 10), gy + r * (btnH + 10), cw2, btnH);
    F.tool = [cell(0, 0), cell(0, 1), cell(1, 0)];   // undo, think, restart
    F.pause = cell(1, 1);
    F.auto = { pause: cell(0, 0), exit: cell(0, 1), slower: cell(1, 0), faster: cell(1, 1) };
  } else {
    const bw = clamp(right.w - 24, 160, 360), bx = right.x + (right.w - bw) / 2;
    const gap = 12, bh = clamp((right.h - 3 * gap - 24) / 4, 70, 130);
    const y1 = right.y + (right.h - (4 * bh + 3 * gap)) / 2;
    const slot = (i) => R(bx, y1 + i * (bh + gap), bw, bh);
    F.pause = slot(0); F.tool = [slot(1), slot(2), slot(3)];
    F.auto = { pause: slot(0), slower: slot(1), faster: slot(2), exit: slot(3) };
  }
  return F;
});

// ------------------------------------------------------------------------------------------------------------ documents
// nav: previous / next buttons (How to Play, Rules); start: a Start button (setup). Returns the panel, the scrolling body,
// the zoom controls and the button bar.
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
// The card for pause / result / lesson / summary / demo limit. Wide screens get two columns (words left, buttons right).
export const overlayArea = memo((w, h) => {
  w = round(w); h = round(h);
  const { U } = common(w, h);
  const wide = isWide(w, h);
  const cardW = wide ? Math.min(U.w - 40, 1040) : Math.min(620, U.w - 40);
  return { wide, w: cardW, cx: U.x0 + U.w / 2, cy: U.y0 + U.h / 2, maxH: Math.max(300, U.h - 28) };
});
