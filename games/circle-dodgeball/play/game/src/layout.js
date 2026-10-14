// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size, cached by size + insets. Two shapes:
//   tall   portrait and squarish: header and score strip on top, the court below, then the player tray and the controls.
//   wide   landscape (w >= 1.2 h): the court on the left (as large as fits), header, score, tray and controls in a column on the right.
import { camAspect } from './art.js';

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
  const asp = camAspect();
  const bw = Math.max(64, mb);

  // ---- PLAY -----------------------------------------------------------------------------------------------------------------------------
  {
    const P = {};
    if (mode === 'wide') {
      const aw = clamp(Math.min(S.w * 0.66, (S.h - 16) / asp), 300, 1700), ah = aw * asp;
      P.arena = R(S.x + 8, S.y + (S.h - ah) / 2, aw, ah);
      const rx = P.arena.x + aw + 16, rw = Math.max(240, S.x + S.w - 12 - rx);
      const top = S.y + 10;
      P.pause = R(rx + rw - bw, top, bw, bw);
      P.hint = R(P.pause.x - 10 - bw, top, bw, bw);
      P.title = R(rx, top, P.hint.x - 10 - rx, bw);
      P.bar = R(rx, top + bw + 10, rw, 54);
      const bh = clamp(S.h * 0.15, Math.max(76, mb), 130);
      const bottom = S.y + S.h - 12;
      P.btnB = R(rx, bottom - bh, rw, Math.max(66, mb));
      P.btnA = R(rx, P.btnB.y - 10 - bh, rw, bh);
      const trayTop = P.bar.y + P.bar.h + 10;
      P.tray = R(rx, trayTop, rw, Math.max(80, P.btnA.y - 10 - trayTop));
      P.rail = { x: 0, y: 0, w: P.arena.x, h };
    } else {
      const x0 = S.x + 12, cw = S.w - 24, top = S.y + 8;
      P.pause = R(S.x + S.w - 12 - bw, top, bw, bw);
      P.hint = R(P.pause.x - 10 - bw, top, bw, bw);
      const bx = S.x + 12 + backPad;
      P.title = R(bx, top, P.hint.x - 10 - bx, bw);
      P.bar = R(x0, top + bw + 8, cw, 54);
      const barBottom = P.bar.y + P.bar.h;
      const avail = S.y + S.h - 12 - barBottom;
      const minRest = 96 + 84 + 66 + 3 * 12;
      let aw = Math.min(S.w - 16, (avail - minRest) / asp);
      aw = clamp(aw, 260, 1700);
      const ah = aw * asp;
      const gap = clamp(10 + (avail - ah - minRest) * 0.03, 10, 28);
      const rem = avail - ah - gap * 3;
      const trayH = clamp(rem * 0.34, 96, 190);
      const ctl = rem - trayH;
      const bh = clamp(ctl * 0.6, 84, 150), th = clamp(ctl - 10 - bh, 66, 110);
      const used = ah + gap * 3 + trayH + bh + 10 + th;
      const y0 = barBottom + gap + Math.max(0, (avail - used) * 0.2);
      P.arena = R(S.x + (S.w - aw) / 2, y0, aw, ah);
      P.tray = R(x0, P.arena.y + ah + gap, cw, trayH);
      const cy = P.tray.y + trayH + gap;
      P.btnA = R(x0, cy, cw, bh);
      P.btnB = R(x0, cy + bh + 10, cw, th);
      P.rail = null;
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
      T.credit = { x: colX + colW / 2, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
      T.art = R(S.x, S.y, colX - 24 - S.x, S.h);
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
      T.art = R(S.x, S.y, S.w, bottom - total - S.y - 12);
    }
    L.title = T;
  }

  // ---- VENUES (role + venue cards) ---------------------------------------------------------------------------------------------------
  {
    const G = {};
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + Math.max(76, mb) + 24, mw = Math.min(S.w - 32, 760), mx = S.x + (S.w - mw) / 2, mh = Math.max(66, mb);
    G.modes = [R(mx, top, (mw - 12) / 2, mh), R(mx + (mw + 12) / 2, top, (mw - 12) / 2, mh)];
    const cy = top + mh + 40, bot = S.y + S.h - 14;
    const cols = mode === 'wide' ? 4 : 2, rows = Math.ceil(4 / cols), gx = 12, gy = 12;
    const cw = (S.w - 32 - gx * (cols - 1)) / cols, chh = Math.min(mode === 'wide' ? 520 : 600, (bot - cy - gy * (rows - 1)) / rows);
    const gridH = rows * chh + gy * (rows - 1), yOff = Math.max(0, Math.min(60, (bot - cy - gridH) / 2));
    G.cards = [];
    for (let i = 0; i < 4; i++) { const c = i % cols, r = Math.floor(i / cols); G.cards.push(R(S.x + 16 + c * (cw + gx), cy + yOff + r * (chh + gy), cw, chh)); }
    L.venues = G;
  }

  // ---- RESULT ------------------------------------------------------------------------------------------------------------------------------
  {
    const Rr = {};
    const bh = Math.max(76, mb);
    const pw = Math.min(S.w - 24, mode === 'wide' ? 1040 : 660), ph = Math.min(S.h - 24, mode === 'wide' ? 680 : 860);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode === 'wide') {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 28 - bh, bwid, bh); Rr.rooms = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.rooms.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 28 - bh - 14 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 44 - bh, bwid, bh); Rr.rooms = R(p.x + 32, Rr.menu.y - 10 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.rooms.y - 10 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 18 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings) ----------------------------------------------------------------------------
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
