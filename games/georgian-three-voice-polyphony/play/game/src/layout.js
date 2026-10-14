// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size, cached by size + insets + text zoom.
//   portrait   HUD in three short rows on top, the pitch ladder fills the rest, a caption strip at the bottom.
//   landscape  one slim HUD row on top, the ladder fills the rest, the caption sits at the bottom edge.
import { PXPS } from './music.js';

export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, tz: 1 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}|${host.tz}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

function build(w, h) {
  const vert = h >= w * 0.95, mode = vert ? 'tall' : w >= h * 1.55 ? 'wide' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn(), backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad, vert };
  const bw = Math.max(64, mb), dz = clamp(host.tz - 1, 0, 2);

  // ---- the stage shared by Sing / Learn / Watch and the Harmony Lab -------------------------------------------------------------------
  const stage = (lab) => {
    const P = {}, top = S.y + 8;
    const mu = 11.5 / Math.max(0.2, host.px), fz = Math.max(mu, 21 * (1 + dz));
    // The caption needs room for its head + body lines at the smallest legible size (never below ~11.5 css px).
    const capH = Math.max((vert ? 118 : 84) + (vert ? 70 : 46) * dz, 30 + fz * 1.45 + (vert ? 3 : 2) * Math.max(mu, fz * 0.88) * 1.24);
    if (vert) {
      P.pause = R(S.x + S.w - 12 - bw, top, bw, bw); P.hint = R(P.pause.x - 12 - bw, top, bw, bw);
      if (!lab) {
        P.score = R(S.x + 12 + backPad, top, P.hint.x - 12 - (S.x + 12 + backPad), bw);
        P.res = R(S.x + 12, top + bw + 8, S.w - 24, 50);
        const lw = (S.w - 24 - 16) / 3;
        P.legend = [0, 1, 2].map((i) => R(S.x + 12 + i * (lw + 8), P.res.y + P.res.h + 8, lw, 54));
        P.hudBottom = P.legend[0].y + P.legend[0].h;
      } else {
        P.exit = R(S.x + 12 + backPad, top, Math.max(120, mb * 1.7), bw);
        P.scale = R(S.x + S.w - 12 - Math.max(150, S.w * 0.28), top, Math.max(150, S.w * 0.28), bw);
        P.hint = P.scale; P.pause = null;
        P.drone = R(P.exit.x + P.exit.w + 10, top, P.scale.x - 10 - (P.exit.x + P.exit.w + 10), bw);
        P.hudBottom = top + bw;
      }
      P.cap = R(S.x + 12, S.y + S.h - 10 - capH, S.w - 24, capH);
      {                                                      // the choir band: three singers between the HUD rows and the ladder
        const avail = P.cap.y - 10 - (P.hudBottom + 10), chH = Math.max(0, Math.min(clamp(S.h * 0.16, 150, 290), avail * 0.34));
        P.choir = R(S.x + 8, P.hudBottom + 8, S.w - 16, chH);
        const fy = P.hudBottom + 10 + (chH > 0 ? chH + 6 : 0);
        P.field = R(S.x + 6, fy, S.w - 12, P.cap.y - 10 - fy);
      }
    } else {
      P.pause = R(S.x + S.w - 12 - bw, top, bw, bw); P.hint = R(P.pause.x - 12 - bw, top, bw, bw);
      if (!lab) {
        P.score = R(S.x + 12 + backPad, top, 220, bw);
        const lw = clamp((S.w - 24 - 220 - backPad - 2 * bw - 40) * 0.5 / 3, 120, 200);
        const lx0 = P.hint.x - 12 - (lw * 3 + 16);
        P.legend = [0, 1, 2].map((i) => R(lx0 + i * (lw + 8), top + 2, lw, bw - 4));
        P.res = R(P.score.x + P.score.w + 12, top, lx0 - 12 - (P.score.x + P.score.w + 12), bw);
        P.hudBottom = top + bw;
      } else {
        P.exit = R(S.x + 12 + backPad, top, Math.max(120, mb * 1.7), bw);
        P.scale = R(S.x + S.w - 12 - Math.max(200, S.w * 0.2), top, Math.max(200, S.w * 0.2), bw);
        P.hint = P.scale; P.pause = null;
        P.drone = R(P.exit.x + P.exit.w + 10, top, Math.max(200, S.w * 0.2), bw);
        P.hudBottom = top + bw;
      }
      P.cap = R(S.x + 12, S.y + S.h - 8 - capH, S.w - 24, capH);
      {
        const avail = P.cap.y - 6 - (P.hudBottom + 8), chH = Math.max(0, Math.min(clamp(S.h * 0.23, 120, 230), avail * 0.4));
        P.choir = R(S.x + 8, P.hudBottom + 6, S.w - 16, chH);
        const fy = P.hudBottom + 8 + (chH > 0 ? chH + 6 : 0);
        P.field = R(S.x + 6, fy, S.w - 12, P.cap.y - 6 - fy);
      }
    }
    P.playX = P.field.x + P.field.w * (vert ? 0.27 : 0.18);
    P.right = P.field.x + P.field.w - 6;
    P.look = (P.right - P.playX) / PXPS;                   // seconds of music visible ahead of the now line
    return P;
  };
  L.play = stage(false); L.lab = stage(true);

  // ---- TITLE -----------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh0 = Math.max(S.h < 1200 && mode !== 'wide' ? 74 : 84, mb), sh0 = Math.max(vert ? (S.h < 1200 ? 60 : 66) : 64, mb);
    const stack0 = bh0 + 28 + (bh0 + 12) * 2 + (sh0 + 12) * 2, k = clamp(Math.min(host.tz, 1.8, (vert ? S.h * 0.62 : S.h - 70) / stack0), 1, 1.8);
    T.k = k; const bh = bh0 * k;
    if (!vert) {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW, y0 = S.y + Math.max(16, (S.h - (bh * 3 + 12 * 2 + 16 + 12 + 64 * 2 + 12 + 50)) / 2);
      T.size = Math.min(120, (colX - S.x - 60) / 6);
      T.titleY = S.y + Math.max(76, S.h * 0.16);
      const hy = T.titleY + T.size * 1.3, hh = S.y + S.h - 70 - hy;
      T.hero = R(S.x + 24, hy, colX - S.x - 48, hh);
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.free = R(colX, y, colW, bh); y += bh + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2, sh = sh0 * k;
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 16 };
    } else {
      const bwid = Math.min(S.w - 64, 560), bx = S.x + (S.w - bwid) / 2, sh = sh0 * k;
      const total = bh + 16 + 12 + (bh + 12) * 2 + (sh + 12) * 2, bottom = S.y + S.h - 92;
      let y = bottom - total;
      T.size = Math.min(124, (S.w - 40) / 6);
      T.titleY = S.y + Math.max(90, (y - S.y) * 0.1);
      const hy = T.titleY + T.size * 1.35;
      T.hero = R(S.x + 16, hy, S.w - 32, Math.max(60, y - 14 - hy));
      T.play = R(bx, y, bwid, bh + 16); y += bh + 16 + 12;
      T.free = R(bx, y, bwid, bh); y += bh + 12;
      T.auto = R(bx, y, bwid, bh); y += bh + 12;
      const hw = (bwid - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
    }
    L.title = T;
  }

  // ---- SONGS ---------------------------------------------------------------------------------------------------------------------
  {
    const G = {};
    const hdrH = Math.max(76, mb) + 8;
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + hdrH + 24, bot = S.y + S.h - 16;
    const cols = mode === 'tall' ? 1 : 3;
    const rows = Math.ceil(6 / cols), gx = 14, gy = 14;
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, ch = Math.min(250, (bot - top - gy * (rows - 1)) / rows);
    G.cols = cols; G.cards = [];
    for (let i = 0; i < 6; i++) { const c = i % cols, r = Math.floor(i / cols); G.cards.push(R(S.x + 16 + c * (cw + gx), top + r * (ch + gy), cw, ch)); }
    L.songs = G;
  }

  // ---- SONG -------------------------------------------------------------------------------------------------------------------
  {
    const D = {};
    D.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    const bh = Math.max(88, mb), ph = Math.max(64, mb);
    if (mode !== 'tall') {
      const colW = clamp(w * 0.3, 340, 460), colX = S.x + S.w - 32 - colW;
      D.info = R(S.x + 24, S.y + 100, colX - S.x - 48, S.h - 130);
      let y = S.y + Math.max(100, (S.h - (ph + bh * 3 + 12 * 3 + 40)) / 2);
      D.partsLabel = { x: colX, y: y - 4 };
      D.parts = [0, 1, 2].map((i) => R(colX + i * ((colW - 16) / 3 + 8), y + 14, (colW - 16) / 3, ph)); y += ph + 14 + 28;
      D.learn = R(colX, y, colW, bh); y += bh + 12; D.perform = R(colX, y, colW, bh); y += bh + 12; D.watch = R(colX, y, colW, bh);
    } else {
      const bwid = Math.min(S.w - 48, 600), bx = S.x + (S.w - bwid) / 2, total = bh * 3 + 24 + ph + 14 + 40;
      let y = S.y + S.h - 24 - total;
      D.info = R(S.x + 24, S.y + 100, S.w - 48, y - 12 - (S.y + 100));
      D.partsLabel = { x: bx, y: y - 4 };
      D.parts = [0, 1, 2].map((i) => R(bx + i * ((bwid - 16) / 3 + 8), y + 14, (bwid - 16) / 3, ph)); y += ph + 14 + 28;
      D.learn = R(bx, y, bwid, bh); y += bh + 12; D.perform = R(bx, y, bwid, bh); y += bh + 12; D.watch = R(bx, y, bwid, bh);
    }
    L.piece = D;
  }

  // ---- RESULT --------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(80, mb);
    const pw = Math.min(S.w - 32, mode !== 'tall' ? 980 : 640), ph = Math.min(S.h - 40, mode !== 'tall' ? 620 : 1160);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode !== 'tall') {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 32 - bh, bwid, bh); Rr.songs = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.songs.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 12 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 56 - bh, bwid, bh); Rr.songs = R(p.x + 32, Rr.menu.y - 12 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.songs.y - 12 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 24 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens ----------------------------------------------------------------------------------------------------------
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

export function menuRects(L, n, extraTop = 120) {
  const S = L.S, bh = Math.max(76, L.mb), gap = 12, pw = Math.min(S.w - 40, 560), ph = extraTop + n * bh + (n - 1) * gap + 36;
  const panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph), btns = [];
  for (let i = 0; i < n; i++) btns.push(R(panel.x + 28, panel.y + extraTop + i * (bh + gap), pw - 56, bh));
  return { panel, btns };
}

// Pitch <-> screen height. `win` = { lo, hi } cents shown; the field keeps a margin so the extreme lines are never under an edge.
export const FIELD_PAD = 26;
export const pitchY = (F, win, c) => F.y + F.h - FIELD_PAD - ((c - win.lo) / (win.hi - win.lo)) * (F.h - 2 * FIELD_PAD);
export const pitchC = (F, win, y) => win.lo + ((F.y + F.h - FIELD_PAD - y) / (F.h - 2 * FIELD_PAD)) * (win.hi - win.lo);
