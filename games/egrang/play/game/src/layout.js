// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size, cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): HUD on top, the road in the middle, the step meter and the sideways rail low.
//   compact  portrait tablet / 4:3 either way: the same with a shorter road.
//   wide     landscape (w >= 1.2 h): a status card on the left, the road + meter + rail in the middle, buttons on the right.
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

  // ---- PLAY ----------------------------------------------------------------------------------------------------------------------
  {
    const P = {};
    const bw = Math.max(64, mb);
    const meterH = 46, railH = 70;
    if (mode === 'wide') {
      const pw = clamp(w * 0.125, 150, 230), dy = backPad ? backPad + 4 : 0;
      P.left = R(S.x + 16, S.y + 16 + dy, pw, S.h - 32 - dy);
      P.right = R(S.x + S.w - 16 - pw, S.y + 16, pw, S.h - 32);
      const sx = P.left.x + pw + 18, sw = P.right.x - 18 - sx;
      P.rail = R(sx + 10, S.y + S.h - 14 - railH, sw - 20, railH);
      P.meter = R(sx + 10, P.rail.y - 10 - meterH, sw - 20, meterH);
      P.track = R(sx + 10, S.y + 12, sw - 20, 32);
      P.stage = R(sx, P.track.y + P.track.h + 4, sw, P.meter.y - 8 - (P.track.y + P.track.h + 4));
      P.pause = R(P.right.x + 14, P.right.y + P.right.h - 14 - bw, pw - 28, bw);
      P.hint = R(P.right.x + 14, P.pause.y - 14 - bw, pw - 28, bw);
      P.bump = R(P.right.x + 14, P.hint.y - 14 - bw, pw - 28, bw);
      P.score = R(P.left.x + 14, P.left.y + 14, pw - 28, P.left.h - 28);
    } else {
      const top = S.y + 10, hudH = mode === 'tall' ? 112 : 100;
      P.pause = R(S.x + S.w - 12 - bw, top + 4, bw, bw);
      P.hint = R(P.pause.x - 12 - bw, top + 4, bw, bw);
      P.score = R(S.x + 12 + backPad, top, P.hint.x - 12 - (S.x + 12 + backPad), hudH);
      P.track = R(S.x + 16, top + hudH + 8, S.w - 32, 32);
      P.rail = R(S.x + 16, S.y + S.h - 14 - railH, S.w - 32, railH);
      P.meter = R(S.x + 16, P.rail.y - 10 - meterH, S.w - 32, meterH);
      P.stage = R(S.x, P.track.y + P.track.h + 6, S.w, P.meter.y - 8 - (P.track.y + P.track.h + 6));
      P.bump = R(S.x + S.w - 16 - 150, P.stage.y + P.stage.h - 70 - 10, 150, 70);
    }
    L.play = P;
  }

  // ---- TITLE ---------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && mode !== 'wide' ? 74 : 84, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW;
      const total = bh + 16 + 12 + bh + 12 + Math.max(64, mb) * 2 + 12;
      const y0 = S.y + Math.max(24, (S.h - total - 40) / 2);
      T.size = Math.min(104, (colX - S.x - 60) / 4.4);
      T.titleY = S.y + Math.max(70, S.h * 0.15);
      T.hero = R(S.x + 16, T.titleY + T.size * 1.1, colX - S.x - 40, S.y + S.h - 60 - (T.titleY + T.size * 1.1));
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2, sh = Math.max(64, mb);
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 16 };
    } else {
      const bw = Math.min(S.w - 64, 560), bx = S.x + (S.w - bw) / 2, sh = Math.max(S.h < 1200 ? 60 : 66, mb);
      const total = bh + 16 + 12 + bh + 12 + (sh + 12) * 2;
      const bottom = S.y + S.h - 92;
      let y = bottom - total;
      T.size = Math.min(124, (S.w - 60) / 4.6);
      T.titleY = S.y + Math.max(80, (y - S.y) * 0.1);
      T.hero = R(S.x + 10, T.titleY + T.size * 1.15, S.w - 20, y - 10 - (T.titleY + T.size * 1.15));
      T.play = R(bx, y, bw, bh + 16); y += bh + 16 + 12;
      T.auto = R(bx, y, bw, bh); y += bh + 12;
      const hw = (bw - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
    }
    L.title = T;
  }

  // ---- COURSES (a grid of the eight courses) -------------------------------------------------------------------------------------
  {
    const G = {};
    const hdrH = Math.max(76, mb) + 8;
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + hdrH + 24, bot = S.y + S.h - 16;
    const cols = mode === 'wide' ? 4 : mode === 'compact' && w > h ? 4 : 2;
    const rows = Math.ceil(8 / cols), gx = 14, gy = 14;
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, ch = Math.min(300, (bot - top - gy * (rows - 1)) / rows);
    G.cols = cols; G.cards = [];
    for (let i = 0; i < 8; i++) { const c = i % cols, r = Math.floor(i / cols); G.cards.push(R(S.x + 16 + c * (cw + gx), top + r * (ch + gy), cw, ch)); }
    L.courses = G;
  }

  // ---- COURSE DETAIL (choose how to play it) -------------------------------------------------------------------------------------
  {
    const D = {};
    D.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const bh = Math.max(88, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 340, 460), colX = S.x + S.w - 32 - colW;
      D.info = R(S.x + 24, S.y + 100, colX - S.x - 48, S.h - 130);
      let y = S.y + (S.h - (bh * 3 + 24)) / 2;
      D.learn = R(colX, y, colW, bh); y += bh + 12; D.race = R(colX, y, colW, bh); y += bh + 12; D.watch = R(colX, y, colW, bh);
    } else {
      const bw = Math.min(S.w - 48, 600), bx = S.x + (S.w - bw) / 2, total = bh * 3 + 24;
      let y = S.y + S.h - 24 - total;
      D.info = R(S.x + 24, S.y + 100, S.w - 48, y - 12 - (S.y + 100));
      D.learn = R(bx, y, bw, bh); y += bh + 12; D.race = R(bx, y, bw, bh); y += bh + 12; D.watch = R(bx, y, bw, bh);
    }
    L.detail = D;
  }

  // ---- RESULT ---------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(80, mb);
    const pw = Math.min(S.w - 32, mode === 'wide' ? 980 : 640), ph = Math.min(S.h - 40, mode === 'wide' ? 620 : 1100);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode === 'wide') {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 32 - bh, bwid, bh); Rr.courses = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.courses.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 32 - bh - 20 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 56 - bh, bwid, bh); Rr.courses = R(p.x + 32, Rr.menu.y - 12 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.courses.y - 12 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 24 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings) --------------------------------------------------------------------
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

// The camera for the road stage: pixels per metre from the stage size.
export function stageScale(stage) {
  const laneDy = stage.h > stage.w * 1.15 ? 0.5 : 0.38;
  return clamp(Math.min(stage.w / (stage.h > stage.w * 1.15 ? 4.7 : 5.6), stage.h / (2.95 + 3 * laneDy + 0.45)), 50, 190);
}
