// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): HUD on top, two staggered rows of poles, coach panel under the HUD.
//   compact  portrait tablet / 4:3 either way: the same two rows, shorter poles.
//   wide     landscape (w >= 1.2 h): one row of eight poles, the coach strip along the bottom.
import { TUNE } from './engine.js';

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

// Pole i (engine order: the order poles join the show) -> which stage position it stands on.
const ORDER_ONE = [3, 4, 2, 5, 1, 6, 0, 7];                       // single row, centre outwards
const ORDER_TWO = [[2, 0], [1, 0], [3, 0], [1, 1], [0, 0], [4, 0], [0, 1], [2, 1]];   // [column, row]; row 0 = front (5 poles), row 1 = back (3 poles)

function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad };

  // ---- PLAY ----------------------------------------------------------------------------------------------------------------
  {
    const P = {}, bw = Math.max(64, mb);
    const hudH = mode === 'wide' ? Math.max(88, bw + 20) : 150;
    P.hud = R(S.x, S.y, S.w, hudH);
    P.pause = R(S.x + S.w - 12 - bw, S.y + 10, bw, bw);
    P.think = R(P.pause.x - 12 - bw, S.y + 10, bw, bw);
    P.score = { x: S.x + 16 + backPad, y: S.y + 14 };
    P.spares = { x: P.think.x - 20, y: S.y + 10 + bw / 2 };      // right-aligned row of spare-plate icons
    P.act = mode === 'wide' ? { x: S.x + 16 + backPad + 290, y: S.y + 28 } : { x: S.x + 16 + backPad, y: S.y + hudH - 36 };
    P.combo = mode === 'wide' ? { x: P.act.x, y: P.act.y + 36, align: 'left' } : { x: S.x + S.w - 16, y: P.act.y, align: 'right' };
    // The stage: the rectangle below the HUD that the poles stand in.
    const top = S.y + hudH, bottom = S.y + S.h;
    const SH = bottom - top;
    P.stage = R(S.x, top, S.w, SH);
    let slots = [];
    const oneRow = mode === 'wide' && w / h >= 1.8;
    const VAR1 = [1.0, 1.15, 0.9, 1.2, 0.95, 1.12, 0.88, 1.05];                      // pole length varies a little so plates sit at different heights
    const VAR2 = [[1.0, 1.12, 0.9, 1.12, 1.0], [1.1, 1.2, 1.1]];
    const coachH = mode === 'wide' ? 64 : 0;
    if (oneRow) {
      const base = bottom - coachH - 52, sp = (S.w - 40) / 8;
      const rx = Math.min(sp * 0.42, clamp(SH * 0.066, 34, 56)), poleH = Math.min(rx * 10.5, base - top - rx * 1.4);   // real scale: a plate about 38 cm on a pole about 2 m high
      for (let i = 0; i < 8; i++) {
        const col = ORDER_ONE[i];
        slots.push({ i, cx: S.x + 20 + sp * (col + 0.5), base, top: base - poleH * VAR1[col], rx, ry: rx * 0.32, row: 0, scale: 1, col });
      }
      P.floorY = base - rx * 0.9;
      P.rows = 1;
    } else {
      const front = mode === 'wide' ? bottom - coachH - 66 : bottom - Math.max(0.085 * SH, 92), gap = SH * (mode === 'tall' ? 0.17 : 0.2);
      const colW = S.w / 5;
      const rxF = Math.min(colW * 0.4, SH * (mode === 'wide' ? 0.062 : mode === 'compact' ? 0.056 : 0.075), 82), poleF = mode === 'tall' ? SH * 0.45 : Math.min(rxF * 10.5, SH * 0.5);
      const xs = [[0.1, 0.3, 0.5, 0.7, 0.9], [0.2, 0.5, 0.8]];
      for (let i = 0; i < 8; i++) {
        const [c, r] = ORDER_TWO[i], sc = r === 0 ? 1 : 0.8, base = front - r * gap;
        slots.push({ i, cx: S.x + S.w * xs[r][c], base, top: base - poleF * sc * VAR2[r][c], rx: rxF * sc, ry: rxF * sc * 0.32, row: r, scale: sc, col: c });
      }
      P.floorY = front - gap - rxF * 0.8 * 1.15;
      P.rows = 2;
    }
    P.coach = mode === 'wide' ? R(S.x + 16, bottom - coachH - 8, S.w - 32, coachH) : R(S.x + 14, top + 8, S.w - 28, mode === 'tall' ? 168 : 130);
    P.slots = slots;
    P.num = new Array(8).fill(0);
    slots.slice().sort((p, q) => p.cx - q.cx || p.row - q.row).forEach((s, n) => { P.num[s.i] = n + 1; });
    P.banner = { x: S.x + S.w / 2, y: top + SH * (mode === 'wide' ? 0.3 : 0.36) };
    P.skip = R(S.x + S.w - 12 - Math.max(150, mb * 2.4), P.coach.y + P.coach.h - Math.max(52, mb * 0.8) - 8, Math.max(150, mb * 2.4), Math.max(52, mb * 0.8));
    L.play = P;
  }

  // ---- TITLE ---------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && mode !== 'wide' ? 72 : 82, mb), sh = Math.max(S.h < 1200 ? 58 : 64, mb);
    if (mode === 'wide') {
      const drape = clamp(w * 0.11, 40, 150), colW = clamp(w * 0.28, 300, 440), colX = S.x + S.w - drape - 26 - colW;
      const total = bh + 16 + 12 + (bh + 12) * 2 + (sh + 12) * 2;
      const y0 = S.y + Math.max(20, (S.h - total - 40) / 2);
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.prac = R(colX, y, colW, bh); y += bh + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.size = Math.min(104, (colX - S.x - 50) / 6.4);
      T.titleY = S.y + Math.max(64, S.h * 0.15);
      const heroTop = T.titleY + T.size * 2.2;
      T.hero = { x: S.x + (colX - S.x) / 2, y: heroTop, w: colX - S.x - 60, h: S.y + S.h - 70 - heroTop };
      T.credit = { x: S.x + (colX - S.x) / 2, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
    } else {
      const drape = clamp(w * 0.11, 40, 150), bw = Math.min(S.w - 2 * drape - 24, 560), bx = S.x + (S.w - bw) / 2;
      const total = bh + 16 + 12 + (bh + 12) * 2 + (sh + 12) * 2, creditH = 92;
      const bottom = S.y + S.h - creditH;
      let y = bottom - total;
      T.size = Math.min(104, (S.w - 40) / 6.2);
      T.titleY = S.y + Math.max(80, (y - S.y) * 0.1);
      T.play = R(bx, y, bw, bh + 16); y += bh + 16 + 12;
      T.prac = R(bx, y, bw, bh); y += bh + 12;
      T.auto = R(bx, y, bw, bh); y += bh + 12;
      const hw = (bw - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      const heroTop = T.titleY + T.size * 1.9;
      T.hero = { x: S.x + S.w / 2, y: heroTop, w: S.w, h: Math.max(200, bottom - total - heroTop) };
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
      T.col = R(bx, bottom - total, bw, total);
    }
    L.title = T;
  }

  // ---- PRACTICE SETUP ------------------------------------------------------------------------------------------------------
  {
    const U = {}, bh = Math.max(72, mb);
    U.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const pw = Math.min(S.w - 32, 640), ph = Math.min(S.h - 150, mode === 'wide' ? 470 : 640);
    U.panel = R(S.x + (S.w - pw) / 2, S.y + Math.max(Math.max(60, mb) + 40, (S.h - ph) / 2), pw, ph);
    const p = U.panel, rowH = Math.max(86, mb + 14);
    U.row1 = R(p.x + 24, p.y + 150, pw - 48, rowH);
    U.row2 = R(p.x + 24, p.y + 150 + rowH + 14, pw - 48, rowH);
    const sw = Math.max(72, mb);
    for (const [key, r] of [['poles', U.row1], ['speed', U.row2]]) {
      U[key + 'Inc'] = R(r.x + r.w - sw - 10, r.y + (r.h - sw) / 2, sw, sw);
      U[key + 'Dec'] = R(U[key + 'Inc'].x - 150 - sw, U[key + 'Inc'].y, sw, sw);
    }
    U.start = R(p.x + 24, p.y + p.h - 24 - bh, pw - 48, bh);
    L.setup = U;
  }

  // ---- RESULT ----------------------------------------------------------------------------------------------------------------
  {
    const Rr = {}, bh = Math.max(76, mb);
    const pw = Math.min(S.w - 32, mode === 'wide' ? 900 : 620), ph = Math.min(S.h - 40, mode === 'wide' ? 600 : 1000);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode === 'wide') {
      const bwid = (pw - 64 - 12) / 2;
      Rr.again = R(p.x + 32, p.y + p.h - 52 - bh, bwid, bh); Rr.menu = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 18 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 56 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.menu.y - 12 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 22 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings) -----------------------------------------------------------------
  {
    const Dc = {}, bh = Math.max(64, mb), margin = mode === 'wide' ? Math.max(24, S.w * 0.06) : 16;
    const contentW = Math.min(S.w - margin * 2, mode === 'wide' ? 1100 : 820), cx = S.x + (S.w - contentW) / 2;
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

// Which pole does a touch at (x, y) belong to? The nearest plate (or pole body) within a generous reach, else -1.
// `active(i)` says whether pole i is standing. Plates win over poles; a pole body counts down to its base.
export function poleAt(slots, x, y, active) {
  let best = -1, bd = Infinity;
  for (const s of slots) {
    if (!active(s.i)) continue;
    const px = s.cx, py = s.top;
    const dPlate = Math.hypot((x - px) / (s.rx * 1.35), (y - py) / (s.rx * 1.35));
    const dPole = Math.abs(x - s.cx) <= s.rx * 0.9 && y >= s.top && y <= s.base ? Math.abs(x - s.cx) / (s.rx * 1.35) + 0.45 : Infinity;
    const d = Math.min(dPlate, dPole);
    if (d < bd) { bd = d; best = s.i; }
  }
  return bd <= 1.9 ? best : -1;
}

export const MAX_POLES = TUNE.maxPoles;
