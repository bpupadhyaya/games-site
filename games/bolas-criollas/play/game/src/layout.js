// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe-area key, so game.js (hit-testing) and
// view.js / menus.js (drawing) never disagree.
//
//   portrait  (narrower than 1.25:1): score cards on top, the loupe (close-up of the mingo), the whole-cancha strip, the swing meter
//                                     and one control block at the bottom.
//   wide      (landscape): left column = score cards, the whole-cancha strip, the swing meter; right column = loupe and controls.
import { v3 } from './v3.js';
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
  const key = `${v3.on ? '3|' : ''}${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
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
  const pad = 14, g = 10;
  if (!wide) {
    const lx = ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l, rx = 14 + ins.r;
    const rowH = Math.max(minH, 84), swingH = Math.max(minH, 100), meterH = 86;
    const barH = rowH + swingH + meterH + 4 * g;
    const bar = sb - barH, hy = ins.t + 8, ch = 92;
    const infoW = 150, cwL = Math.floor((w - lx - rx - infoW - 2 * g) / 2), cwR = cwL;
    P.cards = [R(lx, hy, cwL, ch), R(w - rx - cwR, hy, cwR, ch)];
    P.info = { x: w / 2, y: hy + 40, y2: hy + 68 };
    const top = hy + ch + 10, avail = bar - 6 - top;
    const stripH = v3.on ? clamp(Math.round(avail * 0.27), 150, 260) : clamp(Math.round(avail * 0.44), 210, 470);
    P.loupe = R(pad + ins.l, top, w - 2 * pad - ins.l - ins.r, Math.max(120, avail - stripH - 8));
    P.strip = R(pad + ins.l, P.loupe.y + P.loupe.h + 8, w - 2 * pad - ins.l - ins.r, stripH);
    P.meter = R(pad + ins.l, bar + g, w - 2 * pad - ins.l - ins.r, meterH);
    const y1 = P.meter.y + meterH + g, tw = (w - 2 * pad - ins.l - ins.r - 2 * g) / 3;
    P.styles = [0, 1, 2].map((i) => R(pad + ins.l + i * (tw + g), y1, tw, rowH));
    const y2 = y1 + rowH + g, inner = w - 2 * pad - ins.l - ins.r, hw = Math.round(inner * 0.22);
    P.hint = R(pad + ins.l, y2, hw, swingH); P.swing = R(pad + ins.l + hw + g, y2, inner - 2 * hw - 2 * g, swingH); P.menu = R(pad + ins.l + inner - hw, y2, hw, swingH);
    P.demo = { dec: R(P.styles[0].x, y1, tw, rowH), pause: R(P.styles[1].x, y1, tw, rowH), inc: R(P.styles[2].x, y1, tw, rowH), exit: R(pad + ins.l, y2, inner, swingH) };
    P.toast = { x: w / 2, y: P.loupe.y + 54, maxW: Math.min(640, w - 40) };
    P.explain = R(P.loupe.x + 8, P.loupe.y + 8, P.loupe.w - 16, 0);
    P.score = R(w / 2 - Math.min(330, (w - 40) / 2), top + 10, Math.min(660, w - 40), Math.min(avail + stripH, sb - top - 20));
  } else {
    const lx = ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l, rx = 14 + ins.r;
    const total = w - lx - rx, leftW = Math.round(total * 0.6), colGap = 14, rightW = total - leftW - colGap;
    const rowH = Math.max(minH, 78), swingH = Math.max(minH, 96), meterH = 84, hy = ins.t + 8, ch = 84;
    const infoW = 140, cw = Math.floor((leftW - infoW - 2 * g) / 2);
    P.cards = [R(lx, hy, cw, ch), R(lx + leftW - cw, hy, cw, ch)];
    P.info = { x: lx + leftW / 2, y: hy + 36, y2: hy + 62 };
    const stripTop = hy + ch + 10, meterTop = sb - 8 - meterH;
    P.strip = R(lx, stripTop, leftW, meterTop - 8 - stripTop);
    P.meter = R(lx, meterTop, leftW, meterH);
    const rxx = lx + leftW + colGap;
    const ctlH = rowH + swingH + 2 * g;
    P.loupe = R(rxx, hy, rightW, Math.max(140, sb - 8 - ctlH - hy - g));
    const y1 = P.loupe.y + P.loupe.h + g, tw = (rightW - 2 * g) / 3;
    P.styles = [0, 1, 2].map((i) => R(rxx + i * (tw + g), y1, tw, rowH));
    const y2 = y1 + rowH + g, hw = Math.round(rightW * 0.22);
    P.hint = R(rxx, y2, hw, swingH); P.swing = R(rxx + hw + g, y2, rightW - 2 * hw - 2 * g, swingH); P.menu = R(rxx + rightW - hw, y2, hw, swingH);
    P.demo = { dec: R(P.styles[0].x, y1, tw, rowH), pause: R(P.styles[1].x, y1, tw, rowH), inc: R(P.styles[2].x, y1, tw, rowH), exit: R(rxx, y2, rightW, swingH) };
    P.toast = { x: rxx + rightW / 2, y: P.loupe.y + 54, maxW: Math.min(560, rightW - 24) };
    P.explain = R(P.loupe.x + 8, P.loupe.y + 8, P.loupe.w - 16, 0);
    const pw = clamp(w * 0.6, 460, 720), ph = Math.min(sb - 24 - ins.t, 580);
    P.score = R(w / 2 - pw / 2, ins.t + 12, pw, ph);
  }

  // the closest the loupe may zoom: the sand fills the panel
  P.loupeHalf = clamp(0.62 * P.loupe.w / (2 * ((P.loupe.h * 0.7) / 2.55)), 1.15, 2.1);

  // ---- setup pins and reference pages -----------------------------------------------------------------------------------
  const su = (L.setup = {});
  if (!wide) {
    const sw = Math.round((w - 60) * 0.62), cw = Math.min(640, w - 80);
    L.pins = { start: R(30, sb - 124, sw, 96), back: R(30 + sw + 16, sb - 124, w - 30 - (30 + sw + 16), 96) };
    su.cols = [{ x: (w - cw) / 2, w: cw, top: ins.t + 18, bottom: L.pins.start.y - 26 }];
  } else {
    const tw = Math.min(1320, w - 2 * (Math.max(ins.l, ins.r) + 16)), cw = (tw - 48) / 3, x0 = (w - tw) / 2, top = Math.max(ins.t, 0) + 18, bot = sb - 8;
    const x3 = x0 + 2 * (cw + 24), ph = 84;
    L.pins = { start: R(x3, bot - 2 * ph - 12, cw, ph), back: R(x3, bot - ph, cw, ph) };
    su.cols = [{ x: x0, w: cw, top, bottom: bot }, { x: x0 + cw + 24, w: cw, top, bottom: bot }, { x: x3, w: cw, top, bottom: L.pins.start.y - 12 }];
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
