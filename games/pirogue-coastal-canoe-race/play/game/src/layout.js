// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe-area key, so game.js (hit-testing) and
// view.js / menus.js (drawing) never disagree.
//
//   The sea fills the whole screen with the boat low in the picture and "ahead" always up. Tap the left half of the screen to
//   paddle on the left, the right half to paddle on the right. The HUD is a thin strip on top (map, time, pause, hint), the
//   rhythm rings on two pads along the bottom, and the heel gauge between them.
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
  const liftB = Math.max(0, ins.b - 6), sb = (L.sb = h - liftB);
  const minH = Math.ceil(46 / Math.max(0.2, ins.px || 0.6));    // a tap target of about 46 css px
  const P = (L.play = {});
  const g = 10;

  // ---- the play screen
  const lx = ins.back ? Math.max(12 + ins.l, L.backBox.x + L.backBox.w + 2) : 12 + ins.l, rx = 12 + ins.r;
  const top = ins.t + 8, bh = Math.max(minH, 64);
  P.pause = R(w - rx - bh * 1.5, top, bh * 1.5, bh);
  P.hint = R(P.pause.x - g - bh * 1.5, top, bh * 1.5, bh);
  P.map = R(lx, top, Math.max(160, P.hint.x - g - lx), bh);
  P.time = R(lx, top + bh + 8, 330, 58);
  const padH = clamp(Math.round(sb * (wide ? 0.2 : 0.13)), Math.max(minH + 30, 110), 150);
  const gw = clamp(Math.round(w * (wide ? 0.3 : 0.5)), 260, 440);
  if (wide) {
    const pw = Math.round(clamp(w * 0.22, 220, 360));
    P.padL = R(12 + ins.l, sb - padH - 12, pw, padH);
    P.padR = R(w - 12 - ins.r - pw, sb - padH - 12, pw, padH);
    P.gauge = R(w / 2 - gw / 2, sb - 12 - 34, gw, 34);
    P.pace = R(w / 2 - gw / 2, P.gauge.y - 46, gw, 36);
  } else {
    P.padL = R(12 + ins.l, sb - padH - 12, w / 2 - 12 - ins.l - 6, padH);
    P.padR = R(w / 2 + 6, sb - padH - 12, w / 2 - 12 - ins.r - 6, padH);
    P.gauge = R(w / 2 - gw / 2, P.padL.y - 50, gw, 34);
    P.pace = R(w / 2 - gw / 2, P.gauge.y - 46, gw, 36);
  }
  P.ppm = wide ? clamp(h / 31, 11, 34) : clamp(w / 32, 11, 34);
  P.anchor = { x: w / 2, y: Math.round(sb * (wide ? 0.6 : 0.64)) };
  P.toast = { x: w / 2, y: Math.round(P.anchor.y - sb * 0.3), maxW: Math.min(640, w - 40) };
  P.explain = R(w / 2 - Math.min(380, (w - 40) / 2), P.time.y + 70, Math.min(760, w - 40), 150);
  P.demo = { dec: P.padL, pause: R(P.hint.x, top, P.hint.w, bh), inc: P.padR, exit: R(P.pause.x, top, P.pause.w, bh) };
  P.score = R(w / 2 - Math.min(330, (w - 40) / 2), top + 80, Math.min(660, w - 40), sb - top - 120);

  // ---- setup pins and reference pages
  const su = (L.setup = {});
  if (!wide) {
    const sw = Math.round((w - 60) * 0.62), cw = Math.min(640, w - 80);
    L.pins = { start: R(30, sb - 124, sw, 96), back: R(30 + sw + 16, sb - 124, w - 30 - (30 + sw + 16), 96) };
    su.cols = [{ x: (w - cw) / 2, w: cw, top: ins.t + 14, bottom: L.pins.start.y - 26 }];
  } else {
    const tw = Math.min(1320, w - 2 * (Math.max(ins.l, ins.r) + 16)), cw = (tw - 48) / 3, x0 = (w - tw) / 2, topc = Math.max(ins.t, 0) + 18, bot = sb - 8;
    const x3 = x0 + 2 * (cw + 24), ph = 84;
    L.pins = { start: R(x3, bot - 2 * ph - 12, cw, ph), back: R(x3, bot - ph, cw, ph) };
    su.cols = [{ x: x0, w: cw, top: topc, bottom: bot }, { x: x0 + cw + 24, w: cw, top: topc, bottom: bot }, { x: x3, w: cw, top: topc, bottom: L.pins.start.y - 12 }];
  }
  const ref = (L.ref = {});
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
