// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe-area key, so game.js (hit-testing) and the
// drawing code never disagree. Two shapes: portrait (view over a control bar) and wide (view with the buttons in its corners).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const ASSIST = [0, 0.35, 0.6, 0.85];
export const ASSIST_NAMES = ['Off', 'Low', 'Medium', 'High'];
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
  const sb = L.sb = h - liftB;
  const minH = Math.ceil(46 / Math.max(0.2, ins.px || 0.6));

  const P = L.play = {};
  const lx = ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l, rx = 14 + ins.r;
  const hy = ins.t + 6, hudH = wide ? 62 : 88;
  P.hud = R(0, hy, w, hudH);
  // top row: time on the left, speed in the middle, position + menu buttons on the right (steering surface = view + bar)
  const bt = Math.max(minH, 64);
  P.menu = R(w - rx - bt, hy + (hudH - bt) / 2, bt, bt);
  P.hint = R(P.menu.x - bt - 10, P.menu.y, bt, bt);
  P.time = { x: lx, y: hy + hudH * 0.62, w: Math.max(140, w * 0.3) };
  P.speed = { x: wide ? w / 2 : w * 0.45, y: hy + hudH * 0.62 };
  P.pos = { x: P.hint.x - 14, y: hy + hudH * 0.62 };
  const stripH = wide ? 46 : 74;
  P.strip = R(lx, hy + hudH + 6, w - lx - rx, stripH);
  const viewTop = P.strip.y + stripH + 8;
  if (!wide) {
    const pad = 14, g = 12, bh = clamp(Math.round(sb * 0.15), Math.max(150, minH), 220);
    P.barTop = sb - bh - pad;
    P.steer = R(pad, P.barTop + 4, Math.round((w - 2 * pad - g) * 0.64), bh);
    P.brake = R(P.steer.x + P.steer.w + g, P.barTop + 4, w - pad - (P.steer.x + P.steer.w + g), bh);
    P.view = R(0, viewTop, w, P.barTop - viewTop - 4);
    const dw = Math.round((w - 2 * pad - 2 * g) * 0.3), rh = clamp(Math.round(bh * 0.46), Math.max(76, minH), 96);
    const r1 = sb - 2 * rh - 3 * 10, r2 = r1 + rh + 10, tw = (w - 2 * pad - 2 * g) / 3;
    P.demoTop = r1 - 8;
    P.demo = { dec: R(pad, r1, dw, rh), pause: R(pad + dw + g, r1, w - 2 * pad - 2 * dw - 2 * g, rh), inc: R(w - pad - dw, r1, dw, rh),
      rules: R(pad, r2, tw, rh), howto: R(pad + tw + g, r2, tw, rh), exit: R(pad + 2 * (tw + g), r2, tw, rh) };
    P.viewWatch = R(0, viewTop, w, P.demoTop - viewTop - 4);
  } else {
    // landscape: the scene takes the whole height; the tiller and the brake float over its bottom edge
    const g = 12, bh = clamp(Math.round(sb * 0.19), Math.max(78, minH), 110), bw = clamp(Math.round(w * 0.2), 190, 320);
    P.barTop = sb - bh - 10;
    P.brake = R(w - rx - bw, P.barTop, bw, bh);
    P.steer = R(lx, P.barTop + bh * 0.28, P.brake.x - g - lx, bh * 0.72);
    P.view = R(0, viewTop, w, sb - viewTop);
    const rh = Math.max(minH, 78), y1 = sb - rh - 10, q = (w - lx - rx - 4 * g) / 5;
    P.demoTop = y1 - 8;
    P.demo = { dec: R(lx, y1, q, rh), pause: R(lx + q + g, y1, q, rh), inc: R(lx + 2 * (q + g), y1, q, rh), rules: R(lx + 3 * (q + g), y1, q, rh), exit: R(lx + 4 * (q + g), y1, q, rh) };
    P.viewWatch = R(0, viewTop, w, P.demoTop - viewTop - 4);
  }
  P.toast = { x: w / 2, y: P.view.y + 60, maxW: Math.min(640, w - 40) };

  const su = L.setup = {};
  if (!wide) {
    const k = (w - 76) / 644, sw = Math.round(440 * k), cw = Math.min(640, w - 80);
    L.pins = { start: R(30, sb - 124, sw, 96), back: R(30 + sw + 16, sb - 124, w - 30 - (30 + sw + 16), 96) };
    su.cols = [{ x: (w - cw) / 2, w: cw, top: ins.t, bottom: L.pins.start.y - 26 }];
  } else {
    const tw = Math.min(1320, w - 2 * (Math.max(ins.l, ins.r) + 16)), cw = (tw - 48) / 3, x0 = (w - tw) / 2, top = Math.max(ins.t, 0) + 18, bot = sb - 8;
    const x3 = x0 + 2 * (cw + 24), ph = 84;
    L.pins = { start: R(x3, bot - 2 * ph - 12, cw, ph), back: R(x3, bot - ph, cw, ph) };
    su.cols = [{ x: x0, w: cw, top, bottom: bot }, { x: x0 + cw + 24, w: cw, top, bottom: bot }, { x: x3, w: cw, top, bottom: L.pins.start.y - 12 }];
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
