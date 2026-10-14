// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units). layoutFor(w, h) returns every
// rect for that size, cached by size + insets, so a rotation or a resize can never lose state: the game only keeps data, never positions.
//   tall     portrait phone (h >= 1.5 w): header, seats, the score ribbon, then a big instrument below
//   compact  portrait tablet / 4:3 either way / small phones: the same, with a shorter ribbon
//   wide     landscape (w >= 1.2 h): a status column on the left, the ribbon above the instrument on the right
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));  // a thumb-sized height in units

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

// ---- instruments: where the touch zones are, for the area they are given ------------------------------------------------------------------
export function accGeom(a) {
  const padH = clamp(a.h * 0.27, 96, 190), gap = 14, kh = a.h - padH - gap;
  const pad = R(a.x + 10, a.y + kh + gap, a.w - 20, padH);
  const panel = R(a.x + 6, a.y + 4, a.w - 12, kh - 4);
  const cell = (panel.w - 24) / 7, r = Math.min(cell * 0.6, panel.h * 0.22, 84), zig = r * 0.68;
  const btns = []; for (let i = 0; i < 7; i++) btns.push({ i, cx: panel.x + 12 + cell * (i + 0.5), cy: panel.y + panel.h * 0.5 + (i % 2 ? zig : -zig), r });
  return { panel, pad, btns, cell, r };
}
export function cajaGeom(a) {
  const pw = (a.w - 24) / 2;
  return { tum: R(a.x + 12, a.y + 6, pw, a.h - 12), tak: R(a.x + 12 + pw, a.y + 6, pw, a.h - 12) };
}
export function guaGeom(a) {
  const th = clamp(Math.min(a.h * 0.8, (a.w - 28) * 0.36), 120, 360);
  return { tube: R(a.x + 14, a.y + (a.h - th) / 2, a.w - 28, th), zone: a };
}
// The ribbon: three bands (accordion pitch rows, caja two rows, guacharaca one row) and the playhead.
export function ribbonGeom(r) {
  const accH = r.h * 0.55, cajaH = r.h * 0.25, guaH = r.h - accH - cajaH;
  return { r, playX: r.x + r.w * 0.2, acc: R(r.x, r.y, r.w, accH), caja: R(r.x, r.y + accH, r.w, cajaH), gua: R(r.x, r.y + accH + cajaH, r.w, guaH), pxPerSec: (r.w * 0.78) / 2.4 };
}

function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad };

  // ---- PLAY ----------------------------------------------------------------------------------------------------------------------------
  {
    const P = {}, sq = Math.max(64, mb);
    if (mode === 'wide') {
      const lw = clamp(w * 0.23, 230, 340), dy = backPad ? backPad + 4 : 0;
      P.left = R(S.x + 14, S.y + 14 + dy, lw, S.h - 28 - dy);
      P.score = R(P.left.x + 12, P.left.y + 10, lw - 24, 86);
      P.meter = R(P.left.x + 14, P.left.y + 120, lw - 28, 20);
      P.pause = R(P.left.x + 12, P.left.y + P.left.h - 12 - sq, (lw - 36) / 2, sq);
      P.hint = R(P.pause.x + P.pause.w + 12, P.pause.y, P.pause.w, sq);
      const dockTop = P.left.y + 214, dockBot = P.pause.y - 14, n = 3, gap = 10, dh = Math.min(120, (dockBot - dockTop - gap * 2) / n);
      P.dock = [0, 1, 2].map((i) => R(P.left.x + 12, dockTop + i * (dh + gap), lw - 24, dh));
      const ax = P.left.x + lw + 14, aw = S.x + S.w - 14 - ax, ribH = clamp(S.h * 0.4, 230, 420);
      P.ribbon = R(ax, S.y + 14, aw, ribH);
      const capY = P.ribbon.y + ribH + 10, capH = 84;
      P.cap = R(ax, capY, aw, capH);
      P.inst = R(ax, capY + capH + 6, aw, S.y + S.h - 14 - (capY + capH + 6));
    } else {
      const top = S.y + 8;
      P.pause = R(S.x + S.w - 12 - sq, top, sq, sq);
      P.hint = R(P.pause.x - 12 - sq, top, sq, sq);
      P.score = R(S.x + 12 + backPad, top, P.hint.x - 12 - (S.x + 12 + backPad), 76);
      P.meter = R(S.x + 18, top + 84, S.w - 36, 20);
      const dockY = top + 114, dockH = clamp(S.h * 0.052, 70, 92), gap = 10, dw = (S.w - 24 - gap * 2) / 3;
      P.dock = [0, 1, 2].map((i) => R(S.x + 12 + i * (dw + gap), dockY, dw, dockH));
      const ribY = dockY + dockH + 12, ribH = clamp(S.h * (mode === 'tall' ? 0.3 : 0.31), 250, 470);
      P.ribbon = R(S.x + 8, ribY, S.w - 16, ribH);
      const capY = ribY + ribH + 8, capH = 84;
      P.cap = R(S.x + 8, capY, S.w - 16, capH);
      P.inst = R(S.x + 8, capY + capH + 6, S.w - 16, S.y + S.h - 10 - (capY + capH + 6));
    }
    P.sq = sq;
    L.play = P;
  }

  // ---- TITLE ---------------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const squat = S.h < 1200 && mode !== 'wide';
    const bh = Math.max(squat ? 66 : 82, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW, sh = Math.max(64, mb);
      const total = bh + 16 + 12 + bh + 12 + sh + 12 + sh;
      const y0 = S.y + Math.max(20, (S.h - total - 40) / 2);
      T.hero = R(S.x + 20, S.y + 20, colX - S.x - 50, S.h - 70);
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.watch = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: colX + colW / 2, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
    } else {
      const bw = Math.min(S.w - 64, 560), bx = S.x + (S.w - bw) / 2, sh = Math.max(squat ? 56 : 66, mb);
      const total = bh + 16 + 12 + bh + 12 + (sh + 12) * 2;
      const creditH = squat ? 70 : 92, bottom = S.y + S.h - creditH;
      let y = bottom - total;
      T.hero = R(S.x + 16, S.y + 12, S.w - 32, Math.max(200, y - S.y - 24));
      T.play = R(bx, y, bw, bh + 16); y += bh + 16 + 12;
      T.watch = R(bx, y, bw, bh); y += bh + 12;
      const hw = (bw - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
      T.col = R(bx, bottom - total, bw, total);
    }
    L.title = T;
  }

  // ---- SONGS ---------------------------------------------------------------------------------------------------------------------------
  {
    const G = {};
    const hdrH = Math.max(76, mb) + 8;
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + hdrH + 20, bot = S.y + S.h - 16;
    const cols = mode === 'wide' ? 3 : mode === 'compact' && w > h ? 3 : mode === 'compact' ? 2 : 1;
    const rows = Math.ceil(6 / cols), gx = 14, gy = 14;
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, ch = Math.min(250, (bot - top - gy * (rows - 1)) / rows);
    G.cols = cols; G.cards = [];
    for (let i = 0; i < 6; i++) { const c = i % cols, r = Math.floor(i / cols); G.cards.push(R(S.x + 16 + c * (cw + gx), top + r * (ch + gy), cw, ch)); }
    L.songs = G;
  }

  // ---- PIECE (detail, the three Studio takes, Live Trio, Watch) ---------------------------------------------------------------------
  {
    const D = {};
    D.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const bh = Math.max(84, mb), sh = Math.max(76, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.34, 340, 520), colX = S.x + S.w - 28 - colW;
      D.info = R(S.x + 24, D.back.y + D.back.h + 14, colX - S.x - 48, S.y + S.h - 24 - (D.back.y + D.back.h + 14));
      let y = S.y + Math.max(20, (S.h - (bh * 3 + 12 * 2 + 18 + sh * 3 + 12 * 2)) / 2);
      D.seats = [0, 1, 2].map((i) => R(colX, y + i * (bh + 12), colW, bh)); y += bh * 3 + 12 * 2 + 18;
      D.live = R(colX, y, colW, sh); y += sh + 12; D.hear = R(colX, y, colW, sh); y += sh + 12; D.watch = R(colX, y, colW, sh);
    } else {
      const bw = Math.min(S.w - 32, 640), bx = S.x + (S.w - bw) / 2, total = bh * 3 + 12 * 2 + 18 + sh * 3 + 12 * 2;
      let y = S.y + S.h - 20 - total;
      D.info = R(S.x + 20, D.back.y + D.back.h + 14, S.w - 40, y - 12 - (D.back.y + D.back.h + 14));
      D.seats = [0, 1, 2].map((i) => R(bx, y + i * (bh + 12), bw, bh)); y += bh * 3 + 12 * 2 + 18;
      D.live = R(bx, y, bw, sh); y += sh + 12; D.hear = R(bx, y, bw, sh); y += sh + 12; D.watch = R(bx, y, bw, sh);
    }
    L.piece = D;
  }

  // ---- RESULT --------------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(76, mb);
    const pw = Math.min(S.w - 32, mode === 'wide' ? 1000 : 660), ph = Math.min(S.h - 32, mode === 'wide' ? 600 : 1180);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode === 'wide') {
      const bwid = (pw - 64 - 12 * 3) / 4;
      Rr.b = [0, 1, 2, 3].map((i) => R(p.x + 32 + i * (bwid + 12), p.y + p.h - 28 - bh, bwid, bh));
      Rr.body = R(p.x + 24, p.y + 24, pw - 48, ph - 48 - bh - 14);
    } else {
      const bwid = pw - 64;
      Rr.b = [0, 1, 2, 3].map((i) => R(p.x + 32, p.y + p.h - 28 - (bh + 10) * (4 - i) + 10, bwid, bh));
      Rr.body = R(p.x + 24, p.y + 24, pw - 48, ph - 48 - (bh + 10) * 4);
    }
    Rr.more = { x: p.x + p.w / 2, y: p.y + p.h + 22 };
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings) --------------------------------------------------------------------------
  {
    const Dc = {};
    const bh = Math.max(64, mb), margin = mode === 'wide' ? Math.max(24, S.w * 0.06) : 16;
    const contentW = Math.min(S.w - margin * 2, mode === 'wide' ? 1100 : 820);
    const cx = S.x + (S.w - contentW) / 2;
    Dc.back = R(S.x + 12 + backPad, S.y + 12, Math.max(110, mb * 1.6), bh);
    const decW = Math.max(64, mb);
    Dc.textInc = R(S.x + S.w - 12 - decW, S.y + 12, decW, bh);
    Dc.textDec = R(Dc.textInc.x - 10 - decW, S.y + 12, decW, bh);
    Dc.headerH = bh + 24;
    const navH = bh;
    Dc.nav = { back: R(cx, S.y + S.h - 14 - navH, (contentW - 12) / 2, navH), next: R(cx + (contentW - 12) / 2 + 12, S.y + S.h - 14 - navH, (contentW - 12) / 2, navH) };
    Dc.viewport = R(cx, S.y + Dc.headerH + 74, contentW, S.y + S.h - 14 - navH - 12 - (S.y + Dc.headerH + 74));
    Dc.titleY = S.y + 12 + bh / 2;
    Dc.contentW = contentW;
    L.doc = Dc;
  }

  // ---- CALIBRATE -----------------------------------------------------------------------------------------------------------------------
  {
    const C = {};
    const bh = Math.max(72, mb);
    C.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), bh);
    const bw = Math.min(S.w - 48, 520);
    C.use = R(S.x + (S.w - bw) / 2, S.y + S.h - 24 - bh, bw, bh);
    C.retry = R(C.use.x, C.use.y - 12 - bh, bw, bh);
    C.pad = { x: S.x + S.w / 2, y: S.y + S.h * (mode === 'wide' ? 0.5 : 0.44), r: Math.min(S.w, S.h) * (mode === 'wide' ? 0.2 : 0.26) };
    L.calib = C;
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
