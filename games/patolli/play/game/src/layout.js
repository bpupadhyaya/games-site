// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size, cached by size + insets. Two play shapes:
//   stack  portrait: bar, players strip, the board, then narrator and actions (side by side when the screen is squat, like a tablet).
//   side   landscape: the board on the left, and a right-hand column (or two columns on wide phones) for players, narrator and actions.
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));  // a thumb-sized height in units

const cache = new Map();
export const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

function build(w, h) {
  const land = w > h;
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, land, S, mb, backPad, mode: land ? 'side' : 'stack' };

  // ---- PLAY ------------------------------------------------------------------------------------------------------------------------
  {
    const P = {};
    const bh = Math.max(60, mb), gap = 10, pad = 10;
    if (!land) {
      const barY = S.y + 6;
      const playersH = 86;
      const top = barY + bh + 6;
      const stackNeed = 330, twoNeed = 310;
      const free = (need) => Math.min(S.w - pad * 2, S.y + S.h - top - playersH - gap - need);
      const bsStack = free(stackNeed), bsTwo = free(twoNeed);
      const rowNeed = 236, bsRow = free(rowNeed);                 // squat portrait: narrator strip over a wide actions row
      const two = S.w >= 560 && bsTwo > bsStack * 1.1;
      const row = S.w >= 560 && bsRow > Math.max(bsStack, bsTwo) * 1.08;
      const bs = Math.max(240, row ? bsRow : two ? bsTwo : bsStack);
      P.two = two && !row;
      P.bar = R(S.x + pad, barY, S.w - pad * 2, bh);
      P.menu = R(S.x + pad + backPad, barY, Math.max(bh * 1.6, 120), bh);
      P.pause = R(S.x + S.w - pad - bh, barY, bh, bh);
      P.hint = R(P.pause.x - 10 - bh, barY, bh, bh);
      P.players = R(S.x + pad, top, S.w - pad * 2, playersH);
      P.board = R(S.x + (S.w - bs) / 2, top + playersH + gap, bs, bs);
      const by = P.board.y + bs + gap, bottom = S.y + S.h - pad;
      if (row) {
        const nh = 62;
        P.narrator = R(S.x + pad, by, S.w - pad * 2, nh);
        P.actions = R(S.x + pad, by + nh + gap, S.w - pad * 2, bottom - by - nh - gap);
      } else if (two) {
        const half = (S.w - pad * 2 - gap) / 2;
        P.narrator = R(S.x + pad, by, half, bottom - by);
        P.actions = R(S.x + pad + half + gap, by, half, bottom - by);
      } else {
        const nh = clamp((bottom - by) * 0.26, 110, 170);
        P.narrator = R(S.x + pad, by, S.w - pad * 2, nh);
        P.actions = R(S.x + pad, by + nh + gap, S.w - pad * 2, bottom - by - nh - gap);
      }
    } else {
      const bs = Math.max(260, Math.min(S.h - pad * 2, S.w * (S.w / S.h < 1.45 ? 0.655 : 0.62)));
      const bx = S.x + pad + (S.w * 0.0), by = S.y + (S.h - bs) / 2;
      P.board = R(bx, by, bs, bs);
      const cx = bx + bs + gap, cw = S.x + S.w - pad - cx;
      const barY = S.y + 6;
      P.menu = R(cx + (cw > 700 ? 0 : 0), barY, Math.max(bh * 1.6, 120), bh);
      P.pause = R(S.x + S.w - pad - bh, barY, bh, bh);
      P.hint = R(P.pause.x - 10 - bh, barY, bh, bh);
      P.bar = R(cx, barY, cw, bh);
      const top = barY + bh + 6, bottom = S.y + S.h - pad;
      if (cw >= 640) {
        const aw = Math.min(380, cw * 0.46), lw = cw - aw - gap;
        const pl = clamp(Math.floor((bottom - top) * 0.5), 150, 330);
        P.players = R(cx, top, lw, pl);
        P.narrator = R(cx, top + pl + gap, lw, bottom - top - pl - gap);
        P.actions = R(cx + lw + gap, top, aw, bottom - top);
      } else {
        const rows = 3;
        const pl = clamp(Math.floor((bottom - top) * 0.3), 120, 190);
        const nh = clamp(Math.floor((bottom - top) * 0.2), 96, 150);
        void rows;
        P.players = R(cx, top, cw, pl);
        P.narrator = R(cx, top + pl + gap, cw, nh);
        P.actions = R(cx, top + pl + nh + gap * 2, cw, bottom - (top + pl + nh + gap * 2));
      }
      P.two = false;
    }
    L.play = P;
  }

  // ---- TITLE -----------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1000 ? 70 : 84, mb);
    if (land) {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW;
      const sh = Math.max(60, mb);
      const total = bh + 16 + 12 + bh + 12 + (sh + 12) * 2;
      const y0 = S.y + Math.max(20, (S.h - total - 30) / 2);
      T.size = Math.min(92, (colX - S.x - 60) / 7.4);
      T.titleY = S.y + Math.max(52, S.h * 0.13);
      T.hero = R(S.x + 16, T.titleY + T.size * 0.95, colX - S.x - 40, S.y + S.h - 50 - (T.titleY + T.size * 0.95));
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
      T.titleX = S.x + (colX - S.x) / 2;
    } else {
      const bw = Math.min(S.w - 64, 560), bx = S.x + (S.w - bw) / 2, sh = Math.max(S.h < 1200 ? 60 : 66, mb);
      const total = bh + 16 + 12 + bh + 12 + (sh + 12) * 2;
      const bottom = S.y + S.h - 70;
      let y = bottom - total;
      T.size = Math.min(100, (S.w - 40) / 8.4);
      T.titleY = S.y + Math.max(70, (y - S.y) * 0.1);
      T.hero = R(S.x + 10, T.titleY + T.size * 1.35, S.w - 20, y - 10 - (T.titleY + T.size * 1.35));
      T.play = R(bx, y, bw, bh + 16); y += bh + 16 + 12;
      T.auto = R(bx, y, bw, bh); y += bh + 12;
      const hw = (bw - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 12 };
      T.titleX = S.x + S.w / 2;
    }
    L.title = T;
  }

  // ---- SETUP (seats and variants) -------------------------------------------------------------------------------------------------
  {
    const U = {};
    const bh = Math.max(60, mb);
    U.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), bh);
    U.titleY = S.y + 12 + bh / 2;
    const top = S.y + 12 + bh + 20, bottom = S.y + S.h - 16;
    const startH = Math.max(84, mb);
    if (land && S.w >= 900) {
      const colW = (S.w - 48 - 24) / 2;
      U.seats = R(S.x + 24, top + 34, colW, bottom - top - 34);
      U.varArea = R(S.x + 24 + colW + 24, top + 34, colW, bottom - top - 34 - startH - 14);
      U.start = R(U.varArea.x, bottom - startH, colW, startH);
      U.cols = 2;
    } else {
      const seatsH = Math.min(250, (bottom - top) * 0.3);
      U.seats = R(S.x + 24, top + 34, S.w - 48, seatsH);
      U.start = R(S.x + 24, bottom - startH, S.w - 48, startH);
      U.varArea = R(S.x + 24, U.seats.y + U.seats.h + 44, S.w - 48, U.start.y - 14 - (U.seats.y + U.seats.h + 44));
      U.cols = land ? 3 : 2;
    }
    // seat cards: 4 in a grid
    const cols = land && S.w >= 900 ? 2 : 2, rows = Math.ceil(4 / cols), gx = 10, gy = 10;
    const cw = (U.seats.w - gx * (cols - 1)) / cols, ch = Math.min(120, (U.seats.h - gy * (rows - 1)) / rows);
    U.seatCards = [];
    for (let i = 0; i < 4; i++) U.seatCards.push(R(U.seats.x + (i % cols) * (cw + gx), U.seats.y + Math.floor(i / cols) * (ch + gy), cw, ch));
    // variant rows
    const vh = Math.min(150, Math.max(70, (U.varArea.h - 20) / 3));
    U.varRows = [0, 1, 2].map((i) => R(U.varArea.x, U.varArea.y + i * (vh + 10), U.varArea.w, vh));
    L.setup = U;
  }

  // ---- RESULT ---------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(76, mb);
    const pw = Math.min(S.w - 32, land ? 980 : 660), ph = Math.min(S.h - 84, land ? 640 : 1200);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (land) {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 28 - bh, bwid, bh); Rr.setup = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.setup.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h + 30 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 44 - bh, bwid, bh); Rr.setup = R(p.x + 32, Rr.menu.y - 12 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.setup.y - 12 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h + 30 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings) ---------------------------------------------------------------
  {
    const Dc = {};
    const bh = Math.max(64, mb), margin = land ? Math.max(24, S.w * 0.06) : 16;
    const contentW = Math.min(S.w - margin * 2, land ? 1100 : 820);
    const cx = S.x + (S.w - contentW) / 2;
    Dc.back = R(S.x + 12 + backPad, S.y + 12, Math.max(110, mb * 1.6), bh);
    const decW = Math.max(64, mb);
    Dc.textInc = R(S.x + S.w - 12 - decW, S.y + 12, decW, bh);
    Dc.textDec = R(Dc.textInc.x - 10 - decW, S.y + 12, decW, bh);
    Dc.headerH = bh + 24;
    const navH = bh;
    Dc.nav = { back: R(cx, S.y + S.h - 14 - navH, (contentW - 12) / 2, navH), next: R(cx + (contentW - 12) / 2 + 12, S.y + S.h - 14 - navH, (contentW - 12) / 2, navH) };
    Dc.viewport = R(cx, S.y + Dc.headerH + 56, contentW, S.y + S.h - 14 - navH - 12 - (S.y + Dc.headerH + 56));
    Dc.titleY = S.y + 12 + bh / 2;
    Dc.contentW = contentW;
    L.doc = Dc;
  }
  return L;
}

// Rects for a small centred menu of n buttons (pause menu): { panel, btns[] }.
export function menuRects(L, n, extraTop = 120) {
  const S = L.S, bh = Math.max(76, L.mb), gap = 12, pw = Math.min(S.w - 40, 560), ph = extraTop + n * bh + (n - 1) * gap + 36;
  const panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph), btns = [];
  for (let i = 0; i < n; i++) btns.push(R(panel.x + 28, panel.y + extraTop + i * (bh + gap), pw - 56, bh));
  return { panel, btns };
}

// Inside the actions panel: five beans on top and n buttons below. Returns { beans: [5 rects], size, btns[] }.
export function actionRects(L, n) {
  const A = L.play.actions, pad = 10, mb = L.mb;
  const nb = Math.max(1, n), gap = 8;
  const maxBtn = Math.max(66, mb) + 14;
  const wide = A.w >= 520 && A.h < 260;                      // squat panel: beans on the left, buttons on the right
  if (wide) {
    const bw = clamp(Math.min((A.h - pad * 2) * 0.5, A.w * 0.09), 34, 70);
    const gx = A.x + pad, beans = [];
    for (let i = 0; i < 5; i++) beans.push(R(gx + (i % 3) * (bw + 6), A.y + pad + Math.floor(i / 3) * (bw * 0.9 + 8) + 8, bw, bw * 0.9));
    const bx = gx + (bw + 6) * 3 + 16, bwid = A.x + A.w - pad - bx;
    const bh = Math.min(maxBtn, (A.h - pad * 2 - (nb - 1) * gap) / nb);
    const btns = [];
    for (let i = 0; i < n; i++) btns.push(R(bx, A.y + pad + i * (bh + gap), bwid, bh));
    return { beans, size: bw, btns, wide: true };
  }
  const minB = 42;
  let bs = clamp(Math.min((A.w - pad * 2) / 5.4, (A.h - pad * 2) * 0.3), 28, 84);
  const room = A.h - pad * 2 - nb * minB - (nb - 1) * gap - 14;
  if (bs * 0.9 > room) bs = clamp(room / 0.9, 26, bs);
  const total = bs * 5 + 8 * 4, x0 = A.x + (A.w - total) / 2, by = A.y + pad + 2;
  const beans = [];
  for (let i = 0; i < 5; i++) beans.push(R(x0 + i * (bs + 8), by, bs, bs * 0.9));
  const top = by + bs * 0.9 + 12, bottom = A.y + A.h - pad;
  const bh = Math.min(maxBtn, Math.max(30, (bottom - top - (nb - 1) * gap) / nb));
  const btns = [];
  for (let i = 0; i < n; i++) btns.push(R(A.x + pad, top + i * (bh + gap), A.w - pad * 2, bh));
  return { beans, size: bs, btns, wide: false };
}

