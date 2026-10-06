// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every position for that size; it is cached by size + safe-area key, so a frame never recomputes it.
// Never read module-level width/height: always call layoutFor(meta.width, meta.height).
//   tall     portrait phone (h >= 1540): the approved phone look (board 616 wide, header above, button bar below).
//   compact  portrait, shorter than a phone (tablets, small phones): compact header, board scaled to fit, banner + bar below.
//   wide     landscape: an info card on the left, the board in the middle, a button card on the right
//            (on a squarish screen: one card on the left that holds the buttons too).
// The board is always painted in canonical coordinates (BX 52, BY 500, BS 616) and drawn scaled by `L.k`.
export const FR = 34;                                   // width of the carved frame (canonical units)
export const CANON = { BX: 52, BY: 500, BS: 616 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AP_THINK_STEPS = [2, 5, 8, 10];
export const AP_REVEAL_TIME = 2;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

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

const MAIN = ['learn', 'big', 'small', 'daily', 'two', 'auto'];
const SETTINGS = ['side', 'level', 'sound', 'calm', 'text', 'about', 'help', 'rules'];

function build(w, h, ins) {
  const land = w >= h, tall = !land && h >= 1540, mode = land ? 'wide' : tall ? 'tall' : 'compact';
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const L = { w, h, land, tall, mode, ins, U };
  const bk = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, bk + 8, bk + 8) : R(0, 0, 0, 0);
  const bb = L.backBox, backBottom = ins.back ? bb.y + bb.h : 0;
  const cx = w / 2;
  const barH = 72, bottomLift = Math.max(0, ins.b - 16), barY = L.barY = h - 98 - bottomLift;

  // ---- board + per-mode furniture -------------------------------------------------------------------------------------
  let k = 1, bx, by;
  const hud = L.hud = {};
  let ap = {};
  const BTN = L.BTN = {};
  const trayTall = (y) => ({ x: 64, y, size: 24, taken: { x: 300, y, size: 21, align: 'left' }, pieces: { x: 420, y: y - 8, dx: 24, dy: 20, cols: 12, s: 0.4 } });
  const barButtons = () => {
    Object.assign(BTN, { menu: R(60, barY, 190, barH), undo: R(265, barY, 190, barH), hint: R(470, barY, 190, barH), next: R(265, barY, 395, barH), skip: R(470, barY, 190, barH), share: R(265, barY, 395, barH) });
    ap.exit = BTN.menu; ap.pause = BTN.undo; ap.skip = BTN.hint;
  };

  if (tall) {
    bx = (w - 616) / 2; by = 500 + (h - 1560) / 2;
    Object.assign(hud, {
      play: { title: { x: cx, y: 175, size: 46 }, sub: { x: cx, y: 205, size: 22, align: 'center' }, icon: { x: 100, y: 275, s: 1.1 }, turn: { x: 150, y: 288, size: 34, maxW: 540, lh: 36, lines: 1 }, mode: { x: 150, y: 322, size: 22, maxW: 540 }, trayA: trayTall(378), trayD: trayTall(424) },
      lesson: { label: { x: cx, y: 172, size: 24, align: 'center' }, title: { x: cx, y: 232, size: 46, maxW: 640 }, body: { x: 50, y: 269, w: 620, h: 172, size: 27, bigSize: 32, lh: 35, bigLh: 40, align: 'center' } },
      puzzle: { label: { x: cx, y: 172, size: 24, align: 'center' }, title: { x: cx, y: 232, size: 40, maxW: 640 }, body: { x: 50, y: 270, w: 620, h: 160, size: 26, bigSize: 30, lh: 34, bigLh: 38, align: 'center' }, streak: { x: cx, y: 440, size: 24, align: 'center' } },
      auto: { title: { x: cx, y: 175, size: 38, maxW: 640 }, phase: { x: cx, y: 218, size: 22, maxW: 640, lines: 1 }, trayA: trayTall(270), trayD: trayTall(310), think: { x: cx, y: 388, size: 22, align: 'center' } },
    });
    ap = { dec: R(150, 352, 130, 50), inc: R(440, 352, 130, 50) };
    hud.msg = { rect: R(40, by + 676, 640, 160), size: 25, lh: 32, bigSize: 31, bigLh: 39 };
    barButtons();
  } else if (!land) {
    const top = Math.max(ins.t + 10, 76), rowH = 72, rowTop = top + (ins.back ? Math.max(0, (bb.h - rowH) / 2) : 0);
    const ix = ins.back ? bb.x + bb.w + 30 : 44, tx = ix + 46;
    const below = Math.max(rowTop + rowH + 6, backBottom + 4);
    const trayC = (y) => ({ x: 24, y, size: 24, taken: { x: 250, y, size: 21, align: 'left' }, pieces: { x: 390, y: y - 8, dx: 24, dy: 20, cols: 12, s: 0.4 } });
    const hb = rowTop + 258, tmax = w - 2 * (bb.w + 20);
    const aTop = Math.max(rowTop + 96, backBottom + 4) + 28;
    Object.assign(hud, {
      play: { title: null, sub: null, icon: { x: ix, y: rowTop + 36, s: 1 }, turn: { x: tx, y: rowTop + 32, size: 32, maxW: w - tx - 24, lh: 34, lines: 1 }, mode: { x: tx, y: rowTop + 62, size: 22, maxW: w - tx - 24 }, trayA: trayC(below + 38), trayD: trayC(below + 38 + 66) },
      lesson: { label: { x: cx, y: rowTop + 26, size: 23, align: 'center' }, title: { x: cx, y: rowTop + 70, size: 40, maxW: tmax }, body: { x: 24, y: rowTop + 90, w: w - 48, h: hb - rowTop - 96, size: 26, bigSize: 29, lh: 32, bigLh: 36, align: 'center' } },
      puzzle: { label: { x: cx, y: rowTop + 26, size: 23, align: 'center' }, title: { x: cx, y: rowTop + 70, size: 36, maxW: tmax }, body: { x: 24, y: rowTop + 90, w: w - 48, h: 118, size: 26, bigSize: 28, lh: 31, bigLh: 34, align: 'center' }, streak: { x: cx, y: hb - 22, size: 23, align: 'center' } },
      auto: { title: { x: cx, y: rowTop + 34, size: 34, maxW: tmax }, phase: { x: cx, y: rowTop + 76, size: 22, maxW: w - 40, lines: 1 }, trayA: trayC(aTop), trayD: trayC(aTop + 50), think: { x: cx, y: hb - 14, size: 22, align: 'center' } },
    });
    ap = { dec: R(cx - 200, hb - 52, 110, 44), inc: R(cx + 90, hb - 52, 110, 44) };
    const bannerH = 96, availH = barY - 10 - bannerH - hb;
    const outer = Math.max(260, Math.min(684, availH, w - 8));
    k = outer / 684; bx = (w - 616 * k) / 2;
    const fy = hb + 4 + Math.max(0, (availH - outer) / 2);
    by = fy + FR * k;
    hud.msg = { rect: R(24, Math.min(by + 616 * k + FR * k + 10, barY - 10 - bannerH), w - 48, bannerH), size: 24, lh: 30, bigSize: 28, bigLh: 34 };
    barButtons();
  } else {
    const g = 12, cardTop = U.y0 + g, cardH = U.y1 - g - cardTop;
    k = Math.min(1, (U.h - 20) / 684);
    let single = false, Lw, Rw = 0, rem = U.w - 684 * k - 4 * g;
    single = rem < 450;
    if (single) {
      if (rem < 300) { k = Math.max(0.45, (U.w - 300 - 4 * g) / 684); rem = U.w - 684 * k - 4 * g; }
      Lw = clamp(rem, 300, 400);
    } else if (rem / 2 >= 250) { Lw = Rw = rem / 2; } else { Lw = 250 + (rem - 450) * 0.6; Rw = rem - Lw; }
    const bs = 616 * k, regionX = U.x0 + g + Lw + g, regionEnd = single ? U.x1 - g : U.x1 - g - Rw - g;
    bx = regionX + (regionEnd - regionX - 684 * k) / 2 + FR * k;
    by = U.y0 + (U.h - 684 * k) / 2 + FR * k;
    const leftCard = R(U.x0 + g, cardTop, Lw, cardH), rightCard = single ? null : R(U.x1 - g - Rw, cardTop, Rw, cardH);
    let bw, bh, gapB, x0, yStart;
    if (!single) {
      bw = clamp(Rw - 28, 120, 300); x0 = rightCard.x + (Rw - bw) / 2; bh = Rw >= 220 ? 84 : 72; gapB = 14;
      const total = 3 * bh + 2 * gapB; yStart = rightCard.y + (rightCard.h - total) / 2;
      L.badgeFits = (rightCard.h - total) / 2 > 100;
    } else { bw = Lw - 32; x0 = leftCard.x + 16; bh = 52; gapB = 8; yStart = leftCard.y + leftCard.h - 14 - (3 * bh + 2 * gapB); }
    const slots = [0, 1, 2].map((i) => R(x0, yStart + i * (bh + gapB), bw, bh));
    Object.assign(BTN, { menu: slots[0], undo: slots[1], hint: slots[2], next: slots[1], skip: slots[1], share: slots[1] });
    ap = { exit: slots[0], pause: slots[1], skip: slots[2] };
    const ix0 = leftCard.x + 16, iw = Lw - 32, y0 = Math.max(leftCard.y + 14, ins.back ? backBottom + 2 : 0), icx = ix0 + iw / 2;
    const msgBottom = single ? slots[0].y - 12 : leftCard.y + leftCard.h - 14;
    const cols = Math.max(6, Math.floor((iw - 8) / 21)), rowsA = Math.ceil(24 / cols), rowsD = Math.ceil(13 / cols);
    const trayS = (y) => ({ x: ix0, y, size: 23, taken: { x: ix0 + iw, y, size: 21, align: 'right' }, pieces: { x: ix0 + 9, y: y + 16, dx: 21, dy: 20, cols, s: 0.33 } });
    const sY = y0 + 6, trayAy = sY + 152, trayDy = trayAy + 16 + rowsA * 20 + 24, trayEnd = trayDy + 16 + rowsD * 20 + 6;
    const aA = sY + 176, aD = aA + 16 + rowsA * 20 + 24, thinkY = aD + 16 + rowsD * 20 + 34;
    Object.assign(hud, {
      play: { title: null, sub: { x: icx, y: sY + 22, size: 22, align: 'center' }, icon: { x: ix0 + 20, y: sY + 62, s: 0.62 }, turn: { x: ix0 + 50, y: sY + 58, size: 26, maxW: iw - 50, lh: 29, lines: 2 }, mode: { x: ix0 + 4, y: sY + 118, size: 21, maxW: iw - 4 }, trayA: trayS(trayAy), trayD: trayS(trayDy) },
      lesson: { label: { x: icx, y: sY + 22, size: 22, align: 'center' }, title: { x: icx, y: sY + 58, size: 30, maxW: iw, lines: 2, lh: 34 }, body: { x: ix0, y: sY + 106, w: iw, h: msgBottom - sY - 106, size: 25, bigSize: 28, lh: 31, bigLh: 35, align: 'left' } },
      puzzle: { label: { x: icx, y: sY + 22, size: 22, align: 'center' }, title: { x: icx, y: sY + 58, size: 30, maxW: iw, lines: 2, lh: 34 }, body: { x: ix0, y: sY + 106, w: iw, h: msgBottom - sY - 106 - 40, size: 24, bigSize: 27, lh: 30, bigLh: 34, align: 'left' }, streak: { x: icx, y: msgBottom - 8, size: 22, align: 'center' } },
      auto: { title: { x: icx, y: sY + 30, size: 28, maxW: iw, lines: 2, lh: 32 }, phase: { x: ix0, y: sY + 100, size: 22, maxW: iw, lines: 3, lh: 26 }, trayA: trayS(aA), trayD: trayS(aD), think: { x: icx, y: thinkY, size: 22, align: 'center' } },
    });
    ap.dec = R(icx - 20 - 100, thinkY + 12, 100, 46); ap.inc = R(icx + 20, thinkY + 12, 100, 46);
    const msgTop = trayEnd + 6;
    hud.msg = { rect: R(ix0 - 6, msgTop, iw + 12, Math.max(70, msgBottom - msgTop)), size: 23, lh: 28, bigSize: 26, bigLh: 32, side: true };
    L.leftCard = leftCard; L.rightCard = rightCard; L.single = single;
  }
  L.AP = ap; L.k = k;
  const bs = 616 * k;
  L.bs = bs; L.bx = bx; L.by = by;
  L.cell = (n) => bs / n;
  L.centerOf = (n, i) => ({ x: bx + ((i % n) + 0.5) * (bs / n), y: by + (((i / n) | 0) + 0.5) * (bs / n) });
  L.squareAt = (n, px, py) => { const cs = bs / n, x = Math.floor((px - bx) / cs), y = Math.floor((py - by) / cs); return x < 0 || y < 0 || x >= n || y >= n ? -1 : x + n * y; };
  L.frame = R(bx - FR * k, by - FR * k, bs + 2 * FR * k, bs + 2 * FR * k);

  // ---- result screen (also the Auto Play "finished" overlay) -----------------------------------------------------------
  if (!land) {
    const cy = h / 2;
    L.over = { piece: { x: cx, y: cy - 190, s: 3.2 }, won: { x: cx, y: cy + 20, size: 60 }, reason: { x: cx, y: cy + 72, size: 24 }, moves: { x: cx, y: cy + 114, size: 22 }, star: { x: cx, y: cy + 146, size: 22 }, maxW: w - 60 };
    BTN.again = R(cx - 220, cy + 200, 440, 96); BTN.back = R(cx - 220, cy + 316, 440, 84);
    L.over.more = { x: cx, y: cy + 316 + 84 + 56, size: 24 };
  } else {
    const lw = U.w / 2, ax = U.x0 + lw / 2, cy = h / 2, bw = Math.min(440, lw - 60), bx2 = U.x0 + lw + (lw - bw) / 2;
    L.over = { piece: { x: ax, y: cy - 120, s: 2.6 }, won: { x: ax, y: cy + 50, size: 52 }, reason: { x: ax, y: cy + 100, size: 24 }, moves: { x: ax, y: cy + 140, size: 22 }, star: { x: ax, y: cy + 176, size: 22 }, maxW: lw - 40 };
    BTN.again = R(bx2, cy - 110, bw, 96); BTN.back = R(bx2, cy + 6, bw, 84);
    L.over.more = { x: bx2 + bw / 2, y: cy + 6 + 84 + 56, size: 24 };
  }
  L.demo = { title: { x: cx, y: h / 2 - 20, size: 40 }, l1: { x: cx, y: h / 2 + 50, size: 28 }, l2: { x: cx, y: h / 2 + 90, size: 28 }, back: R(cx - 220, h / 2 + 140, 440, 84), maxW: w - 60 };
  L.making = { title: { x: cx, y: h / 2 - 60, size: 50 }, line: { x: cx, y: h / 2, size: 32 } };

  // ---- reference pages (About / Controls / Rules) ----------------------------------------------------------------------
  {
    let panel, nav;
    if (!land) {
      const pw = Math.min(648, U.w - 24), px = (w - pw) / 2, py = tall ? Math.max(140, ins.t + 10) : Math.max(ins.t + 10, 20);
      panel = R(px, py, pw, barY - 14 - py);
      const nw = Math.min(262, (w - 56) / 2);
      nav = { back: R(cx - 8 - nw, barY, nw, barH), next: R(cx + 8, barY, nw, barH) };
    } else {
      const nw = 210, pw = Math.min(U.w - 24, 1240), px = U.x0 + (U.w - pw) / 2;
      panel = R(px, U.y0 + 10, pw - nw - 16, U.h - 20);
      const nx = panel.x + panel.w + 16, nbh = 72;
      nav = { next: R(nx, panel.y + panel.h - nbh, nw, nbh), back: R(nx, panel.y + panel.h - 2 * nbh - 14, nw, nbh) };
    }
    const sbw = 110, sbh = 54, dec = R(panel.x + panel.w - 20 - 2 * sbw - 10, panel.y + 14, sbw, sbh), inc = R(panel.x + panel.w - 20 - sbw, panel.y + 14, sbw, sbh);
    const backOverlap = ins.back && bb.x + bb.w > panel.x && bb.y < panel.y + 80 && bb.y + bb.h > panel.y;
    const hl = Math.max(panel.x + 20, backOverlap ? bb.x + bb.w + 8 : 0);
    const vp = R(panel.x + 22, panel.y + 176, panel.w - 44 - 16, panel.h - 176 - 46);
    L.pages = { panel, nav, dec, inc, labelX: (hl + dec.x - 8) / 2, labelMaxW: dec.x - 8 - hl, labelY: panel.y + 58, titleY: panel.y + 118, braidY: panel.y + 152, viewport: vp, scrollbar: R(vp.x + vp.w + 6, vp.y, 10, vp.h), counterY: panel.y + panel.h - 16, cx: panel.x + panel.w / 2 };
  }

  const titles = {};
  L.title = (hasSave) => (titles[hasSave ? 1 : 0] ??= buildTitle(L, !!hasSave));
  return L;
}

// Title / menu. Portrait: hero on top, then the main buttons (one or two columns, as the height allows), then a 2-column settings grid and stats.
// Landscape: hero + settings + stats on the left, the main buttons in a column on the right.
const LOCK_AR = 327 / 1200;
function lockRect(cx, y, maxW) { const lw = Math.min(260, maxW), lh = lw * LOCK_AR; return R(cx - lw / 2, y, lw, lh); }
// Tap zone of the title lockup: >= 44 css px each way, extended sideways and downward only (never into the buttons above).
export function lockHit(L, T) {
  const r = T.lock; if (!r) return null; const m = 44 / Math.max(0.05, host.px);
  const w = Math.max(r.w, m), x = r.x + r.w / 2 - w / 2, y = r.y - 2;
  return R(x, y, w, Math.max(r.h + 2, Math.min(m, L.h - y)));
}

function buildTitle(L, hasSave) {
  const { w, h, ins, U, mode } = L, main = (hasSave ? ['resume'] : []).concat(MAIN), m = main.length, rows = {};
  const STATS = 92;
  if (mode !== 'wide') {
    const top = mode === 'tall' ? ins.t + 8 : Math.max(ins.t + 8, 72), lk = lockRect(w / 2, 0, 300), lockY = h - Math.max(ins.b, 10) - lk.h - 6, bottom = lockY - 10, avail = bottom - top;
    const need = (f, mc) => Math.ceil(m / mc) * Math.round(76 * f) + 4 * Math.round(68 * f) + 6 + STATS + 12;
    const tries = [[1, 1, 330], [0.88, 1, 330], [1, 2, 300], [0.88, 2, 280], [0.76, 2, 0]];
    let pick = tries[tries.length - 1];
    for (const t of tries) if (avail - need(t[0], t[1]) >= t[2]) { pick = t; break; }
    const [f, mc] = pick, pm = Math.round(76 * f), bm = Math.round(66 * f), ps = Math.round(68 * f), bsx = Math.round(60 * f);
    const bw = mc === 2 ? 648 : 540, x0 = (w - bw) / 2, hero = Math.max(120, avail - need(f, mc));
    let y = top + hero;
    const heroRect = R(0, top, w, hero);
    if (mc === 1) main.forEach((nm, i) => { rows[nm] = R(x0, y + i * pm, bw, bm); });
    else { const cw = (bw - 16) / 2; main.forEach((nm, i) => { rows[nm] = R(x0 + (i % 2) * (cw + 16), y + Math.floor(i / 2) * pm, cw, bm); }); }
    y += Math.ceil(m / mc) * pm + 6;
    const sw = (bw - 16) / 2;
    SETTINGS.forEach((nm, i) => { rows[nm] = R(x0 + (i % 2) * (sw + 16), y + Math.floor(i / 2) * ps, sw, bsx); });
    y += 4 * ps + 18;
    return { rows, hero: heroRect, stats: R(x0, y, bw, STATS), mc, cols: 2, lock: { ...lk, y: lockY } };
  }
  const rightW = clamp(w * 0.42, 400, 540), colX = U.x1 - rightW - 16, colW = rightW;
  const lk = lockRect(colX + colW / 2, 0, colW - 20), top = U.y0 + 14, bottom = U.y1 - 14 - lk.h - 12, avail = bottom - top;
  const pitch = Math.min(96, avail / m), bh = Math.round(pitch - 12);
  const my = top + (avail - m * pitch) / 2;
  main.forEach((nm, i) => { rows[nm] = R(colX, my + i * pitch + 6, colW, bh); });
  const leftX = U.x0 + 16, leftW = colX - 16 - leftX, cols = clamp(Math.floor((leftW + 12) / 262), 2, 4), nrows = Math.ceil(SETTINGS.length / cols);
  const cw = (leftW - (cols - 1) * 12) / cols, ps = 60, bsx = 52;
  const statsH = 84, setTop = bottom - statsH - 10 - nrows * ps;
  SETTINGS.forEach((nm, i) => { rows[nm] = R(leftX + (i % cols) * (cw + 12), setTop + Math.floor(i / cols) * ps, cw, bsx); });
  return { rows, hero: R(leftX, 62, leftW, setTop - 10 - 62), stats: R(leftX, bottom - statsH, leftW, statsH), mc: 1, cols, wide: true, lock: { ...lk, y: U.y1 - 10 - lk.h } };
}
