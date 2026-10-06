// All screen-space geometry lives here, as a pure function of the LIVE screen size (kit 1.7 fluid viewport: the short side is
// always 720 units, the long side follows the aspect ratio). `layoutFor(w, h, auto)` returns every rect for that size and is cached.
//
// Play shapes (cards are as big as the screen allows; big cards are the point of this game):
//   tall     portrait phone: the approved look (foundations top, columns, stock/waste + buttons at the bottom under the thumb).
//   compact  portrait, shorter than a phone (tablets, small phones): same as tall, or (if it gives bigger cards) the classic
//            top row  stock | waste | foundations  with a button bar under the columns.
//   wide     landscape: columns on the left, a panel on the right (foundations 2x2, stock + waste, buttons).
// Sheet screens (title, options, won ...) are authored as "design blocks" and fitted/centred into the screen: a portrait
// design and a wide design, picked by the screen shape. Their rects are given both in design space (for drawing inside a
// transformed context) and in screen space (for taps).

export const CARD_W = 136;
export const CARD_H = 192;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;

// "More from Arcforge" cross-promo on the won screen and Auto Play's ended screen. Deliberately paid games only.
export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'carrom-striker-and-queen', title: 'Carrom' },
  { slug: 'scopa-delle-regioni', title: 'Scopa' },
];

// Safe areas + the host's floating back button, in virtual units (main.js keeps this current; browsers: zeros).
// px = css pixels per virtual unit (text never below ~11 css px, taps about 44 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export const contains = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Fit a design box into a screen region (uniform scale, centred). Returns the transform + a rect mapper.
function fit(box, reg, maxS = 1.2) {
  const s = Math.min(maxS, reg.w / box.w, reg.h / box.h);
  const ox = reg.x + (reg.w - box.w * s) / 2 - box.x * s;
  const oy = reg.y + (reg.h - box.h * s) / 2 - box.y * s;
  return { s, ox, oy, r: (d) => R(ox + d.x * s, oy + d.y * s, d.w * s, d.h * s) };
}
function mapAll(blk, d) {
  const out = {};
  for (const [k, v] of Object.entries(d)) out[k] = Array.isArray(v) ? v.map(blk.r) : blk.r(v);
  return out;
}

const cache = new Map();
export function layoutFor(w, h, auto = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${auto ? 1 : 0}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, auto); L.key = key; cache.set(key, L); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins, auto) {
  const land = w >= h;
  const L = { w, h, land, auto, ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const px = ins.px || 0.6;
  const Bh = clamp(44 / px, 56, 92);                    // a ~44 css px tall button
  const hasBack = ins.back > 0;
  const backBot = hasBack ? L.backBox.y + L.backBox.h + 6 : 0;
  const backRight = hasBack ? L.backBox.x + L.backBox.w + 6 : 0;
  L.Bh = Bh;
  L.wide = land && U.w >= U.h * 1.15;                   // squarish windows are laid out like portrait ones

  const c = { w, h, U, ins, Bh, hasBack, backBot, backRight, px, auto };
  playLayout(L, c);
  titleLayout(L, c);
  optionsLayout(L, c);
  dialogLayouts(L, c);
  rulesLayout(L, c);
  return L;
}

// ---------------------------------------------------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------------------------------------------------
function playLayout(L, c) {
  const { h, U, ins, Bh, hasBack, backBot, backRight, auto } = c;
  const barH = clamp(50 / c.px, 64, 96);
  const botLift = Math.max(0, ins.b - 16);
  let k, mode, topY, tabTop, tabBottom, sp, tabX0, stockPos, wastePos, found, bar = null;
  const btn = {};
  let tabAreaX0 = U.x0, tabAreaX1 = U.x1;

  if (L.wide) {
    mode = 'wide';
    const pad = 12, reserve = hasBack ? L.backBox.w + 6 : 0;
    const kP = (U.h - 2 * pad - 2 * Bh - 8) / 3.24 / CARD_H;
    const kT = (U.h - 2 * pad - (auto ? Bh + 8 : 0)) / 3.7 / CARD_H;
    const kW = (U.w - reserve - 34) / (9.2 * CARD_W);   // 7 tableau columns at ~1 card pitch + the 2-wide foundation panel: columns never overlap sideways
    k = clamp(Math.min(kP, kT, kW), 0.4, 1.4);
    const cw = CARD_W * k, ch = CARD_H * k, g = Math.max(8, 0.06 * ch), gx = Math.max(10, 0.08 * cw), Pw = 2 * cw + gx;
    const avail = U.w - reserve - 16 - 18 - Pw;
    sp = Math.min(1.25 * cw, (avail - cw) / 6);
    const tabW = cw + 6 * sp, extra = Math.max(0, avail - tabW);
    const xs = U.x0 + reserve + 8 + extra / 2;
    tabX0 = xs;
    const panelX = xs + tabW + 18, y0p = U.y0 + pad;
    found = (i) => ({ x: panelX + (i % 2) * (cw + gx), y: y0p + (i >> 1) * (ch + g) });
    wastePos = { x: panelX, y: y0p + 2 * (ch + g) };
    stockPos = { x: panelX + cw + gx, y: y0p + 2 * (ch + g) };
    tabTop = y0p + (auto ? Bh + 8 : 0);
    tabBottom = U.y1 - pad;
    topY = y0p;
    const b2 = U.y1 - pad - Bh, b1 = b2 - 8 - Bh;
    btn.hint = R(panelX, b1, Pw, Bh);
    btn.options = R(panelX, b2, Pw, Bh);
    btn.autoSkip = R(panelX, b1, Pw, Bh);
    btn.autoPause = R(panelX, b2, (Pw - 8) / 2, Bh);
    btn.autoExit = R(panelX + (Pw - 8) / 2 + 8, b2, (Pw - 8) / 2, Bh);
    if (auto) bar = R(xs, y0p, tabW, Bh);
    tabAreaX0 = xs - 6; tabAreaX1 = xs + tabW + 6;
    L.controlTop = U.y1;
    L.dialogRegion = R(xs, U.y0 + pad, tabW, U.h - 2 * pad);
  } else {
    const topBase = Math.max(U.y0 + 14, backBot);
    const kWA = (U.w - 8) / (5.24 * CARD_W);
    const topA0 = h >= 1500 ? Math.max(104, U.y0 + 96, backBot) : topBase;
    const topA = Math.max(topA0, auto ? U.y0 + 10 + barH + 12 : 0);
    const kA = Math.min(1, kWA, (h - topA - 80 - botLift) / 5.7 / CARD_H);
    const topB = Math.max(topBase, auto ? U.y0 + 10 + barH + 12 : 0);
    const kB = Math.min(1, (U.w - 16) / 6.3 / CARD_W, (h - topB - Bh - 36 - botLift) / 4.82 / CARD_H);
    const useA = kA >= 0.96 || kA >= kB;
    k = Math.max(0.4, useA ? kA : kB);
    const cw = CARD_W * k, ch = CARD_H * k;
    mode = h >= 1500 && useA ? 'tall' : 'compact';
    if (useA) {
      topY = topA;
      const bottomY = h - botLift - 28 * Math.max(k, 0.7) - ch;
      const fg = 20 * k, fx0 = U.x0 + (U.w - (4 * cw + 3 * fg)) / 2;
      found = (i) => ({ x: fx0 + i * (cw + fg), y: topY });
      tabTop = topY + ch + 30 * k;
      tabBottom = bottomY - 22 * k;
      sp = Math.min(1.1 * cw, (U.w - 8 - cw) / 6);
      tabX0 = U.x0 + 4 + (U.w - 8 - (cw + 6 * sp)) / 2;
      stockPos = { x: U.x1 - 8 - cw, y: bottomY };
      wastePos = { x: stockPos.x - cw - 24 * k, y: bottomY };
      const hintH = 0.5 * ch, optY = bottomY + 0.55 * ch, optH = 0.45 * ch;
      const hx = U.x0 + 20, hw = Math.max(120, Math.min(388, wastePos.x - 14 - hx));
      btn.hint = R(hx, bottomY, hw, hintH);
      btn.options = R(hx, optY, hw, optH);
      btn.autoSkip = btn.hint;
      btn.autoPause = R(hx, optY, (hw - 8) / 2, optH);
      btn.autoExit = R(hx + (hw - 8) / 2 + 8, optY, (hw - 8) / 2, optH);
      L.controlTop = bottomY - 10;
    } else {
      topY = topB;
      const avail = U.w - 16, g = Math.max(4, (avail - 6 * cw) / 6);
      const sx = (i) => U.x0 + 8 + i * (cw + g) + (i >= 2 ? g : 0);
      stockPos = { x: sx(0), y: topY }; wastePos = { x: sx(1), y: topY };
      found = (i) => ({ x: sx(2 + i), y: topY });
      tabTop = topY + ch + Math.max(12, 0.12 * ch);
      const barY = h - botLift - 14 - Bh;
      tabBottom = barY - 12;
      sp = Math.min(1.1 * cw, (U.w - 16 - cw) / 6);
      tabX0 = U.x0 + 8 + (U.w - 16 - (cw + 6 * sp)) / 2;
      const bw = U.w - 24, hx = U.x0 + 12;
      btn.hint = R(hx, barY, bw * 0.6 - 4, Bh);
      btn.options = R(hx + bw * 0.6 + 4, barY, bw * 0.4 - 4, Bh);
      btn.autoSkip = R(hx, barY, bw * 0.44 - 4, Bh);
      btn.autoPause = R(hx + bw * 0.44 + 4, barY, bw * 0.28 - 8, Bh);
      btn.autoExit = R(hx + bw * 0.72 + 4, barY, bw * 0.28 - 4, Bh);
      L.controlTop = barY - 8;
    }
    if (auto) {
      const bx = hasBack ? backRight : U.x0 + 12;
      bar = R(bx, U.y0 + 10, U.x1 - 12 - bx, barH);
    }
    L.dialogRegion = R(U.x0, topY, U.w, Math.max(200, L.controlTop - topY));
  }

  const cw = CARD_W * k, ch = CARD_H * k;
  const SU = 0.3229 * ch, SD = 0.2083 * ch;
  L.k = k; L.cw = cw; L.ch = ch; L.mode = mode; L.topY = topY;
  L.tableauTopY = tabTop; L.tableauBottom = tabBottom;
  L.stockPos = stockPos; L.wastePos = wastePos;
  L.foundationPos = found;
  L.tableauX = (col) => tabX0 + col * sp;
  L.tabSpacing = sp;
  const availH = tabBottom - tabTop - ch;
  L.columnYs = (column) => {
    let total = 0;
    for (let i = 0; i < column.length - 1; i++) total += column[i].faceUp ? SU : SD;
    const sq = total > availH ? Math.max(0.05, availH) / total : 1;
    const ys = [];
    let y = tabTop;
    for (let i = 0; i < column.length; i++) { ys.push(y); y += (column[i].faceUp ? SU : SD) * sq; }
    return ys;
  };
  L.hitCard = (x, y, cx, cy) => x >= cx && x <= cx + cw && y >= cy && y <= cy + ch;
  if (bar) {
    const sq = bar.h - 6;
    btn.autoBar = bar;
    btn.autoInc = R(bar.x + bar.w - sq - 6, bar.y + 3, sq, sq);
    btn.autoDec = R(btn.autoInc.x - sq - 8, bar.y + 3, sq, sq);
  }
  L.btn = btn;
  const ex0 = L.wide ? tabAreaX0 : U.x0, ex1 = L.wide ? tabAreaX1 : U.x1;
  L.emblem = { cx: (ex0 + ex1) / 2, cy: (tabTop + tabBottom) / 2, k: clamp(Math.min((ex1 - ex0) / 340, (tabBottom - tabTop) / 340), 0.3, 1) };
  L.msg = { x: (ex0 + ex1) / 2, y: tabBottom - 8 };
}

// ---------------------------------------------------------------------------------------------------------------------
// Title: portrait = one stacked block, wide = art block (left) + menu block (right). Design space = the approved 720-wide look.
// ---------------------------------------------------------------------------------------------------------------------
export const HERO_D = { x: 20, y: 340, w: 680, h: 460 };
function menuRects(dy, lw = 242) {
  const lh = Math.round(lw * 327 / 1200);
  return {
    lock: R(360 - lw / 2, dy + 438, lw, lh),
    lockH: lh,
    deal: R(110, dy, 500, 132),
    plateY: dy + 186,
    row: [R(140, dy + 316, 136, 96), R(292, dy + 316, 136, 96), R(444, dy + 316, 136, 96)],
    demoY: dy + 438 + lh + 56,
  };
}
function titleLayout(L, c) {
  const { U } = c;
  let t;
  if (L.wide) {
    const top = Math.max(U.y0 + 10, c.backBot);
    const halfW = U.w / 2;
    const left = fit({ x: 0, y: 120, w: 720, h: 700 }, R(U.x0 + 8, top, halfW - 16, U.y1 - top - 10), 1.15);
    const right = fit({ x: 0, y: 0, w: 720, h: 690 }, R(U.x0 + halfW + 8, U.y0 + 10, halfW - 16, U.h - 20), 1.15);
    t = { wide: true, left, right, dyR: 0 };
  } else {
    const top = Math.max(U.y0 + 8, c.backBot);
    const blk = fit({ x: 0, y: 118, w: 720, h: 1380 }, R(U.x0, top, U.w, U.y1 - top - 6), 1.15);
    t = { wide: false, left: blk, right: blk, dyR: 860 };
  }
  const lkw = clamp(125 / (c.px * t.right.s), 242, 640);     // the Arcforge lockup: >= ~125 css px wide whatever the block scale is
  t.d = menuRects(t.dyR, lkw);
  { const q = t.right.r(t.d.lock), m = 44 / c.px, tw = Math.max(q.w + 24, m), th = Math.max(q.h + 12, m);
    t.lockTap = R(q.x + q.w / 2 - tw / 2, q.y - 4, tw, Math.max(th, q.h + 8)); }
  t.r = { deal: t.right.r(t.d.deal), options: t.right.r(t.d.row[0]), rules: t.right.r(t.d.row[1]), auto: t.right.r(t.d.row[2]), hero: t.left.r(HERO_D) };
  L.title = t;
}

// ---------------------------------------------------------------------------------------------------------------------
// Options sheet. Portrait design = the approved sheet; wide design = two columns.
// ---------------------------------------------------------------------------------------------------------------------
function optionsLayout(L, c) {
  const { U } = c;
  let blk, d;
  if (L.wide) {
    blk = fit({ x: 0, y: 0, w: 1240, h: 704 }, R(U.x0 + 6, U.y0 + 6, U.w - 12, U.h - 12), 1.2);
    d = {
      sheet: R(0, 0, 1240, 700),
      table: Array.from({ length: 10 }, (_, i) => R(40 + (i % 5) * 116, 146 + Math.floor(i / 5) * 80, 108, 72)),
      theme: Array.from({ length: 8 }, (_, i) => R(700 + (i % 4) * 126, 160 + Math.floor(i / 4) * 190, 114, 140)),
      suits2: R(40, 364, 300, 76), suits4: R(360, 364, 300, 76),
      motionOn: R(40, 494, 300, 76), motionOff: R(360, 494, 300, 76),
      done: R(840, 596, 360, 88), newDeal: R(700, 596, 160, 88), menu: R(870, 596, 160, 88), doneAfterHand: R(1040, 596, 160, 88),
    };
    d.meta = { title: { x: 40, y: 86, align: 'left', size: 58 }, lblTable: { x: 40, y: 130 }, lblTheme: { x: 700, y: 130 }, lblSuits: { x: 40, y: 346 }, lblMotion: { x: 40, y: 476 }, themeTitleDy: 30 };
  } else {
    blk = fit({ x: 0, y: 96, w: 720, h: 1412 }, R(U.x0, U.y0 + 4, U.w, U.h - 8), 1.15);
    d = {
      sheet: R(20, 104, 680, 1390),
      table: Array.from({ length: 10 }, (_, i) => R(44 + (i % 5) * 128, 262 + Math.floor(i / 5) * 100, 120, 88)),
      theme: Array.from({ length: 8 }, (_, i) => R(44 + (i % 4) * 161, 540 + Math.floor(i / 4) * 196, 149, 148)),
      suits2: R(44, 1000, 308, 92), suits4: R(368, 1000, 308, 92),
      motionOn: R(44, 1180, 308, 92), motionOff: R(368, 1180, 308, 92),
      done: R(140, 1340, 440, 110), newDeal: R(20, 1340, 215, 110), menu: R(245, 1340, 230, 110), doneAfterHand: R(485, 1340, 215, 110),
    };
    d.meta = { title: { x: 360, y: 190, align: 'center', size: 64 }, lblTable: { x: 46, y: 246 }, lblTheme: { x: 46, y: 524 }, lblSuits: { x: 46, y: 984 }, lblMotion: { x: 46, y: 1164 }, themeTitleDy: 32 };
  }
  const meta = d.meta; delete d.meta;
  L.opt = { blk, d, meta, r: mapAll(blk, d) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Dialogs: won, Auto Play ended, free-preview end.
// ---------------------------------------------------------------------------------------------------------------------
function dialogLayouts(L, c) {
  const { U } = c;
  const whole = R(U.x0 + 6, U.y0 + 6, U.w - 12, U.h - 12);
  {
    let blk, d;
    if (L.wide) {
      blk = fit({ x: 0, y: 0, w: 1120, h: 470 }, whole, 1.2);
      d = {
        wide: true, sheet: R(0, 0, 1120, 470), cx: 280, pipY: 78, titleY: 196, line1Y: 250, line2Y: 296,
        deal: R(60, 340, 440, 100), lblX: 850, lblY: 100,
        chips: SIBLINGS.map((_, i) => R(590 + (i % 2) * 260, 130 + Math.floor(i / 2) * 110, 240, 92)),
      };
    } else {
      blk = fit({ x: 0, y: 540, w: 720, h: 800 }, whole, 1.15);
      d = {
        wide: false, sheet: R(50, 560, 620, 520), cx: 360, pipY: 640, titleY: 760, line1Y: 816, line2Y: 862,
        deal: R(130, 900, 460, 116), lblX: 360, lblY: 1108,
        chips: SIBLINGS.map((_, i) => R(40 + (i % 2) * 340, 1120 + Math.floor(i / 2) * 108, 320, 92)),
      };
    }
    L.won = { blk, d, deal: blk.r(d.deal), chips: d.chips.map(blk.r) };
  }
  {
    // Auto Play ended: sits over the columns / above the control bar so Play again + Exit stay reachable
    const reg = L.dialogRegion;
    let blk, d;
    if (L.wide) {
      blk = fit({ x: 0, y: 0, w: 1010, h: 360 }, reg, 1.1);
      d = {
        wide: true, sheet: R(0, 0, 1010, 360), cx: 270, titleY: 96, textY: 150, labelX: 770, labelY: 80,
        chips: SIBLINGS.map((_, i) => R(550 + (i % 2) * 226, 104 + Math.floor(i / 2) * 100, 210, 84)),
      };
    } else {
      blk = fit({ x: 0, y: 600, w: 720, h: 690 }, reg, 1.1);
      d = {
        wide: false, sheet: R(50, 620, 620, 360), cx: 360, titleY: 720, textY: 780, labelX: 360, labelY: 1020,
        chips: SIBLINGS.map((_, i) => R(40 + (i % 2) * 340, 1050 + Math.floor(i / 2) * 125, 320, 100)),
      };
    }
    L.ended = { blk, d, chips: d.chips.map(blk.r) };
  }
  L.demo = { blk: fit({ x: 0, y: 500, w: 720, h: 480 }, whole, 1.15), d: { sheet: R(50, 520, 620, 440) } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Rules reference: a scrolling reader panel. Direct screen coordinates (text is sized in units, scaled by the stepper).
// ---------------------------------------------------------------------------------------------------------------------
function rulesLayout(L, c) {
  const { U, hasBack, backRight, backBot, Bh } = c;
  const rl = {};
  if (L.wide) {
    const reserve = hasBack ? L.backBox.w + 6 : 0;
    const Sw = clamp(U.w * 0.22, 220, 320), pad = 12;
    const px0 = U.x0 + reserve + 8;
    rl.panel = R(px0, U.y0 + pad, U.w - reserve - 8 - Sw - 12 - 16, U.h - 2 * pad);
    const cx0 = rl.panel.x + rl.panel.w + 12, cw = Sw;
    rl.titleX = cx0 + cw / 2; rl.titleY = U.y0 + pad + 54; rl.titleSize = 54;
    const hw = (cw - 8) / 2;
    rl.textDec = R(cx0, U.y0 + pad + 76, hw, Bh); rl.textInc = R(cx0 + hw + 8, U.y0 + pad + 76, hw, Bh);
    rl.next = R(cx0, U.y1 - pad - Bh, cw, Bh);
    rl.back = R(cx0, rl.next.y - 10 - Bh, cw, Bh);
    rl.pageX = cx0 + cw / 2; rl.pageY = rl.back.y - 14;
  } else {
    const hy = Math.max(U.y0 + 10, 10), hh = Math.max(Bh, hasBack ? backBot - hy : 0);
    const bw = clamp(Bh * 1.7, 100, 150);
    rl.textInc = R(U.x1 - 12 - bw, hy + (hh - Bh) / 2, bw, Bh);
    rl.textDec = R(rl.textInc.x - 8 - bw, rl.textInc.y, bw, Bh);
    const x0f = hasBack ? backRight : 12;
    rl.titleX = clamp(U.x0 + U.w / 2, x0f + 90, rl.textDec.x - 90); rl.titleY = hy + hh / 2 + 18; rl.titleSize = 52;
    const Bf = clamp(Bh * 1.3, 64, 116);
    rl.next = R(U.x0 + 20 + (U.w - 50) / 2 + 10, U.y1 - 14 - Bf, (U.w - 50) / 2, Bf);
    rl.back = R(U.x0 + 20, rl.next.y, (U.w - 50) / 2, Bf);
    rl.pageX = U.x0 + U.w / 2; rl.pageY = rl.back.y - 14;
    rl.panel = R(U.x0 + 16, hy + hh + 8, U.w - 32, rl.pageY - 30 - (hy + hh + 8));
  }
  rl.inner = R(rl.panel.x + 20, rl.panel.y + 14, rl.panel.w - 40, rl.panel.h - 28);
  L.rules = rl;
}

// ---------------------------------------------------------------------------------------------------------------------
// Taps on the board
// ---------------------------------------------------------------------------------------------------------------------
export function hitTest(L, board, x, y) {
  if (L.hitCard(x, y, L.stockPos.x, L.stockPos.y)) return { pile: 'stock' };
  if (board.waste.length > 0 && L.hitCard(x, y, L.wastePos.x, L.wastePos.y)) return { pile: 'waste' };
  for (let i = 0; i < 4; i++) {
    const pos = L.foundationPos(i);
    if (L.hitCard(x, y, pos.x, pos.y)) return { pile: 'foundation', index: i };
  }
  if (y < L.tableauTopY || y > L.tableauBottom + 10) return null;
  // Columns overlap sideways and the right-hand one is drawn on top, so look right-to-left.
  // First pass: the tap must be on a card. Second pass: forgiving, anywhere under a column.
  for (const strict of [true, false]) {
    for (let col = 6; col >= 0; col--) {
      const column = board.tableau[col];
      const cx = L.tableauX(col);
      if (x < cx || x > cx + L.cw) continue;
      if (column.length === 0) {
        if (!strict || y <= L.tableauTopY + L.ch) return { pile: 'tableau', col, index: -1 };
        continue;
      }
      const ys = L.columnYs(column);
      if (strict && y > ys[ys.length - 1] + L.ch) continue;
      let hitIndex = -1;
      for (let i = 0; i < ys.length; i++) if (y >= ys[i]) hitIndex = i;
      if (hitIndex >= 0) return { pile: 'tableau', col, index: hitIndex };
    }
  }
  return null;
}
