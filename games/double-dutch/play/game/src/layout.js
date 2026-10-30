// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): HUD row on top, a big street scene, the rope strip, a wide HOP pad along the bottom.
//   compact  portrait tablet / 4:3 either way / small phones: the same order with a shorter scene.
//   wide     landscape (w >= 1.2 h): the scene on the left, the score, rope strip, HOP pad and buttons in a column on the right.
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px)); // a thumb-sized height in units

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const LEVEL_COUNT = 8;

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);          // the safe rectangle
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;                               // the host's floating back button owns the top-left corner
  const L = { w, h, mode, S, mb, backPad };

  // ---- PLAY ----------------------------------------------------------------------------------------------------------------------
  {
    const P = {};
    const strip = Math.max(52, 44 / Math.max(0.2, host.px));
    const bw = Math.max(64, mb);
    P.strip = R(S.x, S.y, S.w, strip);
    P.badge = { x: S.x + S.w - 12, y: S.y + 6, align: 'right' };
    if (mode === 'wide') {
      const colW = clamp(S.w * 0.31, 330, 560), gap = 12;
      const col = R(S.x + S.w - colW - 14, S.y + strip, colW, S.h - strip - 12);
      P.col = col;
      const by = col.y + col.h - bw;
      P.hint = R(col.x, by, (col.w - gap) / 2, bw);
      P.pause = R(col.x + col.w / 2 + gap / 2, by, (col.w - gap) / 2, bw);
      P.hud = R(col.x, col.y, col.w, 150);
      const sheetH = clamp(col.h * 0.2, 96, 140);
      P.sheet = R(col.x, P.hud.y + P.hud.h + gap, col.w, sheetH);
      P.hop = R(col.x, P.sheet.y + sheetH + gap, col.w, by - gap - (P.sheet.y + sheetH + gap));
      P.stage = R(S.x + 8, S.y + strip, col.x - gap - (S.x + 8), S.h - strip - 8);
    } else {
      const hudH = 82, gap = 10, W = S.w - 24;
      P.hud = R(S.x + 12, S.y + strip, W, hudH);
      P.pause = R(P.hud.x + P.hud.w - bw, P.hud.y + (hudH - bw) / 2, bw, bw);
      P.hint = R(P.pause.x - 10 - bw, P.pause.y, bw, bw);
      const hopH = clamp(S.h * 0.15, 120, 230);
      P.hop = R(S.x + 12, S.y + S.h - hopH - 12, W, hopH);
      const sheetH = clamp(S.h * 0.085, 88, 130);
      P.sheet = R(S.x + 12, P.hop.y - gap - sheetH, W, sheetH);
      const sy = P.hud.y + hudH + 4;
      P.stage = R(S.x, sy, S.w, P.sheet.y - gap - sy);
    }
    L.play = P;
  }

  // ---- TITLE ------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && mode !== 'wide' ? 74 : 84, mb), sh = Math.max(S.h < 1200 ? 60 : 66, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW;
      const total = (bh + 16) + 12 + bh + 12 + sh + 12 + sh;
      const y0 = S.y + Math.max(24, (S.h - total - 40) / 2);
      T.hero = R(S.x, S.y, colX - S.x - 16, S.h);
      T.titleY = S.y + Math.max(60, S.h * 0.12);
      T.size = Math.min(110, (T.hero.w - 60) / 4.6);
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: colX + colW / 2, y: S.y + S.h - 18 };
      T.col = R(colX, y0, colW, y + sh - y0);
    } else {
      const bw = Math.min(S.w - 64, 560), bx = S.x + (S.w - bw) / 2;
      const total = (bh + 16) + 12 + bh + 12 + (sh + 12) * 2;
      const creditH = 92, bottom = S.y + S.h - creditH, y = bottom - total;
      T.hero = R(S.x, S.y, S.w, y - 8 - S.y);
      T.size = Math.min(124, (S.w - 60) / 4.4);
      T.titleY = S.y + Math.max(70, T.hero.h * 0.13);
      let yy = y;
      T.play = R(bx, yy, bw, bh + 16); yy += bh + 16 + 12;
      T.auto = R(bx, yy, bw, bh); yy += bh + 12;
      const hw = (bw - 12) / 2;
      T.how = R(bx, yy, hw, sh); T.rules = R(bx + hw + 12, yy, hw, sh); yy += sh + 12;
      T.about = R(bx, yy, hw, sh); T.settings = R(bx + hw + 12, yy, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
      T.col = R(bx, y, bw, total);
    }
    L.title = T;
  }

  // ---- LEVELS (the eight heights) ------------------------------------------------------------------------------------------------
  {
    const G = {};
    const hdrH = Math.max(76, mb) + 8;
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + hdrH + 16, bot = S.y + S.h - 16;
    const cols = mode === 'wide' ? 4 : 2, rows = Math.ceil(LEVEL_COUNT / cols), gx = 14, gy = 14;
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, ch = Math.min(mode === 'wide' ? 300 : 250, (bot - top - gy * (rows - 1)) / rows);
    G.cols = cols; G.cards = [];
    for (let i = 0; i < LEVEL_COUNT; i++) { const c = i % cols, r = Math.floor(i / cols); G.cards.push(R(S.x + 16 + c * (cw + gx), top + r * (ch + gy), cw, ch)); }
    L.levels = G;
  }

  // ---- PREP (one level: routine, best, how to play it) --------------------------------------------------------------------------
  {
    const D = {};
    D.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const bh = Math.max(84, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 340, 460), colX = S.x + S.w - 32 - colW;
      D.info = R(S.x + 24, S.y + 100, colX - S.x - 48, S.h - 130);
      let y = S.y + (S.h - (bh * 3 + 24)) / 2;
      D.play = R(colX, y, colW, bh); y += bh + 12; D.practice = R(colX, y, colW, bh); y += bh + 12; D.watch = R(colX, y, colW, bh);
    } else {
      const bw = Math.min(S.w - 48, 600), bx = S.x + (S.w - bw) / 2, total = bh * 3 + 24;
      let y = S.y + S.h - 24 - total;
      D.info = R(S.x + 24, S.y + 100, S.w - 48, y - 12 - (S.y + 100));
      D.play = R(bx, y, bw, bh); y += bh + 12; D.practice = R(bx, y, bw, bh); y += bh + 12; D.watch = R(bx, y, bw, bh);
    }
    L.prep = D;
  }

  // ---- RESULT ----------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(80, mb);
    const pw = Math.min(S.w - 32, mode === 'wide' ? 980 : 640), ph = Math.min(S.h - 40, mode === 'wide' ? 620 : S.w / S.h > 0.6 ? 800 : 1100);   // tablet portrait: tighter panel, no empty band
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode === 'wide') {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 32 - bh, bwid, bh); Rr.next = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.next.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 32 - bh - 20 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 56 - bh, bwid, bh); Rr.next = R(p.x + 32, Rr.menu.y - 12 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.next.y - 12 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 24 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings): header, scrolling viewport, nav ------------------------------------
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
    Dc.contentW = contentW;
    L.doc = Dc;
  }
  return L;
}

// Rects for a small centred menu of n buttons (pause menu): { panel, btns[] }.
export function menuRects(L, n, extraTop = 120) {
  const S = L.S, bh = Math.max(76, L.mb), gap = 12, pw = Math.min(S.w - 40, 560), ph = extraTop + n * bh + (n - 1) * gap + 36;
  const panel = R(S.x + (S.w - pw) / 2, S.y + Math.max(8, (S.h - ph) / 2), pw, ph), btns = [];
  for (let i = 0; i < n; i++) btns.push(R(panel.x + 28, panel.y + extraTop + i * (bh + gap), pw - 56, bh));
  return { panel, btns };
}
