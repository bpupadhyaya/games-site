// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): HUD on top, long lanes, drums low.
//   compact  portrait tablet / 4:3 either way / small phones: HUD on top, shorter lanes.
//   wide     landscape (w >= 1.45 h): a status card on the left, the stage in the middle, a button card on the right.
import { DRUMS, PLAYABLE } from './music.js';

export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));  // a thumb-sized height in units

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const TALL = [0.9, 1.0, 1.15, 1.2];                                                // shell height factor per drum (same as art.js)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);          // the safe rectangle
  const mb = minBtn(), gap = 16;
  const backPad = host.back > 0 ? host.back + 8 : 0;                               // the host's floating back button owns the top-left corner
  const L = { w, h, mode, S, mb, backPad };

  // ---- the stage: 4 drums on a gentle arc, a lane above each -------------------------------------------------------------
  const stage = (ax, ay, aw, ah, opts = {}) => {
    const stag = mode !== 'wide', ov = opts.overlap ?? (mode === 'tall' ? 0.74 : mode === 'compact' ? 0.68 : 0.5), capFrac = opts.capFrac ?? 0.15;
    const sizes = DRUMS.slice(0, PLAYABLE).map((d) => d.size), sum = sizes.reduce((a, b) => a + b, 0);
    const padX = aw * 0.01, floorY = ay + ah - 30;
    let drums = [], ovNow = ov;
    for (let tries = 0; tries < 12; tries++) {                                      // shrink the heads until the whole row fits on the stage
      let x = ax; drums = [];
      sizes.forEach((sz, i) => {
        const cell = (aw - padX * 2) * sz / sum, cx = ax + padX + (x - ax - padX) + cell / 2;
        const u = (cx - (ax + aw / 2)) / (aw / 2);                                   // -1..1 across the stage
        const rx = Math.min(cell * ovNow, ah * capFrac * Math.pow(sz, 0.8)) * (1 - 0.06 * u * u);
        const ry = rx * 0.62, cy = floorY - rx * (0.95 * TALL[i] + 0.62) - rx * 0.16 * u * u - (stag && i % 2 === 0 ? rx * 0.8 : 0);
        drums.push({ i, cx, cy, rx, ry, sh: rx * 0.95 * TALL[i], u, cell, lw: Math.min(rx * 1.75, cell * 0.94), back: stag && i % 2 === 0 });
        x += cell;
      });
      if (drums[0].cx - drums[0].rx >= ax + 6 && drums[3].cx + drums[3].rx <= ax + aw - 6) break;
      ovNow -= 0.02;
    }
    const maxRx = Math.max(...drums.map((d) => d.rx)), cyBase = drums.reduce((s, d) => s + d.cy, 0) / drums.length;
    return { drums, laneTop: opts.laneTop ?? ay, cyBase, rowH: maxRx * 3, bottom: ay + ah, ax, aw };
  };
  // Free play on a tall screen: the four drums in a 2 x 2 circle, as big as the width allows.
  const grid = (ax, ay, aw, ah) => {
    const cw = aw / 2, rh = ah / 2;
    const rxFor = (sz) => Math.min(cw * 0.54 * (0.82 + 0.18 * sz), (rh - 20) / 2.6), rxM = rxFor(1.28), rowSp = Math.min(rh, rxM * 2.6), y0 = ay + Math.max(0, (ah - (rowSp + rxM * 2.7)) / 2);
    const place = (i, col, row) => { const rx = rxFor(DRUMS[i].size); return { i, cx: ax + cw * (col + 0.5), cy: y0 + rowSp * row + rxM * 1.05 + 8, rx, ry: rx * 0.62, sh: rx * 0.95, u: 0 }; };
    const drums = [place(0, 0, 0), place(1, 1, 0), place(2, 0, 1), place(3, 1, 1)];
    return { drums, laneTop: ay, cyBase: ay + rh * 1.4, rowH: rh * 2, bottom: ay + ah, ax, aw, grid: true, floorTop: drums[0].cy + drums[0].sh * 0.7 };
  };
  L.stageFor = stage;

  // ---- PLAY / LEARN / AUTO ---------------------------------------------------------------------------------------------------
  {
    const P = { };
    const bw = Math.max(64, mb);
    if (mode === 'wide') {
      const pw = clamp(w * 0.17, 168, 320);
      const dy = backPad ? backPad + 4 : 0;
      P.left = R(S.x + 16, S.y + 16 + dy, pw, S.h - 32 - dy);
      P.right = R(S.x + S.w - 16 - pw, S.y + 16, pw, S.h - 32);
      const sx = P.left.x + pw + 18, sw = P.right.x - 18 - sx;
      P.stage = stage(sx, S.y, sw, S.h, { laneTop: S.y + 78, rowFrac: 0.34 });
      P.hudTop = R(sx, S.y + 12, sw, 56);
      P.pause = R(P.right.x + 14, P.right.y + P.right.h - 14 - bw, pw - 28, bw);
      P.hint = R(P.right.x + 14, P.pause.y - 14 - bw, pw - 28, bw);
      P.bell = { x: P.right.x + pw / 2, y: P.right.y + 150, r: 40 };
      P.ens = R(P.right.x + 14, P.right.y + 214, pw - 28, P.hint.y - (P.right.y + 214) - 14);
      P.score = R(P.left.x + 14, P.left.y + 14, pw - 28, 120);
      P.stats = R(P.left.x + 14, P.left.y + 150, pw - 28, P.left.h - 164);
    } else {
      const top = S.y + 10, hudH = 196;
      P.hudTop = R(S.x + 12 + backPad, top, S.w - 24 - backPad * 2 + (backPad ? 0 : 0), hudH);
      P.pause = R(S.x + S.w - 12 - Math.max(64, mb), top + 6, Math.max(64, mb), Math.max(64, mb));
      P.hint = R(P.pause.x - 12 - Math.max(64, mb), top + 6, Math.max(64, mb), Math.max(64, mb));
      P.score = R(S.x + 12 + backPad, top, P.hint.x - 12 - (S.x + 12 + backPad), 78);
      P.ens = R(S.x + 20, top + hudH - 56, S.w - 40 - 84, 44);
      P.bell = { x: S.x + S.w - 20 - 34, y: top + hudH - 34, r: mode === 'tall' ? 30 : 26 };
      P.stage = stage(S.x, S.y, S.w, S.h, { laneTop: top + hudH + 6, rowFrac: mode === 'tall' ? 0.25 : 0.3 });
    }
    L.play = P;
  }

  // ---- FREE PLAY (same stage, no lanes, a control bar) ----------------------------------------------------------------------
  {
    const F = {};
    const bh = Math.max(64, mb);
    if (mode === 'wide') {
      const pw = clamp(w * 0.17, 168, 320);
      F.right = R(S.x + S.w - 16 - pw, S.y + 16, pw, S.h - 32);
      const dy = backPad ? backPad + 4 : 0;
      F.left = R(S.x + 16, S.y + 16 + dy, pw, S.h - 32 - dy);
      const sx = F.left.x + pw + 18, sw = F.right.x - 18 - sx;
      F.stage = grid(sx, S.y + 12, sw, S.h - 24);
      let y = F.right.y + 16;
      F.metro = R(F.right.x + 14, y, pw - 28, bh); y += bh + 12;
      y += 30; F.tempoDec = R(F.right.x + 14, y, (pw - 28 - 12) / 2, bh); F.tempoInc = R(F.tempoDec.x + F.tempoDec.w + 12, y, F.tempoDec.w, bh); y += bh + 12;
      F.echo = R(F.right.x + 14, y, pw - 28, bh); y += bh + 12;
      F.exit = R(F.right.x + 14, F.right.y + F.right.h - 14 - bh, pw - 28, bh);
      F.info = R(F.left.x + 14, F.left.y + 14, pw - 28, F.left.h - 28);
      F.bell = null;
    } else {
      const top = S.y + 10;
      F.exit = R(S.x + 12 + backPad, top, Math.max(120, mb * 1.7), bh);
      const rowY = S.y + S.h - bh - 14, gap = 10, W = S.w - 24;
      const wm = W * 0.34, wt = W * 0.17, we = W - wm - wt * 2 - gap * 3;
      F.metro = R(S.x + 12, rowY, wm, bh); F.tempoDec = R(F.metro.x + wm + gap, rowY, wt, bh); F.tempoInc = R(F.tempoDec.x + wt + gap, rowY, wt, bh);
      F.echo = R(F.tempoInc.x + wt + gap, rowY, we, bh);
      F.stage = grid(S.x + 8, S.y + bh + 110, S.w - 16, rowY - 44 - (S.y + bh + 110));
      F.info = R(S.x + 12 + backPad + F.exit.w + 12, top, S.w - 24 - backPad - F.exit.w - 12 - 12, bh);
    }
    L.free = F;
  }

  // ---- TITLE ------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = Math.max(S.h < 1200 && mode !== 'wide' ? 74 : 84, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW, y0 = S.y + Math.max(24, (S.h - (bh * 4 + 12 * 3 + 12 + 70 + 12 + bh * 2 + 12 + 50)) / 2);
      T.size = Math.min(118, (colX - S.x - 60) / 4.3);
      T.titleY = S.y + Math.max(70, S.h * 0.14);
      const tb = T.titleY + T.size * 1.5 + 50, rr = Math.min((colX - S.x) * 0.36, (S.y + S.h - 50 - tb) / 3.4);
      T.hero = { x: S.x + (colX - S.x) / 2, y: tb + rr * 1.45, r: rr };
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.free = R(colX, y, colW, bh); y += bh + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2, sh = Math.max(64, mb);
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
    } else {
      const bw = Math.min(S.w - 64, 560), bx = S.x + (S.w - bw) / 2, sh = Math.max(S.h < 1200 ? 60 : 66, mb);
      const total = bh + 12 + 16 + (bh + 12) * 2 + (sh + 12) * 2;
      const creditH = 92;
      const bottom = S.y + S.h - creditH;
      let y = bottom - total;
      T.size = Math.min(132, (S.w - 60) / 4.3);
      T.titleY = S.y + Math.max(80, (y - S.y) * 0.1);
      const tb = T.titleY + T.size * 1.5 + 50, rr = Math.max(40, Math.min(S.w * 0.3, (y - 14 - tb) / 3.4));
      T.hero = { x: S.x + S.w / 2, y: tb + rr * 1.45, r: rr };
      T.play = R(bx, y, bw, bh + 16); y += bh + 16 + 12;
      T.free = R(bx, y, bw, bh); y += bh + 12;
      T.auto = R(bx, y, bw, bh); y += bh + 12;
      const hw = (bw - 12) / 2;
      T.how = R(bx, y, hw, sh); T.rules = R(bx + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(bx, y, hw, sh); T.settings = R(bx + hw + 12, y, hw, sh);
      T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
      T.col = R(bx, bottom - total, bw, total);
    }
    L.title = T;
  }

  // ---- SONGS (a list/grid of the six pieces) -----------------------------------------------------------------------------------------
  {
    const G = {};
    const hdrH = Math.max(76, mb) + 8;
    G.back = R(S.x + 12 + (backPad ? backPad : 0), S.y + 12, Math.max(120, mb * 1.7), Math.max(60, mb));
    G.titleY = S.y + 12 + Math.max(60, mb) / 2;
    const top = S.y + hdrH + 24, bot = S.y + S.h - 16;
    const cols = mode === 'wide' ? 3 : mode === 'compact' && w > h ? 3 : mode === 'compact' ? 2 : 1;
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
    if (mode === 'wide') {
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
    const pw = Math.min(S.w - 32, mode === 'wide' ? 980 : 640), ph = Math.min(S.h - 40, mode === 'wide' ? 620 : 1160);
    Rr.panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const p = Rr.panel;
    if (mode === 'wide') {
      const bwid = (pw - 64 - 24) / 3;
      Rr.again = R(p.x + 32, p.y + p.h - 32 - bh, bwid, bh); Rr.songs = R(Rr.again.x + bwid + 12, Rr.again.y, bwid, bh); Rr.menu = R(Rr.songs.x + bwid + 12, Rr.again.y, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 32 - bh - 20 };
    } else {
      const bwid = pw - 64;
      Rr.menu = R(p.x + 32, p.y + p.h - 56 - bh, bwid, bh); Rr.songs = R(p.x + 32, Rr.menu.y - 12 - bh, bwid, bh); Rr.again = R(p.x + 32, Rr.songs.y - 12 - bh, bwid, bh);
      Rr.more = { x: p.x + p.w / 2, y: p.y + p.h - 24 };
    }
    L.result = Rr;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings): header, scrolling viewport, nav -----------------------------------------------------
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
    Dc.scrollbar = R(Dc.viewport.x + Dc.viewport.w - 14, Dc.viewport.y, 14, Dc.viewport.h);
    Dc.titleY = S.y + 12 + bh / 2;
    Dc.contentW = contentW;
    L.doc = Dc;
  }

  // ---- CALIBRATE -----------------------------------------------------------------------------------------------------------------------------------------
  {
    const C = {};
    const bh = Math.max(72, mb);
    C.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), bh);
    const bw = Math.min(S.w - 48, 520);
    C.use = R(S.x + (S.w - bw) / 2, S.y + S.h - 24 - bh, bw, bh);
    C.retry = R(C.use.x, C.use.y - 12 - bh, bw, bh);
    C.pad = { x: S.x + S.w / 2, y: S.y + S.h * (mode === 'wide' ? 0.5 : 0.44), r: Math.min(S.w, S.h) * (mode === 'wide' ? 0.2 : 0.26) };
    L.calib = C;
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

// Which drum and zone does a touch at (x, y) hit? Returns { drum, zone: 'D' | 'K', d } or null. A touch is always given to the
// nearest drum head (by elliptical distance), so a thumb that lands a little outside still plays.
export function hitTest(stage, x, y, zoneDon, zoneRim) {
  let best = null;
  for (const dr of stage.drums) {
    const dx = (x - dr.cx) / dr.rx, dy = (y - (dr.cy + dr.ry * 0.1)) / (dr.ry * 1.3);
    const d = Math.hypot(dx, dy);
    if (d <= zoneRim && (!best || d < best.d)) best = { drum: dr.i, zone: d < zoneDon ? 'D' : 'K', d, dr };
  }
  return best;
}
