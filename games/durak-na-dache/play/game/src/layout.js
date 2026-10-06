// Geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, so a
// portrait screen is 720 x h and a landscape one is w x 720). `layoutFor(w, h, variant)` returns every position for
// that size, cached per size / safe-area key. Shapes:
//   portrait   (h >= 960, narrower than tall): top bar, opponents, talon row, table, action bar, your hand (fans into rows).
//              Sections interpolate between a compact size (iPad / short phones) and the approved phone look (h = 1560).
//   landscape  (everything else): left panel (status, talon, trump, discard), centre (opponents, table, your hand),
//              right panel (menu / sound and the action buttons).
// Variants: 'play' | 'auto' (adds Auto Play's strip / panel) | 'teach' (Learn and Daily: a text panel replaces the talon row).
export const CARD = { w: 150, h: 210 };
export const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
export const ACTIONS = ['take', 'bito', 'hint', 'undo', 'seen'];

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const rect = (x, y, w, h) => ({ x, y, w, h });
export const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const cache = new Map();
export function layoutFor(w, h, variant = 'play') {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${variant}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, variant, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return L;
}
export const variantOf = (scene) => (scene === 'auto' ? 'auto' : scene === 'lesson' || scene === 'daily' ? 'teach' : 'play');

// Best way to lay up to 6 table pairs into zone Z: 3x2, 6x1 or 2x3, whichever gives the biggest cards (capped at maxS).
function fitPairs(Z, maxS) {
  let best = null;
  for (const [cols, rows] of [[3, 2], [6, 1], [2, 3]]) {
    const s = Math.min(Z.w / (cols * CARD.w * 1.26), Z.h / (rows * CARD.h * 1.16));
    if (!best || s > best.s * 1.03) best = { cols, rows, s };
  }
  const s = Math.min(maxS, best.s), cw = Z.w / best.cols, ch = Z.h / best.rows;
  return {
    scale: s, cols: best.cols, rows: best.rows,
    spot: (i) => ({ x: Z.x + ((i % best.cols) + 0.5) * cw, y: Z.y + (((i / best.cols) | 0) + 0.5) * ch }),
    off: { x: 36 * s, y: 27 * s },
  };
}

// The hand: up to hs-sized cards in one row centred on cx inside [x0, x1]; the zone is `zoneH` tall and ends at `bottom`.
// Bigger hands shrink the cards and wrap into 2-3 rows INSIDE the same zone (never into the table or the buttons).
// slot(i, n) -> { x, y, rot, row, scale } (centre of card i of n; scale = this card's draw scale).
function handFn(hs, cx, x0, x1, bottom, zoneH) {
  const span = x1 - x0, MIN = 0.5;
  const perRowAt = (sc) => Math.max(3, Math.floor((span - CARD.w * sc) / (MIN * CARD.w * sc)) + 1);
  const plan = (n) => {
    for (let rows = 1; rows <= 3; rows++) {
      const sc = rows === 1 ? hs : Math.min(hs, (zoneH - 30) / (CARD.h * (1 + 0.5 * (rows - 1)) + 46));
      if (perRowAt(sc) * rows >= n || rows === 3) return { rows, sc, per: perRowAt(sc) };
    }
  };
  const slot = (i, n) => {
    const { rows, sc } = plan(n), cw = CARD.w * sc, ch = CARD.h * sc;
    const perThis = rows === 1 ? n : Math.ceil(n / rows);
    const row = rows === 1 ? 0 : Math.min(rows - 1, Math.floor(i / perThis));
    const col = rows === 1 ? i : i - row * perThis;
    const cnt = rows === 1 ? n : Math.min(perThis, n - row * perThis);
    const step = cnt <= 1 ? 0 : Math.min((cnt <= 6 ? 0.72 : 0.667) * cw, (span - cw) / (cnt - 1));
    const c = col - (cnt - 1) / 2, mc = (Math.ceil(perThis) - 1) / 2;
    const rot = (rows === 1 ? c * (cnt <= 6 ? 2.6 : 2.2) : c * 1.4) * Math.PI / 180;
    const pitch = ch * 0.5, curve = Math.min(rows === 1 ? 1.5 : 0.6, (rows === 1 ? 20 : 8) / Math.max(1, mc * mc)) * sc;
    const yb = bottom - ch / 2 - curve * mc * mc - 5;                // bottom row's centre line, leaving room for the fan's curve
    return { x: cx + c * step, y: yb - (rows - 1 - row) * pitch + curve * c * c, rot, row, scale: sc };
  };
  return { slot, lift: (sc) => 46 * sc, cw: CARD.w * hs, ch: CARD.h * hs };
}

function build(w, h, variant, ins) {
  const land = !(h >= 960 && w < h);
  const L = { w, h, land, variant, ins, mode: land ? 'wide' : 'tall' };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? rect(ins.l, ins.t, backSz + 8, backSz + 8) : rect(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const X0 = Math.max(20, U.x0 + 14), X1 = Math.min(w - 20, U.x1 - 14);
  L.X0 = X0; L.X1 = X1;
  const bottomPad = Math.max(14, ins.b + 6), g = 8;
  const teach = variant === 'teach', auto = variant === 'auto';
  const BAR_H = 80;
  const clock = Math.min(60, Math.ceil(30 / Math.max(0.3, ins.px || 0.6)));   // the kit's preview clock sits at the top centre (about 30 css px tall): keep our content clear of it

  // ---------------------------------------------------------------- play screens
  if (!land) {
    const t = clamp((h - 960) / 600, 0, 1);
    const kpx = Math.max(0.3, ins.px || 0.6), badgeBottom = Math.ceil(6 / kpx + 1.7 * Math.max(16, 11.5 / kpx) + 3);   // the kit's "Preview m:ss" pill, top-centre below the top inset
    const y0 = Math.max(14, U.y0 + 8, U.y0 + badgeBottom, clock);
    let topH = Math.round(lerp(72, 90, t));
    if (ins.back) topH = Math.max(topH, Math.ceil(L.backBox.y + L.backBox.h - y0 + 2));   // the host's floating back button sits in this row: nothing of ours starts under it
    let hs = teach ? lerp(0.66, 1, t) : lerp(0.72, 1, t);
    let oppH = Math.round(teach ? lerp(130, 170, t) : lerp(150, 190, t));
    let infoH = teach ? 0 : Math.round(lerp(132, 180, t));
    const autoH = auto ? 84 + g : 0, teachH = teach ? 224 + g : 0, tableMin = teach ? 200 : 236;
    // heights: top bar, [auto strip | teach band], opponents, [talon row], TABLE, action bar, hand, bottom pad  (gaps g between)
    const fixed = () => y0 + topH + g + autoH + teachH + oppH + g + (teach ? 0 : infoH + g) + g + BAR_H + g + Math.round(CARD.h * hs + 46 * hs + 30) + bottomPad;
    // not enough height for a comfortable table: squeeze the hand, the opponents and the talon row, in that order
    for (let step = 0; step < 3 && h - fixed() < tableMin; step++) {
      const need = tableMin - (h - fixed());
      if (step === 0) hs = Math.max(0.6, hs - need / 256);
      else if (step === 1) oppH = Math.max(teach ? 116 : 126, oppH - need);
      else if (!teach) infoH = Math.max(112, infoH - need);
    }
    // spare height on tall phones becomes headroom above the opponents (the approved phone look keeps the wall art + stitched band above the talon row)
    const head = Math.round(clamp((h - 1100) / 460, 0, 1) * 115);
    const headFit = Math.max(0, Math.min(head, h - fixed() - tableMin - 20));
    let y = y0;
    let xl = X0; if (ins.back && L.backBox.y < y + topH) xl = Math.max(xl, L.backBox.x + L.backBox.w + 6);
    const menu = rect(xl, y, 96, topH), sound = rect(X1 - 96, y, 96, topH);
    const info = rect(menu.x + 110, y, sound.x - 14 - (menu.x + 110), topH);
    L.top = { menu, info, sound };
    L.back = menu;
    y += topH + g;
    if (auto) { L.auto = { bar: rect(X0, y, X1 - X0, 84), dec: rect(X0 + 6, y + 6, 76, 72), inc: rect(X1 - 82, y + 6, 76, 72) }; y += 84 + g; }
    const handH = Math.round(CARD.h * hs + 46 * hs + 30);
    const yBar = h - bottomPad - handH - g - BAR_H;
    const oppK = Math.min(lerp(0.42, 0.5, t), (oppH - 70) / CARD.h);
    let teachBand = null;
    if (teach) { teachBand = rect(X0, y, X1 - X0, 224); y += 224 + g; }
    y += headFit;
    const yOpp = y; y += oppH + g;
    let infoRow = null;
    if (!teach) { infoRow = rect(X0, y, X1 - X0, infoH); y += infoH + g; }
    const Z = rect(X0, y, X1 - X0, Math.max(120, yBar - g - y));
    L.table = Z;
    L.oppZone = rect(X0, yOpp, X1 - X0, oppH);
    L.oppScale = (n) => oppK * (n === 2 ? 1 : n === 3 ? 0.88 : 0.8);
    L.teachBand = teachBand;
    L.infoRow = infoRow;
    const bw = (X1 - X0 - 4 * 10) / 5;
    L.bar = {}; ACTIONS.forEach((k, i) => { L.bar[k] = rect(X0 + i * (bw + 10), yBar, bw, BAR_H); });
    const aw = (X1 - X0 - 20) / 3;
    L.autoBtns = { exit: rect(X0, yBar, aw, BAR_H), pause: rect(X0 + aw + 10, yBar, aw, BAR_H), skip: rect(X0 + 2 * (aw + 10), yBar, aw, BAR_H) };
    L.hand = handFn(hs, w / 2, X0, X1, h - bottomPad, handH);
    L.hs = hs;
    L.tablePairs = fitPairs(Z, 0.82);
    if (infoRow) {
      const s = clamp((infoRow.h - 30) / CARD.h, 0.36, 0.72), cw = CARD.w * s, cy = infoRow.y + (infoRow.h - 22) / 2;
      L.stock = { x: infoRow.x + 16 + cw / 2, y: cy, scale: s };
      L.trump = { x: L.stock.x + cw * 1.0, y: cy + 10 * s / 0.7, scale: s };
      L.discard = { x: infoRow.x + infoRow.w - 16 - cw / 2, y: cy, scale: s * 0.9 };
      L.suitIcon = { x: infoRow.x + infoRow.w / 2, y: cy, size: 40 * s / 0.7 };
      L.stockCount = { x: L.stock.x, y: cy + CARD.h * s / 2 + 14 };
    }
    L.hint = rect(Z.x + 10, Z.y + Z.h - 104, Z.w - 20, 98);
    L.seen = rect(Z.x + (Z.w - Math.min(Z.w - 20, 560)) / 2, Z.y + Math.max(0, (Z.h - 214) / 2 - 20), Math.min(Z.w - 20, 560), 214);
    L.wallPlay = clamp(Math.round((infoRow ? infoRow.y : Z.y) - 118), 140, 305);
    L.sceneMat = rect(Z.x - 4, Z.y - 8, Z.w + 8, Z.h + 16);
    if (teach) { const nb = rect(teachBand.x + (teachBand.w - 320) / 2, teachBand.y + teachBand.h - 86, 320, 76); L.teach = { panel: teachBand, next: nb, share: nb, textW: teachBand.w - 60 }; }
  } else {
    // ---- landscape: the height is always 720
    const pad = 10, topY = Math.max(pad, U.y0 + 6);
    const Lw = Math.round(clamp(U.w * (teach ? 0.27 : 0.2), teach ? 250 : 176, teach ? 340 : 252));
    const Rw = Math.round(clamp(U.w * 0.16, 150, 212));
    const lx = U.x0 + 8, rx = U.x1 - 8 - Rw;
    const cx0 = lx + Lw + 10, cx1 = rx - 10, cw = cx1 - cx0;
    const cardTop = ins.back ? Math.max(topY, L.backBox.y + L.backBox.h + 4) : topY;
    const botY = h - Math.max(pad, ins.b + 4);
    L.leftPanel = rect(lx, cardTop, Lw, botY - cardTop);
    L.rightPanel = rect(rx, topY, Rw, botY - topY);
    const half = (Rw - 8) / 2, rowH = 76;
    L.top = { menu: rect(rx, topY, half, rowH), sound: rect(rx + half + 8, topY, half, rowH), info: null };
    L.back = rect(rx, topY, Rw, rowH);
    const by = topY + rowH + 10, nBtn = auto ? 4 : 5, gapB = 10;
    const bh = Math.round(clamp((botY - by - (nBtn - 1) * gapB) / nBtn, 48, 84));
    L.bar = {}; ACTIONS.forEach((k, i) => { L.bar[k] = rect(rx, by + i * (bh + gapB), Rw, bh); });
    L.autoBtns = { exit: rect(rx, by, Rw, bh), pause: rect(rx, by + bh + gapB, Rw, bh), skip: rect(rx, by + 2 * (bh + gapB), Rw, bh) };
    const thinkY = by + 3 * (bh + gapB);
    if (auto) L.auto = { bar: rect(rx, thinkY, Rw, bh), dec: rect(rx, thinkY, half, bh), inc: rect(rx + half + 8, thinkY, half, bh) };
    const hs = teach ? 0.62 : 0.68;
    const handH = Math.round(CARD.h * hs + 46 * hs + 28);
    const oppH = teach ? 128 : 150;
    const clk = Math.max(0, clock - topY);
    L.oppZone = rect(cx0, topY + clk, cw, oppH);
    L.oppScale = (n) => (n === 2 ? 0.4 : n === 3 ? 0.36 : 0.32) * (teach ? 0.9 : 1);
    L.hand = handFn(hs, (cx0 + cx1) / 2, cx0, cx1, botY, handH);
    L.hs = hs;
    const zy = topY + clk + oppH + 6, zh = botY - handH - 8 - zy;
    const Z = L.table = rect(cx0, zy, cw, Math.max(150, zh));
    L.tablePairs = fitPairs(Z, 0.74);
    const ps = L.leftPanel;
    if (!teach) {
      const ih = 150;
      L.top.info = rect(ps.x, ps.y, ps.w, ih);
      const s = Math.min(0.6, (ps.w - 28) / 2.2 / CARD.w), cwS = CARD.w * s, chS = CARD.h * s;
      const cy = ps.y + ih + 18 + chS / 2;
      L.stock = { x: ps.x + 14 + cwS / 2, y: cy, scale: s };
      L.trump = { x: L.stock.x + cwS * 1.0, y: cy + 10 * s / 0.7, scale: s };
      L.stockCount = { x: L.stock.x, y: cy + chS / 2 + 14 };
      const dy = cy + chS / 2 + 14 + 18 + chS * 0.45;
      L.discard = { x: ps.x + 14 + cwS / 2, y: dy, scale: s * 0.9 };
      L.suitIcon = { x: L.discard.x + cwS * 1.25, y: dy, size: 40 * s / 0.7 };
      L.autoStatus = rect(ps.x, Math.min(ps.y + ps.h - 70, dy + chS * 0.5 + 22), ps.w, 64);
    } else {
      L.teach = { panel: rect(ps.x, ps.y, ps.w, ps.h), next: rect(ps.x + 14, ps.y + ps.h - 90, ps.w - 28, 76), share: rect(ps.x + 14, ps.y + ps.h - 90, ps.w - 28, 76), textW: ps.w - 50 };
    }
    L.hint = rect(Z.x + 10, Z.y + Z.h - 100, Z.w - 20, 96);
    L.seen = rect(Z.x + (Z.w - Math.min(Z.w - 20, 560)) / 2, Z.y + Math.max(0, (Z.h - 214) / 2), Math.min(Z.w - 20, 560), 214);
    L.wallPlay = 120;
    L.sceneMat = rect(Z.x - 4, Z.y - 4, Z.w + 8, Z.h + 8);
  }
  L.seat = (n, seat) => {
    const Oz = L.oppZone, others = n - 1, k = seat - 1, s = L.oppScale(n);
    const f = others === 1 ? [0.5] : others === 2 ? [0.27, 0.73] : [0.17, 0.5, 0.83];
    return { x: Oz.x + f[k] * Oz.w, y: Oz.y + 6 + CARD.h * s / 2, scale: s, maxW: Oz.w / others - 10, plaqueY: Oz.y + 6 + CARD.h * s + 8 + 28 };
  };
  L.pair = (i) => L.tablePairs.spot(i);
  L.xfer = (n) => { const s = L.pair(Math.min(5, n)), sc = L.tablePairs.scale; return { x: s.x, y: s.y, w: CARD.w * sc * 1.2, h: CARD.h * sc * 1.1 }; };
  {
    const pw = Math.min(w - 40, 560), ph = 396, px = (w - pw) / 2, py = Math.max(U.y0 + 10, (h - ph) / 2 - (land ? 0 : 40)), bw = Math.min(460, pw - 60);
    L.result = { panel: rect(px, py, pw, ph), again: rect(px + (pw - bw) / 2, py + 178, bw, 82), menu: rect(px + (pw - bw) / 2, py + 272, bw, 72), title: py + 70, sub: py + 124, more: py + ph - 26 };
  }
  buildScreens(L, w, h, X0, X1, bottomPad);
  return L;
}

// ------------------------------------------------------------------------------------------------ non-play screens
function buildScreens(L, w, h, X0, X1, bottomPad) {
  const { U, land } = L;
  const wallM = land ? 150 : L.wallPlay;
  L.wallMenu = wallM; L.wallBare = 80;

  // ---- title
  L.title = (n) => {
    const lkw = Math.max(250, 125 / Math.max(0.2, host.px || 0.6)), lkh = Math.round(lkw * 327 / 1200), strip = lkh + 22;     // Arcforge lockup under the menu (>= ~125 css px wide)
    const T = { sound: land ? rect(U.x1 - 8 - 76, Math.max(U.y0 + 8, 10), 76, 76) : L.top.sound };
    if (land) {
      const right0 = Math.max(U.x0 + U.w * 0.5, U.x0 + 320);
      const colW = Math.min(440, U.x1 - 24 - right0 - 8), colX = right0 + (U.x1 - right0 - colW) / 2;
      const y0 = T.sound.y + T.sound.h + 8, avail = h - y0 - bottomPad - strip;
      const two = avail / n < 84 && U.x1 - right0 >= 470;
      if (two) {
        const rows = Math.ceil(n / 2), pitch = Math.min(100, avail / rows), bh = Math.round(pitch - 10), tw = Math.min(40 + 210, (U.x1 - right0 - 40) / 2), gx = (U.x1 - right0 - 2 * tw - 10) / 2 + right0;
        T.btn = (i) => { const r = Math.floor(i / 2), c = i % 2, last = i === n - 1 && n % 2 === 1; return rect(last ? right0 + (U.x1 - right0 - tw) / 2 : gx + c * (tw + 10), y0 + r * pitch, tw, bh); };
      } else {
        const pitch = Math.min(92, avail / n), bh = Math.round(pitch - 10);
        T.btn = (i) => rect(colX, y0 + i * pitch, colW, bh);
      }
      const hx = U.x0 + (right0 - U.x0) / 2;
      T.word = { x: hx, y: wallM + 150, size: 88 }; T.tag = { x: hx, y: wallM + 206, size: 24 };
      T.cards = { x: hx, y: wallM + 310, scale: 0.7 };
      const sw = Math.min(210, (right0 - U.x0 - 56) / 2), sy = h - bottomPad - 70 - 52;
      T.statsL = rect(hx - sw - 6, sy, sw, 56); T.statsR = rect(hx + 6, sy, sw, 56);
      { const n1 = n - 1, last = T.btn(n1); const mx = two ? right0 + (U.x1 - right0) / 2 : colX + colW / 2; T.lockup = { x: mx, y: last.y + last.h + 12 + lkh / 2, w: lkw }; }
      T.demo = { x: hx, y: sy - 22 };
    } else {
      const lockH = strip, statsH = 60, hero = clamp(Math.round(h * 0.18), 250, 290);
      const yHero = wallM + 112;
      T.word = { x: w / 2, y: yHero + 44, size: Math.round(lerp(76, 96, clamp((h - 960) / 600, 0, 1))) };
      T.tag = { x: w / 2, y: yHero + 44 + T.word.size * 0.6 + 4, size: 24 };
      T.cards = { x: w / 2, y: yHero + hero - 70, scale: hero >= 270 ? 0.72 : 0.62 };
      const bTop = yHero + hero + 6, bBottom = h - bottomPad - lockH - statsH - 22;
      const avail = bBottom - bTop, single = avail / n;
      const cols = single >= 88 ? 1 : 2, rows = Math.ceil(n / cols);
      const pitch = Math.min(94, avail / rows), bh = Math.round(Math.min(86, pitch - 10)), cwid = cols === 1 ? Math.min(500, X1 - X0 - 40) : (X1 - X0 - 14) / 2;
      T.btn = (i) => {
        if (cols === 1) return rect(w / 2 - cwid / 2, bTop + i * pitch, cwid, bh);
        const r = Math.floor(i / 2), c = i % 2, last = i === n - 1 && n % 2 === 1;
        return rect(last ? w / 2 - cwid / 2 : X0 + c * (cwid + 14), bTop + r * pitch, cwid, bh);
      };
      const lastB = T.btn(n - 1), sw = Math.min(300, (X1 - X0 - 12) / 2);
      T.lockup = { x: w / 2, y: lastB.y + lastB.h + 12 + lkh / 2, w: lkw };
      const sy = T.lockup.y + lkh / 2 + 14;
      T.statsL = rect(X0, sy, sw, statsH - 6); T.statsR = rect(X1 - sw, sy, sw, statsH - 6);
      T.demo = { x: w / 2, y: sy + statsH + 6 };
    }
    { const m = 44 / Math.max(0.2, host.px || 0.6), q = T.lockup, qh = q.w * 327 / 1200, tw = Math.max(q.w + 24, m), th = Math.max(qh + 12, m);
      T.lockTap = rect(q.x - tw / 2, q.y - qh / 2 - 4, tw, Math.max(th, qh + 8)); }
    return T;
  };

  // ---- setup (New game)
  {
    const S = L.setup = { title: { x: w / 2, y: 0 } };
    if (land) {
      const top = Math.max(U.y0 + 8, 10), colGap = 28, cw = Math.min(430, (U.w - 3 * colGap) / 2);
      const lx = w / 2 - colGap / 2 - cw, rx = w / 2 + colGap / 2;
      S.title.y = top + 30;
      let y = top + 74; const bh = 72;
      S.labPlayers = { x: lx + cw / 2, y: y + 12 }; y += 30;
      S.players = [2, 3, 4].map((v, i) => ({ v, r: rect(lx + i * ((cw - 20) / 3 + 10), y, (cw - 20) / 3, bh) })); y += bh + 22;
      S.labMode = { x: lx + cw / 2, y: y + 12 }; y += 30;
      S.modes = [rect(lx, y, (cw - 10) / 2, bh + 10), rect(lx + (cw - 10) / 2 + 10, y, (cw - 10) / 2, bh + 10)];
      let ry = top + 74;
      S.labLevel = { x: rx + cw / 2, y: ry + 12 }; ry += 30;
      S.levels = [1, 2, 3, 4].map((v, i) => ({ v, r: rect(rx + (i % 2) * ((cw - 10) / 2 + 10), ry + ((i / 2) | 0) * (bh + 10), (cw - 10) / 2, bh) })); ry += 2 * (bh + 10) + 6;
      S.blurb = rect(rx, ry, cw, 64); ry += 64 + 12;
      S.start = rect(rx, Math.min(ry, h - bottomPad - 84), cw, 84);
    } else {
      const wall = L.wallPlay, top = wall + 186, bottom = h - bottomPad;
      const f = clamp((bottom - top) / 640, 0.7, 1.18), bh = Math.round(66 * f), gap = Math.round(14 * f);
      let y = top;
      S.title.y = wall + 146;
      S.labPlayers = { x: w / 2, y: y + 14 * f }; y += 32 * f;
      const cw = Math.min(500, X1 - X0 - 20), x0 = w / 2 - cw / 2;
      S.players = [2, 3, 4].map((v, i) => ({ v, r: rect(x0 + i * ((cw - 24) / 3 + 12), y, (cw - 24) / 3, bh) })); y += bh + gap + 6;
      S.labMode = { x: w / 2, y: y + 14 * f }; y += 32 * f;
      S.modes = [rect(x0, y, (cw - 12) / 2, bh + 10), rect(x0 + (cw - 12) / 2 + 12, y, (cw - 12) / 2, bh + 10)]; y += bh + 10 + gap + 6;
      S.labLevel = { x: w / 2, y: y + 14 * f }; y += 32 * f;
      S.levels = [1, 2, 3, 4].map((v, i) => ({ v, r: rect(x0 + (i % 2) * ((cw - 12) / 2 + 12), y + ((i / 2) | 0) * (bh + 10), (cw - 12) / 2, bh) })); y += 2 * (bh + 10) + gap;
      S.blurb = rect(x0, y, cw, Math.round(64 * f)); y += Math.round(64 * f) + gap;
      S.start = rect(x0, Math.min(y, bottom - Math.round(84 * f)), cw, Math.round(84 * f));
    }
    S.back = L.back;
  }

  // ---- settings
  {
    const ST = L.settings = { back: L.back }, rows = 5;
    if (land) {
      const top = Math.max(U.y0 + 8, 10);
      ST.title = { x: w / 2, y: top + 32 };
      const rw = Math.min(680, U.w - 48), y0 = top + 76, avail = h - y0 - bottomPad, bh = Math.round(clamp((avail - (rows - 1) * 10) / rows, 52, 92));
      ST.row = (i) => rect(w / 2 - rw / 2, y0 + i * (bh + 10), rw, bh);
    } else {
      const wall = L.wallPlay;
      ST.title = { x: w / 2, y: Math.max(U.y0 + 70, Math.round(wall * 0.5)) };
      const y0 = wall + 140, avail = h - y0 - bottomPad - 10, pitch = Math.min(155, avail / rows), bh = Math.round(Math.min(104, pitch - 14));
      const rw = Math.min(600, X1 - X0 - 20);
      ST.row = (i) => rect(w / 2 - rw / 2, y0 + i * pitch, rw, bh);
    }
  }

  // ---- reference pages (About / Rules): header row (title + A- A+), a scrolling panel, page line, Back / Next
  {
    const RF = L.ref = {};
    const top = Math.max(U.y0 + 8, 12), cw = land ? Math.min(U.w - 40, 1000) : X1 - X0, cx = land ? (U.x0 + U.x1) / 2 : w / 2;
    const x0 = cx - cw / 2, x1 = cx + cw / 2;
    const navH = 84, navY = h - bottomPad - navH, bw = Math.min(330, (cw - 14) / 2);
    RF.back = rect(cx - bw - 7, navY, bw, navH); RF.next = rect(cx + 7, navY, bw, navH);
    RF.pageLine = { x: cx, y: navY - 16 };
    const hdrH = 80;
    const titleX = (L.ins.back && top < L.backBox.y + L.backBox.h) ? Math.max(x0 + 8, L.backBox.x + L.backBox.w + 6) : x0 + 8;
    RF.title = { x: titleX, y: top + hdrH / 2 };
    RF.dec = rect(x1 - 8 - 84 * 2 - 8, top + 2, 84, hdrH - 4); RF.inc = rect(x1 - 8 - 84, top + 2, 84, hdrH - 4);
    RF.panel = rect(x0, top + hdrH + 8, cw, navY - 30 - (top + hdrH + 8));
    RF.body = rect(RF.panel.x + 30, RF.panel.y + 22, RF.panel.w - 60 - 14, RF.panel.h - 44);
    RF.scrollbar = rect(RF.panel.x + RF.panel.w - 30, RF.body.y, 10, RF.body.h);
  }
  L.demo = { panel: rect(w / 2 - Math.min(w - 40, 560) / 2, h / 2 - 190, Math.min(w - 40, 560), 340) };
}
