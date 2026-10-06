// Geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side follows the
// aspect). `layoutFor(w, h)` returns every rectangle for that size and is cached, so a frame never recomputes it. `use(w, h)` makes one
// layout the current one and refreshes the live `BTN` / `REF` objects, so game.js and view.js read plain rectangles.
//
// Three shapes:
//   tall     portrait phone (h >= 1500): the approved phone look, unchanged (everything shifted down by (h - 1560) / 2).
//   compact  portrait but shorter (tablets, small phones) and squarish windows: header, board, message, button bar stacked to fit.
//   wide     landscape: a card on the left (status + message), the board in the middle, a card on the right (buttons).
//
// The board is ONE group drawn in "group space" (x 8..712, y from FRAME.y) and placed with a uniform scale k: screen = o + group * k.
// Two group shapes share the pit/seed code: 'tall' (rows 138 apart, the approved phone board) and 'flat' (rows 108 apart, 714 high).
import { colOf, rowIsFront } from './rules.js';

export const PIT_R = 34, PITCH = 78, CX = 360;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AP_THINK_STEPS = [2, 5, 8, 10];
export const GEOMS = {
  tall: { name: 'tall', FRAME: { x: 8, y: 330, w: 704, h: 850 }, ROW_Y: { nBack: 548, nFront: 686, sFront: 824, sBack: 962 }, TRAY: { n: { x: 60, y: 372, w: 600, h: 76 }, s: { x: 60, y: 1062, w: 600, h: 76 } } },
  flat: { name: 'flat', FRAME: { x: 8, y: 330, w: 704, h: 714 }, ROW_Y: { nBack: 528, nFront: 636, sFront: 744, sBack: 852 }, TRAY: { n: { x: 60, y: 372, w: 600, h: 76 }, s: { x: 60, y: 926, w: 600, h: 76 } } },
};
// Host safe areas (notch, home indicator) and the floating back button, in virtual units. main.js keeps this current (browsers: all zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const bigMenu = (scale) => scale >= 1.5;

// ---- live state --------------------------------------------------------------------------------------------------------
let G = GEOMS.tall, L = null;
export const BTN = {};
export const REF = { x: 36, y: 120, w: 648, h: 1300, bottom: 1270 };
export const geom = () => G;
export const cur = () => L;
export function withGeom(name, fn) { const g = G; G = GEOMS[name]; try { return fn(); } finally { G = g; } }

// ---- the board group ---------------------------------------------------------------------------------------------------
export function pitLocal(p, r, g = G) {
  const c = colOf(r), front = rowIsFront(r), Y = g.ROW_Y;
  if (p === 0) return { x: CX + (c - 3.5) * PITCH, y: front ? Y.sFront : Y.sBack };
  return { x: CX + (3.5 - c) * PITCH, y: front ? Y.nFront : Y.nBack };
}
export const trayLocal = (p) => { const T = p === 0 ? G.TRAY.s : G.TRAY.n; return { x: 360, y: T.y + T.h / 2 }; };
export const toScreen = (x, y) => ({ x: L.grp.ox + x * L.grp.k, y: L.grp.oy + y * L.grp.k });
export const toLocal = (x, y) => ({ x: (x - L.grp.ox) / L.grp.k, y: (y - L.grp.oy) / L.grp.k });
export const pitPos = (p, r) => { const q = pitLocal(p, r); return toScreen(q.x, q.y); };   // SCREEN position (taps, tests)
export const trayPos = trayLocal;
// nearest pit of player p to a SCREEN tap (generous), or -1
export function pitNear(p, x, y) {
  const t = toLocal(x, y);
  let best = -1, bd = 1e9;
  for (let r = 0; r < 16; r++) {
    const q = pitLocal(p, r), dx = Math.abs(t.x - q.x), dy = Math.abs(t.y - q.y);
    if (dx > PITCH / 2 + 2 || dy > 66) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

// ---- layout ------------------------------------------------------------------------------------------------------------
const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let l = cache.get(key);
  if (!l) { l = build(w, h, { ...host }); l.key = key; cache.set(key, l); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return l;
}
export function use(w, h) {
  const l = layoutFor(w, h);
  if (l !== L) {
    L = l; G = GEOMS[l.geom];
    for (const k of Object.keys(BTN)) delete BTN[k];
    Object.assign(BTN, l.BTN);
    Object.assign(REF, l.REF);
  }
  return L;
}

// distribute `n` items of ideal height `h0` with gap `g` into [top, bottom]; returns { h, g, ys }
function fitStack(n, h0, g, top, bottom, minH = 52) {
  const avail = bottom - top;
  let h = h0;
  if (n * h + (n - 1) * g > avail) h = Math.max(minH, Math.floor((avail - (n - 1) * g) / n));
  const total = n * h + (n - 1) * g, y0 = top + Math.max(0, (avail - total) / 2);
  return { h, g, ys: Array.from({ length: n }, (_, i) => y0 + i * (h + g)), total };
}

function build(w, h, ins) {
  const land = w >= h, wide = land && w >= h * 1.15, tall = !land && h >= 1540;
  const mode = wide ? 'wide' : tall ? 'tall' : 'compact';
  const l = { w, h, land, mode, ins };
  const back = ins.back ? Math.max(ins.back, 56) : 0;
  l.backBox = back ? R(ins.l, ins.t, back + 8, back + 8) : R(0, 0, 0, 0);
  const U = l.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  l.oyT = tall ? (h - 1560) / 2 : 0;
  // the cloth border: top and bottom strips (portrait), left and right strips (landscape). Content stays clear of it.
  l.border = tall ? { side: 'tb', t: 92 } : wide ? { side: 'lr', t: 34 } : { side: 'tb', t: 34 };
  const bt = l.border.side === 'tb' ? l.border.t : 0, bl = l.border.side === 'lr' ? l.border.t : 0;
  l.C = { x0: Math.max(U.x0, bl) + 6, x1: Math.min(U.x1, w - bl) - 6, y0: Math.max(U.y0, bt) + 6, y1: Math.min(U.y1, h - bt) - 6 };   // content box
  l.C.w = l.C.x1 - l.C.x0; l.C.h = l.C.y1 - l.C.y0;
  l.BTN = {}; l.grp = { k: 1, ox: 0, oy: 0 }; l.geom = 'tall';
  playLayout(l);
  l.docs = docLayout(l);
  l.REF = l.docs.panel;
  Object.assign(l.BTN, l.docs.btn);
  l.over = overLayout(l);
  Object.assign(l.BTN, l.over.btn); l.BTN.demoMenu = l.over.demoBtn;
  l.title = (hasSave, scale) => clearBack(titleLayout(l, hasSave, scale), l);
  l.settings = (scale) => settingsLayout(l, scale);
  return l;
}

// ---- play, lessons, Watch & Learn ---------------------------------------------------------------------------------------
// l.play: { status: { panel, l1, l2, l3 }, msg, prompt, apLabel, dev }.  A "line" is { x, y, maxW, maxH, size }: wrapped/fitted by the view.
function line(x, y, maxW, size, maxH = size * 1.3) { return { x, y, maxW, maxH, size }; }
function playLayout(l) {
  const { w, h, C } = l, B = l.BTN, P = l.play = {};
  if (l.mode === 'tall') {
    const oy = l.oyT, ap = (x) => R(x, 1346 + oy, 148, 84);
    l.geom = 'tall'; l.grp = { k: 1, ox: 0, oy };
    Object.assign(B, {
      menu: R(40, 1346 + oy, 190, 84), undo: R(265, 1346 + oy, 190, 84), hint: R(490, 1346 + oy, 190, 84), next: R(290, 1346 + oy, 390, 84),
      pick1: R(40, 1262 + oy, 300, 68), pick2: R(380, 1262 + oy, 300, 68), pickCancel: R(570, 1202 + oy, 110, 44),
      apExit: ap(40), apPause: ap(204), apDec: ap(368), apInc: ap(532),
    });
    P.status = { panel: R(50, 112 + oy, 620, 186), l1: line(360, 176 + oy, 640, 60), l2: line(360, 220 + oy, 640, 24), l3: line(360, 262 + oy, 640, 26) };
    P.msg = R(30, 1196 + oy, 660, 134); P.prompt = R(30, 1196 + oy, 660, 142);
    P.promptText = (dir) => ({ x: dir ? 300 : 360, y: 1226 + oy, w: dir ? 520 : 610, h: 52, top: true });
    P.apLabel = { x: 360, y: 1452 + oy, size: 22 }; P.dev = { x: 662, y: 134 + oy };
    P.promptInBar = false;
    return;
  }
  if (l.mode === 'compact') {
    const cw = Math.min(680, C.w), x0 = (w - cw) / 2, top = C.y0, sh = 112;
    P.status = { panel: R(x0, top, cw, sh), l1: line(w / 2, top + 46, cw - 40, 44), l2: line(w / 2, top + 76, cw - 40, 22, 24), l3: line(w / 2, top + 102, cw - 40, 24, 26) };
    P.dev = { x: x0 + cw - 12, y: top + 24 };
    const barH = 72, barY = C.y1 - barH, avail0 = barY - 8 - (top + sh + 8);
    const msgMin = 104, plan = (g) => Math.min(1, (cw + 24) / GEOMS[g].FRAME.w, (avail0 - msgMin - 8) / GEOMS[g].FRAME.h);
    const kt = plan('tall'), kf = plan('flat'), gname = kt >= kf * 0.9 ? 'tall' : 'flat', k = Math.max(0.3, gname === 'tall' ? kt : kf), F = GEOMS[gname].FRAME;
    l.geom = gname;
    const bh = F.h * k, slack = Math.max(0, avail0 - bh - msgMin - 8), msgH = Math.min(170, msgMin + slack * 0.6), extra = Math.max(0, avail0 - bh - msgH - 8);
    const top2 = top + sh + 8 + extra * 0.4;
    l.grp = { k, ox: w / 2 - 360 * k, oy: top2 - F.y * k };
    P.msg = R(x0, top2 + bh + 8, cw, msgH); P.prompt = P.msg; P.promptInBar = true;
    P.promptText = () => ({ x: w / 2, y: P.msg.y + 12, w: cw - 36, h: msgH - 20, top: false });
    const sl = (weights, gap = 10) => { const tot = weights.reduce((a, b) => a + b, 0), net = cw - gap * (weights.length - 1); let x = x0; return weights.map((q) => { const r = R(x, barY, net * q / tot, barH); x += r.w + gap; return r; }); };
    const [m, u, hi] = sl([1, 1, 1]), [m4, p1, p2, pc] = sl([0.8, 1.2, 1.2, 0.8]), [e, ps, dc, lb, ic] = sl([0.9, 1.1, 0.6, 1.2, 0.6]);
    Object.assign(B, { menu: m, undo: u, hint: hi, next: R(x0 + cw * 0.34, barY, cw * 0.66, barH), pick1: p1, pick2: p2, pickCancel: pc, apExit: e, apPause: ps, apDec: dc, apInc: ic });
    B.menuPrompt = m4;
    P.apLabel = { x: lb.x + lb.w / 2, y: barY + barH / 2 + 8, size: 22, w: lb.w };
    return;
  }
  // ---- wide ----
  // Two arrangements: aspect >= 1.7 (phones, 16:9): a status card left of the board and a button card right of it.
  // Squarer landscape (4:3 tablets): the status card on the left and the buttons in a bar UNDER the board, so the board can be bigger.
  const F = GEOMS.flat.FRAME, gap = 14, cardMin = 210, barMode = w / h < 1.7;
  l.geom = 'flat'; l.barMode = barMode;
  let lc, k, bw;
  if (barMode) {
    const barH = 72, cardMinB = 240;
    k = clamp(Math.min((C.h - barH - 10 - 30) / F.h, (C.w - cardMinB - gap) / F.w), 0.3, 1.45); bw = F.w * k;
    const cardW = Math.min(420, C.w - bw - gap), x0 = C.x0 + (C.w - (cardW + gap + bw)) / 2, bTop = C.y0 + 30 + (C.h - 30 - (F.h * k + 10 + barH)) / 2, cx = x0 + cardW + gap + bw / 2;
    l.grp = { k, ox: cx - 360 * k, oy: bTop - F.y * k };
    lc = R(x0, C.y0, cardW, C.h); l.cards = { left: lc, right: null };
    const barY = bTop + F.h * k + 10, bx = cx - bw / 2;
    const sl = (weights, g2 = 10) => { const tot = weights.reduce((a, b2) => a + b2, 0), net = bw - g2 * (weights.length - 1); let x = bx; return weights.map((q) => { const r = R(x, barY, net * q / tot, barH); x += r.w + g2; return r; }); };
    const [m, u, hi] = sl([1, 1, 1]), [, p1, p2, pc] = sl([0.8, 1.2, 1.2, 0.8]), [m4] = sl([0.8, 1.2, 1.2, 0.8]), [e, ps, dc, lb, ic] = sl([0.9, 1.1, 0.6, 1.2, 0.6]);
    Object.assign(B, { menu: m, undo: u, hint: hi, next: R(bx + bw * 0.34, barY, bw * 0.66, barH), pick1: p1, pick2: p2, pickCancel: pc, apExit: e, apPause: ps, apDec: dc, apInc: ic });
    B.menuPrompt = m4;
    P.apLabel = { x: lb.x + lb.w / 2, y: barY + barH / 2 + 8, size: 22, w: lb.w };
  } else {
    k = clamp(Math.min((C.h - 34) / F.h, (C.w - 2 * (cardMin + gap)) / F.w), 0.3, 1.45); bw = F.w * k;
    const cx = (C.x0 + C.x1) / 2, cardW = Math.min(420, (C.w - bw) / 2 - gap), bTop = C.y0 + 30 + (C.h - 30 - F.h * k) / 2;
    l.grp = { k, ox: cx - 360 * k, oy: bTop - F.y * k };
    lc = R(cx - bw / 2 - gap - cardW, C.y0, cardW, C.h); const rc = R(cx + bw / 2 + gap, C.y0, cardW, C.h);
    l.cards = { left: lc, right: rc };
    // right card: a vertical stack of 4 slots (+ a label slot for Watch & Learn think time)
    const sw = clamp(rc.w - 28, 120, 340), sx0 = rc.x + (rc.w - sw) / 2, sh = fitStack(5, 84, 14, rc.y + 12, rc.y + rc.h - 12, 56);
    const slot = (i) => R(sx0, sh.ys[i], sw, sh.h);
    Object.assign(B, { menu: slot(0), undo: slot(1), hint: slot(2), next: slot(1), pick1: slot(1), pick2: slot(2), pickCancel: slot(3), apExit: slot(0), apPause: slot(1), apDec: slot(2), apInc: slot(3) });
    B.menuPrompt = slot(0);
    P.apLabel = { x: rc.x + rc.w / 2, y: sh.ys[4] + sh.h / 2 + 8, size: 22, w: sw };
  }
  // left card: status on top (below the back button), message underneath
  const inner = 14, sz = lc.w >= 300 ? 1 : 0.8, bk = l.backBox, st0 = Math.max(lc.y + 10, bk.h && bk.x + bk.w > lc.x ? bk.y + bk.h + 6 : 0);
  const l1h = Math.round(100 * sz), l2h = 96, l3h = 60, sx = lc.x + lc.w / 2, mw = lc.w - inner * 2;
  P.status = { panel: lc, l1: line(sx, st0 + 40 * sz, mw, 38 * sz, l1h - 10), l2: line(sx, st0 + l1h + 22, mw, 22, l2h - 14), l3: line(sx, st0 + l1h + l2h + 24, mw, 24, l3h - 16) };
  P.dev = { x: lc.x + lc.w - 10, y: lc.y + 20 };
  const msgTop = st0 + l1h + l2h + l3h + 10;
  P.msg = R(lc.x + 8, msgTop, lc.w - 16, lc.y + lc.h - 8 - msgTop); P.prompt = P.msg; P.promptInBar = true;
  P.promptText = () => ({ x: P.msg.x + P.msg.w / 2, y: P.msg.y + 14, w: P.msg.w - 28, h: P.msg.h - 24, top: false });
}

// ---- reference pages (About, How to Play, Rules) -------------------------------------------------------------------------
function docLayout(l) {
  const { w, C } = l;
  let P, hy, btnH, sideNav = false;
  if (l.mode === 'tall') { P = R(36, 120 + l.oyT, 648, 1300); hy = P.y + 56; btnH = 80; }
  else if (l.mode === 'compact') { const pw = Math.min(680, C.w); P = R((w - pw) / 2, C.y0, pw, C.h); hy = P.y + 16; btnH = 72; }
  else {
    // wide: when there is room, Back / Next stand beside the panel so the text gets the full height
    const side = C.w >= 520 + 2 * (160 + 16), pw = side ? Math.min(880, C.w - 2 * (160 + 16)) : Math.min(880, C.w);
    P = R((w - pw) / 2, C.y0, pw, C.h); hy = P.y + 14; btnH = 72; sideNav = side;
  }
  const bk = l.backBox, clearTop = bk.h && P.x < bk.x + bk.w + 4 ? bk.y + bk.h + 6 : 0;   // keep the header row off the host back button
  hy = Math.max(hy, clearTop);
  const zw = 96, zh = 58, btn = {};
  btn.textInc = R(P.x + P.w - 24 - zw, hy, zw, zh); btn.textDec = R(btn.textInc.x - 12 - zw, hy, zw, zh);
  let by = P.y + P.h - 18 - btnH, bw = Math.min(250, (P.w - 90) / 2), label;
  if (sideNav) {
    bw = 160; by = P.y + P.h - 18 - btnH;
    btn.pgBack = R(P.x - 16 - bw, by, bw, btnH); btn.pgNext = R(P.x + P.w + 16, by, bw, btnH);
    label = { x: P.x + P.w / 2, y: P.y + P.h - 16, size: 22 };
  } else {
    btn.pgBack = R(P.x + 30, by, bw, btnH); btn.pgNext = R(P.x + P.w - 30 - bw, by, bw, btnH);
    label = { x: P.x + P.w / 2, y: by - 18, size: 22 };
  }
  const body = { x: P.x + 34, w: P.w - 68, top: hy + zh + (l.mode === 'tall' ? 32 : 24), bottom: label.y - (l.mode === 'tall' ? 34 : sideNav ? 24 : 30) };
  const titleL = Math.max(P.x + 24, hy < bk.y + bk.h && bk.h ? bk.x + bk.w + 12 : 0), titleR = btn.textDec.x - 12;
  const title = { x: (titleL + titleR) / 2, y: hy + zh / 2, w: titleR - titleL };
  const out = { panel: { x: P.x, y: P.y, w: P.w, h: P.h, bottom: body.bottom }, body, label, title, btn };
  out.key = `${Math.round(P.w)}x${Math.round(body.bottom - body.top)}`;
  return out;
}

// ---- results, demo-limit: a "block" drawn in design space (the original 720-wide coordinates) and scaled to fit -----------------
// text block: design y 370..940 (title baseline 440, buttons were at 1010/1126). Tall = exactly the original (s = 1, oy = the centring shift).
function overLayout(l) {
  const { w, C } = l, o = { btn: {} };
  if (l.mode === 'tall') {
    o.text = { s: 1, ox: 0, oy: l.oyT }; o.demo = { s: 1, ox: 0, oy: l.oyT };
    o.btn.again = R(130, 1010 + l.oyT, 460, 96); o.btn.back = R(130, 1126 + l.oyT, 460, 96);
    o.more = { x: w / 2, y: Math.min(1290 + l.oyT, l.U.y1 - 70) };
    o.demoBtn = o.btn.back;
    return o;
  }
  const bh = 84, gap = 14;
  if (l.mode === 'compact') {
    const bw = Math.min(460, C.w - 40), rest = 24 + 2 * bh + gap + 50, s = Math.min(1, (C.h - rest) / 570), th = 570 * s, top = C.y0 + Math.max(0, (C.h - th - rest) / 2);
    o.text = { s, ox: w / 2 - 360 * s, oy: top - 370 * s };
    const by = top + th + 24;
    o.btn.again = R(w / 2 - bw / 2, by, bw, bh); o.btn.back = R(w / 2 - bw / 2, by + bh + gap, bw, bh);
    o.more = { x: w / 2, y: by + 2 * bh + gap + 34 };
  } else {
    const lw = C.w * 0.55, bw = Math.min(440, C.w - lw - 40), s = Math.min(1, C.h / 600, (lw - 20) / 720), cxL = C.x0 + lw / 2, midY = C.y0 + C.h / 2;
    o.text = { s, ox: cxL - 360 * s, oy: midY - 655 * s };
    const bx = C.x0 + lw + (C.w - lw) / 2 - bw / 2, by = midY - (2 * bh + gap) / 2;
    o.btn.again = R(bx, by, bw, bh); o.btn.back = R(bx, by + bh + gap, bw, bh);
    o.more = { x: bx + bw / 2, y: by + 2 * bh + gap + 40 };
  }
  // demo-limit: panel (design y 790..1190, 400 tall) with its Menu button underneath
  const bw = Math.min(460, C.w - 40), ds = Math.min(1, (C.h - bh - 30) / 400, (C.w - 20) / 720), dTop = C.y0 + Math.max(0, (C.h - 400 * ds - 30 - bh) / 2);
  o.demo = { s: ds, ox: w / 2 - 360 * ds, oy: dTop - 790 * ds };
  o.demoBtn = R(w / 2 - bw / 2, dTop + 400 * ds + 30, bw, bh);
  return o;
}

// Keep the title/tagline text off the host back button: when it would sit under the button, narrow it to the free width.
function clearBack(T, l) {
  const bk = l.backBox; if (!bk || !bk.h || !T.title) return T;
  for (const t of [T.title, T.tagline]) if (t && t.y - t.size < bk.y + bk.h && t.x - t.maxW / 2 < bk.x + bk.w + 6) t.maxW = Math.max(180, Math.min(t.maxW, 2 * (t.x - (bk.x + bk.w + 6))));
  return T;
}
// Brand lockup size: about 35% of the short side in portrait (28% in landscape), never below ~120 css px wide.
const brandW = (land) => Math.max((land ? 0.28 : 0.35) * 720, 120 / Math.max(host.px, 1e-6));

// ---- title screen -------------------------------------------------------------------------------------------------------
// { rows, panel, title, tagline, board: { s, ox, oy } | null, stats: { y, size, y2, size2 }, msgY, brand: rect, smallSize }
function titleLayout(l, hasSave, scale = 1) {
  const { w, C } = l, big = bigMenu(scale), k = 1 + (scale - 1) * 0.35, ss = Math.min(scale, 1.6);
  const T = { rows: {}, board: null }, rows = T.rows;
  const main = [...(hasSave ? ['resume'] : []), 'learn', 'play', 'two', 'autoplay'], small = ['howto', 'rules', 'about', 'settings'];
  if (l.mode === 'tall') {
    const oy = l.oyT, hh = Math.round(84 * k), h2 = big ? Math.round(78 * k) : 78, row = (y) => R(70, y + oy, 580, hh);
    let y = big ? 316 : 760; const step = big ? hh + 14 : hasSave ? 94 : 102;
    for (const n of main) { rows[n] = row(y); y += step; }
    const q = (580 - 14 * 3) / 4;
    small.forEach((n, i) => { rows[n] = R(70 + (q + 14) * i, y + oy, q, h2); });
    T.smallSize = 20;
    const sy = Math.min(y + h2 + 50, 1400);
    T.stats = { y: sy + oy, size: Math.round(22 * ss), y2: sy + oy + Math.round(40 * ss), size2: Math.round(30 * ss) };
    T.panel = R(28, 116 + oy, 664, 168); T.title = { x: 360, y: 196 + oy, size: 112, maxW: 640 }; T.tagline = { x: 360, y: 252 + oy, size: 25, maxW: 640 };
    T.board = big ? null : { s: 0.5, ox: 360 - 180, oy: 524 + oy - (330 + 425) * 0.5, tall: true };
    T.msgY = 1420 + oy; T.sx = w / 2;
    { const bt = T.stats.y2 + 24, bh = Math.min(brandW(false) / 3.66, 1462 + oy - bt, l.U.y1 - 4 - bt); T.brand = bh >= 40 ? R(w / 2 - bh * 1.83, bt, bh * 3.66, bh) : null; }
    return T;
  }
  const mh0 = Math.round(84 * k), sh0 = big ? Math.round(70 * k) : 66, g = 10;
  const statsH = Math.round(26 * ss) + Math.round(38 * ss) + 12;
  // rows (main + a 2x2 block of small ones) + the stats lines, fitted into [topY, botY]; spare height goes to a mini board if asked
  const fill = (cx, regionW, topY, botY, allowBoard) => {
    const nM = main.length, avail = botY - topY - statsH;
    const need = (a, b) => nM * a + (nM - 1) * g + g + 2 * b + g;
    let f = 1; if (need(mh0, sh0) > avail) f = Math.max(0.3, (avail - (nM + 2) * g) / (nM * mh0 + 2 * sh0));
    const mh = Math.max(40, Math.floor(mh0 * f)), sh = Math.max(36, Math.floor(sh0 * f)), total = need(mh, sh), left = avail - total;
    let boardH = 0; if (allowBoard && !big && left >= 300) boardH = Math.min(425, left - 16);
    const rest = left - (boardH ? boardH + 16 : 0);
    let y = topY + (boardH ? boardH + 16 : 0) + Math.max(0, rest * 0.4);
    if (boardH) { const s = boardH / 850; T.board = { s, ox: cx - 360 * s, oy: topY + 4 - 330 * s, tall: true }; }
    const bw = Math.min(regionW - 40, 580), x0 = cx - bw / 2;
    for (const n of main) { rows[n] = R(x0, y, bw, mh); y += mh + g; }
    const q = (bw - g) / 2;
    small.forEach((n, i) => { rows[n] = R(x0 + (i % 2) * (q + g), y + Math.floor(i / 2) * (sh + g), q, sh); });
    y += 2 * sh + g; T.smallSize = 24;
    const y1 = y + Math.round(26 * ss);
    T.stats = { y: y1, size: Math.round(22 * ss), y2: y1 + Math.round(38 * ss), size2: Math.round(30 * ss) };
  };
  if (l.mode === 'compact' && !l.land) {
    const cw = Math.min(680, C.w), cx = w / 2, ph = 150, top = C.y0, bwB = Math.min(cw - 40, brandW(false)), brandH = Math.round(bwB / 3.66);
    T.panel = R(cx - cw / 2, top, cw, ph); T.title = { x: cx, y: top + 92, size: 96, maxW: cw - 40 }; T.tagline = { x: cx, y: top + 132, size: 24, maxW: cw - 40 };
    fill(cx, cw, top + ph + 12, C.y1 - brandH - 22, true);
    T.brand = R(cx - bwB / 2, Math.min(T.stats.y2 + 30, C.y1 - brandH), bwB, brandH); T.msgY = T.stats.y2 + 34; T.sx = cx;
    if (T.stats.y2 + 14 > T.brand.y) T.brand = null;   // no room for the lockup (squarish window at a large text size)
    return T;
  }
  // wide: header + mini board + lockup on the left, the buttons on the right
  const lw = C.w * 0.5, cxL = C.x0 + lw / 2, cxR = C.x0 + lw + (C.w - lw) / 2, ph = 140, top = C.y0, pw = Math.min(lw - 16, 600), bwW = Math.min(C.w - lw - 40, brandW(true)), brandH = Math.round(bwW / 3.66);
  T.panel = R(cxL - pw / 2, top, pw, ph); T.title = { x: cxL, y: top + 86, size: 92, maxW: pw - 30 }; T.tagline = { x: cxL, y: top + 122, size: 24, maxW: pw - 30 };
  const boardTop = top + ph + 12, boardBot = C.y1 - 6, s = big ? 0 : Math.min(0.62, (boardBot - boardTop) / 850, (lw - 20) / 704);
  if (s >= 0.28) T.board = { s, ox: cxL - 360 * s, oy: boardTop + (boardBot - boardTop - 850 * s) / 2 - 330 * s, tall: true };
  fill(cxR, C.w - lw, C.y0 + 4, C.y1 - brandH - 22, false);
  T.brand = R(cxR - bwW / 2, Math.min(T.stats.y2 + 24, C.y1 - brandH), bwW, brandH);
  T.msgY = T.stats.y2 + 34; T.sx = cxR;
  return T;
}
export const titleRows = (hasSave, scale = 1) => L.title(hasSave, scale).rows;

// does the host back button sit over the left part of this panel's content?
const x0Hit = (P, bk) => bk.x + bk.w > P.x + 20;

// ---- settings -----------------------------------------------------------------------------------------------------------
function settingsLayout(l, scale = 1) {
  const { w, C } = l, S = { rows: {} }, names = ['level', 'sound', 'calm', 'text', 'seeds', 'wood', 'think'];
  if (l.mode === 'tall') {
    const oy = l.oyT, k = 1 + (scale - 1) * 0.3, hh = Math.round(84 * k), gap = scale >= 2 ? 8 : 12, y0 = scale >= 2 ? 250 : 270;
    names.forEach((n, i) => { S.rows[n] = R(70, y0 + i * (hh + gap) + oy, 580, hh); });
    S.rows.back = R(130, (scale >= 2 ? 1264 : 1236) + oy, 460, scale >= 2 ? 78 : 90);
    S.panel = R(40, 130 + oy, 640, 1220); S.title = { x: 360, y: 232 + oy, size: 70 };
    const last = S.rows.think; S.extra = { y: last.y + last.h + 56, room: S.rows.back.y - (last.y + last.h) - 20, x: 360, w: 580, seedsY: 1170 + oy, seedsX: 210 };
    return S;
  }
  const wide = l.mode === 'wide', pw = wide ? Math.min(C.w - 20, 1000) : Math.min(680, C.w);
  const P = R((w - pw) / 2, C.y0, pw, C.h); S.panel = P; S.title = { x: w / 2, y: P.y + 62, size: 56 };
  const cols = wide ? 2 : 1, nrows = Math.ceil(names.length / cols), backH = 72, backY = P.y + P.h - 16 - backH;
  const bk = l.backBox, top = Math.max(P.y + 92, bk.h && x0Hit(P, bk) ? bk.y + bk.h + 6 : 0), k = 1 + (scale - 1) * 0.3, colW = Math.min(580, (P.w - 60 - (cols - 1) * 20) / cols);
  const fit = fitStack(nrows, Math.round(84 * k), 12, top, backY - 16 - (wide ? 0 : 130), 52);
  const x00 = w / 2 - (cols * colW + (cols - 1) * 20) / 2;
  names.forEach((n, i) => { const c = wide ? i % 2 : 0, r = wide ? Math.floor(i / 2) : i; S.rows[n] = R(x00 + c * (colW + 20), fit.ys[r], colW, fit.h); });
  const rowsBottom = fit.ys[nrows - 1] + fit.h;
  S.rows.back = R(w / 2 - 230, backY, 460, backH);
  S.extra = { y: rowsBottom + 40, room: backY - rowsBottom - 12, x: w / 2, w: Math.min(580, P.w - 60), seedsY: backY - 40, seedsX: w / 2 - 4 * 38 };
  return S;
}
export const setRows = (scale = 1) => L.settings(scale).rows;

use(720, 1560);

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (r) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(r.w, m), h = Math.max(r.h, m); return { x: Math.round(r.x + r.w / 2 - w / 2), y: Math.round(r.y), w: Math.round(w), h: Math.round(h) }; };
export const titleBrand = (hasSave, scale = 1) => L.title(hasSave, scale).brand;
