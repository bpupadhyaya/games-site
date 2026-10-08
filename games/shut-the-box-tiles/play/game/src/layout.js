// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the aspect).
// layoutFor(w, h) returns every rectangle for that size, cached by size + safe insets. Two shapes:
//   portrait (phones and tablets): header, message, dice tray, odds line, the box, button bar.
//   wide (landscape): a left column (header, message, dice tray, odds, buttons) and the box filling the right.
// Hit areas are exactly the rectangles that are drawn. Buttons are at least ~44 css px tall.
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

// Tiles of a box with n tiles inside the region `reg`: the best grid (cols x rows) for the tile size; returns the box frame, cavity, tile rects.
export function board(n, reg) {
  const aspect = 1.3;   // tile height / width at best
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols), pad0 = 0.045;
    const cw = (reg.w * (1 - pad0 * 2) - 8) / cols, ch = (reg.h * (1 - pad0 * 2) - 8) / rows;
    const tw = Math.min(cw, ch / aspect), th = tw * aspect;
    if (!best || tw > best.tw + 0.01) best = { cols, rows, tw, th };
  }
  const { cols, rows } = best; let tw = Math.min(best.tw, 200), th = Math.min(tw * aspect, best.th);
  const dims = () => { const gw = tw * cols + 8, gh = th * rows + 8, m = Math.max(12, Math.min(gw, gh) * 0.07); return { bw: gw + m * 2 / 0.91, bh: gh + m * 2 / 0.91 }; };
  let { bw, bh } = dims();
  if (bw > reg.w || bh > reg.h) { const f = Math.min(reg.w / bw, reg.h / bh) * 0.99; tw *= f; th *= f; ({ bw, bh } = dims()); }
  const box = R(reg.x + (reg.w - bw) / 2, reg.y + (reg.h - bh) / 2, bw, bh);
  const pad = Math.max(10, Math.min(box.w, box.h) * 0.045), cav = R(box.x + pad, box.y + pad, box.w - pad * 2, box.h - pad * 2);
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols, inRow = r === rows - 1 ? n - r * cols : cols;
    const x0 = cav.x + (cav.w - tw * inRow) / 2, y0 = cav.y + (cav.h - th * rows) / 2;
    tiles.push(R(x0 + c * tw, y0 + r * th, tw, th));
  }
  return { box, cav, tiles, tw, th };
}

function build(w, h, ins) {
  const land = w >= h, L = { w, h, land, ins };
  L.BH = clamp(Math.round(50 / Math.max(0.3, ins.px)), 64, 88);
  const BH = L.BH, G = 14, MP = Math.ceil(46 / Math.max(0.3, ins.px));   // MP: 46 css px in virtual units (smallest comfortable tap target)
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  L.backBox = ins.back ? R(ins.l, ins.t, Math.max(ins.back, 56) + 8, Math.max(ins.back, 56) + 8) : R(0, 0, 0, 0);
  const side = clamp(Math.round(U.w * 0.04), 18, 48);
  const topY = U.y0 + Math.max(10, L.backBox.h ? 6 : 10);

  // ---- play ----------------------------------------------------------------------------------------------------------------------------
  const P = L.play = {};
  const headX = U.x0 + side + (L.backBox.w ? L.backBox.w + 4 : 0);
  if (!land) {
    const x = U.x0 + side, ww = U.w - side * 2;
    let y = topY;
    P.head = R(headX, y, U.x1 - side - headX, 64); y += 64 + 8;
    P.score = R(x, y, ww, 50); y += 50 + 6;
    P.msg = R(x, y, ww, 78); y += 78 + 10;
    const trayH = clamp(Math.round(U.h * 0.17), 170, 280);
    P.tray = R(x, y, ww, trayH); y += trayH + 8;
    P.odds = R(x, y, ww, 40); y += 40 + 8;
    const barY = U.y1 - G - BH;
    P.btnY = barY;
    P.region = R(x, y, ww, Math.max(120, barY - G - y));
    const bw = (ww - G * 3) / 4;
    P.btn = { menu: R(x, barY, bw, BH), hint: R(x + (bw + G), barY, bw, BH), clear: R(x + (bw + G) * 2, barY, bw, BH), dice: R(x + (bw + G) * 3, barY, bw, BH) };
    P.autoBtn = { exit: P.btn.menu, pause: P.btn.hint, dec: P.btn.clear, inc: P.btn.dice };
  } else {
    const lw = clamp(Math.round(U.w * 0.4), 430, 600), x = U.x0 + side, gapx = 24;
    let y = topY;
    P.head = R(headX, y, x + lw - headX, 56); y += 56 + 4;
    P.score = R(x, y, lw, 46); y += 46 + 4;
    const barY = U.y1 - 12 - BH;
    const free = barY - 10 - y;   // msg + tray + odds
    const msgH = clamp(Math.round(free * 0.28), 60, 96), oddsH = 36, trayH = Math.max(120, free - msgH - oddsH - 20);
    P.msg = R(x, y, lw, msgH); y += msgH + 8;
    P.tray = R(x, y, lw, trayH); y += trayH + 6;
    P.odds = R(x, y, lw, oddsH);
    P.btnY = barY;
    const bw = (lw - G * 3) / 4;
    P.btn = { menu: R(x, barY, bw, BH), hint: R(x + (bw + G), barY, bw, BH), clear: R(x + (bw + G) * 2, barY, bw, BH), dice: R(x + (bw + G) * 3, barY, bw, BH) };
    P.autoBtn = { exit: P.btn.menu, pause: P.btn.hint, dec: P.btn.clear, inc: P.btn.dice };
    const rx = x + lw + gapx;
    P.region = R(rx, U.y0 + 14 + (L.backBox.h ? 0 : 0), U.x1 - side - rx, U.h - 28);
  }
  const bcache = {};
  L.board = (n) => bcache[n] || (bcache[n] = board(n, P.region));
  // result card
  {
    const cw = Math.min(U.w - 40, 600), ch = Math.min(U.h - 40, 560), cx = U.x0 + (U.w - cw) / 2, cy = U.y0 + (U.h - ch) / 2;
    const C = L.result = { card: R(cx, cy, cw, ch) };
    const by = cy + ch - 24 - BH * 2 - 12;
    C.primary = R(cx + 24, by, cw - 48, BH);
    C.second = R(cx + 24, by + BH + 12, (cw - 60) / 2, BH);
    C.menu = R(cx + 24 + (cw - 60) / 2 + 12, by + BH + 12, (cw - 60) / 2, BH);
  }
  L.simple = { back: R(U.x0 + (U.w - Math.min(U.w - 48, 420)) / 2, U.y1 - 24 - BH, Math.min(U.w - 48, 420), BH) };

  // ---- title ---------------------------------------------------------------------------------------------------------------------------
  L.title = (resume) => {
    const T = { rows: {} };
    const lockH = 52, main = ['classic', 'tall', 'duel', 'daily', 'auto'], small = ['howto', 'rules', 'about', 'settings'];
    if (resume) main.unshift('resume');
    T.lockup = R(U.x0 + (U.w - 360) / 2, U.y1 - lockH - 4, 360, lockH); T.lockupHit = R(T.lockup.x - 10, T.lockup.y - 10, T.lockup.w + 20, U.y1 - T.lockup.y + 10);
    const colX = land ? U.x0 + U.w * 0.52 : U.x0 + side, colW = land ? U.x1 - side - colX : U.w - side * 2;
    const colTop = land ? U.y0 + 18 : 0, colBot = T.lockup.y - 10;
    const colTop0 = U.y0 + 18, colBot0 = U.y1 - lockH - 4 - 10, rows2 = main.length + 2, smallOneRow = land && Math.floor((colBot0 - colTop0 - (rows2 - 1) * 10) / rows2) < MP, nRows = main.length + (smallOneRow ? 1 : 2);   // the four small buttons: one row on short landscape screens, else two rows
    const logo = land ? 0 : 150;
    let bh, y0;
    if (land) { bh = clamp(Math.floor((colBot - colTop - (nRows - 1) * 10) / nRows), 52, Math.max(BH + 6, MP)); y0 = colTop + Math.max(0, (colBot - colTop - (nRows * bh + (nRows - 1) * 10)) / 2); }
    else { const avail = colBot - topY - logo - 150; bh = clamp(Math.floor((avail - (nRows - 1) * 10) / nRows), 56, BH + 6); y0 = colBot - (nRows * bh + (nRows - 1) * 10); }
    let y = y0;
    for (const k of main) { T.rows[k] = R(colX, y, colW, bh); y += bh + 10; }
    const hw = (colW - 10) / 2;
    if (smallOneRow) { const qw = (colW - 30) / 4; small.forEach((k, i) => { T.rows[k] = R(colX + i * (qw + 10), y, qw, bh); }); }
    else small.forEach((k, i) => { T.rows[k] = R(colX + (i % 2) * (hw + 10), y + Math.floor(i / 2) * (bh + 10), hw, bh); });
    T.rows.chip = R(T.rows.duel.x + T.rows.duel.w - 156, T.rows.duel.y + 2, 150, T.rows.duel.h - 4);
    if (land) {
      T.heroTitle = R(U.x0 + side, U.y0 + 24, U.w * 0.5 - side * 2, 110);
      T.hero = R(U.x0 + side, U.y0 + 140, U.w * 0.5 - side * 2, U.h - 140 - lockH - 40);
    } else {
      T.heroTitle = R(U.x0 + side, topY + 6, U.w - side * 2, 110);
      T.hero = R(U.x0 + side, topY + 122, U.w - side * 2, Math.max(120, y0 - 14 - (topY + 122)));
    }
    return T;
  };

  // ---- documents (Rules, How to Play, About) ---------------------------------------------------------------------------------------------
  {
    const cw = Math.min(U.w - side * 2, 900), cx = U.x0 + (U.w - cw) / 2, hh = Math.max(72, MP + 12), zb = Math.max(66, MP);
    const D = L.doc = {};
    D.header = { y: topY, title: R(headX, topY, cx + cw - 2 * (zb + 4) - 16 - headX, hh), dec: R(cx + cw - 2 * (zb + 4) - 8, topY + 4, zb, MP), inc: R(cx + cw - zb - 4, topY + 4, zb, MP) };
    const navY = U.y1 - 14 - BH, nw = (cw - 2 * G) / 3;
    D.nav = { back: R(cx, navY, nw, BH), prev: R(cx + nw + G, navY, nw, BH), next: R(cx + (nw + G) * 2, navY, nw, BH) };
    D.viewport = R(cx, topY + hh + 6, cw, navY - 12 - (topY + hh + 6));
    D.scrollbar = R(cx + cw - 12, D.viewport.y, 12, D.viewport.h);
    D.pad = 22;
  }
  // ---- settings ------------------------------------------------------------------------------------------------------------------------
  {
    const keys = ['sound', 'calm', 'box', 'tiles', 'single', 'level', 'text', 'reset'];
    const colsN = land && U.w >= 900 ? 2 : 1, cw = colsN === 2 ? (Math.min(U.w - side * 2, 1100) - 16) / 2 : Math.min(U.w - side * 2, 640);
    const total = Math.min(U.w - side * 2, colsN === 2 ? 1100 : 640), x0 = U.x0 + (U.w - total) / 2;
    const top = topY + 80, bottom = U.y1 - 24 - BH - 12, per = Math.ceil(keys.length / colsN);
    const rh = clamp(Math.floor((bottom - top - (per - 1) * 10) / per), Math.min(MP, 84), Math.max(84, MP));
    const S = L.settings = { rows: {}, title: R(headX, topY, U.x1 - side - headX, 64) };
    keys.forEach((k, i) => { const c = Math.floor(i / per), r = i % per; S.rows[k] = R(x0 + c * (cw + 16), top + r * (rh + 10), cw, rh); });
    S.back = R(U.x0 + (U.w - Math.min(U.w - 48, 420)) / 2, U.y1 - 24 - BH, Math.min(U.w - 48, 420), BH);
  }
  return L;
}
