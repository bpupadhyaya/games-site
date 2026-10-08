// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size and is cached by size + insets. Three shapes:
//   tall     portrait phone (h >= 1.5 w): HUD on top, long lanes, the instrument low.
//   compact  portrait tablet / 4:3 either way / small phones: HUD on top, shorter lanes.
//   wide     landscape (w >= 1.2 h): a status card on the left, the stage in the middle, a button card on the right.
// The instrument is a "rack": the bars of a tuning (kind 'bars') or the three gongs the player can take over (kind 'colo').
// L.rackFor(area, kind, n) builds it for a play/free area; piece screens ask for racks too.
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));  // a thumb-sized height in units

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GONG_R = { 7: 0.86, 8: 0.96, 9: 1.28 };                           // radius factors of kenong, kempul, gong

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

// ---- racks ---------------------------------------------------------------------------------------------------------------------------------------------
// Area: { ax, ay, aw, ah, laneTop, barH? }. Returns { kind, items, frame, laneTop, bottom, ax, aw, cell, up }.
// An item is { inst, kind: 'bar' | 'kenong' | 'kempul' | 'gong', cx, cy, w, h } (bars) or { inst, kind, cx, cy, r } (gongs).
function makeRack(a, kind, n) {
  const { ax, ay, aw, ah } = a, bottom = ay + ah;
  if (kind === 'bars') {
    const hmax = clamp(a.barH ?? ah * 0.15, 96, 240), skirt = hmax * 0.2, pad = hmax * 0.12;
    const cell0 = (aw - Math.max(24, aw * 0.07)) / n, bw = Math.min(cell0 * 0.84, hmax * 0.66), cell = Math.min(cell0, bw / 0.84);
    const total = cell * n, x0 = ax + (aw - total) / 2;
    const fh = hmax + pad * 2, fy = bottom - 14 - skirt - fh, cy = fy + fh / 2;
    const items = [];
    for (let i = 0; i < n; i++) items.push({ inst: i, kind: 'bar', cx: x0 + cell * (i + 0.5), cy, w: bw, h: hmax * (1 - 0.26 * (n > 1 ? i / (n - 1) : 0)) });
    return { kind, n, items, frame: { x: x0 - cell * 0.22, y: fy, w: total + cell * 0.44, h: fh, skirt }, laneTop: a.laneTop ?? ay, bottom, ax, aw, cell, cy, top: fy, up: Math.max(150, ah * 0.1) };
  }
  // 'colo': kenong, kempul, gong in a row, sized by their radius factors
  const ids = [7, 8, 9], fs = ids.map((i) => GONG_R[i]), sum = fs.reduce((s, v) => s + v, 0);
  const r0 = Math.min((aw - 40) / (sum * 2 * 1.32), ah * 0.2, a.maxR ?? 120);
  let x = ax + (aw - sum * 2 * r0 * 1.32) / 2;
  const items = ids.map((id, k) => { const r = r0 * fs[k], cell = r * 2 * 1.32, cx = x + cell / 2; x += cell; return { inst: id, kind: ['kenong', 'kempul', 'gong'][k], cx, cy: bottom - 20 - r * 1.2, r }; });
  return { kind, n: 3, items, frame: null, laneTop: a.laneTop ?? ay, bottom, ax, aw, cell: r0 * 2.6, cy: bottom - 20 - r0 * 1.3, top: bottom - 20 - r0 * 3.2, up: 120 };
}
// Free play: the three gongs above the bars (everything is touchable, no lanes).
function makeFree(a, n) {
  const gh = a.ah * 0.45, g = makeRack({ ...a, ay: a.ay, ah: gh, maxR: 130 }, 'colo', 3), b = makeRack({ ...a, ay: a.ay + gh, ah: a.ah - gh, barH: (a.ah - gh) * 0.5 }, 'bars', n);
  return { kind: 'free', n, items: [...b.items, ...g.items], frame: b.frame, laneTop: a.ay, bottom: a.ay + a.ah, ax: a.ax, aw: a.aw, cell: b.cell, cy: b.cy, top: g.top, up: 40 };
}

// Which instrument does a touch at (x, y) play? Returns { item, d } or null. A touch is always given to the nearest instrument, so a
// thumb that lands a little outside still plays.
export function hitTest(rack, x, y) {
  let best = null;
  for (const it of rack.items) {
    let d;
    if (it.kind === 'bar') {
      const dx = Math.abs(x - it.cx) / (rack.cell * 0.5);
      if (dx > 1 || y < it.cy - it.h * 0.55 - rack.up || y > rack.bottom) continue;
      d = dx * 0.9;
    } else {
      d = Math.hypot((x - it.cx) / (it.r * 1.3), (y - it.cy) / (it.r * 1.3));
      if (d > 1) continue;
    }
    if (!best || d < best.d) best = { item: it, d };
  }
  return best;
}

function build(w, h) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);          // the safe rectangle
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;                               // the host's floating back button owns the top-left corner
  const L = { w, h, mode, S, mb, backPad };
  const rackCache = new Map();
  L.rackFor = (which, kind, n) => {
    const a = L[which].area, key = `${which}|${kind}|${n}`;
    let r = rackCache.get(key);
    if (!r) { r = which === 'free' ? makeFree(a, n) : makeRack(a, kind, n); rackCache.set(key, r); }
    return r;
  };

  // ---- PLAY / LEARN / AUTO ---------------------------------------------------------------------------------------------------
  {
    const P = {};
    const bw = Math.max(64, mb);
    if (mode === 'wide') {
      const pw = clamp(w * 0.22, 210, 340);
      const dy = backPad ? backPad + 4 : 0;
      P.left = R(S.x + 16, S.y + 16 + dy, pw, S.h - 32 - dy);
      P.right = R(S.x + S.w - 16 - pw, S.y + 16, pw, S.h - 32);
      const sx = P.left.x + pw + 18, sw = P.right.x - 18 - sx;
      P.area = { ax: sx, ay: S.y, aw: sw, ah: S.h, laneTop: S.y + 84, barH: S.h * 0.24 };
      P.pause = R(P.right.x + 14, P.right.y + P.right.h - 14 - bw, pw - 28, bw);
      P.hint = R(P.right.x + 14, P.pause.y - 14 - bw, pw - 28, bw);
      const rR = Math.min(pw * 0.3, 74);
      P.ring = { x: P.right.x + pw / 2, y: P.right.y + 22 + rR * 1.15, r: rR };
      const cw = (pw - 28) / 3, iy = P.ring.y + rR * 1.2 + 26, ir = Math.min(cw * 0.46, 40);
      P.icons = ['kethuk', 'kenong', 'kempul', 'gong', 'slenthem', 'peking'].map((key, i) => ({ key, x: P.right.x + 14 + cw * (i % 3 + 0.5), y: iy + Math.floor(i / 2 / 1.5) * (ir * 2 + 30) + ir, r: ir }));
      P.iconsBottom = iy + (ir * 2 + 30) * 2;
      P.ens = R(P.right.x + 14, P.iconsBottom + 4, pw - 28, Math.max(40, P.hint.y - 14 - (P.iconsBottom + 4)));
      P.score = R(P.left.x + 14, P.left.y + 14, pw - 28, 120);
      P.hudTop = R(sx, S.y + 12, sw, 56);
    } else {
      const top = S.y + 10;
      const rR = clamp(S.w * 0.075, 38, 56), bandH = rR * 2 + 20;
      const sq = Math.max(64, mb);
      P.pause = R(S.x + S.w - 12 - sq, top + 6, sq, sq);
      P.hint = R(P.pause.x - 12 - sq, top + 6, sq, sq);
      P.score = R(S.x + 12 + backPad, top, P.hint.x - 12 - (S.x + 12 + backPad), 82);
      P.chipsY = top + 106;
      const bandY = top + 126;
      P.ring = { x: S.x + 16 + rR * 1.12, y: bandY + bandH / 2, r: rR };
      const ix0 = P.ring.x + rR * 1.3 + 8, remW = S.x + S.w - 12 - ix0, cw = remW / 6, ir = Math.min(cw * 0.46, bandH * 0.38);
      P.icons = ['kethuk', 'kenong', 'kempul', 'gong', 'slenthem', 'peking'].map((key, i) => ({ key, x: ix0 + cw * (i + 0.5), y: bandY + bandH / 2 - 4, r: ir }));
      P.bandY = bandY; P.bandH = bandH;
      P.ens = R(S.x + 20, top + 96, S.w - 40, 22);
      P.hudH = 126 + bandH + 6;
      P.hudTop = R(S.x + 12, top, S.w - 24, P.hudH);
      P.area = { ax: S.x, ay: S.y, aw: S.w, ah: S.h, laneTop: top + P.hudH + 4, barH: S.h * (mode === 'tall' ? 0.15 : 0.19) };
    }
    L.play = P;
  }

  // ---- FREE PLAY (the whole instrument, no lanes, a control bar) ------------------------------------------------------------------
  {
    const F = {};
    const bh = Math.max(64, mb);
    if (mode === 'wide') {
      const pw = clamp(w * 0.19, 190, 340);
      F.right = R(S.x + S.w - 16 - pw, S.y + 16, pw, S.h - 32);
      const dy = backPad ? backPad + 4 : 0;
      F.left = R(S.x + 16, S.y + 16 + dy, pw, S.h - 32 - dy);
      const sx = F.left.x + pw + 18, sw = F.right.x - 18 - sx;
      F.area = { ax: sx, ay: S.y + 16, aw: sw, ah: S.h - 32, laneTop: S.y + 16 };
      let y = F.right.y + 16;
      F.metro = R(F.right.x + 14, y, pw - 28, bh); y += bh + 12;
      y += 30; F.tempoDec = R(F.right.x + 14, y, (pw - 28 - 12) / 2, bh); F.tempoInc = R(F.tempoDec.x + F.tempoDec.w + 12, y, F.tempoDec.w, bh); y += bh + 12;
      F.echo = R(F.right.x + 14, y, pw - 28, bh); y += bh + 12;
      F.tuning = R(F.right.x + 14, y, pw - 28, bh);
      F.exit = R(F.right.x + 14, F.right.y + F.right.h - 14 - bh, pw - 28, bh);
      F.info = R(F.left.x + 14, F.left.y + 14, pw - 28, F.left.h - 28);
    } else {
      const top = S.y + 10;
      F.exit = R(S.x + 12 + backPad, top, Math.max(120, mb * 1.7), bh);
      const rowY = S.y + S.h - bh - 14, gap = 10, W = S.w - 24;
      const wm = W * 0.2, wt = W * 0.115, we = W * 0.2, wu = W - wm - wt * 2 - we - gap * 4;
      F.metro = R(S.x + 12, rowY, wm, bh); F.tempoDec = R(F.metro.x + wm + gap, rowY, wt, bh); F.tempoInc = R(F.tempoDec.x + wt + gap, rowY, wt, bh);
      F.echo = R(F.tempoInc.x + wt + gap, rowY, we, bh); F.tuning = R(F.echo.x + we + gap, rowY, wu, bh);
      F.area = { ax: S.x + 8, ay: S.y + bh + 70, aw: S.w - 16, ah: rowY - 40 - (S.y + bh + 70), laneTop: S.y + bh + 70 };
      F.info = R(S.x + 12 + backPad + F.exit.w + 12, top, S.w - 24 - backPad - F.exit.w - 12 - 12, bh);
    }
    L.free = F;
  }

  // ---- TITLE ------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const squat = S.h < 1200 && mode !== 'wide';                                  // iPad-like portrait: shorter buttons so the hero gets the room
    const bh = Math.max(squat ? 62 : S.h < 1200 && mode !== 'wide' ? 74 : 84, mb);
    if (mode === 'wide') {
      const colW = clamp(w * 0.3, 300, 460), colX = S.x + S.w - 32 - colW, y0 = S.y + Math.max(24, (S.h - (bh * 4 + 12 * 3 + 12 + 70 + 12 + bh * 2 + 12 + 50)) / 2);
      T.size = Math.min(104, (colX - S.x - 60) / 5.2);
      T.titleY = S.y + Math.max(70, S.h * 0.14);
      const tb = T.titleY + T.size * 1.5 + 50, rr = Math.min((colX - S.x) * 0.3, (S.y + S.h - 50 - tb) / 3.8);
      T.hero = { x: S.x + (colX - S.x) / 2, y: tb + rr * 2.55, r: rr };
      let y = y0;
      T.play = R(colX, y, colW, bh + 16); y += bh + 16 + 12;
      T.free = R(colX, y, colW, bh); y += bh + 12;
      T.auto = R(colX, y, colW, bh); y += bh + 12;
      const hw = (colW - 12) / 2, sh = Math.max(64, mb);
      T.how = R(colX, y, hw, sh); T.rules = R(colX + hw + 12, y, hw, sh); y += sh + 12;
      T.about = R(colX, y, hw, sh); T.settings = R(colX + hw + 12, y, hw, sh);
      T.credit = { x: S.x + (colX - S.x) / 2, y: S.y + S.h - 16 };
      T.col = R(colX, y0, colW, y + sh - y0);
    } else {
      const bw = Math.min(S.w - 64, 560), bx = S.x + (S.w - bw) / 2, sh = Math.max(squat ? 52 : S.h < 1200 ? 60 : 66, mb);
      const total = bh + 12 + 16 + (bh + 12) * 2 + (sh + 12) * 2;
      const creditH = squat ? 70 : 92;
      const bottom = S.y + S.h - creditH;
      let y = bottom - total;
      T.size = Math.min(squat ? 88 : 124, (S.w - 60) / 5.4);
      T.titleY = S.y + Math.max(squat ? 64 : 80, (y - S.y) * (squat ? 0.06 : 0.1));
      const tb = T.titleY + T.size * 1.5 + (squat ? 36 : 50), rr = Math.max(40, Math.min(S.w * 0.25, (y - 10 - tb) / (squat && S.h < 1100 ? 3.15 : 3.4)));
      T.hero = { x: S.x + S.w / 2, y: tb + rr * 2.55, r: rr };
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
