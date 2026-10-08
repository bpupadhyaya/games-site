// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): pot above, a control panel below.
//   compact  portrait tablet / 4:3 either way: the same, shorter.
//   wide     landscape (w >= 1.2 h): the pot on the left, a control panel on the right.
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad };
  const bh = Math.max(64, mb);

  // ---- PLAY ---------------------------------------------------------------------------------------------------------------------------------
  {
    const P = {};
    const barH = Math.max(44, mb * 0.72);
    if (mode === 'wide') {
      const pw = clamp(S.w * 0.3, 320, 470);
      P.panel = R(S.x + S.w - pw - 12, S.y + 12, pw, S.h - 24);
      const ax = S.x + 12 + backPad, aw = P.panel.x - 12 - ax;
      P.bar = R(ax, S.y + 10, aw, barH);
      P.pot = R(S.x + 8, P.bar.y + barH + 6, P.panel.x - 8 - (S.x + 8), S.y + S.h - 8 - (P.bar.y + barH + 6));
      P.pause = R(P.panel.x + 14, P.panel.y + 14, pw - 28, bh);
      P.inner = R(P.panel.x + 14, P.pause.y + bh + 12, pw - 28, P.panel.h - 28 - bh - 12);
      // buttons stacked at the bottom of the panel
      const gap = 10, bx = P.inner.x, bw2 = P.inner.w, y3 = P.inner.y + P.inner.h - bh;
      P.next = R(bx, y3, bw2, bh); P.hint = R(bx, y3 - gap - bh, bw2, bh); P.undo = R(bx, y3 - (gap + bh) * 2, bw2, bh);
      P.body = R(P.inner.x, P.inner.y, P.inner.w, P.undo.y - 10 - P.inner.y);
    } else {
      const need = 3 * mb + 16 + bh + 32;     // the glaze station needs three rows of finger-sized chips above the buttons
      const ph = mode === 'tall' ? Math.max(clamp(S.h * 0.2, 270, 300), Math.min(need, S.h * 0.32)) : clamp(S.h * 0.3, 270, 300);
      P.bar = R(S.x + 12 + backPad, S.y + 10, S.w - 24 - backPad - bh - 10, barH);
      P.pause = R(S.x + S.w - 12 - bh, S.y + 8, bh, bh);
      P.panel = R(S.x + 8, S.y + S.h - 8 - ph, S.w - 16, ph);
      const top = Math.max(P.bar.y + barH, P.pause.y + bh) + 6;
      P.pot = R(S.x, top, S.w, P.panel.y - 4 - top);
      P.inner = R(P.panel.x + 14, P.panel.y + 12, P.panel.w - 28, P.panel.h - 24);
      const gap = 10, bwid = (P.inner.w - gap * 2) / 3, by = P.inner.y + P.inner.h - bh;
      P.undo = R(P.inner.x, by, bwid, bh); P.hint = R(P.inner.x + bwid + gap, by, bwid, bh); P.next = R(P.inner.x + (bwid + gap) * 2, by, bwid, bh);
      P.body = R(P.inner.x, P.inner.y, P.inner.w, by - 8 - P.inner.y);
    }
    // glaze controls inside body: 6 tradition dots, 3 base chips + 3 accent chips, 4 motif chips
    const B = P.body, gx = 8, rowH = clamp((B.h - 16) / 3, 40, Math.max(64, mb)), chipH = rowH;
    const dotD = Math.min(rowH, (B.w - gx * 5) / 6);
    P.glaze = { trads: [], bases: [], accs: [], motifs: [], rows: rowH };
    const tx = B.x + (B.w - (dotD * 6 + gx * 5)) / 2;
    for (let i = 0; i < 6; i++) P.glaze.trads.push(R(tx + i * (dotD + gx), B.y, dotD, rowH));
    const cw = (B.w - gx * 5) / 6, y2 = B.y + rowH + 8;
    for (let i = 0; i < 3; i++) P.glaze.bases.push(R(B.x + i * (cw + gx), y2, cw, chipH));
    for (let i = 0; i < 3; i++) P.glaze.accs.push(R(B.x + (3 + i) * (cw + gx), y2, cw, chipH));
    const mw = (B.w - gx * 3) / 4, y3 = y2 + chipH + 8;
    for (let i = 0; i < 4; i++) P.glaze.motifs.push(R(B.x + i * (mw + gx), y3, mw, chipH));
    P.skip = P.hint; P.close = P.undo;
    P.caption = R(P.pot.x + 12, P.pot.y + 4, P.pot.w - 24, 0);       // where the tip / auto caption sits (height set by the renderer)
    L.play = P;
  }

  // ---- TITLE --------------------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const big = Math.max(78, mb + 14), sh = Math.max(60, mb);
    if (mode === 'wide') {
      const colW = clamp(S.w * 0.3, 320, 460), colX = S.x + S.w - 32 - colW;
      const total = big + 12 + (bh + 12) + sh + 12 + (bh + 12) + sh + 12 + sh;
      let y = S.y + Math.max(20, (S.h - total - 70) / 2);
      T.throw = R(colX, y, colW, big); y += big + 12;
      const hw = (colW - 12) / 2;
      T.challenges = R(colX, y, hw, bh); T.shelf = R(colX + hw + 12, y, hw, bh); y += bh + 12;
      T.watch = R(colX, y, colW, bh); y += bh + 12;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh); y += sh;
      T.credit = { x: colX + colW / 2, y: Math.min(S.y + S.h - 14, y + 72) };
      T.size = Math.min(104, (colX - S.x - 60) / 5.2);
      T.titleY = S.y + Math.max(60, S.h * 0.13);
      T.titleX = S.x + (colX - S.x) / 2;
      T.pot = R(S.x + 10, T.titleY + T.size * 1.45, colX - S.x - 40, S.y + S.h - 20 - (T.titleY + T.size * 1.45));
    } else {
      const bw = Math.min(S.w - 48, 580), bx = S.x + (S.w - bw) / 2;
      const hw = (bw - 12) / 2, qw = (bw - 36) / 4;
      const total = big + 12 + (bh + 12) + (bh + 12) + sh;
      const creditH = 86;
      let y = S.y + S.h - creditH - total;
      T.throw = R(bx, y, bw, big); y += big + 12;
      T.challenges = R(bx, y, hw, bh); T.shelf = R(bx + hw + 12, y, hw, bh); y += bh + 12;
      T.watch = R(bx, y, bw, bh); y += bh + 12;
      T.how = R(bx, y, qw, sh); T.rules = R(bx + qw + 12, y, qw, sh); T.about = R(bx + (qw + 12) * 2, y, qw, sh); T.settings = R(bx + (qw + 12) * 3, y, qw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 12 };
      T.size = Math.min(112, (S.w - 60) / 6.2);
      T.titleY = S.y + Math.max(70, backPad ? 78 : 70);
      T.titleX = S.x + S.w / 2;
      const top = T.titleY + T.size * 1.45;
      T.pot = R(S.x, top, S.w, T.throw.y - 10 - top);
    }
    T.lockH = 86;
    L.title = T;
  }

  // ---- SIMPLE HEADER (back button + title) used by pick / shelf / study / result ---------------------------------------------------------------------
  L.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), bh);
  L.headTitleY = S.y + 12 + bh / 2;

  // ---- PICK (studio, daily and the 12 challenges) ---------------------------------------------------------------------------------------------------
  {
    const K = {};
    const top = S.y + 12 + bh + 16, gap = 14, pad = 16;
    const avail = S.w - pad * 2;
    const cols = avail >= 1100 ? 5 : avail >= 780 ? 4 : avail >= 560 ? 3 : 2;
    K.cols = cols; K.gap = gap;
    K.cw = (avail - gap * (cols - 1)) / cols; K.ch = clamp(K.cw * 1.28, 190, 300);
    K.grid = R(S.x + pad, top, avail, S.y + S.h - 12 - top);
    K.rows = Math.ceil((2 + 12) / cols);
    K.total = K.rows * (K.ch + gap) - gap;
    L.pick = K;
  }
  // ---- SHELF ------------------------------------------------------------------------------------------------------------------------------------------------
  {
    const K = {};
    const top = S.y + 12 + bh + 16, gap = 14, pad = 16, avail = S.w - pad * 2;
    const cols = avail >= 1100 ? 6 : avail >= 780 ? 4 : avail >= 560 ? 3 : 2;
    K.cols = cols; K.gap = gap; K.cw = (avail - gap * (cols - 1)) / cols; K.ch = clamp(K.cw * 1.35, 180, 320);
    K.grid = R(S.x + pad, top, avail, S.y + S.h - 12 - top);
    L.shelf = K;
  }
  // ---- STUDY (one shelf pot in 3D) and RESULT: pot area + info panel ----------------------------------------------------------------------------------------
  for (const key of ['study', 'result']) {
    const K = {};
    if (mode === 'wide') {
      const pw = clamp(S.w * 0.38, 340, 560);
      K.panel = R(S.x + S.w - pw - 16, S.y + 12, pw, S.h - 24);
      K.pot = R(S.x + 8, S.y + 8, K.panel.x - 8 - (S.x + 8), S.h - 16);
    } else {
      let ph = clamp(S.h * (mode === 'tall' ? 0.34 : 0.46), 360, 560);
      if (key === 'result') ph = Math.max(ph, Math.min(214 + 5 * 40 + 12 + bh + 16, S.h * 0.62));
      K.panel = R(S.x + 12, S.y + S.h - 12 - ph, S.w - 24, ph);
      K.pot = R(S.x, S.y + (key === 'study' ? bh + 24 : 8), S.w, K.panel.y - 6 - (S.y + (key === 'study' ? bh + 24 : 8)));
    }
    const pad = 16, p = K.panel;
    const nb = key === 'study' ? 2 : 3, gap = 10;
    if (mode === 'wide') {
      const bw = p.w - pad * 2;
      K.btns = []; for (let i = 0; i < nb; i++) K.btns.push(R(p.x + pad, p.y + p.h - pad - (nb - i) * bh - (nb - i - 1) * gap, bw, bh));
    } else {
      const bw = (p.w - pad * 2 - gap * (nb - 1)) / nb;
      K.btns = []; for (let i = 0; i < nb; i++) K.btns.push(R(p.x + pad + i * (bw + gap), p.y + p.h - pad - bh, bw, bh));
    }
    L[key] = K;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings) -------------------------------------------------------------------------------------------------
  {
    const Dc = {};
    const margin = mode === 'wide' ? Math.max(24, S.w * 0.06) : 16;
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
