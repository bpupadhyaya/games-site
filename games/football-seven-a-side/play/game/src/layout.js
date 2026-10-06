// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the SHORT side is always 720 virtual units, the long side
// grows with the aspect ratio). `layoutFor(w, h, textIdx)` returns every rectangle for that size, cached by size + insets + text size, so
// game.js (hit-testing), hud.js / menus.js (drawing), the camera framing, the 3D presenter and the tests never disagree.
// Two shapes (the camera follows the shape, see camera.js):
//   tall  portrait (any phone or tablet): the approved phone look. Scoreboard on top, the pitch (end-on camera) in the middle, the thumb
//         zone at the bottom (stick left, four buttons right, SPRINT between them, THINK above the stick).
//   wide  landscape / squarish: a slim top bar (Think | scores + clock | Pause), the pitch runs across the screen (side camera), the
//         stick sits bottom-left and the buttons bottom-right over the near corners of the pitch, the goal mouths stay clear.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
// The in-play HUD follows the 100-300% text setting through a gentler multiplier so the pitch stays visible.
export const PLAY_M = [1, 1.2, 1.4, 1.6, 1.8];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y, extra = 0) => !!c && Math.hypot(x - c.x, y - c.y) <= c.r + extra;

// Live virtual size (live bindings: every module that imports W / H sees the current value).
export let W = 720, H = 1280;
export function setViewport(w, h) { const nw = Math.round(w) || 720, nh = Math.round(h) || 1280; if (nw !== W || nh !== H) { W = nw; H = nh; } }

// Safe areas, the host's floating back button and the css-px-per-unit scale. main.js keeps this current; browsers / tests: zeros.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54 };

const cache = new Map();
export function layoutFor(w, h, textIdx = 0) {
  w = Math.round(w); h = Math.round(h);
  const ti = Math.max(0, Math.min(PLAY_M.length - 1, textIdx | 0));
  const key = `${w}x${h}|${ti}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, ti, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return L;
}
export const hudLayout = (idx) => layoutFor(W, H, idx).hud;

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function build(w, h, ti, ins) {
  const land = w >= h, mode = land ? 'wide' : 'tall';
  const m = PLAY_M[ti], k = Math.min(1.16, 1 + 0.04 * ti);
  const px = ins.px || 0.54;
  const minf = clamp(Math.ceil(11 / px), 11, 36);               // smallest text, about 11 css px
  const minb = clamp(Math.round(44 / px), 60, 100);             // smallest tap target height, about 44 css px
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const backRight = ins.back ? backBox.x + backBox.w + 4 : 0;
  const L = { w, h, land, mode, ti, m, k, px, minf, minb, U, ins, backBox };

  // ---- the in-play HUD ----------------------------------------------------------------------------------------------------------
  const hud = L.hud = { idx: ti, m, k, mode, minf, minb };
  const yb = U.y1;
  const rs = (r) => Math.round(r * k);
  // the four context buttons for the right thumb (A shoot / tackle / head / dive, B pass / slide / jump, C lob / call, D through) and SPRINT
  // in landscape the cluster sits a little lower so the goal mouths (mid-height at both ends of the pitch) stay clear
  hud.btns = land ? [
    { i: 0, x: U.x1 - 120, y: yb - 172, r: rs(64) },
    { i: 1, x: U.x1 - 262, y: yb - 146, r: rs(52) },
    { i: 2, x: U.x1 - 190, y: yb - 56, r: rs(46) },
    { i: 3, x: U.x1 - 18 - rs(46), y: yb - 58, r: rs(46) },
  ] : [
    { i: 0, x: U.x1 - 120, y: yb - 210, r: rs(64) },
    { i: 1, x: U.x1 - 258, y: yb - 160, r: rs(52) },
    { i: 2, x: U.x1 - 172, y: yb - 66, r: rs(46) },
    { i: 3, x: U.x1 - 18 - rs(46), y: yb - 84, r: rs(46) },
  ];
  hud.stick = { x: U.x0 + 150, y: yb - (land ? 140 : 158), r: 92 };
  const sprintR = rs(44);
  const ps = Math.max(60, minb);                                 // pause button: a square tap target
  if (!land) {
    hud.sprint = { x: Math.round(U.x0 + U.w / 2 - 30), y: yb - 90, r: sprintR };
    const scoreY = U.y0 + Math.max(64, ps + 8);                  // below the pause button and the kit's Preview chip
    hud.scoreY = scoreY + Math.round(34 * m);                    // baseline row of the scoreboard
    hud.topH = Math.round(scoreY - U.y0 + 70 + 46 * (m - 1) * 2.2);
    hud.pause = R(U.x1 - 14 - ps, U.y0 + 4, ps, ps);
    const th = Math.max(Math.round(56 * k), minb);
    hud.think = R(U.x0 + 14, yb - 258 - th - 8, Math.round(150 * Math.min(k, 1.2)), th);
    hud.zone = R(U.x0, yb - 320, 330, 320);
    hud.score = { tall: true, left: Math.max(U.x0 + 24, backRight), right: U.x1 - 24, cx: w / 2, y: hud.scoreY, roleY: hud.scoreY + Math.round(30 * m) };
    hud.fade = { y0: yb - 350, y1: h };
    hud.msgY = yb - 18;
    hud.bannerY = U.y0 + hud.topH + 120;
    hud.promptTop = U.y0 + hud.topH + 66;
    hud.fit = { x0: U.x0 + 8, x1: U.x1 - 8, y0: U.y0 + hud.topH + 8, y1: yb - 340 };
    // Watch & Learn controls: one row of four buttons at the bottom, the message above the pitch
    const bh = Math.max(minb, Math.round(74 * Math.min(m, 1.3))), by = yb - 26 - bh, avail = U.w - 28, kk = avail / 692;
    hud.watch = { btns: [R(U.x0 + 14, by, 200 * kk, bh), R(U.x0 + 14 + 212 * kk, by, 90 * kk, bh), R(U.x0 + 14 + 312 * kk, by, 90 * kk, bh), R(U.x0 + 14 + 412 * kk, by, 280 * kk, bh)], labelX: w / 2, labelY: by - 14, fadeY: by - 80 };
    hud.watchPanel = { x: U.x0 + 30, w: U.w - 60, top: U.y0 + hud.topH + 90, wide: false };
    hud.watchFit = { x0: U.x0 + 8, x1: U.x1 - 8, y0: hud.fit.y0, y1: by - 70 };
  } else {
    const mS = Math.min(m, 1.35);
    const ub = Math.max(minb, Math.round(56 * mS)), uw = clamp(Math.round(118 * mS), 118, 170);
    hud.sprint = { x: U.x1 - 372, y: yb - 60, r: sprintR };
    const ty = U.y0 + 6, lx = Math.max(U.x0 + 12, backRight), rx = U.x1 - 12;
    const fs = Math.round(34 * mS), clockFs = Math.max(minf, Math.round(20 * mS));
    const scoreBase = U.y0 + 36 + fs, clockBase = scoreBase + Math.round(26 * mS);
    hud.topH = Math.max(ub + 12, clockBase + 12 - U.y0);
    hud.think = R(lx, ty, uw, ub);
    const pw0 = Math.max(ps, Math.min(uw, ub + 20));
    hud.pause = R(rx - pw0, ty, pw0, ub);
    hud.score = { tall: false, cx: w / 2, y: scoreBase, clockY: clockBase, fs, clockFs, left: hud.think.x + hud.think.w + 12, right: hud.pause.x - 12, roleY: ty + ub + Math.max(minf, 18) + 6 };
    hud.zone = R(U.x0, Math.max(U.y0 + hud.topH + 40, yb - 420), Math.min(560, Math.round(w * 0.34)), 0); hud.zone.h = yb - hud.zone.y;
    hud.fade = { y0: yb - 300, y1: h };
    hud.msgY = yb - 16;
    hud.bannerY = U.y0 + hud.topH + 70;
    hud.promptTop = U.y0 + hud.topH + 10;
    hud.fit = { x0: U.x0 + 8, x1: U.x1 - 8, y0: U.y0 + hud.topH + 4, y1: yb - 8 };
    // Watch & Learn: a 2 x 2 block of buttons bottom-right, the message panel to its left
    const bw2 = clamp(Math.round((U.w * 0.26 - 10) / 2), 130, 230), gx = 10, bx1 = U.x1 - 14 - bw2, bx0 = bx1 - gx - bw2, by1 = yb - 14 - ub, by0 = by1 - 10 - ub;
    // buttons keep the tall order [Pause, T-, T+, Stop watching]: Pause | Stop on the top row, T- | T+ below
    hud.watch = { btns: [R(bx0, by0, bw2, ub), R(bx0, by1, bw2, ub), R(bx1, by1, bw2, ub), R(bx1, by0, bw2, ub)], labelX: (bx0 + bx1 + bw2) / 2, labelY: by0 - 10, fadeY: by0 - 50 };
    hud.watchPanel = { x: U.x0 + 16, w: bx0 - 14 - (U.x0 + 16), bottom: yb - 14, wide: true, maxH: Math.round(h * 0.4) };
    hud.watchFit = { x0: U.x0 + 8, x1: U.x1 - 8, y0: hud.fit.y0, y1: yb - 14 - Math.max(ub * 2 + 10, 190) - 8 };
  }
  // Think modal and coach banners
  const tw = land ? Math.min(U.w - 60, 900) : U.w - 60;
  hud.thinkBox = { x: Math.round(U.x0 + (U.w - tw) / 2), w: tw };
  hud.coach = { x: Math.round(U.x0 + 24), w: U.w - 48 };

  // ---- flow screens (title, setup, settings, learn, result, pause ...): one scrolling column, two or three columns on landscape ------
  const colW = land ? clamp(Math.round(U.w * 0.46), 560, 760) : U.w - 80;
  L.flow = { x: Math.round(U.x0 + (U.w - colW) / 2), w: colW, top: U.y0, bottom: U.y1 };
  const c2 = clamp(Math.round((U.w - 100) / 2), 300, 520), gap2 = clamp(U.w - 2 * c2 - 80, 24, 70);
  const cx0 = Math.round(U.x0 + (U.w - 2 * c2 - gap2) / 2);
  L.cols = land ? [{ x: cx0, w: c2 }, { x: cx0 + c2 + gap2, w: c2 }] : null;
  { const c3 = clamp(Math.round((U.w - 120) / 3), 300, 440), g3 = 30, x3 = Math.round(U.x0 + (U.w - 3 * c3 - 2 * g3) / 2); L.cols3 = land && U.w >= 1300 ? [0, 1, 2].map((i) => ({ x: x3 + i * (c3 + g3), w: c3 })) : null; }
  // title: hero art on the left, the buttons on the right (landscape); stacked (portrait)
  if (land && U.w >= 900) {
    const cw = clamp(Math.round(U.w * 0.4), 520, 680), cx = U.x1 - cw - Math.max(40, U.w * 0.06);
    L.title = { wide: true, col: { x: cx, w: cw, top: U.y0, bottom: U.y1 - 120 }, hero: { cx: U.x0 + (cx - U.x0) / 2, cy: U.y0 + (U.h - 70) / 2, w: cx - U.x0 - 30 } };
    const lw = Math.min(360, Math.round((cx - U.x0) * 0.62));
    L.lockup = { w: lw, h: Math.round(lw * 327 / 1200), x: L.title.hero.cx - lw / 2 }; L.lockup.y = U.y1 - 18 - L.lockup.h;
  } else {
    const off = land ? 0 : Math.round(Math.max(0, h - 1280) * 0.3);
    L.title = { wide: false, col: { x: Math.round(U.x0 + 40), w: U.w - 80, top: U.y0 + off * 0.5, bottom: U.y1 - 124 } };
    L.lockup = { w: 340, h: Math.round(340 * 327 / 1200), x: (w - 340) / 2 }; L.lockup.y = U.y1 - 16 - L.lockup.h;
  }
  // setup: the column scrolls above two pinned buttons
  if (!land) {
    L.setup = { bottom: yb - 150, start: R(U.x0 + 30, yb - 124, U.w - 60 - 204 - 16, 96), back: R(U.x1 - 30 - 204, yb - 124, 204, 96) };
  } else {
    const bw = Math.min(520, U.w - 120), sw = Math.round(bw * 0.68), bh = Math.max(minb, 84);
    const x0 = Math.round(U.x0 + (U.w - bw) / 2);
    L.setup = { bottom: yb - bh - 24, start: R(x0, yb - bh - 10, sw, bh), back: R(x0 + sw + 14, yb - bh - 10, bw - sw - 14, bh) };
  }
  L.setup.msgY = L.setup.bottom - 8;

  // ---- the reader (About / How to Play / Rules / role guide): one scrolling panel ---------------------------------------------------
  const rd = L.reader = {};
  if (!land) {
    const top = U.y0;
    rd.dec = R(U.x0 + 20, top + 10, Math.max(120, minb * 1.5), Math.max(60, minb)); rd.inc = R(U.x1 - 20 - rd.dec.w, top + 10, rd.dec.w, rd.dec.h);
    if (ins.back) rd.dec.x = Math.max(rd.dec.x, backRight);
    rd.pct = { x: w / 2, y: top + 10 + rd.dec.h / 2 + 8 };
    const bb = Math.max(100, minb), by = yb - 16 - bb, half = (U.w - 56) / 2, py = top + Math.max(100, rd.dec.h + 20);
    rd.back = R(U.x0 + 20, by, half, bb); rd.next = R(U.x0 + 36 + half, by, half, bb);
    rd.panel = R(U.x0 + 34, py, U.w - 68, by - 16 - py);
  } else {
    const sideW = clamp(Math.round(U.w * 0.17), 220, 300), gap = 16;
    const panelW = Math.min(920, U.w - 40 - sideW - gap), total = panelW + gap + sideW, gx = Math.round(U.x0 + (U.w - total) / 2);
    const top = U.y0 + 10, bot = yb - 10;
    rd.panel = R(gx, top, panelW, bot - top);
    const sx = gx + panelW + gap, half = (sideW - 8) / 2, bh = Math.max(minb, 70);
    rd.pct = { x: sx + sideW / 2, y: top + 24 };
    rd.dec = R(sx, top + 52, half, bh); rd.inc = R(sx + half + 8, top + 52, half, bh);
    rd.next = R(sx, bot - bh, sideW, bh); rd.back = R(sx, bot - 2 * bh - 12, sideW, bh);
    rd.side = true;
  }
  rd.header = 96;
  rd.box = R(rd.panel.x + 12, rd.panel.y + rd.header, rd.panel.w - 24, rd.panel.h - rd.header - 16);

  // ---- modal panels: pause ------------------------------------------------------------------------------------------------------------
  const pw = land ? Math.min(U.w - 80, 1000) : U.w - 60;
  L.pause = { x: Math.round(U.x0 + (U.w - pw) / 2), w: pw, top: U.y0 + 30, bottom: U.y1 - 30, cols: land && pw >= 760 };
  L.more = { x: w / 2, y: U.y1 - 22 };
  return L;
}

// the camera fit rectangle for the play screen: 'play' | 'watch'
export function fitFor(L, kind) { return kind === 'watch' ? L.hud.watchFit : L.hud.fit; }

// Every control rectangle of a play state, for overlap / safe-area checks (tests and the screenshot matrix). Returns a list of problems.
export function layoutProblems(L, kind = 'play') {
  const out = [], U = L.U, hud = L.hud;
  const circ = (c) => ({ c: true, x: c.x, y: c.y, r: c.r });
  const bbox = (s) => (s.c ? { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 } : s);
  const inside = (name, s) => { const r = bbox(s); if (r.x < U.x0 - 0.5 || r.y < U.y0 - 0.5 || r.x + r.w > U.x1 + 0.5 || r.y + r.h > U.y1 + 0.5) out.push(`${name} outside the safe area`); };
  const near = (rc, p) => ({ x: Math.max(rc.x, Math.min(rc.x + rc.w, p.x)), y: Math.max(rc.y, Math.min(rc.y + rc.h, p.y)) });
  const hit = (a, b) => {
    if (a.c && b.c) return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
    if (a.c || b.c) { const c = a.c ? a : b, rc = a.c ? b : a, q = near(rc, c); return Math.hypot(q.x - c.x, q.y - c.y) < c.r; }
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  };
  const items = [];
  if (kind === 'play') {
    hud.btns.forEach((b, i) => items.push([`btn${i}`, circ(b)]));
    items.push(['sprint', circ(hud.sprint)], ['stick', circ(hud.stick)], ['pause', hud.pause], ['think', hud.think]);
  } else hud.watch.btns.forEach((r, i) => items.push([`watch${i}`, r]));
  for (const [n, r] of items) { inside(n, r); if (!r.c && r.h < L.minb - 2) out.push(`${n} too short (${Math.round(r.h)} < ${L.minb})`); }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (hit(items[i][1], items[j][1])) out.push(`${items[i][0]} overlaps ${items[j][0]}`);
  if (L.ins.back) for (const [n, r] of items) if (hit(r, { ...L.backBox })) out.push(`${n} covers the host back button`);
  return out;
}
