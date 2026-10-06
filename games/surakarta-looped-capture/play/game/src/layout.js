// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data, a function of the LIVE screen size.
// Kit 1.7 fluid viewport: the short side is always 720 virtual units, the long side follows the aspect ratio.
//   tall     portrait phone (h >= 1500): the approved phone look (header, plates, board, status, button bar).
//   compact  portrait, shorter than a phone (tablets, 4:3): the same stack, squeezed so the board keeps its size.
//   wide     landscape (and squarish): a card of plates + status on the left, the board in the middle, a column of buttons on the right.
// `layoutFor(w, h)` is cached by size + host insets, so a frame never recomputes it.
export const SCREEN = { width: 720, height: 1560 };
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54 };   // px: css pixels per virtual unit

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();

export function layoutFor(w = SCREEN.width, h = SCREEN.height) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const mode = w >= h * 0.9 ? 'wide' : h >= 1500 ? 'tall' : 'compact';
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const L = { w, h, mode, wide: mode === 'wide', ins, U, hostBack: backSz > 0, backBox: backSz ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0), _play: {} };
  L.doc = { plain: docFor(L, 'plain'), nav: docFor(L, 'nav'), start: docFor(L, 'start') };
  L.menu = menuFor(L);
  L.overlay = overlayFor(L);
  L.play = (scale, auto) => (L._play[`${scale}|${auto ? 1 : 0}`] ??= playFor(L, scale, auto));
  return L;
}

// ---- document screens (setup, Learn, How to Play, Rules, About, Settings) ----
function docFor(L, kind) {
  const { U, ins } = L;
  const hdrY = U.y0 + (ins.t > 0 ? 10 : 20), hdrH = 76;
  const pw = Math.min(U.w - 48, 1000), px = Math.round(U.x0 + (U.w - pw) / 2);
  const right = px + pw;
  const rowH = kind === 'start' ? 96 : 84, rowY = U.y1 - 16 - rowH;
  const py = hdrY + hdrH + 14;
  const panel = kind === 'plain' ? R(px, py, pw, U.y1 - 16 - py) : R(px, py, pw, rowY - 14 - py);
  const backX = L.hostBack ? U.x0 + L.backBox.w + 8 : px;
  const incX = right - 84, pctX = incX - 140, decX = pctX - 84;
  return {
    panel, body: R(panel.x + 24, panel.y + 24, panel.w - 48, panel.h - 48),
    back: R(backX, hdrY, 140, hdrH), dec: R(decX, hdrY, 84, hdrH), pct: R(pctX, hdrY, 140, hdrH), inc: R(incX, hdrY, 84, hdrH),
    prev: R(px, rowY, 210, rowH), next: R(right - 210, rowY, 210, rowH), start: R(px, rowY, pw, rowH),
    counterX: px + pw / 2, counterY: rowY + rowH / 2 + 10, imgK: L.wide ? 0.5 : 1,
  };
}

// ---- title screen: hero (attract board) transform, the button region, the credit line ----
// Tap zone of the title lockup (>= 44 css px each way; sideways and downward only, never into the menu above).
export function lockHit(L) {
  const c = L.menu.lock, m = 44 / Math.max(0.05, host.px), w = Math.max(c.w, m), y = c.y - 2;
  return R(c.x + c.w / 2 - w / 2, y, w, Math.max(c.h + 2, Math.min(m, L.h - y)));
}
function menuFor(L) {
  const { w, h, U } = L;
  const credit = { y: U.y1 - 16 };
  const lockAt = (cx, maxW) => { const lw = Math.min(260, maxW), lh = lw * 327 / 1200; return R(cx - lw / 2, U.y1 - 8 - lh, lw, lh); };
  const regBottom = (lk) => lk.y - 8;
  if (L.mode === 'tall') {
    const oy = Math.max(0, (h - 1560) / 2), top = 760 + oy;
    const lock = lockAt(w / 2, U.w - 80);
    return { k: 1, hero: { sc: 1, tx: 0, ty: oy }, region: R(U.x0 + 24, top, U.w - 48, regBottom(lock) - top), credit: { ...credit, x: w / 2, maxW: w - 40 }, lock };
  }
  if (L.mode === 'compact') {
    const lock = lockAt(w / 2, U.w - 80), rh = clamp(h * 0.54, 500, 660), top = regBottom(lock) - rh;
    const zoneH = top - U.y0 - 4, sc = clamp(zoneH / 700, 0.4, 1);
    return { k: 0.78, hero: { sc, tx: (w - 720 * sc) / 2, ty: U.y0 + 2 - 100 * sc + (zoneH - 700 * sc) / 2 }, region: R(U.x0 + 24, top, U.w - 48, rh), credit: { ...credit, x: w / 2, maxW: w - 40 }, lock };
  }
  const mw = clamp(U.w * 0.42, 400, 560), rx = U.x1 - mw - 20, zoneW = rx - U.x0 - 12, zoneH = U.h - 56;
  const sc = clamp(Math.min(zoneW / 720, zoneH / 700), 0.35, 1.15), cxz = U.x0 + zoneW / 2, lock = lockAt(rx + mw / 2, mw - 40);
  return {
    k: U.h < 640 ? 0.66 : 0.74, hero: { sc, tx: cxz - 360 * sc, ty: U.y0 + 4 + (zoneH - 700 * sc) / 2 - 100 * sc },
    region: R(rx, U.y0 + 10, mw, regBottom(lock) - U.y0 - 10), credit: { ...credit, x: cxz, maxW: zoneW }, lock,
  };
}

// ---- overlays (pause, result, lesson, Watch & Learn summary, demo card) ----
function overlayFor(L) {
  const { U } = L;
  return { w: Math.min(L.wide ? 760 : 620, U.w - 32), cx: (U.x0 + U.x1) / 2, cy: (U.y0 + U.y1) / 2, maxH: Math.min(1180, U.h - 24), kc: U.h < 900 ? 0.76 : 1 };
}

// ---- play and Watch & Learn ----
// Returns { buttons: [{ id, rect }], chips, board, status, title, sub } for one text-zoom step.
// Button ids: back (top-left, only without a host back button), pause (top-right), menu / undo / think / threats (bar or column),
// exit / slower / apause / faster (Watch & Learn).
function playFor(L, scale, auto) {
  const { w, h, U, ins } = L;
  const k = Math.max(0, Math.min(1, (scale - 1) / 2));
  const chipH0 = Math.round(104 + 70 * k), statusH0 = Math.round(150 + 150 * k), toolH0 = Math.round(112 + 74 * k);
  const P = { mode: L.mode, auto: Boolean(auto), buttons: [] };
  const add = (id, rect) => P.buttons.push({ id, rect });

  if (L.mode !== 'wide') {
    const hdrTop = U.y0 + (ins.t > 0 ? 12 : 22), top = hdrTop + 94, gap = 18;
    const x0 = U.x0 + 24, fw = U.w - 48;
    // squeeze the plates / status / bar on short screens so the board keeps at least 330 units
    const fixed = top + 28 + 18 + 36 + 24 + (h - U.y1), need = chipH0 + statusH0 + toolH0;
    const f = clamp((h - fixed - 330) / need, 0.55, 1);
    const chipH = Math.round(chipH0 * f), statusH = Math.round(statusH0 * f), toolH = Math.round(toolH0 * f);
    const toolY = U.y1 - 28 - toolH, bottom = toolY - 18;
    const side = Math.max(300, Math.min(U.w - 24, bottom - top - chipH - statusH - gap * 2 - 24));
    const total = chipH + gap + side + gap + statusH;
    const y0 = Math.round(top + (bottom - top - total) * 0.4), boardY = y0 + chipH + gap;
    const cw = (fw - 12) / 2;
    P.chips = [R(x0, y0, cw, chipH), R(x0 + cw + 12, y0, cw, chipH)];
    P.board = { x: Math.round(U.x0 + (U.w - side) / 2), y: boardY, side };
    P.status = R(x0, boardY + side + gap, fw, statusH);
    const hostBack = L.hostBack;
    let titleL = U.x0 + 16, titleR = U.x1 - 16;
    if (!hostBack) { const b = R(U.x0 + 16, hdrTop, 84, 78); add(auto ? 'exit' : 'back', b); titleL = b.x + b.w + 12; }
    else titleL = L.backBox.x + L.backBox.w + 4;
    if (!auto) { const pb = R(U.x1 - 100, hdrTop, 84, 78); add('pause', pb); titleR = pb.x - 12; }
    const half = Math.min(w / 2 - titleL, titleR - w / 2), tw = Math.max(200, half * 2);
    P.title = { cx: w / 2, y: hdrTop + 36, maxW: tw };
    P.sub = { cx: w / 2, y: hdrTop + 74, maxW: tw, lines: 1, shift: 14 };
    const ids = auto ? (hostBack ? ['exit', 'slower', 'apause', 'faster'] : ['slower', 'apause', 'faster']) : (hostBack ? ['menu', 'undo', 'think', 'threats'] : ['undo', 'think', 'threats']);
    const n = ids.length, g2 = 12;
    const ws = auto && !hostBack ? [160, 320, 160] : auto ? [0.22, 0.22, 0.34, 0.22].map((q) => q * (fw - 36)) : ids.map(() => (fw - g2 * (n - 1)) / n);
    const sum = ws.reduce((a, b) => a + b, 0) + g2 * (n - 1);
    let x = x0 + (fw - sum) / 2;
    ids.forEach((id, i) => { add(id, R(x, toolY, ws[i], toolH)); x += ws[i] + g2; });
    return P;
  }

  // ---- wide ----
  const m = 14, top = U.y0 + m, bottom = U.y1 - m, H = bottom - top;
  const Lmin = 250, Rmin = 200;
  const side = Math.max(240, Math.min(H, U.w - Lmin - Rmin - 4 * m));
  let Lw = Lmin, Rw = Rmin;
  const extra = U.w - 4 * m - side - Lw - Rw;
  if (extra > 0) { Lw = Math.min(Lw + extra * 0.55, 420); Rw = Math.min(Rw + extra * 0.45, 320); }
  const used = Lw + Rw + side + 2 * m, gx = U.x0 + (U.w - used) / 2, bx = gx + Lw + m, rx = bx + side + m;
  P.board = { x: Math.round(bx), y: Math.round(top + (H - side) / 2), side };
  const clearBack = L.hostBack && gx < L.backBox.x + L.backBox.w + 4;
  const ly0 = clearBack ? Math.max(top, L.backBox.y + L.backBox.h + 4) : top;
  P.title = { cx: gx + Lw / 2, y: ly0 + 34, maxW: Lw - 12 };
  P.sub = { cx: gx + Lw / 2, y: ly0 + 64, maxW: Lw - 12, lines: 2, shift: 0 };
  const chipTop = ly0 + 100, minStatus = 150, gapC = 10;
  const chipH = Math.max(80, Math.min(chipH0, Math.floor((bottom - chipTop - gapC * 2 - minStatus) / 2)));
  P.chips = [R(gx, chipTop, Lw, chipH), R(gx, chipTop + chipH + gapC, Lw, chipH)];
  const sy = chipTop + 2 * chipH + 2 * gapC;
  P.status = R(gx, sy, Lw, Math.max(120, bottom - sy));
  const ids = auto ? ['exit', 'apause', 'slower', 'faster'] : ['menu', 'pause', 'undo', 'think', 'threats'];
  const n = ids.length, g = 12, bh = clamp(Math.floor((H - g * (n - 1)) / n), 56, toolH0);
  const sy0 = top + (H - (n * bh + g * (n - 1))) / 2;
  ids.forEach((id, i) => add(id, R(rx, sy0 + i * (bh + g), Rw, bh)));
  return P;
}

export const btnRect = (P, id) => P.buttons.find((b) => b.id === id)?.rect ?? null;
