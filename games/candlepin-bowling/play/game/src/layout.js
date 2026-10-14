// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe-area key, so game.js (hit-testing) and
// view.js / menus.js (drawing) never disagree and a frame never recomputes it.
//
//   portrait (narrower than 1.25:1): score cards on top, the lane in the middle, three rows of controls at the bottom
//   wide (landscape): score cards on top, the lane in the middle with the deck map beside it, one row of controls below
import { aimPose, deckPose, lerpPose } from './cam.js';

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
  L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  const liftB = Math.max(0, ins.b - 6);
  const sb = L.sb = h - liftB;                    // bottom of the content area
  const minH = Math.ceil(46 / Math.max(0.2, ins.px || 0.6));   // a 46 css px tap target

  const P = L.play = {};
  const pad = 14, g = 10;
  const lx = ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l, rxm = 14 + ins.r;
  const gapC = Math.max(190, Math.round(112 / Math.max(0.2, ins.px || 0.6)));
  const hy = ins.t + (wide ? 8 : 10), ch = 92;
  const cap = wide ? clamp(Math.floor((w - lx - rxm - 300 - 28) / 2), 230, 340) : 330;
  const cwL = Math.min(cap, Math.floor(w / 2 - gapC / 2 - lx)), cwR = Math.min(cap, Math.floor(w / 2 - gapC / 2 - rxm));
  P.cards = [R(lx, hy, cwL, ch), R(w - rxm - cwR, hy, cwR, ch)];
  P.info = { x: w / 2, y: hy + 60, y2: hy + 84 };
  P.pill = { x: w / 2, y: hy + ch + 28 };
  P.toast = { x: w / 2, y: hy + ch + 62, maxW: Math.min(640, w - 40) };

  if (!wide) {
    const rowH = clamp(Math.round((sb - 560) / 7.5) + 62, minH, 84);
    const barH = 3 * rowH + 4 * g + 6, bar = sb - barH;
    const y1 = bar + g, y2 = y1 + rowH + g, y3 = y2 + rowH + g, tw = (w - 2 * pad - 2 * g) / 3;
    P.pace = [0, 1, 2].map((i) => R(pad + i * (tw + g), y1, tw, rowH));
    const sw = Math.round((w - 2 * pad - 2 * g) * 0.52), bw = Math.max(minH, 60);
    P.curveDec = R(pad, y2, bw, rowH); P.curveLabel = R(pad + bw, y2, sw - 2 * bw, rowH); P.curveInc = R(pad + sw - bw, y2, bw, rowH);
    const rest = w - pad - (pad + sw + g), hw = Math.round((rest - g) * 0.5);
    P.hint = R(pad + sw + g, y2, hw, rowH); P.menu = R(P.hint.x + hw + g, y2, rest - hw - g, rowH);
    P.roll = R(pad, y3, w - 2 * pad, rowH + 4);
    const dw = Math.round((w - 2 * pad - 2 * g) * 0.3);
    P.demo = { dec: R(pad, y1, dw, rowH), pause: R(pad + dw + g, y1, w - 2 * pad - 2 * dw - 2 * g, rowH), inc: R(w - pad - dw, y1, dw, rowH), exit: R(pad, y2, w - 2 * pad, rowH) };
    P.barTop = bar;
    const top = hy + ch + 4;
    P.court = R(0, top, w, bar - 4 - top);
    const dh = Math.round(P.court.h * clamp((w * 0.56) / P.court.h, 0.44, 0.56));
    P.deckPanel = R(0, P.court.y, w, dh);
    P.lanePanel = R(0, P.court.y + dh + 6, w, P.court.h - dh - 6);
    P.toast = { x: w / 2, y: P.deckPanel.y + P.deckPanel.h - 92, maxW: Math.min(640, w - 40) };
    const pw = Math.min(680, w - 28), ph = Math.min(620, sb - 40 - (hy + ch + 20));
    P.score = R((w - pw) / 2, hy + ch + 16, pw, ph);
    P.ffPos = { x: w / 2, y: bar - 22 };
  } else {
    const rowH = Math.max(minH, 84), barH = rowH + 2 * g + 4, bar = sb - barH;
    const y1 = bar + g, inner = w - lx - rxm;
    const share = [0.12, 0.12, 0.12, 0.25, 0.1, 0.1, 0.19], tot = share.reduce((a, c) => a + c, 0);
    const unitW = (inner - 6 * g) / tot;
    let x = lx; const xs = share.map((sh) => { const r = { x, w: sh * unitW }; x += r.w + g; return r; });
    P.pace = [0, 1, 2].map((i) => R(xs[i].x, y1, xs[i].w, rowH));
    const cx = xs[3], bw = clamp(Math.round(cx.w * 0.28), minH, 90);
    P.curveDec = R(cx.x, y1, bw, rowH); P.curveLabel = R(cx.x + bw, y1, cx.w - 2 * bw, rowH); P.curveInc = R(cx.x + cx.w - bw, y1, bw, rowH);
    P.hint = R(xs[4].x, y1, xs[4].w, rowH); P.menu = R(xs[5].x, y1, xs[5].w, rowH); P.roll = R(xs[6].x, y1, xs[6].w, rowH);
    const q = (inner - 3 * g) / 4;
    P.demo = { dec: R(lx, y1, q, rowH), pause: R(lx + q + g, y1, q, rowH), inc: R(lx + 2 * (q + g), y1, q, rowH), exit: R(lx + 3 * (q + g), y1, q, rowH) };
    P.barTop = bar;
    const top = hy + ch + 4;
    P.court = R(ins.l + 8, top, w - ins.l - ins.r - 16, bar - 4 - top);
    const lw = Math.round(P.court.w * 0.34);
    P.lanePanel = R(P.court.x, P.court.y, lw, P.court.h);
    P.deckPanel = R(P.court.x + lw + 6, P.court.y, P.court.w - lw - 6, P.court.h);
    P.toast = { x: P.deckPanel.x + P.deckPanel.w / 2, y: P.deckPanel.y + P.deckPanel.h - 92, maxW: Math.min(640, P.deckPanel.w - 30) };
    P.explain = R(lx + cwL + 14, hy, Math.max(0, w - rxm - cwR - 14 - (lx + cwL + 14)), ch + 4);
    const pw = clamp(P.court.w * 0.6, 560, 760), ph = Math.min(bar - 8 - (hy + 48), 560);   // starts below the preview pill
    P.score = R(w / 2 - pw / 2, hy + 48, pw, ph);
    P.ffPos = { x: w / 2, y: bar - 20 };
  }
  // the lane camera fits the court rectangle; the minimap sits beside the lane so the camera rect keeps its full size
  const full = R(0, 0, w, h);
  L.poses = { lane: aimPose(P.lanePanel), deck: deckPose(P.deckPanel), title: lerpPose(aimPose(full), deckPose(full), 0.78), full: deckPose(full) };

  // ---- setup pins / reference pages (same shapes as the other Arcforge games) -----------------------------------------
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
