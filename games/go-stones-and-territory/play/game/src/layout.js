// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 virtual units, the long side
// follows the screen, portrait or landscape). `setSize(w, h)` (game.js calls it every frame; it is cached by size + safe-area key)
// rebuilds every rect for that size and publishes them through the same exported names the game always used (R, PAGE_NAV, TEXT_BTN,
// AUTOPLAY, boardLayout(), titleButtons() ...), so a frame never recomputes anything. Three shapes:
//   tall     portrait phone (h >= 1500): the approved phone look, same positions as ever (it only re-centres when the screen is taller).
//   compact  portrait tablets / short phones: status row, players, a square board as big as the height allows, message, two button rows.
//   wide     landscape: board + a card (or two) beside it: players and status left, message and buttons right; art left and menu right
//            on the title.
// A board layout L = { n, x, y, size, d, m } (top-left of the board face, its side, the spacing of the crossings, and the margin from
// the face edge to the first line).
export let W = 720, H = 1560;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

const rc = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function boardLayout(n, x, y, size) {
  if (x === undefined) { x = cur.play.board.x; y = cur.play.board.y; size = cur.play.board.size; }
  const d = size / (n - 1 + 1.3), m = d * 0.65;
  return { n, x, y, size, d, m };
}
export const px = (L, i) => L.x + L.m + (i % L.n) * L.d;
export const py = (L, i) => L.y + L.m + Math.floor(i / L.n) * L.d;
export const stoneR = (L) => L.d * 0.485;

// nearest crossing to a screen point; -1 when the point is clearly off the board
export function pointNear(L, x, y) {
  const gx = Math.round((x - L.x - L.m) / L.d), gy = Math.round((y - L.y - L.m) / L.d);
  if (x < L.x - 8 || y < L.y - 8 || x > L.x + L.size + 8 || y > L.y + L.size + 8) return -1;
  const cx = Math.max(0, Math.min(L.n - 1, gx)), cy = Math.max(0, Math.min(L.n - 1, gy));
  return cy * L.n + cx;
}

export function starPoints(n) {
  if (n === 19) return [3, 9, 15].flatMap((y) => [3, 9, 15].map((x) => y * 19 + x));
  if (n === 13) return [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]].map(([x, y]) => y * 13 + x);
  if (n === 9) return [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]].map(([x, y]) => y * 9 + x);
  if (n === 7) return [[3, 3]].map(([x, y]) => y * 7 + x);
  return [Math.floor(n / 2) * n + Math.floor(n / 2)];
}

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Text-size steps for the About/How/Rules reference pages (an index, never a raw float). Content scrolls inside the reader panel.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play (assisted-learning THINK -> REVEAL -> ACT loop). Think-time steps: an index, hard-capped at 10 s.
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_TIME = 2;

// ---- the live, shared rect objects (mutated in place by every rebuild) -------------------------------------------------------
export const R = {};            // place pass undo hint menu msg next back reset skip done
export const PAGE_NAV = {};     // back next
export const TEXT_BTN = {};     // dec inc
export const AUTOPLAY = {};     // dec inc exit pause skip
export const PLAYBOARD = {};    // the play board frame (kept for old callers)
const publish = (target, src) => { for (const k of Object.keys(target)) delete target[k]; Object.assign(target, src); };

let cur = null;
export const layout = () => cur;
export const modeNow = () => cur.mode;

export function setSize(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1560;
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (cur && cur.key === key) return cur;
  W = w; H = h;
  cur = build(w, h); cur.key = key;
  const p = cur.play;
  publish(R, { place: p.place, next: p.next, done: p.done, msg: p.msg, pass: p.slots[0], undo: p.slots[1], hint: p.slots[2], menu: p.slots[3], back: p.slots[0], reset: p.slots[1], skip: p.slots[3] });
  publish(PAGE_NAV, cur.reader.nav);
  publish(TEXT_BTN, { dec: cur.reader.dec, inc: cur.reader.inc });
  publish(AUTOPLAY, { dec: p.apDec, inc: p.apInc, exit: p.slots[0], pause: p.slots[1], skip: p.slots[2] });
  publish(PLAYBOARD, { ...p.board });
  return cur;
}

// ---- common frame -----------------------------------------------------------------------------------------------------------
function frame(w, h) {
  const t = host.t, b = host.b, l = host.l, r = host.r;
  const back = host.back > 0 ? host.back : 0, bk = back ? back + 12 : 0;   // bk: width/height of the back button's box
  return { t, b, l, r, back, bk, x0: l, x1: w - r, y0: t, y1: h - b };
}

// Split a rect into n equal slots in a row (gap g).
const slotsRow = (r, n, g) => { const sw = (r.w - g * (n - 1)) / n; return Array.from({ length: n }, (_, i) => rc(r.x + i * (sw + g), r.y, sw, r.h)); };

// ---- play / lesson / puzzle / auto play ---------------------------------------------------------------------------------------
// Room under the top inset for the kit's top-centre "Preview m:ss" pill (6 css px under the inset, about 20 css px tall).
const badgeRoom = () => { const k = Math.max(0.3, host.px || 0.6); return Math.ceil(6 / k + 1.7 * Math.max(16, 11.5 / k)) + 4; };
function playLayout(w, h, F, mode) {
  const P = { mode }, br = badgeRoom();
  if (mode === 'tall') {
    const dy = Math.max(0, (h - 1560) / 2) + Math.max(0, F.t + br - 118), x0 = F.back ? Math.max(24, F.l + F.back + 22) : 24, x1 = w - 24 - F.r, pw = (x1 - x0 - 24) / 2;
    P.players = [rc(x0, 118 + dy, pw, 112), rc(x0 + pw + 24, 118 + dy, pw, 112)];
    P.status = { x: w / 2, y: 278 + dy, size: 27, sub: 306 + dy };
    P.board = { x: (w - 648) / 2, y: 312 + dy, size: 648 };
    P.msg = rc(36, 972 + dy, 648, 122); P.msgMin = 17;
    P.rowA = rc(36, 1118 + dy, 648, 104); P.place = rc(250, 1118 + dy, 220, 104); P.next = P.done = rc(190, 1118 + dy, 340, 104);
    P.slots = [0, 1, 2, 3].map((i) => rc(36 + i * 166, 1290 + dy, 150, 84));
    P.halves = [rc(36, 1290 + dy, 300, 84), rc(384, 1290 + dy, 300, 84)];
    P.apDec = rc(36, 1118 + dy, 190, 104); P.apInc = rc(494, 1118 + dy, 190, 104); P.apText = { x: w / 2, y: 1174 + dy, size: 25 };
    P.bowls = { a: { x: 128, y: 1178 + dy, s: 0.62, pr: { x: 62, y: 1254 + dy, dx: 13 } }, b: { x: 592, y: 1178 + dy, s: 0.62, pr: { x: 658, y: 1254 + dy, dx: -13 } } };
    P.caption = { x: w / 2, y: 1440 + dy, size: 24, maxW: 660 };
    P.think = rc(210, 1478 + dy, 300, 12);
    P.cards = [];
    P.head = { cx: w / 2, cap: 152 + dy, title: 226 + dy, step: 282 + dy, titleSize: 64, capSize: 26, puz: 200 + dy, puzSize: 68, streak: 262 + dy, maxW: w - 2 * Math.max(40, F.bk + 16) };
    P.confetti = { x: 60, w: 600, y: 360 + dy };
    return P;
  }
  const g = 14;
  if (mode === 'compact') {
    const m = 24, cw = w - 2 * m;
    let y = F.t + (F.back ? 6 : 12);
    const topH = F.back ? F.back : 34;
    const sy = Math.max(y + topH / 2 + 9, F.t + br + 22);   // the status line sits below the preview pill
    P.status = { x: w / 2, y: sy, size: 26, sub: 0 };
    y = Math.max(y + topH + 8, sy + 14);
    const ph = 76, msgH = 88, rowH = 66, below = g + msgH + g + rowH + 10 + rowH;
    const bottom = h - F.b - 10;
    const bsMax = Math.min(648, cw);
    const bs = clamp(bottom - (y + ph + 10) - below, 240, bsMax);
    const spare = Math.max(0, bottom - (y + ph + 10 + bs + below));
    const extra = Math.min(spare / 4, 14), lead = Math.max(0, (spare - 4 * extra) / 2);
    y += lead;
    const pw = (cw - 14) / 2;
    P.players = [rc(m, y, pw, ph), rc(m + pw + 14, y, pw, ph)];
    P.head = { cx: w / 2, cap: y + 26, title: y + 66, step: 0, titleSize: 40, capSize: 22, puz: y + 48, puzSize: 42, streak: y + 72, maxW: cw - 20, compact: true, y, h: ph };
    y += ph + 10 + extra;
    P.board = { x: (w - bs) / 2, y, size: bs }; y += bs + g + extra;
    P.msg = rc(m, y, cw, msgH); P.msgMin = 19; y += msgH + g + extra;
    P.rowA = rc(m, y, cw, rowH); y += rowH + 10 + extra;
    P.slots = slotsRow(rc(m, y, cw, rowH), 4, 12);
    P.halves = slotsRow(rc(m, y, cw, rowH), 2, 14);
    P.think = rc(w / 2 - 150, P.rowA.y - 9, 300, 6);
    P.caption = null; P.bowls = null; P.cards = [];
    P.confetti = { x: P.board.x, w: bs, y: P.board.y + 40 };
  } else {
    // wide
    const m = 18, gap = 16;
    const ax0 = F.l + m, ax1 = w - F.r - m, ay0 = F.t + Math.max(m, br), ay1 = h - F.b - m;
    const avail = ax1 - ax0, bsMax = Math.min(ay1 - ay0 - 26, 700);
    const cardMin = 270, cardMax = 440;
    const two = avail - bsMax - 2 * gap >= 2 * cardMin;
    let cw, bs, left, right, groupX;
    if (two) {
      cw = Math.min(cardMax, (avail - bsMax - 2 * gap) / 2); bs = bsMax;
      const total = cw * 2 + gap * 2 + bs; groupX = ax0 + (avail - total) / 2;
      left = rc(groupX, ay0, cw, ay1 - ay0); right = rc(groupX + cw + gap + bs + gap, ay0, cw, ay1 - ay0);
      P.board = { x: groupX + cw + gap, y: ay0 + (ay1 - ay0 - 26 - bs) / 2, size: bs };
    } else {
      const gutter = F.bk ? Math.max(0, F.bk - m + 6) : 0;
      cw = clamp(avail - bsMax - gap - gutter, cardMin, cardMax); bs = Math.min(bsMax, avail - cw - gap - gutter);
      const total = gutter + bs + gap + cw; groupX = ax0 + Math.max(0, (avail - total) / 2);
      right = rc(groupX + gutter + bs + gap, ay0, cw, ay1 - ay0); left = null;
      P.board = { x: groupX + gutter, y: ay0 + (ay1 - ay0 - 26 - bs) / 2, size: bs };
    }
    const bkY = F.back ? F.t + F.back + 20 : ay0 + 6;     // below the back button's box
    const pad = 14, ph = 92;
    // left card (two-card shape) or the top of the single card holds players + status
    const hostCard = left || right, hy0 = left ? bkY : ay0 + pad;
    P.players = [rc(hostCard.x + pad, hy0, hostCard.w - 2 * pad, ph), rc(hostCard.x + pad, hy0 + ph + 10, hostCard.w - 2 * pad, ph)];
    const statusY = hy0 + 2 * ph + 10 + 36;
    P.status = { x: hostCard.x + hostCard.w / 2, y: statusY, size: 24, sub: statusY + 28, card: true };
    P.head = { cx: hostCard.x + hostCard.w / 2, cap: hy0 + 24, title: hy0 + 76, step: hy0 + 112, titleSize: 44, capSize: 24, puz: hy0 + 64, puzSize: 46, streak: hy0 + 108, maxW: hostCard.w - 2 * pad, wide: true };
    // buttons and message: bottom of the right card, message above
    const rowH = 66, cwid = right.w - 2 * pad;
    const rowB = rc(right.x + pad, right.y + right.h - pad - (rowH * 2 + 10), cwid, rowH * 2 + 10);
    P.slots = [0, 1, 2, 3].map((i) => rc(rowB.x + (i % 2) * (cwid / 2 + 5), rowB.y + Math.floor(i / 2) * (rowH + 10), cwid / 2 - 5, rowH));
    P.halves = [rc(rowB.x, rowB.y, cwid / 2 - 5, rowB.h), rc(rowB.x + cwid / 2 + 5, rowB.y, cwid / 2 - 5, rowB.h)];
    P.rowA = rc(rowB.x, rowB.y - 10 - 72, cwid, 72);
    const msgTop = left ? right.y + pad : hy0 + 2 * ph + 10 + 74;
    const msgBot = P.rowA.y - 16;
    P.msg = rc(rowB.x, msgTop, cwid, Math.max(80, msgBot - msgTop)); P.msgMin = 19;
    P.think = rc(P.rowA.x + cwid / 2 - 100, P.rowA.y - 11, 200, 6);
    P.caption = left ? { x: left.x + left.w / 2, y: statusY + 56, size: 21, maxW: left.w - 2 * pad } : null;
    // bowls (two-card shape, room under the status)
    const bowlY = left ? left.y + left.h - 130 : 0;
    P.bowls = left && bowlY > statusY + 110 ? { a: { x: left.x + left.w * 0.27, y: bowlY, s: 0.55, pr: { x: left.x + 26, y: bowlY + 78, dx: 11 } }, b: { x: left.x + left.w * 0.73, y: bowlY, s: 0.55, pr: { x: left.x + left.w - 26, y: bowlY + 78, dx: -11 } } } : null;
    P.cards = left ? [left, right] : [right];
    P.confetti = { x: P.board.x, w: bs, y: P.board.y + 40 };
  }
  P.place = P.next = P.done = P.rowA;
  const ra = P.rowA, bw = Math.round(ra.w * 0.29);
  P.apDec = rc(ra.x, ra.y, bw, ra.h); P.apInc = rc(ra.x + ra.w - bw, ra.y, bw, ra.h);
  P.apText = { x: ra.x + ra.w / 2, y: ra.y + ra.h / 2 + 8, size: 22 };
  return P;
}

// ---- reader (About / How to play / Rules) -------------------------------------------------------------------------------------
function readerLayout(w, h, F, mode) {
  const Q = {};
  const cx = w / 2;
  if (mode === 'tall') {
    const dy = Math.max(0, (h - 1560) / 2);
    Q.title = { x: cx, y: 176 + dy, maxW: w - 2 * Math.max(40, F.bk + 16), size: 70 };
    Q.panel = rc(36, 214 + dy, 648, 1132);
    Q.nav = { back: rc(36, 1380 + dy, 300, 84), next: rc(384, 1380 + dy, 300, 84) };
  } else if (mode === 'compact') {
    const hdrH = Math.max(F.bk ? F.back + 14 : 0, 76), y0 = F.t + hdrH;
    Q.title = { x: cx, y: F.t + hdrH / 2 + 18, maxW: w - 2 * Math.max(40, F.bk + 16), size: 56 };
    const fh = 76, py0 = y0 + 4, py1 = h - F.b - 10 - fh - 12;
    Q.panel = rc(36, py0, w - 72, py1 - py0);
    Q.nav = { back: rc(36, py1 + 12, (w - 72) / 2 - 8, fh), next: rc(w / 2 + 8, py1 + 12, (w - 72) / 2 - 8, fh) };
  } else {
    const pw = Math.min(1000, w - 2 * (F.l + Math.max(F.bk + 8, 28)), w - 2 * Math.max(F.l, F.r) - 56);
    const px0 = (w - pw) / 2, titleY = F.t + 62;
    Q.title = { x: cx, y: titleY, maxW: pw - 40, size: 50 };
    const fh = 64, py0 = F.t + 84, py1 = h - F.b - 10 - fh - 10;
    Q.panel = rc(px0, py0, pw, py1 - py0);
    const nw = Math.min(300, (pw - 16) / 2);
    Q.nav = { back: rc(px0, py1 + 10, nw, fh), next: rc(px0 + pw - nw, py1 + 10, nw, fh) };
  }
  const pn = Q.panel, bh = mode === 'wide' ? 52 : 60;
  Q.dec = rc(pn.x + pn.w - 14 - 96 * 2 - 8, pn.y + 10, 96, bh); Q.inc = rc(pn.x + pn.w - 14 - 96, pn.y + 10, 96, bh);
  Q.pager = { x: pn.x + 24, y: pn.y + 10 + bh / 2 + 8, size: 22 };
  Q.body = rc(pn.x, pn.y + bh + 18, pn.w, pn.h - bh - 28);     // the scrolling area (clipped)
  Q.textX = pn.x + 28; Q.textW = pn.w - 56 - 10;               // 10: room for the scroll bar
  return Q;
}

// ---- column pages (setup, settings, lessons, demo limit) ------------------------------------------------------------------------
// The tall design is kept as is (y in design units) and compressed vertically for shorter screens; wide screens centre the column.
function columnFrame(w, h, F, mode, designTop, designBottom, titleDesignY) {
  const dy = mode === 'tall' ? Math.max(0, (h - 1560) / 2) : 0;
  const cxs = F.l + (w - F.l - F.r) / 2, ox = cxs - 360;           // horizontal offset of the 720-wide design
  if (mode === 'tall') return { k: 1, ox: 0, Y: (y) => y + dy, titleY: titleDesignY + dy, cx: w / 2, titleSize: 70, maxW: w - 2 * Math.max(40, F.bk + 16) };
  const hdrH = Math.max(F.bk ? F.back + 14 : 0, 70), top = F.t + hdrH + 4, bot = h - F.b - 12;
  const k = clamp((bot - top) / (designBottom - designTop), 0.55, 1);
  const used = (designBottom - designTop) * k, lead = Math.max(0, (bot - top - used) / 2);
  return { k, ox, Y: (y) => top + lead + (y - designTop) * k, titleY: F.t + hdrH / 2 + 18, cx: cxs, titleSize: mode === 'wide' ? 48 : 56, maxW: w - 2 * Math.max(40, F.bk + 16) };
}

function setupLayout(w, h, F, mode) {
  const wide = mode === 'wide';
  const C = columnFrame(w, h, F, mode, 316, 1364, 190);
  const { k, ox, Y } = C;
  const o = { C, k, wide };
  if (!wide) {
    const hh = (v) => v * k;
    o.sizes = [9, 13, 19].map((n, i) => ({ n, r: rc(ox + 36 + i * 220, Y(358), 208, hh(92)) }));
    o.levels = [0, 1, 2, 3].map((i) => ({ i, r: rc(ox + 36 + (i % 2) * 330, Y(578 + Math.floor(i / 2) * 90), 318, hh(78)) }));
    o.sides = [1, 2, 0].map((v, i) => ({ v, label: ['Black (first)', 'White', 'Two players'][i], r: rc(ox + 36 + i * 220, Y(952), 208, hh(88)) }));
    o.start = rc(ox + 110, Y(1160), 500, hh(100)); o.back = rc(ox + 110, Y(1284), 500, hh(80));
    o.blurb = rc(ox + 36, Y(772), 648, hh(112));
    o.l = { size: { x: ox + 60, y: Y(340) }, level: { x: ox + 60, y: Y(558) }, you: { x: ox + 60, y: Y(932) } };
    o.note = { x: ox + 360, y: Y(490), maxW: 620 }; o.score = { x: ox + 360, y: Y(1096) }; o.blurbText = { x: ox + 360, y: Y(814), maxW: 600 };
    o.lab = 'left';
  } else {
    // two columns: left = size, side, scoring; right = level, blurb, buttons
    const colW = Math.min(560, (w - F.l - F.r - 2 * 36 - 28) / 2), total = colW * 2 + 28, x0 = F.l + (w - F.l - F.r - total) / 2, xr = x0 + colW + 28;
    const hdrH = Math.max(F.bk ? F.back + 14 : 0, 70), top = F.t + hdrH + 6, bot = h - F.b - 14;
    const bh = 66, g = 10, lab = 34;
    const sw3 = (colW - 2 * g) / 3;
    let y = top;
    o.l = { size: { x: x0 + 6, y: y + 24 }, level: { x: xr + 6, y: y + 24 }, you: { x: x0 + 6, y: 0 } };
    y += lab;
    o.sizes = [9, 13, 19].map((n, i) => ({ n, r: rc(x0 + i * (sw3 + g), y, sw3, bh) }));
    o.levels = [0, 1, 2, 3].map((i) => ({ i, r: rc(xr + (i % 2) * ((colW - g) / 2 + g), top + lab + Math.floor(i / 2) * (bh + g), (colW - g) / 2, bh) }));
    y += bh + 12;
    o.note = { x: x0 + colW / 2, y: y + 22, maxW: colW - 10 }; y += 78;
    o.l.you.y = y + 24; y += lab;
    o.sides = [1, 2, 0].map((v, i) => ({ v, label: ['Black (first)', 'White', 'Two players'][i], r: rc(x0 + i * (sw3 + g), y, sw3, bh) }));
    y += bh + 16; o.score = { x: x0 + colW / 2, y: y + 12 };
    const yr = top + lab + 2 * (bh + g) + 10;
    o.blurb = rc(xr, yr, colW, 108); o.blurbText = { x: xr + colW / 2, y: yr + 40, maxW: colW - 40 };
    const sh = clamp(bot - (yr + 108 + 16) - 60 - 12, 60, 84);
    o.start = rc(xr, yr + 108 + 16, colW, sh); o.back = rc(xr, yr + 108 + 16 + sh + 12, colW, 60);
    o.lab = 'left';
  }
  return o;
}

function settingsLayout(w, h, F, mode) {
  const C = columnFrame(w, h, F, mode, 240, 1100, 176), { k, ox, Y } = C;
  const names = ['sound', 'calm', 'big', 'quick', 'theme'], rects = {};
  names.forEach((nm, i) => { rects[nm] = rc(ox + 60, Y(260 + i * 118), 600, 96 * k); });
  rects.back = rc(ox + 110, Y(1000), 500, 84 * k);
  return { rects, note: { x: ox + 360, y: Y(866), maxW: 600 }, C };
}

function lessonsLayout(w, h, F, mode, count) {
  const wide = mode === 'wide';
  const designBottom = 250 + Math.max(0, count - 1) * 88 + 78 + 40 + 84;
  const C = columnFrame(w, h, F, mode, 250, designBottom, 190);
  const { k, ox, Y } = C;
  let rects, back;
  if (!wide) {
    rects = Array.from({ length: count }, (_, i) => rc(ox + 36, Y(250 + i * 88), 648, 78 * k));
    back = mode === 'tall' ? rc(110, 1230 + Math.max(0, (h - 1560) / 2), 500, 84) : rc(ox + 110, Y(250 + count * 88 + 20), 500, 84 * k);
  } else {
    const hdrH = Math.max(F.bk ? F.back + 14 : 0, 70), top = F.t + hdrH + 6, bot = h - F.b - 12;
    const rows = Math.ceil(count / 2), colW = Math.min(520, (w - F.l - F.r - 72 - 20) / 2), total = colW * 2 + 20, x0 = F.l + (w - F.l - F.r - total) / 2;
    const backH = 62, avail = bot - top - backH - 14, pitch = Math.min(92, avail / rows), rh = pitch - 10;
    rects = Array.from({ length: count }, (_, i) => rc(x0 + (i % 2) * (colW + 20), top + Math.floor(i / 2) * pitch, colW, rh));
    back = rc(x0 + total / 2 - 200, top + rows * pitch + 4, 400, backH);
  }
  return { rects, back, C };
}

function demoLayout(w, h, F, mode) {
  const ph = Math.min(520, h - F.t - F.b - 40), cx = F.l + (w - F.l - F.r) / 2;
  const pw = Math.min(600, w - F.l - F.r - 48);
  const panel = mode === 'tall' ? rc(60, 420 + Math.max(0, (h - 1560) / 2), 600, 520) : rc(cx - pw / 2, Math.max(F.t + 20, (h - ph) / 2), pw, ph);
  return { panel, cx: panel.x + panel.w / 2, k: ph / 520 };
}

// ---- title ------------------------------------------------------------------------------------------------------------------
// The banner image is 720 x 400 with the paper at x 50..670, y 84..380: banner = { x, y, s } is where the image's top-left lands, scaled by s.
const LOCK_W = 260, LOCK_AR = 327 / 1200;
// Tap zone of the title lockup: >= 44 css px each way, extended sideways and downward only (never into the buttons above).
export function lockHit(P, T) {
  const c = T.credit; if (!c) return null; const m = 44 / Math.max(0.05, host.px), lw = c.w, lh = c.w * LOCK_AR;
  const w = Math.max(lw, m), y = c.y - 2;
  return { x: c.x - w / 2, y, w, h: Math.max(lh + 2, Math.min(m, P.h - y)) };
}
function titleLayout(w, h, F, mode0, hasSave) {
  const mode = mode0 === 'tall' && F.back ? 'compact' : mode0;   // tall phones with a host back button use the flexible layout so the banner clears it
  const T = { mode }, names = (hasSave ? ['resume'] : []).concat(['play', 'learn', 'daily', 'about', 'how']);
  if (mode === 'tall') {
    const dy = Math.max(0, (h - 1560) / 2);
    const out = {}, y0 = (hasSave ? 812 : 830) + dy, gap = hasSave ? 12 : 14, nr = names.length + 2, LK = LOCK_W * LOCK_AR + 16;
    const bh = clamp(Math.min(hasSave ? 74 : 80, (h - F.b - 10 - LK - y0 - (nr - 1) * gap) / nr), 52, 80);
    names.forEach((nm, i) => { out[nm] = rc(110, y0 + i * (bh + gap), 500, bh); });
    const pairY = y0 + names.length * (bh + gap), halfW = (500 - 20) / 2;
    out.settings = rc(110, pairY, halfW, bh); out.rules = rc(110 + halfW + 20, pairY, halfW, bh); out.auto = rc(110, pairY + bh + gap, 500, bh);
    T.buttons = out; T.banner = { x: 0, y: dy, s: 1 }; T.board = { x: 165, y: 392 + dy, size: 390 }; T.credit = { x: w / 2, y: out.auto.y + bh + 10, w: LOCK_W };
    return T;
  }
  const out = {};
  if (mode === 'compact') {
    const m = 36, cw = w - 2 * m, top = F.t + 6 + (F.back ? F.back + 12 : 0), bot = h - F.b - 10, g = 10, avail = bot - top;   // the banner card starts below the host back button
    const bh = clamp(avail * 0.072, 56, 78), rows = 5;
    const blockH = rows * bh + (rows - 1) * g, credit = LOCK_W * LOCK_AR + 16, rest = avail - blockH - credit - 2 * g;
    let s = clamp(rest * 0.45 / 296, 0.5, 0.95);
    let boardSz = Math.min(430, rest - 296 * s - 16);
    if (boardSz < 180) { boardSz = 0; s = clamp(rest / 296, 0.5, 0.95); }
    let y = top + Math.max(0, (rest - 296 * s - (boardSz ? boardSz + 16 : 0)) / 3);
    T.banner = { x: w / 2 - 360 * s, y: y - 84 * s, s }; y += 296 * s + 12;
    if (boardSz) { T.board = { x: w / 2 - boardSz / 2, y, size: boardSz }; y += boardSz + 26 + 4; } else T.board = null;
    const half = (cw - g) / 2, rowY = (i) => y + i * (bh + g);
    let r = 0;
    if (hasSave) { out.resume = rc(m, rowY(r), half, bh); out.play = rc(m + half + g, rowY(r), half, bh); } else out.play = rc(m, rowY(r), cw, bh);
    r++; out.learn = rc(m, rowY(r), half, bh); out.daily = rc(m + half + g, rowY(r), half, bh);
    r++; out.about = rc(m, rowY(r), half, bh); out.how = rc(m + half + g, rowY(r), half, bh);
    r++; out.settings = rc(m, rowY(r), half, bh); out.rules = rc(m + half + g, rowY(r), half, bh);
    r++; out.auto = rc(m, rowY(r), cw, bh);
    T.credit = { x: w / 2, y: rowY(r) + bh + 8, w: Math.min(LOCK_W, cw) };
    T.buttons = out;
    return T;
  }
  // wide: art left, buttons right
  const x0 = F.l + 24, x1 = w - F.r - 24, top = F.t + 14, bot = h - F.b - 14, avail = bot - top;
  const bw = clamp((x1 - x0) * 0.32, 340, 480), px0 = x1 - bw, artW = px0 - x0 - 24;
  const lkH = Math.min(LOCK_W, bw) * LOCK_AR + 16, rows = names.length + 2, g = 10, bh = clamp((avail - lkH - (rows - 1) * g) / rows, 48, 76);
  const blockH = rows * bh + (rows - 1) * g; let y = top + (avail - lkH - blockH) / 2;
  names.forEach((nm) => { out[nm] = rc(px0, y, bw, bh); y += bh + g; });
  const half = (bw - 14) / 2;
  out.settings = rc(px0, y, half, bh); out.rules = rc(px0 + half + 14, y, half, bh); y += bh + g;
  out.auto = rc(px0, y, bw, bh);
  T.buttons = out; T.credit = { x: px0 + bw / 2, y: y + bh + 8, w: Math.min(LOCK_W, bw) };
  const credit = 28;
  let s = Math.min(0.95, (artW - 20) / 620, avail * 0.4 / 296), boardSz = Math.min(430, avail - 296 * s - credit - 30);
  if (boardSz < 180) { boardSz = 0; s = Math.min(0.95, (artW - 20) / 620, (avail - credit) / 296); }
  const used = 296 * s + 14 + (boardSz ? boardSz + 26 + 4 : 0) + credit; let ay = top + Math.max(0, (avail - used) / 2);
  const acx = x0 + artW / 2;
  T.banner = { x: acx - 360 * s, y: ay - 84 * s, s }; ay += 296 * s + 14;
  if (boardSz) { T.board = { x: acx - boardSz / 2, y: ay, size: boardSz }; ay += boardSz + 26 + 4; } else T.board = null;
  return T;
}

// ---- build everything for one size ----------------------------------------------------------------------------------------------
function build(w, h) {
  const mode = w > h ? 'wide' : h >= 1500 ? 'tall' : 'compact';
  const F = frame(w, h);
  const P = { w, h, mode, F };
  P.play = playLayout(w, h, F, mode);
  P.reader = readerLayout(w, h, F, mode);
  P.setup = setupLayout(w, h, F, mode);
  P.settings = settingsLayout(w, h, F, mode);
  P.demo = demoLayout(w, h, F, mode);
  P.lessonCache = {};
  P.lessonsFor = (n) => (P.lessonCache[n] ??= lessonsLayout(w, h, F, mode, n));
  P.titleCache = {};
  P.titleFor = (hasSave) => (P.titleCache[hasSave ? 1 : 0] ??= titleLayout(w, h, F, mode, hasSave));
  return P;
}

export const titleButtons = (hasSave) => cur.titleFor(!!hasSave).buttons;
export const titleLay = (hasSave) => cur.titleFor(!!hasSave);
export const quizRectAt = (n, i) => {
  const ra = cur.play.rowA, w = Math.min(210, (ra.w - 48 - (n - 1) * 12) / n), tot = n * w + (n - 1) * 12;
  return rc(ra.x + ra.w / 2 - tot / 2 + i * (w + 12), ra.y, w, ra.h);
};

setSize(720, 1560);
