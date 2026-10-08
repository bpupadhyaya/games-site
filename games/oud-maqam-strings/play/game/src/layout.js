// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Two instrument orientations:
//   portrait (h > w): the neck runs top to bottom, the body of the oud at the bottom, a two-row HUD on top.
//   wide     (w >= h): the neck runs left to right, the body on the right, a one-row HUD on top.
// The instrument is described once, in its own frame (u along the neck from the nut, v across), and mapped to the screen by `inst`.
import { TEXT_SCALES } from './music.js';
export { TEXT_SCALES };

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

// The oud in an area. Local frame: u runs from the nut (0) along the neck and over the body, v across (0 = the middle).
export function instGeo(area, wide) {
  const peg = 66, m = 12;
  const free = (wide ? area.w : area.h) - peg - m;
  let Lbody = wide ? clamp(free * 0.34, 300, 560) : clamp(free * 0.34, 250, 460);
  let Lneck = free - Lbody;
  const minNeck = wide ? 480 : 420;
  if (Lneck < minNeck) { Lbody = Math.max(200, free - minNeck); Lneck = free - Lbody; }
  const cross = wide ? area.h : area.w;
  const bodyW = Math.min(cross - 20, Lbody * 0.94);
  const nutW = clamp(wide ? area.h * 0.19 : area.w * 0.2, 112, 176);
  const g = { wide, peg, Lneck, Lbody, bodyW, nutW, area, span: 1200 };
  if (wide) { g.x0 = area.x + peg; g.cy = area.y + area.h / 2; g.toScreen = (u, v) => ({ x: g.x0 + u, y: g.cy + v }); g.toLocal = (x, y) => ({ u: x - g.x0, v: y - g.cy }); g.matrix = [1, 0, 0, 1, g.x0, g.cy]; }
  else { g.y0 = area.y + peg; g.cx = area.x + area.w / 2; g.toScreen = (u, v) => ({ x: g.cx + v, y: g.y0 + u }); g.toLocal = (x, y) => ({ u: y - g.y0, v: x - g.cx }); g.matrix = [0, 1, 1, 0, g.cx, g.y0]; }
  g.uEnd = Lneck;                                     // pitch is clamped to the neck
  g.uPad = Lneck + Lbody * 0.12;                      // from here on a touch is the plectrum hand
  return g;
}

function build(w, h) {
  const wide = w >= h;
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);          // the safe rectangle
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;                               // the host's floating back button owns the top-left corner
  const L = { w, h, mode, wide, S, mb, backPad };

  // ---- PLAY / LEARN / AUTO ---------------------------------------------------------------------------------------------------
  {
    const P = {};
    const bw = Math.max(64, mb);
    if (wide) {
      const hudH = Math.max(104, bw + 36);
      P.hud = R(S.x, S.y, S.w, hudH);
      P.pause = R(S.x + S.w - 14 - bw, S.y + 14, bw, bw);
      P.hint = R(P.pause.x - 12 - bw, P.pause.y, bw, bw);
      P.score = R(S.x + 14 + backPad, S.y + 10, Math.min(300, S.w * 0.22), hudH - 20);
      const cx0 = P.score.x + P.score.w + 16, cx1 = P.hint.x - 16;
      P.cycle = R(cx0, S.y + 14, Math.max(200, cx1 - cx0), hudH - 28);
      P.area = R(S.x, S.y + hudH, S.w, S.h - hudH);
    } else {
      const hudH = 176;
      P.hud = R(S.x, S.y, S.w, hudH);
      P.pause = R(S.x + S.w - 12 - bw, S.y + 10, bw, bw);
      P.hint = R(P.pause.x - 12 - bw, P.pause.y, bw, bw);
      P.score = R(S.x + 14 + backPad, S.y + 8, P.hint.x - 12 - (S.x + 14 + backPad), bw + 4);
      P.cycle = R(S.x + 14, S.y + 10 + bw + 12, S.w - 28, hudH - bw - 28);
      P.area = R(S.x, S.y + hudH, S.w, S.h - hudH);
    }
    P.inst = instGeo(P.area, wide);
    L.play = P;
  }

  // ---- FREE PLAY / TAQSIM --------------------------------------------------------------------------------------------------------
  {
    const F = {};
    const bh = Math.max(60, mb);
    if (wide) {
      const hudH = bh + 28, gap = 10, x0 = S.x + 12 + backPad, W = S.x + S.w - 12 - x0;
      const ws = [1.15, 1.5, 1.35, 1.2, 1.35, 0.7, 0.7], sum = ws.reduce((a, b) => a + b, 0), unit = (W - gap * (ws.length - 1)) / sum;
      const ids = ['exit', 'maqam', 'journey', 'drone', 'rhythm', 'tdec', 'tinc'];
      let x = x0; ids.forEach((id, i) => { F[id] = R(x, S.y + 14, ws[i] * unit, bh); x += ws[i] * unit + gap; });
      F.info = R(S.x + 12, S.y + hudH, S.w - 24, 60);
      F.area = R(S.x, S.y + hudH + 62, S.w, S.h - hudH - 62);
    } else {
      const hudH = bh * 2 + 36, gap = 10, x0 = S.x + 12, W = S.w - 24;
      const r1 = [['exit', 0.8], ['maqam', 1.5], ['journey', 1.2]], r2 = [['drone', 1.1], ['rhythm', 1.1], ['tdec', 0.55], ['tinc', 0.55]];
      const place = (row, y, x00) => { const sum = row.reduce((a, b) => a + b[1], 0), unit = (W - (x00 - x0) - gap * (row.length - 1)) / sum; let x = x00; row.forEach(([id, k]) => { F[id] = R(x, y, k * unit, bh); x += k * unit + gap; }); };
      place(r1, S.y + 10, x0 + backPad); place(r2, S.y + 10 + bh + 10, x0);
      F.info = R(S.x + 12, S.y + hudH, S.w - 24, 60);
      F.area = R(S.x, S.y + hudH + 62, S.w, S.h - hudH - 62);
    }
    F.inst = instGeo(F.area, wide);
    L.free = F;
  }

  // ---- TITLE ------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && !wide ? 74 : 84, mb);
    if (wide) {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW, y0 = S.y + Math.max(24, (S.h - (bh * 3 + 12 * 2 + 16 + 12 + 64 * 2 + 12 + 50)) / 2);
      T.size = Math.min(104, (colX - S.x - 60) / 6.2);
      T.titleY = S.y + Math.max(70, S.h * 0.14);
      T.hero = R(S.x + 30, T.titleY + T.size * 1.5 + 16, colX - S.x - 60, S.y + S.h - 60 - (T.titleY + T.size * 1.5 + 16));
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.free = R(colX, y, colW, bh); y += bh + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2, sh = Math.max(64, mb);
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 16 };
    } else {
      const bw = Math.min(S.w - 64, 560), bx = S.x + (S.w - bw) / 2, sh = Math.max(S.h < 1200 ? 60 : 66, mb);
      const total = bh + 16 + 12 + (bh + 12) * 2 + (sh + 12) * 2;
      const creditH = 92;
      let y = S.y + S.h - creditH - total;
      T.size = Math.min(110, (S.w - 60) / 6.2);
      T.titleY = S.y + Math.max(80, (y - S.y) * 0.1);
      T.hero = R(S.x + 20, T.titleY + T.size * 1.5 + 14, S.w - 40, y - 14 - (T.titleY + T.size * 1.5 + 14));
      T.play = R(bx, y, bw, bh + 16); y += bh + 16 + 12;
      T.free = R(bx, y, bw, bh); y += bh + 12;
      T.auto = R(bx, y, bw, bh); y += bh + 12;
      const hw = (bw - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
    }
    L.title = T;
  }

  // ---- SONGS (a list/grid of the six pieces) -----------------------------------------------------------------------------------------
  {
    const G = {};
    const hdrH = Math.max(76, mb) + 8;
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + hdrH + 24, bot = S.y + S.h - 16;
    const cols = wide ? 3 : mode === 'compact' ? 2 : 1;
    const rows = Math.ceil(6 / cols), gx = 14, gy = 14;
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, ch = Math.min(260, (bot - top - gy * (rows - 1)) / rows);
    G.cols = cols; G.cards = [];
    for (let i = 0; i < 6; i++) { const c = i % cols, r = Math.floor(i / cols); G.cards.push(R(S.x + 16 + c * (cw + gx), top + r * (ch + gy), cw, ch)); }
    L.songs = G;
  }

  // ---- PIECE (detail + mode choice) ---------------------------------------------------------------------------------------------------
  {
    const D = {};
    D.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const bh = Math.max(88, mb);
    if (wide) {
      const colW = clamp(w * 0.3, 340, 460), colX = S.x + S.w - 32 - colW;
      D.info = R(S.x + 24, S.y + 100, colX - S.x - 48, S.h - 130);
      let y = S.y + (S.h - (bh * 3 + 24)) / 2;
      D.learn = R(colX, y, colW, bh); y += bh + 12; D.perform = R(colX, y, colW, bh); y += bh + 12; D.watch = R(colX, y, colW, bh);
    } else {
      const bw = Math.min(S.w - 48, 600), bx = S.x + (S.w - bw) / 2, total = bh * 3 + 24;
      let y = S.y + S.h - 24 - total;
      D.info = R(S.x + 24, S.y + 100, S.w - 48, y - 12 - (S.y + 100));
      D.learn = R(bx, y, bw, bh); y += bh + 12; D.perform = R(bx, y, bw, bh); y += bh + 12; D.watch = R(bx, y, bw, bh);
    }
    L.piece = D;
  }

  // ---- RESULT ----------------------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(80, mb);
    const pw = Math.min(S.w - 32, wide ? 980 : 640), ph = Math.min(S.h - 40, wide ? 620 : 920);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (wide) {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 54 - bh, bwid, bh); Rr.songs = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.songs.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 22 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 56 - bh, bwid, bh); Rr.songs = R(p.x + 32, Rr.menu.y - 12 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.songs.y - 12 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 24 };
    }
    L.result = Rr;
  }

  // ---- LATENCY CALIBRATION ------------------------------------------------------------------------------------------------------------------
  {
    const C = {}, bh = Math.max(72, mb), m = 16;
    C.back = R(S.x + 12 + backPad, S.y + 12, Math.max(110, mb * 1.6), Math.max(64, mb));
    const bwid = Math.min(S.w - m * 2, 560), bx = S.x + (S.w - bwid) / 2;
    C.retry = R(bx, S.y + S.h - 24 - bh, (bwid - 12) / 2, bh); C.done = R(C.retry.x + C.retry.w + 12, C.retry.y, (bwid - 12) / 2, bh);
    const top = S.y + Math.max(64, mb) + 36;
    C.pad = R(S.x + m, top, S.w - m * 2, Math.max(120, C.retry.y - 16 - top));
    L.calib = C;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings): header, scrolling viewport, nav -----------------------------------------------------
  {
    const Dc = {};
    const bh = Math.max(64, mb), margin = wide ? Math.max(24, S.w * 0.06) : 16;
    const contentW = Math.min(S.w - margin * 2, wide ? 1100 : 820);
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
