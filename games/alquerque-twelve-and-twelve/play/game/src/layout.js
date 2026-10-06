// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data, a function of the LIVE screen size.
//
// Kit 1.7 fluid viewport: the SHORT side of the screen is always 720 units and the long side grows with the aspect ratio, so
// `screen` is 720 x 960..1728 in portrait and 960..1728 x 720 in landscape. `setScreen(w, h)` is called every frame by the game
// from `meta`; `layoutFor(w, h)` is cached by size + safe insets, so a frame never recomputes it. Modes:
//   portrait  one column (phones and tablets; the approved phone look at 720 x 1560, compacted when the screen is shorter)
//   wide      landscape / squarish: the board beside (or between) side cards; title art left + menu right; document bars hold the nav
// Keep the top-left clear of the host's floating back button (`host.back`), and everything inside the safe insets.
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit (text never shrinks below ~11 css px)
export const screen = { w: 720, h: 1560 };
export function setScreen(w, h) {
  if (w > 0 && h > 0) { screen.w = Math.round(w); screen.h = Math.round(h); }
}

const R = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}
export const lay = () => layoutFor(screen.w, screen.h);

// Tap zone of the Arcforge lockup: at least 44 x 44 css px, grown sideways/downwards only (never up into the menu).
export const creditHit = (r) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(r.w, m), h = Math.max(r.h, m); return R(r.x + r.w / 2 - w / 2, r.y, w, h); };

export const MENU_NEED = 730;   // height the title menu likes at 100 percent text and density 1.0

function build(w, h, ins) {
  const wide = h < w * 1.12;
  const L = { w, h, wide, land: w >= h, ins, mode: wide ? 'wide' : 'portrait' };
  const backS = ins.back ? Math.max(ins.back, 56) + 8 : 0;
  const bb = L.backBox = ins.back ? R(ins.l, ins.t, backS, backS) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const barH = 76;
  const barY = ins.back ? ins.t + Math.max(12, Math.round((backS - barH) / 2)) : ins.t + 20;
  const barBottom = Math.max(barY + barH, ins.back ? bb.y + bb.h : 0) + 12;
  const xL = ins.back ? ins.l + backS + 8 : ins.l + 16;     // first free x on the top row (after the host back button)
  const xR = U.x1 - 16;
  L.barY = barY; L.barBottom = barBottom; L.xL = xL; L.xR = xR;
  const botPad = Math.max(24, ins.b + 12);
  L.botPad = botPad;

  // ------------------------------------------------------------------------------------------------ document screens
  const zInc = R(xR - 84, barY, 84, barH), zLab = R(zInc.x - 8 - 124, barY, 124, barH), zDec = R(zLab.x - 8 - 84, barY, 84, barH);
  const back = R(xL, barY, 140, barH);
  const midL = back.x + back.w + 24, midR = zDec.x - 16;
  const navInBar = wide && midR - midL >= 330;
  L.bar = { back, zoomDec: zDec, label: zLab, zoomInc: zInc, navInBar };
  const pw = wide ? Math.min(U.w - 48, 900) : U.w - 48;
  const px = Math.round(U.x0 + (U.w - pw) / 2);
  const mkDoc = (bottomY) => {
    const panel = R(px, barBottom, pw, Math.max(200, bottomY - barBottom));
    return { panel, body: R(panel.x + 24, panel.y + 24, panel.w - 48, panel.h - 48) };
  };
  L.doc = mkDoc(h - botPad);                                       // plain document screen
  if (navInBar) {
    // Rules / How to Play: Prev / Next sit in the top bar
    const nw = clamp((midR - midL - 90 - 12) / 2, 100, 150);
    const prev = R(midL, barY, nw, barH), next = R(midR - nw, barY, nw, barH);
    L.nav = { ...mkDoc(h - botPad), prev, next, label: { x: (prev.x + prev.w + next.x) / 2, y: barY + barH / 2 + 9 } };
    const sw = clamp(midR - midL, 160, 360);
    L.start = { ...mkDoc(h - botPad), btn: R((midL + midR) / 2 - sw / 2, barY, sw, barH) };
  } else {
    const ny = h - botPad - 84, nw = Math.min(210, (pw - 16) / 2 - 20);
    L.nav = { ...mkDoc(ny - 16), prev: R(px, ny, nw, 84), next: R(px + pw - nw, ny, nw, 84), label: { x: px + pw / 2, y: ny + 52 } };
    const sy = h - botPad - 96;
    L.start = { ...mkDoc(sy - 16), btn: R(px, sy, pw, 96) };
  }

  // ------------------------------------------------------------------------------------------------ title
  const T = L.title = {};
  const bw = 150, lh = 60;
  if (!wide) {
    const lx = xR - (3 * bw + 16);
    T.lang = [0, 1, 2].map((i) => R(lx + i * (bw + 8), barY + 8, bw, lh));
    const wk = h >= 1300 ? 1 : 0.84;
    const y0 = T.lang[0].y + lh + 16;
    T.cx = (U.x0 + U.x1) / 2; T.maxW = U.w - 40; T.wk = wk;
    T.y = { a: y0 + 100 * wk, b: y0 + 166 * wk, c: y0 + 212 * wk, d: y0 + 246 * wk };
    const yE = y0 + 262 * wk;
    const lockW = Math.min(U.w - 48, Math.max(0.36 * 720, 120 / Math.max(host.px, 1e-6))), lockH = lockW / 3.67, footY = h - Math.max(ins.b, 0) - 14 - lockH;
    T.lock = R(T.cx - lockW / 2, footY, lockW, lockH);
    const menuBottom = footY - 10;
    const A = menuBottom - yE - 24;
    let s = Math.min(380, A - 620 - 20);
    if (s < 220) s = 0;
    T.board = s ? { x: Math.round(T.cx - s / 2), y: Math.round(yE + 4), side: s } : null;
    const menuTop = s ? yE + 4 + s + 26 : yE + 12;
    T.menu = R(U.x0 + 24, menuTop, U.w - 48, menuBottom - menuTop);
    T.glowY = s ? T.board.y + s / 2 : yE + 200;
  } else {
    const Mw = clamp(U.w * 0.38, 400, 560);
    const mx = U.x1 - 16 - Mw;
    const lbw = (Mw - 16) / 3;
    T.lang = [0, 1, 2].map((i) => R(mx + i * (lbw + 8), U.y0 + 12, lbw, 56));
    const lockW = Math.min(Mw, Math.max(0.28 * 720, 120 / Math.max(host.px, 1e-6))), lockH = lockW / 3.67;
    T.lock = R(mx + Mw / 2 - lockW / 2, U.y1 - 12 - lockH, lockW, lockH);
    T.menu = R(mx, U.y0 + 12 + 56 + 14, Mw, T.lock.y - 10 - (U.y0 + 12 + 56 + 14));
    const lx0 = ins.back ? ins.l + backS + 8 : U.x0 + 16, lx1 = mx - 20;
    T.cx = (lx0 + lx1) / 2; T.maxW = lx1 - lx0; T.wk = Math.min(0.9, Math.max(0.62, (U.h - 40) / 700));
    const y0 = U.y0 + 14, wk = T.wk;
    T.y = { a: y0 + 100 * wk, b: y0 + 166 * wk, c: y0 + 212 * wk, d: y0 + 246 * wk };
    const yE = y0 + 262 * wk;
    const s0 = Math.min(560, T.maxW - 30, U.y1 - 12 - yE - 4);
    T.board = s0 >= 190 ? { x: Math.round(T.cx - s0 / 2), y: Math.round(yE + 4), side: Math.round(s0) } : null;
    T.glowY = T.board ? T.board.y + T.board.side / 2 : yE + 120;
  }
  T.dens = clamp(T.menu.h / MENU_NEED, 0.72, 1);
  T.lockOk = true;

  // ------------------------------------------------------------------------------------------------ overlay cards
  L.card = { cx: (U.x0 + U.x1) / 2, cy: (U.y0 + U.y1) / 2, w: Math.min(wide ? 700 : 620, U.w - 32), maxH: Math.min(1180, U.h - 24) };

  // ------------------------------------------------------------------------------------------------ play + Watch & Learn
  const memo = new Map();
  L.play = (scale) => {
    let P = memo.get(scale);
    if (!P) { P = wide ? playWide(L, scale) : playPortrait(L, scale); memo.set(scale, P); }
    return P;
  };
  return L;
}

function playPortrait(L, scale) {
  const { h, U, ins } = L;
  const k = clamp((scale - 1) / 2, 0, 1);
  const barY = L.barY;
  const back = R(L.xL, barY, 84, 78), pause = R(L.xR - 84, barY, 84, 78);
  const title = { cx: (back.x + back.w + pause.x) / 2, y1: barY + 36, y2: barY + 74, w: pause.x - (back.x + back.w) - 24 };
  const gap = 18;
  const maxSide = U.w - 48;
  const top = L.barBottom + 6;
  const bottomEdge = h - Math.max(28, ins.b + 14);
  let chipH = 0, statusH = 0, toolH = 0;
  for (let f = 1; f >= 0.6; f -= 0.04) {
    chipH = Math.round((104 + 70 * k) * f); statusH = Math.round((150 + 150 * k) * f); toolH = Math.round((112 + 74 * k) * f);
    const bottom = bottomEdge - toolH - 18;
    if (Math.min(maxSide, bottom - top - chipH - statusH - gap * 2 - 24) >= Math.min(maxSide, 440)) break;
  }
  const toolY = bottomEdge - toolH, bottom = toolY - 18;
  const side = Math.max(220, Math.min(maxSide, bottom - top - chipH - statusH - gap * 2 - 24));
  const extra = bottom - top - (chipH + side + statusH + gap * 2) - 24;
  statusH += Math.min(120, Math.max(0, Math.round(extra * 0.6)));
  const total = chipH + gap + side + gap + statusH;
  const y0 = Math.round(top + (bottom - top - total) * 0.45);
  const boardY = y0 + chipH + gap, sy = boardY + side + gap;
  const aw = U.w - 48, cw = (aw - 12) / 2, tw = (aw - 32) / 3;
  const x0 = U.x0 + 24;
  const sideW = Math.round((aw - 32) * 0.25), midW = aw - 32 - 2 * sideW;
  const status = R(x0, sy, aw, statusH);
  return {
    back, pause, title, wide: false,
    chips: [R(x0, y0, cw, chipH), R(x0 + cw + 12, y0, cw, chipH)],
    board: { x: Math.round(U.x0 + (U.w - side) / 2), y: boardY, side: Math.round(side) },
    status, statusAuto: status,
    tool: [0, 1, 2].map((i) => R(x0 + i * (tw + 16), toolY, tw, toolH)),
    auto: { slower: R(x0, toolY, sideW, toolH), pause: R(x0 + sideW + 16, toolY, midW, toolH), faster: R(x0 + aw - sideW, toolY, sideW, toolH), labelY: toolY - 22 },
    glowY: boardY + side / 2,
  };
}

function playWide(L, scale) {
  const { U } = L;
  const k = clamp((scale - 1) / 2, 0, 1) * 0.2;
  const pad = 16, g = 14, Cmin = 250;
  const bb = L.backBox;
  const S0 = U.h - 24;
  const availW = U.w - 2 * pad;
  const chipH = Math.round(96 + 50 * k), toolH = Math.round(92 + 40 * k);
  const rowH = 70;
  const out = { wide: true };
  const fill = (items, x, y, wd, gp) => { let yy = y; return items.map((hh) => { const r = R(x, yy, wd, hh); yy += hh + gp; return r; }); };
  if (availW - S0 - 2 * g >= 2 * Cmin) {
    // three columns: left card (chips + status), the board, right card (back + pause, title, buttons)
    const Cw = Math.min(400, (availW - S0 - 2 * g) / 2);
    const total = S0 + 2 * Cw + 2 * g;
    const bx = U.x0 + pad + (availW - total) / 2;
    out.board = { x: Math.round(bx + Cw + g), y: Math.round(U.y0 + (U.h - S0) / 2), side: Math.round(S0) };
    const left = R(bx, U.y0 + 12, Cw, U.h - 24), right = R(out.board.x + S0 + g, U.y0 + 12, Cw, U.h - 24);
    const lt = bb.w && left.x < bb.x + bb.w ? Math.max(left.y, bb.y + bb.h + 6) : left.y;
    out.chips = fill([chipH, chipH], left.x, lt, left.w, 10);
    const sTop = lt + 2 * chipH + 10 + 12;
    out.status = R(left.x, sTop, left.w, left.y + left.h - sTop);
    out.statusAuto = out.status;
    out.back = R(right.x, right.y, 84, rowH); out.pause = R(right.x + right.w - 84, right.y, 84, rowH);
    out.title = { cx: right.x + right.w / 2, y1: right.y + rowH + 40, y2: right.y + rowH + 76, w: right.w };
    const tTop = right.y + rowH + 96, tl = right.y + right.h - tTop;
    const th = clamp((tl - 24) / 3, 70, 128);
    out.tool = [0, 1, 2].map((i) => R(right.x, right.y + right.h - (3 - i) * th - (2 - i) * 12, right.w, th));
    const ph = clamp((tl - 12) / 2, 70, 128);
    out.auto = { pause: R(right.x, right.y + right.h - 2 * ph - 12, right.w, ph), slower: R(right.x, right.y + right.h - ph, (right.w - 12) / 2, ph), faster: R(right.x + (right.w + 12) / 2, right.y + right.h - ph, (right.w - 12) / 2, ph), labelY: 0 };
  } else {
    // two columns: the board on the left (clear of the host back button), one card on the right
    const Rw = clamp(availW * 0.34, 300, 380);
    const shift = bb.w ? bb.w + 8 : 0;
    const SA = Math.min(S0, U.w - shift - 2 * pad - Rw - g);
    const SB = Math.min(S0, availW - Rw - g, bb.w ? U.h - bb.h - 6 - 12 : S0);
    const useShift = SA >= SB;
    const S = Math.max(200, useShift ? SA : SB);
    out.board = { x: Math.round(U.x0 + pad + (useShift ? shift : 0)), y: Math.round(useShift ? U.y0 + (U.h - S) / 2 : U.y1 - 12 - S), side: Math.round(S) };
    const rx = out.board.x + out.board.side + g;
    const right = R(rx, U.y0 + 12, Math.max(260, U.x1 - pad - rx), U.h - 24);
    out.back = R(right.x, right.y, 84, rowH); out.pause = R(right.x + right.w - 84, right.y, 84, rowH);
    out.title = { cx: right.x + right.w / 2, y1: right.y + rowH + 32, y2: right.y + rowH + 60, w: right.w };
    const ch = Math.round(chipH * 0.88);
    const y = right.y + rowH + 72;
    out.chips = fill([ch, ch], right.x, y, right.w, 8);
    const sy = y + 2 * ch + 8 + 10;
    const tH = Math.round(toolH * 0.95), tY = right.y + right.h - tH, tw = (right.w - 24) / 3;
    out.tool = [0, 1, 2].map((i) => R(right.x + i * (tw + 12), tY, tw, tH));
    out.auto = { pause: R(right.x, tY - tH - 10, right.w, tH), slower: R(right.x, tY, (right.w - 12) / 2, tH), faster: R(right.x + (right.w + 12) / 2, tY, (right.w - 12) / 2, tH), labelY: 0 };
    out.status = R(right.x, sy, right.w, Math.max(80, tY - 10 - sy));
    out.statusAuto = R(right.x, sy, right.w, Math.max(80, out.auto.pause.y - 10 - sy));
  }
  out.glowY = out.board.y + out.board.side / 2;
  return out;
}

// ---- entry points for the current screen ----
export const playLayout = (scale) => lay().play(scale);
export const autoLayout = (scale) => lay().play(scale).auto;
