// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size, cached by size + insets. Two shapes:
//   tall   portrait and squarish: scores on top, the stage (two hands across the table) in the middle, the controls under it.
//   wide   landscape (w >= 1.2 h): the stage on the left, scores and controls in a column on the right.
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));  // a thumb-sized height in units

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1560;
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : 'tall';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad };
  const bw = Math.max(64, mb);

  // ---- PLAY -----------------------------------------------------------------------------------------------------------------------------
  {
    const P = {};
    const small = S.h < 900;
    const th = mode === 'wide' ? clamp(S.h * 0.062, Math.max(60, mb), 100) : clamp(S.h * 0.088, Math.max(74, mb), 124), ch = clamp(S.h * 0.05, Math.max(52, mb * 0.9), 74), gh = clamp(S.h * 0.056, Math.max(64, mb), 90);
    const cap = 26, gap = 9;
    const place = (x, y, cw) => {
      // throw row (6), call grid (2 rows of 6; 11 numbers), go
      const out = {};
      out.throwCap = R(x, y, cw, cap); y += cap;
      const tw = (cw - gap * 5) / 6;
      out.throws = [0, 1, 2, 3, 4, 5].map((i) => R(x + i * (tw + gap), y, tw, th)); y += th + gap;
      out.callCap = R(x, y, cw, cap); y += cap;
      out.calls = [];
      for (let i = 0; i <= 10; i++) { const r = Math.floor(i / 6), c = i % 6; out.calls.push(R(x + c * (tw + gap), y + r * (ch + gap), tw, ch)); }
      // the 12th cell of the call grid is a small "clear" hint spot, left unused: the Throw button takes the full width below
      y += 2 * ch + gap + gap;
      out.go = R(x, y, cw, gh); y += gh;
      out.bottom = y;
      return out;
    };
    if (mode === 'wide') {
      const rw = clamp(S.w * 0.4, 400, 660), rx = S.x + S.w - rw - 14;
      const top = S.y + 10;
      P.pause = R(rx + rw - bw, top, bw, bw);
      P.hint = R(P.pause.x - 10 - bw, top, bw, bw);
      P.title = R(rx, top, P.hint.x - 10 - rx, bw);
      const sh = 74;
      const sw = (rw - 12) / 2;
      P.scoreRival = R(rx, top + bw + 10, sw, sh); P.scoreYou = R(rx + sw + 12, top + bw + 10, sw, sh);
      const y0 = P.scoreRival.y + sh + 12;
      const c = place(rx, y0, rw);
      const free = S.y + S.h - 12 - c.bottom;
      Object.assign(P, c);
      if (free < 0) { /* very short window: controls simply sit tight; the buttons keep their minimum sizes */ }
      P.stage = R(0, 0, rx - 12, h);
      P.rail = { edge: 'left', r: R(rx - 12, 0, w - rx + 12, h) };
    } else {
      const x0 = S.x + 12, cw = S.w - 24, top = S.y + 8;
      const bx = S.x + 12 + backPad;
      P.pause = R(S.x + S.w - 12 - bw, top, bw, bw);
      P.hint = R(P.pause.x - 10 - bw, top, bw, bw);
      P.title = R(bx, top, P.hint.x - 10 - bx, bw);
      const sh = small ? 64 : 76, sw = (cw - 12) / 2, sy = top + bw + 8;
      P.scoreRival = R(x0, sy, sw, sh); P.scoreYou = R(x0 + sw + 12, sy, sw, sh);
      const total = cap + th + gap + cap + 2 * ch + gap * 2 + gh;
      const cy = S.y + S.h - 12 - total;
      const c = place(x0, cy, cw);
      Object.assign(P, c);
      const stTop = sy + sh + 8;
      P.stage = R(0, stTop, w, Math.max(120, cy - 12 - stTop));
      P.rail = null;
      P.railTop = R(0, 0, w, stTop);
      P.railBottom = R(0, cy - 12, w, h - (cy - 12));
    }
    L.play = P;
  }

  // ---- TITLE ----------------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && mode !== 'wide' ? 72 : 82, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW;
      const sh = Math.max(62, mb), total = (bh + 12) * 2 + (sh + 12) * 2 + bh + 16 - 12;
      const y0 = S.y + Math.max(20, (S.h - total - 40) / 2);
      let y = y0;
      T.play = R(colX, y, colW, bh + 14); y += bh + 14 + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
      T.size = Math.min(120, (colX - 40) / 3.8, S.h * 0.17);
      T.railTop = R(0, 0, colX - 24, S.y + 20 + T.size * 1.8);
      T.railRight = R(colX - 24, 0, w - colX + 24, h);
      T.railBottom = null;
      T.area = R(0, T.railTop.h, colX - 24, h - T.railTop.h);
      T.titleBox = R(S.x + 16, S.y + 14, colX - 24 - S.x - 32, T.railTop.h - 14);
    } else {
      const bwid = Math.min(S.w - 64, 560), bx = S.x + (S.w - bwid) / 2, sh = Math.max(S.h < 1200 ? 58 : 66, mb);
      const total = (bh + 14) + 12 + (bh + 12) + (sh + 12) * 2 - 12;
      const bottom = S.y + S.h - 92;
      let y = bottom - total;
      T.play = R(bx, y, bwid, bh + 14); y += bh + 14 + 12;
      T.auto = R(bx, y, bwid, bh); y += bh + 12;
      const hw = (bwid - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
      T.col = R(bx, bottom - total, bwid, total);
      T.size = Math.min(140, S.w / 3.6, S.h * 0.12);
      T.railTop = R(0, 0, w, S.y + 18 + T.size * 1.85);
      T.railBottom = R(0, bottom - total - 18, w, h - (bottom - total - 18));
      T.railRight = null;
      T.area = R(0, T.railTop.h, w, T.railBottom.y - T.railTop.h);
      T.titleBox = R(S.x + 16, S.y + 12, S.w - 32, T.railTop.h - 12);
    }
    L.title = T;
  }

  // ---- RIVALS (cards) ----------------------------------------------------------------------------------------------------------------------
  {
    const G = {};
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + Math.max(76, mb) + 30, bot = S.y + S.h - 14, gx = 12, gy = 12;
    const cols = mode === 'wide' ? 3 : 1, n = 5, rows = Math.ceil(n / cols);
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, chh = Math.min(300, (bot - top - gy * (rows - 1)) / rows);
    G.cards = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      // centre a short last row
      const inRow = r === rows - 1 ? n - r * cols : cols;
      const off = (cols - inRow) * (cw + gx) / 2;
      G.cards.push(R(S.x + 16 + off + c * (cw + gx), top + r * (chh + gy), cw, chh));
    }
    L.rivals = G;
  }

  // ---- RESULT ------------------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(76, mb);
    const pw = Math.min(S.w - 24, mode === 'wide' ? 1040 : 660), ph = Math.min(S.h - 24, mode === 'wide' ? 680 : 1180);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode === 'wide') {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 28 - bh, bwid, bh); Rr.rivals = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.rivals.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 28 - bh - 14 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 44 - bh, bwid, bh); Rr.rivals = R(p.x + 32, Rr.menu.y - 10 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.rivals.y - 10 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 18 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings) -------------------------------------------------------------------------------
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
