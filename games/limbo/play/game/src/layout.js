// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Shapes:
//   tall     portrait phone (h >= 1.5 w): HUD on top, the beach scene, a big gauge panel under the thumb.
//   compact  portrait tablet / 4:3 either way.
//   wide     landscape (w >= 1.2 h): HUD on top, the scene, a slim gauge strip along the bottom.
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

  // ---- PLAY ----------------------------------------------------------------------------------------------------------------
  {
    const P = {}, bw = Math.max(64, mb);
    const hudH = mode === 'wide' ? Math.max(86, bw + 22) : 112;
    P.hud = R(S.x, S.y, S.w, hudH);
    P.pause = R(S.x + S.w - 12 - bw, S.y + 10, bw, bw);
    P.think = R(P.pause.x - 12 - bw, S.y + 10, bw, bw);
    P.score = { x: S.x + 16 + backPad, y: mode === 'wide' ? S.y + hudH / 2 - 28 : S.y + 12 };
    P.round = mode === 'wide' ? { x: S.x + 16 + backPad + 190, y: S.y + hudH / 2 + 4 } : { x: S.x + 16 + backPad, y: S.y + hudH - 34 };
    P.tries = { x: P.think.x - 16, y: S.y + 10 + bw / 2 };
    const gaugeH = mode === 'wide' ? Math.max(104, mb + 40) : clamp(S.h * 0.125, 168, 214);
    P.gaugeH = gaugeH;
    P.panel = R(S.x + 10, S.y + S.h - gaugeH - 8, S.w - 20, gaugeH);
    const px = P.panel.x, py = P.panel.y, pw = P.panel.w;
    if (mode === 'wide') {
      const half = (pw - 36) / 2;
      P.leanG = R(px + 16, py + 40, half, 26);
      P.balG = R(px + 20 + half, py + 40, half, 26);
      P.leanLabel = { x: P.leanG.x, y: py + 20 }; P.balLabel = { x: P.balG.x, y: py + 20 };
      P.hintLine = { x: px + pw / 2, y: py + gaugeH - 18 };
    } else {
      P.leanG = R(px + 22, py + 44, pw - 44, 26);
      P.balG = R(px + 22, py + 108, pw - 44, 26);
      P.leanLabel = { x: P.leanG.x, y: py + 22 }; P.balLabel = { x: P.balG.x, y: py + 86 };
      P.hintLine = { x: px + pw / 2, y: py + gaugeH - 20 };
    }
    // The scene: unit U (one standing body height) in virtual units, ground line gy, bar x.
    const top = S.y + hudH, bottom = P.panel.y - 2;
    const span = mode === 'tall' ? 1.6 : 1.75;
    let U, gy;
    if (mode === 'wide') {
      U = Math.min((S.w - 80) / span, (bottom - top - 64) / 1.1, S.w * 0.3);
      gy = bottom - 0.1 * U - 10;
    } else {
      const fill = mode === 'compact' ? 0.64 : 0.52;
      U = Math.min((S.w - 80) / span, (bottom - top) * fill);
      gy = top + (bottom - top) * (mode === 'compact' ? 0.82 : 0.85);
    }
    U = Math.max(120, U);
    let bx = mode === 'wide' ? S.x + S.w * 0.71 : S.x + S.w / 2 + 0.4 * U;
    bx = clamp(bx, S.x + 1.2 * U + 70, S.x + S.w - 0.55 * U - 10);
    P.U = U; P.gy = gy; P.bx = bx;
    P.hor = Math.max(top + (bottom - top) * 0.3, gy - U * 0.7);
    P.stage = R(S.x, top, S.w, bottom - top);
    P.lightsY = top + 10;
    P.banner = { x: S.x + S.w / 2, y: top + (gy - top) * 0.42 };
    P.coach = mode === 'wide' ? R(S.x + 16 + backPad, top + 6, (top + 190 <= gy - 1.1 * U) ? Math.min(S.w * 0.4, 540) : Math.max(240, Math.min(S.w * 0.36, 540, bx - 1.0 * U - 16 - backPad - S.x)), 176) : R(S.x + 14, top + 30, S.w - 28, 190);
    P.skip = R(P.coach.x + P.coach.w - 12 - Math.max(140, mb * 2.1), P.coach.y + 8, Math.max(140, mb * 2.1), Math.max(52, mb * 0.8));
    P.ready = { x: bx - 0.7 * U, y: gy - U * 1.12 };
    L.play = P;
  }

  // ---- TITLE ---------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && mode !== 'wide' ? 74 : 84, mb), sh = Math.max(S.h < 1200 ? 58 : 64, mb), g = 12;
    const total = bh + 14 + g + (bh - 10) + g + (bh - 10) + g + (sh + g) * 2 - g;
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 330, 460), colX = S.x + S.w - 30 - colW;
      const y0 = S.y + Math.max(16, (S.h - total - 44) / 2);
      let y = y0;
      T.play = R(colX, y, colW, bh + 14); y += bh + 14 + g;
      const hw = (colW - g) / 2;
      T.party = R(colX, y, hw, bh - 10); T.prac = R(colX + hw + g, y, hw, bh - 10); y += bh - 10 + g;
      T.auto = R(colX, y, colW, bh - 10); y += bh - 10 + g;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + g, y, hw, sh); y += sh + g;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + g, y, hw, sh);
      T.size = Math.min(124, (colX - S.x - 60) / 4.2);
      T.titleY = S.y + Math.max(70, S.h * 0.16);
      const heroTop = T.titleY + T.size * 0.9;
      T.hero = { x: S.x, y: heroTop, w: colX - S.x - 10, h: S.y + S.h - 56 - heroTop };
      T.credit = { x: S.x + (colX - S.x) / 2, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
    } else {
      const bw = Math.min(S.w - 48, 560), bx = S.x + (S.w - bw) / 2, creditH = 92;
      const bottom = S.y + S.h - creditH;
      let y = bottom - total;
      T.size = Math.min(150, (S.w - 40) / 3.9);
      T.titleY = S.y + Math.max(76, (y - S.y) * 0.1) + T.size * 0.35;
      T.play = R(bx, y, bw, bh + 14); y += bh + 14 + g;
      const hw = (bw - g) / 2;
      T.party = R(bx, y, hw, bh - 10); T.prac = R(bx + hw + g, y, hw, bh - 10); y += bh - 10 + g;
      T.auto = R(bx, y, bw, bh - 10); y += bh - 10 + g;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + g, y, hw, sh); y += sh + g;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + g, y, hw, sh);
      const heroTop = T.titleY + T.size * 1.0;
      T.hero = { x: S.x, y: heroTop, w: S.w, h: Math.max(200, bottom - total - heroTop - 10) };
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
      T.col = R(bx, bottom - total, bw, total);
    }
    L.title = T;
  }

  // ---- SETUP (practice bar height / party players) -------------------------------------------------------------------------
  {
    const U = {}, bh = Math.max(72, mb);
    U.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const pw = Math.min(S.w - 32, 640), ph = Math.min(S.h - 150, mode === 'wide' ? 470 : 600);
    U.panel = R(S.x + (S.w - pw) / 2, S.y + Math.max(Math.max(60, mb) + 40, (S.h - ph) / 2), pw, ph);
    const p = U.panel, rowH = Math.max(86, mb + 14);
    U.row1 = R(p.x + 24, p.y + 150, pw - 48, rowH);
    U.row2 = R(p.x + 24, p.y + 150 + rowH + 14, pw - 48, rowH);
    const sw = Math.max(72, mb);
    for (const [key, r] of [['a', U.row1], ['b', U.row2]]) {
      U[key + 'Inc'] = R(r.x + r.w - sw - 10, r.y + (r.h - sw) / 2, sw, sw);
      U[key + 'Dec'] = R(U[key + 'Inc'].x - 150 - sw, U[key + 'Inc'].y, sw, sw);
    }
    U.start = R(p.x + 24, p.y + p.h - 24 - bh, pw - 48, bh);
    L.setup = U;
  }

  // ---- RESULT ----------------------------------------------------------------------------------------------------------------
  {
    const Rr = {}, bh = Math.max(76, mb);
    const pw = Math.min(S.w - 32, mode === 'wide' ? 900 : 620), ph = Math.min(S.h - 40, mode === 'wide' ? 600 : 960);
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
