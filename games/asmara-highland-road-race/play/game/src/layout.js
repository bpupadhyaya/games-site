// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe-area key, so game.js (hit-testing) and
// the drawing modules never disagree and a frame never recomputes it.
//
//   portrait (narrower than 1.25:1): profile strip, road view, three rider cards, effort buttons, utility row
//   wide (landscape): profile strip across the top, road view left, a column of cards / effort / utility on the right
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const wide = w >= h * 1.25;
  const L = { w, h, wide, mode: wide ? 'wide' : 'portrait', ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const liftB = Math.max(0, ins.b - 6);
  const sb = L.sb = h - liftB;                    // bottom of the content area
  const minH = Math.ceil(46 / Math.max(0.2, ins.px || 0.6));   // a 46 css px tap target

  const P = L.play = {};
  const pad = 14, g = 10;
  const lx = ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l, rxm = 14 + ins.r;
  if (!wide) {
    const topH = 150;
    P.top = R(lx, ins.t + 6, w - lx - rxm, topH);
    const avail = sb - (P.top.y + topH);
    const effH = clamp(Math.round(avail * 0.085), Math.max(minH, 78), 104), cardH = clamp(Math.round(avail * 0.1), 100, 128), utH = clamp(Math.round(avail * 0.06), Math.max(minH, 62), 80);
    const y3 = sb - utH - 6, y2 = y3 - g - effH, y1 = y2 - g - cardH;
    P.util = R(pad, y3, w - 2 * pad, utH);
    P.effort = R(pad, y2, w - 2 * pad, effH);
    P.cardsRow = R(pad, y1, w - 2 * pad, cardH);
    P.road = R(0, P.top.y + topH + 4, w, y1 - g - (P.top.y + topH + 4));
    const cw = (w - 2 * pad - 2 * g) / 3;
    P.cards = [0, 1, 2].map((i) => R(pad + i * (cw + g), y1, cw, cardH));
    const ew = (w - 2 * pad - 3 * g) / 4;
    P.eff = [0, 1, 2, 3].map((i) => R(pad + i * (ew + g), y2, ew, effH));
    const uw = (w - 2 * pad - 3 * g) / 4;
    P.utilBtn = { pause: R(pad, y3, uw, utH), speed: R(pad + uw + g, y3, uw, utH), hint: R(pad + 2 * (uw + g), y3, uw, utH), menu: R(pad + 3 * (uw + g), y3, uw, utH) };
    const dw = Math.round((w - 2 * pad - 2 * g) * 0.28);
    P.demo = { dec: R(pad, y3, dw, utH), pause: R(pad + dw + g, y3, w - 2 * pad - 2 * dw - 2 * g, utH), inc: R(w - pad - dw, y3, dw, utH), exit: R(pad, y2, w - 2 * pad, effH) };
    P.explain = R(pad, y2 - 4, w - 2 * pad, effH + 4);
    P.demoExit = R(w - pad - 130, P.road.y + 8, 130, minH);
  } else {
    const topH = 112;
    P.top = R(lx, ins.t + 4, w - lx - rxm, topH);
    const rc = clamp(Math.round(w * 0.34), 330, 500);
    const top = P.top.y + topH + 4, avail = sb - top - 6;
    const unit = clamp((avail - 5 * g) / 5.6, 56, 104);
    const cardH = unit, effH = Math.round(unit * 0.92), utH = Math.max(minH, Math.round(unit * 0.8));
    const cx = w - rxm - rc;
    const y1 = top;
    P.cards = [0, 1, 2].map((i) => R(cx, y1 + i * (cardH + g), rc, cardH));
    const ye = y1 + 3 * (cardH + g);
    const ew = (rc - g) / 2;
    P.eff = [0, 1, 2, 3].map((i) => R(cx + (i % 2) * (ew + g), ye + Math.floor(i / 2) * (effH + g), ew, effH));
    const yu = ye + 2 * (effH + g);
    const uw = (rc - 3 * g) / 4;
    P.utilBtn = { pause: R(cx, yu, uw, utH), speed: R(cx + uw + g, yu, uw, utH), hint: R(cx + 2 * (uw + g), yu, uw, utH), menu: R(cx + 3 * (uw + g), yu, uw, utH) };
    P.effort = R(cx, ye, rc, 2 * effH + g);
    P.util = R(cx, yu, rc, utH);
    P.road = R(ins.l + 8, top, cx - g - ins.l - 8, sb - top - 4);
    const dw = Math.round((rc - 2 * g) * 0.28);
    P.demo = { dec: R(cx, yu, dw, utH), pause: R(cx + dw + g, yu, rc - 2 * dw - 2 * g, utH), inc: R(cx + rc - dw, yu, dw, utH), exit: R(cx, ye + effH + g, rc, effH) };
    P.explain = R(cx, ye, rc, effH);
    P.demoExit = R(P.road.x + P.road.w - 134, P.road.y + 8, 130, minH);
  }
  P.toast = { x: P.road.x + P.road.w / 2, y: P.road.y + P.road.h * 0.2, maxW: Math.min(620, P.road.w - 30) };
  P.pill = { x: P.road.x + P.road.w / 2, y: P.road.y + 34 };

  // ---- setup pins / reference pages (same shapes as the other Arcforge games) -----------------------------------------
  const su = L.setup = {};
  if (!wide) {
    const k = (w - 76) / 644, sw = Math.round(440 * k), cw = Math.min(640, w - 80);
    L.pins = { start: R(30, sb - 124, sw, 96), back: R(30 + sw + 16, sb - 124, w - 30 - (30 + sw + 16), 96) };
    su.cols = [{ x: (w - cw) / 2, w: cw, top: ins.t, bottom: L.pins.start.y - 26 }];
  } else {
    const tw = Math.min(1320, w - 2 * (Math.max(ins.l, ins.r) + 16)), cw = (tw - 24) / 2, x0 = (w - tw) / 2, top = Math.max(ins.t, 0) + 18, bot = sb - 8;
    const x2 = x0 + cw + 24, ph = 84;
    L.pins = { start: R(x2, bot - 2 * ph - 12, cw, ph), back: R(x2, bot - ph, cw, ph) };
    su.cols = [{ x: x0, w: cw, top, bottom: bot }, { x: x2, w: cw, top, bottom: L.pins.start.y - 12 }];
  }
  const ref = L.ref = {};
  if (!wide) {
    const py = Math.max(100, ins.t + (ins.back ? backSz + 12 : 24)), navY = sb - 116, mx = 34 + Math.max(0, ins.l - 14, ins.r - 14);
    ref.panel = R(mx, py, w - 2 * mx, navY - 34 - py);
    const bw = (w - 56) / 2;
    ref.back = R(20, navY, bw, 100); ref.next = R(20 + bw + 16, navY, bw, 100);
  } else {
    const mx = Math.max(ins.l, ins.r, 0) + (ins.back ? backSz + 14 : 18), py = Math.max(ins.t, 0) + 14, nh = 72, navY = sb - 14 - nh;
    ref.panel = R(mx, py, w - 2 * mx, navY - 12 - py);
    const bw = Math.min(300, (ref.panel.w - 16) / 2);
    ref.back = R(ref.panel.x, navY, bw, nh); ref.next = R(ref.panel.x + ref.panel.w - bw, navY, bw, nh);
  }
  ref.dec = R(ref.panel.x + 12, ref.panel.y + 6, 96, 68); ref.inc = R(ref.panel.x + ref.panel.w - 108, ref.panel.y + 6, 96, 68);
  return L;
}
