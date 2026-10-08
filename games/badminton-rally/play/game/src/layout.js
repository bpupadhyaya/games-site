// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the SHORT side is always 720 virtual units, the long side
// grows with the aspect ratio). `layoutFor(w, h, textIdx)` returns every rectangle for that size, cached by size + insets + text size,
// so game.js (hit-testing), hud.js / menus.js (drawing), the camera framing and the tests never disagree.
//   portrait ('B' camera): score cards on top, Think / Pause row, the court framed in the middle, the stroke guide strip at the bottom.
//   landscape ('S' camera): a slim top bar (Think | scores | Pause), the court fills the screen below it, the guide strip along the bottom;
//                           on very wide screens the guide moves to a side panel and a match card fills the other side.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y, extra = 0) => !!c && Math.hypot(x - c.x, y - c.y) <= c.r + extra;

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
  const m = PLAY_M[ti], s = 1 + 0.15 * (m - 1);
  const px = ins.px || 0.54;
  const minf = clamp(Math.ceil(11 / px), 11, 36);
  const minb = clamp(Math.round(44 / px), 60, 100);
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const L = { w, h, land, mode, cam: land ? 'S' : 'B', ti, m, s, px, minf, minb, U, ins, backBox };

  // ---- in-play HUD --------------------------------------------------------------------------------------------------------------------
  const hud = L.hud = { idx: ti, m, s, mode, minf, minb };
  const backRight = ins.back ? backBox.x + backBox.w + 4 : 0;
  const mS = Math.min(m, 1.5);
  if (!land) {
    const sq = clamp((w / h - 0.55) / 0.25, 0, 1), sh = 1 - 0.22 * sq;      // squarish portrait (iPad): a slimmer HUD
    const topH = Math.round((22 + 80 * m) * sh) + (m > 1.4 ? 14 : 0);
    const uh = Math.max(minb, Math.round((54 + 14 * (m - 1)) * sh)), uw = Math.round((150 + 40 * (m - 1)) * sh);
    hud.top = U.y0; hud.topH = topH;
    hud.util = { think: R(U.x0 + 14, U.y0 + topH + 4, uw, uh), pause: R(U.x1 - 14 - uw, U.y0 + topH + 4, uw, uh) };
    hud.promptY = hud.util.think.y + hud.util.think.h + 6; hud.promptW = U.w - 60; hud.promptX = U.x0 + 30;
    const l0 = Math.max(U.x0 + 14, backRight);
    hud.score = { tall: true, left: l0, right: U.x1 - 14, colw: Math.min(250, (U.w / 2) - 80 - (l0 - U.x0)) };
    hud.zones = { scoreL: R(hud.score.left, U.y0, hud.score.colw, topH), scoreC: R(W / 2 - 75, U.y0 + 36, 150, topH - 36), scoreR: R(hud.score.right - hud.score.colw, U.y0, hud.score.colw, topH) };
    const gh = Math.round(168 * sh * (1 + 0.28 * (m - 1)));
    hud.guide = R(U.x0 + 10, U.y1 - gh - 10, U.w - 20, gh);
    hud.bannerY = Math.round(hud.promptY + 130);
    const promptH = Math.round(22 * Math.min(m, 1.6) * 1.25 + 16);
    hud.fit = { x0: U.x0 + 4, x1: U.x1 - 4, y0: hud.promptY + promptH + 4, y1: hud.guide.y - 6 };
    // Watch & Learn: the message panel above a row (two rows at large text) of four buttons, in the guide strip's place
    const bh = uh, big = m >= 1.5, avail = U.w - 28;
    const y2 = U.y1 - 14 - bh, y1 = y2 - bh - 10;
    let btns;
    if (big) { const cw = (avail - 2) / 2; btns = [R(U.x0 + 14, y1, cw, bh), R(U.x0 + 14 + cw + 2, y1, cw, bh), R(U.x0 + 14, y2, cw, bh), R(U.x0 + 14 + cw + 2, y2, cw, bh)]; }
    else { const ws = [170, 170, 170, 152], tot = ws.reduce((a, b) => a + b, 0) + 30, k = avail / tot; let x = U.x0 + 14; btns = ws.map((wv) => { const r = R(x, y2, wv * k, bh); x += wv * k + 10 * k; return r; }); }
    hud.watch = { btns, panelX: U.x0 + 20, panelW: U.w - 40, panelBottom: (big ? y1 : y2) - 8, maxH: Math.round(h * 0.3) };
    hud.watchFit = { x0: U.x0 + 4, x1: U.x1 - 4, y0: hud.fit.y0, y1: hud.watch.panelBottom - Math.min(hud.watch.maxH, 120) - 6 };
  } else {
    const ub = Math.max(minb, Math.round(56 * mS)), bh = Math.max(ub + 6, Math.round(34 + 0.8 * 34 * mS + Math.max(minf, 16 * mS) * 1.25 + 14));
    const ty = U.y0 + 6, uw = clamp(Math.round(118 * mS), 118, 170);
    const lx = Math.max(U.x0 + 12, backRight), rx = U.x1 - 12;
    hud.top = ty; hud.topH = bh; hud.barBottom = ty + bh;
    hud.util = { think: R(lx, ty, uw, ub), pause: R(rx - uw, ty, uw, ub) };
    const A0 = lx + uw + 12, A1 = rx - uw - 12, A = A1 - A0;
    let k = 1; const need = (190 + 170 + 190) * mS + 24;
    if (need > A) k = Math.max(0.6, A / need);
    const cw = 170 * mS * k, bw = 190 * mS * k, cx = (A0 + A1) / 2;
    hud.score = { tall: false, k: mS * k, cx, cw, bw, left: cx - cw / 2 - 12 - bw, right: cx + cw / 2 + 12 + bw, y: ty, h: bh };
    hud.zones = { scoreL: R(hud.score.left, ty, bw, bh), scoreC: R(cx - cw / 2, ty + 30, cw, bh - 30), scoreR: R(hud.score.right - bw, ty, bw, bh) };
    hud.promptY = hud.barBottom + 8; hud.promptW = Math.min(U.w - 60, 900); hud.promptX = (w - hud.promptW) / 2;
    hud.bannerY = Math.round(h * 0.42);
    // very wide screens (tablets in landscape, phones at 2:1 and more): the guide becomes a side panel and a match card fills the other side
    const gh = Math.round(112 * (1 + 0.3 * (m - 1)));
    const courtH = h - hud.barBottom - 20;
    const courtWneeded = courtH * 2.0;
    const spare = U.w - courtWneeded;
    if (spare >= 2 * 220 && m <= 1.5) {
      const pw = clamp(Math.floor((spare - 10) / 2), 220, 360);
      hud.side = { left: R(U.x0 + 6, hud.barBottom + 10, pw, U.y1 - hud.barBottom - 16), right: R(U.x1 - 6 - pw, hud.barBottom + 10, pw, U.y1 - hud.barBottom - 16) };
      hud.guide = null; hud.guideSide = hud.side.right;
      hud.fit = { x0: hud.side.left.x + pw + 6, x1: hud.side.right.x - 6, y0: hud.barBottom + 6, y1: U.y1 - 8 };
    } else {
      hud.guide = R(Math.max(U.x0 + 10, (w - Math.min(U.w - 20, 1000)) / 2), U.y1 - gh - 6, Math.min(U.w - 20, 1000), gh);
      hud.fit = { x0: U.x0 + 6, x1: U.x1 - 6, y0: hud.barBottom + 6, y1: hud.guide.y - 4 };
    }
    // Watch & Learn: a 2 x 2 button block bottom-right, the message panel to its left
    const bw2 = Math.min(200, Math.max(120, (U.w * 0.24 - 10) / 2)), gx = 10;
    const bx1 = U.x1 - 14 - bw2, bx0 = bx1 - gx - bw2, by1 = U.y1 - 12 - ub, by0 = by1 - 10 - ub;
    hud.watch = { btns: [R(bx0, by0, bw2, ub), R(bx1, by0, bw2, ub), R(bx0, by1, bw2, ub), R(bx1, by1, bw2, ub)], panelX: U.x0 + 16, panelW: bx0 - 12 - (U.x0 + 16), panelBottom: U.y1 - 12, maxH: ub * 2 + 10, wide: true };
    hud.watchFit = { x0: U.x0 + 6, x1: U.x1 - 6, y0: hud.barBottom + 6, y1: U.y1 - 12 - (ub * 2 + 10) - 10 };
    if (hud.side) hud.watchFit = hud.fit;
  }

  // ---- flow screens (title, setup, settings, result, pause ...) ----------------------------------------------------------------------
  const colW = land ? clamp(Math.round(U.w * 0.46), 560, 760) : U.w - 80;
  L.flow = { x: Math.round(U.x0 + (U.w - colW) / 2), w: colW, top: U.y0, bottom: U.y1 };
  const c2 = clamp(Math.round((U.w - 100) / 2), 300, 520), gap2 = clamp(U.w - 2 * c2 - 80, 24, 70);
  const cx0 = Math.round(U.x0 + (U.w - 2 * c2 - gap2) / 2);
  L.cols = land ? [{ x: cx0, w: c2 }, { x: cx0 + c2 + gap2, w: c2 }] : null;
  { const c3 = clamp(Math.round((U.w - 120) / 3), 300, 440), g3 = 30, x3 = Math.round(U.x0 + (U.w - 3 * c3 - 2 * g3) / 2); L.cols3 = land && U.w >= 1300 ? [0, 1, 2].map((i) => ({ x: x3 + i * (c3 + g3), w: c3 })) : null; }
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
  if (!land) {
    L.setup = { bottom: U.y1 - 150, start: R(U.x0 + 30, U.y1 - 124, U.w - 60 - 204 - 16, 96), back: R(U.x1 - 30 - 204, U.y1 - 124, 204, 96) };
  } else {
    const bw = Math.min(520, U.w - 120), sw = Math.round(bw * 0.68), bh = Math.max(minb, 84);
    const x0 = Math.round(U.x0 + (U.w - bw) / 2);
    L.setup = { bottom: U.y1 - bh - 24, start: R(x0, U.y1 - bh - 10, sw, bh), back: R(x0 + sw + 14, U.y1 - bh - 10, bw - sw - 14, bh) };
  }
  L.setup.msgY = L.setup.bottom - 8;

  // ---- the reader (About / How to Play / Rules) --------------------------------------------------------------------------------------
  const rd = L.reader = {};
  if (!land) {
    const top = U.y0;
    rd.dec = R(U.x0 + 20, top + 10, Math.max(120, minb * 1.5), Math.max(60, minb)); rd.inc = R(U.x1 - 20 - rd.dec.w, top + 10, rd.dec.w, rd.dec.h);
    rd.pct = { x: w / 2, y: top + 10 + rd.dec.h / 2 + 8 };
    const bb = Math.max(100, minb), by = U.y1 - 16 - bb, half = (U.w - 56) / 2, py = top + Math.max(100, rd.dec.h + 20);
    rd.back = R(U.x0 + 20, by, half, bb); rd.next = R(U.x0 + 36 + half, by, half, bb);
    rd.panel = R(U.x0 + 34, py, U.w - 68, by - 16 - py);
  } else {
    const sideW = clamp(Math.round(U.w * 0.17), 220, 300), gap = 16;
    const panelW = Math.min(920, U.w - 40 - sideW - gap), total = panelW + gap + sideW, gx = Math.round(U.x0 + (U.w - total) / 2);
    const top = U.y0 + 10, bot = U.y1 - 10;
    rd.panel = R(gx, top, panelW, bot - top);
    const sx = gx + panelW + gap, half = (sideW - 8) / 2, bh = Math.max(minb, 70);
    rd.pct = { x: sx + sideW / 2, y: top + 24 };
    rd.dec = R(sx, top + 52, half, bh); rd.inc = R(sx + half + 8, top + 52, half, bh);
    rd.next = R(sx, bot - bh, sideW, bh); rd.back = R(sx, bot - 2 * bh - 12, sideW, bh);
    rd.side = true;
  }
  rd.header = 96;
  rd.box = R(rd.panel.x + 12, rd.panel.y + rd.header, rd.panel.w - 24, rd.panel.h - rd.header - Math.max(minf, 22) - 34);

  const pw = land ? Math.min(U.w - 80, 1000) : U.w - 60;
  L.pause = { x: Math.round(U.x0 + (U.w - pw) / 2), w: pw, top: U.y0 + 30, bottom: U.y1 - 30, cols: land && pw >= 760 };
  const tw = land ? Math.min(U.w - 60, 900) : U.w - 60;
  L.think = { x: Math.round(U.x0 + (U.w - tw) / 2), w: tw, row: land };
  L.more = { x: w / 2, y: U.y1 - 22 };
  return L;
}

export function fitFor(L, kind) { return kind === 'watch' ? L.hud.watchFit : L.hud.fit; }
