// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side follows
// the screen, in portrait and landscape). `layoutFor(w, h)` returns every position for that size and is cached, so a frame never
// recomputes it. Three shapes:
//   tall     portrait phone (h >= 1540): the approved phone look, unchanged.
//   compact  portrait shorter than a phone (tablets, small phones): header on top, board, bar below; the board shrinks to fit.
//   wide     landscape: info card on the left, board in the middle, button card on the right (a single left card on 4:3 screens).
// The board itself is always drawn in its canonical coordinates (the slab square SLAB, grid GRID) inside a transform
// (`L.board`: slab top-left on screen + scale), so art.js / the stone code never needs to know where the board is.
export const W = 720, H = 1560;                         // canonical art space (the original phone layout)
export const SLAB = { x: 24, y: 424, w: 672, h: 672 };
export const GRID = { x: 60, y: 460, size: 600 };
export const cellSize = (n) => GRID.size / n;
export const cellCenter = (n, i) => { const c = cellSize(n), x = i % n, y = (i - x) / n; return { x: GRID.x + (x + 0.5) * c, y: GRID.y + (y + 0.5) * c }; };
export const stoneRadius = (n) => cellSize(n) * 0.375;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_THINK_DEFAULT = 1; // index of 5s
export const AUTO_REVEAL_SECONDS = 2;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px).
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

function build(w, h, ins) {
  const land = w >= h, tall = !land && h >= 1540, mode = land ? 'wide' : tall ? 'tall' : 'compact';
  const L = { w, h, land, tall, mode, ins };
  const bb = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, bb + 8, bb + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const oy = L.oy = tall ? (h - 1560) / 2 : 0;
  const backBottom = ins.back ? L.backBox.y + L.backBox.h : 0;
  L.hz = land ? Math.round(h * 0.36) : Math.round(h * 0.28);           // horizon of the backdrop
  const botPad = tall ? Math.max(26, ins.b + 8) : Math.max(14, ins.b + 6);
  const barH = 72, barY = L.barY = h - barH - botPad;
  L.minFont = 11 / Math.max(0.05, ins.px);                              // virtual units that are 11 css px
  const B = L.board = { s: 1, x: SLAB.x, y: SLAB.y };                    // slab top-left on screen + scale
  L.trays = null; L.msg = null; L.hdr = null; L.hdrWide = false;
  const BTN = L.BTN = {};

  if (!land) {
    // ---- portrait: header, board, [trays], message slot, bar ----
    const Ht = tall ? Math.max(192 + oy, backBottom + 2) : Math.max(ins.t + 44, backBottom + 2);
    L.hdr = R(24, Ht, 672, 214); L.labelY = Ht - 16; L.titleY = tall ? Ht - 64 : 0;
    const top = Ht + 214 + 18, msgSlot = tall ? 64 : 94, avail = barY - 16 - top;
    let s = 1, trays = false;
    if (avail >= 672 + 34 + 150 + 30 + 64) trays = true;
    else if (avail < 672 + 30 + msgSlot) s = Math.max(0.5, (avail - 30 - msgSlot) / 672);
    B.s = s; B.x = (w - 672 * s) / 2; B.y = top;
    const bottom = top + 672 * s;
    if (trays) L.trays = [R(40, bottom + 34, 310, 150), R(370, bottom + 34, 310, 150)];
    L.msgBottom = barY - 10; L.msg = R(40, 0, 640, 0);
    Object.assign(BTN, {
      menu: R(60, barY, 190, barH), undo: R(265, barY, 190, barH), hint: R(470, barY, 190, barH),
      next: R(265, barY, 395, barH), share: R(265, barY, 395, barH),
    });
    const dy = tall ? oy : (h - 1560) / 2 - 30;                           // result screen: the phone block, shifted to sit in the screen
    BTN.again = R(140, 1000 + dy, 440, 96); BTN.back = R(140, 1116 + dy, 440, 84);
    L.over = { cx: 360, stone: { y: 640 + dy, r: 100 }, won: { y: 830 + dy, size: 72 }, reason: { y: 886 + dy }, moves: { y: 932 + dy }, star: { y: 970 + dy }, moreY: 1236 + dy, panelY: 800 + dy };
    const aw = (672 - 4 * 10) / 5, ax = (i) => 24 + i * (aw + 10);
    BTN.auto = { exit: R(ax(0), barY, aw, barH), skip: R(ax(1), barY, aw, barH), pause: R(ax(2), barY, aw, barH), dec: R(ax(3), barY, aw, barH), inc: R(ax(4), barY, aw, barH) };
  } else {
    // ---- landscape: [info card] [board] [button card]; on a 4:3 screen the buttons move into the left card ----
    const pad = 14;
    let Bs = Math.min(U.h - 2 * pad, 672 * 1.05, U.w - 330 - 3 * pad); Bs = Math.max(Bs, 300);
    const s = Bs / 672, bw = 672 * s, rest = U.w - bw - 4 * pad, two = rest >= 600;
    B.s = s;
    const by = U.y0 + (U.h - bw) / 2, cardTop = Math.max(U.y0 + pad, backBottom + 4);
    let leftCard, rightCard = null;
    if (two) {
      const Lw = clamp(rest * 0.56, 300, 520), Rw = Math.min(rest - Lw, 460), total = Lw + bw + Rw + 4 * pad, x0 = U.x0 + (U.w - total) / 2 + pad;
      leftCard = R(x0, cardTop, Lw, U.y1 - pad - cardTop); B.x = x0 + Lw + pad; B.y = by;
      rightCard = R(B.x + bw + pad, U.y0 + pad, Rw, U.h - 2 * pad);
    } else {
      const Pw = U.w - bw - 3 * pad, x0 = U.x0 + pad;
      leftCard = R(x0, cardTop, Pw, U.y1 - pad - cardTop); B.x = x0 + Pw + pad; B.y = by;
    }
    L.leftCard = leftCard; L.rightCard = rightCard; L.two = two;
    // buttons: a stack of slots at the bottom of the left card (single) or centred in the right card (two cards)
    const bx = two ? rightCard.x + 12 : leftCard.x + 12, bwid = (two ? rightCard.w : leftCard.w) - 24;
    const bh = two ? clamp(Math.floor((rightCard.h - 60) / 6), 56, 84) : 58, gap = 10;
    const stackTop = (n) => two ? rightCard.y + (rightCard.h - (n * bh + (n - 1) * gap)) / 2 : leftCard.y + leftCard.h - 12 - (n * bh + (n - 1) * gap);
    const slot = (n, i) => R(bx, stackTop(n) + i * (bh + gap), bwid, bh);
    const half = (r, k) => R(r.x + (k ? (r.w + 8) / 2 : 0), r.y, (r.w - 8) / 2, r.h);
    Object.assign(BTN, { menu: slot(3, 0), undo: slot(3, 1), hint: slot(3, 2), next: slot(3, 1), share: slot(3, 1) });
    BTN.auto = { exit: slot(4, 0), skip: slot(4, 1), pause: slot(4, 2), dec: half(slot(4, 3), 0), inc: half(slot(4, 3), 1) };
    // info card: header content on top, trays (if the card is tall) at the bottom, the message over the lower part
    const bt = stackTop(4), infoBottom = two ? leftCard.y + leftCard.h : bt - 12;
    L.hdrWide = true;
    const trayH = 92, wantTrays = two && leftCard.h >= 560;
    L.hdr = R(leftCard.x, leftCard.y, leftCard.w, infoBottom - leftCard.y - (wantTrays ? 2 * trayH + 24 : 0));
    if (wantTrays) L.trays = [R(leftCard.x + 8, leftCard.y + leftCard.h - 2 * trayH - 12, leftCard.w - 16, trayH), R(leftCard.x + 8, leftCard.y + leftCard.h - trayH - 6, leftCard.w - 16, trayH)];
    L.msgBottom = wantTrays ? L.trays[0].y - 8 : infoBottom - 4; L.msg = R(leftCard.x + 8, 0, leftCard.w - 16, 0);
    const cx = w / 2, cy = (U.y0 + U.y1) / 2;                            // result screen: one compact centred stack
    BTN.again = R(cx - 220, cy + 30, 440, 80); BTN.back = R(cx - 220, cy + 122, 440, 66);
    L.over = { cx, stone: { y: cy - 215, r: 62 }, won: { y: cy - 105, size: 60 }, reason: { y: cy - 60 }, moves: { y: cy - 24 }, star: { y: cy + 10 }, moreY: cy + 232, panelY: cy - 150 };
  }

  // ---- board transform helpers ----
  const toCanon = (x, y) => ({ x: (x - B.x) / B.s + SLAB.x, y: (y - B.y) / B.s + SLAB.y });
  L.squareAt = (n, x, y) => {
    const p = toCanon(x, y), c = cellSize(n), cx = Math.floor((p.x - GRID.x) / c), cy = Math.floor((p.y - GRID.y) / c);
    return cx < 0 || cy < 0 || cx >= n || cy >= n ? -1 : cx + n * cy;
  };
  L.cellScreen = (n, i) => { const p = cellCenter(n, i); return { x: B.x + (p.x - SLAB.x) * B.s, y: B.y + (p.y - SLAB.y) * B.s }; };

  // ---- reference pages (How to play / About / Rules): header row, scrolling reader card, nav row ----
  {
    const y0 = ins.t + 10, tsW = 104, tsH = 58, tsR = w - ins.r - 24;
    const TS = { dec: R(tsR - 2 * tsW - 10, y0, tsW, tsH), inc: R(tsR - tsW, y0, tsW, tsH) };
    const cardTop = Math.max(y0 + tsH + 12, backBottom + 4), cardBottom = barY - 46;
    const cw = land ? Math.min(980, U.w - 48) : 640, cx = w / 2;
    const card = R(cx - cw / 2, cardTop, cw, Math.max(120, cardBottom - cardTop));
    const nx = land ? cx - 300 : 60, tl = backBottom ? L.backBox.x + L.backBox.w + 12 : U.x0 + 12;
    L.pages = {
      TS, card, title: { x: (tl + TS.dec.x - 12) / 2, y: y0 + 44, maxW: TS.dec.x - 12 - tl },
      prev: R(nx, barY, 190, barH), back: R(nx + 205, barY, 190, barH), next: R(nx + 410, barY, 190, barH), counterY: barY - 16,
      view: R(card.x + 14, card.y + 12, card.w - 28, card.h - 24), scrollbar: R(card.x + card.w - 14, card.y + 20, 6, card.h - 40),
    };
  }

  L.setup = buildSetup(L);
  const tcache = {};
  L.title = (hasSave) => (tcache[hasSave ? 1 : 0] ??= buildTitle(L, !!hasSave));
  return L;
}

// ---- the title screen: a hero (title, tagline, brand credit, small slab with a live demo) and the menu buttons ----
const LOCK_AR = 327 / 1200;
function lockRect(cx, y, maxW) { const lw = Math.min(260, maxW), lh = lw * LOCK_AR; return R(cx - lw / 2, y, lw, lh); }
// Tap zone of the title lockup (>= 44 css px each way; sideways and downward only, never into the buttons above).
export function lockHit(L, T) {
  const r = T.lock; if (!r) return null; const m = 44 / Math.max(0.05, host.px);
  const w = Math.max(r.w, m), x = r.x + r.w / 2 - w / 2, y = r.y - 2;
  return R(x, y, w, Math.max(r.h + 2, Math.min(m, L.h - y)));
}
function buildTitle(L, hasSave) {
  const { w, h, U, ins } = L, T = { rows: {}, hero: null, stats: null, msg: null };
  T.sizes = { resume: 30, play: 32, learn: 30, daily: 28, how: 27, about: 28, rules: 26, auto: 26, sound: 22, calm: 22, big: 21 };
  if (L.tall) {
    const oy = L.oy, names = (hasSave ? ['resume'] : []).concat(['play', 'learn', 'daily', 'how', 'about']), y0 = (hasSave ? 690 : 730) + oy;
    names.forEach((nm, i) => { T.rows[nm] = R(90, y0 + i * 88, 540, 76); });
    const rulesY = y0 + names.length * 88;
    T.rows.rules = R(90, rulesY, 262, 76); T.rows.auto = R(368, rulesY, 262, 76);
    const y = rulesY + 96;
    T.rows.sound = R(90, y, 172, 62); T.rows.calm = R(274, y, 172, 62); T.rows.big = R(458, y, 172, 62);
    T.hero = { cx: 360, cy: 484 + oy, sc: 0.57, titleX: 360, titleY: 150 + oy, tagX: 360, tagY: 208 + oy, creditY: 252 + oy, titleSize: 96 };
    T.lock = lockRect(360, y + 62 + 10, 300); T.stats = { x: 360, y: y + 62 + 10 + T.lock.h + 34 }; T.msg = { x: 360, y: T.stats.y + 48, w: 620 };
    return T;
  }
  const rows = (hasSave ? [['resume']] : []).concat([['play'], ['learn', 'daily'], ['how', 'about'], ['rules', 'auto'], ['sound', 'calm', 'big']]);
  if (!L.land) {
    const bp = Math.max(18, ins.b + 8), lk = lockRect(w / 2, 0, 300);
    const yT0 = Math.max(ins.t + 92, L.backBox.y + L.backBox.h + 40, 126), zoneMin = yT0 + 54 + 6 + 16 + 290;           // the demo slab keeps >= ~290 units
    const pitch = clamp((h - bp - zoneMin - lk.h - 10 - 84) / rows.length, 56, 80), bh = pitch - 10;
    const blockH = rows.length * pitch + lk.h + 10 + 44 + 40, rowsTop = h - bp - blockH;
    rows.forEach((row, i) => placeRow(T, row, 60, 600, rowsTop + i * pitch, bh, 12));
    const yT = Math.max(ins.t + 92, L.backBox.y + L.backBox.h + 40, 126), tag = yT + 54, cred = tag + 6;
    const zoneTop = cred + 16, zoneH = rowsTop - 8 - zoneTop, sc = Math.min(0.57, (zoneH - 6) / 672);
    T.hero = { titleX: 360, titleY: yT, tagX: 360, tagY: tag, creditY: cred, titleSize: 96, cx: 360, sc: sc >= 0.3 ? sc : 0, cy: zoneTop + zoneH / 2 };
    T.lock = lockRect(w / 2, rowsTop + rows.length * pitch + 2, 300); T.stats = { x: 360, y: T.lock.y + lk.h + 28 }; T.msg = { x: 360, y: T.stats.y + 38, w: 620 };
    return T;
  }
  // landscape: hero on the left, buttons in a column on the right
  const pad = 14, colW = clamp(w * 0.42, 340, 560), colX = U.x1 - colW - Math.max(pad, 20);
  const lk = lockRect(0, 0, colW - 40), pitch = Math.min(84, (U.h - 2 * pad - 70 - lk.h - 10) / rows.length), bh = Math.min(72, pitch - 10), blockH = rows.length * pitch;
  const top = U.y0 + Math.max(pad, (U.h - blockH - 70 - lk.h - 10) / 2);
  rows.forEach((row, i) => placeRow(T, row, colX, colW, top + i * pitch, bh, 10));
  T.lock = lockRect(colX + colW / 2, top + blockH + 2, colW - 40); T.stats = { x: colX + colW / 2, y: T.lock.y + lk.h + 26 }; T.msg = { x: colX + colW / 2, y: T.lock.y + lk.h + 56, w: colW };
  const hx0 = U.x0 + pad, hx1 = colX - pad, hcx = (hx0 + hx1) / 2, hw = hx1 - hx0;
  const titleSize = hw < 420 ? 72 : 96, sc = Math.min(0.57, (U.h - titleSize - 110) / 672);
  const blockTop = U.y0 + Math.max(pad, (U.h - (titleSize + 90 + 672 * sc)) / 2);
  T.hero = { cx: hcx, sc, titleX: hcx, titleY: blockTop + titleSize * 0.8, tagX: hcx, tagY: blockTop + titleSize * 0.8 + 44, creditY: blockTop + titleSize * 0.8 + 50, cy: blockTop + titleSize * 0.8 + 50 + 36 + 672 * sc / 2, titleSize };
  if (L.backBox.w) T.hero.titleY = Math.max(T.hero.titleY, L.backBox.y + 70);
  return T;
}
function placeRow(T, row, x0, aw, y, bh, gap) {
  const n = row.length, cw = (aw - gap * (n - 1)) / n;
  row.forEach((nm, i) => { T.rows[nm] = R(x0 + i * (cw + gap), y, cw, bh); });
}

// ---- the setup screen ----
// Geometry for one column of groups, scaled in y by f (the canonical phone layout is f = 1, group origin = panel top).
function buildSetup(L) {
  const { w, h, U, ins } = L, S = {};
  const colGroups = (x0, cw, y0, f, which) => {
    const out = {}, bw = (cw - 24) / 3, tri = (dy) => [0, 1, 2].map((i) => R(x0 + i * (bw + 12), y0 + dy * f, bw, 84 * f));
    if (which === 'a' || which === 'ab') {
      out.labelA = { x: x0, y: y0 + 44 * f, t: 'Board (slab) size' }; out.sizes = tri(70); out.descA = { x: x0 + cw / 2, y: y0 + 192 * f, w: cw };
      out.labelB = { x: x0, y: y0 + 234 * f, t: 'You play' }; out.sides = tri(260); out.descB = { x: x0 + cw / 2, y: y0 + 380 * f, w: cw };
    }
    if (which === 'b' || which === 'ab') {
      const dy = which === 'ab' ? 0 : -378, lw = (cw - 12) / 2;
      out.labelC = { x: x0, y: y0 + (422 + dy) * f, t: 'Computer level' };
      out.levels = [0, 1, 2, 3].map((i) => R(x0 + (i % 2) * (lw + 12), y0 + (440 + dy + Math.floor(i / 2) * 92) * f, lw, 80 * f));
      out.blurb = { x: x0 + cw / 2, y: y0 + (650 + dy) * f, w: cw - 20 };
      out.start = R(x0 + cw * 0.1, y0 + (670 + dy) * f, cw * 0.8, 96 * f); out.back = R(x0 + cw / 2 - 95, y0 + (842 + dy) * f, 190, 72 * f);
    }
    return out;
  };
  if (!L.land) {
    const bp = Math.max(24, ins.b + 8);
    S.titleY = L.tall ? 150 + L.oy : Math.max(ins.t + 92, L.backBox.y + L.backBox.h + 40, 126); S.subY = S.titleY + 55;
    const top = Math.max(S.subY + 22, Math.min(620 + L.oy, h - bp - 914)), f = Math.min(1, (h - bp - top) / 914);
    S.panel = R(50, top, 620, 880 * f); Object.assign(S, colGroups(90, 540, top, f, 'ab'));
  } else {
    const top = U.y0 + 190, f = Math.min(1, (U.y1 - 22 - top) / 540);
    const cw = clamp((U.w - 140) / 2, 360, 520), x0 = w / 2 - cw - 20, x1 = w / 2 + 20;
    S.panel = R(x0 - 22, top - 20, cw * 2 + 84, 540 * f + 40);
    Object.assign(S, colGroups(x0, cw, top, f, 'a'), colGroups(x1, cw, top, f, 'b'));
    S.titleY = U.y0 + 70; S.subY = S.titleY + 52;
  }
  return S;
}
