// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size, cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): HUD on top, the pad in the middle, a "next move" card underneath.
//   compact  portrait tablet / 4:3 either way: HUD on top, a bigger pad.
//   wide     landscape (w >= 1.2 h): a status card on the left, the pad in the middle, a button card on the right.
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));  // a thumb-sized height in units

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const PAD_REACH = 1.3;                                          // the sand pit extends this far past the pad radius

// The pit has radius R about (cx, cy). The two hands are 0.2R either side of the centre; each club's path has radius pr = 0.8R about its hand.
export const HAND = 0.2, PATH = 0.8;
const padOf = (cx, cy, R) => ({ cx, cy, R, pr: R * PATH, lx: cx + R * HAND, sx: cx - R * HAND });

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
  const bw = Math.max(64, mb);

  // ---- PLAY / PRACTICE / WATCH ----------------------------------------------------------------------------------------------------------
  {
    const P = {};
    if (mode === 'wide') {
      const pw = clamp(w * 0.2, 190, 330), dy = backPad ? backPad + 4 : 0;
      P.left = R(S.x + 16, S.y + 16 + dy, pw, S.h - 32 - dy);
      P.right = R(S.x + S.w - 16 - pw, S.y + 16, pw, S.h - 32);
      const ax = P.left.x + pw + 12, aw = P.right.x - 12 - ax;
      const Rr = Math.min(aw / 2, S.h / 2 - 10) / PAD_REACH;
      P.pad = padOf(ax + aw / 2, S.y + S.h / 2, Rr);
      P.pause = R(P.right.x + 14, P.right.y + P.right.h - 14 - bw, pw - 28, bw);
      P.hint = R(P.right.x + 14, P.pause.y - 12 - bw, pw - 28, bw);
      P.next = R(P.right.x + 14, P.right.y + 14, pw - 28, Math.max(160, P.hint.y - 26 - (P.right.y + 14)));
      P.title = R(P.left.x + 14, P.left.y + 12, pw - 28, 120);
      P.score = R(P.left.x + 14, P.left.y + 140, pw - 28, 100);
      P.flow = R(P.left.x + 14, P.left.y + 252, pw - 28, 54);
      P.stats = R(P.left.x + 14, P.left.y + 322, pw - 28, P.left.h - 336);
      P.caption = R(ax, S.y + 8, aw, 60);
    } else {
      const top = S.y + 10, hudH = mode === 'tall' ? 168 : 150, x0 = S.x + 12 + backPad, x1 = S.x + S.w - 12;
      P.hud = R(S.x + 8, top, S.w - 16, hudH);
      P.pause = R(x1 - bw - 4, top + 8, bw, bw);
      P.hint = R(P.pause.x - 10 - bw, top + 8, bw, bw);
      P.title = R(x0, top + 6, P.hint.x - 12 - x0, bw);
      P.score = R(x0, top + bw + 18, S.w * 0.4, 56);
      P.flow = R(x0 + S.w * 0.4 + 10, top + bw + 22, x1 - (x0 + S.w * 0.4 + 10) - 4, 46);
      const nextH = mode === 'tall' ? clamp(S.h * 0.14, 150, 230) : clamp(S.h * 0.14, 120, 190);
      P.next = R(S.x + 16, S.y + S.h - 14 - nextH, S.w - 32, nextH);
      const ay = top + hudH + 8, ah = P.next.y - 10 - ay;
      const Rr = Math.min((S.w - 8) / 2, ah / 2) / PAD_REACH;
      P.pad = padOf(S.x + S.w / 2, ay + ah / 2 + 10, Rr);
      P.caption = R(S.x + 16, ay, S.w - 32, 50);
    }
    L.play = P;
  }

  // ---- TITLE ------------------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && mode !== 'wide' ? 74 : 84, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW;
      const sh = Math.max(64, mb), total = bh + 16 + 12 + (bh + 12) * 2 + (sh + 12) * 2 - 12;
      const y0 = S.y + Math.max(24, (S.h - total - 40) / 2);
      T.size = Math.min(112, (colX - S.x - 60) / 4.6);
      T.titleY = S.y + Math.max(70, S.h * 0.14);
      const tb = T.titleY + T.size * 1.6 + 40, rr = Math.min((colX - S.x) * 0.3, (S.y + S.h - 70 - tb) / 2.2);
      T.hero = { x: S.x + (colX - S.x) / 2, y: tb + rr * 1.2, r: rr };
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.practice = R(colX, y, colW, bh); y += bh + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
    } else {
      const bwid = Math.min(S.w - 64, 560), bx = S.x + (S.w - bwid) / 2, sh = Math.max(S.h < 1200 ? 60 : 66, mb);
      const total = bh + 16 + 12 + (bh + 12) * 2 + (sh + 12) * 2 - 12;
      const bottom = S.y + S.h - 92;
      let y = bottom - total;
      T.size = Math.min(100, (S.w - 60) / 4.6);
      T.titleY = S.y + Math.max(70, (y - S.y) * 0.08);
      const tb = T.titleY + T.size * 1.5 + 30, rr = Math.max(60, Math.min(S.w * 0.42, (y - 4 - tb) / 2.0));
      T.hero = { x: S.x + S.w / 2, y: tb + rr * 0.9, r: rr };
      T.play = R(bx, y, bwid, bh + 16); y += bh + 16 + 12;
      T.practice = R(bx, y, bwid, bh); y += bh + 12;
      T.auto = R(bx, y, bwid, bh); y += bh + 12;
      const hw = (bwid - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
      T.col = R(bx, bottom - total, bwid, total);
    }
    L.title = T;
  }

  // ---- ROUTINES and MOVES (card grids) ----------------------------------------------------------------------------------------------------
  const grid = (n, cols, top, bot, gx = 14, gy = 14, maxH = 240) => {
    const rows = Math.ceil(n / cols), cw = (S.w - 32 - gx * (cols - 1)) / cols, ch = Math.min(maxH, (bot - top - gy * (rows - 1)) / rows), cards = [];
    for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); cards.push(R(S.x + 16 + c * (cw + gx), top + r * (ch + gy), cw, ch)); }
    return { cols, rows, cards };
  };
  {
    const G = {};
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + Math.max(76, mb) + 32, bot = S.y + S.h - 16;
    const cols = mode === 'wide' ? 4 : mode === 'compact' && w > h ? 4 : mode === 'compact' ? 2 : 1;
    Object.assign(G, grid(7, cols, top, bot, 14, 14, mode === 'tall' ? 176 : 230));
    L.routines = G;
  }
  {
    const G = {};
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const bh = Math.max(72, mb);
    G.tempo = R(S.x + 16, S.y + S.h - 16 - bh, S.w - 32, bh);
    const dec = Math.max(70, mb * 1.2);
    G.tempoDec = R(G.tempo.x, G.tempo.y, dec, bh); G.tempoInc = R(G.tempo.x + G.tempo.w - dec, G.tempo.y, dec, bh);
    const top = S.y + Math.max(76, mb) + 32, bot = G.tempo.y - 14;
    const cols = mode === 'wide' ? 4 : mode === 'compact' && w > h ? 4 : mode === 'compact' ? 3 : 2;
    Object.assign(G, grid(12, cols, top, bot, 12, 12, 250));
    L.moves = G;
  }

  // ---- RESULT -----------------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(80, mb);
    const pw = Math.min(S.w - 32, mode === 'wide' ? 980 : 640), ph = Math.min(S.h - 40, mode === 'wide' ? 640 : 1100);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode === 'wide') {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 32 - bh, bwid, bh); Rr.routines = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.routines.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 32 - bh - 20 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 56 - bh, bwid, bh); Rr.routines = R(p.x + 32, Rr.menu.y - 12 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.routines.y - 12 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 24 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings) -----------------------------------------------------------------------------
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

// Rects for a small centred menu of n buttons (pause menu, end-of-demo menu): { panel, btns[] }.
export function menuRects(L, n, extraTop = 120) {
  const S = L.S, bh = Math.max(76, L.mb), gap = 12, pw = Math.min(S.w - 40, 560), ph = extraTop + n * bh + (n - 1) * gap + 36;
  const panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph), btns = [];
  for (let i = 0; i < n; i++) btns.push(R(panel.x + 28, panel.y + extraTop + i * (bh + gap), pw - 56, bh));
  return { panel, btns };
}
