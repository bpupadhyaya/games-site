// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// layoutFor(w, h) returns every rectangle for that size and is cached, so a frame never recomputes it. Shapes:
//   port    portrait: opponent card, the board, your card, a button bar. Spare height grows the cards and the gaps.
//   wide2   landscape with room for two side cards: opponent + info on the left, you + buttons on the right.
//   wide1   landscape that is too narrow for two cards: the board on the left, one stacked card on the right.
// All screens use the whole visible area (U = the screen minus notch / home indicator).
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button, in virtual units (main.js keeps this current). px = css px per unit.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.52 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const land = w >= h, m = 10;
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const L = { w, h, land, ins, U, m, text: 1 };
  const backSz = ins.back ? Math.max(ins.back, 56) + 8 : 0;
  L.backBox = ins.back ? R(U.x0, U.y0, backSz, backSz) : R(U.x0, U.y0, 0, 0);
  // the board: a square slab; `grid` is the playing area inside its frame
  const slabGrid = (x, y, s) => ({ x: x + s * 0.076, y: y + s * 0.076, size: s * 0.848 });
  const btn = {};
  if (!land) {
    const barH = U.h < 1100 ? 62 : 74, bottom = Math.max(m, ins.b > 12 ? 4 : 0) + 4;
    const barY = U.y1 - bottom - barH;
    const topPad = Math.max(m, 4) + (U.h < 1100 ? 22 : 30);
    const short = U.h < 1100, Pmin = short ? 70 : 96, msgH = short ? 42 : 56;
    const B = Math.min(U.w - 2 * m, U.h - topPad - bottom - barH - msgH - 2 * Pmin - 6 * m);
    const P = clamp((U.h - B - barH - msgH - topPad - bottom - 5 * m) / 2, Pmin, 190);
    const spare = Math.max(0, U.h - (B + 2 * P + barH + msgH + topPad + bottom + 5 * m));
    const gap = spare / 4 + m;
    let y = U.y0 + topPad + spare / 8;
    L.opp = R(U.x0 + m, y, U.w - 2 * m, P); y += P + gap;
    L.board = { x: U.x0 + (U.w - B) / 2, y, s: B }; y += B + gap * 0.6;
    L.msg = R(U.x0 + m, y, U.w - 2 * m, msgH); y += msgH + gap * 0.4;
    L.you = R(U.x0 + m, y, U.w - 2 * m, P);
    L.info = null;
    L.bar = R(U.x0 + m, barY, U.w - 2 * m, barH);
    const bw3 = (L.bar.w - 2 * 10) / 3, bw4 = (L.bar.w - 3 * 10) / 4;
    Object.assign(btn, {
      menu: R(L.bar.x, barY, bw3, barH), undo: R(L.bar.x + bw3 + 10, barY, bw3, barH), hint: R(L.bar.x + 2 * (bw3 + 10), barY, bw3, barH),
      auto: { exit: R(L.bar.x, barY, bw4, barH), pause: R(L.bar.x + bw4 + 10, barY, bw4, barH), dec: R(L.bar.x + 2 * (bw4 + 10), barY, bw4, barH), inc: R(L.bar.x + 3 * (bw4 + 10), barY, bw4, barH) },
    });
    L.mode = 'port';
  } else {
    const B1 = U.h - 2 * m, colTop = U.y0 + 44;                       // columns start below the kit's preview pill
    const two = U.w - B1 - 6 * m >= 2 * 250;
    if (two) {
      const B = B1, pw = clamp((U.w - B - 4 * m) / 2, 250, 520), total = B + 2 * pw + 4 * m, x0 = U.x0 + (U.w - total) / 2;
      L.board = { x: x0 + pw + 2 * m, y: U.y0 + (U.h - B) / 2, s: B };
      const colH = U.y1 - m - colTop;
      const left = R(x0, colTop, pw, colH), right = R(x0 + pw + B + 3 * m, colTop, pw, colH);
      const cardH = clamp(colH * 0.29, 170, 210), msgH = clamp(colH * 0.16, 84, 120);
      L.opp = R(left.x, left.y, left.w, cardH);
      L.info = R(left.x, left.y + cardH + m, left.w, left.h - cardH - m);
      L.you = R(right.x, right.y, right.w, cardH);
      L.msg = R(right.x, right.y + cardH + m, right.w, msgH);
      const bh = clamp((right.h - cardH - msgH - 4 * m) / 3, 54, 92);
      const by = right.y + right.h - 3 * bh - 2 * m;
      const slot = (i) => R(right.x, by + i * (bh + m), right.w, bh);
      Object.assign(btn, { menu: slot(0), undo: slot(1), hint: slot(2) });
      const a4 = (i) => R(right.x, right.y + right.h - 4 * bh - 3 * m + i * (bh + m), right.w, bh);
      btn.auto = { exit: a4(0), pause: a4(1), dec: a4(2), inc: a4(3) };
      L.badge = { x: left.x + left.w - 10, y: U.y0 + 4, align: 'right' };
      L.mode = 'wide2';
    } else {
      const pwMin = 340, B = Math.min(B1, U.w - pwMin - 3 * m);
      const pw = clamp(U.w - B - 3 * m, 230, 460), total = B + pw + m, x0 = U.x0 + (U.w - total) / 2;
      L.board = { x: x0, y: U.y0 + (U.h - B) / 2, s: B };
      const col = R(x0 + B + m, colTop, pw, U.y1 - m - colTop);
      const bh = clamp((col.h - 5 * m) / 6.6, 50, 72), cardH = clamp(col.h * 0.22, 112, 150);
      L.opp = R(col.x, col.y, col.w, cardH);
      L.you = R(col.x, col.y + cardH + m, col.w, cardH);
      const by = col.y + col.h - 3 * bh - 2 * m;
      L.msg = R(col.x, L.you.y + cardH + m, col.w, Math.max(60, by - m - (L.you.y + cardH + m)));
      L.info = null; L.mode = 'wide1';
      Object.assign(btn, { menu: R(col.x, by, col.w, bh), undo: R(col.x, by + bh + m, col.w, bh), hint: R(col.x, by + 2 * (bh + m), col.w, bh) });
      const a4h = clamp((col.h - 2 * cardH - 5 * m) / 4, 44, 66), ay = col.y + col.h - 4 * a4h - 3 * m;
      btn.auto = { exit: R(col.x, ay, col.w, a4h), pause: R(col.x, ay + a4h + m, col.w, a4h), dec: R(col.x, ay + 2 * (a4h + m), col.w, a4h), inc: R(col.x, ay + 3 * (a4h + m), col.w, a4h) };
      L.badge = { x: col.x + col.w - 10, y: U.y0 + 4, align: 'right' };
    }
  }
  L.BTN = btn;
  L.grid = slabGrid(L.board.x, L.board.y, L.board.s);
  L.cell = L.grid.size; // replaced per n by the view: cell = grid.size / n
  L.menu = (hasSave) => buildMenu(L, !!hasSave);
  L.reader = buildReader(L);
  L.over = buildOver(L);
  L.settings = buildSettings(L);
  return L;
}

// ---- menu --------------------------------------------------------------------------------------------------------------
function buildMenu(L, hasSave) {
  const { w, h, U, ins } = L, M = { rows: {}, hero: null, card: null, brand: null };
  const pad = 10;
  const need = (f) => (hasSave ? 70 * f : 0) + 3 * (56 * f + pad) + 82 * f + pad + 64 * f + pad + 2 * (60 * f + pad);
  const place = (x, aw, y, f) => {
    let yy = y;
    const row = (key, hh, xx = x, ww = aw) => { M.rows[key] = R(xx, yy, ww, hh); };
    if (hasSave) { row('resume', 66 * f); yy += 66 * f + pad * f; }
    row('play', 82 * f); yy += 82 * f + pad * f;
    for (const k of ['variant', 'level', 'side']) { row(k, 56 * f); yy += 56 * f + pad * f; }
    row('auto', 64 * f); yy += 64 * f + pad * f;
    const hw = (aw - pad) / 2;
    row('howto', 60 * f, x, hw); row('rules', 60 * f, x + hw + pad, hw); yy += 60 * f + pad * f;
    row('settings', 60 * f, x, hw); row('about', 60 * f, x + hw + pad, hw); yy += 60 * f + pad * f;
    return yy;
  };
  if (!L.land || U.w < 760) {
    const aw = Math.min(U.w - 40, 560), x = U.x0 + (U.w - aw) / 2;
    const brandH = 54, availH = U.h - brandH - 14 - Math.max(0, ins.b > 0 ? 4 : 0);
    const f = clamp((availH - 220) / need(1), 0.74, 1);
    const ctlH = need(f);
    const heroH = clamp(availH - ctlH - 10, 0, 640);
    const spare = Math.max(0, availH - ctlH - heroH);
    const y0 = U.y0 + 10 + spare / 2;
    M.hero = R(U.x0, y0, U.w, heroH);
    place(x, aw, y0 + heroH + 10, f);
    M.brand = { x: U.x0 + U.w / 2, y: U.y1 - 40 };
  } else {
    const aw = clamp(U.w * 0.4, 380, 560), x = U.x1 - aw - 30;
    const availH = U.h - 24 - 54;
    const f = clamp(availH / need(1), 0.6, 1.08);
    const ctlH = need(f), y = U.y0 + 12 + (availH - ctlH) / 2;
    M.card = R(x - 20, y - 14, aw + 40, ctlH + 14);
    place(x, aw, y, f);
    M.hero = R(U.x0 + 10, U.y0 + 10, x - 20 - U.x0 - 20, U.h - 20 - 112);
    M.brand = { x: U.x0 + (x - 20 - U.x0) / 2, y: U.y1 - 40 };
  }
  return M;
}

// ---- reader (Rules / How to Play / About) --------------------------------------------------------------------------------
function buildReader(L) {
  const { h, U, ins, m } = L, short = L.land && U.h < 520, barH = short ? 58 : 72;
  const barY = U.y1 - barH - Math.max(8, ins.b > 12 ? 2 : 8);
  const panelTop = U.y0 + m;
  const panel = R(U.x0 + m, panelTop, U.w - 2 * m, barY - 10 - panelTop);
  const headH = short ? 66 : 78, backPad = ins.back ? Math.max(ins.back, 56) + 10 : 0;
  const nw = Math.min(280, (panel.w - 16) / 2);
  const nav = { back: R(panel.x + (panel.w - 2 * nw - 16) / 2, barY, nw, barH), next: R(panel.x + (panel.w - 2 * nw - 16) / 2 + nw + 16, barY, nw, barH) };
  const viewport = R(panel.x + 18, panel.y + headH + 8, panel.w - 36 - 14, panel.h - headH - 8 - 40);
  return {
    panel, viewport, nav, headH, titleX: panel.x + 28 + backPad,
    header: { textDec: R(panel.x + panel.w - 24 - 100 - 10 - 100, panel.y + 6, 100, headH - 16), textInc: R(panel.x + panel.w - 24 - 100, panel.y + 6, 100, headH - 16) },
    scrollbar: R(panel.x + panel.w - 30, viewport.y, 22, viewport.h), counterY: panel.y + panel.h - 14, cx: panel.x + panel.w / 2,
  };
}

// ---- result card ---------------------------------------------------------------------------------------------------------
function buildOver(L) {
  const { w, h, U } = L, cw = Math.min(U.w - 24, 600), ch = Math.min(U.h - 24, 640);
  const card = R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch);
  const bw = Math.min(cw - 60, 420);
  return { card, again: R(card.x + (cw - bw) / 2, card.y + ch - 236, bw, 84), menu: R(card.x + (cw - bw) / 2, card.y + ch - 142, bw, 70), more: { x: card.x + cw / 2, y: card.y + ch - 26 } };
}

// ---- settings ------------------------------------------------------------------------------------------------------------
function buildSettings(L) {
  const { U, m, ins } = L, barH = 72;
  const barY = U.y1 - barH - Math.max(8, ins.b > 12 ? 2 : 8);
  const panel = R(U.x0 + m, U.y0 + m, U.w - 2 * m, barY - 10 - (U.y0 + m));
  const backPad = ins.back ? Math.max(ins.back, 56) + 10 : 0;
  const bw = Math.min(320, panel.w - 40);
  const cols = panel.w >= 900 ? 3 : panel.w >= 640 && L.land ? 2 : 1;
  return {
    panel, titleX: panel.x + 28 + backPad, cols, back: R(panel.x + (panel.w - bw) / 2, barY, bw, barH),
    area: R(panel.x + 20, panel.y + 84, panel.w - 40, panel.h - 84 - 16),
  };
}

// Board coordinates on the screen. `flip` turns the board half a turn (when the player has the second side, their pieces stay at the bottom).
const geoCache = new Map();
export function boardGeo(L, n, flip) {
  const key = `${L.key}|${n}|${flip ? 1 : 0}`;
  let g = geoCache.get(key);
  if (g) return g;
  const { x: gx, y: gy, size } = L.grid, cell = size / n;
  const rcOf = (i) => { const r = Math.floor(i / n), c = i % n; return flip ? [n - 1 - r, n - 1 - c] : [r, c]; };
  g = {
    n, cell, gx, gy, size,
    center: (i) => { const [r, c] = rcOf(i); return { x: gx + (c + 0.5) * cell, y: gy + (r + 0.5) * cell }; },
    rect: (i) => { const [r, c] = rcOf(i); return { x: gx + c * cell, y: gy + r * cell, w: cell, h: cell }; },
    squareAt: (x, y) => {
      if (x < gx || y < gy || x >= gx + size || y >= gy + size) return -1;
      let c = Math.floor((x - gx) / cell), r = Math.floor((y - gy) / cell);
      if (flip) { r = n - 1 - r; c = n - 1 - c; }
      return (r + c) % 2 === 1 ? r * n + c : -1;
    },
  };
  geoCache.set(key, g); if (geoCache.size > 60) geoCache.delete(geoCache.keys().next().value);
  return g;
}
