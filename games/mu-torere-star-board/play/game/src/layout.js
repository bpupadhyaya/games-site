// Geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side
// follows the screen). `layoutFor(w, h)` returns the placement of every screen; it is cached per size, so a frame never rebuilds it.
//
// The game was drawn for a 720 x 1560 phone. That "design space" is kept: every screen is a handful of BLOCKS (title art, menu column,
// turn/message block, button block, the star board) drawn in design coordinates through a section transform {ox, oy, s}. A section maps
// design (x, y) to the screen as (ox + s*x, oy + s*y); `sec.r(x, y, w, h)` gives the matching screen rect (carrying `.s`), which is what
// both drawing and hit-testing use, so a button can never be drawn in one place and tapped in another.
//   tall     portrait phone (h >= 1540): the approved phone look, unchanged (identity transform, centred vertically).
//   compact  portrait tablets / small phones / squarish windows: blocks stacked top to bottom, the board takes what is left.
//   wide     landscape: the star on the left, one column of blocks on the right.
// The star board's own geometry (points 0..7 round the rim, 8 = the putahi) is unchanged.
export const W = 720, H = 1560;
export const BX = 360, BY = 935;
export const PR = 240;        // distance from the centre to a star point (where stones sit)
export const TIP = 322;       // tip of the carved star
export const NOTCH = 226;     // inner corner of the carved star
export const STONE_R = 44;
const TAU = Math.PI * 2;
export const angleOf = (i) => -Math.PI / 2 + (i * TAU) / 8;
export function pointPos(i, cx = BX, cy = BY, k = 1) {
  if (i === 8) return { x: cx, y: cy };
  const a = angleOf(i); return { x: cx + Math.cos(a) * PR * k, y: cy + Math.sin(a) * PR * k };
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
// Which board point a tap means (nearest point within reach), or -1. `B` = the board placement {cx, cy, k} from layoutFor().play().
export function pointNear(x, y, B) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 9; i++) { const p = pointPos(i, B.cx, B.cy, B.k), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } }
  return bd < Math.max(74 * B.k, 40) ? best : -1;
}

// Index into these, never a raw float, so a stepper can cleanly disable at either end and a stale saved index always clamps.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play (Watch & Learn): think-time steps in seconds, hard-capped at 10s.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECONDS = 2;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sec = (ox, oy, s) => ({ ox, oy, s, r: (x, y, w, h) => ({ x: ox + x * s, y: oy + y * s, w: w * s, h: h * s, s }), p: (x, y) => ({ x: ox + x * s, y: oy + y * s }) });
const plain = (x, y, w, h) => ({ x, y, w, h, s: 1 });

// Vertical extent (design y) each play-time block really uses, so a stacked layout reserves exactly that much.
const TOP_RANGE = { play: [176, 410], puzzle: [176, 410], lesson: [176, 440], auto: [176, 402], over: [176, 514], autoover: [176, 486] };
const BOT_RANGE = { play: [1246, 1534], puzzle: [1246, 1534], lesson: [1462, 1534], auto: [1462, 1534], over: [1280, 1514], autoover: [1280, 1436] };
const BOARD_SPAN = 676;       // the star plus its frame, in design units

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const land = w >= h, wide = land && w >= h * 1.25, tall = !land && h >= 1540, mode = wide ? 'wide' : tall ? 'tall' : 'compact';
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const backBottom = ins.back ? ins.t + backSz + 8 : 0;
  const oyT = (h - H) / 2;                 // tall: the phone-shaped screens are centred vertically
  const L = { w, h, mode, U, ins, backBottom, backBox: ins.back ? plain(ins.l, ins.t, backSz + 8, backSz + 8) : plain(0, 0, 0, 0) };
  const memo = new Map();
  const once = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };
  L.title = (hasSave) => once('title' + (hasSave ? 1 : 0), () => titleLayout(L, hasSave, oyT));
  L.page = () => once('page', () => pageLayout(L, oyT));
  L.ladder = () => once('ladder', () => ladderLayout(L, oyT));
  L.demo = () => once('demo', () => demoLayout(L));
  L.play = (kind) => once('play' + kind, () => playLayout(L, kind, oyT));
  return L;
}

// ---------------------------------------------------------------- title
const ART = { y0: 70, y1: 745 };           // design extent of the title art (name, tagline, star, credit lockup)
ART.h = ART.y1 - ART.y0;
const LOCK_AR = 327 / 1200;
const lockRect = (cx, y, maxW) => { const lw = Math.min(260, maxW), lh = lw * LOCK_AR; return { x: cx - lw / 2, y, w: lw, h: lh }; };
// Tap zone of the title lockup: >= 44 css px each way, extended sideways and downward only (never into the buttons above).
export function lockHit(L, T) {
  const r = T.lock; if (!r) return null; const m = 44 / Math.max(0.05, host.px);
  const w = Math.max(r.w, m), x = r.x + r.w / 2 - w / 2, y = r.y - 2;
  return { x, y, w, h: Math.max(r.h + 2, Math.min(m, L.h - y)) };
}
function titleLayout(L, hasSave, oyT) {
  const { U, mode } = L, tall = mode === 'tall', n = hasSave ? 5 : 4;
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'ladder', 'two', 'daily']), D = {};
  names.forEach((nm, i) => { D[nm] = { x: 90, y: 736 + i * 76, w: 540, h: 66 }; });
  // About / How to play / Rules / Auto Play share one row; sound / calm / big share the next; then the warnings toggle.
  const rowY = 736 + n * 76, gap = 14, colw = (540 - gap * 3) / 4;
  D.about = { x: 90, y: rowY, w: colw, h: 66 }; D.howto = { x: 90 + colw + gap, y: rowY, w: colw, h: 66 };
  D.rules = { x: 90 + 2 * (colw + gap), y: rowY, w: colw, h: 66 }; D.auto = { x: 90 + 3 * (colw + gap), y: rowY, w: colw, h: 66 };
  const soundY = rowY + 84, markY = soundY + 70, statsY = markY + 60 + 46, menuBottom = statsY + 22;
  D.sound = { x: 90, y: soundY, w: 172, h: 60 }; D.calm = { x: 274, y: soundY, w: 172, h: 60 }; D.big = { x: 458, y: soundY, w: 172, h: 60 };
  D.marks = { x: 90, y: markY, w: 540, h: 60 };
  const menuH = menuBottom - 736;
  let art, menu, lock = null; const LR = lockRect(0, 0, 300).h + 10, lcx = (L.U.x0 + L.U.x1) / 2;
  if (tall) { const sm = Math.min(1.2, (L.U.y1 - LR - (oyT + 736)) / menuH); art = sec(0, oyT, 1); menu = sec(360 * (1 - sm), oyT + 736 * (1 - sm), sm); }
  else if (mode === 'wide') {
    const sm = Math.min(1.1, (U.h - 20 - LR) / menuH, (U.w * 0.5 - 40) / 540);
    const mx = U.x1 - 40 - 540 * sm, artW = mx - 40 - U.x0, sa = Math.min(1.2, artW / 660, (U.h - 20) / ART.h);
    art = sec(U.x0 + (artW - 720 * sa) / 2, U.y0 + (U.h - ART.h * sa) / 2 - ART.y0 * sa, sa);
    menu = sec(mx - 90 * sm, U.y0 + (U.h - LR - menuH * sm) / 2 - 736 * sm, sm); lock = lockRect(mx + 270 * sm, U.y0 + (U.h - LR - menuH * sm) / 2 + menuH * sm + 6, 540 * sm);
  } else {
    const top = U.y0 + 6, avail = U.h - 12 - LR, A = clamp(avail * 0.4, 330, ART.h);
    const sm = Math.min(1, (avail - A - 8) / menuH), artH = avail - menuH * sm - 8, sa = Math.min(1, artH / ART.h, U.w / 700);
    art = sec(U.x0 + (U.w - 720 * sa) / 2, top + (artH - ART.h * sa) / 2 - ART.y0 * sa, sa);
    menu = sec(U.x0 + (U.w - 720 * sm) / 2, top + artH + 8 - 736 * sm, sm); lock = lockRect(lcx, top + avail + 6, 300);
  }
  if (tall) lock = lockRect(lcx, menu.oy + menuBottom * menu.s + 6, 300);
  const rows = {}; for (const k of Object.keys(D)) rows[k] = menu.r(D[k].x, D[k].y, D[k].w, D[k].h);
  const sp = menu.p(360, statsY);
  return { art, menu, rows, lock, statsY, stats: { x: sp.x, y: sp.y, s: menu.s }, msgD: { x: 60, y: statsY - 44, w: 600, h: 56 } };
}

// ---------------------------------------------------------------- About / How to play / Rules pages
function pageLayout(L, oyT) {
  const { U, mode } = L;
  if (mode !== 'wide') {
    const hy = mode === 'tall' ? Math.max(oyT + 170, L.backBottom + 52) : Math.max(U.y0 + 70, L.backBottom + 52);
    const barY = U.y1 - 26 - 72, pw = Math.min(U.w - 60, 880), px = U.x0 + (U.w - pw) / 2;
    const left = U.x0 + 40, right = U.x1 - 40, total = right - left, bw = Math.min(360, total * 0.46), sw = (total - bw - 32) / 2;
    return {
      head: { x: (U.x0 + U.x1) / 2, y: hy, maxW: U.w - 40, size: 70, align: 'center' }, band: { x0: (U.x0 + U.x1) / 2 - 230, x1: (U.x0 + U.x1) / 2 + 230, y: hy + 38, size: 11 },
      panel: { x: px, w: pw }, clip: { x: 0, y: hy + 70, w: L.w, h: barY - 58 - (hy + 70) }, textX: px + 32, textW: pw - 64,
      back: plain(left, barY, bw, 72), dec: plain(left + bw + 16, barY, sw, 72), inc: plain(left + bw + 32 + sw, barY, sw, 72), hint: { x: (U.x0 + U.x1) / 2, y: barY - 26 },
    };
  }
  const Lw = clamp(U.w * 0.3, 280, 420), cxL = U.x0 + Lw / 2, hy = Math.max(U.y0 + 70, L.backBottom + 52), barY = U.y1 - 26 - 72;
  const px = U.x0 + Lw + 10, pw = U.x1 - 16 - px, bw = Lw - 40, sw = (bw - 14) / 2;
  const stepY = hy + 74;
  return {
    head: { x: cxL, y: hy, maxW: Lw - 24, size: 62, align: 'center' }, band: { x0: cxL - Math.min(190, Lw / 2 - 20), x1: cxL + Math.min(190, Lw / 2 - 20), y: hy + 36, size: 10 },
    panel: { x: px, w: pw }, clip: { x: px - 6, y: U.y0 + 12, w: pw + 12, h: U.h - 24 }, textX: px + 32, textW: pw - 64,
    back: plain(U.x0 + 20, barY, bw, 72), dec: plain(U.x0 + 20, stepY, sw, 66), inc: plain(U.x0 + 20 + sw + 14, stepY, sw, 66), hint: { x: cxL, y: barY - 22 },
  };
}

// ---------------------------------------------------------------- the Ladder
function ladderLayout(L, oyT) {
  const { U, mode } = L, rows = [];
  let out;
  if (mode !== 'wide') {
    const cx = (U.x0 + U.x1) / 2, hy = mode === 'tall' ? Math.max(oyT + 170, L.backBottom + 52) : Math.max(U.y0 + 70, L.backBottom + 52);
    const barY = U.y1 - 26 - 72, top = hy + 160;
    const lw = Math.min(U.w - 80, 700), lx = cx - lw / 2;
    let sideY = barY - 12 - 60, availH = sideY - 14 - top, merged = false;
    let cols = 1, p = Math.min(86, availH / 12);
    if (p < 62) { cols = 2; p = Math.min(86, availH / 6); }
    // a squarish window has no room for two stacked buttons: put "Side" and "Back" side by side and give the rows the height
    if (cols === 2 && p < 66) { merged = true; sideY = barY; availH = barY - 14 - top; p = Math.min(86, availH / 6); }
    const gx = 14, cw = cols === 1 ? lw : (lw - gx) / 2;
    for (let i = 0; i < 12; i++) { const c = cols === 1 ? 0 : (i < 6 ? 0 : 1), r = cols === 1 ? i : i % 6; rows.push(plain(lx + c * (cw + gx), top + r * p, cw, p - 10)); }
    out = {
      title: { x: cx, y: hy, size: 76, maxW: U.w - 40 }, sub: { x: cx, y: hy + 52, size: 27, maxW: U.w - 40 }, note: { x: cx, y: hy + 92, size: 23, maxW: Math.min(640, U.w - 60), align: 'center' },
      side: merged ? plain(lx, barY, (lw - 14) / 2, 72) : plain(cx - Math.min(270, (U.w - 80) / 2), sideY, Math.min(540, U.w - 80), 60),
      back: merged ? plain(lx + (lw + 14) / 2, barY, (lw - 14) / 2, 72) : plain(cx - Math.min(220, (U.w - 80) / 2), barY, Math.min(440, U.w - 80), 72), msg: plain(cx - 300, hy + 68, 600, 60),
    };
  } else {
    const Lw = clamp(U.w * 0.3, 280, 400), cxL = U.x0 + Lw / 2, hy = Math.max(U.y0 + 70, L.backBottom + 52), barY = U.y1 - 26 - 72, sideY = barY - 12 - 60;
    const rx = U.x0 + Lw + 10, rw = U.x1 - 16 - rx, gx = 14, cw = (rw - gx) / 2, top = U.y0 + 12, p = Math.min(86, (U.h - 24) / 6);
    const oy = top + (U.h - 24 - 6 * p) / 2;
    for (let i = 0; i < 12; i++) rows.push(plain(rx + (i < 6 ? 0 : 1) * (cw + gx), oy + (i % 6) * p, cw, p - 10));
    out = {
      title: { x: cxL, y: hy, size: 66, maxW: Lw - 24 }, sub: { x: cxL, y: hy + 44, size: 24, maxW: Lw - 24, wrap: true }, note: { x: cxL, y: hy + 120, size: 21, maxW: Lw - 36, align: 'center', after: true },
      side: plain(U.x0 + 20, sideY, Lw - 40, 60), back: plain(U.x0 + 20, barY, Lw - 40, 72), msg: plain(U.x0 + 20, hy + 190, Lw - 40, 100),
    };
  }
  return { ...out, rows };
}

// ---------------------------------------------------------------- the free-preview limit screen (browser demo only)
function demoLayout(L) {
  const { U } = L, s = Math.min(1, (U.w - 40) / 600, (U.h - 40) / 520), ox = (U.x0 + U.x1) / 2 - 300 * s, oy = (U.y0 + U.y1) / 2 - 260 * s;
  const S = sec(ox, oy, s);
  return { S, back: S.r(80, 400, 440, 72) };
}

// ---------------------------------------------------------------- the board scenes: play, puzzle, lesson, auto, result
// kind: 'play' | 'puzzle' | 'lesson' | 'auto' | 'over' | 'autoover'.
//   board  {cx, cy, k}  the star, drawn by translating (cx - BX*k, cy - BY*k) and scaling k
//   top    section for the turn / message / lesson / result panel (design y 176 maps to its top)
//   bot    section for the rule note + buttons (design y 1246 .. 1534)
//   btn    every button rect in screen coordinates
function playLayout(L, kind, oyT) {
  const { U, mode } = L, TR = TOP_RANGE[kind], BR = BOT_RANGE[kind], topH = TR[1] - TR[0], botH = BR[1] - BR[0];
  let top, bot, board, titleAt = null;
  if (mode === 'tall') {
    const kp = Math.max(0.05, host.px), badgeBottom = (L.ins.t || 0) + 6 / kp + 1.7 * Math.max(16, 11.5 / kp);   // the kit's preview badge
    const tdy = L.ins.t > 0 ? Math.max(0, badgeBottom + 42 - (oyT + 148)) : 0;
    const dy = Math.max(0, L.backBottom + 4 - (oyT + 176), tdy);
    top = sec(0, oyT + dy, 1); bot = sec(0, oyT, 1); board = { cx: BX, cy: oyT + BY, k: 1 }; titleAt = { x: 360, y: oyT + 148 + tdy, size: 50 };
  } else if (mode === 'wide') {
    const gap = 16, pad = 8, minCol = 410;
    const Bs = Math.max(300, Math.min(U.h - 2 * pad, U.w * 0.62, U.w - minCol - 3 * gap)), k = Math.min(1.3, Bs / BOARD_SPAN), bw = Bs + 2 * gap;
    board = { cx: U.x0 + bw / 2, cy: U.y0 + U.h / 2, k };
    const colX = U.x0 + bw, colW = U.x1 - gap - colX;
    const s = Math.min(1.1, colW / 720, (U.h - 2 * pad - 24) / (topH + botH)), ox = colX + (colW - 720 * s) / 2;
    const gh = (topH + 24 + botH) * s, y0 = U.y0 + (U.h - gh) / 2;
    top = sec(ox, y0 - TR[0] * s, s); bot = sec(ox, y0 + (topH + 24) * s - BR[0] * s, s);
  } else {
    const yTop = Math.max(U.y0 + 6, L.backBottom), yBot = U.y1 - 10;
    let s = 1, k = 1, Rh = 0;
    for (const t of [1, 0.92, 0.86, 0.8, 0.74]) { s = t; Rh = yBot - yTop - (topH + botH) * s - 12; k = clamp(Rh / (BOARD_SPAN + 24), 0.3, Math.min(1, (U.w - 8) / BOARD_SPAN)); if (Rh / (BOARD_SPAN + 24) >= 0.66) break; }
    const ox = U.x0 + (U.w - 720 * s) / 2;
    top = sec(ox, yTop - TR[0] * s, s); bot = sec(ox, yBot - botH * s - BR[0] * s, s);
    board = { cx: (U.x0 + U.x1) / 2, cy: yTop + topH * s + 6 + Rh / 2, k };
  }
  const btn = {
    menu: bot.r(60, 1462, 190, 72), undo: bot.r(265, 1462, 190, 72), hint: bot.r(470, 1462, 190, 72), cont: bot.r(270, 1462, 390, 72),
    over1: bot.r(90, 1280, 540, 70), over2: bot.r(90, 1362, 540, 70), over3: bot.r(90, 1444, 540, 70),
    dec: top.r(56, 326, 110, 52), inc: top.r(554, 326, 110, 52),
  };
  return { board, top, bot, btn, titleAt, mode };
}
