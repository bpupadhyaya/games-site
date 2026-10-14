// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// `layoutFor(w, h)` returns every rectangle for that size (cached).
//   portrait   header plate, the five players (3 + 2 circle on tall screens, one row on wide ones), message, button bar
//   landscape  the players on the left, a side card on the right with the header, the message and the buttons
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, dpr: 2 };

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

// Seat design (scale s = 1): face centre (0,0) radius ~46; fists at (+-34, 84) radius 24; name plate at y = 128.
const SEAT_H = 212, SEAT_W = 150;
function seatsFor(stage) {
  const out = [];
  // three arrangements; the one that lets the people be biggest wins
  const sRow = Math.min(stage.w / 5 / SEAT_W, (stage.h * 0.92) / SEAT_H, 2.2);
  const sTwo = Math.min(stage.w / 3 / SEAT_W, (stage.h / 2.1) / SEAT_H, 2.4) * 0.95;
  const sFive = Math.min(stage.w / 2 / SEAT_W, stage.h / 3.0 / 226, 2.4) * 0.98 * (226 / SEAT_H);
  if (sRow >= sTwo && sRow >= sFive) {                              // one row, a gentle arc
    const pitch = stage.w / 5, s = sRow, cy = stage.y + stage.h / 2 - 30 * s;
    for (let i = 0; i < 5; i++) out.push({ x: stage.x + pitch * (i + 0.5), y: cy + [10, -4, -12, -4, 10][i] * s, s });
    out.mode = 'row';
  } else if (sTwo >= sFive) {                                      // 3 behind, 2 in front, like people sitting in a circle
    const pitch = stage.w / 3, s = sTwo;
    const y1 = stage.y + stage.h * 0.25 + 4 * s, y2 = stage.y + stage.h * 0.75 + 4 * s;
    out.push({ x: stage.x + pitch * 0.5, y: y1 - 6 * s, s }, { x: stage.x + pitch * 1.5, y: y1 - 22 * s, s }, { x: stage.x + pitch * 2.5, y: y1 - 6 * s, s });
    out.push({ x: stage.x + pitch, y: y2 - 40 * s, s }, { x: stage.x + pitch * 2, y: y2 - 40 * s, s });
    out.mode = 'three-two';
  } else {                                                         // 2 - 1 - 2 (the five on a die), tall screens
    const s = sFive, rowH = stage.h / 3, cx = stage.x + stage.w / 2, dx = stage.w * 0.25;
    const y = (k) => stage.y + rowH * k + 52 * s + Math.max(0, (rowH - 226 * s) / 2);
    out.push({ x: cx - dx, y: y(0), s }, { x: cx + dx, y: y(0), s }, { x: cx, y: y(1), s }, { x: cx - dx, y: y(2), s }, { x: cx + dx, y: y(2), s });
    out.mode = 'die';
  }
  return out;
}

function build(w, h, ins) {
  const land = w >= h;
  const L = { w, h, land, ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const BH = L.BH = clamp(Math.round(50 / (ins.px || 0.6)), 62, 84), G = 12;
  let stage;
  if (!land) {
    const pad = 14, top = Math.max(ins.t + 6, ins.back ? ins.t + 62 : 0) + 4, barY = h - Math.max(ins.b, 10) - BH - 12;
    const headH = 86, msgH = clamp(h * 0.085, 70, 110);
    L.header = R(U.x0 + pad, top + 40, U.w - 2 * pad, headH);      // the kit's preview pill sits in the strip above it (see game.js previewBadge)
    L.msg = R(U.x0 + pad, barY - G - msgH, U.w - 2 * pad, msgH);
    stage = R(U.x0 + 6, top + 40 + headH + 8, U.w - 12, L.msg.y - 6 - (top + 40 + headH + 8));
    const n = 4, bw = Math.min(190, (U.w - 2 * pad - (n - 1) * 10) / n), bx = U.x0 + (U.w - (n * bw + (n - 1) * 10)) / 2;
    const slot = (i) => R(bx + i * (bw + 10), barY, bw, BH);
    L.BTN = { menu: slot(0), bat: slot(1), bas: slot(2), hint: slot(3) };
    const full = R(bx + (bw + 10), barY, 3 * bw + 20, BH);
    L.BTN.cont = full; L.BTN.skip = slot(2); L.BTN.confirm = slot(1); L.BTN.undo = slot(3);
    const aw = (U.w - 2 * pad - 3 * 10) / 4, ax = U.x0 + pad;
    L.BTN.auto = { exit: R(ax, barY, aw, BH), pause: R(ax + aw + 10, barY, aw, BH), dec: R(ax + 2 * (aw + 10), barY, aw, BH), inc: R(ax + 3 * (aw + 10), barY, aw, BH) };
    L.wide = stage.w / stage.h > 1.55;
  } else {
    const pad = 12, gap = 12, pw = clamp(U.w * 0.3, 270, 400), top = ins.back ? Math.max(U.y0 + pad, L.backBox.y + L.backBox.h + 4) : U.y0 + pad;
    const panel = L.panel = R(U.x1 - pw - pad, U.y0 + pad, pw, U.h - 2 * pad);
    stage = R(U.x0 + 8, U.y0 + 8, panel.x - gap - U.x0 - 8, U.h - 16);
    const ih = panel.w - 28, ix = panel.x + 14;
    L.header = R(ix, panel.y + 14 + (ins.back && panel.y + 14 < top ? 0 : 0), ih, 112);
    const bh = Math.min(BH, 70), n = 4, total = n * bh + (n - 1) * 10, by = panel.y + panel.h - 14 - total;
    const slot = (i) => R(ix, by + i * (bh + 10), ih, bh);
    L.BTN = { menu: slot(0), bat: slot(1), bas: slot(2), hint: slot(3) };
    L.BTN.cont = R(ix, by + (bh + 10), ih, 3 * bh + 20); L.BTN.skip = slot(2); L.BTN.confirm = slot(1); L.BTN.undo = slot(3);
    L.BTN.auto = { exit: slot(0), pause: slot(1), dec: slot(2), inc: slot(3) };
    L.msg = R(ix, L.header.y + L.header.h + 38, ih, Math.max(70, by - G - (L.header.y + L.header.h + 38)));
    L.wide = stage.w / stage.h > 1.55;
  }
  L.stage = stage;
  L.seats = seatsFor(stage);
  const FX = 34, FY = 84, FR = 25;
  L.face = (p) => { const q = L.seats[p]; return { x: q.x, y: q.y, r: 56 * q.s }; };
  L.fist = (hnd) => { const q = L.seats[hnd >> 1], sd = hnd & 1 ? 1 : -1; return { x: q.x + sd * FX * q.s, y: q.y + FY * q.s, r: FR * q.s, hit: Math.max(FR * q.s * 1.35, 30) }; };
  L.nameAt = (p) => { const q = L.seats[p]; return { x: q.x, y: q.y + 126 * q.s, s: q.s }; };
  L.fistAt = (px, py) => {
    let best = -1, bd = 1e12;
    for (let k = 0; k < 10; k++) { const f = L.fist(k), d = (f.x - px) ** 2 + (f.y - py) ** 2; if (d <= f.hit * f.hit && d < bd) { bd = d; best = k; } }
    return best;
  };
  L.faceAt = (px, py) => {
    for (let p = 0; p < 5; p++) { const f = L.face(p); const dx = px - f.x, dy = py - (f.y + 6 * L.seats[p].s); if (dx * dx + dy * dy <= (f.r * 1.05) ** 2) return p; }
    return -1;
  };
  // the match-end card, centred
  const cw = clamp(Math.min(U.w - 40, 560), 300, 600), ch = land ? Math.min(U.h - 30, 600) : Math.min(700, U.h - 60);
  L.over = { card: R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch) };
  const ow = cw - 80;
  L.over.again = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 12 - 84 - 46, ow, 84);
  L.over.back = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 46, ow, 84);
  L.title = (hasSave) => buildTitle(L, !!hasSave);
  L.doc = buildDoc(L);
  return L;
}

// ---------------------------------------------------------------- title
const titleCache = new WeakMap();
function buildTitle(L) {
  const memo = titleCache.get(L); if (memo) return memo;
  const { w, h, U, ins } = L, T = { rows: {}, hero: null, card: null, lockup: null };
  const names = [['play'], ['two', 'learn'], ['auto'], ['rules', 'how'], ['about', 'settings']];
  const n = names.length;
  const place = (x0, aw, y0, pitch, bh) => names.forEach((row, i) => {
    const y = y0 + i * pitch;
    if (row.length === 1) T.rows[row[0]] = R(x0, y, aw, bh);
    else { const cw = (aw - 12) / 2; T.rows[row[0]] = R(x0, y, cw, bh); T.rows[row[1]] = R(x0 + cw + 12, y, cw, bh); }
  });
  if (!L.land) {
    const lock = 64, bottom = h - Math.max(14, ins.b + 6), bw = Math.min(U.w - 56, 560);
    const minP = clamp(Math.round(46 / (ins.px || 0.6)) + 12, 58, 98);
    const pitch = clamp((bottom - lock - (U.y0 + 470)) / n, minP, 98), bh = pitch - 12;
    const y0 = bottom - lock - n * pitch + 12;
    place(U.x0 + (U.w - bw) / 2, bw, y0, pitch, bh);
    T.lockup = { x: w / 2, y: bottom - 14 };
    const zoneTop = Math.max(ins.t + 8, ins.back ? ins.t + 60 : 0), zone = y0 - 12 - zoneTop;
    T.hero = R(U.x0 + 10, zoneTop, U.w - 20, zone);
  } else {
    const aw = clamp(w * 0.38, 380, 560), ax = U.x1 - aw - 16, lock = 56;
    const pitch = Math.min(92, (U.h - 40 - lock) / n), bh = pitch - 12, y0 = U.y0 + (U.h - n * pitch - lock) / 2 + 6;
    place(ax + 24, aw - 48, y0, pitch, bh);
    T.card = R(ax, y0 - 24, aw, n * pitch + lock + 28);
    T.lockup = { x: ax + aw / 2, y: T.card.y + T.card.h - 14 };
    T.hero = R(U.x0 + 10, U.y0 + 10, ax - U.x0 - 30, U.h - 20);
  }
  titleCache.set(L, T);
  return T;
}

// ---------------------------------------------------------------- scrolling documents (Rules, How to Play, About, Settings)
function buildDoc(L) {
  const { h, U, ins } = L, BH = 84, barY = h - Math.max(ins.b, 10) - BH - 12;
  const pw = Math.min(U.w - 28, 1000), px = U.x0 + (U.w - pw) / 2, py = Math.max(14, ins.t + 6, ins.back && !L.land ? ins.t + 62 : 0);
  const panel = R(px, py, pw, barY - 12 - py);
  const nw = Math.min(262, (pw - 16) / 2), navX = U.x0 + (U.w - (2 * nw + 16)) / 2;
  const headH = 84;
  const viewport = R(panel.x + 18, panel.y + headH + 8, panel.w - 36 - 14, panel.h - headH - 8 - 44);
  const hb = Math.min(104, panel.w * 0.16);
  return {
    panel, viewport, nav: { back: R(navX, barY, nw, BH), next: R(navX + nw + 16, barY, nw, BH) },
    header: { textDec: R(panel.x + panel.w - 18 - hb * 2 - 10, panel.y + 12, hb, 62), textInc: R(panel.x + panel.w - 18 - hb, panel.y + 12, hb, 62) },
    scrollbar: R(panel.x + panel.w - 30, viewport.y, 22, viewport.h), counterY: panel.y + panel.h - 16, cx: panel.x + panel.w / 2,
    bodyW: Math.min(viewport.w - 28, 860),
  };
}
