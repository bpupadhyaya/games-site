// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe-area key, so game.js (hit-testing) and
// view.js / menus.js (drawing) never disagree.
//
//   portrait (narrower than 1.25:1): score cards on top, the lane (chase camera), the pit board (top-down, drag to aim),
//                                    then the controls: flip choice, arm gauge, Hint / PITCH / Menu.
//   wide (landscape): header across the lane and the board; lane on the left, pit board in the middle, controls on the right.
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
  const pad = 14, g = 10;
  const lx = ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l, rx = 14 + ins.r;
  if (!wide) {
    const flipH = Math.max(minH, 74), gaugeH = 150, btnH = Math.max(minH, 96);
    const ctlH = flipH + gaugeH + btnH + 3 * g;
    const ctl = sb - 8 - ctlH, hy = ins.t + 8, ch = 90;
    const infoW = 168, cw = Math.floor((w - lx - rx - infoW - 2 * g) / 2);
    P.cards = [R(lx, hy, cw, ch), R(w - rx - cw, hy, cw, ch)];
    P.info = { x: lx + cw + (w - lx - rx - 2 * cw) / 2, y: hy + 36, y2: hy + 66, w: w - lx - rx - 2 * cw - 8 };
    const top = hy + ch + 8, avail = ctl - 6 - top, inner = w - 2 * pad - ins.l - ins.r;
    if (h < w * 1.65) {
      // tablets held upright: the lane and the pit board sit side by side so the lane view is tall instead of a thin strip
      const rowH = Math.min(avail, 640), boardW = clamp(Math.round(rowH / 1.32), 200, Math.round(inner * 0.46));
      P.lane = R(pad + ins.l, top, inner - boardW - 8, rowH);
      P.board = R(pad + ins.l + inner - boardW, top, boardW, rowH);
      L.side = true;
    } else {
      const laneH = clamp(Math.round(avail * (avail < 560 ? 0.38 : 0.46)), 130, 460);
      P.lane = R(pad + ins.l, top, inner, laneH);
      P.board = R(pad + ins.l, top + laneH + 8, inner, Math.max(150, avail - laneH - 8));
    }
    P.flips = [0, 1].map((i) => R(pad + ins.l + i * ((inner - g) / 2 + g), ctl, (inner - g) / 2, flipH));
    P.gauge = R(pad + ins.l, ctl + flipH + g, inner, gaugeH);
    const y3 = P.gauge.y + gaugeH + g, hw = Math.round(inner * 0.21);
    P.hint = R(pad + ins.l, y3, hw, btnH); P.pitch = R(pad + ins.l + hw + g, y3, inner - 2 * hw - 2 * g, btnH); P.menu = R(pad + ins.l + inner - hw, y3, hw, btnH);
    P.demo = { dec: R(P.flips[0].x, ctl, P.flips[0].w, flipH), inc: R(P.flips[1].x, ctl, P.flips[1].w, flipH), pause: R(P.gauge.x, P.gauge.y, inner, gaugeH * 0.5 - 4), exit: R(P.gauge.x, P.gauge.y + gaugeH * 0.5 + 4, inner, gaugeH * 0.5 - 4) };
    P.toast = { x: P.lane.x + P.lane.w / 2, y: P.lane.y + 52, maxW: Math.min(640, P.lane.w - 20) };
    P.score = R(w / 2 - Math.min(330, (w - 40) / 2), top + 8, Math.min(660, w - 40), Math.min(avail, sb - top - 20));
  } else {
    const total = w - lx - rx, colGap = 14;
    const ctlW = clamp(Math.round(total * 0.26), 290, 400);
    const hy = ins.t + 8, ch = 84;
    const boardW = clamp(Math.round(((sb - hy - ch - 20) / 1.32) * 0.96) + 16, 240, Math.round(total * 0.34));
    const laneW = total - ctlW - boardW - 2 * colGap;
    const infoW = 150, cw = Math.floor((laneW + boardW + colGap - infoW - 2 * g) / 2);
    P.cards = [R(lx, hy, cw, ch), R(lx + laneW + boardW + colGap - cw, hy, cw, ch)];
    P.info = { x: lx + (laneW + boardW + colGap) / 2, y: hy + 34, y2: hy + 62, w: infoW - 8 };
    const top = hy + ch + 10, bot = sb - 8;
    P.lane = R(lx, top, laneW, bot - top);
    P.board = R(lx + laneW + colGap, top, boardW, bot - top);
    const cx = lx + laneW + boardW + 2 * colGap, flipH = Math.max(minH, 70), gaugeH = clamp(Math.round((bot - top) * 0.3), 130, 190), btnH = Math.max(minH, 92);
    P.flips = [R(cx, hy, ctlW, flipH), R(cx, hy + flipH + g, ctlW, flipH)];
    const gy = hy + 2 * flipH + 2 * g + 6;
    P.gauge = R(cx, gy, ctlW, gaugeH);
    const y3 = gy + gaugeH + g, y4 = y3 + btnH + g, hw = Math.round((ctlW - g) / 2);
    P.pitch = R(cx, y3, ctlW, btnH); P.hint = R(cx, y4, hw, Math.max(minH, 72)); P.menu = R(cx + hw + g, y4, ctlW - hw - g, Math.max(minH, 72));
    P.demo = { dec: R(cx, hy, ctlW, flipH), inc: R(cx, hy + flipH + g, ctlW, flipH), pause: R(cx, gy, ctlW, gaugeH * 0.5 - 4), exit: R(cx, gy + gaugeH * 0.5 + 4, ctlW, gaugeH * 0.5 - 4) };
    P.toast = { x: lx + laneW / 2, y: P.lane.y + 52, maxW: Math.min(560, laneW - 24) };
    const pw = clamp(w * 0.5, 460, 700);
    P.score = R(lx + (laneW + boardW) / 2 - pw / 2, top + 8, pw, Math.min(sb - top - 16, 560));
  }

  // ---- setup pins and reference pages -----------------------------------------------------------------------------------
  const su = (L.setup = {});
  if (!wide) {
    const sw = Math.round((w - 60) * 0.62), cw = Math.min(640, w - 80);
    L.pins = { start: R(30, sb - 124, sw, 96), back: R(30 + sw + 16, sb - 124, w - 30 - (30 + sw + 16), 96) };
    su.cols = [{ x: (w - cw) / 2, w: cw, top: ins.t, bottom: L.pins.start.y - 26 }];
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
