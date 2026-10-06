// Screen rectangles shared by drawing (view.js), screens (screens.js) and hit-testing (game.js). Pure data, a function of the LIVE screen size.
// Kit 1.7.1 fluid viewport: the short side is always 720 units, the long side follows the aspect (cap 2.4:1). `setScreen(w, h)` is called every
// frame from game.js; every builder below is cached by size + insets + text zoom, so a frame never recomputes it.
// Shapes:
//   stack  portrait (and squarish) screens: header, seats, table, dice panel, controls from top to bottom. Tall phones (h >= 1500) keep the
//          approved phone look; shorter screens (tablets, small phones) squeeze the bands so the table keeps room.
//   cols   landscape (w >= 1.25 h): seats down the left, table + your dice in the middle, controls in a card on the right.
// The play HUD follows the text-zoom step (1 to 3).
export const SCREEN = { width: 720, height: 1560 };
export const scr = { w: 720, h: 1560 };
export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const R = (x, y, w, h) => ({ x, y, w, h });

// Safe areas and the host's floating back button, in virtual units (browsers and standalone apps: all zero). main.js keeps this current.
// px = css pixels per virtual unit (text never shrinks below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export function setScreen(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1560;
  scr.w = w; scr.h = h; SCREEN.width = w; SCREEN.height = h;
}

const cache = new Map();
const memo = (name, extra, fn) => {
  const key = `${name}|${scr.w}x${scr.h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${Math.round(host.px * 100)}|${extra}`;
  let v = cache.get(key);
  if (!v) { v = fn(); cache.set(key, v); if (cache.size > 300) cache.delete(cache.keys().next().value); }
  return v;
};

// ---------------------------------------------------------------------------------------------------------------- frame
export function frame() {
  return memo('F', '', () => {
    const w = scr.w, h = scr.h;
    const U = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b };
    U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
    const cols = w >= h * 1.25;
    const tall = !cols && h >= 1500;
    const backOff = host.back ? Math.max(host.back, 56) + 8 : 0;      // keep the host's floating back button clear
    const hy = U.y0 + (cols ? 10 : U.y0 === 0 ? (tall ? 22 : 14) : 12);
    const padB = tall ? 26 : cols ? 14 : 20;
    return { w, h, U, cols, tall, hy, hl: U.x0 + 16 + backOff, hr: U.x1 - 16, backOff, padB };
  });
}

// ---------------------------------------------------------------------------------------------------------------- play HUD
export function hud() {
  return memo('H', '', () => {
    const F = frame();
    const back = R(F.hl, F.hy, 84, 78), pause = R(F.hr - 84, F.hy, 84, 78);
    const x0 = back.x + back.w + 12, x1 = pause.x - 12;
    return { back, pause, titleCx: (x0 + x1) / 2, titleMaxW: Math.min(480, x1 - x0), titleY: F.hy + 36, subY: F.hy + 74 };
  });
}

// Seat card row widths (stack): 3 across at 216, 2 at 330, 1 at 420 (of a 672 column).
function stackSeats(x0, cw, n, seatsY, seatH) {
  const gap = 10, seats = [];
  const w3 = (cw - 24) / 3, w2 = (cw - 12) / 2, w1 = Math.min(420, cw);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / 3), c = i % 3;
    const inRow = Math.min(3, n - r * 3);
    const w = inRow === 3 ? w3 : inRow === 2 ? w2 : w1;
    const rowW = w * inRow + 12 * (inRow - 1);
    seats.push(R(Math.round(x0 + (cw - rowW) / 2 + c * (w + 12)), seatsY + r * (seatH + gap), w, seatH));
  }
  return seats;
}

// nSeats = how many seat cards are shown around the table (everyone but the player at the bottom).
export function playLayout(scale, nSeats = 3) {
  return memo('P', `${scale}|${nSeats}`, () => (frame().cols ? playCols(scale, nSeats) : playStack(scale, nSeats)));
}

function playStack(scale, n) {
  const F = frame(), { U } = F, k = clamp((scale - 1) / 2, 0, 1);
  const cw = Math.min(U.w - 48, 672), x0 = Math.round(U.x0 + (U.w - cw) / 2), s = cw / 672;
  const q = clamp((F.h - 960) / (1500 - 960), 0, 1), sm = clamp((F.h - 720) / 240, 0, 1);   // sm: squat screens (< 960 tall) squeeze further
  const lv = (a, b, c) => (F.h < 960 ? lerp(a, b, sm) : lerp(b, c, q));
  const H = hud();
  const seatsY = F.hy + 90, rows = Math.max(1, Math.ceil(n / 3));
  let kk = k, L;
  for (;;) {
    const seatH = Math.round(lv(72, 100, 124) + 52 * kk), seatsH = rows * seatH + (rows - 1) * 10;
    const faceH = Math.round(lv(52, 64, 88) + 30 * kk), stepH = Math.round(lv(56, 70, 96) + 34 * kk), actH = Math.round(lv(60, 80, 104) + 50 * kk), cg = Math.round(lv(6, 8, 10));
    const diceH = Math.round(lv(96, 124, 146) + 34 * kk);
    const ctrlTop = U.y1 - F.padB - (faceH + stepH + actH + cg * 2);
    const diceY = ctrlTop - 12 - diceH, tableY = seatsY + seatsH + 12;
    L = { seatH, seatsH, faceH, stepH, actH, cg, diceH, ctrlTop, diceY, tableY, tableH: diceY - 10 - tableY };
    if (L.tableH >= (F.h < 960 ? 130 : 250) || kk <= 0) break;
    kk = Math.max(0, kk - 0.15);
  }
  const { seatH, seatsH, faceH, stepH, actH, cg, diceH, ctrlTop, diceY, tableY } = L;
  const seats = stackSeats(x0, cw, n, seatsY, seatH);
  const table = R(x0, tableY, cw, Math.max(60, L.tableH));
  const face = [0, 1, 2, 3, 4, 5].map((i) => R(x0 + i * (cw / 6), ctrlTop, cw / 6 - 8, faceH));
  const sy = ctrlTop + faceH + cg, X = (v) => x0 + (v - 24) * s;
  const minus = R(X(24), sy, 112 * s, stepH), qty = R(X(144), sy, 124 * s, stepH), plus = R(X(276), sy, 112 * s, stepH), bid = R(X(396), sy, 300 * s, stepH);
  const ay = sy + stepH + cg, aw = (cw - 24) / 3;
  const dudo = R(x0, ay, aw, actH), calzo = R(x0 + aw + 12, ay, aw, actH), think = R(x0 + 2 * (aw + 12), ay, aw, actH);
  const wide = R(x0, sy, cw, stepH + cg + actH);
  const nextH = F.tall ? 120 : F.h < 960 ? 76 : 100, hoW = Math.min(528, cw - 48), hoH = Math.round(clamp(table.h * 0.25, 60, 104));
  const T = R(x0, F.hy + 90, cw, U.y1 - F.padB - (F.hy + 90));
  const statusH = T.h >= 900 ? 200 : F.h < 960 ? 90 : 150;
  const next = R(x0 + 24, U.y1 - (F.tall ? 40 : 28) - nextH, cw - 48, nextH);
  const rev = { T, status: R(T.x + 16, next.y - 28 - statusH, T.w - 32, statusH), next, rowsTop: T.y + 120, rowsBottom: next.y - 28 - statusH - 12 };
  return {
    mode: 'stack', hud: H, seats, seatsH, table, dice: R(x0, diceY, cw, diceH), face, minus, qty, plus, bid, dudo, calzo, think, wide, k: kk, next,
    handoff: R(table.x + (table.w - hoW) / 2, table.y + table.h - hoH - 26, hoW, hoH), rev, ctrl: R(x0, ctrlTop, cw, U.y1 - F.padB - ctrlTop),
  };
}

function playCols(scale, n) {
  const F = frame(), { U } = F, k = clamp((scale - 1) / 2, 0, 1);
  const H = hud();
  const top = F.hy + 78 + 10, bottom = U.y1 - F.padB, colH = bottom - top;
  const CW = Math.min(U.w - 32, 1560), X0 = Math.round(U.x0 + (U.w - CW) / 2), gap = 14;
  const sw = Math.round(clamp(CW * 0.25, 236, 330)), rw = Math.round(clamp(CW * 0.3, 300, 430)), mw = CW - sw - rw - 2 * gap;
  const xM = X0 + sw + gap, xR = xM + mw + gap;
  const seatH = Math.round(Math.min(124 + 52 * k, (colH - (n - 1) * 10) / n));
  const sTotal = n * seatH + (n - 1) * 10, sTop = Math.round(top + Math.max(0, (colH - sTotal) / 2));
  const seats = Array.from({ length: n }, (_, i) => R(X0, sTop + i * (seatH + 10), sw, seatH));
  const diceH = Math.round(Math.min(150 + 34 * k, colH * 0.32));
  const table = R(xM, top, mw, colH - diceH - 10);
  const dice = R(xM, bottom - diceH, mw, diceH);
  // controls card: faces 3 x 2, stepper, bid + think, dudo + calzo; stretched to the column height
  const fh0 = 76 + 14 * k, sh0 = 80 + 14 * k, bh0 = 88 + 14 * k, ah0 = 98 + 24 * k, g = 10;
  const need = 2 * fh0 + g + g + sh0 + g + bh0 + g + ah0;
  const f = clamp(colH / need, 0.8, 1.35), fh = fh0 * f, sh = sh0 * f, bh = bh0 * f, ah = ah0 * f;
  let y = top + Math.max(0, (colH - need * f) / 2);
  const fw = (rw - 16) / 3;
  const face = [0, 1, 2, 3, 4, 5].map((i) => R(xR + (i % 3) * (fw + 8), y + Math.floor(i / 3) * (fh + g), fw, fh));
  y += 2 * fh + g + g;
  const u = rw - 16, minus = R(xR, y, u * 0.27, sh), qty = R(xR + u * 0.27 + 8, y, u * 0.46, sh), plus = R(xR + u * 0.73 + 16, y, u * 0.27, sh);
  y += sh + g;
  const bid = R(xR, y, (rw - 8) * 0.62, bh), think = R(xR + bid.w + 8, y, rw - bid.w - 8, bh);
  y += bh + g;
  const dudo = R(xR, y, (rw - 10) / 2, ah), calzo = R(xR + dudo.w + 10, y, dudo.w, ah);
  const nextH = 110, hoW = Math.min(528, table.w - 32);
  const T = R(X0, top, xR - gap - X0, colH);
  const rev = { T, status: R(xR, top, rw, colH - nextH - 14), next: R(xR, bottom - nextH, rw, nextH), rowsTop: T.y + 120, rowsBottom: T.y + T.h - 14 };
  return {
    mode: 'cols', hud: H, seats, seatsH: sTotal, table, dice, face, minus, qty, plus, bid, dudo, calzo, think, wide: R(xR, minus.y, rw, ah + sh + g), k, next: rev.next,
    handoff: R(table.x + (table.w - hoW) / 2, table.y + table.h - 120, hoW, 100), rev, ctrl: R(xR, top, rw, colH),
  };
}

export function autoLayout(scale, nSeats) {
  return memo('A', `${scale}|${nSeats}`, () => {
    const L = playLayout(scale, nSeats), F = frame(), k = L.k;
    if (L.mode === 'cols') {
      const r = L.ctrl, sh = Math.round(84 + 10 * k), ph = Math.round(100 + 10 * k), bottom = r.y + r.h;
      const slower = R(r.x, bottom - sh, (r.w - 10) / 2, sh), faster = R(r.x + slower.w + 10, bottom - sh, slower.w, sh);
      const pause = R(r.x, slower.y - 10 - ph, r.w, ph);
      return { slower, pause, faster, labelY: pause.y - 22, status: R(r.x, r.y, r.w, pause.y - 14 - r.y), L };
    }
    const h = Math.round((F.h < 960 ? 76 : lerp(96, 112, clamp((F.h - 960) / 540, 0, 1))) + 74 * k), y = F.U.y1 - (F.tall ? 28 : 18) - h;
    const x0 = L.ctrl.x, cw = L.ctrl.w, s = cw / 672;
    return { slower: R(x0, y, 160 * s, h), pause: R(x0 + 176 * s, y, 320 * s, h), faster: R(x0 + 512 * s, y, 160 * s, h), labelY: y - 22, status: R(x0, L.face[0].y, cw, y - 30 - L.face[0].y), L };
  });
}

// ---------------------------------------------------------------------------------------------------------------- document screens
// kind: 'plain' (back + zoom), 'nav' (Rules / How to Play: Prev / Next), 'start' (Setup: a Start button under the panel).
export function docRects(kind = 'plain') {
  return memo('D', kind, () => {
    const F = frame(), { U } = F;
    const hy = F.hy - 2, hh = 76;
    const back = R(F.hl, hy, 140, hh), inc = R(F.hr - 84, hy, 84, hh), pct = R(inc.x - 140, hy, 140, hh), dec = R(pct.x - 84, hy, 84, hh);
    const pw = F.cols ? Math.min(U.w - 48, 1100) : Math.min(U.w - 48, 672), px = Math.round(U.x0 + (U.w - pw) / 2);
    const top = F.hy + 90;
    const out = { back, dec, pct, inc };
    const navInHeader = kind === 'nav' && U.w >= 1100;
    let bottom = U.y1 - 26;
    if (kind === 'nav') {
      if (navInHeader) {
        out.prev = R(back.x + back.w + 16, hy, 170, hh); out.next = R(out.prev.x + 170 + 150, hy, 170, hh);
        out.navLabel = { x: out.prev.x + 170 + 75, y: hy + hh / 2 + 9 };
      } else {
        const navY = U.y1 - F.padB - 84;
        out.prev = R(px, navY, Math.min(210, pw * 0.3), 84); out.next = R(px + pw - out.prev.w, navY, out.prev.w, 84);
        out.navLabel = { x: px + pw / 2, y: navY + 52 };
        bottom = navY - 16;
      }
    } else if (kind === 'start') {
      out.start = R(px, U.y1 - F.padB - 96, pw, 96);
      bottom = out.start.y - 12;
    }
    out.panel = R(px, top, pw, Math.max(120, bottom - top));
    out.body = R(px + 24, top + 24, pw - 48, out.panel.h - 48);
    return out;
  });
}

// The Arcforge lockup size on the title (>= ~125 css px wide, aspect 1200:327) and the strip reserved for it under the menu.
export function lockupSize() { const w = Math.max(260, 125 / Math.max(0.2, host.px || 0.6)); return { w, h: Math.round(w * 327 / 1200), strip: Math.round(w * 327 / 1200) + 22 }; }

// The title menu column + the art area (the attract scene and the Arcforge lockup).
export function menuArea() {
  return memo('M', '', () => {
    const F = frame(), { U } = F;
    if (F.cols) {
      const mw = Math.round(clamp(U.w * 0.42, 420, 600)), x = U.x1 - 24 - mw;
      return { cols: true, x, w: mw, top: U.y0 + 14, bottom: U.y1 - 14 - lockupSize().strip, minTop: U.y0 + 14, art: R(U.x0 + 16, U.y0 + 10, x - 32 - U.x0, U.h - 20) };
    }
    const w = Math.min(U.w - 48, 672);
    return { cols: false, x: Math.round(U.x0 + (U.w - w) / 2), w, top: 0, bottom: U.y1 - 28 - lockupSize().strip, minTop: U.y0 + 340, art: null };
  });
}

// The result / pause / demo cards: centred, never wider than the screen, never taller than it.
export function overlayRect() {
  return memo('O', '', () => {
    const F = frame(), { U } = F;
    const w = Math.min(620, U.w - 40), h = Math.min(1060, U.h - 40);
    return R(Math.round(U.x0 + (U.w - w) / 2), Math.round(U.y0 + (U.h - h) / 2), w, h);
  });
}
export const overlayMaxH = () => Math.min(1180, frame().U.h - 40);
export const overlayCy = () => { const U = frame().U; return U.y0 + U.h / 2; };
