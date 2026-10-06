// Fluid layout (kit 1.7.x fluid viewport): the SHORT side of the screen is always 720 units and the long side grows with the
// aspect ratio. `layoutFor(w, h)` returns every rect for that live size (cached by size + safe insets), so rendering (view.js)
// and pointer hit-testing (game.js) share one source of truth. Pure math only, no canvas calls.
//
// Shapes (one builder, three arrangements):
//   portrait   header on top, partner seat, the two opponents down the sides of the line, rack, then a Hint/Pass/Undo row.
//   wide       (landscape, w >= 940) same table, but Hint/Undo sit left of the rack and Pass right of it, so the line gets
//              the height; the title/lobby/result screens split art | buttons.
//   square     a landscape window too narrow for side buttons: portrait-style bottom rows.
// The hand is never clipped: the rack always fits the live width (tile size shrinks, never overflows).

export const SCREEN = { width: 720, height: 1560 };   // default size only (what meta starts as); every position comes from layoutFor()
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px, tap targets stay near 44 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export function inRect(x, y, rect) {
  return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- The line ---------------------------------------------------------------------------------
// Cuban dominoes has no spinner: the line only ever grows at its two ends. It renders as rows (wrapping like text); every
// row-count from 1 up is tried and the one whose tiles come out largest within `bounds` wins.
const LINE_MIN_W = 20, LINE_MAX_W = 112, LINE_GAP = 4, LINE_ROW_GAP = 10, LINE_MAX_ROWS = 8;
export function layoutLineRows(count, bounds) {
  const n = Math.max(count, 1);
  let best = null;
  for (let rows = 1; rows <= LINE_MAX_ROWS; rows++) {
    const perRow = Math.ceil(n / rows);
    const byWidth = (bounds.w - (perRow - 1) * LINE_GAP) / perRow;
    const byHeight = (bounds.h - (rows - 1) * LINE_ROW_GAP) / (rows * 1.5);
    const w = Math.min(LINE_MAX_W, byWidth, byHeight);
    if (!best || w > best.w) best = { rows, perRow, w };
    if (perRow === 1) break;
  }
  const w = Math.max(LINE_MIN_W, best.w);
  return { rows: best.rows, perRow: best.perRow, w, h: w * 1.5, gap: LINE_GAP, rowGap: LINE_ROW_GAP };
}

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(3)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

// Every named button rect for a scene (used by the overlap check and by tests).
export function buttonsFor(L, scene) {
  const out = {};
  if (scene === 'title') Object.assign(out, { play: L.title.play, howto: L.title.howto, rules: L.title.rules, auto: L.title.auto });
  else if (scene === 'lobby') { L.lobby.cards.forEach((c, i) => { out[`card${i}`] = c; }); Object.assign(out, { start: L.lobby.start, menu: L.lobby.menu }); }
  else if (scene === 'playing') Object.assign(out, { back: L.play.back, memory: L.play.memory, hint: L.play.hint, pass: L.play.pass, undo: L.play.undo });
  else if (scene === 'auto') Object.assign(out, { back: L.play.back, memory: L.play.memory, faster: L.play.hint, pause: L.play.pass, slower: L.play.undo });
  else if (scene === 'result') Object.assign(out, { cont: L.overlay.cont });
  else if (scene === 'rules' || scene === 'howto') Object.assign(out, { back: L.ref.back, dec: L.ref.dec, inc: L.ref.inc, prev: L.ref.prev, next: L.ref.next });
  return out;
}

function build(w, h, ins) {
  const land = w >= h;
  const px = Math.max(0.2, ins.px || 0.6);
  const L = { w, h, land, ins, px };
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const minFont = L.minFont = Math.ceil(11 / px);          // smallest text that still reads as 11 css px
  L.fs = (size) => Math.max(size, minFont);
  const C = L.C = { x0: U.x0 + 20, y0: U.y0 + (land ? 28 : 34), x1: U.x1 - 20, y1: U.y1 - 18 };
  C.w = C.x1 - C.x0; C.h = C.y1 - C.y0;
  const btnH = L.btnH = clamp(Math.round(46 / px), 60, 92);   // ~44-46 css px where the screen allows
  const tb = clamp(btnH, 58, 92);
  // the host's floating back button (hub only): anything top-left starts to its right
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const clearLeft = L.clearLeft = ins.back ? L.backBox.x + L.backBox.w + 10 : C.x0;
  L.horizon = clamp(U.y0 + Math.round(h * 0.27), 170, 440);

  // ============================================================================ playing / auto
  const P = L.play = {};
  const topY = C.y0;
  P.back = R(clearLeft, topY, 128, tb);
  P.memory = R(C.x1 - 200, topY, 200, tb);
  P.scoreCx = (P.back.x + P.back.w + P.memory.x) / 2;
  let hdrBottom;
  if (land) { P.scoreY = topY + 34; P.statusY = topY + tb - 8; P.statusSize = Math.max(20, minFont); hdrBottom = topY + tb; }
  else { P.scoreY = topY + tb / 2 + 11; P.statusY = topY + tb + 30; P.statusSize = Math.max(24, minFont); hdrBottom = topY + tb + 42; }
  P.scoreSize = 30;
  P.toastSize = Math.max(20, minFont);
  P.wide = land && w >= 940;

  const colW = land ? 124 : 104;
  const lf = P.labelSize = Math.max(24, minFont);
  const gapB = 14;
  const bw = P.sideBtnW = clamp(Math.round(w * 0.11), 120, 180);
  const bhS = clamp(Math.round(btnH * 0.78), 54, 72);
  let rackX0, rackX1, rackTop, rackBottom, rowTop;
  let rightEdge = C.x1;      // wide: the Hint/Pass/Undo panel takes the right edge, the table lives to its left
  if (P.wide) {
    const bh = clamp(btnH, 60, 84), g = 12;
    rightEdge = C.x1 - bw - 16;
    const top0 = hdrBottom + 8, tot = 3 * bh + 2 * g;
    const y0 = top0 + Math.max(0, (C.y1 - top0 - tot) / 2);
    P.hint = R(C.x1 - bw, y0, bw, bh); P.pass = R(C.x1 - bw, y0 + bh + g, bw, bh); P.undo = R(C.x1 - bw, y0 + 2 * (bh + g), bw, bh);
    rackX0 = C.x0; rackX1 = rightEdge;
  } else {
    const bwRow = C.w - 2 * gapB;
    const side = Math.round(bwRow * 0.29), mid = bwRow - 2 * side;
    const rowY = C.y1 - btnH;
    P.hint = R(C.x0, rowY, side, btnH); P.pass = R(C.x0 + side + gapB, rowY, mid, btnH); P.undo = R(C.x1 - side, rowY, side, btnH);
    rackX0 = C.x0; rackX1 = C.x1; rackBottom = rowY - 12; rowTop = rowY;
  }
  const rackGap = 4, rackAvail = Math.min(rackX1 - rackX0, 1000);
  const rw10 = (rackAvail - rackGap * 9) / 10;
  const rackMaxW = Math.min(83, Math.max(30, rw10 * 1.2));
  const rackMaxH = rackMaxW * (82 / 55);
  if (P.wide) { rackBottom = C.y1; rowTop = C.y1; }
  rackTop = rackBottom - rackMaxH;
  const rackCx = (rackX0 + rackX1) / 2;
  P.rackTop = rackTop;
  P.rackRect = (index, count) => {
    const n = Math.max(count, 1);
    const tw = Math.min(rackMaxW, Math.max(28, (rackAvail - rackGap * (n - 1)) / n));
    const th = tw * (82 / 55);
    const total = n * tw + (n - 1) * rackGap;
    return R(rackCx - total / 2 + index * (tw + rackGap), rackBottom - th, tw, th);
  };

  const tableCx = (C.x0 + rightEdge) / 2;
  const partnerTop = hdrBottom + 6;
  const th0 = 40, tw0 = 26;
  const partnerBlockH = lf + 10 + th0 + 6;
  const mainTop = partnerTop + partnerBlockH + 6;
  const mainBottom = rackTop - 10;
  const colTop = mainTop + lf + 12;
  const colH = Math.max(120, mainBottom - colTop);
  const k = clamp(colH / (10 * (th0 + 3)), 0.5, 1);
  const pk = Math.max(0.6, Math.min(1, ((rightEdge - C.x0) * 0.5) / (10 * (tw0 + 4))));
  P.seats = {
    2: { x: tableCx, y: partnerTop + lf + 10 + th0 * pk / 2, vertical: false, labelX: tableCx, labelY: partnerTop + lf, tw: tw0 * pk, th: th0 * pk, gap: 4 * pk },
    1: { x: C.x0 + colW / 2, y: colTop + colH / 2, vertical: true, labelX: C.x0 + colW / 2, labelY: mainTop + lf, tw: tw0 * k, th: th0 * k, gap: 3 * k },
    3: { x: rightEdge - colW / 2, y: colTop + colH / 2, vertical: true, labelX: rightEdge - colW / 2, labelY: mainTop + lf, tw: tw0 * k, th: th0 * k, gap: 3 * k },
  };
  P.ringR = 40;
  const lineX0 = C.x0 + colW + 10, lineX1 = rightEdge - colW - 10;
  P.endNumY = mainTop + 36; P.endNumSize = 36;
  P.line = R(lineX0, mainTop + 46, lineX1 - lineX0, Math.max(60, mainBottom - (mainTop + 46)));
  const mfs = P.memFont = Math.max(17, minFont);
  P.memPanel = R((P.wide ? rightEdge : C.x1) - 330, P.memory.y + P.memory.h + 8, 330, 4 * (mfs + 18) + 26);

  // ============================================================================ hand / match result overlay
  const O = L.overlay = {};
  const opw = Math.min(600, w - 40), oph = Math.min(640, h - 24);
  O.panel = R((w - opw) / 2, (h - oph) / 2, opw, oph);
  O.cont = R(O.panel.x + (opw - 380) / 2, O.panel.y + 430, 380, 100);
  O.textW = Math.min(460, opw - 60);
  O.moreY = O.panel.y + oph - 22;

  // ============================================================================ title
  const T = L.title = {};
  T.credit = { x: w / 2, y: C.y1 - 6, size: Math.max(20, minFont) };
  // Arcforge lockup: bottom centre directly under the last menu button (>= ~125 css px wide); lkStrip is the room reserved for it.
  const lkw = Math.min(C.w * 0.9, Math.max(land ? 190 : 260, 125 / px)), lkh = lkw * 260 / 700, lkStrip = lkh + 26;
  const lockAt = (cx, bottomY) => {
    T.lock = { x: cx, bottom: bottomY, w: lkw, h: lkh };
    const m = 44 / px, tw = Math.max(lkw + 20, m), th = Math.max(lkh + 12, m), y0 = Math.max(bottomY - lkh - 6, T.auto.y + T.auto.h + 2);
    T.lockTap = R(cx - tw / 2, y0, tw, Math.max(lkh + 6, Math.min(th, h - y0)));
  };
  const bFonts = [45, 44, 40, 36], bHs = [135, 130, 120, 120];
  const names = ['play', 'howto', 'rules', 'auto'];
  if (land) {
    const colL = { x0: C.x0, x1: w / 2 - 10 }, colR = { x0: w / 2 + 10, x1: C.x1 };
    const bwid = Math.min(560, colR.x1 - colR.x0 - 40);
    const avail = C.y1 - lkStrip - C.y0;
    const s = clamp(avail / 560, 0.7, 1);
    const hs = bHs.map((v) => Math.max(btnH, Math.round(v * 0.7 * s)));
    const gap = 16, total = hs.reduce((a, b) => a + b, 0) + gap * 3;
    let y = C.y0 + (avail - total) / 2 + 6;
    const bx = (colR.x0 + colR.x1) / 2 - bwid / 2;
    names.forEach((nm, i) => { T[nm] = R(bx, y, bwid, hs[i]); y += hs[i] + gap; });
    T.fonts = bFonts.map((f) => Math.round(f * 0.75));
    const cx = (colL.x0 + colL.x1) / 2, cw = colL.x1 - colL.x0 - 30;
    const ts = Math.round(40 * Math.min(1, s + 0.1));
    const dh = Math.round(146 * Math.min(1, avail / 560)), dw = Math.round(dh * 96 / 146);
    const tsz = Math.round(clamp(cw / 12.5, 22, 30)), tlh = Math.round(tsz * 1.35);
    const blockH = ts * 2 + 20 + 4 * tlh + 24 + dh;
    const y0 = Math.max(C.y0 + (avail - blockH) / 2, L.horizon + 14);   // the title block sits below the skyline strip
    T.titleSize = ts; T.titleX = cx; T.titleY1 = y0 + ts; T.titleY2 = y0 + ts * 2 + 16;
    T.tagline = { x: cx, y: T.titleY2 + 50, w: cw, lh: tlh, size: tsz };
    T.tiles = { cx, y: T.tagline.y + 3 * tlh + 4 + (tsz < 30 ? tlh : 0), dw, dh, gap: Math.round(dw * 0.15) };
    lockAt((colR.x0 + colR.x1) / 2, Math.min(C.y1 - 4, T.auto.y + T.auto.h + 12 + lkh));
  } else {
    const flowTop = ins.back ? L.backBox.y + L.backBox.h + 6 : C.y0;
    const avail = C.y1 - lkStrip - flowTop;
    const need = 1009;
    const s = clamp(avail / need, 0.62, 1);
    const slack = Math.max(0, avail - need * s);
    const gapx = Math.min(slack / 7, 40);
    const wd = Math.min(560, w - 80);
    const bx = (w - wd) / 2;
    let y = flowTop + (slack - gapx * 7) / 2 + 4;
    const ts = Math.round(34 * s);
    T.titleSize = ts; T.titleX = w / 2; T.titleY1 = y + ts; T.titleY2 = y + ts * 2 + 8;
    y += 64 * s + 26 * s + gapx;
    const tsz = Math.round(36 * s);
    T.tagline = { x: w / 2, y: y + tsz, w: Math.min(560, w - 100), lh: Math.round(48 * s), size: tsz };
    y += 3 * 48 * s + 30 * s + gapx;
    const dh = Math.round(146 * s), dw = Math.round(96 * s);
    T.tiles = { cx: w / 2, y, dw, dh, gap: Math.round(14 * s) };
    y += dh + 34 * s + gapx;
    const hs = bHs.map((v) => Math.max(btnH, Math.round(v * s)));
    names.forEach((nm, i) => { T[nm] = R(bx, y, wd, hs[i]); y += hs[i] + 20 * s + gapx * 0.4; });
    T.fonts = bFonts.map((f) => Math.round(f * s));
    lockAt(w / 2, Math.min(C.y1 - 4, T.auto.y + T.auto.h + 12 + lkh));
  }

  // ============================================================================ lobby
  const B = L.lobby = {};
  B.menu = R(clearLeft, C.y0, 124, tb);
  if (land) {
    const bwid = Math.min(450, C.w * 0.4);
    B.title = { x: w / 2, y: C.y0 + 48, size: 40 };
    B.record = { x: w / 2, y: C.y0 + 94, size: Math.max(24, minFont) };
    B.choose = { x: w / 2, y: C.y0 + 138, size: 30 };
    const startH = clamp(btnH + 14, 80, 110);
    B.start = R(w / 2 - bwid / 2, C.y1 - startH, bwid, startH);
    const cardTop = C.y0 + 164, cardBottom = B.start.y - 18;
    const cw = Math.min(380, (C.w - 40) / 3), ch = clamp(cardBottom - cardTop, 200, 330);
    const total = 3 * cw + 40, x0 = w / 2 - total / 2, cy = cardTop + (cardBottom - cardTop - ch) / 2;
    B.cards = [0, 1, 2].map((i) => R(x0 + i * (cw + 20), cy, cw, ch));
    B.cardMode = 'row';
  } else {
    const flowTop = Math.max(ins.back ? L.backBox.y + L.backBox.h + 6 : C.y0, C.y0 + tb + 6);
    const startH = clamp(btnH + 30, 90, 130);
    B.start = R(w / 2 - Math.min(225, C.w / 2), C.y1 - startH, Math.min(450, C.w), startH);
    B.title = { x: w / 2, y: flowTop + 44, size: 40 };
    B.record = { x: w / 2, y: flowTop + 92, size: Math.max(24, minFont) };
    B.choose = { x: w / 2, y: flowTop + 148, size: 32 };
    const cardTop = flowTop + 176, cardBottom = B.start.y - 20, gap = 16;
    const ch = clamp((cardBottom - cardTop - 2 * gap) / 3, 150, 270);
    const total = 3 * ch + 2 * gap, y0 = cardTop + Math.max(0, (cardBottom - cardTop - total) / 2);
    const cw = Math.min(560, C.w - 20);
    B.cards = [0, 1, 2].map((i) => R(w / 2 - cw / 2, y0 + i * (ch + gap), cw, ch));
    B.cardMode = 'col';
  }

  // ============================================================================ How to Play / Rules Reference
  const F = L.ref = {};
  F.back = R(clearLeft, C.y0, 124, tb);
  F.inc = R(C.x1 - 100, C.y0, 100, tb);
  F.dec = R(C.x1 - 210, C.y0, 100, tb);
  F.titleX = (F.back.x + F.back.w + F.dec.x) / 2; F.titleW = F.dec.x - (F.back.x + F.back.w) - 20;
  F.titleY = C.y0 + tb / 2 + 8;
  const navH = clamp(btnH, 60, 80);
  const ppw = Math.min(C.w, land ? 1180 : 9999);
  const pty = C.y0 + tb + 10, pbottom = C.y1 - navH - 12;
  F.panel = R(w / 2 - ppw / 2, pty, ppw, pbottom - pty);
  const nbw = Math.min(260, (ppw - 30) / 2);
  F.prev = R(w / 2 - nbw - 15, C.y1 - navH, nbw, navH);
  F.next = R(w / 2 + 15, C.y1 - navH, nbw, navH);
  F.sideIllus = land && ppw >= 900;
  F.titleInY = F.panel.y + 62;
  const illusW = Math.min(440, ppw * 0.38);
  F.illus = { cx: F.sideIllus ? F.panel.x + 30 + illusW / 2 : w / 2, top: F.panel.y + 110, scale: Math.min(1, illusW / 440) };
  if (F.sideIllus) { F.bodyX0 = F.panel.x + illusW + 70; F.bodyX1 = F.panel.x + ppw - 44; F.bodyTopIllus = F.panel.y + 100; }
  else { const bwid = Math.min(ppw - 90, land ? 780 : 560); F.bodyX0 = w / 2 - bwid / 2; F.bodyX1 = w / 2 + bwid / 2; F.bodyTopIllus = F.panel.y + 332; }
  F.bodyTopPlain = F.panel.y + 140;
  F.bodyBottom = F.panel.y + F.panel.h - 14;

  L.demoTop = Math.max(C.y0 + 20, (h - 500) / 2);
  return L;
}
