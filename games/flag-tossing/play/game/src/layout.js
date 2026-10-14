// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): HUD on top, the figure card under it, sky, then the bearers on the flagstones.
//   compact  portrait tablet / 4:3 either way: the same stack, smaller bearers.
//   wide     landscape (w >= 1.2 h): the same stack with a shorter card and a smaller coach strip.

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


function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad };

  // ---- PLAY ----------------------------------------------------------------------------------------------------------------------------------
  {
    const P = {}, bw = Math.max(64, mb);
    const hudH = mode === 'wide' ? Math.max(88, bw + 20) : 150;
    P.hud = R(S.x, S.y, S.w, hudH);
    P.pause = R(S.x + S.w - 12 - bw, S.y + 10, bw, bw);
    P.think = R(P.pause.x - 12 - bw, S.y + 10, bw, bw);
    P.score = { x: S.x + 16 + backPad, y: S.y + (mode === 'wide' ? 4 : 12) };
    P.flow = { x: S.x + 16 + backPad, y: S.y + hudH - (mode === 'wide' ? 24 : 30) };
    P.drops = { x: P.think.x - 18, y: S.y + 10 + bw / 2 };           // right-aligned row of flag icons
    const inline = mode === 'wide';                               // landscape: the figure card sits inside the HUD bar
    P.inline = inline;
    const top = S.y + hudH, cardH = mode === 'wide' ? 112 : 150;
    if (inline) {
      const x0 = S.x + 16 + backPad + 236, x1 = P.drops.x - 285;
      P.card = R(x0, S.y + 6, Math.max(300, x1 - x0), hudH - 12);
    } else P.card = R(S.x + 12, top + 4, S.w - 24, cardH);
    const bottom = S.y + S.h, below = bottom - (inline ? top : P.card.y + P.card.h);
    const H = clamp(below * (mode === 'wide' ? 0.42 : 0.31), 130, mode === 'wide' ? 230 : 350);
    P.H = H;
    P.foot = bottom - Math.max(26, H * 0.14);
    P.floorY = P.foot - H * 0.5;
    P.grip = P.foot - H * 1.22;                                       // where a held flag's pole is centred, and where throws start
    P.skyTop = (inline ? top : P.card.y + P.card.h) + 26;
    P.rise = Math.max(160, P.grip - P.skyTop);
    P.reach = P.rise * 0.8;                                           // drag length that means the highest throw
    P.stage = R(S.x, P.skyTop - 26, S.w, bottom - (P.skyTop - 26));
    P.coach = mode === 'wide' ? R(S.x + 16, P.skyTop - 8, Math.min(S.w - 32, 760), 96) : R(S.x + 14, P.skyTop - 6, S.w - 28, 150);
    P.skip = R(P.coach.x + P.coach.w - Math.max(150, mb * 2.2) - 10, P.coach.y + P.coach.h - Math.max(52, mb * 0.8) - 8, Math.max(150, mb * 2.2), Math.max(52, mb * 0.8));
    P.banner = { x: S.x + S.w / 2, y: P.skyTop + (P.grip - P.skyTop) * 0.38 };
    P.ruler = { x: S.x + 22 + (host.back > 0 && mode === 'wide' ? 0 : 0) };
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
      T.hero = { x: S.x + (colX - S.x) / 2, y: S.y + 20, w: colX - S.x - 60, h: S.y + S.h - 36 - (S.y + 20) };
      T.credit = { x: colX + colW / 2, y: S.y + S.h - 12 };
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
    const rowH = Math.max(86, mb + 14);
    const pw = Math.min(S.w - 32, 640), ph = Math.min(S.h - 150, 170 + (rowH + 14) * 3 + bh + 60);
    U.panel = R(S.x + (S.w - pw) / 2, S.y + Math.max(Math.max(60, mb) + 40, (S.h - ph) / 2), pw, ph);
    const p = U.panel;
    const sw = Math.max(72, mb);
    ['fig', 'ens', 'speed'].forEach((key, i) => {
      const r = R(p.x + 24, p.y + 130 + i * (rowH + 14), pw - 48, rowH);
      U['row_' + key] = r;
      U[key + 'Inc'] = R(r.x + r.w - sw - 10, r.y + (r.h - sw) / 2, sw, sw);
      U[key + 'Dec'] = R(U[key + 'Inc'].x - 220 - sw, U[key + 'Inc'].y, sw, sw);
    });
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

