// Geometry for Yut Nori, as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
//
// Two spaces:
//   LOCAL  the original 720 x 1560 drawing space. The board art, the points, the trays, the throwing pad and the throw chips are
//          authored here (POINTS, TRAY, PAD, CHIP below) and never change.
//   WORLD  the live screen. layoutFor(w, h) places three LOCAL groups (board+trays, throw chips, throwing pad) with a uniform
//          scale + offset each, and returns every button / panel rectangle directly in WORLD units.
//
// Modes:  tall  (w/h < 0.95: phones and tablets in portrait): header, board, chips, pad, buttons stacked and scaled to fit.
//         wide  (landscape): the board on the left, header + chips + pad + buttons in a column on the right.
// Safe areas (host.t/r/b/l) and the host's floating back button (host.back, 0 in standalone apps and browsers) come from main.js.

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px: css pixels per unit (text never below ~11 css px)

// ---- LOCAL space (the 720 x 1560 art) -------------------------------------------------------------------
export const BX0 = 88, BX1 = 632, BY0 = 420, BY1 = 964;          // corners of the track square
const S = (BX1 - BX0) / 5;
const CXc = (BX0 + BX1) / 2, CYc = (BY0 + BY1) / 2;
export const TOKEN_R = 33;

function coords(i) {
  if (i <= 4) return [BX1, BY1 - S * i];                             // 0..4 up the right side (0 = start corner)
  if (i <= 9) return [BX1 - S * (i - 5), BY0];                        // 5..9 along the top
  if (i <= 14) return [BX0, BY0 + S * (i - 10)];                      // 10..14 down the left side
  if (i <= 19) return [BX0 + S * (i - 15), BY1];                      // 15..19 along the bottom
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const c = [CXc, CYc], tr = [BX1, BY0], tl = [BX0, BY0], bl = [BX0, BY1], br = [BX1, BY1];
  if (i === 20 || i === 21) return lerp(tr, c, (i - 19) / 3);
  if (i === 22) return c;
  if (i === 23 || i === 24) return lerp(c, bl, (i - 22) / 3);
  if (i === 25 || i === 26) return lerp(tl, c, (i - 24) / 3);
  return lerp(c, br, (i - 26) / 3);                                    // 27, 28
}
export const POINTS = Array.from({ length: 29 }, (_, i) => { const [x, y] = coords(i); return { x, y }; });
export const isBig = (i) => i === 0 || i === 5 || i === 10 || i === 15 || i === 22;

// Tokens waiting / home (small tokens in a tray). Team 1 (computer) at the top, team 0 (you) below the board.
export const TRAY = [
  { wait: (k) => ({ x: 70 + k * 58, y: 1034 }), home: (k) => ({ x: 450 + k * 58, y: 1034 }), label: { x: 360, y: 1041 } },
  { wait: (k) => ({ x: 70 + k * 58, y: 330 }), home: (k) => ({ x: 450 + k * 58, y: 330 }), label: { x: 360, y: 337 } },
];
export const CHIP = (k, n) => { const w = 92, gap = 10, tot = n * w + (n - 1) * gap, x0 = 360 - tot / 2; return { x: x0 + k * (w + gap), y: 1090, w, h: 78 }; };
export const PAD = { x: 30, y: 1178, w: 660, h: 264 };               // the throwing mat: TAP or SWIPE here
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Which board point a tap means (nearest point within reach), or -1. x, y are LOCAL.
export function pointNear(x, y) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < 29; i++) { const p = POINTS[i], d = Math.hypot(p.x - x, p.y - 8 - y); if (d < bd) { bd = d; best = i; } }
  return bd < 52 ? best : -1;
}

// LOCAL bounds of the three groups.
export const GB = { x: 26, y: 276, w: 668, h: 818 };                 // board frame + both trays + their captions
export const GC = { x: 60, y: 1090, w: 600, h: 78 };                 // the throw chips (centred on x = 360)
export const GP = { x: 18, y: 1166, w: 684, h: 288 };                // the pad and its wooden frame
// Cached static art layers (art.js) cover these LOCAL rectangles.
export const LAYER_BOARD = { x: -20, y: 270, w: 760, h: 850 };
export const LAYER_PAD = { x: 0, y: 1120, w: 720, h: 390 };

// ---- group transforms: world = o + s * local ------------------------------------------------------------
const place = (g, wx, wy, s) => ({ ox: wx - g.x * s, oy: wy - g.y * s, s });
export const toWorld = (T, x, y) => ({ x: T.ox + T.s * x, y: T.oy + T.s * y });
export const toLocal = (T, x, y) => ({ x: (x - T.ox) / T.s, y: (y - T.oy) / T.s });
export const rectWorld = (T, r) => ({ x: T.ox + T.s * r.x, y: T.oy + T.s * r.y, w: T.s * r.w, h: T.s * r.h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });

export const AP_SPEEDS = [{ name: 'Slow', mul: 0.6 }, { name: 'Normal', mul: 1 }, { name: 'Fast', mul: 2.2 }];   // Auto Play (Watch & Learn) speed steps
export const ZOOMS = [1, 1.5, 2, 3];                                  // About / How to play text zoom steps (up to 300%)

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${[host.t, host.r, host.b, host.l, host.back].map(Math.round).join(',')}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, hs) {
  const wide = w / h >= 0.95;
  const L = { w, h, wide, mode: wide ? 'wide' : 'tall', hs, back: hs.back > 0 ? R(hs.l + 8, hs.t + 8, hs.back, hs.back) : null };
  const ax0 = hs.l + 14, ax1 = w - hs.r - 14, aw = ax1 - ax0;          // usable x range
  const topM = hs.t + 8, botM = hs.b + 12;
  L.lanterns = [];
  let colX = 0, colW = 0;                                              // the wide-mode column

  if (!wide) {
    // ---------------------------------------------------------------- tall: everything stacked, scaled to fit
    // the kit's preview badge (top centre) must not sit on the small 'Yut Nori' tag, and the 2-line message toast must end above the board's top tray
    const kc = Math.max(0.3, host.px), badgeBottom = hs.t + 6 / kc + 1.7 * Math.max(16, 11.5 / kc);
    const dy = Math.max(0, Math.ceil(badgeBottom - (topM + 4))), btnH = 74, hdrH = 156 + dy + 50, btnY = h - botM - btnH;
    const natural = GB.h + GC.h + GP.h, avail = btnY - 8 - (topM + hdrH);
    const s = clamp(avail / natural, 0.4, 1), gap = clamp((avail - natural * s) / 3, 0, 42);
    let y = topM + hdrH + gap;
    L.board = place(GB, (w - GB.w * s) / 2, y, s); y += GB.h * s;
    L.chips = { ox: w / 2 - 360 * s, oy: y - GC.y * s, s }; y += GC.h * s + gap;
    L.pad = place(GP, (w - GP.w * s) / 2, y, s);
    L.hdr = { x: (w - 640) / 2, y: topM, w: 640, h: hdrH, cx: w / 2, t1: 28 + dy, t2: 96 + dy, t3: 146 + dy, msg: 122 + dy, headSize: 50 };
    globalThis.__previewBadge = undefined;
    const tot = Math.min(w - hs.l - hs.r - 32, 660), bw = (tot - 28) / 3, bx = (w - tot) / 2;
    L.btn = { menu: R(bx, btnY, bw, btnH), undo: R(bx + bw + 14, btnY, bw, btnH), hint: R(bx + 2 * (bw + 14), btnY, bw, btnH) };
    L.btn.next = R(L.btn.undo.x, btnY, tot - bw - 14, btnH);
    L.lanterns = [{ x: w - 80, y: 0, s: 1.0, ph: 0 }, { x: w - 172, y: -40, s: 0.62, ph: 1.7 }];
    colX = (w - 640) / 2; colW = 640;
  } else {
    // ---------------------------------------------------------------- wide: board left, a column on the right
    const bottom = h - botM, ah = bottom - topM;
    let x0 = ax0 + (hs.back > 0 ? hs.back + 6 : 0);                    // keep the host back button clear
    const awide = ax1 - x0;
    const s = clamp(Math.min(ah / GB.h, (awide - 320 - 24) / GB.w), 0.4, 1);
    const bw = GB.w * s;
    colW = Math.min(560, awide - bw - 24);
    const extra = awide - (bw + 24 + colW);
    if (extra > 0) x0 += extra / 2;
    colX = x0 + bw + 24;
    L.board = place(GB, x0, topM + (ah - GB.h * s) / 2, s);
    const sp = Math.min(0.82, colW / GP.w), cs = Math.min(1, colW / 560), btnH = 62;
    const btnY = bottom - btnH, padY = btnY - 12 - GP.h * sp, chipY = padY - 10 - GC.h * cs;
    L.pad = place(GP, colX + (colW - GP.w * sp) / 2, padY, sp);
    L.chips = { ox: colX + colW / 2 - 360 * cs, oy: chipY - GC.y * cs, s: cs };
    L.hdr = { x: colX, y: topM, w: colW, h: Math.max(120, chipY - 8 - topM), cx: colX + colW / 2, t1: 24, t2: 82, t3: 124, msg: 104, headSize: 46 };
    globalThis.__previewBadge = { x: colX + colW - 6, y: hs.t + 4, align: 'right' };   // the kit's preview clock sits at the end of the column's top row, off the board trays
    const bwid = (colW - 20) / 3;
    L.btn = { menu: R(colX, btnY, bwid, btnH), undo: R(colX + bwid + 10, btnY, bwid, btnH), hint: R(colX + 2 * (bwid + 10), btnY, bwid, btnH) };
    L.btn.next = R(L.btn.undo.x, btnY, colW - bwid - 10, btnH);
    if (w - hs.r - (colX + colW) > 150) L.lanterns = [{ x: w - hs.r - 70, y: 0, s: 0.9, ph: 0 }];
  }
  L.col = { x: colX, w: colW };

  // ---- the page screens (About, How to play) ---------------------------------------------------------
  {
    const bodyW = Math.min(w - hs.l - hs.r - 48, 1000), cols = bodyW >= 880 ? 2 : 1, gap = 40;
    const backH = 72, backY = h - hs.b - 14 - backH, backW = 300;
    L.page = {
      titleY: hs.t + 78, cx: w / 2, cols, gap, colW: (bodyW - (cols - 1) * gap) / cols,
      body: R((w - bodyW) / 2, hs.t + 122, bodyW, backY - 30 - (hs.t + 122)),      // ends above the zoom caption that sits just over the A- button
      back: R((w - backW) / 2, backY, backW, backH),
      dec: R((w - backW) / 2 - 96, backY, 84, backH), inc: R((w + backW) / 2 + 12, backY, 84, backH),
    };
  }

  // ---- the result screen ---------------------------------------------------------------------------------
  {
    const stack = !wide && h >= 1000;
    if (stack) {
      const ay = h * 0.64, bwid = 440;
      L.over = {
        stack, cx: w / 2, token: { x: w / 2, y: h * 0.36, s: 3.4 }, winY: h * 0.5, stat1: h * 0.5 + 50, stat2: h * 0.5 + 98,
        again: R((w - bwid) / 2, ay, bwid, 96), back: R((w - bwid) / 2, ay + 116, bwid, 84), moreY: ay + 116 + 84 + 52, winSize: 84,
      };
    } else {
      const rowsW = Math.min(520, aw * 0.46), artW = Math.min(aw - rowsW - 30, 700), tot = artW + 30 + rowsW, sx = ax0 + (aw - tot) / 2;
      const cx = sx + artW + 30 + rowsW / 2, bwid = Math.min(440, rowsW), mid = h / 2;
      L.over = {
        stack, cx, token: { x: sx + artW / 2, y: mid - 10, s: Math.min(3.4, artW / 150, (h - 120) / 190) }, winY: mid - 130, stat1: mid - 82, stat2: mid - 38,
        again: R(cx - bwid / 2, mid + 6, bwid, 84), back: R(cx - bwid / 2, mid + 102, bwid, 72), moreY: mid + 102 + 72 + 46, winSize: Math.min(84, Math.round(rowsW / 5.2)),
      };
    }
  }

  // ---- the title screen (memoised by whether a saved game exists) ---------------------------------------
  const titles = {};
  L.title = (hasSave) => (titles[hasSave ? 1 : 0] ??= titleFor(L, hasSave));
  return L;
}

function titleFor(L, hasSave) {
  const { w, h, wide, hs } = L, ax0 = hs.l + 14, ax1 = w - hs.r - 14, aw = ax1 - ax0;
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'two', 'daily', 'auto']), n = names.length;
  const lockWant = Math.max((wide ? 0.28 : 0.35) * 720, 120 / Math.max(host.px, 1e-6)), lockH0 = Math.round(lockWant * 327 / 1200) + 34;   // the lockup strip under the menu
  const B = n * 76 + 330 + lockH0;                                     // natural height of the whole button block (lockup included)
  let rowsX, rowsW, kr, rowsTop, art;
  if (!wide) {
    rowsW = Math.min(540, w - hs.l - hs.r - 32); rowsX = (w - rowsW) / 2;
    const bot = hs.b + 12, artMin = 340;
    kr = clamp((h - bot - hs.t - 14 - artMin) / B, 0.8, 1);
    rowsTop = h - bot - B * kr;
    const zone = rowsTop - (hs.t + 6), titleY = hs.t + 6 + Math.max(120, 0.33 * zone);
    art = { cx: w / 2, titleY, tagY: titleY + 60, creditY: titleY + 118, showSticks: zone >= 620, sticksY: rowsTop - 230, tokensY: rowsTop - 90, spread: 118, tokDx: 242, maxW: w - 40 };
    if (art.showSticks) art.board = place(GB, (w - GB.w) / 2, rowsTop - 500, 1);
  } else {
    rowsW = Math.min(560, aw * 0.45);
    const artW = Math.min(aw - rowsW - 30, 760), tot = artW + 30 + rowsW, sx = ax0 + (aw - tot) / 2;
    rowsX = sx + artW + 30;
    kr = clamp((h - hs.t - hs.b - 24) / B, 0.6, 1);
    rowsTop = Math.max(hs.t + 10, (h - B * kr) / 2);
    const tY = h * 0.33;
    art = { cx: sx + artW / 2, titleY: tY, tagY: tY + 60, creditY: tY + 106, showSticks: true, sticksY: h * 0.69, tokensY: h * 0.88, spread: Math.min(118, (artW - 130) / 3.6), tokDx: Math.min(242, artW / 2 - 60), maxW: artW - 30, panel: R(sx, hs.t + 10, artW, h - hs.t - hs.b - 20) };
  }
  const rows = {};
  if (wide && 60 * kr * host.px < 46) return titleCompact(L, hasSave, { rowsX, rowsW, art, ax0, aw, lockWant });
  const step = 76 * kr, rh = 66 * kr;
  names.forEach((nm, i) => { rows[nm] = R(rowsX, rowsTop + i * step, rowsW, rh); });
  const y = rowsTop + n * step + 2 * kr, sw = (rowsW - 16) / 2, sh = 60 * kr, sp = 68 * kr;
  rows.level = R(rowsX, y, sw, sh); rows.sound = R(rowsX + sw + 16, y, sw, sh);
  rows.calm = R(rowsX, y + sp, sw, sh); rows.big = R(rowsX + sw + 16, y + sp, sw, sh);
  rows.about = R(rowsX, y + 2 * sp, sw, sh); rows.how = R(rowsX + sw + 16, y + 2 * sp, sw, sh);
  const lockW = Math.min(lockWant, rowsW), lockY = rows.about.y + rh + 12 * kr, lock = { cx: rowsX + rowsW / 2, y: lockY, w: lockW };
  const blurbY = rows.about.y + 100 * kr + lockH0;
  const statsY = blurbY + 88 * kr;
  return { rows, lock, kr, art, cx: rowsX + rowsW / 2, rowsW, blurbY, starsY: blurbY + 46 * kr, statsY, msgY: rowsTop - 34 * kr, rowsTop, rowsPanel: wide ? R(rowsX - 18, rowsTop - 14, rowsW + 36, statsY + 16 - rowsTop + 14) : null };
}

// Short landscape phones (844x390, 667x375, 932x430...): one column of 12 buttons cannot reach 44 css px, so the menu becomes a two-column
// grid (6 rows, each at least 46 css px tall), the lockup sits centred under it, and the level blurb, stars and stats move to the
// left card under the tagline, so nothing overlaps and the lockup is the last thing under the menu.
function titleCompact(L, hasSave, c) {
  const { w, h, hs } = L, { lockWant } = c, minRh = 46 / host.px;
  const lockW = Math.round(lockWant), lockH = Math.round(lockW * 327 / 1200);
  const aw = w - hs.l - hs.r - 28, ax0 = hs.l + 14, gapX = 14;
  const rowsW = Math.min(700, Math.round(aw * 0.52)), artW = Math.min(aw - rowsW - 30, 760), tot = artW + 30 + rowsW, sx = ax0 + (aw - tot) / 2, rowsX = sx + artW + 30;
  const top = hs.t + 12 + 14, avail = h - hs.b - 10 - top - 14 - lockH - 8;
  const rh = Math.round(minRh), g = clamp((avail - 6 * rh) / 5, 3, 10), colW = (rowsW - gapX) / 2;
  const order = hasSave ? ['resume', 'play', 'learn', 'two', 'daily', 'auto', 'level', 'sound', 'calm', 'big', 'about', 'how'] : ['learn', 'play', 'two', 'daily', 'auto', 'level', 'sound', 'calm', 'big', 'about', 'how'];
  const rows = {};
  order.forEach((nm, i) => {
    const r = Math.floor(i / 2), col = i % 2, last = i === order.length - 1 && col === 0, y = top + r * (rh + g);
    rows[nm] = last ? R(rowsX, y, rowsW, rh) : R(rowsX + col * (colW + gapX), y, colW, rh);
  });
  const bottomY = top + 6 * rh + 5 * g, lock = { cx: rowsX + rowsW / 2, y: bottomY + 8, w: lockW };
  const panel = R(rowsX - 18, hs.t + 12, rowsW + 36, lock.y + lockH + 10 - (hs.t + 12));
  const art = { ...c.art, cx: sx + artW / 2, maxW: artW - 30, panel: R(sx, hs.t + 12, artW, panel.h), titleY: Math.round(panel.y + panel.h * 0.2), showSticks: true };
  art.tagY = art.titleY + 56; art.sticksY = Math.round(panel.y + panel.h * 0.72); art.tokensY = Math.round(panel.y + panel.h * 0.9);
  if (host.back) art.titleMaxW = Math.max(200, Math.min(art.maxW, 2 * (art.cx - (hs.l + host.back + 16))));   // the title clears the host back button
  art.spread = Math.min(118, (artW - 130) / 3.6); art.tokDx = Math.min(242, artW / 2 - 60);
  const cx = art.cx, blurbY = art.tagY + 44, starsY = blurbY + 40, statsY = starsY + 30;
  return { rows, lock, kr: 0.8, art, cx, rowsW, blurbY, starsY, statsY, msgY: statsY + 36, rowsTop: panel.y, rowsPanel: panel, compact: true, blurbW: artW - 40 };
}

// Every rectangle that must stay inside the screen and clear of the others, per screen (layout check and resize test).
export function screenRects(L, scene, o = {}) {
  const out = [], add = (name, r) => { if (r) out.push({ name, r }); };
  if (scene === 'play') {
    add('menu', L.btn.menu); add('undo', L.btn.undo); add('hint', L.btn.hint);
    add('board', rectWorld(L.board, GB)); add('pad', rectWorld(L.pad, GP));
    add('chips', rectWorld(L.chips, { ...GC, x: 360 - 5 * 51, w: 5 * 102 }));
    add('header', { x: L.hdr.x, y: L.hdr.y, w: L.hdr.w, h: Math.min(L.hdr.h, 150) });
  } else if (scene === 'lesson-done') { add('menu', L.btn.menu); add('next', L.btn.next); add('board', rectWorld(L.board, GB)); add('pad', rectWorld(L.pad, GP)); }
  else if (scene === 'title') { const t = L.title(!!o.hasSave); for (const k of Object.keys(t.rows)) add(k, t.rows[k]); }
  else if (scene === 'over') { add('again', L.over.again); add('back', L.over.back); }
  else if (scene === 'page') { add('back', L.page.back); add('dec', L.page.dec); add('inc', L.page.inc); add('body', L.page.body); }
  return out;
}

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (k) => { const m = 44 / Math.max(host.px, 1e-6), lh = k.w * 327 / 1200, w = Math.max(k.w, m), h = Math.max(lh, m); return { x: Math.round(k.cx - w / 2), y: Math.round(k.y), w: Math.round(w), h: Math.round(h) }; };
